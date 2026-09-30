// Service worker: cache aplikacji (żeby appka w ogóle się otwierała offline)
// + cache kafelków mapy (żeby wcześniej przeglądany obszar był dostępny w terenie
// bez zasięgu). To nie jest pełne pre-pobieranie kafelków dla całego regionu —
// tylko to, co realnie zostało wyświetlone, zostaje zapamiętane.

const SHELL_CACHE = 'archemapa-shell-v6';
const TILE_CACHE = 'archemapa-tiles-v2';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/basemaps.js',
  './js/geosearch.js',
  './js/measure.js',
  './js/offline-download.js',
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
  return /tile\.openstreetmap\.org/.test(url) || /server\.arcgisonline\.com/.test(url) || /mapy\.geoportal\.gov\.pl/.test(url);
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
          // WAŻNE: kafelki ładowane przez <img> to zapytania w trybie
          // no-cors, więc odpowiedź jest "opaque" — zawsze ma res.ok===false
          // i status 0, NIEZALEŻNIE od tego, czy serwer faktycznie zwrócił
          // 200. Sprawdzanie res.ok tutaj (jak było wcześniej) oznaczało, że
          // NIC nigdy się nie zapisywało do cache, mimo że kafelki wyglądały
          // na poprawnie załadowane na ekranie. fetch() rzuciłby wyjątkiem
          // (łapiemy go niżej) przy prawdziwej awarii sieci — więc każda
          // odpowiedź, która tu dotarła, jest bezpieczna do zapisania.
          cache.put(req, res.clone());
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
