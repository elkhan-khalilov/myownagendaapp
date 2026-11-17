import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MyAgendaDB, setDB } from '@/db/schema';
import { deleteCategory, meetingsRepo, notesRepo, setBudgetLimit, tasksRepo, toggleOccurrence, transactionsRepo } from '@/repositories';
import { buildBackup, importBackup, validateBackup } from '@/services/backup';
import { sortNotes } from '@/services/notes';

let db: MyAgendaDB;
beforeEach(async () => {
  db = new MyAgendaDB('test-' + Math.random());
  setDB(db);
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('IndexedDB persistence', () => {
  it('seeds categories, account and settings on populate', async () => {
    expect(await db.transactionCategories.count()).toBe(14);
    expect((await db.userSettings.get('main'))?.name).toBe('Elxan');
  });

  it('task CRUD + completion', async () => {
    const t = await tasksRepo.create({ title: 'Hesabat', date: '2026-11-16', priority: 'high', category: 'important', reminderMinutes: null, repeat: 'none', status: 'pending', completedDates: [] });
    expect(t.id).toMatch(/[0-9a-f-]{36}/);
    await tasksRepo.update(t.id, { title: 'Hesabat v2' });
    expect((await tasksRepo.get(t.id))?.title).toBe('Hesabat v2');
    await toggleOccurrence('task', t.id, '2026-11-16');
    expect((await tasksRepo.get(t.id))?.status).toBe('done');
    const removed = await tasksRepo.remove(t.id);
    expect(await tasksRepo.get(t.id)).toBeUndefined();
    await tasksRepo.restore(removed!); // undo
    expect(await tasksRepo.get(t.id)).toBeDefined();
  });

  it('recurring completion is per date', async () => {
    const t = await tasksRepo.create({ title: 'İdman', date: '2026-11-01', priority: 'low', category: 'exercise', reminderMinutes: null, repeat: 'daily', status: 'pending', completedDates: [] });
    await toggleOccurrence('task', t.id, '2026-11-16');
    const r = await tasksRepo.get(t.id);
    expect(r?.completedDates).toEqual(['2026-11-16']);
    expect(r?.status).toBe('pending');
  });

  it('meeting CRUD', async () => {
    const m = await meetingsRepo.create({ title: 'Standup', date: '2026-11-16', startTime: '09:00', endTime: '09:30', reminderMinutes: 5, repeat: 'weekly', status: 'pending', completedDates: [] });
    await meetingsRepo.update(m.id, { endTime: '10:00' });
    expect((await meetingsRepo.get(m.id))?.endTime).toBe('10:00');
    await meetingsRepo.remove(m.id);
    expect(await db.meetings.count()).toBe(0);
  });

  it('transaction CRUD + category protection', async () => {
    const tx = await transactionsRepo.create({ type: 'expense', amount: 1250, categoryId: 'exp-food', accountId: 'acc-cash', date: '2026-11-16' });
    expect(await deleteCategory('exp-food')).toBe(false);
    await transactionsRepo.update(tx.id, { amount: 2000 });
    expect((await transactionsRepo.get(tx.id))?.amount).toBe(2000);
    await transactionsRepo.remove(tx.id);
    expect(await deleteCategory('exp-food')).toBe(true);
  });

  it('budget limits upsert / remove', async () => {
    await setBudgetLimit('__total__', 400000);
    await setBudgetLimit('__total__', 500000);
    expect(await db.budgets.count()).toBe(1);
    expect((await db.budgets.toArray())[0].limit).toBe(500000);
    await setBudgetLimit('__total__', 0);
    expect(await db.budgets.count()).toBe(0);
  });

  it('notes CRUD + pinned first', async () => {
    const a = await notesRepo.create({ title: 'A', body: 'x', category: 'work', pinned: false });
    await new Promise((r) => setTimeout(r, 5));
    const b = await notesRepo.create({ title: 'B', body: 'y', category: 'idea', pinned: false });
    await notesRepo.update(a.id, { pinned: true });
    const sorted = sortNotes(await notesRepo.list(), 'updated');
    expect(sorted[0].id).toBe(a.id);
    expect(sorted[1].id).toBe(b.id);
  });

  it('export → import does not duplicate; validates input', async () => {
    await notesRepo.create({ title: 'N', body: '', category: 'personal', pinned: false });
    await transactionsRepo.create({ type: 'income', amount: 100, categoryId: 'inc-salary', accountId: 'acc-cash', date: '2026-11-01' });
    const backup = await buildBackup(db);
    const v = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(v.ok).toBe(true);
    if (v.ok) {
      await importBackup(v.backup, 'merge', db);
      await importBackup(v.backup, 'merge', db);
    }
    expect(await db.notes.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    expect(validateBackup({ format: 'x' }).ok).toBe(false);
    const bad = JSON.parse(JSON.stringify(backup));
    bad.data.transactions[0].amount = 1.5;
    expect(validateBackup(bad).ok).toBe(false);
  });

  it('restore replaces data', async () => {
    await notesRepo.create({ title: 'old', body: '', category: 'work', pinned: false });
    const backup = await buildBackup(db);
    await notesRepo.create({ title: 'new', body: '', category: 'work', pinned: false });
    await importBackup(backup, 'replace', db);
    expect((await db.notes.toArray()).map((n) => n.title)).toEqual(['old']);
  });
});
