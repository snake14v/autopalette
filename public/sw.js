// Auto Palette service worker — registered by src/app/main.tsx (customer app) AND
// src/admin/main.tsx (Wave 2: admin + all 5 employees install /admin/ the same way).
// Strategy: cache-first for the app shells (/app/, /admin/ + built assets), network-first
// for everything else (so booking/tracking/job-card data is never served stale when online).

const CACHE_NAME = 'autopalette-app-shell-v2';
const APP_SHELL = [
  '/app/',
  '/admin/',
  '/manifest.webmanifest',
  '/manifest-admin.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isAppShellRequest(url) {
  return (
    url.pathname.startsWith('/app/') ||
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest-admin.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin (Firestore, fonts, etc.)

  if (isAppShellRequest(url)) {
    // Cache-first: fast repeat loads of the shell, fall back to network then cache the result.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Network-first for everything else (booking/tracking data, marketing pages, admin).
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
