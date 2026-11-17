'use client';
import { Check, Repeat } from 'lucide-react';
import { toggleOccurrence } from '@/repositories';
import { useUI } from '@/stores/ui';
import type { AgendaOccurrence } from '@/types';
import { cn } from '@/utils/cn';

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition',
        checked ? 'border-primary bg-primary text-white' : 'border-[#C9D3E3] dark:border-white/30',
      )}
    >
      {checked && <Check size={15} strokeWidth={3} />}
    </button>
  );
}

export function OccurrenceRow({ o, showDate }: { o: AgendaOccurrence; showDate?: string }) {
  const openSheet = useUI((s) => s.openSheet);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openSheet({ type: 'task', id: o.id, kind: o.kind })}
      onKeyDown={(e) => e.key === 'Enter' && openSheet({ type: 'task', id: o.id, kind: o.kind })}
      className="flex items-center gap-3 py-3"
    >
      <Checkbox checked={o.done} onChange={() => void toggleOccurrence(o.kind, o.id, o.date)} label={`${o.title} tamamlandı`} />
      <span className={cn('flex-1 truncate text-[15px]', o.done && 'text-muted line-through')}>
        {o.title}
        {o.recurring && <Repeat size={12} className="ml-1.5 inline text-muted" aria-label="təkrarlanan" />}
      </span>
      <span className="shrink-0 text-[13px] text-muted">
        {showDate ? `${showDate} · ` : ''}
        {o.startTime ?? '—'}
      </span>
    </div>
  );
}
