import { KeyManagementServiceClient } from "@google-cloud/kms";
import type { Env } from "../config/env.js";

/** Claves de datos (AES-256) por versión. La versión actual cifra; todas descifran. */
export interface KeyRing {
  readonly currentVersion: number;
  getKey(version: number): Promise<Buffer>;
}

function parseKeyList(raw: string): Map<number, Buffer> {
  const map = new Map<number, Buffer>();
  for (const entry of raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = entry.indexOf(":");
    if (idx < 1) throw new Error("MESSAGE_KEYS: formato esperado 'versión:base64'");
    const version = Number(entry.slice(0, idx));
    if (!Number.isInteger(version) || version < 1)
      throw new Error("MESSAGE_KEYS: versión inválida");
    map.set(version, Buffer.from(entry.slice(idx + 1), "base64"));
  }
  return map;
}

/** Solo desarrollo y tests: claves en claro desde el entorno. */
export class LocalKeyRing implements KeyRing {
  private readonly keys: Map<number, Buffer>;

  constructor(
    raw: string,
    readonly currentVersion: number,
  ) {
    this.keys = parseKeyList(raw);
    for (const [v, k] of this.keys) {
      if (k.length !== 32) throw new Error(`La clave v${v} debe tener 32 bytes`);
    }
    if (!this.keys.has(currentVersion)) throw new Error("Falta la clave de la versión actual");
  }

  async getKey(version: number): Promise<Buffer> {
    const key = this.keys.get(version);
    if (!key) throw new Error(`Clave de mensajes v${version} desconocida`);
    return key;
  }
}

/**
 * Producción: cifrado sobre (envelope). Cada versión es una clave de datos envuelta
 * con Cloud KMS; se desenvuelve una vez y queda en memoria del proceso.
 */
export class KmsKeyRing implements KeyRing {
  private readonly wrapped: Map<number, Buffer>;
  private readonly cache = new Map<number, Promise<Buffer>>();
  private readonly client = new KeyManagementServiceClient();

  constructor(
    raw: string,
    readonly currentVersion: number,
    private readonly kmsKeyName: string,
  ) {
    this.wrapped = parseKeyList(raw);
    if (!this.wrapped.has(currentVersion)) throw new Error("Falta la clave de la versión actual");
  }

  getKey(version: number): Promise<Buffer> {
    let pending = this.cache.get(version);
    if (!pending) {
      const wrapped = this.wrapped.get(version);
      if (!wrapped) return Promise.reject(new Error(`Clave de mensajes v${version} desconocida`));
      pending = this.client
        .decrypt({ name: this.kmsKeyName, ciphertext: wrapped })
        .then(([res]) => {
          const plaintext = res.plaintext;
          if (!plaintext) throw new Error("KMS no devolvió la clave");
          const key = Buffer.from(plaintext as Uint8Array);
          if (key.length !== 32) throw new Error("La clave de datos debe tener 32 bytes");
          return key;
        });
      pending.catch(() => this.cache.delete(version));
      this.cache.set(version, pending);
    }
    return pending;
  }
}

export function createKeyRing(env: Env): KeyRing {
  if (env.MESSAGE_KEY_PROVIDER === "gcp-kms") {
    if (!env.KMS_KEY_NAME) throw new Error("Falta KMS_KEY_NAME");
    return new KmsKeyRing(env.MESSAGE_KEYS, env.MESSAGE_KEY_CURRENT_VERSION, env.KMS_KEY_NAME);
  }
  return new LocalKeyRing(env.MESSAGE_KEYS, env.MESSAGE_KEY_CURRENT_VERSION);
}
