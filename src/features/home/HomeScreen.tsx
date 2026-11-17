'use client';
import { AlertTriangle, Bell, CalendarDays, ChevronRight, Coins, FileText, HardDriveDownload, Settings } from 'lucide-react';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { backupDue } from '@/services/backup';
import Link from 'next/link';
import { BudgetRing } from '@/components/charts/BudgetRing';
import { OccurrenceRow } from '@/components/cards/OccurrenceRow';
import { Card, EmptyState, SectionTitle } from '@/components/ui/controls';
import { OCCURRENCE_STYLE } from '@/components/ui/icons';
import { useBudgets, useMeetings, useNotes, useSettings, useTasks, useTransactions } from '@/hooks/useData';
import { useNow } from '@/hooks/useNow';
import { budgetStatus, inMonth, summarize, totalLimit } from '@/services/finance';
import { completionStats, dueReminders, occurrencesOn, overdueItems, upcoming } from '@/services/recurrence';
import { useUI } from '@/stores/ui';
import { formatDayMonth, formatHeaderDate, MONTHS, monthKey, toKey } from '@/utils/date';
import { cn } from '@/utils/cn';
import { formatMoney } from '@/utils/money';
import { Mountains } from './Mountains';

const SeeAll = ({ href }: { href: string }) => (
  <Link href={href} className="flex items-center text-[13px] font-medium text-primary dark:text-accent">
    Hamısına bax <ChevronRight size={14} />
  </Link>
);

export function HomeScreen() {
  const now = useNow();
  const settings = useSettings();
  const tasks = useTasks();
  const meetings = useMeetings();
  const notes = useNotes() ?? [];
  const txs = useTransactions();
  const budgets = useBudgets();
  const openSheet = useUI((s) => s.openSheet);

  const today = toKey(now);
  const todays = occurrencesOn(tasks, meetings, today);
  const todayTasks = todays.filter((o) => o.kind === 'task');
  const month = monthKey(now);
  const sum = summarize(inMonth(txs, month));
  const status = budgetStatus(totalLimit(budgets), sum.expense);
  const next = upcoming(tasks, meetings, now, 3);
  const reminders = dueReminders(tasks, meetings, now);
  const cur = settings.currency;
  const overdue = overdueItems(tasks, meetings, now);
  const stats = completionStats(todays);
  const needsBackup = backupDue(settings.lastBackupAt, tasks.length + meetings.length + notes.length + txs.length > 0, now);

  return (
    <PullToRefresh>
    <div>
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-b from-navy-deep via-navy to-[#2a4f86] px-5 pb-[118px] pt-[calc(env(safe-area-inset-top)+24px)] text-white">
        <Mountains />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Salam, {settings.name || 'dost'} 👋</h1>
            <p className="mt-1 text-[14px] text-white/80">{formatHeaderDate(now)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openSheet({ type: 'reminders' })}
              aria-label="Xatırlatmalar"
              className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur"
            >
              <Bell size={20} />
              {reminders.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-expense ring-2 ring-navy" />
              )}
            </button>
            <Link href="/settings/" aria-label="Parametrlər" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 backdrop-blur">
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </header>

      {/* Summary cards */}
      <div className="relative z-10 -mt-[58px] grid grid-cols-3 gap-3 px-4">
        <SummaryCard href="/agenda/" icon={<CalendarDays size={22} />} iconCls="bg-p-blue text-primary dark:text-accent" title="Bugünkü plan" value={`${todayTasks.length} tapşırıq`} />
        <SummaryCard
          href="/budget/"
          icon={<Coins size={22} />}
          iconCls="bg-p-green text-income"
          title="Büdcə"
          value={formatMoney(sum.balance, { currency: cur, sign: true })}
          valueCls={sum.balance < 0 ? 'text-expense' : ''}
        />
        <SummaryCard href="/notes/" icon={<FileText size={22} />} iconCls="bg-p-yellow text-[#E09A1F]" title="Notlar" value={`${notes.length} qeyd`} />
      </div>

      <div className="space-y-5 px-4 pt-5">
        {overdue.length > 0 && (
          <Link href="/agenda/" className="flex items-center gap-3 rounded-2xl bg-p-red px-4 py-3 text-[14px]">
            <AlertTriangle size={18} className="text-expense" />
            <span className="flex-1">
              <b className="text-expense">{overdue.length} gecikmiş</b> tapşırıq/görüş var
            </span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        )}
        {needsBackup && (
          <Link href="/settings/?open=sync" className="flex items-center gap-3 rounded-2xl bg-p-yellow px-4 py-3 text-[14px]">
            <HardDriveDownload size={18} className="text-[#C98A16]" />
            <span className="flex-1">
              {settings.lastBackupAt ? `Son ehtiyat nüsxə: ${formatDayMonth(toKey(new Date(settings.lastBackupAt)))}. ` : 'Hələ ehtiyat nüsxə yoxdur. '}
              <b>İndi çıxarın</b>
            </span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        )}
        {/* Today's items */}
        <Card className="px-4 pb-1 pt-4">
          <SectionTitle action={<SeeAll href="/agenda/" />}>
            Bu günün tapşırıqları{stats.total > 0 && <span className="ml-1.5 text-[13px] font-medium text-muted">{stats.done}/{stats.total}</span>}
          </SectionTitle>
          {todays.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title="Bu gün üçün plan yoxdur"
              action={
                <button onClick={() => openSheet({ type: 'task', kind: 'task' })} className="text-sm font-semibold text-primary dark:text-accent">
                  + Tapşırıq əlavə et
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {todays.map((o) => (
                <OccurrenceRow key={o.kind + o.id} o={o} />
              ))}
            </div>
          )}
        </Card>

        {/* Budget overview */}
        <Card className="p-4">
          <SectionTitle action={<SeeAll href="/budget/" />}>
            Büdcə <span className="text-[14px] font-normal text-muted">({MONTHS[now.getMonth()]})</span>
          </SectionTitle>
          <div className="flex items-center gap-5">
            <BudgetRing percent={status.percent} level={status.level} />
            <div className="flex-1 space-y-3">
              <Row label="Xərclər" value={formatMoney(sum.expense, { currency: cur })} />
              {status.level === 'none' ? (
                <Link href="/settings/?open=goals" className="block text-sm font-semibold text-primary dark:text-accent">
                  Aylıq limit təyin et →
                </Link>
              ) : (
                <>
                  <Row label="Büdcə limiti" value={formatMoney(status.limit, { currency: cur })} />
                  <p className={cn('text-[13px]', status.level === 'over' ? 'text-expense' : status.level === 'warn' ? 'text-[#C98A16]' : 'text-muted')}>
                    {status.level === 'over'
                      ? `Limit ${formatMoney(-status.remaining, { currency: cur })} aşılıb`
                      : `Qalıq limit: ${formatMoney(status.remaining, { currency: cur })}`}
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Upcoming */}
        <Card className="p-4">
          <SectionTitle action={<SeeAll href="/agenda/" />}>Yaxınlaşan hadisələr</SectionTitle>
          {next.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">Yaxınlaşan hadisə yoxdur</p>
          ) : (
            <ul className="space-y-2.5">
              {next.map((o) => {
                const st = OCCURRENCE_STYLE[o.colorKey];
                return (
                  <li key={o.kind + o.id + o.date}>
                    <button
                      onClick={() => openSheet({ type: 'task', id: o.id, kind: o.kind })}
                      className={cn('flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left', st.bg)}
                    >
                      <span className={cn('h-9 w-1 rounded-full', st.bar)} />
                      <span className="flex-1">
                        <span className="block text-[15px] font-semibold">{o.title}</span>
                        <span className="text-[13px] text-muted">
                          {o.date === today ? 'Bu gün' : formatDayMonth(o.date)}
                          {o.startTime ? ` · ${o.startTime}` : ''}
                          {o.kind === 'meeting' ? ' · Görüş' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
    </PullToRefresh>
  );
}

function SummaryCard({ href, icon, iconCls, title, value, valueCls }: { href: string; icon: React.ReactNode; iconCls: string; title: string; value: string; valueCls?: string }) {
  return (
    <Link href={href} className="flex flex-col items-center rounded-3xl bg-card px-2 py-4 text-center shadow-card transition active:scale-[0.98]">
      <span className={cn('mb-2 grid h-11 w-11 place-items-center rounded-2xl', iconCls)}>{icon}</span>
      <span className="text-[13px] font-semibold">{title}</span>
      <span className={cn('mt-0.5 truncate text-[12.5px] text-muted', valueCls)}>{value}</span>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[14px] text-muted">{label}</span>
      <span className="text-[18px] font-bold">{value}</span>
    </div>
  );
}
