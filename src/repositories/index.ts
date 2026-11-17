import { getDB } from '@/db/schema';
import { SETTINGS_ID } from '@/db/seed';
import type { Budget, Meeting, Note, Task, Transaction, TransactionCategory, UserSettings } from '@/types';
import { nowISO, uuid } from '@/utils/id';
import { addTombstone, createRepository } from './base';

export const tasksRepo = createRepository<Task>(() => getDB().tasks, 'tasks');
export const meetingsRepo = createRepository<Meeting>(() => getDB().meetings, 'meetings');
export const notesRepo = createRepository<Note>(() => getDB().notes, 'notes');
export const transactionsRepo = createRepository<Transaction>(() => getDB().transactions, 'transactions');
export const categoriesRepo = createRepository<TransactionCategory>(() => getDB().transactionCategories, 'categories');
export const budgetsRepo = createRepository<Budget>(() => getDB().budgets, 'budgets');

/** Toggle completion of a task/meeting occurrence (handles recurring items per date). */
export async function toggleOccurrence(kind: 'task' | 'meeting', id: string, dateKey: string) {
  const repo = kind === 'task' ? tasksRepo : meetingsRepo;
  const item = (await repo.get(id)) as Task | Meeting | undefined;
  if (!item) return;
  if (item.repeat === 'none') {
    await repo.update(id, { status: item.status === 'done' ? 'pending' : 'done' } as never);
  } else {
    const set = new Set(item.completedDates ?? []);
    if (set.has(dateKey)) set.delete(dateKey);
    else set.add(dateKey);
    await repo.update(id, { completedDates: [...set].sort() } as never);
  }
}

/** Upsert a monthly limit. limit = 0 removes it. */
export async function setBudgetLimit(categoryId: string, limit: number) {
  const db = getDB();
  const existing = await db.budgets.where('categoryId').equals(categoryId).first();
  if (limit <= 0) {
    if (existing) {
      await db.budgets.delete(existing.id);
      await addTombstone('budgets', existing.id);
    }
    return;
  }
  const ts = nowISO();
  if (existing) await db.budgets.update(existing.id, { limit, updatedAt: ts });
  else await db.budgets.add({ id: uuid(), categoryId, limit, createdAt: ts, updatedAt: ts });
}

export async function updateSettings(patch: Partial<Omit<UserSettings, 'id' | 'createdAt'>>) {
  await getDB().userSettings.update(SETTINGS_ID, { ...patch, updatedAt: nowISO() });
}

/** A category can be deleted only if no transactions reference it. */
export async function deleteCategory(id: string): Promise<boolean> {
  const db = getDB();
  const used = await db.transactions.where('categoryId').equals(id).count();
  if (used > 0) return false;
  await db.transactionCategories.delete(id);
  await addTombstone('transactionCategories', id);
  const b = await db.budgets.where('categoryId').equals(id).first();
  if (b) {
    await db.budgets.delete(b.id);
    await addTombstone('budgets', b.id);
  }
  return true;
}

/** Move a one-off task/meeting to another date (quick reschedule). */
export async function rescheduleItem(kind: 'task' | 'meeting', id: string, newDate: string) {
  const repo = kind === 'task' ? tasksRepo : meetingsRepo;
  await repo.update(id, { date: newDate } as never);
}
