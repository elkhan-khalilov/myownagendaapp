import { cn } from '@/utils/cn';

/** Lightweight SVG progress ring (no chart library needed). */
export function BudgetRing({ percent, size = 92, stroke = 10, level }: { percent: number; size?: number; stroke?: number; level: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const color = level === 'over' ? '#F06464' : level === 'warn' ? '#F4B84C' : '#3565CE';
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-p-green" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className={cn('absolute inset-0 grid place-items-center text-[19px] font-bold', level === 'over' && 'text-expense')}>
        {percent}%
      </span>
    </div>
  );
}
