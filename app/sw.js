// Service worker: cache aplikacji (żeby appka w ogóle się otwierała offline)
// + cache kafelków mapy (żeby wcześniej przeglądany obszar był dostępny w terenie
// bez zasięgu). To nie jest pełne pre-pobieranie kafelków dla całego regionu —
// tylko to, co realnie zostało wyświetlone, zostaje zapamiętane.

const SHELL_CACHE = 'archemapa-shell-v3';
const TILE_CACHE = 'archemapa-tiles-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/basemaps.js',
  './js/home.js',
  './js/calibrate.js',
  './js/field.js',
  './js/db.js',
  './js/georef.js',
  './js/overlay-layer.js',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isTileRequest(url) {
  return /tile\.openstreetmap\.org/.test(url) || /server\.arcgisonline\.com/.test(url);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;

  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (url.startsWith(self.location.origin)) {
    // Network-first: gdy jest zasięg, appka zawsze bierze najnowszą wersję
    // plików (i odświeża nimi cache) — inaczej "cache-first" potrafi serwować
    // starą wersję appki w nieskończoność, dopóki treść sw.js się nie zmieni
    // (a to jedyny sygnał, po którym przeglądarka w ogóle sprawdza aktualizacje
    // service workera). Offline: spada na to, co ostatnio zapisane w cache.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
