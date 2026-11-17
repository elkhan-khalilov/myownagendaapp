let registration: ServiceWorkerRegistration | null = null;

/**
 * Registers the service worker and wires the update flow:
 * a new version installs in the background, waits, and is activated only when the user taps "Yenilə".
 * IndexedDB data is never touched by updates.
 */
export async function registerServiceWorker(onUpdateReady: (apply: () => void) => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;
  try {
    const hadController = !!navigator.serviceWorker.controller;
    registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

    const notify = (w: ServiceWorker) => onUpdateReady(() => w.postMessage({ type: 'SKIP_WAITING' }));
    if (registration.waiting && navigator.serviceWorker.controller) notify(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const w = registration?.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w);
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return; // first install: no reload needed
      reloading = true;
      window.location.reload();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    });
  } catch {
    console.warn('[pwa] service worker registration failed');
  }
}

export async function checkForUpdate() {
  try {
    await registration?.update();
  } catch {
    /* offline or unsupported */
  }
}
