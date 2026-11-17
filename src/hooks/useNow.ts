'use client';
import { useEffect, useState } from 'react';
import { useUI } from '@/stores/ui';

/** Current time, refreshed every `intervalMs` (default 30s). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  const tick = useUI((s) => s.refreshTick);
  useEffect(() => {
    if (tick) setNow(new Date());
  }, [tick]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);
  return now;
}
