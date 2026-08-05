/** Password hashing with Node's built-in scrypt.
 *
 *  Deliberately NOT bcrypt. A bcrypt hash looks like `$2b$12$...`, and docker compose
 *  interpolates `$` in env values — it silently ate part of the hash during testing and
 *  produced one that could never match, with no error anywhere. The stored format here
 *  is `saltHex:hashHex`, which contains no `$` and survives any env plumbing intact.
 *  It also removes a third-party dependency: scrypt is in the standard library and is
 *  a memory-hard KDF designed for exactly this.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;

  const actual = scryptSync(password, salt, KEY_LEN);
  // Constant-time: a length-varying or short-circuiting compare leaks the hash.
  return timingSafeEqual(actual, expected);
}

export function looksLikeValidHash(stored: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{128}$/.test(stored);
}
