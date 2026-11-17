import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const b64url = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString('base64url');
export const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export function hmac(secret: string, data: string) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signed, expiring token: base64url(json).signature */
export function signToken(secret: string, payload: Record<string, unknown>, ttlSeconds: number) {
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  return `${body}.${hmac(secret, body)}`;
}

export function verifyToken<T extends Record<string, unknown>>(secret: string, token: string | undefined): T | null {
  if (!token || token.length > 4096) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEqual(sig, hmac(secret, body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * One-time setup code that authorizes creating the very first passkey.
 * Derived from SESSION_SECRET, so only the owner (who set the secret) can know it.
 */
export function setupCode(secret: string) {
  const hex = createHmac('sha256', secret).update('myagenda-setup-code').digest('hex').slice(0, 12).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

/** 20-char recovery code (~100 bits), grouped for readability */
export function newRecoveryCode() {
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{1,5}/g)!.join('-');
}

export function hashSecret(code: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(normalizeCode(code), salt, 32);
  return `scrypt$${b64url(salt)}$${b64url(hash)}`;
}

export function verifySecret(code: string, stored: string | undefined) {
  if (!stored) return false;
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const got = scryptSync(normalizeCode(code), Buffer.from(salt, 'base64url'), 32);
  return safeEqual(b64url(got), hash);
}
