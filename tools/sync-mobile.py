#!/usr/bin/env python3
"""Keep the mobile page (seraphim/index.html) and the "mobile friendly" filter
on the games page (games/index.html) in sync.

Run from the repo root after changing either one:

    python3 tools/sync-mobile.py

- a game with a tile on the mobile page gets the "mobile" tag in games/index.html
- a game tagged "mobile" in games/index.html gets a tile on the mobile page
  (a 200x200 labelled thumbnail is generated in seraphim/images/thumb/)
"""
import html, os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES = os.path.join(ROOT, 'games', 'index.html')
MOBILE = os.path.join(ROOT, 'seraphim', 'index.html')
THUMBS = os.path.join(ROOT, 'seraphim', 'images', 'thumb')
FONT = os.path.join(ROOT, 'storage', 'fonts', 'ubuntu', 'Ubuntu.ttf')
SITE = '/DNS---DefNotSeraph/'

CARD_RE = re.compile(r'(<a target="_blank" href="([^"]+)">\s*<div class="button" style="background-image: url\(\'([^\']+)\'\);"[^>]*?data-genre=")([^"]*)("[^>]*>\s*<h2>(.*?)</h2>)', re.S)


def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def thumb_file(thumb):
    if thumb.startswith(SITE):
        return os.path.join(ROOT, thumb[len(SITE):])
    if thumb.startswith('http'):
        return None
    return os.path.normpath(os.path.join(ROOT, 'games', thumb))


def make_tile(src, name, out):
    im = Image.open(src).convert('RGB') if src and os.path.isfile(src) else Image.new('RGB', (200, 200), (30, 30, 30))
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((200, 200), Image.LANCZOS)
    ov = Image.new('RGBA', (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle((0, 152, 200, 200), fill=(40, 40, 40, 190))
    im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    d = ImageDraw.Draw(im)
    size = 28
    while size > 12:
        f = ImageFont.truetype(FONT, size)
        if d.textlength(name, font=f) <= 188:
            break
        size -= 1
    tw = d.textlength(name, font=f)
    d.text(((200 - tw) / 2, 176 - size * 0.6), name, font=f, fill='white')
    im.save(out)


def main():
    games = read(GAMES)
    mobile = read(MOBILE)
    nl = '\r\n' if '\r\n' in mobile else '\n'

    cards = {}
    for m in CARD_RE.finditer(games):
        cards.setdefault(m.group(2), (m.group(3), html.unescape(re.sub(r'<[^>]+>', '', m.group(6))).strip(), m.group(4).split()))
    on_page = re.findall(r'href="' + re.escape(SITE) + r'games/([^"]+)"', mobile)

    # 1) mobile page -> filter tag
    tagged = []
    def tag(m):
        href, tags = m.group(2), m.group(4).split()
        if href in on_page and 'mobile' not in tags:
            tagged.append(cards[href][1])
            return m.group(1) + ' '.join(tags + ['mobile']) + m.group(5)
        return m.group(0)
    games = CARD_RE.sub(tag, games)

    # 2) filter tag -> mobile page tile
    added = []
    block = ''
    for href, (thumb, name, tags) in cards.items():
        if 'mobile' not in tags or href in on_page:
            continue
        slug = re.sub(r'[^a-z0-9]+', '-', href.rsplit('/', 1)[0].lower()).strip('-')
        fn = 'm-' + slug + '.png'
        make_tile(thumb_file(thumb), name, os.path.join(THUMBS, fn))
        block += (f'{nl}            <a href="{SITE}games/{href}" title="{html.escape(name)}">{nl}'
                  f'                <div class="button" style="background-image: url(\'images/thumb/{fn}\');"></div>{nl}'
                  f'            </a>{nl}')
        added.append(name)
    if block:
        # games grid ends right before the "apps" heading
        end = re.search(r'\s*</div>\s*<h2>apps</h2>', mobile)
        mobile = mobile[:end.start()] + nl + block.rstrip() + mobile[end.start():]

    write(GAMES, games)
    write(MOBILE, mobile)
    print('tagged mobile in filter:', len(tagged), tagged)
    print('added to mobile page:', len(added), added)


if __name__ == '__main__':
    main()
