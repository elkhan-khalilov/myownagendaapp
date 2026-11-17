import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MyAgendaDB, setDB } from '@/db/schema';
import { notesRepo, rescheduleItem, setBudgetLimit, tasksRepo, transactionsRepo } from '@/repositories';
import { analyzeImport, backupDue, buildBackup, importBackup } from '@/services/backup';
import { budgetStatus, dailyAllowance, inMonth, monthInsights, percentChange, summarize, totalLimit } from '@/services/finance';
import { noteMatches, recentlyEdited, textStats } from '@/services/notes';
import {
  completionStats, conflictingIds, findConflicts, isOverdue, occurrencesInRange, occurrencesOn, overdueItems, sortByPriority,
} from '@/services/recurrence';
import type { Meeting, Note, Task, Transaction } from '@/types';
import { formatHeaderDate, monthKey, toKey } from '@/utils/date';
import { formatMoney, parseMoney } from '@/utils/money';

const task = (p: Partial<Task>): Task => ({
  id: p.id ?? Math.random().toString(36), title: 'T', date: '2026-11-16', reminderMinutes: null, repeat: 'none', status: 'pending',
  completedDates: [], priority: 'medium', category: 'general', createdAt: '', updatedAt: '', ...p,
});
const meeting = (p: Partial<Meeting>): Meeting => ({ ...task(p), startTime: '10:00', endTime: '11:00', ...p }) as Meeting;
const tx = (type: 'income' | 'expense', amount: number, date: string, categoryId = type === 'income' ? 'inc-salary' : 'exp-food'): Transaction => ({
  id: Math.random().toString(36), type, amount, categoryId, date, accountId: 'acc-cash', createdAt: '', updatedAt: '',
});

describe('timezone & dates (Asia/Baku)', () => {
  it('runs in UTC+4', () => {
    expect(new Date('2026-01-01T00:00:00Z').getTimezoneOffset()).toBe(-240);
  });
  it('date keys use local calendar day, not UTC', () => {
    // 22:30 UTC on the 16th is already 02:30 on the 17th in Baku
    expect(toKey(new Date('2026-11-16T22:30:00Z'))).toBe('2026-11-17');
    expect(monthKey(new Date('2026-11-30T21:00:00Z'))).toBe('2026-12');
  });
  it('Azerbaijani header date', () => {
    expect(formatHeaderDate(new Date(2026, 10, 16))).toBe('16 Noyabr, B.e.');
  });
});

describe('AZN calculations', () => {
  it('sums many small amounts exactly (no float drift)', () => {
    const many = Array.from({ length: 1000 }, (_, i) => tx('expense', parseMoney('0,10')!, `2026-11-${String((i % 28) + 1).padStart(2, '0')}`));
    expect(summarize(many).expense).toBe(10000);
    expect(formatMoney(summarize(many).expense)).toBe('100 ₼');
  });
  it('daily allowance floors so the sum never exceeds the remaining limit', () => {
    const a = dailyAllowance(400000, 268000, new Date(2026, 10, 16))!; // 30-day month, 15 days left incl. today
    expect(a.daysLeft).toBe(15);
    expect(a.remaining).toBe(132000);
    expect(a.perDay).toBe(8800);
    expect(a.perDay * a.daysLeft).toBeLessThanOrEqual(a.remaining);
    expect(dailyAllowance(1000, 2000, new Date(2026, 10, 30))!.perDay).toBe(0);
    expect(dailyAllowance(0, 100, new Date())).toBeNull();
  });
  it('previous month comparison & savings rate', () => {
    const txs = [tx('income', 400000, '2026-10-01'), tx('expense', 300000, '2026-10-05'), tx('income', 450000, '2026-11-01'), tx('expense', 270000, '2026-11-05')];
    const i = monthInsights(txs, '2026-11', '2026-10');
    expect(i.savings).toBe(180000);
    expect(i.savingsRate).toBe(40);
    expect(i.expenseChange).toBe(-10);
    expect(i.incomeChange).toBe(13); // 12.5% rounded half up
    expect(i.savingsChange).toBe(80); // 100k → 180k
    expect(percentChange(5, 0)).toBeNull();
  });
  it('monthly budget rollover: the same limit applies to each month independently, incl. year boundary', () => {
    const limit = 100000;
    const txs = [tx('expense', 120000, '2026-12-20'), tx('expense', 5000, '2027-01-02')];
    expect(budgetStatus(limit, summarize(inMonth(txs, '2026-12')).expense).level).toBe('over');
    const jan = budgetStatus(limit, summarize(inMonth(txs, '2027-01')).expense);
    expect(jan).toMatchObject({ level: 'ok', spent: 5000, remaining: 95000 });
  });
});

describe('agenda', () => {
  const now = new Date(2026, 10, 16, 12, 0);
  it('overdue only for pending one-off items in the past or already finished today', () => {
    expect(isOverdue(task({ date: '2026-11-15' }), now)).toBe(true);
    expect(isOverdue(task({ date: '2026-11-16', startTime: '09:00', endTime: '10:00' }), now)).toBe(true);
    expect(isOverdue(task({ date: '2026-11-16', startTime: '17:00' }), now)).toBe(false);
    expect(isOverdue(task({ date: '2026-11-16' }), now)).toBe(false); // no time → due by end of day
    expect(isOverdue(task({ date: '2026-11-10', status: 'done' }), now)).toBe(false);
    expect(isOverdue(task({ date: '2026-11-10', repeat: 'daily' }), now)).toBe(false);
    expect(overdueItems([task({ date: '2026-11-14' }), task({ date: '2026-11-12' })], [], now)[0].item.date).toBe('2026-11-12');
  });
  it('detects time conflicts and ignores done/edited items', () => {
    const items = [meeting({ id: 'm1', startTime: '10:00', endTime: '11:00' }), task({ id: 't1', startTime: '10:30', endTime: '12:00' }), task({ id: 't2', startTime: '11:00', endTime: '12:00', status: 'done' })];
    const c = findConflicts(items.filter((i) => 'priority' in i && i.id !== 'm1') as Task[], [items[0] as Meeting], '2026-11-16', '10:45', '11:15');
    expect(c.map((o) => o.id).sort()).toEqual(['m1', 't1']);
    expect(findConflicts([], [items[0] as Meeting], '2026-11-16', '10:00', '11:00', 'm1')).toHaveLength(0);
    expect(findConflicts([], [items[0] as Meeting], '2026-11-16', '11:00', '11:30')).toHaveLength(0); // touching ≠ overlap
    const day = occurrencesOn([items[1] as Task], [items[0] as Meeting], '2026-11-16');
    expect(conflictingIds(day).size).toBe(2);
  });
  it('priority sorting then time', () => {
    const list = occurrencesOn([task({ id: 'low', priority: 'low', startTime: '08:00' }), task({ id: 'high', priority: 'high', startTime: '18:00' }), task({ id: 'mid', startTime: '09:00' })], [], '2026-11-16');
    expect([...list].sort(sortByPriority).map((o) => o.id)).toEqual(['high', 'mid', 'low']);
  });
  it('recurring occurrences are deterministic and never duplicated', () => {
    const weekly = task({ id: 'w', repeat: 'weekly', date: '2026-11-02' });
    const a = occurrencesInRange([weekly], [], '2026-11-01', 30);
    const b = occurrencesInRange([weekly], [], '2026-11-01', 30);
    expect(a).toEqual(b);
    expect(a.map((o) => o.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(new Set(a.map((o) => o.id + o.date)).size).toBe(a.length);
  });
  it('completion stats', () => {
    const s = completionStats(occurrencesOn([task({ status: 'done' }), task({}), task({}), task({})], [], '2026-11-16'));
    expect(s).toEqual({ done: 1, total: 4, percent: 25 });
  });
});

describe('notes helpers', () => {
  const n = (p: Partial<Note>): Note => ({ id: Math.random().toString(36), title: '', body: '', category: 'work', pinned: false, createdAt: '', updatedAt: '2026-11-16T10:00:00.000Z', ...p });
  it('counts words and characters (Azerbaijani letters)', () => {
    expect(textStats('Şəxsi plan:\nİdman həftədə 3 dəfə')).toEqual({ chars: 32, words: 6 });
    expect(textStats('   ')).toEqual({ chars: 3, words: 0 });
  });
  it('full-text search across title and body, any word order, case-insensitive (az)', () => {
    const note = n({ title: 'Görüş qeydləri', body: 'İRİA ilə görüş — təhlükəsizlik tələbləri' });
    expect(noteMatches(note, 'təhlükəsizlik görüş')).toBe(true);
    expect(noteMatches(note, 'iria')).toBe(true);
    expect(noteMatches(note, 'büdcə')).toBe(false);
  });
  it('recently edited = last 7 days, newest first', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    const list = recentlyEdited([n({ id: 'old', updatedAt: '2026-11-01T00:00:00Z' }), n({ id: 'a', updatedAt: '2026-11-15T00:00:00Z' }), n({ id: 'b', updatedAt: '2026-11-16T09:00:00Z' })], now);
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('persistence, backup & duplicates', () => {
  let db: MyAgendaDB;
  let name: string;
  beforeEach(async () => {
    name = 'imp-' + Math.random();
    db = new MyAgendaDB(name);
    setDB(db);
    await db.open();
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('data survives closing and reopening the database (reload)', async () => {
    const t = await tasksRepo.create({ title: 'Qalıcı', date: '2026-11-16', priority: 'low', category: 'general', reminderMinutes: null, repeat: 'none', status: 'pending', completedDates: [] });
    await setBudgetLimit('__total__', 400000);
    db.close();
    const again = new MyAgendaDB(name);
    setDB(again);
    await again.open();
    expect((await again.tasks.get(t.id))?.title).toBe('Qalıcı');
    expect(totalLimit(await again.budgets.toArray())).toBe(400000);
    expect(await again.transactionCategories.count()).toBe(14); // populate ran only once
    db = again;
  });

  it('quick reschedule moves a one-off item', async () => {
    const t = await tasksRepo.create({ title: 'X', date: '2026-11-16', priority: 'low', category: 'general', reminderMinutes: null, repeat: 'none', status: 'pending', completedDates: [] });
    await rescheduleItem('task', t.id, '2026-11-17');
    expect((await tasksRepo.get(t.id))?.date).toBe('2026-11-17');
  });

  it('merge import skips content duplicates saved under a different id', async () => {
    await transactionsRepo.create({ type: 'expense', amount: 1250, categoryId: 'exp-food', accountId: 'acc-cash', date: '2026-11-16', note: 'Bazar' });
    const backup = await buildBackup(db);
    // Same transaction, different id (e.g. entered on another device) + one genuinely new record
    backup.data.transactions = [
      { ...backup.data.transactions[0], id: 'other-id' },
      { ...backup.data.transactions[0], id: 'new-id', amount: 999 },
    ];
    backup.data.notes = [{ id: 'n1', title: 'A', body: 'b', category: 'work', pinned: false, createdAt: '', updatedAt: '' }];
    const a = await analyzeImport(backup, db);
    expect(a.perTable.transactions).toMatchObject({ incoming: 2, new: 1, duplicates: 1 });
    expect(a.perTable.transactionCategories.sameId).toBe(14);
    await importBackup(backup, 'merge', db);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.notes.count()).toBe(1);
    await importBackup(backup, 'merge', db); // idempotent
    expect(await db.transactions.count()).toBe(2);
    expect(await db.notes.count()).toBe(1);
  });

  it('notes keep formatting (newlines, bullets, spacing) through save/load', async () => {
    const body = 'Əsas mövzular:\n• Məlumat mübadiləsi\n    – alt bənd\n\n• Təhlükəsizlik';
    const nn = await notesRepo.create({ title: 'F', body, category: 'work', pinned: false });
    expect((await notesRepo.get(nn.id))?.body).toBe(body);
  });

  it('backup reminder', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(backupDue(undefined, false, now)).toBe(false);
    expect(backupDue(undefined, true, now)).toBe(true);
    expect(backupDue('2026-11-12T00:00:00Z', true, now)).toBe(false);
    expect(backupDue('2026-11-01T00:00:00Z', true, now)).toBe(true);
  });
});
