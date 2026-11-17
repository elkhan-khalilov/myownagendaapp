'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '@/stores/ui';
import { haptic } from '@/utils/haptics';
import { Button } from './controls';

export function ConfirmHost() {
  const { confirm, setConfirm } = useUI();
  const close = (ok: boolean) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };
  useEffect(() => {
    if (confirm?.danger) haptic('warning');
  }, [confirm]);

  return (
    <AnimatePresence>
      {confirm && (
        <div className="fixed inset-0 z-[70] grid place-items-center px-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <motion.div className="absolute inset-0 bg-[#0b1629]/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)} />
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="relative w-full max-w-[360px] rounded-3xl bg-card p-5 text-ink shadow-2xl"
          >
            <h2 id="confirm-title" className="text-[18px] font-bold">{confirm.title}</h2>
            {confirm.message && <p className="mt-2 text-[14px] text-muted">{confirm.message}</p>}
            <div className="mt-5 flex gap-3">
              <Button variant="soft" className="flex-1" onClick={() => close(false)} autoFocus>
                Ləğv et
              </Button>
              <Button variant={confirm.danger ? 'danger' : 'primary'} className={`flex-1 ${confirm.danger ? '!bg-expense !text-white' : ''}`} onClick={() => close(true)}>
                {confirm.confirmLabel ?? 'Təsdiqlə'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
