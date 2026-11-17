import { describe, expect, it } from 'vitest';
import { dueReminders, isDoneOn, occurrencesOn, occursOn, upcoming, validateTimes } from '@/services/recurrence';
import type { Meeting, Task } from '@/types';

const task = (p: Partial<Task>): Task => ({
  id: p.id ?? 't', title: 'T', date: '2026-11-16', reminderMinutes: null, repeat: 'none', status: 'pending',
  completedDates: [], priority: 'medium', category: 'general', createdAt: '', updatedAt: '', ...p,
});

describe('recurrence', () => {
  it('one-off', () => {
    expect(occursOn(task({}), '2026-11-16')).toBe(true);
    expect(occursOn(task({}), '2026-11-17')).toBe(false);
  });
  it('daily / weekly / monthly / until', () => {
    expect(occursOn(task({ repeat: 'daily' }), '2026-12-01')).toBe(true);
    expect(occursOn(task({ repeat: 'daily' }), '2026-11-15')).toBe(false);
    expect(occursOn(task({ repeat: 'weekly' }), '2026-11-23')).toBe(true);
    expect(occursOn(task({ repeat: 'weekly' }), '2026-11-24')).toBe(false);
    expect(occursOn(task({ repeat: 'monthly', date: '2026-01-31' }), '2026-02-28')).toBe(true);
    expect(occursOn(task({ repeat: 'daily', repeatUntil: '2026-11-20' }), '2026-11-21')).toBe(false);
  });
  it('per-occurrence completion for recurring items', () => {
    const t = task({ repeat: 'daily', completedDates: ['2026-11-17'] });
    expect(isDoneOn(t, '2026-11-17')).toBe(true);
    expect(isDoneOn(t, '2026-11-18')).toBe(false);
  });
  it('cancelled items do not occur', () => {
    expect(occursOn(task({ status: 'cancelled' }), '2026-11-16')).toBe(false);
  });
  it('sorts by time and merges meetings', () => {
    const m: Meeting = { ...task({ id: 'm', startTime: '09:00', endTime: '09:30' }), startTime: '09:00', endTime: '09:30' } as Meeting;
    const list = occurrencesOn([task({ id: 'a', startTime: '17:00' }), task({ id: 'b' })], [m], '2026-11-16');
    expect(list.map((o) => o.id)).toEqual(['m', 'a', 'b']);
    expect(list[0].colorKey).toBe('blue');
  });
  it('upcoming skips past and done', () => {
    const now = new Date(2026, 10, 16, 12, 0);
    const list = upcoming([task({ id: 'past', startTime: '09:00' }), task({ id: 'later', startTime: '17:00' }), task({ id: 'done', startTime: '18:00', status: 'done' })], [], now, 3);
    expect(list.map((o) => o.id)).toEqual(['later']);
  });
  it('reminders window', () => {
    const now = new Date(2026, 10, 16, 16, 50);
    expect(dueReminders([task({ startTime: '17:00', reminderMinutes: 15 })], [], now)).toHaveLength(1);
    expect(dueReminders([task({ startTime: '17:00', reminderMinutes: 5 })], [], now)).toHaveLength(0);
  });
  it('validates times', () => {
    expect(validateTimes('10:00', '09:00')).toMatch(/sonra/);
    expect(validateTimes('10:00', '11:00')).toBeNull();
    expect(validateTimes(undefined, '11:00')).toBeTruthy();
  });
});
