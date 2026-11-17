'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/controls';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] render error:', error.name); // no message/stack contents: may include user data
  }, [error]);
  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
      <h1 className="text-[22px] font-bold">Xəta baş verdi</h1>
      <p className="mt-2 text-[14px] text-muted">Məlumatlarınız cihazda qalır. Səhifəni yenidən yükləməyə cəhd edin.</p>
      <div className="mt-5 flex gap-3">
        <Button variant="soft" onClick={() => (window.location.href = '/')}>Əsas səhifə</Button>
        <Button onClick={reset}>Yenidən cəhd et</Button>
      </div>
    </div>
  );
}
