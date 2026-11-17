'use client';
import { addMonths, subMonths } from 'date-fns';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarRange, PiggyBank, Minus, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Receipt, Search, TrendingDown, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Card, Chip, EmptyState, Input, SectionTitle, Select } from '@/components/ui/controls';
import { CategoryIcon } from '@/components/ui/icons';
import { useBudgets, useCategories, useSettings, useTransactions } from '@/hooks/useData';
import { budgetStatus, categoryStatuses, dailyAllowance, expenseByCategory, inMonth, lastMonths, monthInsights, summarize, totalLimit } from '@/services/finance';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { MONTHS } from '@/utils/date';
import { useUI } from '@/stores/ui';
import type { TransactionType } from '@/types';
import { formatDayMonth, formatMonthYear, monthKey } from '@/utils/date';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';

const ChartSkeleton = () => <div className="h-full w-full animate-pulse rounded-2xl bg-soft" />;
const ExpenseDonut = dynamic(() => import('@/components/charts/ExpenseDonut'), { ssr: false, loading: ChartSkeleton });
const MonthlyBars = dynamic(() => import('@/components/charts/MonthlyBars'), { ssr: false, loading: ChartSkeleton });

export function BudgetScreen() {
  const txs = useTransactions();
  const categories = useCategories();
  const budgets = useBudgets();
  const { currency } = useSettings();
  const openSheet = useUI((s) => s.openSheet);
  const [ref, setRef] = useState(() => new Date());
  const month = monthKey(ref);

  const monthTxs = useMemo(() => inMonth(txs, month), [txs, month]);
  const sum = summarize(monthTxs);
  const shares = expenseByCategory(monthTxs, categories);
  const months = lastMonths(txs, ref, 6);
  const total = budgetStatus(totalLimit(budgets), sum.expense);
  const catStatuses = categoryStatuses(budgets, monthTxs, categories);
  const warnings = [
    ...(total.level === 'over' || total.level === 'warn' ? [{ name: 'Ümumi aylıq büdcə', s: total }] : []),
    ...catStatuses.filter((c) => c.status.level === 'over' || c.status.level === 'warn').map((c) => ({ name: c.category!.name, s: c.status })),
  ];
  const fmt = (v: number, sign = false) => formatMoney(v, { currency, sign });
  const prevRef = subMonths(ref, 1);
  const insights = monthInsights(txs, month, monthKey(prevRef));
  const isCurrentMonth = month === monthKey(new Date());
  const allowance = isCurrentMonth ? dailyAllowance(total.limit, sum.expense, new Date()) : null;

  return (
    <PullToRefresh>
    <div className="space-y-5 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <h1 className="text-[30px] font-bold tracking-tight">Büdcə</h1>

      <div className="flex items-center justify-between rounded-2xl bg-card px-2 py-2 shadow-card">
        <button aria-label="Əvvəlki ay" onClick={() => setRef((r) => addMonths(r, -1))} className="grid h-9 w-9 place-items-center text-primary dark:text-accent">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold">{formatMonthYear(ref)}</span>
        <button aria-label="Növbəti ay" onClick={() => setRef((r) => addMonths(r, 1))} className="grid h-9 w-9 place-items-center text-primary dark:text-accent">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Balance + income/expense */}
      <div className="grid grid-cols-[1.25fr_1fr] gap-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-deep p-4 text-white shadow-card">
          <p className="text-[14px] text-white/75">Qalıq</p>
          <p className={cn('mt-3 text-[28px] font-bold leading-none tracking-tight', sum.balance < 0 && 'text-[#FF9B9B]')}>{fmt(sum.balance)}</p>
          <span className="absolute bottom-4 right-4 text-income">{sum.balance >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} className="text-expense" />}</span>
        </div>
        <div className="space-y-3">
          <MiniStat dot="bg-income" label="Gəlir" value={fmt(sum.income)} onClick={() => openSheet({ type: 'transaction', txType: 'income' })} />
          <MiniStat dot="bg-expense" label="Xərc" value={fmt(sum.expense)} onClick={() => openSheet({ type: 'transaction', txType: 'expense' })} />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-2" role="alert">
          {warnings.map((w) => (
            <div key={w.name} className={cn('flex items-start gap-3 rounded-2xl p-3.5 text-[14px]', w.s.level === 'over' ? 'bg-p-red' : 'bg-p-yellow')}>
              <AlertTriangle size={18} className={w.s.level === 'over' ? 'text-expense' : 'text-[#C98A16]'} />
              <span>
                <b>{w.name}</b>:{' '}
                {w.s.level === 'over' ? `limit ${fmt(-w.s.remaining)} aşılıb (${w.s.percent}%)` : `limitin ${w.s.percent}%-i istifadə olunub`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Financial insights */}
      <Card className="p-4">
        <SectionTitle>
          Göstəricilər <span className="text-[13px] font-normal text-muted">· {MONTHS[prevRef.getMonth()]} ilə müqayisə</span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2.5">
          <InsightTile
            icon={<PiggyBank size={14} />}
            label="Aylıq qənaət"
            value={fmt(insights.savings)}
            valueCls={insights.savings < 0 ? 'text-expense' : 'text-income'}
            extra={<Trend change={insights.savingsChange} goodWhenUp />}
          />
          <InsightTile
            icon={<TrendingUp size={14} />}
            label="Qənaət dərəcəsi"
            value={`${insights.savingsRate}%`}
            extra={<span className="text-[12px] text-muted">gəlirin {insights.savingsRate}%-i saxlanılıb</span>}
          />
          <InsightTile icon={<ArrowUpRight size={14} />} label="Xərc" value={fmt(sum.expense)} extra={<Trend change={insights.expenseChange} goodWhenUp={false} />} />
          <InsightTile icon={<ArrowDownLeft size={14} />} label="Gəlir" value={fmt(sum.income)} extra={<Trend change={insights.incomeChange} goodWhenUp />} />
        </div>
        {allowance ? (
          <div className={cn('mt-2.5 flex items-center gap-3 rounded-2xl p-3', allowance.remaining > 0 ? 'bg-p-blue' : 'bg-p-red')}>
            <CalendarRange size={20} className={allowance.remaining > 0 ? 'text-primary dark:text-accent' : 'text-expense'} />
            <div className="text-[13.5px]">
              {allowance.remaining > 0 ? (
                <>
                  Gündəlik xərc imkanı: <b>{fmt(allowance.perDay)}</b>
                  <span className="text-muted"> · {allowance.daysLeft} gün qalıb</span>
                </>
              ) : (
                <>Aylıq hədəf aşılıb — bu ay əlavə xərc planlaşdırılmayıb</>
              )}
            </div>
          </div>
        ) : isCurrentMonth && total.level === 'none' ? (
          <Link href="/settings/?open=goals" className="mt-2.5 block rounded-2xl bg-soft p-3 text-[13.5px] font-medium text-primary dark:text-accent">
            Aylıq xərc hədəfi təyin edin → gündəlik xərc imkanı hesablansın
          </Link>
        ) : null}
        {shares.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[12.5px] font-medium text-muted">Ən böyük xərc kateqoriyaları</p>
            <ol className="space-y-1">
              {shares.slice(0, 3).map((s, i) => (
                <li key={s.category.id} className="flex items-center gap-2 text-[14px]">
                  <span className="w-4 text-muted">{i + 1}.</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.category.color }} />
                  <span className="flex-1">{s.category.name}</span>
                  <span className="font-semibold">{fmt(s.amount)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      {/* Expense categories donut */}
      <Card className="p-4">
        <SectionTitle>Xərc kateqoriyaları</SectionTitle>
        {shares.length === 0 ? (
          <EmptyState icon={<Receipt />} title="Bu ay xərc yoxdur" />
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ExpenseDonut data={shares} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[17px] font-bold">{fmt(sum.expense)}</span>
                <span className="text-[12px] text-muted">Xərc</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {shares.slice(0, 6).map((s) => (
                <li key={s.category.id} className="flex items-center gap-2 text-[14px]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white" style={{ background: s.category.color }}>
                    <CategoryIcon icon={s.category.icon} size={13} />
                  </span>
                  <span className="flex-1 truncate">{s.category.name}</span>
                  <span className="font-semibold">{s.percent}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Category limits */}
      {(total.level !== 'none' || catStatuses.length > 0) && (
        <Card className="p-4">
          <SectionTitle action={<Link href="/settings/?open=goals" className="text-[13px] font-medium text-primary dark:text-accent">Limitlər</Link>}>
            Büdcə limitləri
          </SectionTitle>
          <div className="space-y-3.5">
            {total.level !== 'none' && <LimitBar name="Aylıq xərc hədəfi" s={total} fmt={fmt} />}
            {catStatuses.map((c) => (
              <LimitBar key={c.budget.id} name={c.category!.name} s={c.status} fmt={fmt} />
            ))}
          </div>
        </Card>
      )}

      {/* Monthly dynamics */}
      <Card className="p-4">
        <SectionTitle
          action={
            <span className="flex gap-3 text-[12px] text-muted">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-income" />Gəlir</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-primary" />Xərc</span>
            </span>
          }
        >
          Aylıq dinamika
        </SectionTitle>
        <div className="h-[180px]">
          <MonthlyBars data={months} />
        </div>
      </Card>

      <TransactionList monthTxsKey={month} fmt={fmt} />
    </div>
    </PullToRefresh>
  );
}

/** Arrow + % vs previous month. `goodWhenUp` decides the colour (income up = good, expense up = bad). */
function Trend({ change, goodWhenUp }: { change: number | null; goodWhenUp: boolean }) {
  if (change === null) return <span className="text-[12px] text-muted">müqayisə yoxdur</span>;
  if (change === 0)
    return (
      <span className="flex items-center gap-0.5 text-[12px] text-muted">
        <Minus size={12} /> dəyişməyib
      </span>
    );
  const up = change > 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn('flex items-center gap-0.5 text-[12px] font-semibold', good ? 'text-income' : 'text-expense')}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(change)}%
    </span>
  );
}

function InsightTile({ icon, label, value, extra, valueCls }: { icon: React.ReactNode; label: string; value: string; extra?: React.ReactNode; valueCls?: string }) {
  return (
    <div className="rounded-2xl bg-bg p-3">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 truncate text-[17px] font-bold', valueCls)}>{value}</div>
      <div className="mt-0.5">{extra}</div>
    </div>
  );
}

function MiniStat({ dot, label, value, onClick }: { dot: string; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-2.5 rounded-2xl bg-card px-3.5 py-3 text-left shadow-card" aria-label={`${label} əlavə et`}>
      <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full', dot)} />
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">{label}</span>
        <span className="block truncate text-[17px] font-bold">{value}</span>
      </span>
    </button>
  );
}

function LimitBar({ name, s, fmt }: { name: string; s: ReturnType<typeof budgetStatus>; fmt: (v: number) => string }) {
  const color = s.level === 'over' ? 'bg-expense' : s.level === 'warn' ? 'bg-warn' : 'bg-primary';
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span className="font-medium">{name}</span>
        <span className="text-muted">
          {fmt(s.spent)} / {fmt(s.limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-soft">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, s.percent)}%` }} />
      </div>
    </div>
  );
}

function TransactionList({ monthTxsKey, fmt }: { monthTxsKey: string; fmt: (v: number, sign?: boolean) => string }) {
  const txs = useTransactions();
  const categories = useCategories();
  const openSheet = useUI((s) => s.openSheet);
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | TransactionType>('all');
  const [cat, setCat] = useState('');
  const [day, setDay] = useState('');
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const query = q.trim().toLocaleLowerCase('az');
  const list = txs
    .filter((t) => (day ? t.date === day : t.date.startsWith(monthTxsKey)))
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => !cat || t.categoryId === cat)
    .filter((t) => !query || `${t.note ?? ''} ${catMap.get(t.categoryId)?.name ?? ''}`.toLocaleLowerCase('az').includes(query))
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));

  return (
    <Card className="p-4">
      <SectionTitle
        action={
          <div className="flex gap-2">
            <button onClick={() => openSheet({ type: 'transaction', txType: 'income' })} className="flex h-8 items-center gap-1 rounded-full bg-p-green px-3 text-[13px] font-semibold text-income">
              <ArrowDownLeft size={14} /> Gəlir
            </button>
            <button onClick={() => openSheet({ type: 'transaction', txType: 'expense' })} className="flex h-8 items-center gap-1 rounded-full bg-p-red px-3 text-[13px] font-semibold text-expense">
              <ArrowUpRight size={14} /> Xərc
            </button>
          </div>
        }
      >
        Əməliyyatlar
      </SectionTitle>
      <div className="relative">
        <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Axtar" className="h-11 pl-11" />
      </div>
      <div className="mt-3 flex gap-2">
        {(['all', 'income', 'expense'] as const).map((t) => (
          <Chip key={t} active={type === t} onClick={() => { setType(t); setCat(''); }} className="h-8 px-3 text-[13px]">
            {t === 'all' ? 'Hamısı' : t === 'income' ? 'Gəlir' : 'Xərc'}
          </Chip>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 text-[14px]" aria-label="Kateqoriya filtri">
          <option value="">Bütün kateqoriyalar</option>
          {categories
            .filter((c) => type === 'all' || c.type === type)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'income' ? 'gəlir' : 'xərc'})
              </option>
            ))}
        </Select>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-11 text-[14px]" aria-label="Tarix filtri" />
      </div>
      {day && (
        <button onClick={() => setDay('')} className="mt-2 text-[13px] font-medium text-primary dark:text-accent">
          Tarix filtrini sıfırla
        </button>
      )}

      <ul className="mt-3 divide-y divide-line">
        {list.map((t) => {
          const c = catMap.get(t.categoryId);
          return (
            <li key={t.id}>
              <button onClick={() => openSheet({ type: 'transaction', id: t.id })} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: c?.color ?? '#9AA7BD' }}>
                  <CategoryIcon icon={c?.icon ?? 'more'} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{t.note || c?.name || 'Əməliyyat'}</span>
                  <span className="text-[12.5px] text-muted">
                    {c?.name} · {formatDayMonth(t.date)}
                  </span>
                </span>
                <span className={cn('shrink-0 text-[15px] font-bold', t.type === 'income' ? 'text-income' : 'text-expense')}>
                  {fmt(t.type === 'income' ? t.amount : -t.amount, true)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="py-6 text-center text-sm text-muted">Əməliyyat tapılmadı</p>}
    </Card>
  );
}
