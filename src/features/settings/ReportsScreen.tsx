'use client';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, SectionTitle } from '@/components/ui/controls';
import { CategoryIcon } from '@/components/ui/icons';
import { useCategories, useMeetings, useNotes, useSettings, useTasks, useTransactions } from '@/hooks/useData';
import { expenseByCategory, inMonth, summarize } from '@/services/finance';
import { occurrencesInRange } from '@/services/recurrence';
import { formatMonthYear, monthKey, toKey } from '@/utils/date';
import { formatMoney, percentOf } from '@/utils/money';

export function ReportsScreen() {
  const [ref, setRef] = useState(() => new Date());
  const txs = useTransactions();
  const categories = useCategories();
  const tasks = useTasks();
  const meetings = useMeetings();
  const notes = useNotes() ?? [];
  const { currency } = useSettings();
  const fmt = (v: number) => formatMoney(v, { currency });

  const month = monthKey(ref);
  const mTx = inMonth(txs, month);
  const s = summarize(mTx);
  const savingsRate = s.income > 0 ? percentOf(Math.max(0, s.balance), s.income) : 0;
  const top = expenseByCategory(mTx, categories).slice(0, 5);
  const start = startOfMonth(ref);
  const days = endOfMonth(ref).getDate();
  const todayK = toKey(new Date());
  const occ = occurrencesInRange(tasks, meetings, toKey(start), days).filter((o) => o.date <= todayK);
  const done = occ.filter((o) => o.done).length;
  const notesInMonth = notes.filter((n) => n.createdAt.slice(0, 7) === month).length;

  return (
    <div className="space-y-5 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="flex items-center gap-3">
        <Link href="/settings/" aria-label="Geri" className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-card">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[28px] font-bold tracking-tight">Hesabatlar</h1>
      </div>
      <div className="flex items-center justify-between rounded-2xl bg-card px-2 py-2 shadow-card">
        <button aria-label="Əvvəlki ay" onClick={() => setRef((r) => addMonths(r, -1))} className="grid h-9 w-9 place-items-center text-primary dark:text-accent"><ChevronLeft size={20} /></button>
        <span className="font-semibold">{formatMonthYear(ref)}</span>
        <button aria-label="Növbəti ay" onClick={() => setRef((r) => addMonths(r, 1))} className="grid h-9 w-9 place-items-center text-primary dark:text-accent"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Gəlir" value={fmt(s.income)} cls="text-income" />
        <Stat label="Xərc" value={fmt(s.expense)} cls="text-expense" />
        <Stat label="Qalıq" value={fmt(s.balance)} />
        <Stat label="Qənaət dərəcəsi" value={`${savingsRate}%`} />
        <Stat label="Tamamlanan plan (bu günə qədər)" value={`${done} / ${occ.length}`} sub={occ.length ? `${percentOf(done, occ.length)}%` : undefined} />
        <Stat label="Yeni qeydlər" value={String(notesInMonth)} />
      </div>

      <Card className="p-4">
        <SectionTitle>Ən çox xərc</SectionTitle>
        {top.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">Bu ay xərc yoxdur</p>
        ) : (
          <ul className="space-y-3">
            {top.map((t) => (
              <li key={t.category.id}>
                <div className="mb-1 flex items-center gap-2 text-[14px]">
                  <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: t.category.color }}>
                    <CategoryIcon icon={t.category.icon} size={13} />
                  </span>
                  <span className="flex-1">{t.category.name}</span>
                  <span className="font-semibold">{fmt(t.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full" style={{ width: `${t.percent}%`, background: t.category.color }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={`mt-1 truncate text-[20px] font-bold ${cls ?? ''}`}>{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </Card>
  );
}
