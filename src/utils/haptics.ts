/**
 * Haptic feedback via the Vibration API where supported (Android/Chromium).
 * iOS Safari does not expose a vibration/haptics API to web apps, so this is a silent no-op there.
 */
export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(kind === 'light' ? 8 : kind === 'success' ? [10, 40, 10] : [20, 60, 20]);
  } catch {
    /* ignore */
  }
}
