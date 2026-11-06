#!/usr/bin/env python3
"""Build the file lists used by "download for offline" on the games page.

Run from the repo root after adding or changing games:

    python3 tools/build-offline-manifest.py [--crawl crawl.json]

For every game card in games/index.html it writes
storage/offline/games/<key>.json  ->  {"files": [[url, size_in_bytes], ...]}
and one summary list, storage/offline/index.json.

A game's files = everything in its folder
               + files outside the folder that its pages/scripts reference
               + the EmulatorJS core it uses (ROM games) / Ruffle (Flash games)
               + (optional) files recorded while actually loading the game in a
                 browser (--crawl), which catches files loaded dynamically.
"""
import argparse, html as htmlmod, json, os, posixpath, re, sys
from urllib.parse import urlparse, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = '/DNS---DefNotSeraph/'
GAMES = os.path.join(ROOT, 'games')
OUT = os.path.join(ROOT, 'storage', 'offline')

SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.github'}
SKIP_EXT = ('.map', '.psd', '.blend', '.xcf', '.aseprite', '.ase', '.kra', '.fla', '.sh', '.bat', '.py')
TEXT_EXT = ('.html', '.htm', '.js', '.mjs', '.css', '.json')

# EmulatorJS: which core file each system loads (non-threaded builds; GitHub Pages isn't cross-origin isolated)
EJS_CORES = {
    'nes': ['fceumm'], 'fceumm': ['fceumm'], 'nestopia': ['nestopia'],
    'snes': ['snes9x'], 'snes9x': ['snes9x'],
    'gb': ['gambatte'], 'gbc': ['gambatte'], 'gambatte': ['gambatte'],
    'gba': ['mgba'], 'mgba': ['mgba'],
    'segaMD': ['genesis_plus_gx'], 'segaMS': ['genesis_plus_gx'], 'segaGG': ['genesis_plus_gx'], 'genesis_plus_gx': ['genesis_plus_gx'],
    'n64': ['mupen64plus_next'], 'mupen64plus_next': ['mupen64plus_next'],
    'nds': ['melonds'], 'melonds': ['melonds'], 'desmume2015': ['desmume2015'],
    'psx': ['pcsx_rearmed'], 'pcsx_rearmed': ['pcsx_rearmed'],
    'atari2600': ['stella2014'], 'atari7800': ['prosystem'], 'lynx': ['handy'], 'vb': ['beetle_vb'],
    'arcade': ['fbneo'], 'mame2003': ['mame2003'],
}
EJS_DATA = 'storage/emulatorjs/data/'
RUFFLE = 'storage/ruffle/'

REF_RE = re.compile(r"""["'(`]((?:\.\./)+[^"'()`\s?#<>]+|/DNS---DefNotSeraph/[^"'()`\s?#<>]+)""")
EXT_RE = re.compile(r"""<(?:script|link)\b[^>]*?(?:src|href)=["'](https://[^"']+)["']""", re.I)
EXT_SKIP = re.compile(r"googletagmanager|google-analytics|doubleclick|googlesyndication|adsbygoogle|unpkg\.com/@ruffle-rs|fonts\.googleapis|fonts\.gstatic|cloudflareinsights|clarity\.ms|hotjar|facebook", re.I)
# only save outside files from well-known library CDNs (a game may need jquery/three.js from one of these)
EXT_ALLOW = re.compile(r"^https://(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com|code\.jquery\.com|cdn\.tailwindcss\.com|bootswatch\.com|cdn\.plot\.ly|stackpath\.bootstrapcdn\.com|maxcdn\.bootstrapcdn\.com|threejs\.org|cdn\.babylonjs\.com|code\.createjs\.com)/", re.I)
EJS_RE = re.compile(r"""EJS_core\s*=\s*["']([A-Za-z0-9_]+)["']""")


def site_url(rel_path):
    """repo-relative path -> URL path the browser requests"""
    return SITE + rel_path.replace(os.sep, '/')


def exists(rel):
    p = os.path.join(ROOT, rel)
    return os.path.isfile(p)


def size(rel):
    try:
        return os.path.getsize(os.path.join(ROOT, rel))
    except OSError:
        return 0


def walk(rel_dir):
    out = []
    base = os.path.join(ROOT, rel_dir)
    for dp, dn, fn in os.walk(base):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            if f == '.DS_Store' or f.lower().endswith(SKIP_EXT):
                continue
            out.append(os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, '/'))
    return out


def parse_cards():
    html = open(os.path.join(GAMES, 'index.html'), encoding='utf-8').read()
    cards = []
    for m in re.finditer(r'<a target="_blank" href="([^"]+)">\s*<div class="button" style="background-image: url\(\'([^\']+)\'\);"[^>]*>\s*<h2>(.*?)</h2>', html, re.S):
        href, thumb, name = m.group(1), m.group(2), htmlmod.unescape(re.sub(r'<[^>]+>', '', m.group(3))).strip()
        cards.append((href, thumb, name))
    seen, uniq = set(), []
    for c in cards:
        if c[0] not in seen:
            seen.add(c[0])
            uniq.append(c)
    return uniq


def resolve_thumb(thumb):
    if thumb.startswith('http'):
        return thumb, None
    if thumb.startswith('/'):
        rel = thumb[len(SITE):] if thumb.startswith(SITE) else thumb.lstrip('/')
    else:
        rel = posixpath.normpath(posixpath.join('games', thumb))
    return site_url(rel), rel


def build(crawl):
    cards = parse_cards()
    os.makedirs(os.path.join(OUT, 'games'), exist_ok=True)
    index = []
    for href, thumb, name in cards:
        game_dir = posixpath.normpath(posixpath.join('games', posixpath.dirname(href)))
        entry = posixpath.normpath(posixpath.join('games', href))
        files = {}

        def add(rel):
            rel = posixpath.normpath(unquote(rel))
            if rel.startswith('..') or not exists(rel):
                return False
            # other pages (e.g. a "back to games" link) are not part of this game
            if rel.lower().endswith(('.html', '.htm')) and not (rel.startswith(game_dir + '/') or rel == entry):
                return False
            files[site_url(rel)] = size(rel)
            return True

        if game_dir == 'games':          # a page sitting directly in games/: just that page + refs
            add(entry)
            own = [entry]
        else:
            own = walk(game_dir)
            for rel in own:
                add(rel)

        # references to files outside the folder (e.g. ../../storage/js/cloak.js)
        ejs_cores, uses_ruffle = set(), False
        for rel in own:
            if not rel.lower().endswith(TEXT_EXT):
                continue
            try:
                text = open(os.path.join(ROOT, rel), encoding='utf-8', errors='ignore').read()
            except OSError:
                continue
            if rel.lower().endswith(('.html', '.htm')):
                for ext in EXT_RE.findall(text):
                    if EXT_ALLOW.search(ext) and not EXT_SKIP.search(ext):
                        files.setdefault(ext, 0)
            if 'ruffle' in text.lower() and rel.lower().endswith(('.html', '.htm')):
                uses_ruffle = True
            for core in EJS_RE.findall(text):
                ejs_cores.add(core)
            for ref in REF_RE.findall(text):
                if ref.startswith(SITE):
                    target = ref[len(SITE):]
                else:
                    target = posixpath.normpath(posixpath.join(posixpath.dirname(rel), ref))
                if not target.startswith(game_dir + '/'):
                    add(target)

        if ejs_cores:
            for f in ('loader.js', 'emulator.min.js', 'emulator.min.css', 'version.json', 'emulator.js', 'emulator.css',
                      'GameManager.js', 'gamepad.js', 'nipplejs.js', 'shaders.js', 'storage.js'):
                add(EJS_DATA + f)
            for rel in walk(EJS_DATA + 'compression'):
                add(rel)
            for f in ('en.json', 'en-US.json'):
                add(EJS_DATA + 'localization/' + f)
            for core in ejs_cores:
                for c in EJS_CORES.get(core, [core]):
                    add(EJS_DATA + 'cores/' + c + '-wasm.data')
                    add(EJS_DATA + 'cores/' + c + '-legacy-wasm.data')

        if uses_ruffle:
            for rel in walk(RUFFLE):
                if rel.endswith(('.js', '.wasm', '.json')):
                    add(rel)

        # files seen while really loading the game
        for url in crawl.get(href, []):
            u = urlparse(url)
            if u.hostname in ('localhost', '127.0.0.1'):
                p = unquote(u.path)
                if p.startswith(SITE):
                    add(p[len(SITE):])
            elif u.scheme == 'https' and EXT_ALLOW.search(url) and not EXT_SKIP.search(url):
                files.setdefault(url, 0)

        thumb_url, thumb_rel = resolve_thumb(thumb)
        if thumb_rel:
            add(thumb_rel)

        key = re.sub(r'[^A-Za-z0-9._-]+', '_', href.rsplit('.', 1)[0])
        items = sorted(files.items())
        with open(os.path.join(OUT, 'games', key + '.json'), 'w', encoding='utf-8') as fh:
            json.dump({'href': href, 'files': [[u, s] for u, s in items]}, fh, separators=(',', ':'))
        total = sum(s for _, s in items)
        index.append({
            'id': href, 'href': href, 'key': key, 'name': name, 'thumb': thumb_url,
            'prefix': SITE + game_dir + '/', 'size': total, 'count': len(items),
        })

    index.sort(key=lambda g: g['name'].lower())
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump({'games': index}, fh, separators=(',', ':'))
    return index


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--crawl', help='json of {card href: [urls loaded]} from a browser crawl')
    args = ap.parse_args()
    crawl = json.load(open(args.crawl)) if args.crawl else {}
    idx = build(crawl)
    total = sum(g['size'] for g in idx)
    print(f'{len(idx)} games, {total / 1024 / 1024 / 1024:.2f} GB total, '
          f'largest: {max(idx, key=lambda g: g["size"])["name"]}')
