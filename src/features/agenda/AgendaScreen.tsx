'use client';
import { addDays, addMonths, endOfMonth, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { AlertTriangle, ArrowDownWideNarrow, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/cards/OccurrenceRow';
import { Chip, EmptyState, Input, Segmented } from '@/components/ui/controls';
import { MeetingIcon, OCCURRENCE_STYLE, TASK_CATEGORY_META } from '@/components/ui/icons';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { useMeetings, useTasks } from '@/hooks/useData';
import { useNow } from '@/hooks/useNow';
import { rescheduleItem, toggleOccurrence } from '@/repositories';
import {
  completionStats, conflictingIds, occurrencesInRange, occurrencesOn, overdueItems, sortByPriority, sortOccurrences,
} from '@/services/recurrence';
import { useUI } from '@/stores/ui';
import type { AgendaOccurrence, Meeting, Task } from '@/types';
import { durationLabel, formatDayMonth, fromKey, formatMonthYear, toKey, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekDays, weekdayIndex } from '@/utils/date';
import { cn } from '@/utils/cn';

type Mode = 'day' | 'week' | 'month';
type Filter = 'all' | 'meeting' | 'important' | 'presentation' | 'personal' | 'exercise' | 'general' | 'done' | 'open';
type Sort = 'time' | 'priority';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Hamısı' },
  { value: 'open', label: 'Gözləyən' },
  { value: 'done', label: 'Tamamlanan' },
  { value: 'meeting', label: 'Görüş' },
  { value: 'important', label: 'Vacib' },
  { value: 'presentation', label: 'Təqdimat' },
  { value: 'personal', label: 'Şəxsi' },
  { value: 'exercise', label: 'İdman' },
  { value: 'general', label: 'Ümumi' },
];

export function AgendaScreen() {
  const tasks = useTasks();
  const meetings = useMeetings();
  const now = useNow();
  const openSheet = useUI((s) => s.openSheet);
  const [mode, setMode] = useState<Mode>('day');
  const [selected, setSelected] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('time');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const todayK = toKey(now);
  const tomorrowK = toKey(addDays(now, 1));
  const selectedK = toKey(selected);
  const thisWeek = mode === 'week' && toKey(weekDays(now)[0]) === toKey(weekDays(selected)[0]);
  const range: 'today' | 'tomorrow' | 'week' | null =
    mode === 'day' && selectedK === todayK ? 'today' : mode === 'day' && selectedK === tomorrowK ? 'tomorrow' : thisWeek ? 'week' : null;

  const applyFilter = (list: AgendaOccurrence[]) =>
    list
      .filter((o) => {
        if (filter === 'all') return true;
        if (filter === 'done') return o.done;
        if (filter === 'open') return !o.done;
        if (filter === 'meeting') return o.kind === 'meeting';
        return o.kind === 'task' && taskById.get(o.id)?.category === filter;
      })
      .sort(sort === 'priority' ? sortByPriority : sortOccurrences);

  const dayItems = (d: Date) => applyFilter(occurrencesOn(tasks, meetings, toKey(d)));
  const overdue = overdueItems(tasks, meetings, now);

  // Completion statistics (unfiltered)
  const todayStats = completionStats(occurrencesOn(tasks, meetings, todayK));
  const weekStart = toKey(weekDays(now)[0]);
  const weekStats = completionStats(occurrencesInRange(tasks, meetings, weekStart, 7).filter((o) => o.date <= todayK));

  const shift = (dir: 1 | -1) => setSelected((s) => (mode === 'month' ? addMonths(s, dir) : addDays(s, dir * 7)));

  return (
    <PullToRefresh>
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[30px] font-bold tracking-tight">Agenda</h1>
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              setQuery('');
            }}
            aria-label={searchOpen ? 'Axtarışı bağla' : 'Axtar'}
            className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-card"
          >
            {searchOpen ? <X size={19} /> : <Search size={19} />}
          </button>
        </div>

        {searchOpen ? (
          <SearchPanel tasks={tasks} meetings={meetings} query={query} setQuery={setQuery} />
        ) : (
          <>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'day', label: 'Gün' },
                { value: 'week', label: 'Həftə' },
                { value: 'month', label: 'Ay' },
              ]}
            />

            {/* Quick ranges + stats */}
            <div className="mt-3 flex items-center gap-2">
              <Chip active={range === 'today'} onClick={() => { setMode('day'); setSelected(new Date()); }} className="h-8 px-3 text-[13px]">Bu gün</Chip>
              <Chip active={range === 'tomorrow'} onClick={() => { setMode('day'); setSelected(addDays(new Date(), 1)); }} className="h-8 px-3 text-[13px]">Sabah</Chip>
              <Chip active={range === 'week'} onClick={() => { setMode('week'); setSelected(new Date()); }} className="h-8 px-3 text-[13px]">Bu həftə</Chip>
              <button
                onClick={() => setSort((s) => (s === 'time' ? 'priority' : 'time'))}
                aria-label={`Sıralama: ${sort === 'time' ? 'vaxt' : 'prioritet'}`}
                className="ml-auto flex h-8 items-center gap-1 rounded-full bg-soft px-3 text-[12.5px] font-medium text-primary dark:text-accent"
              >
                {sort === 'time' ? <Clock size={14} /> : <ArrowDownWideNarrow size={14} />}
                {sort === 'time' ? 'Vaxt' : 'Prioritet'}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatPill label="Bu gün" s={todayStats} />
              <StatPill label="Bu həftə" s={weekStats} />
            </div>

            {overdue.length > 0 && (
              <section className="mt-4 rounded-3xl bg-p-red p-3.5" aria-label="Gecikmiş">
                <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold text-expense">
                  <AlertTriangle size={16} /> Gecikmiş ({overdue.length})
                </h2>
                <ul className="space-y-2">
                  {overdue.slice(0, 5).map(({ kind, item }) => (
                    <li key={kind + item.id} className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2.5">
                      <Checkbox checked={false} onChange={() => void toggleOccurrence(kind, item.id, item.date)} label={`${item.title} tamamlandı`} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => openSheet({ type: 'task', id: item.id, kind })}>
                        <span className="block truncate text-[14.5px] font-medium">{item.title}</span>
                        <span className="text-[12px] text-expense">
                          {item.date === todayK ? 'Bu gün' : formatDayMonth(item.date)}
                          {item.startTime ? ` · ${item.startTime}` : ''}
                        </span>
                      </button>
                      <button
                        onClick={() => void rescheduleItem(kind, item.id, todayK === item.date ? tomorrowK : todayK)}
                        className="shrink-0 rounded-full bg-p-blue px-3 py-1.5 text-[12px] font-semibold text-primary dark:text-accent"
                      >
                        {todayK === item.date ? 'Sabaha' : 'Bu günə'}
                      </button>
                    </li>
                  ))}
                </ul>
                {overdue.length > 5 && <p className="mt-2 text-center text-[12px] text-expense">+{overdue.length - 5} daha</p>}
              </section>
            )}

            <div className="mt-4 flex items-center justify-between">
              <NavBtn dir={-1} onClick={() => shift(-1)} />
              <button className="text-[16px] font-bold" onClick={() => setSelected(new Date())} aria-label="Bu günə qayıt">
                {formatMonthYear(selected)}
              </button>
              <NavBtn dir={1} onClick={() => shift(1)} />
            </div>

            {mode !== 'month' && (
              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {weekDays(selected).map((d) => {
                  const active = toKey(d) === selectedK;
                  const isToday = toKey(d) === todayK;
                  const has = occurrencesOn(tasks, meetings, toKey(d)).length > 0;
                  return (
                    <button key={toKey(d)} onClick={() => setSelected(d)} className="flex flex-col items-center gap-1.5">
                      <span className="text-[12px] text-muted">{WEEKDAYS_SHORT[weekdayIndex(d)]}</span>
                      <span
                        className={cn(
                          'grid h-10 w-10 place-items-center rounded-full text-[16px] font-semibold transition',
                          active ? 'bg-primary text-white shadow-float' : isToday ? 'text-primary dark:text-accent' : '',
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span className={cn('h-1 w-1 rounded-full', has && !active ? 'bg-accent' : 'bg-transparent')} />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
              {FILTERS.map((f) => (
                <Chip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} className="h-8 px-3.5 text-[13px]">
                  {f.label}
                </Chip>
              ))}
            </div>

            <div className="mt-4">
              {mode === 'day' && <DayTimeline items={dayItems(selected)} date={selected} />}
              {mode === 'week' && (
                <div className="space-y-4 pb-20">
                  {weekDays(selected).map((d) => {
                    const items = dayItems(d);
                    const conflicts = conflictingIds(items);
                    return (
                      <section key={toKey(d)}>
                        <h3 className={cn('mb-2 text-[14px] font-semibold', toKey(d) === todayK ? 'text-primary dark:text-accent' : 'text-muted')}>
                          {WEEKDAYS_LONG[weekdayIndex(d)]}, {formatDayMonth(toKey(d))}
                        </h3>
                        {items.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-[13px] text-muted">Plan yoxdur</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((o) => (
                              <EventCard key={o.kind + o.id} o={o} compact conflict={conflicts.has(o.kind + o.id)} />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              {mode === 'month' && (
                <MonthGrid
                  selected={selected}
                  count={(d) => dayItems(d).length}
                  onPick={(d) => {
                    setSelected(d);
                    setMode('day');
                  }}
                />
              )}
            </div>
          </>
        )}

        <button
          onClick={() => openSheet({ type: 'task', kind: 'task', date: selectedK })}
          aria-label="Bu tarixə tapşırıq əlavə et"
          className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-224px))] z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-float transition active:scale-95"
        >
          <Plus size={26} />
        </button>
      </div>
    </PullToRefresh>
  );
}

function StatPill({ label, s }: { label: string; s: ReturnType<typeof completionStats> }) {
  return (
    <div className="rounded-2xl bg-card px-3.5 py-2.5 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-muted">{label}</span>
        <span className="text-[14px] font-bold">
          {s.done}/{s.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} tamamlanma`}>
        <div className="h-full rounded-full bg-income transition-all" style={{ width: `${s.percent}%` }} />
      </div>
    </div>
  );
}

function NavBtn({ dir, onClick }: { dir: 1 | -1; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={dir < 0 ? 'Əvvəlki' : 'Növbəti'} className="grid h-9 w-9 place-items-center rounded-full bg-card text-primary shadow-card dark:text-accent">
      {dir < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

function DayTimeline({ items, date }: { items: AgendaOccurrence[]; date: Date }) {
  const openSheet = useUI((s) => s.openSheet);
  const conflicts = conflictingIds(items);
  if (items.length === 0)
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Bu gün üçün plan yoxdur"
        text={formatDayMonth(toKey(date))}
        action={
          <button onClick={() => openSheet({ type: 'task', kind: 'task', date: toKey(date) })} className="text-sm font-semibold text-primary dark:text-accent">
            + Əlavə et
          </button>
        }
      />
    );
  return (
    <>
      <p className="mb-2 text-center text-[11.5px] text-muted">Sağa sürüşdür — tamamla · Sola — sabaha keçir</p>
      <ol className="relative space-y-3 pb-20">
        {items.map((o) => (
          <li key={o.kind + o.id} className="flex gap-3">
            <span className="w-12 shrink-0 pt-3 text-[13px] font-medium text-muted">{o.startTime ?? 'Gün'}</span>
            <div className="min-w-0 flex-1">
              <EventCard o={o} conflict={conflicts.has(o.kind + o.id)} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function EventCard({ o, compact, conflict }: { o: AgendaOccurrence; compact?: boolean; conflict?: boolean }) {
  const openSheet = useUI((s) => s.openSheet);
  const showToast = useUI((s) => s.showToast);
  const st = OCCURRENCE_STYLE[o.colorKey];
  const Icon = o.kind === 'meeting' ? MeetingIcon : TASK_CATEGORY_META[taskCategoryFromColor(o.colorKey)].icon;
  const dur = durationLabel(o.startTime, o.endTime);
  const tomorrow = toKey(addDays(fromKey(o.date), 1));
  return (
    <SwipeRow
      left={{
        label: o.done ? 'Geri al' : 'Tamamla',
        icon: <Check size={18} />,
        className: 'bg-income text-white',
        onTrigger: () => void toggleOccurrence(o.kind, o.id, o.date),
      }}
      right={
        o.recurring
          ? undefined
          : {
              label: 'Sabaha',
              icon: <CalendarClock size={18} />,
              className: 'bg-primary text-white',
              onTrigger: async () => {
                await rescheduleItem(o.kind, o.id, tomorrow);
                showToast({ message: `"${o.title}" ${formatDayMonth(tomorrow)} tarixinə keçirildi` });
              },
            }
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => openSheet({ type: 'task', id: o.id, kind: o.kind })}
        onKeyDown={(e) => e.key === 'Enter' && openSheet({ type: 'task', id: o.id, kind: o.kind })}
        className={cn('flex items-center gap-3 rounded-2xl px-3.5', st.bg, compact ? 'py-2.5' : 'py-3.5', conflict && 'ring-2 ring-warn/70')}
      >
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card/70', st.fg)}>
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[15px] font-semibold', o.done && 'text-muted line-through')}>{o.title}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {compact && o.startTime ? `${o.startTime} · ` : ''}
            {dur || (o.kind === 'meeting' ? 'Görüş' : 'Tapşırıq')}
            {o.recurring ? ' · təkrarlanır' : ''}
            {o.priority === 'high' ? ' · yüksək prioritet' : ''}
          </span>
          {conflict && (
            <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-[#C98A16]">
              <AlertTriangle size={12} /> Vaxt toqquşması
            </span>
          )}
        </span>
        <Checkbox checked={o.done} onChange={() => void toggleOccurrence(o.kind, o.id, o.date)} label={`${o.title} tamamlandı`} />
      </div>
    </SwipeRow>
  );
}

function taskCategoryFromColor(c: AgendaOccurrence['colorKey']): keyof typeof TASK_CATEGORY_META {
  return ({ blue: 'general', red: 'important', purple: 'presentation', green: 'personal', yellow: 'exercise' } as const)[c];
}

function MonthGrid({ selected, count, onPick }: { selected: Date; count: (d: Date) => number; onPick: (d: Date) => void }) {
  const start = startOfWeek(startOfMonth(selected), { weekStartsOn: 1 });
  const end = endOfMonth(selected);
  const days: Date[] = [];
  for (let d = start; d <= end || weekdayIndex(d) !== 0; d = addDays(d, 1)) days.push(d);
  const todayK = toKey(new Date());
  return (
    <div className="mb-20 rounded-3xl bg-card p-3 shadow-card">
      <div className="grid grid-cols-7 text-center text-[12px] text-muted">
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="py-1.5">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const n = count(d);
          const inMonth = isSameMonth(d, selected);
          const isSel = toKey(d) === toKey(selected);
          return (
            <button key={toKey(d)} onClick={() => onPick(d)} className="flex flex-col items-center py-1" aria-label={`${formatDayMonth(toKey(d))}, ${n} plan`}>
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-[15px]',
                  isSel ? 'bg-primary font-semibold text-white' : toKey(d) === todayK ? 'font-bold text-primary dark:text-accent' : '',
                  !inMonth && !isSel && 'text-muted/50',
                )}
              >
                {d.getDate()}
              </span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchPanel({ tasks, meetings, query, setQuery }: { tasks: Task[]; meetings: Meeting[]; query: string; setQuery: (q: string) => void }) {
  const openSheet = useUI((s) => s.openSheet);
  const q = query.trim().toLocaleLowerCase('az');
  const results = q
    ? [
        ...tasks.map((t) => ({ kind: 'task' as const, item: t as Task | Meeting })),
        ...meetings.map((m) => ({ kind: 'meeting' as const, item: m as Task | Meeting })),
      ]
        .filter(({ item }) => {
          const hay = `${item.title} ${item.description ?? ''}`.toLocaleLowerCase('az');
          return q.split(/\s+/u).every((w) => hay.includes(w));
        })
        .sort((a, b) => (a.item.date < b.item.date ? 1 : -1))
    : [];
  return (
    <div>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tapşırıq və görüşlərdə axtar" className="pl-11" type="search" maxLength={100} />
      </div>
      <ul className="mt-4 space-y-2 pb-20">
        {results.map(({ kind, item }) => (
          <li key={kind + item.id}>
            <button onClick={() => openSheet({ type: 'task', id: item.id, kind })} className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3 text-left shadow-card">
              <span>
                <span className={cn('block font-semibold', item.status === 'done' && 'text-muted line-through')}>{item.title}</span>
                <span className="text-[13px] text-muted">
                  {kind === 'meeting' ? 'Görüş' : 'Tapşırıq'} · {formatDayMonth(item.date)}
                  {item.startTime ? ` · ${item.startTime}` : ''}
                  {item.repeat !== 'none' ? ' · təkrarlanır' : ''}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          </li>
        ))}
        {q && results.length === 0 && <p className="py-6 text-center text-sm text-muted">Heç nə tapılmadı</p>}
      </ul>
    </div>
  );
}
