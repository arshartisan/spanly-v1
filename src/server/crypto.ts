import crypto from "node:crypto";
import type { ProviderTokens } from "@/providers/types";

/**
 * AES-256-GCM encryption for OAuth tokens stored at rest
 * (docs/implementation/05 + 09). Never log decrypted tokens.
 *
 * Storage format: base64( iv[12] | authTag[16] | ciphertext ).
 */
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENC_KEY must be a 32-byte hex string (64 chars). Run: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + 16);
  const data = raw.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptTokens(tokens: ProviderTokens): string {
  return encrypt(JSON.stringify(tokens));
}

export function decryptTokens(blob: string): ProviderTokens {
  return JSON.parse(decrypt(blob)) as ProviderTokens;
}
