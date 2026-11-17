/**
 * Development-only demo data. Only reachable when NODE_ENV === 'development'
 * (the button in Settings is not rendered in production builds).
 */
import { addDays, subMonths } from 'date-fns';
import { getDB } from '@/db/schema';
import { DEFAULT_ACCOUNT_ID } from '@/db/seed';
import { setBudgetLimit } from '@/repositories';
import type { Meeting, Note, Task, Transaction } from '@/types';
import { monthKey, toKey } from '@/utils/date';
import { nowISO, uuid } from '@/utils/id';

export async function loadDemoData() {
  const db = getDB();
  const ts = nowISO();
  const today = new Date();
  const k = (offset: number) => toKey(addDays(today, offset));
  const base = { createdAt: ts, updatedAt: ts, completedDates: [] as string[], status: 'pending' as const };

  const tasks: Task[] = [
    { ...base, id: uuid(), title: 'Hesabatı hazırlamaq', date: k(0), startTime: '11:00', endTime: '12:00', priority: 'high', category: 'important', reminderMinutes: 15, repeat: 'none', status: 'done' },
    { ...base, id: uuid(), title: 'Layihə üzrə təqdimat', date: k(0), startTime: '17:00', endTime: '18:00', priority: 'medium', category: 'presentation', reminderMinutes: 30, repeat: 'none' },
    { ...base, id: uuid(), title: 'İdman', date: k(-2), startTime: '19:00', endTime: '20:00', priority: 'low', category: 'exercise', reminderMinutes: null, repeat: 'daily' },
    { ...base, id: uuid(), title: 'Müqaviləni yoxlamaq', date: k(-2), startTime: '15:00', endTime: '16:00', priority: 'high', category: 'important', reminderMinutes: null, repeat: 'none' },
    { ...base, id: uuid(), title: 'Kitab oxumaq', date: k(1), startTime: '21:00', endTime: '21:30', priority: 'low', category: 'personal', reminderMinutes: null, repeat: 'none' },
  ];
  const meetings: Meeting[] = [
    { ...base, id: uuid(), title: 'Komanda standup', date: k(-7), startTime: '09:00', endTime: '09:30', reminderMinutes: 5, repeat: 'weekly' },
    { ...base, id: uuid(), title: 'Departament görüşü', date: k(0), startTime: '14:00', endTime: '15:00', reminderMinutes: 15, repeat: 'none', location: 'Konfrans zalı' },
  ];

  const notes: Note[] = [
    { id: uuid(), title: 'Layihə ideyaları', body: 'AI əsaslı müraciətlərin avtomatlaşdırılması\nSənəd təsnifatı üçün model', category: 'idea', pinned: true, createdAt: ts, updatedAt: ts },
    { id: uuid(), title: 'Görüş qeydləri', body: 'Əsas müzakirə mövzuları:\n• Məlumat mübadiləsi\n• Təhlükəsizlik tələbləri', category: 'work', pinned: false, createdAt: ts, updatedAt: ts },
    { id: uuid(), title: 'Kitab tövsiyələri', body: '• Atomic Habits\n• Deep Work\n• Thinking, Fast and Slow', category: 'personal', pinned: false, createdAt: ts, updatedAt: ts },
  ];

  const txs: Transaction[] = [];
  const add = (type: 'income' | 'expense', amount: number, categoryId: string, date: string, note = '') =>
    txs.push({ id: uuid(), type, amount, categoryId, accountId: DEFAULT_ACCOUNT_ID, date, note, createdAt: ts, updatedAt: ts });

  for (let i = 0; i < 6; i++) {
    const m = subMonths(today, i);
    const mk = monthKey(m);
    add('income', 380000 + i * 7000, 'inc-salary', `${mk}-01`, 'Maaş');
    if (i % 2 === 0) add('income', 73000, 'inc-extra', `${mk}-12`);
    add('expense', 94000, 'exp-housing', `${mk}-03`, 'Kirayə');
    add('expense', 48000 + i * 2500, 'exp-food', `${mk}-08`);
    add('expense', 32000, 'exp-transport', `${mk}-10`);
    add('expense', 27000 - i * 1000, 'exp-family', `${mk}-14`);
    add('expense', 67000 - i * 3000, 'exp-shopping', `${mk}-02`);
  }

  await db.transaction('rw', [db.tasks, db.meetings, db.notes, db.transactions, db.budgets], async () => {
    await db.tasks.bulkAdd(tasks);
    await db.meetings.bulkAdd(meetings);
    await db.notes.bulkAdd(notes);
    await db.transactions.bulkAdd(txs);
  });
  await setBudgetLimit('__total__', 400000);
  await setBudgetLimit('exp-food', 45000);
}
