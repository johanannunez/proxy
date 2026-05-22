// AES-256-GCM encryption.
// SERVER-SIDE ONLY -- never import this from client components.
//
// Two layers:
//   1. `encryptWith` / `decryptWith` take a 32-byte key Buffer directly.
//      Use these when the caller already holds a key (e.g. the tax
//      module loads its own key from TAX_ENCRYPTION_KEY).
//   2. `encrypt` / `decrypt` are convenience wrappers that read
//      TREASURY_ENCRYPTION_KEY at call time.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Coerces an env-var value to a 32-byte key. Accepts either a
 * 64-char hex string (raw 32 bytes) or any string, which is hashed
 * to 32 bytes via SHA-256. Exported so other modules (the tax module)
 * can derive their own keys without duplicating the coercion rule.
 */
export function deriveKeyFromEnv(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

function getTreasuryKey(): Buffer {
  const raw = process.env.TREASURY_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TREASURY_ENCRYPTION_KEY is not set");
  }
  return deriveKeyFromEnv(raw);
}

/**
 * Encrypts `plaintext` under `key`. Returns IV(16) + authTag(16) + ciphertext.
 */
export function encryptWith(plaintext: string, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes; got ${key.length}`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts a Buffer produced by `encryptWith` under the same `key`.
 */
export function decryptWith(data: Buffer, key: Buffer): string {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes; got ${key.length}`);
  }
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function encrypt(plaintext: string): Buffer {
  return encryptWith(plaintext, getTreasuryKey());
}

export function decrypt(data: Buffer): string {
  return decryptWith(data, getTreasuryKey());
}
