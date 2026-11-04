const CACHE_VERSION = 'v0.7';

const PRECACHE_URLS = [
  './',
  './index.html',
  './og-image.jpg',
  './src/main.js',
  './src/game.js',
  './src/engine.js',
  './src/config.js',
  './src/simulation.js',
  './src/economy.js',
  './src/progression.js',
  './src/events.js',
  './src/agent.js',
  './src/visitor.js',
  './src/project.js',
  './src/recruitment.js',
  './src/map.js',
  './src/floorplan.js',
  './src/build-mode.js',
  './src/rotation.js',
  './src/pathfinding.js',
  './src/audio.js',
  './src/sfx.js',
  './src/ai-ceo.js',
  './src/renderer/index.js',
  './src/renderer/floor.js',
  './src/renderer/walls.js',
  './src/renderer/furniture.js',
  './src/renderer/agents.js',
  './src/renderer/effects.js',
  './src/renderer/minimap.js',
  './src/renderer/primitives.js',
  './src/ui/panels.js',
  './src/ui/build-panel.js',
  './src/ui/equipment-panel.js',
  './src/ui/hud-popover.js',
  './src/ui/speed.js',
  './src/ui/toast.js',
  './src/ui/intro.js',
  './src/ui/cashflow-graph.js',
  './src/ui/floating-chart.js',
  './src/ui/analytics-panel.js',
  './src/ui/strategy-panel.js',
  './src/ui/loan.js',
  './assets/office-bgm.mp3',
  './assets/jazz-bgm.mp3',
  './assets/chill-lobby-bgm.mp3',
  './assets/transport-bgm.mp3',
];

const isLocalhost = self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  if (isLocalhost) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open tabs to reload with the new version
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  // No caching on localhost
  if (isLocalhost) return;

  const url = new URL(event.request.url);

  // Network-first for external API calls (AI CEO advisor)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
