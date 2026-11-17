'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Re-mounts on every navigation → page fade transition (disabled for reduced-motion users via MotionConfig).
 * Opacity only: a transform here would become the containing block for fixed elements (FABs).
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}
