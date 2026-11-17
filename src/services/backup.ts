import type { MyAgendaDB } from '@/db/schema';
import { getDB } from '@/db/schema';

export const BACKUP_FORMAT = 'myagenda-backup';
export const BACKUP_VERSION = 1;

export const TABLES = [
  'tasks',
  'meetings',
  'notes',
  'transactions',
  'transactionCategories',
  'budgets',
  'financialAccounts',
  'userSettings',
] as const;
export type TableName = (typeof TABLES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<TableName, Record<string, unknown>[]>;
}

export async function buildBackup(db: MyAgendaDB = getDB()): Promise<BackupFile> {
  const data = {} as BackupFile['data'];
  for (const t of TABLES) data[t] = (await db.table(t).toArray()) as Record<string, unknown>[];
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

const REQUIRED: Partial<Record<TableName, string[]>> = {
  tasks: ['id', 'title', 'date'],
  meetings: ['id', 'title', 'date', 'startTime', 'endTime'],
  notes: ['id', 'category'],
  transactions: ['id', 'type', 'amount', 'categoryId', 'date'],
  transactionCategories: ['id', 'type', 'name'],
  budgets: ['id', 'categoryId', 'limit'],
  financialAccounts: ['id', 'name'],
  userSettings: ['id'],
};

const MAX_STRING = 100_000;

export function validateBackup(raw: unknown): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Fayl JSON obyekti deyil' };
  const b = raw as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) return { ok: false, error: 'Bu MyAgenda ehtiyat faylı deyil' };
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
    return { ok: false, error: `Dəstəklənməyən versiya: ${String(b.version)}` };
  if (!b.data || typeof b.data !== 'object') return { ok: false, error: 'Məlumat bölməsi yoxdur' };
  for (const t of TABLES) {
    const rows = (b.data as Record<string, unknown>)[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return { ok: false, error: `"${t}" massiv deyil` };
    for (const row of rows) {
      if (!row || typeof row !== 'object') return { ok: false, error: `"${t}" daxilində yanlış qeyd` };
      for (const f of REQUIRED[t] ?? []) {
        if ((row as Record<string, unknown>)[f] === undefined)
          return { ok: false, error: `"${t}" qeydində "${f}" sahəsi yoxdur` };
      }
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        if (typeof v === 'string' && v.length > MAX_STRING) return { ok: false, error: `"${t}.${k}" həddən artıq uzundur` };
      }
      if (t === 'transactions') {
        const amt = (row as { amount: unknown }).amount;
        if (typeof amt !== 'number' || !Number.isInteger(amt) || amt <= 0)
          return { ok: false, error: 'Əməliyyat məbləği tam ədəd (qəpik) olmalıdır' };
      }
    }
  }
  return { ok: true, backup: b as BackupFile };
}

/** Content fingerprint used to detect the same record saved under a different id */
function fingerprint(table: TableName, r: Record<string, unknown>): string | null {
  if (table === 'transactions') return [r.type, r.amount, r.categoryId, r.date, r.note ?? ''].join('|');
  if (table === 'notes') return [r.title, r.body, r.category].join('|');
  if (table === 'tasks' || table === 'meetings') return [r.title, r.date, r.startTime ?? '', r.repeat].join('|');
  return null;
}

export interface ImportAnalysis {
  total: number;
  newRecords: number;
  /** Same id already exists → will be updated (merge) */
  sameId: number;
  /** Different id but identical content → skipped in merge mode */
  contentDuplicates: number;
  perTable: Record<TableName, { incoming: number; new: number; sameId: number; duplicates: number }>;
}

async function plan(backup: BackupFile, db: MyAgendaDB) {
  const perTable = {} as ImportAnalysis['perTable'];
  const toWrite = {} as Record<TableName, Record<string, unknown>[]>;
  let total = 0, newRecords = 0, sameId = 0, contentDuplicates = 0;
  for (const t of TABLES) {
    const rows = backup.data[t] ?? [];
    const existing = (await db.table(t).toArray()) as Record<string, unknown>[];
    const ids = new Set(existing.map((r) => r.id as string));
    const prints = new Set(existing.map((r) => fingerprint(t, r)).filter(Boolean) as string[]);
    const stats = { incoming: rows.length, new: 0, sameId: 0, duplicates: 0 };
    const write: Record<string, unknown>[] = [];
    const seenInFile = new Set<string>();
    for (const r of rows) {
      const id = r.id as string;
      if (seenInFile.has(id)) { stats.duplicates++; continue; }
      seenInFile.add(id);
      if (ids.has(id)) { stats.sameId++; write.push(r); continue; }
      const fp = fingerprint(t, r);
      if (fp && prints.has(fp)) { stats.duplicates++; continue; }
      if (fp) prints.add(fp);
      stats.new++;
      write.push(r);
    }
    perTable[t] = stats;
    toWrite[t] = write;
    total += stats.incoming; newRecords += stats.new; sameId += stats.sameId; contentDuplicates += stats.duplicates;
  }
  return { analysis: { total, newRecords, sameId, contentDuplicates, perTable } as ImportAnalysis, toWrite };
}

export async function analyzeImport(backup: BackupFile, db: MyAgendaDB = getDB()): Promise<ImportAnalysis> {
  return (await plan(backup, db)).analysis;
}

/**
 * Import a validated backup.
 * - merge: upsert by id; records whose content already exists under another id are skipped (no duplicates).
 * - replace: clears every table except settings and writes the backup as-is (restore).
 * Runs in a single transaction: either everything is written or nothing is.
 */
export async function importBackup(backup: BackupFile, mode: 'merge' | 'replace', db: MyAgendaDB = getDB()) {
  let count = 0;
  const merged = mode === 'merge' ? (await plan(backup, db)).toWrite : null;
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      if (mode === 'replace' && t !== 'userSettings') await db.table(t).clear();
      const rows = merged ? merged[t] : backup.data[t];
      if (!rows?.length) continue;
      await db.table(t).bulkPut(rows);
      count += rows.length;
    }
  });
  return count;
}

/**
 * Hand the backup to the iOS/Android share sheet when the browser supports file sharing
 * (user can save to Files, iCloud Drive, AirDrop, e-mail…). Falls back to a download.
 * Returns false if the user cancelled the share sheet.
 */
export async function shareOrDownloadJSON(obj: unknown, filename: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(obj, null, 2);
  try {
    const file = new File([json], filename, { type: 'application/json' });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'MyAgenda ehtiyat nüsxəsi' });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
    // other errors → fall back to download
  }
  downloadJSON(obj, filename);
  return 'downloaded';
}

export const BACKUP_REMINDER_DAYS = 7;

/** True when the user has data but no backup in the last BACKUP_REMINDER_DAYS days */
export function backupDue(lastBackupAt: string | undefined, hasData: boolean, now: Date): boolean {
  if (!hasData) return false;
  if (!lastBackupAt) return true;
  return now.getTime() - new Date(lastBackupAt).getTime() > BACKUP_REMINDER_DAYS * 864e5;
}

export function downloadJSON(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
