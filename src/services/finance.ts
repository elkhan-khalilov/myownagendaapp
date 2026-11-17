import { subMonths } from 'date-fns';
import type { Budget, Transaction, TransactionCategory } from '@/types';
import { TOTAL_BUDGET_KEY } from '@/types';
import { distributePercents, percentOf } from '@/utils/money';
import { MONTHS_SHORT, monthKey } from '@/utils/date';

export interface Summary {
  income: number;
  expense: number;
  balance: number;
}

/** All amounts are integer minor units; only integer addition/subtraction is used. */
export function summarize(txs: Transaction[]): Summary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!Number.isInteger(t.amount)) throw new Error('Non-integer amount in transaction ' + t.id);
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export const inMonth = (txs: Transaction[], month: string) => txs.filter((t) => t.date.startsWith(month));

export interface CategoryShare {
  category: TransactionCategory;
  amount: number;
  percent: number;
}

export function expenseByCategory(txs: Transaction[], categories: TransactionCategory[]): CategoryShare[] {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  const fallback = categories.find((c) => c.id === 'exp-other');
  const rows = [...totals.entries()]
    .map(([id, amount]) => ({
      category:
        categories.find((c) => c.id === id) ??
        fallback ?? ({ id, name: 'Digər', color: '#9AA7BD', icon: 'more' } as TransactionCategory),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  const pcts = distributePercents(rows.map((r) => r.amount));
  return rows.map((r, i) => ({ ...r, percent: pcts[i] }));
}

export interface MonthPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
}

export function lastMonths(txs: Transaction[], ref: Date, count = 6): MonthPoint[] {
  const points: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = subMonths(ref, i);
    const key = monthKey(d);
    const s = summarize(inMonth(txs, key));
    points.push({ month: key, label: MONTHS_SHORT[d.getMonth()], income: s.income, expense: s.expense });
  }
  return points;
}

export type BudgetLevel = 'none' | 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  level: BudgetLevel;
}

export const WARN_THRESHOLD = 80;

export function budgetStatus(limit: number | undefined, spent: number): BudgetStatus {
  if (!limit || limit <= 0) return { limit: 0, spent, remaining: 0, percent: 0, level: 'none' };
  const percent = percentOf(spent, limit);
  const level: BudgetLevel = spent > limit ? 'over' : percent >= WARN_THRESHOLD ? 'warn' : 'ok';
  return { limit, spent, remaining: limit - spent, percent, level };
}

export function totalLimit(budgets: Budget[]) {
  return budgets.find((b) => b.categoryId === TOTAL_BUDGET_KEY)?.limit ?? 0;
}

export function categoryStatuses(budgets: Budget[], monthTxs: Transaction[], categories: TransactionCategory[]) {
  return budgets
    .filter((b) => b.categoryId !== TOTAL_BUDGET_KEY && b.limit > 0)
    .map((b) => {
      const spent = monthTxs
        .filter((t) => t.type === 'expense' && t.categoryId === b.categoryId)
        .reduce((a, t) => a + t.amount, 0);
      return { budget: b, category: categories.find((c) => c.id === b.categoryId), status: budgetStatus(b.limit, spent) };
    })
    .filter((r) => r.category);
}

/** Signed percent change from `prev` to `cur` (integer). null when there is no previous value. */
export function percentChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  const diff = cur - prev;
  const sign = diff < 0 ? -1 : 1;
  return sign * percentOf(Math.abs(diff), prev);
}

export interface DailyAllowance {
  /** Remaining limit per day (minor units), floored so the sum never exceeds the remaining limit */
  perDay: number;
  daysLeft: number;
  remaining: number;
}

/**
 * Remaining daily spending allowance for the month containing `today`.
 * Days left includes today. Returns null when no limit is set or the month is not the current one.
 */
export function dailyAllowance(limit: number, spent: number, today: Date): DailyAllowance | null {
  if (!limit || limit <= 0) return null;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate() + 1;
  const remaining = limit - spent;
  return { perDay: remaining > 0 ? Math.floor(remaining / daysLeft) : 0, daysLeft, remaining };
}

export interface MonthInsights {
  current: Summary;
  previous: Summary;
  savings: number;
  savingsRate: number; // integer percent of income saved (0 when no income or negative balance)
  expenseChange: number | null;
  incomeChange: number | null;
  savingsChange: number | null;
}

export function monthInsights(txs: Transaction[], month: string, prevMonth: string): MonthInsights {
  const current = summarize(inMonth(txs, month));
  const previous = summarize(inMonth(txs, prevMonth));
  const savings = current.balance;
  return {
    current,
    previous,
    savings,
    savingsRate: current.income > 0 && savings > 0 ? percentOf(savings, current.income) : 0,
    expenseChange: percentChange(current.expense, previous.expense),
    incomeChange: percentChange(current.income, previous.income),
    savingsChange: previous.balance > 0 ? percentChange(Math.max(0, savings), previous.balance) : null,
  };
}
