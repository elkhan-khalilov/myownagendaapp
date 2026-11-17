import type { Table } from 'dexie';
import type { BaseRecord } from '@/types';
import { nowISO, uuid } from '@/utils/id';
import { getDB } from '@/db/schema';
import type { SyncTable } from '@/sync/merge';

/** Record a deletion so it propagates to other devices on the next sync */
export async function addTombstone(table: string, id: string) {
  try {
    await getDB().tombstones.put({ key: `${table}:${id}`, table: table as SyncTable, id, deletedAt: nowISO() });
  } catch {
    /* tombstone bookkeeping must never block a delete */
  }
}

export class RepositoryError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'RepositoryError';
  }
}

async function guard<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // Log only the operation and error type — never record contents (may contain personal/financial data)
    console.error(`[db] ${op} failed: ${(e as Error)?.name ?? 'Error'}`);
    throw new RepositoryError('Məlumat bazası xətası: əməliyyat yerinə yetirilmədi', e);
  }
}

/**
 * Generic CRUD over a Dexie table. The interface intentionally mirrors a REST resource
 * (list/get/create/update/remove) so it can later be swapped for a FastAPI-backed implementation.
 */
export function createRepository<T extends BaseRecord>(table: () => Table<T, string>, name: string) {
  return {
    list: () => guard(`${name}.list`, () => table().toArray()),
    get: (id: string) => guard(`${name}.get`, () => table().get(id)),
    async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<BaseRecord>): Promise<T> {
      const ts = nowISO();
      const rec = { ...data, id: data.id ?? uuid(), createdAt: data.createdAt ?? ts, updatedAt: ts } as T;
      await guard(`${name}.create`, () => table().add(rec));
      return rec;
    },
    async update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<void> {
      await guard(`${name}.update`, async () => {
        const n = await table().update(id, { ...patch, updatedAt: nowISO() } as never);
        if (!n) throw new Error('not found');
      });
    },
    /** Removes and returns the record so callers can offer undo */
    async remove(id: string): Promise<T | undefined> {
      return guard(`${name}.remove`, async () => {
        const rec = await table().get(id);
        await table().delete(id);
        if (rec) await addTombstone(table().name, id);
        return rec;
      });
    },
    /** Undo a delete: the record comes back with a fresh updatedAt so it wins over the tombstone */
    restore: (rec: T) =>
      guard(`${name}.restore`, async () => {
        await table().put({ ...rec, updatedAt: nowISO() });
        await getDB().tombstones.delete(`${table().name}:${rec.id}`);
      }),
  };
}
