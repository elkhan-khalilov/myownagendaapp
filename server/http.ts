import type { IncomingMessage, ServerResponse } from 'node:http';

/** Minimal shape of Vercel's Node.js request/response helpers */
export type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };
export type Res = ServerResponse;

export function send(res: Res, status: number, body: unknown, cookies: string[] = []) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(JSON.stringify(body));
}

export function parseCookies(req: Req): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name: string, value: string, maxAge: number, path = '/api', secure = true) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function host(req: Req): string {
  const h = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
  return h.split(',')[0].trim().toLowerCase();
}

export const isLocal = (h: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h);

export function expectedOrigin(req: Req) {
  const h = host(req);
  return `${isLocal(h) ? 'http' : 'https'}://${h}`;
}

/** RP ID for WebAuthn = hostname without port */
export const rpId = (req: Req) => host(req).split(':')[0];

/**
 * CSRF protection for state-changing requests: same-origin Origin header plus a custom header
 * (a cross-site form or image request can send neither). Session cookies are also SameSite=Strict.
 */
export function checkSameOrigin(req: Req): boolean {
  if (req.method !== 'POST') return false;
  if (req.headers['x-myagenda'] !== '1') return false;
  const origin = req.headers.origin;
  return !!origin && origin === expectedOrigin(req);
}

export function jsonBody(req: Req): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === 'string') {
    try {
      const v = JSON.parse(b);
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}
