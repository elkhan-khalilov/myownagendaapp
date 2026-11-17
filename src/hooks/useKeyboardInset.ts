'use client';
import { useEffect, useState } from 'react';

/**
 * On iOS the on-screen keyboard overlays the layout viewport instead of resizing it.
 * visualViewport tells us how much is covered so sheets can lift their content above it.
 */
export function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  const [viewport, setViewport] = useState<number | null>(null);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(covered > 60 ? covered : 0);
      setViewport(vv.height);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);
  return { inset, viewport };
}

/** Scroll a focused field into view after the keyboard animation */
export function scrollFocusedIntoView(e: React.FocusEvent) {
  const el = e.target as HTMLElement;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
}
