import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalKeyRing } from "./key-ring.js";
import { MessageCipher } from "./message-cipher.js";

const k1 = randomBytes(32).toString("base64");
const k2 = randomBytes(32).toString("base64");

describe("MessageCipher", () => {
  it("cifra y descifra con la clave vigente", async () => {
    const cipher = new MessageCipher(new LocalKeyRing(`1:${k1}`, 1));
    const sealed = await cipher.seal("hola, acá estoy", "conv-1");
    expect(sealed.ciphertext.toString("utf8")).not.toContain("hola");
    expect(await cipher.open(sealed, "conv-1")).toBe("hola, acá estoy");
  });

  it("no descifra un mensaje movido a otra conversación", async () => {
    const cipher = new MessageCipher(new LocalKeyRing(`1:${k1}`, 1));
    const sealed = await cipher.seal("secreto", "conv-1");
    await expect(cipher.open(sealed, "conv-2")).rejects.toThrow();
  });

  it("después de rotar, los mensajes viejos se siguen leyendo", async () => {
    const before = new MessageCipher(new LocalKeyRing(`1:${k1}`, 1));
    const old = await before.seal("viejo", "c");
    const after = new MessageCipher(new LocalKeyRing(`1:${k1},2:${k2}`, 2));
    const fresh = await after.seal("nuevo", "c");
    expect(fresh.keyVersion).toBe(2);
    expect(await after.open(old, "c")).toBe("viejo");
    expect(await after.open(fresh, "c")).toBe("nuevo");
  });
});
