import type { AuthMethod } from './types';

/** Returns the secret to hash, or null when it does not match the method. */
export function normalizeAuthSecret(value: string, method: AuthMethod): string | null {
  if (method === 'pin') {
    const pin = value.trim();
    return /^\d{4,8}$/.test(pin) ? pin : null;
  }
  return value.length >= 4 ? value : null;
}
