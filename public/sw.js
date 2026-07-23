// Auto Palette service worker — registered by src/app/main.tsx (customer app) AND
// src/admin/main.tsx (Wave 2: admin + all 5 employees install /admin/ the same way).
// Strategy: NETWORK-first for navigations/HTML (falling back to cache when offline),
// cache-first for hashed immutable assets (/assets/, /icons/).
//
// The HTML must never be cache-first: every deploy renames the hashed chunks, so a
// cached shell pointing at deleted chunk files bricks the app until the cache is
// purged (this exact failure shipped in v2 and broke /app/ on desktop, 2026-07-23).
// Hashed assets are safe to cache forever — new HTML always references new names.

const CACHE_NAME = 'autopalette-app-shell-v3';
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

/** Immutable-by-name files only — NEVER the HTML shells (see header comment). */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest-admin.webmanifest'
  );
}

/** Cached shell to serve when a navigation fails offline. */
function offlineShellFor(url) {
  if (url.pathname.startsWith('/admin')) return '/admin/';
  if (url.pathname.startsWith('/app')) return '/app/';
  return null;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin (Firestore, fonts, etc.)

  if (request.mode === 'navigate') {
    // Network-first for every page load: online users always get the CURRENT shell
    // (whose hashed asset names always exist on the CDN); offline falls back to cache.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            const shell = offlineShellFor(url);
            return shell ? caches.match(shell) : Response.error();
          })
        )
    );
    return;
  }

  if (isImmutableAsset(url)) {
    // Cache-first: hashed filenames change on every deploy, so a cache hit is always correct.
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
