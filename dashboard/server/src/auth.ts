/** Single-user auth: password -> bcrypt check -> JWT in an httpOnly cookie.
 *
 *  This dashboard is exposed to the public internet, so the login route is the one
 *  attack surface that matters. It is rate limited, the password is never stored in
 *  plaintext (only a bcrypt hash, via DASHBOARD_PASSWORD_HASH), and the JWT lives in
 *  an httpOnly + SameSite=Strict cookie so page scripts cannot read it and a hostile
 *  site cannot replay it.
 *
 *  The whole API is read-only, which is the real mitigation: even a stolen session
 *  cannot place a trade or change the bot's behaviour.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { looksLikeValidHash, verifyPasswordHash } from './password';

const COOKIE = 'bot_session';
const SESSION_DAYS = 7;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Fail at boot rather than letting the dashboard come up unauthenticated.
    throw new Error(`${name} is not set — refusing to start. See dashboard/README.md`);
  }
  return value;
}

const passwordHash = requiredEnv('DASHBOARD_PASSWORD_HASH');
const jwtSecret = requiredEnv('JWT_SECRET');

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters — generate one with `openssl rand -hex 32`');
}

// Catch a mangled or half-pasted hash at boot rather than as a login that can never
// succeed. This is exactly the failure docker compose's `$` interpolation used to cause.
if (!looksLikeValidHash(passwordHash)) {
  throw new Error(
    'DASHBOARD_PASSWORD_HASH is not a valid scrypt hash (expected saltHex:hashHex). '
    + 'Regenerate it with server/src/hash-password.js and check nothing altered the value.',
  );
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 512) {
    return false;
  }
  return verifyPasswordHash(candidate, passwordHash);
}

export function issueSession(res: Response): void {
  const token = jwt.sign({ sub: 'owner' }, jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    // The reverse proxy terminates TLS and forwards plain HTTP over the internal Docker
    // network; the browser still only ever talks HTTPS, so the cookie must be Secure in
    // production.
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE];
  if (!token) {
    res.status(401).json({ error: 'not authenticated' });
    return;
  }
  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    clearSession(res);
    res.status(401).json({ error: 'session expired' });
  }
}
