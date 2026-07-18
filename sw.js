/*
 * Expense Manager — service worker.
 *
 * Network-first: when online, always fetch the latest files (so updates reach
 * installed home-screen apps automatically) and refresh the cache. When offline,
 * fall back to the cached copy so the app still launches. The cache is only an
 * offline safety net, never a reason to show a stale version.
 *
 * Bump CACHE_VERSION on any change to force old caches out.
 */
const CACHE_VERSION = "v3";
const CACHE = "expense-manager-" + CACHE_VERSION;
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "store.js",
  "app.js",
  "vendor/jspdf.umd.min.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only manage our own origin; let cross-origin calls (e.g. geocoding) pass through.
  if (url.origin !== location.origin) return;

  // Network-first, cache fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match("index.html") || caches.match("./"))
      )
  );
});
