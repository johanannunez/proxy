// AES-256-GCM encryption for tax data (W-9 SSN/EIN, tax_profiles).
// SERVER-SIDE ONLY -- never import this from client components.
//
// The tax key is kept independent of TREASURY_ENCRYPTION_KEY so the
// two can be rotated on different schedules and a compromise of one
// does not expose the other.

import { deriveKeyFromEnv, encryptWith, decryptWith } from "@/lib/treasury/encryption";

function getTaxKey(): Buffer {
  const raw = process.env.TAX_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TAX_ENCRYPTION_KEY is not set");
  }
  return deriveKeyFromEnv(raw);
}

export function encrypt(plaintext: string): Buffer {
  return encryptWith(plaintext, getTaxKey());
}

export function decrypt(data: Buffer): string {
  return decryptWith(data, getTaxKey());
}
