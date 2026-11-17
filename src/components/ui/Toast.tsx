'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '@/stores/ui';
import { cn } from '@/utils/cn';

export function ToastHost() {
  const { toast, dismissToast } = useUI();
  useEffect(() => {
    if (!toast || toast.sticky) return;
    const t = setTimeout(dismissToast, toast.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={cn(
              'pointer-events-auto flex w-full max-w-[440px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[14px] text-white shadow-2xl',
              toast.tone === 'error' ? 'bg-expense' : toast.tone === 'warn' ? 'bg-[#B9811A]' : 'bg-navy-deep',
            )}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="shrink-0 font-semibold text-[#9DBBFF]"
                onClick={() => {
                  toast.action?.();
                  dismissToast();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
