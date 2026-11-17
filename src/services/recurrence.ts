import { addDays, getDaysInMonth } from 'date-fns';
import type { AgendaOccurrence, Meeting, Task } from '@/types';
import { fromKey, toKey, toMinutes, weekdayIndex } from '@/utils/date';

type Scheduled = Task | Meeting;

/** Does the scheduled item have an occurrence on the given date key? */
export function occursOn(item: Scheduled, dateKey: string): boolean {
  if (item.status === 'cancelled') return false;
  if (item.repeat === 'none' || !item.repeat) return item.date === dateKey;
  if (dateKey < item.date) return false;
  if (item.repeatUntil && dateKey > item.repeatUntil) return false;
  const start = fromKey(item.date);
  const d = fromKey(dateKey);
  switch (item.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return weekdayIndex(start) === weekdayIndex(d);
    case 'monthly': {
      const day = start.getDate();
      // If the month is shorter, the occurrence falls on its last day
      const target = Math.min(day, getDaysInMonth(d));
      return d.getDate() === target;
    }
    default:
      return false;
  }
}

export function isDoneOn(item: Scheduled, dateKey: string): boolean {
  if (item.repeat === 'none' || !item.repeat) return item.status === 'done';
  return (item.completedDates ?? []).includes(dateKey);
}

const TASK_COLOR: Record<Task['category'], AgendaOccurrence['colorKey']> = {
  general: 'blue',
  important: 'red',
  presentation: 'purple',
  personal: 'green',
  exercise: 'yellow',
};

export function toOccurrence(item: Scheduled, kind: 'task' | 'meeting', dateKey: string): AgendaOccurrence {
  return {
    kind,
    id: item.id,
    title: item.title,
    description: item.description,
    date: dateKey,
    startTime: item.startTime,
    endTime: item.endTime,
    colorKey: kind === 'meeting' ? 'blue' : TASK_COLOR[(item as Task).category] ?? 'blue',
    done: isDoneOn(item, dateKey),
    recurring: item.repeat !== 'none',
    reminderMinutes: item.reminderMinutes,
    priority: kind === 'task' ? (item as Task).priority : undefined,
  };
}

export function sortOccurrences(a: AgendaOccurrence, b: AgendaOccurrence) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const am = a.startTime ? toMinutes(a.startTime) : 24 * 60;
  const bm = b.startTime ? toMinutes(b.startTime) : 24 * 60;
  return am - bm;
}

export function occurrencesOn(tasks: Task[], meetings: Meeting[], dateKey: string): AgendaOccurrence[] {
  return [
    ...tasks.filter((t) => occursOn(t, dateKey)).map((t) => toOccurrence(t, 'task', dateKey)),
    ...meetings.filter((m) => occursOn(m, dateKey)).map((m) => toOccurrence(m, 'meeting', dateKey)),
  ].sort(sortOccurrences);
}

export function occurrencesInRange(tasks: Task[], meetings: Meeting[], fromKeyStr: string, days: number) {
  const out: AgendaOccurrence[] = [];
  let d = fromKey(fromKeyStr);
  for (let i = 0; i < days; i++) {
    out.push(...occurrencesOn(tasks, meetings, toKey(d)));
    d = addDays(d, 1);
  }
  return out;
}

/** Next N not-done occurrences starting from now */
export function upcoming(tasks: Task[], meetings: Meeting[], now: Date, limit = 3, horizonDays = 60) {
  const today = toKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return occurrencesInRange(tasks, meetings, today, horizonDays)
    .filter((o) => !o.done)
    .filter((o) => o.date > today || !o.startTime || toMinutes(o.startTime) >= nowMin)
    .slice(0, limit);
}

/** Occurrences whose reminder window is active right now (today only) */
export function dueReminders(tasks: Task[], meetings: Meeting[], now: Date): AgendaOccurrence[] {
  const today = toKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return occurrencesOn(tasks, meetings, today).filter((o) => {
    if (o.done || o.reminderMinutes === null || o.reminderMinutes === undefined || !o.startTime) return false;
    const start = toMinutes(o.startTime);
    return nowMin >= start - o.reminderMinutes && nowMin <= start;
  });
}

export function validateTimes(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  if (end && !start) return 'Başlama vaxtını daxil edin';
  if (start && end && toMinutes(end) <= toMinutes(start)) return 'Bitmə vaxtı başlama vaxtından sonra olmalıdır';
  return null;
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Sort by priority (high first), then by time. Meetings rank with medium priority. */
export function sortByPriority(a: AgendaOccurrence, b: AgendaOccurrence) {
  const pa = PRIORITY_RANK[a.priority ?? 'medium'];
  const pb = PRIORITY_RANK[b.priority ?? 'medium'];
  return pa - pb || sortOccurrences(a, b);
}

/**
 * Overdue = one-off, not done, not cancelled, and its date is in the past
 * (or today with its end/start time already passed). Recurring series are not flagged
 * as a whole — each occurrence is tracked per date instead.
 */
export function isOverdue(item: Task | Meeting, now: Date): boolean {
  if (item.repeat !== 'none' || item.status !== 'pending') return false;
  const today = toKey(now);
  if (item.date < today) return true;
  if (item.date > today) return false;
  const t = item.endTime ?? item.startTime;
  return !!t && toMinutes(t) < now.getHours() * 60 + now.getMinutes();
}

export function overdueItems(tasks: Task[], meetings: Meeting[], now: Date) {
  return [
    ...tasks.filter((t) => isOverdue(t, now)).map((t) => ({ kind: 'task' as const, item: t as Task | Meeting })),
    ...meetings.filter((m) => isOverdue(m, now)).map((m) => ({ kind: 'meeting' as const, item: m as Task | Meeting })),
  ].sort((a, b) => (a.item.date < b.item.date ? -1 : 1));
}

/** Two time ranges [s1,e1) and [s2,e2) overlap. Items without an end time count as 30 minutes. */
function range(o: { startTime?: string; endTime?: string }): [number, number] | null {
  if (!o.startTime) return null;
  const s = toMinutes(o.startTime);
  const e = o.endTime ? toMinutes(o.endTime) : s + 30;
  return [s, Math.max(e, s + 1)];
}

/**
 * Find occurrences on `date` that overlap with the given time range.
 * `excludeId` skips the item being edited.
 */
export function findConflicts(
  tasks: Task[],
  meetings: Meeting[],
  date: string,
  startTime: string | undefined,
  endTime: string | undefined,
  excludeId?: string,
): AgendaOccurrence[] {
  const r = range({ startTime, endTime });
  if (!r) return [];
  return occurrencesOn(tasks, meetings, date).filter((o) => {
    if (o.id === excludeId || o.done) return false;
    const r2 = range(o);
    return !!r2 && r[0] < r2[1] && r2[0] < r[1];
  });
}

/** Set of occurrence keys that conflict with at least one other occurrence on the same day */
export function conflictingIds(list: AgendaOccurrence[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const a = range(list[i]);
    if (!a || list[i].done) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = range(list[j]);
      if (!b || list[j].done || list[i].date !== list[j].date) continue;
      if (a[0] < b[1] && b[0] < a[1]) {
        out.add(list[i].kind + list[i].id);
        out.add(list[j].kind + list[j].id);
      }
    }
  }
  return out;
}

export interface CompletionStats {
  done: number;
  total: number;
  percent: number;
}

export function completionStats(list: AgendaOccurrence[]): CompletionStats {
  const total = list.length;
  const done = list.filter((o) => o.done).length;
  return { done, total, percent: total ? Math.round((done * 100) / total) : 0 };
}
