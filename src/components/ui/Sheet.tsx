'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { scrollFocusedIntoView, useKeyboardInset } from '@/hooks/useKeyboardInset';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  dark?: boolean;
}

export function Sheet({ open, onClose, title, children, footer, tall, dark }: SheetProps) {
  const { inset, viewport } = useKeyboardInset(open);
  const kbOpen = inset > 0 && viewport !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            className="absolute inset-0 bg-[#0b1629]/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              'relative flex w-full max-w-[480px] flex-col rounded-t-[28px] shadow-2xl',
              dark ? 'bg-navy-deep text-white' : 'bg-card text-ink',
              tall && !kbOpen ? 'h-[92dvh]' : 'max-h-[88dvh]',
            )}
            style={kbOpen ? { marginBottom: inset, maxHeight: viewport! - 8, height: tall ? viewport! - 8 : undefined } : undefined}
            onFocusCapture={scrollFocusedIntoView}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex justify-center pt-2.5">
              <div className={cn('h-1.5 w-10 rounded-full', dark ? 'bg-white/25' : 'bg-line')} />
            </div>
            {title !== undefined && (
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <h2 className="text-[19px] font-bold">{title}</h2>
                <button
                  onClick={onClose}
                  aria-label="Bağla"
                  className={cn('grid h-9 w-9 place-items-center rounded-full', dark ? 'bg-white/10' : 'bg-soft text-muted')}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              {children}
            </div>
            {footer && (
              <div className={cn('border-t px-5 pt-3', kbOpen ? 'pb-3' : 'pb-safe-3', dark ? 'border-white/10' : 'border-line')}>{footer}</div>
            )}
            {!footer && <div className={kbOpen ? 'pb-2' : 'pb-safe-2'} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
