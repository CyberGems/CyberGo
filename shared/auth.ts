import crypto from 'crypto';
import type { AuthMethod } from './types';

/** Returns the secret to hash, or null when it does not match the method. */
export function normalizeAuthSecret(value: string, method: AuthMethod): string | null {
  if (method === 'pin') {
    const pin = value.trim();
    return /^\d{4,8}$/.test(pin) ? pin : null;
  }
  return value.length >= 4 ? value : null;
}

export const SCRYPT_N = 16384;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_KEYLEN = 64;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * New secrets are hashed with scrypt, which runs natively and does not freeze
 * the interface the way the pure JavaScript bcrypt build did.
 */
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(secret, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/**
 * Accepts both the scrypt hashes written today and the bcrypt hashes of the
 * alpha builds.
 *
 * A damaged hash must never unlock anything. The key length comes from the
 * stored value, so an empty one would derive an empty key that compares equal
 * to itself and would accept any password.
 */
export async function verifySecret(
  secret: string,
  stored: string | null,
  legacyCompare?: (value: string, hash: string) => Promise<boolean>,
): Promise<boolean> {
  if (!stored) return false;
  if (!stored.startsWith('scrypt$')) {
    if (!legacyCompare) return false;
    try {
      return await legacyCompare(secret, stored);
    } catch {
      return false;
    }
  }
  const parts = stored.split('$');
  if (parts.length !== 6) return false;
  const [, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (N !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  let expected: Buffer;
  let salt: Buffer;
  try {
    expected = Buffer.from(keyRaw, 'base64');
    salt = Buffer.from(saltRaw, 'base64');
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN || salt.length === 0) return false;
  try {
    const key = await scryptAsync(secret, salt, SCRYPT_KEYLEN, { N, r, p });
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
