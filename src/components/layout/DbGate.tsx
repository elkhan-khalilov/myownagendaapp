'use client';
import { DatabaseZap } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/controls';
import { getDB } from '@/db/schema';

/** Opens IndexedDB before rendering screens; shows a skeleton while loading and a clear error if storage is unavailable. */
export function DbGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getDB()
      .open()
      .then(() => alive && setState('ready'))
      .catch((e: Error) => {
        console.warn('[db] open failed:', e?.name);
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (state === 'ready') return <>{children}</>;
  if (state === 'error')
    return (
      <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-p-red text-expense">
          <DatabaseZap size={28} />
        </div>
        <h1 className="text-[20px] font-bold">Yaddaş açıla bilmədi</h1>
        <p className="mt-2 text-[14px] text-muted">
          Brauzer yerli yaddaşa (IndexedDB) icazə vermir. Şəxsi (Private) rejimdə olmadığınızı və cihazda boş yer olduğunu yoxlayın.
        </p>
        <Button className="mt-5" onClick={() => { setState('loading'); setAttempt((a) => a + 1); }}>
          Yenidən cəhd et
        </Button>
      </div>
    );
  return (
    <div className="space-y-4 px-4 pt-[calc(env(safe-area-inset-top)+20px)]" aria-busy="true" aria-label="Yüklənir">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-soft" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-soft" />)}
      </div>
      <div className="h-48 animate-pulse rounded-3xl bg-soft" />
      <div className="h-40 animate-pulse rounded-3xl bg-soft" />
    </div>
  );
}
