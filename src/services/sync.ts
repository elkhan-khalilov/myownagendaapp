'use client';
/**
 * Client sync engine: local-first. IndexedDB stays the source of truth on the device;
 * changes are pushed to /api/sync (→ private GitHub repo) and merged back with
 * per-record last-writer-wins + deletion tombstones.
 */
import { getDB } from '@/db/schema';
import { useSyncStore } from '@/stores/sync';
import { SYNC_TABLES, type SyncRecord, type SyncState, type Tombstone } from '@/sync/merge';

let applyingRemote = false;
let inFlight: Promise<SyncResult> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let hooksInstalled = false;

export type SyncResult = 'ok' | 'offline' | 'unauthenticated' | 'not_configured' | 'error' | 'disabled';

export const API_HEADERS = { 'Content-Type': 'application/json', 'X-MyAgenda': '1' };

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await getDB().meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await getDB().meta.put({ key, value });
}

export async function setSyncEnabled(enabled: boolean) {
  await setMeta('syncEnabled', enabled);
  useSyncStore.getState().set({ enabled, phase: enabled ? 'idle' : 'disabled', error: undefined });
}

async function collectState(): Promise<SyncState> {
  const db = getDB();
  const tables = {} as SyncState['tables'];
  for (const t of SYNC_TABLES) tables[t] = (await db.table(t).toArray()) as SyncRecord[];
  return { tables, tombstones: await db.tombstones.toArray() };
}

/** Apply the merged server state without overwriting local edits made while the request was in flight. */
export async function applyRemote(server: SyncState, sentTombstones: Tombstone[]) {
  const db = getDB();
  applyingRemote = true;
  try {
    await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.tombstones], async () => {
      const serverTombs = new Map(server.tombstones.map((t) => [t.key, t]));
      for (const t of SYNC_TABLES) {
        const table = db.table(t);
        const local = new Map(((await table.toArray()) as SyncRecord[]).map((r) => [r.id, r]));
        const toPut = server.tables[t].filter((r) => {
          const l = local.get(r.id);
          return !l || Date.parse(r.updatedAt) > Date.parse(l.updatedAt);
        });
        if (toPut.length) await table.bulkPut(toPut);
        const toDelete = [...local.values()]
          .filter((l) => {
            const tb = serverTombs.get(`${t}:${l.id}`);
            return tb && !(Date.parse(l.updatedAt) > Date.parse(tb.deletedAt));
          })
          .map((l) => l.id);
        if (toDelete.length) await table.bulkDelete(toDelete);
      }
      // Tombstones the server has now recorded can be dropped locally (unless re-created meanwhile)
      for (const sent of sentTombstones) {
        const cur = await db.tombstones.get(sent.key);
        if (cur && cur.deletedAt === sent.deletedAt) await db.tombstones.delete(sent.key);
      }
    });
  } finally {
    applyingRemote = false;
  }
}

export function syncNow(): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<SyncResult> => {
    const store = useSyncStore.getState();
    if (!store.enabled) return 'disabled';
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      store.set({ phase: 'offline' });
      return 'offline';
    }
    store.set({ phase: 'syncing', error: undefined });
    try {
      const state = await collectState();
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: API_HEADERS,
        credentials: 'same-origin',
        body: JSON.stringify({ state }),
      });
      if (res.status === 401) {
        store.set({ phase: 'signed_out' });
        return 'unauthenticated';
      }
      if (res.status === 503) {
        store.set({ phase: 'not_configured' });
        return 'not_configured';
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { state: SyncState };
      await applyRemote(body.state, state.tombstones);
      const now = new Date().toISOString();
      await setMeta('lastSyncAt', now);
      store.set({ phase: 'idle', lastSyncAt: now });
      return 'ok';
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      store.set({ phase: offline ? 'offline' : 'error', error: offline ? undefined : (e as Error).message });
      return offline ? 'offline' : 'error';
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Debounced sync after local edits */
export function scheduleSync(delay = 2500) {
  if (!useSyncStore.getState().enabled || applyingRemote) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const db = getDB();
  const onChange = () => {
    if (!applyingRemote) scheduleSync();
  };
  for (const t of SYNC_TABLES) {
    const table = db.table(t);
    table.hook('creating', onChange);
    table.hook('updating', () => {
      onChange();
      return undefined;
    });
    table.hook('deleting', onChange);
  }
}

/** Called once from the app shell */
export async function initSync() {
  installHooks();
  const enabled = (await getMeta<boolean>('syncEnabled')) ?? false;
  const lastSyncAt = await getMeta<string>('lastSyncAt');
  useSyncStore.getState().set({ enabled, lastSyncAt, phase: enabled ? 'idle' : 'disabled' });
  if (!enabled) return () => {};

  void syncNow();
  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    const last = useSyncStore.getState().lastSyncAt;
    if (!last || Date.now() - Date.parse(last) > 30_000) void syncNow();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => document.visibilityState === 'visible' && void syncNow(), 5 * 60_000);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}
