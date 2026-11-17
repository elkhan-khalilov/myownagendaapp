import { beforeEach, describe, expect, it } from 'vitest';
import { MyAgendaDB, setDB } from '@/db/schema';
import { notesRepo, tasksRepo, transactionsRepo, updateSettings } from '@/repositories';
import { setSyncEnabled, syncNow } from '@/services/sync';
import { useSyncStore } from '@/stores/sync';
import { route, sync as syncHandler, type Deps } from '../server/handlers';
import { signToken } from '../server/crypto';
import { MemoryStorage } from '../server/storage';

const SECRET = 'client-test-secret-client-test-secret-xx';
const HOST = 'localhost:3000';
let deps: Deps & { storage: MemoryStorage };
let sessionCookie = '';

/** Route the client's fetch('/api/sync') straight into the real server handler */
function installFetch() {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const req: any = {
      method: init.method,
      body: JSON.parse(String(init.body ?? '{}')),
      headers: { host: HOST, origin: `http://${HOST}`, 'x-myagenda': (init.headers as Record<string, string>)['X-MyAgenda'], cookie: sessionCookie },
    };
    let status = 0;
    let text = '';
    const res: any = {
      set statusCode(v: number) { status = v; },
      get statusCode() { return status; },
      setHeader: () => undefined,
      end: (t: string) => (text = t),
    };
    expect(url).toBe('/api/sync');
    await route(syncHandler, { method: 'POST', depsFactory: () => deps })(req, res);
    return new Response(text, { status });
  }) as typeof fetch;
}

async function device(name: string) {
  const db = new MyAgendaDB(`${name}-${Math.random()}`);
  setDB(db);
  await db.open();
  return db;
}
const use = (db: MyAgendaDB) => setDB(db);

const newTask = (title: string) =>
  tasksRepo.create({ title, date: '2026-11-17', priority: 'medium', category: 'general', reminderMinutes: null, repeat: 'none', status: 'pending', completedDates: [] });

beforeEach(async () => {
  deps = { storage: new MemoryStorage(), secret: SECRET };
  sessionCookie = `ma_session=${signToken(SECRET, { sub: 'owner' }, 3600)}`;
  installFetch();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('client ↔ server sync (two devices)', () => {
  it('propagates creates, edits and deletes between devices and converges', async () => {
    const phone = await device('phone');
    await setSyncEnabled(true);
    await updateSettings({ name: 'Elxan', theme: 'dark' });
    const t = await newTask('Telefonda yaradıldı');
    await transactionsRepo.create({ type: 'expense', amount: 1250, categoryId: 'exp-food', accountId: 'acc-cash', date: '2026-11-17' });
    const n = await notesRepo.create({ title: 'Silinəcək', body: '', category: 'work', pinned: false });
    await notesRepo.remove(n.id);
    expect(await phone.tombstones.count()).toBe(1);
    expect(await syncNow()).toBe('ok');
    expect(await phone.tombstones.count()).toBe(0); // acknowledged by server

    // Fresh laptop: seed defaults must not overwrite the phone's settings
    const laptop = await device('laptop');
    await setSyncEnabled(true);
    expect(await syncNow()).toBe('ok');
    expect((await laptop.tasks.get(t.id))?.title).toBe('Telefonda yaradıldı');
    expect(await laptop.transactions.count()).toBe(1);
    expect((await laptop.userSettings.get('main'))?.theme).toBe('dark');
    expect(await laptop.notes.count()).toBe(0);

    // Laptop edits the task, phone deletes the transaction
    await new Promise((r) => setTimeout(r, 5));
    await tasksRepo.update(t.id, { title: 'Noutbukda dəyişdirildi' });
    await syncNow();
    use(phone);
    const txId = (await phone.transactions.toArray())[0].id;
    await transactionsRepo.remove(txId);
    await syncNow();
    expect((await phone.tasks.get(t.id))?.title).toBe('Noutbukda dəyişdirildi');
    use(laptop);
    await syncNow();
    expect(await laptop.transactions.count()).toBe(0);

    // Both devices hold identical data
    const dump = async (db: MyAgendaDB) => JSON.stringify([await db.tasks.toArray(), await db.transactions.toArray(), await db.notes.toArray(), await db.userSettings.toArray()]);
    expect(await dump(laptop)).toBe(await dump(phone));
  });

  it('undo after delete brings the record back on other devices too', async () => {
    await device('a');
    await setSyncEnabled(true);
    const t = await newTask('Geri qaytarılan');
    await syncNow();
    const removed = await tasksRepo.remove(t.id);
    await new Promise((r) => setTimeout(r, 5));
    await tasksRepo.restore(removed!);
    await syncNow();
    const b = await device('b');
    await setSyncEnabled(true);
    await syncNow();
    expect(await b.tasks.get(t.id)).toBeDefined();
  });

  it('reports signed_out when the session is missing and keeps local data', async () => {
    const db = await device('c');
    await setSyncEnabled(true);
    await newTask('Yerli');
    sessionCookie = '';
    expect(await syncNow()).toBe('unauthenticated');
    expect(useSyncStore.getState().phase).toBe('signed_out');
    expect(await db.tasks.count()).toBe(1);
  });

  it('offline: does not call the server', async () => {
    await device('d');
    await setSyncEnabled(true);
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(await syncNow()).toBe('offline');
  });
});
