'use client';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import type { ReactNode } from 'react';
import { haptic } from '@/utils/haptics';
import { cn } from '@/utils/cn';

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  className: string; // background + text colour
  onTrigger: () => void;
}

const THRESHOLD = 88;

/**
 * Horizontal swipe row: swipe right triggers `left` action, swipe left triggers `right` action.
 * Vertical scrolling stays native (touch-action: pan-y).
 */
export function SwipeRow({ children, left, right, className }: { children: ReactNode; left?: SwipeAction; right?: SwipeAction; className?: string }) {
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const rightOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);

  return (
    <div className={cn('relative overflow-hidden rounded-2xl', className)}>
      {left && (
        <motion.div style={{ opacity: leftOpacity }} className={cn('absolute inset-0 flex items-center gap-2 pl-5 text-[14px] font-semibold', left.className)} aria-hidden>
          {left.icon}
          {left.label}
        </motion.div>
      )}
      {right && (
        <motion.div style={{ opacity: rightOpacity }} className={cn('absolute inset-0 flex items-center justify-end gap-2 pr-5 text-[14px] font-semibold', right.className)} aria-hidden>
          {right.label}
          {right.icon}
        </motion.div>
      )}
      <motion.div
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: right ? -140 : 0, right: left ? 140 : 0 }}
        dragElastic={0.15}
        dragSnapToOrigin={false}
        onDragEnd={(_, info) => {
          const dx = info.offset.x;
          if (left && dx > THRESHOLD) {
            haptic('success');
            left.onTrigger();
          } else if (right && dx < -THRESHOLD) {
            haptic('light');
            right.onTrigger();
          }
          animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
