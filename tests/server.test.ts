// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AUTH_PATH, DATA_PATH, loginOptions, loginVerify, recover, recoveryReset, registerOptions, registerVerify, route, status, sync, type AuthFile, type Deps,
} from '../server/handlers';
import { setupCode, signToken, verifyToken } from '../server/crypto';
import { ConflictError, MemoryStorage } from '../server/storage';
import { emptyState, mergeStates, validateState, type DataFile, type SyncState } from '../src/sync/merge';

const SECRET = 'test-secret-test-secret-test-secret-123';
const HOST = 'myagenda.example';

function makeDeps(storage = new MemoryStorage()): Deps & { storage: MemoryStorage } {
  return {
    storage,
    secret: SECRET,
    webauthn: {
      verifyRegistration: (async () => ({
        verified: true,
        registrationInfo: { credential: { id: 'cred-AAAAAAAA-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } },
      })) as never,
      verifyAuthentication: (async () => ({ verified: true, authenticationInfo: { newCounter: 5 } })) as never,
    },
  };
}

interface Out { status: number; body: any; cookies: string[] }

async function call(handler: any, deps: Deps | null, opts: { method?: 'GET' | 'POST'; body?: unknown; cookies?: string; headers?: Record<string, string> } = {}): Promise<Out> {
  const method = opts.method ?? 'POST';
  const req: any = {
    method,
    body: opts.body,
    headers: { host: HOST, origin: `https://${HOST}`, 'x-myagenda': '1', cookie: opts.cookies ?? '', ...opts.headers },
  };
  let status = 0;
  let text = '';
  const headers: Record<string, any> = {};
  const res: any = {
    set statusCode(v: number) { status = v; },
    get statusCode() { return status; },
    setHeader: (k: string, v: any) => (headers[k.toLowerCase()] = v),
    end: (t: string) => (text = t),
  };
  await route(handler, { method, depsFactory: () => deps })(req, res);
  return { status, body: text ? JSON.parse(text) : null, cookies: ([] as string[]).concat(headers['set-cookie'] ?? []) };
}

const cookieHeader = (cookies: string[]) => cookies.map((c) => c.split(';')[0]).join('; ');

async function registerOwner(deps: Deps) {
  const opt = await call(registerOptions, deps, { body: { setupCode: setupCode(SECRET) } });
  const ver = await call(registerVerify, deps, { body: { response: { id: 'x' }, deviceName: 'iPhone' }, cookies: cookieHeader(opt.cookies) });
  return { opt, ver, session: cookieHeader(ver.cookies.filter((c) => c.startsWith('ma_session'))) };
}

describe('security basics', () => {
  it('rejects POST without same-origin Origin + custom header (CSRF)', async () => {
    const d = makeDeps();
    expect((await call(sync, d, { headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await call(sync, d, { headers: { 'x-myagenda': '' } })).status).toBe(403);
  });
  it('503 when env is not configured', async () => {
    expect((await call(status, null, { method: 'GET' })).status).toBe(503);
  });
  it('signed tokens: tamper & expiry', () => {
    const t = signToken(SECRET, { sub: 'owner' }, 60);
    expect(verifyToken(SECRET, t)?.sub).toBe('owner');
    expect(verifyToken(SECRET, t.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).toBeNull();
    expect(verifyToken('other-secret-other-secret-other-secret', t)).toBeNull();
    expect(verifyToken(SECRET, signToken(SECRET, {}, -1))).toBeNull();
  });
  it('session cookie is HttpOnly, Secure, SameSite=Strict', async () => {
    const { session, ver } = await registerOwner(makeDeps());
    expect(session).toMatch(/^ma_session=/);
    const raw = ver.cookies.find((c) => c.startsWith('ma_session'))!;
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/Secure/);
    expect(raw).toMatch(/SameSite=Strict/);
  });
});

describe('passkey registration & login', () => {
  it('first registration requires the setup code', async () => {
    const d = makeDeps();
    expect((await call(registerOptions, d, { body: {} })).status).toBe(403);
    expect((await call(registerOptions, d, { body: { setupCode: 'AAAA-BBBB-CCCC' } })).status).toBe(403);
    const ok = await call(registerOptions, d, { body: { setupCode: setupCode(SECRET).toLowerCase().replace(/-/g, ' ') } });
    expect(ok.status).toBe(200);
    expect(ok.body.challenge).toBeTruthy();
    expect(ok.body.authenticatorSelection.userVerification).toBe('required');
  });

  it('registers owner, stores public key only, returns recovery code once', async () => {
    const d = makeDeps();
    const { ver } = await registerOwner(d);
    expect(ver.status).toBe(200);
    expect(ver.body.recoveryCode).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    const auth = (await d.storage.read<AuthFile>(AUTH_PATH))!.data;
    expect(auth.credentials).toHaveLength(1);
    expect(auth.credentials[0].name).toBe('iPhone');
    expect(JSON.stringify(auth)).not.toContain(ver.body.recoveryCode); // only a scrypt hash is stored
  });

  it('after registration, adding a passkey needs a session; setup code no longer works', async () => {
    const d = makeDeps();
    const { session } = await registerOwner(d);
    expect((await call(registerOptions, d, { body: { setupCode: setupCode(SECRET) } })).status).toBe(401);
    expect((await call(registerOptions, d, { body: {}, cookies: session })).status).toBe(200);
  });

  it('login with passkey issues a session and updates the counter', async () => {
    const d = makeDeps();
    await registerOwner(d);
    const opt = await call(loginOptions, d);
    expect(opt.body.allowCredentials[0].id).toBe('cred-AAAAAAAA-1');
    const ver = await call(loginVerify, d, { body: { response: { id: 'cred-AAAAAAAA-1' } }, cookies: cookieHeader(opt.cookies) });
    expect(ver.status).toBe(200);
    expect(ver.cookies.some((c) => c.startsWith('ma_session=') && !c.includes('Max-Age=0'))).toBe(true);
    expect((await d.storage.read<AuthFile>(AUTH_PATH))!.data.credentials[0].counter).toBe(5);
  });

  it('login fails without a valid challenge or with an unknown credential', async () => {
    const d = makeDeps();
    await registerOwner(d);
    expect((await call(loginVerify, d, { body: { response: { id: 'cred-AAAAAAAA-1' } } })).status).toBe(400);
    const opt = await call(loginOptions, d);
    expect((await call(loginVerify, d, { body: { response: { id: 'nope' } }, cookies: cookieHeader(opt.cookies) })).status).toBe(401);
  });

  it('recovery code signs in; wrong code does not; rotation invalidates the old code', async () => {
    const d = makeDeps();
    const { ver, session } = await registerOwner(d);
    expect((await call(recover, d, { body: { code: 'WRONG-CODE' } })).status).toBe(401);
    const ok = await call(recover, d, { body: { code: ver.body.recoveryCode.toLowerCase() } });
    expect(ok.status).toBe(200);
    const rot = await call(recoveryReset, d, { cookies: session });
    expect(rot.body.recoveryCode).not.toBe(ver.body.recoveryCode);
    expect((await call(recover, d, { body: { code: ver.body.recoveryCode } })).status).toBe(401);
    expect((await call(recover, d, { body: { code: rot.body.recoveryCode } })).status).toBe(200);
  });

  it('status reports registration and authentication', async () => {
    const d = makeDeps();
    expect((await call(status, d, { method: 'GET' })).body).toMatchObject({ registered: false, authenticated: false });
    const { session } = await registerOwner(d);
    expect((await call(status, d, { method: 'GET' })).body).toMatchObject({ registered: true, authenticated: false });
    expect((await call(status, d, { method: 'GET', cookies: session })).body).toMatchObject({ registered: true, authenticated: true });
  });
});

const rec = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) => ({ id, updatedAt, title: id, ...extra });
const st = (tasks: any[] = [], tombstones: any[] = []): SyncState => {
  const s = emptyState();
  s.tables.tasks = tasks;
  s.tombstones = tombstones;
  return s;
};
const tomb = (id: string, deletedAt: string) => ({ key: `tasks:${id}`, table: 'tasks', id, deletedAt });

describe('merge', () => {
  it('last-writer-wins per record, order-independent and idempotent', () => {
    const a = st([rec('1', '2026-11-17T10:00:00Z', { title: 'old' }), rec('2', '2026-11-17T10:00:00Z')]);
    const b = st([rec('1', '2026-11-17T11:00:00Z', { title: 'new' }), rec('3', '2026-11-17T09:00:00Z')]);
    const ab = mergeStates(a, b);
    expect(ab).toEqual(mergeStates(b, a));
    expect(mergeStates(ab, ab)).toEqual(ab);
    expect(ab.tables.tasks.map((r) => r.id)).toEqual(['1', '2', '3']);
    expect(ab.tables.tasks[0].title).toBe('new');
  });
  it('identical timestamps resolve deterministically', () => {
    const a = st([rec('1', '2026-11-17T10:00:00Z', { title: 'A' })]);
    const b = st([rec('1', '2026-11-17T10:00:00Z', { title: 'B' })]);
    expect(mergeStates(a, b)).toEqual(mergeStates(b, a));
  });
  it('tombstones delete older records, newer edits resurrect', () => {
    const server = st([rec('1', '2026-11-17T10:00:00Z'), rec('2', '2026-11-17T10:00:00Z')]);
    const client = st([], [tomb('1', '2026-11-17T12:00:00Z'), tomb('2', '2026-11-17T09:00:00Z')]);
    const m = mergeStates(server, client);
    expect(m.tables.tasks.map((r) => r.id)).toEqual(['2']); // 2 was edited after the delete
    expect(m.tombstones.map((t) => t.id)).toEqual(['1']);
  });
  it('old tombstones are pruned', () => {
    const m = mergeStates(st([], [tomb('1', '2025-01-01T00:00:00Z')]), emptyState(), new Date('2026-11-17'));
    expect(m.tombstones).toHaveLength(0);
  });
  it('validates untrusted payloads', () => {
    expect(validateState(st([rec('1', '2026-11-17T10:00:00Z')]))).toBeNull();
    expect(validateState({ tables: { hacks: [] } })).toMatch(/unknown table/);
    expect(validateState(st([{ id: 1, updatedAt: 'x' }]))).toMatch(/invalid id/);
    expect(validateState(st([rec('1', 'not-a-date')]))).toMatch(/updatedAt/);
    const s = emptyState();
    s.tables.transactions = [rec('t', '2026-11-17T10:00:00Z', { amount: 12.5 })];
    expect(validateState(s)).toMatch(/integer/);
    expect(validateState(st([], [{ key: 'tasks:2', table: 'tasks', id: '1', deletedAt: '2026-11-17T10:00:00Z' }]))).toMatch(/key/);
  });
});

describe('sync endpoint', () => {
  it('requires a session', async () => {
    expect((await call(sync, makeDeps(), { body: { state: emptyState() } })).status).toBe(401);
  });

  it('two devices converge through the GitHub data file', async () => {
    const d = makeDeps();
    const { session } = await registerOwner(d);
    const phone = st([rec('a', '2026-11-17T10:00:00Z')]);
    const r1 = await call(sync, d, { body: { state: phone }, cookies: session });
    expect(r1.body.wrote).toBe(true);
    const laptop = st([rec('b', '2026-11-17T10:05:00Z')], [tomb('x', '2026-11-17T10:06:00Z')]);
    const r2 = await call(sync, d, { body: { state: laptop }, cookies: session });
    expect(r2.body.state.tables.tasks.map((r: any) => r.id)).toEqual(['a', 'b']);
    const file = (await d.storage.read<DataFile>(DATA_PATH))!.data;
    expect(file.format).toBe('myagenda-data');
    expect(file.tables.tasks).toHaveLength(2);
    // nothing new → no extra commit
    const writes = d.storage.writes;
    const r3 = await call(sync, d, { body: { state: r2.body.state }, cookies: session });
    expect(r3.body.wrote).toBe(false);
    expect(d.storage.writes).toBe(writes);
  });

  it('retries on a concurrent write (sha conflict) without losing either change', async () => {
    const storage = new MemoryStorage();
    const d = makeDeps(storage);
    const { session } = await registerOwner(d);
    await call(sync, d, { body: { state: st([rec('a', '2026-11-17T10:00:00Z')]) }, cookies: session });
    // simulate another device committing between our read and write
    const realWrite = storage.write.bind(storage);
    let injected = false;
    storage.write = async (path: string, data: any, sha: string | undefined, msg: string) => {
      if (path === DATA_PATH && !injected) {
        injected = true;
        const cur = await storage.read<DataFile>(DATA_PATH);
        await realWrite(DATA_PATH, { ...cur!.data, tables: { ...cur!.data.tables, tasks: [...cur!.data.tables.tasks, rec('other', '2026-11-17T10:01:00Z')] } }, cur!.sha, 'other');
        throw new ConflictError();
      }
      return realWrite(path, data, sha, msg);
    };
    const r = await call(sync, d, { body: { state: st([rec('mine', '2026-11-17T10:02:00Z')]) }, cookies: session });
    expect(r.status).toBe(200);
    expect(r.body.state.tables.tasks.map((x: any) => x.id).sort()).toEqual(['a', 'mine', 'other']);
  });

  it('rejects invalid payloads', async () => {
    const d = makeDeps();
    const { session } = await registerOwner(d);
    expect((await call(sync, d, { body: { state: { tables: { tasks: 'x' } } }, cookies: session })).status).toBe(400);
  });
});
