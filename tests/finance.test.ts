import { describe, expect, it } from 'vitest';
import { budgetStatus, categoryStatuses, expenseByCategory, inMonth, lastMonths, summarize, totalLimit } from '@/services/finance';
import { buildSeedRecords } from '@/db/seed';
import type { Budget, Transaction } from '@/types';

const tx = (type: 'income' | 'expense', amount: number, categoryId: string, date: string): Transaction => ({
  id: Math.random().toString(36), type, amount, categoryId, date, accountId: 'a', createdAt: '', updatedAt: '',
});
const cats = buildSeedRecords().categories;

describe('finance', () => {
  const txs = [
    tx('income', 453000, 'inc-salary', '2026-11-01'),
    tx('expense', 94000, 'exp-housing', '2026-11-03'),
    tx('expense', 48240, 'exp-food', '2026-11-08'),
    tx('expense', 125760, 'exp-shopping', '2026-11-09'),
    tx('expense', 10, 'exp-food', '2026-10-31'),
  ];
  it('summarizes a month with integer arithmetic', () => {
    const s = summarize(inMonth(txs, '2026-11'));
    expect(s).toEqual({ income: 453000, expense: 268000, balance: 185000 });
  });
  it('rejects float amounts', () => {
    expect(() => summarize([tx('expense', 12.5, 'exp-food', '2026-11-01')])).toThrow();
  });
  it('category shares sum to 100', () => {
    const shares = expenseByCategory(inMonth(txs, '2026-11'), cats);
    expect(shares[0].category.id).toBe('exp-shopping');
    expect(shares.reduce((a, s) => a + s.percent, 0)).toBe(100);
  });
  it('last six months', () => {
    const pts = lastMonths(txs, new Date(2026, 10, 15), 6);
    expect(pts).toHaveLength(6);
    expect(pts[5]).toMatchObject({ month: '2026-11', label: 'Noy', income: 453000, expense: 268000 });
    expect(pts[4]).toMatchObject({ month: '2026-10', expense: 10 });
  });
  it('budget levels', () => {
    expect(budgetStatus(0, 100).level).toBe('none');
    expect(budgetStatus(400000, 268000)).toMatchObject({ level: 'ok', percent: 67, remaining: 132000 });
    expect(budgetStatus(400000, 320000).level).toBe('warn');
    expect(budgetStatus(400000, 400001).level).toBe('over');
  });
  it('category limits', () => {
    const budgets: Budget[] = [
      { id: '1', categoryId: '__total__', limit: 400000, createdAt: '', updatedAt: '' },
      { id: '2', categoryId: 'exp-food', limit: 45000, createdAt: '', updatedAt: '' },
    ];
    expect(totalLimit(budgets)).toBe(400000);
    const st = categoryStatuses(budgets, inMonth(txs, '2026-11'), cats);
    expect(st).toHaveLength(1);
    expect(st[0].status.level).toBe('over');
  });
});
