// Seraph offline service worker (v2)
//
// - Games downloaded from the "download for offline" picker live in GAMES_CACHE
//   and are served cache-first, so they open instantly with or without internet.
// - Cache-buster query strings (e.g. file.json?12345) still match saved files.
// - While a downloaded game is played online, any extra files it fetches are
//   saved too, so later levels/songs keep working offline.
// - With no connection, any page that isn't saved falls back to the offline
//   library (offline.html).

const BASE = '/DNS---DefNotSeraph/';
const SHELL_CACHE = 'seraph-offline-shell-v2';
const GAMES_CACHE = 'seraph-offline-games';
const META_CACHE = 'seraph-offline-meta';
const META_URL = BASE + '__offline/downloaded.json';

const SHELL_FILES = [
    BASE + 'offline.html',
    BASE + 'storage/js/offline.js',
    BASE + 'images/backgrounds/seraph/offlinebg.jpg',
    BASE + 'images/ico.ico',
    BASE + 'storage/fonts/ubuntu/Ubuntu.woff2',
];

let downloadedPrefixes = null;

async function loadPrefixes() {
    try {
        const cache = await caches.open(META_CACHE);
        const res = await cache.match(META_URL);
        downloadedPrefixes = res ? await res.json() : [];
    } catch (e) {
        downloadedPrefixes = [];
    }
    return downloadedPrefixes;
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // add one by one so a single missing file can't break the install
        await Promise.all(SHELL_FILES.map(async (url) => {
            try {
                const res = await fetch(url, { cache: 'reload' });
                if (res.ok) await cache.put(url, res);
            } catch (e) { /* offline during install: keep going */ }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = [SHELL_CACHE, GAMES_CACHE, META_CACHE, 'game-cache'];
        const names = await caches.keys();
        await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
        await loadPrefixes();
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'refresh-downloads') {
        event.waitUntil(loadPrefixes());
    }
});

function pathOf(u) {
    try { return new URL(u).pathname; } catch (e) { return ''; }
}

function belongsToDownloadedGame(request) {
    if (!downloadedPrefixes || downloadedPrefixes.length === 0) return false;
    const p = pathOf(request.url);
    const r = pathOf(request.referrer || '');
    return downloadedPrefixes.some((pre) => p.startsWith(pre) || (r && r.startsWith(pre)));
}

async function fromCaches(request) {
    const games = await caches.open(GAMES_CACHE);
    let hit = await games.match(request);
    if (!hit && new URL(request.url).search) hit = await games.match(request, { ignoreSearch: true });
    return hit;
}

async function handle(request) {
    // 1) downloaded files: cache first
    const saved = await fromCaches(request);
    if (saved) return saved;

    // 2) network
    try {
        const response = await fetch(request);
        if (downloadedPrefixes === null) await loadPrefixes();
        if (response.ok && response.status !== 206 && new URL(request.url).origin === self.location.origin && belongsToDownloadedGame(request)) {
            const copy = response.clone();
            caches.open(GAMES_CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return response;
    } catch (err) {
        // 3) offline: anything we have saved anywhere, then the offline library
        const any = (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
        if (any) return any;
        if (request.mode === 'navigate') {
            const lib = await caches.match(BASE + 'offline.html');
            if (lib) return lib;
        }
        return Response.error();
    }
}

// <audio>/<video> ask for byte ranges; answer them from saved files when we have them
async function handleRange(request) {
    const saved = (await fromCaches(request)) || (await caches.match(request.url, { ignoreSearch: true }));
    if (!saved || saved.type === 'opaque') return fetch(request);
    const buf = await saved.arrayBuffer();
    const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
    const size = buf.byteLength;
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (m && !m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
    end = Math.min(end, size - 1);
    if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
            'Content-Type': saved.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
        },
    });
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method === 'HEAD') {
        // some loaders (EmulatorJS) ask for a file's size first
        event.respondWith((async () => {
            const asGet = new Request(request.url);
            const saved = (await fromCaches(asGet)) || (await caches.match(request.url, { ignoreSearch: true }));
            if (saved) return new Response(null, { status: 200, headers: saved.headers });
            return fetch(request);
        })());
        return;
    }
    if (request.method !== 'GET') return;
    if (request.headers.has('range')) {
        event.respondWith(handleRange(request).catch(() => fetch(request)));
        return;
    }
    event.respondWith(handle(request));
});
