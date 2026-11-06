// Seraph offline downloads
// Pick games, save them to this browser, play them with no internet.
// Used by games/index.html (picker) and offline.html (library).
(function () {
    'use strict';

    const BASE = '/DNS---DefNotSeraph/';
    const INDEX_URL = BASE + 'storage/offline/index.json';
    const GAMES_CACHE = 'seraph-offline-games';
    const META_CACHE = 'seraph-offline-meta';
    const META_URL = BASE + '__offline/downloaded.json';
    const STORE_KEY = 'seraphOfflineGames';
    const PARALLEL = 6;

    // ---------- small helpers ----------
    function fmt(bytes) {
        if (!bytes) return '0 MB';
        if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
        return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function readStore() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    }
    function writeStore(s) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
    }
    function supported() {
        return 'caches' in window && 'serviceWorker' in navigator;
    }

    async function ensureWorker() {
        if (!('serviceWorker' in navigator)) return null;
        try {
            await navigator.serviceWorker.register(BASE + 'offline-worker.js');
            return await navigator.serviceWorker.ready;
        } catch (e) { return null; }
    }

    function isQuota(e) {
        return e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message || e)));
    }

    async function syncWorker() {
        try { await syncWorkerInner(); } catch (e) { /* storage full or worker missing: library still works */ }
    }

    async function syncWorkerInner() {
        // tell the worker which game folders are downloaded
        const store = readStore();
        const prefixes = Object.values(store).map((g) => g.prefix).filter(Boolean);
        const meta = await caches.open(META_CACHE);
        await meta.put(META_URL, new Response(JSON.stringify(prefixes), { headers: { 'Content-Type': 'application/json' } }));
        const reg = await navigator.serviceWorker.getRegistration(BASE);
        const sw = reg && (reg.active || reg.waiting || reg.installing);
        if (sw) sw.postMessage('refresh-downloads');
    }

    let indexCache = null;
    async function loadIndex() {
        if (indexCache) return indexCache;
        const res = await fetch(INDEX_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error('could not load the game list');
        indexCache = await res.json();
        return indexCache;
    }

    async function loadManifest(game) {
        const url = BASE + 'storage/offline/games/' + game.key + '.json';
        const res = await fetch(url);
        if (!res.ok) throw new Error('missing file list for ' + game.name);
        return { url, data: await res.json() };
    }

    async function fetchForCache(url, signal) {
        const sameOrigin = url.startsWith('/') || url.startsWith(location.origin);
        if (sameOrigin) {
            const res = await fetch(url, { signal, cache: 'no-cache' });
            if (!res.ok) throw new Error(res.status + ' ' + url);
            return res;
        }
        // library CDNs allow CORS; a real (non-opaque) copy also works for crossorigin/integrity tags
        try {
            const res = await fetch(url, { signal, mode: 'cors', credentials: 'omit' });
            if (res.ok) return res;
        } catch (e) { if (signal && signal.aborted) throw e; }
        return fetch(url, { signal, mode: 'no-cors' });
    }

    // ---------- download / remove ----------
    async function downloadGames(games, onProgress, signal) {
        if (!supported()) throw new Error('this browser does not support offline downloads');
        await ensureWorker();
        try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
        const cache = await caches.open(GAMES_CACHE);
        const total = games.reduce((a, g) => a + (g.size || 0), 0);
        let done = 0;
        let outOfSpace = false;
        const results = [];
        for (const game of games) {
            if ((signal && signal.aborted) || outOfSpace) break;
            onProgress({ game, done, total, phase: 'start' });
            let failed = [];
            try {
                const { url: murl, data } = await loadManifest(game);
                const files = data.files.slice();
                let i = 0;
                async function worker() {
                    while (i < files.length) {
                        if ((signal && signal.aborted) || outOfSpace) return;
                        const [url, size] = files[i++];
                        try {
                            const existing = await cache.match(url);
                            if (!existing) {
                                let res;
                                try { res = await fetchForCache(url, signal); }
                                catch (e) { if (signal && signal.aborted) return; res = await fetchForCache(url, signal); }
                                await cache.put(url, res);
                            }
                        } catch (e) {
                            if (isQuota(e)) { outOfSpace = true; failed.push(url); return; }
                            if (!(signal && signal.aborted)) failed.push(url);
                        }
                        done += size || 0;
                        onProgress({ game, done, total, phase: 'file' });
                    }
                }
                await Promise.all(Array.from({ length: PARALLEL }, worker));
                // keep the file list too, so the game can be removed later while offline
                await cache.put(murl, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
            } catch (e) {
                if (isQuota(e)) outOfSpace = true;
                failed.push(String(e.message || e));
            }
            if (signal && signal.aborted) break;
            const store = readStore();
            store[game.id] = {
                id: game.id, name: game.name, href: game.href, thumb: game.thumb, prefix: game.prefix,
                key: game.key, size: game.size, date: Date.now(), complete: failed.length === 0, missing: failed.length,
            };
            writeStore(store);
            await syncWorker();
            results.push({ game, failed });
        }
        return { results, outOfSpace };
    }

    async function removeGames(ids) {
        const store = readStore();
        const cache = await caches.open(GAMES_CACHE);
        const listFor = async (g) => {
            const murl = BASE + 'storage/offline/games/' + g.key + '.json';
            let res = await cache.match(murl);
            if (!res) { try { res = await fetch(murl); } catch (e) { res = null; } }
            if (!res || !res.ok) return { murl, files: [] };
            const data = await res.json();
            return { murl, files: data.files.map((f) => f[0]) };
        };
        const removedPrefixes = ids.map((id) => (store[id] || {}).prefix).filter(Boolean);
        const keepIds = Object.keys(store).filter((id) => !ids.includes(id));
        const keep = new Set();
        for (const id of keepIds) (await listFor(store[id])).files.forEach((f) => keep.add(f));
        for (const id of ids) {
            const g = store[id];
            if (!g) continue;
            const { murl, files } = await listFor(g);
            for (const f of files) if (!keep.has(f)) await cache.delete(f, { ignoreSearch: false });
            await cache.delete(murl);
            delete store[id];
        }
        // also drop files a game saved while it was being played
        const prefixes = removedPrefixes;
        if (prefixes.length) {
            for (const req of await cache.keys()) {
                const p = new URL(req.url).pathname;
                if (prefixes.some((pre) => p.startsWith(pre)) && !keep.has(p)) await cache.delete(req);
            }
        }
        writeStore(store);
        await syncWorker();
    }

    async function storageInfo() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const e = await navigator.storage.estimate();
                return { used: e.usage || 0, quota: e.quota || 0 };
            }
        } catch (e) {}
        return null;
    }

    // ---------- picker UI (games page) ----------
    const CSS = `
    .so-overlay{position:fixed;top:0;left:0;right:0;bottom:0;text-align:left;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
    .so-panel{width:min(820px,100%);height:min(86vh,900px);display:flex;flex-direction:column;background:var(--background-color,#000);color:var(--text-color,#fff);border:3px solid var(--border-color2,#fff);border-radius:16px;font-family:var(--font-family,'Ubuntu',sans-serif);overflow:hidden;box-shadow:0 0 30px var(--text-glow,#000)}
    .so-head{text-align:center;padding:16px 18px 10px;border-bottom:1px solid var(--border-color2,#fff)}
    .so-head h2{margin:0 0 4px;font-size:26px;font-weight:500}
    .so-head p{margin:0;opacity:.8;font-size:14px;line-height:1.35}
    .so-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .so-tools input,.so-tools select{flex:1 1 180px;min-width:0;padding:8px 12px;border-radius:999px;border:2px solid var(--border-color2,#fff);background:var(--background-color,#000);color:var(--text-color,#fff);font-family:inherit;font-size:15px}
    .so-tools select{flex:0 1 170px}
    .so-list{flex:1;overflow-y:auto;padding:6px 10px}
    .so-row{display:flex;align-items:center;gap:12px;padding:6px 8px;border-radius:10px;cursor:pointer;user-select:none}
    .so-row:hover{background:var(--hover-color,#1a1818)}
    .so-row input{all:revert;width:20px!important;min-width:20px!important;max-width:20px!important;height:20px!important;margin:0!important;padding:0!important;flex:0 0 20px!important;accent-color:var(--border-color2,#fff);cursor:pointer}
    .so-row img{width:72px;height:40px;object-fit:cover;border-radius:6px;flex:none;background:#222}
    .so-name{flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px}
    .so-size{flex:none;opacity:.75;font-size:13px;font-variant-numeric:tabular-nums}
    .so-tag{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid currentColor;opacity:.9}
    .so-tag.ok{color:#5fd068}.so-tag.part{color:#f0b429}
    .so-foot{border-top:1px solid var(--border-color2,#fff);padding:12px 18px;display:flex;flex-direction:column;gap:8px}
    .so-sum{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:14px}
    .so-sum b{font-weight:500}
    .so-bar{height:10px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden;display:none}
    .so-bar i{display:block;height:100%;width:0;background:var(--border-color2,#fff);transition:width .2s}
    .so-status{font-size:13px;opacity:.85;min-height:1em}
    .so-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .so-actions button,.so-btn{width:auto!important;max-width:none!important;padding:8px 16px!important;border-radius:999px;border:2px solid var(--border-color2,#fff);background:var(--background-color,#000);color:var(--text-color,#fff);font-family:inherit;font-size:15px;cursor:pointer}
    .so-actions button:hover,.so-btn:hover{background:var(--hover-color,#1a1818)}
    .so-actions button:disabled{opacity:.45;cursor:default}
    .so-actions .so-primary{background:var(--border-color2,#fff);color:var(--background-color,#000);font-weight:500}
    .so-empty{text-align:center;opacity:.7;padding:30px}
    .so-launch{display:inline-block;margin-top:10px}
    @media (max-width:560px){.so-overlay{padding:8px}.so-panel{height:92vh}.so-row img{width:52px;height:30px}.so-head{padding:12px 12px 8px}.so-head h2{font-size:20px}.so-head p{display:none}.so-tools{margin-top:8px}.so-tools input,.so-tools select{flex:1 1 100%;font-size:14px;padding:6px 10px}.so-foot{padding:10px 12px}.so-sum{font-size:12px}.so-actions{gap:6px}.so-actions button{padding:6px 10px!important;font-size:13px}.so-name{font-size:14px}.so-size{font-size:11px}}
    `;

    function injectCss() {
        if (document.getElementById('so-css')) return;
        const s = document.createElement('style');
        s.id = 'so-css';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    async function openPicker(preselectHref) {
        injectCss();
        const overlay = document.createElement('div');
        overlay.className = 'so-overlay';
        overlay.innerHTML = `
          <div class="so-panel" role="dialog" aria-label="download games for offline">
            <div class="so-head">
              <h2>download for offline</h2>
              <p>pick games to save in this browser. once downloaded they open from the <a href="${BASE}offline.html" style="color:inherit">offline library</a>, or straight from this page, with no internet.</p>
              <div class="so-tools">
                <input type="search" class="so-search" placeholder="search games" aria-label="search games">
                <select class="so-filter" aria-label="show">
                  <option value="all">all games</option>
                  <option value="selected">selected</option>
                  <option value="downloaded">downloaded</option>
                  <option value="small">under 20 MB</option>
                </select>
              </div>
            </div>
            <div class="so-list"><div class="so-empty">loading games…</div></div>
            <div class="so-foot">
              <div class="so-sum"><span><b class="so-count">0 selected</b> · <span class="so-total">0 MB</span></span><span class="so-space"></span></div>
              <div class="so-bar"><i></i></div>
              <div class="so-status"></div>
              <div class="so-actions">
                <button class="so-selall">select shown</button>
                <button class="so-clear">clear</button>
                <button class="so-remove" disabled>remove downloaded</button>
                <button class="so-close">close</button>
                <button class="so-go so-primary" disabled>download</button>
              </div>
            </div>
          </div>`;
        // attach outside <body>: the page animates body with a transform, which would break position:fixed
        document.documentElement.appendChild(overlay);
        const $ = (s) => overlay.querySelector(s);
        const list = $('.so-list');
        const selected = new Set();
        let games = [];
        let busy = null; // AbortController while downloading

        const close = () => {
            if (busy) { busy.abort(); }
            overlay.remove();
            document.removeEventListener('keydown', onKey);
            markDownloadedCards();
        };
        const onKey = (e) => { if (e.key === 'Escape' && !busy) close(); };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('click', (e) => { if (e.target === overlay && !busy) close(); });
        $('.so-close').addEventListener('click', close);

        if (!supported()) {
            list.innerHTML = '<div class="so-empty">this browser can\'t save games for offline play. try chrome, edge or firefox (not a private window).</div>';
            return;
        }

        try {
            const idx = await loadIndex();
            games = idx.games;
        } catch (e) {
            list.innerHTML = '<div class="so-empty">couldn\'t load the game list. check your connection and try again.</div>';
            return;
        }
        if (preselectHref) {
            const g = games.find((x) => x.href === preselectHref);
            if (g) selected.add(g.id);
        }

        async function refreshSpace() {
            const info = await storageInfo();
            $('.so-space').textContent = info && info.quota ? `space left: ${fmt(Math.max(0, info.quota - info.used))}` : '';
        }

        function render() {
            const q = $('.so-search').value.trim().toLowerCase();
            const f = $('.so-filter').value;
            const store = readStore();
            const shown = games.filter((g) => {
                if (q && !g.name.toLowerCase().includes(q)) return false;
                if (f === 'selected' && !selected.has(g.id)) return false;
                if (f === 'downloaded' && !store[g.id]) return false;
                if (f === 'small' && g.size > 20 * 1024 * 1024) return false;
                return true;
            });
            list.innerHTML = shown.length ? '' : '<div class="so-empty">no games match.</div>';
            const frag = document.createDocumentFragment();
            for (const g of shown) {
                const row = document.createElement('label');
                row.className = 'so-row';
                const s = store[g.id];
                const tag = s ? (s.complete ? '<span class="so-tag ok">downloaded</span>' : '<span class="so-tag part">partly downloaded</span>') : '';
                row.innerHTML = `<input type="checkbox" ${selected.has(g.id) ? 'checked' : ''}><img loading="lazy" alt="" src="${esc(g.thumb)}"><span class="so-name">${esc(g.name)}</span>${tag}<span class="so-size">${fmt(g.size)}</span>`;
                row.querySelector('input').addEventListener('change', (e) => {
                    e.target.checked ? selected.add(g.id) : selected.delete(g.id);
                    updateSummary();
                });
                row.dataset.id = g.id;
                frag.appendChild(row);
            }
            list.appendChild(frag);
            list._shown = shown;
            updateSummary();
        }

        function updateSummary() {
            const store = readStore();
            const sel = games.filter((g) => selected.has(g.id));
            const toGet = sel.filter((g) => !(store[g.id] && store[g.id].complete));
            const bytes = toGet.reduce((a, g) => a + g.size, 0);
            $('.so-count').textContent = `${sel.length} selected`;
            $('.so-total').textContent = toGet.length < sel.length ? `${fmt(bytes)} to download (${sel.length - toGet.length} already saved)` : `${fmt(bytes)} to download`;
            $('.so-go').disabled = !!busy || toGet.length === 0;
            $('.so-remove').disabled = !!busy || !sel.some((g) => store[g.id]);
        }

        $('.so-search').addEventListener('input', render);
        $('.so-filter').addEventListener('change', render);
        $('.so-selall').addEventListener('click', () => { (list._shown || []).forEach((g) => selected.add(g.id)); render(); });
        $('.so-clear').addEventListener('click', () => { selected.clear(); render(); });

        $('.so-remove').addEventListener('click', async () => {
            const store = readStore();
            const ids = games.filter((g) => selected.has(g.id) && store[g.id]).map((g) => g.id);
            if (!ids.length) return;
            $('.so-status').textContent = `removing ${ids.length} game${ids.length > 1 ? 's' : ''}…`;
            await removeGames(ids);
            $('.so-status').textContent = `removed ${ids.length} game${ids.length > 1 ? 's' : ''}.`;
            await refreshSpace();
            render();
        });

        $('.so-go').addEventListener('click', async () => {
            const store = readStore();
            const todo = games.filter((g) => selected.has(g.id) && !(store[g.id] && store[g.id].complete));
            if (!todo.length) return;
            const bytes = todo.reduce((a, g) => a + g.size, 0);
            const info = await storageInfo();
            if (info && info.quota && bytes > info.quota - info.used) {
                $('.so-status').textContent = `not enough space: need ${fmt(bytes)}, ${fmt(info.quota - info.used)} free. pick fewer games.`;
                return;
            }
            busy = new AbortController();
            const goBtn = $('.so-go');
            $('.so-close').textContent = 'cancel';
            $('.so-bar').style.display = 'block';
            updateSummary();
            let results = [];
            let outOfSpace = false;
            let crashed = null;
            try {
                const r = await downloadGames(todo, ({ game, done, total }) => {
                    const pct = total ? Math.min(100, (done / total) * 100) : 0;
                    $('.so-bar i').style.width = pct.toFixed(1) + '%';
                    $('.so-status').textContent = `downloading ${game.name}… ${fmt(done)} of ${fmt(total)}`;
                }, busy.signal);
                results = r.results;
                outOfSpace = r.outOfSpace;
            } catch (e) {
                crashed = e;
                outOfSpace = isQuota(e);
            }
            const cancelled = busy && busy.signal.aborted;
            busy = null;
            $('.so-close').textContent = 'close';
            goBtn.disabled = false;
            if (!overlay.isConnected) return;
            const bad = results.filter((r) => r.failed.length);
            const okCount = results.length - bad.length;
            if (outOfSpace) $('.so-status').textContent = `ran out of storage space. ${okCount} game${okCount === 1 ? '' : 's'} saved; the rest didn't fit. remove some downloads or pick smaller games.`;
            else if (crashed) $('.so-status').textContent = 'download failed: ' + (crashed.message || crashed);
            else if (cancelled) $('.so-status').textContent = `cancelled. ${results.length} game${results.length === 1 ? '' : 's'} saved before stopping.`;
            else if (bad.length) $('.so-status').textContent = `done, but ${bad.map((r) => r.game.name).join(', ')} ${bad.length > 1 ? 'are' : 'is'} missing some files (try again later).`;
            else $('.so-status').innerHTML = `all done! ${okCount} game${okCount === 1 ? '' : 's'} ready to play offline. <a href="${BASE}offline.html" style="color:inherit">open offline library</a>`;
            await refreshSpace();
            render();
        });

        render();
        refreshSpace();
        $('.so-search').focus();
    }

    // little "saved" marker on game cards that are downloaded
    function markDownloadedCards() {
        const store = readStore();
        const saved = new Set(Object.values(store).map((g) => g.href));
        document.querySelectorAll('.button-container > a').forEach((a) => {
            const btn = a.querySelector('.button');
            if (!btn) return;
            const href = a.getAttribute('href');
            let mark = btn.querySelector('.so-saved');
            if (saved.has(href)) {
                if (!mark) {
                    mark = document.createElement('span');
                    mark.className = 'so-saved';
                    mark.title = 'downloaded for offline';
                    mark.textContent = '⬇';
                    mark.style.cssText = 'position:absolute;top:6px;left:8px;z-index:2;font-size:16px;opacity:.9;text-shadow:0 0 4px #000';
                    btn.appendChild(mark);
                }
            } else if (mark) mark.remove();
        });
    }

    function setupGamesPage() {
        const host = document.getElementById('offlineDownloadSlot');
        if (host) {
            const b = document.createElement('button');
            b.className = 'so-btn';
            b.id = 'offlineDownloadButton';
            b.textContent = '⬇ download for offline';
            b.addEventListener('click', () => openPicker());
            host.appendChild(b);
        }
        // old per-game download icons now open the picker with that game ticked
        window.addEventListener('click', (e) => {
            const d = e.target.closest && e.target.closest('.download-button');
            if (!d) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const a = d.closest('a');
            openPicker(a ? a.getAttribute('href') : null);
        }, true);
        injectCss();
        markDownloadedCards();
        ensureWorker();
        const showOffline = () => {
            let n = document.getElementById('soOfflineNote');
            if (navigator.onLine) { if (n) n.remove(); return; }
            if (n || !host) return;
            n = document.createElement('p');
            n.id = 'soOfflineNote';
            n.style.cssText = 'margin:10px auto 0;max-width:520px;padding:8px 14px;border:2px solid var(--border-color2,#fff);border-radius:12px';
            n.innerHTML = `you're offline. only downloaded games will work — <a href="${BASE}offline.html" style="color:inherit">open your offline library</a>.`;
            host.appendChild(n);
        };
        window.addEventListener('online', showOffline);
        window.addEventListener('offline', showOffline);
        showOffline();
    }

    // ---------- offline library page ----------
    function setupLibrary(container) {
        injectCss();
        const store = readStore();
        let legacy = [];
        try { legacy = JSON.parse(localStorage.getItem('downloadedGames')) || []; } catch (e) {}
        const items = Object.values(store).sort((a, b) => a.name.localeCompare(b.name));
        const known = new Set(items.map((g) => g.href));
        legacy.forEach((g) => {
            if (!known.has(g.directory)) items.push({ id: 'legacy:' + g.directory, name: g.name, href: g.directory, thumb: g.thumbnail, legacy: true, complete: true });
        });
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = `<p style="opacity:.85">no games downloaded yet.${navigator.onLine ? ` go to <a href="${BASE}games/index.html" style="color:inherit">games</a> and press "download for offline".` : ' connect to the internet and use "download for offline" on the games page.'}</p>`;
            return;
        }
        for (const g of items) {
            const a = document.createElement('a');
            a.href = BASE + 'games/' + g.href;
            a.innerHTML = `<div class="button" style="background-image:url('${esc(g.thumb)}')"><h2>${esc(g.name)}</h2>${g.complete ? '' : '<span title="some files are missing" style="position:absolute;top:6px;left:10px;z-index:2">⚠</span>'}<span class="delete-button" title="remove download">✖</span></div>`;
            a.querySelector('.delete-button').addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!confirm(`remove ${g.name} from offline downloads?`)) return;
                if (g.legacy) {
                    const rest = legacy.filter((x) => x.directory !== g.href);
                    localStorage.setItem('downloadedGames', JSON.stringify(rest));
                } else {
                    await removeGames([g.id]);
                }
                setupLibrary(container);
            });
            container.appendChild(a);
        }
    }

    window.SeraphOffline = { openPicker, downloadGames, removeGames, setupLibrary, setupGamesPage, readStore, loadIndex };

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('offlineDownloadSlot')) setupGamesPage();
        const lib = document.getElementById('offlineLibrary');
        if (lib) setupLibrary(lib);
    });
})();
