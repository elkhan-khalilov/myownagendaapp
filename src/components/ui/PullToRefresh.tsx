'use client';
import { RefreshCw } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { checkForUpdate } from '@/pwa/register';
import { useUI } from '@/stores/ui';
import { haptic } from '@/utils/haptics';

const TRIGGER = 72;

/**
 * Pull-to-refresh for top-level screens. Data is live (IndexedDB live queries), so a refresh
 * re-reads the clock-dependent views (today, overdue, reminders) and checks for an app update.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const start = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = useUI((s) => s.refresh);

  const onStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || busy || document.body.style.overflow === 'hidden') return;
    start.current = e.touches[0].clientY;
  };
  const onMove = (e: React.TouchEvent) => {
    if (start.current === null) return;
    const dy = e.touches[0].clientY - start.current;
    if (dy <= 0 || window.scrollY > 0) return setPull(0);
    setPull(Math.min(110, dy * 0.5));
  };
  const onEnd = async () => {
    if (start.current === null) return;
    start.current = null;
    if (pull >= TRIGGER) {
      setBusy(true);
      haptic('light');
      refresh();
      await Promise.all([checkForUpdate(), new Promise((r) => setTimeout(r, 500))]);
      setBusy(false);
    }
    setPull(0);
  };

  const h = busy ? 48 : pull;
  return (
    <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
      <div className="flex items-end justify-center overflow-hidden" style={{ height: h, transition: start.current ? 'none' : 'height .25s ease' }} aria-hidden={!busy}>
        <span className="mb-2 grid h-8 w-8 place-items-center rounded-full bg-card text-primary shadow-card dark:text-accent">
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }} />
        </span>
      </div>
      {busy && <span className="sr-only" role="status">Yenilənir</span>}
      {children}
    </div>
  );
}
