import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { KeyRing } from "./key-ring.js";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface Sealed {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: number;
}

/**
 * Cifrado de mensajes en la aplicación (AES-256-GCM). El `context` (id de la
 * conversación) va como dato asociado: un mensaje copiado a otra conversación
 * no se puede descifrar.
 */
export class MessageCipher {
  constructor(private readonly keys: KeyRing) {}

  async seal(plaintext: string, context: string): Promise<Sealed> {
    const keyVersion = this.keys.currentVersion;
    const key = await this.keys.getKey(keyVersion);
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(context, "utf8"));
    const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return { ciphertext: Buffer.concat([body, cipher.getAuthTag()]), nonce, keyVersion };
  }

  async open(sealed: Sealed, context: string): Promise<string> {
    const key = await this.keys.getKey(sealed.keyVersion);
    const body = sealed.ciphertext.subarray(0, sealed.ciphertext.length - TAG_BYTES);
    const tag = sealed.ciphertext.subarray(sealed.ciphertext.length - TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, key, sealed.nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  }
}
