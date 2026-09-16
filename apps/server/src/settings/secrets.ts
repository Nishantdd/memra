import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SECRET_KEY_FILE } from "../constants/index.ts";

const ALGO = "aes-256-gcm";

/** Symmetric key generated once per installation; keeps provider API keys unreadable in database backups. */
export class SecretBox {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    this.#key = key;
  }

  static load(dataDir: string): SecretBox {
    const file = path.join(dataDir, SECRET_KEY_FILE);
    if (!existsSync(file)) writeFileSync(file, randomBytes(32), { mode: 0o600 });
    const key = readFileSync(file);
    if (key.length !== 32) throw new Error(`${file} is not a valid 32-byte key`);
    return new SecretBox(key);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.#key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }

  decrypt(encoded: string): string {
    const buf = Buffer.from(encoded, "base64");
    const decipher = createDecipheriv(ALGO, this.#key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  }
}
