import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransport, RegistrationResponseJSON } from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
import { emptyState, mergeStates, stateSignature, validateState, type DataFile, type SyncState } from '../src/sync/merge.js';
import { b64url, fromB64url, hashSecret, newRecoveryCode, normalizeCode, safeEqual, setupCode, signToken, verifySecret, verifyToken } from './crypto.js';
import { checkSameOrigin, cookie, expectedOrigin, host, isLocal, jsonBody, parseCookies, rpId, send, type Req, type Res } from './http.js';
import { ConflictError, GitHubStorage, type JsonStorage } from './storage.js';

export const AUTH_PATH = 'auth.json';
export const DATA_PATH = 'data.json';
const SESSION_COOKIE = 'ma_session';
const CHALLENGE_COOKIE = 'ma_challenge';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days
const CHALLENGE_TTL = 300; // 5 minutes

export interface StoredCredential {
  id: string;
  publicKey: string; // base64url COSE key
  counter: number;
  transports?: AuthenticatorTransport[];
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface AuthFile {
  version: 1;
  credentials: StoredCredential[];
  recoveryHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deps {
  storage: JsonStorage;
  secret: string;
  /** Overridable for tests */
  webauthn?: {
    verifyRegistration: typeof verifyRegistrationResponse;
    verifyAuthentication: typeof verifyAuthenticationResponse;
  };
}

/** Builds dependencies from environment variables; null when not configured. */
export function depsFromEnv(): Deps | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.DATA_REPO?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!token || !repo || !secret || secret.length < 32 || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { storage: new GitHubStorage(token, repo, process.env.DATA_BRANCH?.trim() || undefined), secret };
}

type Handler = (req: Req, res: Res, deps: Deps) => Promise<void>;

/** Wraps a handler: env check, method/CSRF check, uniform error handling without leaking details. */
export function route(handler: Handler, opts: { method: 'GET' | 'POST'; depsFactory?: () => Deps | null }) {
  return async (req: Req, res: Res) => {
    if (req.method !== opts.method) return send(res, 405, { error: 'method_not_allowed' });
    if (opts.method === 'POST' && !checkSameOrigin(req)) return send(res, 403, { error: 'forbidden' });
    const deps = (opts.depsFactory ?? depsFromEnv)();
    if (!deps) return send(res, 503, { error: 'not_configured' });
    try {
      await handler(req, res, deps);
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      console.error('[api] error:', (e as Error)?.name, msg.slice(0, 80));
      // Safe diagnostic code (GitHub HTTP status only, never tokens or data)
      const gh = /^github (raw read|read|write) (\d{3})$/.exec(msg);
      send(res, 500, { error: 'server_error', detail: gh ? `github_${gh[1].replace(' ', '_')}_${gh[2]}` : (e as Error)?.name ?? 'Error' });
    }
  };
}

const secure = (req: Req) => !isLocal(host(req));
const sessionCookie = (req: Req, d: Deps) => cookie(SESSION_COOKIE, signToken(d.secret, { sub: 'owner' }, SESSION_TTL), SESSION_TTL, '/api', secure(req));
const clearCookie = (req: Req, name: string, path = '/api') => cookie(name, '', 0, path, secure(req));

export function isAuthenticated(req: Req, d: Deps) {
  return !!verifyToken(d.secret, parseCookies(req)[SESSION_COOKIE]);
}

async function readAuth(d: Deps) {
  return d.storage.read<AuthFile>(AUTH_PATH);
}

/** Read-modify-write with optimistic locking and retries */
async function updateAuth(d: Deps, mutate: (a: AuthFile) => AuthFile, message: string) {
  for (let i = 0; i < 3; i++) {
    const cur = await readAuth(d);
    const now = new Date().toISOString();
    const base: AuthFile = cur?.data ?? { version: 1, credentials: [], createdAt: now, updatedAt: now };
    const next = { ...mutate(structuredClone(base)), updatedAt: now };
    try {
      await d.storage.write(AUTH_PATH, next, cur?.sha, message);
      return next;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
    }
  }
  throw new Error('auth write conflict');
}

/** Stable WebAuthn user handle so every device's passkey belongs to the same account */
const userHandle = (secret: string) => new Uint8Array(createHash('sha256').update(`myagenda-user:${secret}`).digest()).slice(0, 16);

// ---------- handlers ----------

export const status: Handler = async (req, res, d) => {
  const auth = await readAuth(d);
  send(res, 200, {
    configured: true,
    registered: !!auth?.data.credentials.length,
    authenticated: isAuthenticated(req, d),
    devices: isAuthenticated(req, d) ? auth?.data.credentials.map((c) => ({ id: c.id.slice(0, 8), name: c.name, createdAt: c.createdAt, lastUsedAt: c.lastUsedAt })) : undefined,
  });
};

export const registerOptions: Handler = async (req, res, d) => {
  const body = jsonBody(req);
  const auth = await readAuth(d);
  const first = !auth?.data.credentials.length;
  if (first) {
    const code = typeof body.setupCode === 'string' ? normalizeCode(body.setupCode) : '';
    if (!code || !safeEqual(code, normalizeCode(setupCode(d.secret)))) return send(res, 403, { error: 'bad_setup_code' });
  } else if (!isAuthenticated(req, d)) {
    return send(res, 401, { error: 'unauthenticated' });
  }
  const options = await generateRegistrationOptions({
    rpName: 'MyAgenda',
    rpID: rpId(req),
    userName: 'MyAgenda',
    userDisplayName: 'MyAgenda',
    userID: userHandle(d.secret),
    attestationType: 'none',
    excludeCredentials: (auth?.data.credentials ?? []).map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  const chal = signToken(d.secret, { c: options.challenge, k: 'reg', first }, CHALLENGE_TTL);
  send(res, 200, options, [cookie(CHALLENGE_COOKIE, chal, CHALLENGE_TTL, '/api/auth', secure(req))]);
};

export const registerVerify: Handler = async (req, res, d) => {
  const body = jsonBody(req);
  const chal = verifyToken<{ c: string; k: string; first: boolean }>(d.secret, parseCookies(req)[CHALLENGE_COOKIE]);
  if (!chal || chal.k !== 'reg') return send(res, 400, { error: 'challenge_expired' });
  const auth = await readAuth(d);
  const first = !auth?.data.credentials.length;
  if (first !== chal.first) return send(res, 409, { error: 'state_changed' });
  if (!first && !isAuthenticated(req, d)) return send(res, 401, { error: 'unauthenticated' });

  const verify = d.webauthn?.verifyRegistration ?? verifyRegistrationResponse;
  let result;
  try {
    result = await verify({
      response: body.response as RegistrationResponseJSON,
      expectedChallenge: chal.c,
      expectedOrigin: expectedOrigin(req),
      expectedRPID: rpId(req),
      requireUserVerification: true,
    });
  } catch {
    return send(res, 400, { error: 'verification_failed' });
  }
  if (!result.verified || !result.registrationInfo) return send(res, 400, { error: 'verification_failed' });

  const cred = result.registrationInfo.credential;
  const name = (typeof body.deviceName === 'string' ? body.deviceName : '').trim().slice(0, 40) || 'Cihaz';
  const recovery = first ? newRecoveryCode() : undefined;
  const now = new Date().toISOString();
  await updateAuth(
    d,
    (a) => {
      if (first && a.credentials.length) throw new Error('already registered');
      a.credentials = a.credentials.filter((c) => c.id !== cred.id);
      a.credentials.push({ id: cred.id, publicKey: b64url(cred.publicKey), counter: cred.counter, transports: cred.transports as AuthenticatorTransport[] | undefined, name, createdAt: now });
      if (recovery) a.recoveryHash = hashSecret(recovery);
      return a;
    },
    first ? 'auth: owner registered' : `auth: passkey added (${name})`,
  );
  send(res, 200, { ok: true, recoveryCode: recovery }, [sessionCookie(req, d), clearCookie(req, CHALLENGE_COOKIE, '/api/auth')]);
};

export const loginOptions: Handler = async (req, res, d) => {
  const auth = await readAuth(d);
  if (!auth?.data.credentials.length) return send(res, 404, { error: 'not_registered' });
  const options = await generateAuthenticationOptions({
    rpID: rpId(req),
    allowCredentials: auth.data.credentials.map((c) => ({ id: c.id, transports: c.transports })),
    userVerification: 'required',
  });
  const chal = signToken(d.secret, { c: options.challenge, k: 'auth' }, CHALLENGE_TTL);
  send(res, 200, options, [cookie(CHALLENGE_COOKIE, chal, CHALLENGE_TTL, '/api/auth', secure(req))]);
};

export const loginVerify: Handler = async (req, res, d) => {
  const body = jsonBody(req);
  const chal = verifyToken<{ c: string; k: string }>(d.secret, parseCookies(req)[CHALLENGE_COOKIE]);
  if (!chal || chal.k !== 'auth') return send(res, 400, { error: 'challenge_expired' });
  const response = body.response as AuthenticationResponseJSON | undefined;
  const auth = await readAuth(d);
  const cred = auth?.data.credentials.find((c) => c.id === response?.id);
  if (!response || !cred) return send(res, 401, { error: 'unknown_credential' });

  const verify = d.webauthn?.verifyAuthentication ?? verifyAuthenticationResponse;
  let result;
  try {
    result = await verify({
      response,
      expectedChallenge: chal.c,
      expectedOrigin: expectedOrigin(req),
      expectedRPID: rpId(req),
      credential: { id: cred.id, publicKey: fromB64url(cred.publicKey), counter: cred.counter, transports: cred.transports },
      requireUserVerification: true,
    });
  } catch {
    return send(res, 401, { error: 'verification_failed' });
  }
  if (!result.verified) return send(res, 401, { error: 'verification_failed' });

  try {
    await updateAuth(
      d,
      (a) => {
        const c = a.credentials.find((x) => x.id === cred.id);
        if (c) {
          c.counter = result.authenticationInfo.newCounter;
          c.lastUsedAt = new Date().toISOString();
        }
        return a;
      },
      'auth: sign-in',
    );
  } catch {
    /* counter bookkeeping is best-effort */
  }
  send(res, 200, { ok: true }, [sessionCookie(req, d), clearCookie(req, CHALLENGE_COOKIE, '/api/auth')]);
};

export const recover: Handler = async (req, res, d) => {
  const body = jsonBody(req);
  const code = typeof body.code === 'string' ? body.code.slice(0, 64) : '';
  const auth = await readAuth(d);
  // Constant extra delay slows down guessing (the code has ~100 bits of entropy anyway)
  await new Promise((r) => setTimeout(r, 400));
  if (!code || !verifySecret(code, auth?.data.recoveryHash)) return send(res, 401, { error: 'bad_code' });
  send(res, 200, { ok: true }, [sessionCookie(req, d)]);
};

export const recoveryReset: Handler = async (req, res, d) => {
  if (!isAuthenticated(req, d)) return send(res, 401, { error: 'unauthenticated' });
  const code = newRecoveryCode();
  await updateAuth(d, (a) => ({ ...a, recoveryHash: hashSecret(code) }), 'auth: recovery code rotated');
  send(res, 200, { recoveryCode: code });
};

export const removeDevice: Handler = async (req, res, d) => {
  if (!isAuthenticated(req, d)) return send(res, 401, { error: 'unauthenticated' });
  const prefix = jsonBody(req).id;
  if (typeof prefix !== 'string' || prefix.length < 8) return send(res, 400, { error: 'bad_request' });
  const auth = await readAuth(d);
  if ((auth?.data.credentials.length ?? 0) <= 1) return send(res, 409, { error: 'last_device' });
  await updateAuth(d, (a) => ({ ...a, credentials: a.credentials.filter((c) => !c.id.startsWith(prefix)) }), 'auth: passkey removed');
  send(res, 200, { ok: true });
};

export const logout: Handler = async (req, res) => {
  send(res, 200, { ok: true }, [clearCookie(req, SESSION_COOKIE)]);
};

export const sync: Handler = async (req, res, d) => {
  if (!isAuthenticated(req, d)) return send(res, 401, { error: 'unauthenticated' });
  const body = jsonBody(req);
  const err = validateState(body.state);
  if (err) return send(res, 400, { error: 'invalid_payload', detail: err });
  const incoming = body.state as SyncState;

  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = await d.storage.read<DataFile>(DATA_PATH);
    const stored: SyncState = cur?.data ?? emptyState();
    const merged = mergeStates(stored, incoming);
    let wrote = false;
    if (!cur || stateSignature(merged) !== stateSignature(stored)) {
      const file: DataFile = { format: 'myagenda-data', version: 1, updatedAt: new Date().toISOString(), ...merged };
      try {
        await d.storage.write(DATA_PATH, file, cur?.sha, `sync: ${new Date().toISOString()}`);
        wrote = true;
      } catch (e) {
        if (e instanceof ConflictError) continue; // another device synced meanwhile → re-merge
        throw e;
      }
    }
    return send(res, 200, { state: merged, wrote, serverTime: new Date().toISOString() });
  }
  send(res, 409, { error: 'busy' });
};
