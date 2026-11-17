/**
 * Sync merge logic shared by the client and the Vercel API.
 * No path aliases here: this file is also bundled into /api functions.
 *
 * Model: every record has `id` and `updatedAt` (ISO). Deletions are tombstones
 * `{ key: "<table>:<id>", table, id, deletedAt }`. Conflicts resolve per record by
 * last-writer-wins on timestamps; a tombstone wins when deletedAt >= updatedAt.
 */

export const SYNC_TABLES = [
  'tasks',
  'meetings',
  'notes',
  'transactions',
  'transactionCategories',
  'budgets',
  'financialAccounts',
  'userSettings',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export type SyncRecord = { id: string; updatedAt: string; [k: string]: unknown };

export interface Tombstone {
  key: string;
  table: SyncTable;
  id: string;
  deletedAt: string;
}

export interface SyncState {
  tables: Record<SyncTable, SyncRecord[]>;
  tombstones: Tombstone[];
}

export interface DataFile extends SyncState {
  format: 'myagenda-data';
  version: 1;
  updatedAt: string;
}

/** Tombstones older than this are dropped from the server copy */
export const TOMBSTONE_TTL_DAYS = 180;

export function emptyState(): SyncState {
  const tables = {} as SyncState['tables'];
  for (const t of SYNC_TABLES) tables[t] = [];
  return { tables, tombstones: [] };
}

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Strict validation of untrusted sync input. Returns an error message or null. */
export function validateState(raw: unknown, maxRecords = 50_000): string | null {
  if (!raw || typeof raw !== 'object') return 'payload must be an object';
  const s = raw as Partial<SyncState>;
  if (!s.tables || typeof s.tables !== 'object') return 'tables missing';
  let count = 0;
  for (const key of Object.keys(s.tables)) {
    if (!(SYNC_TABLES as readonly string[]).includes(key)) return `unknown table ${key}`;
  }
  for (const t of SYNC_TABLES) {
    const rows = (s.tables as Record<string, unknown>)[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return `${t} must be an array`;
    for (const r of rows) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return `${t}: invalid record`;
      const rec = r as Record<string, unknown>;
      if (!isStr(rec.id, 100)) return `${t}: invalid id`;
      if (!isStr(rec.updatedAt, 40) || Number.isNaN(Date.parse(rec.updatedAt))) return `${t}: invalid updatedAt`;
      if (t === 'transactions') {
        const a = rec.amount;
        if (typeof a !== 'number' || !Number.isInteger(a) || a <= 0) return 'transactions: amount must be a positive integer';
      }
      for (const v of Object.values(rec)) if (typeof v === 'string' && v.length > 100_000) return `${t}: field too long`;
      if (++count > maxRecords) return 'too many records';
    }
  }
  if (s.tombstones !== undefined) {
    if (!Array.isArray(s.tombstones)) return 'tombstones must be an array';
    for (const tb of s.tombstones) {
      if (!tb || typeof tb !== 'object') return 'invalid tombstone';
      const x = tb as Partial<Tombstone>;
      if (!(SYNC_TABLES as readonly string[]).includes(x.table as string)) return 'tombstone: unknown table';
      if (!isStr(x.id, 100) || !isStr(x.deletedAt, 40) || Number.isNaN(Date.parse(x.deletedAt))) return 'tombstone: invalid fields';
      if (x.key !== `${x.table}:${x.id}`) return 'tombstone: invalid key';
      if (++count > maxRecords) return 'too many records';
    }
  }
  return null;
}

const newer = (a: string, b: string) => Date.parse(a) > Date.parse(b);

/** Record a wins over b: later updatedAt; on an exact tie, a deterministic content comparison keeps merges order-independent. */
function wins(a: SyncRecord, b: SyncRecord) {
  const ta = Date.parse(a.updatedAt);
  const tb = Date.parse(b.updatedAt);
  if (ta !== tb) return ta > tb;
  return JSON.stringify(a) > JSON.stringify(b);
}

/** Merge two states (order-independent, idempotent). */
export function mergeStates(a: SyncState, b: SyncState, now = new Date()): SyncState {
  const out = emptyState();
  const cutoff = now.getTime() - TOMBSTONE_TTL_DAYS * 864e5;

  const tombs = new Map<string, Tombstone>();
  for (const tb of [...(a.tombstones ?? []), ...(b.tombstones ?? [])]) {
    const prev = tombs.get(tb.key);
    if (!prev || newer(tb.deletedAt, prev.deletedAt)) tombs.set(tb.key, tb);
  }

  for (const t of SYNC_TABLES) {
    const byId = new Map<string, SyncRecord>();
    for (const r of [...(a.tables?.[t] ?? []), ...(b.tables?.[t] ?? [])]) {
      const prev = byId.get(r.id);
      if (!prev || wins(r, prev)) byId.set(r.id, r);
    }
    for (const r of byId.values()) {
      const tb = tombs.get(`${t}:${r.id}`);
      if (tb && !newer(r.updatedAt, tb.deletedAt)) continue; // deleted
      if (tb) tombs.delete(tb.key); // re-created after deletion
      out.tables[t].push(r);
    }
    out.tables[t].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  }

  out.tombstones = [...tombs.values()]
    .filter((tb) => Date.parse(tb.deletedAt) >= cutoff)
    .sort((x, y) => (x.key < y.key ? -1 : 1));
  return out;
}

/** Stable fingerprint of a state, used to skip no-op writes. */
export function stateSignature(s: SyncState): string {
  const parts: string[] = [];
  for (const t of SYNC_TABLES) for (const r of s.tables[t]) parts.push(`${t}:${r.id}:${r.updatedAt}`);
  for (const tb of s.tombstones) parts.push(`x:${tb.key}:${tb.deletedAt}`);
  return parts.join('|');
}
