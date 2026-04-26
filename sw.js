/* ══════════════════════════════════════════
   sw.js — Service Worker für Offline-Support
   Cached bei der Installation alle App-Dateien.
   Beim Update: Version unten hochzählen (vX.Y).
   ══════════════════════════════════════════ */

const VERSION = 'hound-v21-1';   // ⬅ bei jedem Release inkrementieren

const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',

  // CSS
  'css/base.css',
  'css/splash.css',
  'css/menu.css',
  'css/home.css',
  'css/cam.css',

  // JS
  'js/state.js',
  'js/util.js',
  'js/alarm.js',
  'js/sensors.js',
  'js/camera.js',
  'js/ar.js',
  'js/map.js',
  'js/navigation.js',
  'js/mark.js',
  'js/home.js',
  'js/splash.js',
  'js/app.js',

  // Leaflet: wird per CDN geladen und zur Laufzeit gecacht (siehe fetch-Handler unten)

  // Icons
  'assets/icons/pin-generic.png',
  'assets/icons/anschuss.png',
  'assets/icons/hochsitz.png',
  'assets/icons/auto.png',
  'assets/icons/track.png',
  'assets/icons/wolfpack.png',
  'assets/icons/splash-dog.png',
];

// ── Install: App-Shell cachen ───────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: alte Caches aufräumen ─────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache-First für App-Shell,
//    Network-First für Kartenkacheln ────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // OpenStreetMap Kacheln: Netz first, fallback auf Cache
  // (so werden neu angesehene Kacheln automatisch beim ersten Laden gecacht)
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(VERSION + '-tiles').then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Leaflet vom CDN (unpkg): Cache first, Netz als Fallback.
  // Beim ersten Besuch wird die Datei heruntergeladen + gecacht,
  // danach funktioniert die Karte auch offline.
  if (url.hostname === 'unpkg.com') {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION + '-cdn').then(c => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // App-Shell: Cache first, Netz als Fallback
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).catch(() => {
      // Komplett offline UND nichts im Cache → erstmaliger Offline-Aufruf
      // Minimal-Antwort damit nichts crasht
      if (req.destination === 'document') {
        return caches.match('index.html');
      }
    }))
  );
});
