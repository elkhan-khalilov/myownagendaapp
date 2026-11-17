'use client';
import { addDays } from 'date-fns';
import { toKey } from '@/utils/date';
import { cn } from '@/utils/cn';

/** Large tap targets for the most common dates, next to the native date picker */
export function DateQuickPick({ value, onChange, past }: { value: string; onChange: (d: string) => void; past?: boolean }) {
  const today = new Date();
  const opts = past
    ? [
        { label: 'Bu gün', d: toKey(today) },
        { label: 'Dünən', d: toKey(addDays(today, -1)) },
        { label: 'Srağagün', d: toKey(addDays(today, -2)) },
      ]
    : [
        { label: 'Bu gün', d: toKey(today) },
        { label: 'Sabah', d: toKey(addDays(today, 1)) },
        { label: 'Gələn həftə', d: toKey(addDays(today, 7)) },
      ];
  return (
    <div className="mt-2 flex gap-2">
      {opts.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.d)}
          aria-pressed={value === o.d}
          className={cn(
            'h-9 flex-1 rounded-xl text-[13px] font-medium transition',
            value === o.d ? 'bg-primary text-white' : 'bg-soft text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
