/* MyAgenda service worker — caches the app shell only.
 * User data lives in IndexedDB and is never stored in Cache Storage. */
const BUILD = '__BUILD_VERSION__';
const VERSION = 'myagenda-' + BUILD;
const ASSETS = [] /*__PRECACHE__*/;
const SHELL = ['/', '/agenda/', '/budget/', '/notes/', '/settings/', '/reports/', '/manifest.webmanifest', '/offline.html',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  // Do not skipWaiting automatically: the page asks the user first (see src/pwa/register.ts)
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      Promise.all(
        [...SHELL, ...ASSETS].map(async (url) => {
          const res = await fetch(url, { cache: 'reload' });
          if (!res.ok) throw new Error('precache failed: ' + url);
          // Hosts with "clean URLs" may redirect (e.g. /offline.html → /offline). A redirected
          // response cannot be used for navigations, so store a fresh copy of the body.
          const clean = res.redirected ? new Response(await res.blob(), { status: 200, headers: res.headers }) : res;
          await cache.put(url, clean);
        }),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('myagenda-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API calls (auth, sync) always go to the network and are never cached
  if (url.pathname.startsWith('/api/')) return;

  // Hashed build assets: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // Navigations & other same-origin GETs: network-first, fall back to cached shell
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (req.mode === 'navigate' || url.pathname.endsWith('.txt'))) {
        const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(async () => {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await caches.match('/offline.html')) || (await caches.match('/')) || Response.error();
      return Response.error();
    }),
  );
});
