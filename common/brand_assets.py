"""Logo and banners for "What the Noise Remembers" (original artwork; not the Moth Quantum logo).

The emblem: a moth built from ink squares. Its left wing is whole (the signal). Its right wing comes
apart: the tiles open up, shrink and drift up and out (the noise), toward one small orange tile of light.

One tile map drives every output, so the SVG and the PNGs always match:
  assets/logo.svg          hand-readable SVG, 512 viewBox, one path per colour
  assets/logo.png          512 x 512, transparent
  assets/logo-1024.png     1024 x 1024, transparent
  assets/logo-dark.svg/png the same emblem in light ink, for GitHub's dark theme (<picture> source)
  assets/banner.png        1280 x 640 social preview (GitHub's size)
  assets/banner-wide.png   1600 x 400 README header

Usage: python common/brand_assets.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"

INK = "#19238E"
INK2 = "#545BA9"
INK3 = "#A1A4CE"
TINT = "#D3D3E6"
RULE = "#D3D3E6"
PAPER = "#FBFAF9"
ORANGE = "#B4541A"
DARK_MAP = {INK: "#D3D3E6", ORANGE: "#D0692B"}   # dark-theme emblem: light ink, slightly brighter light

FONTS = "C:/Windows/Fonts/"

# ---------------------------------------------------------------------------------------------------
# The moth. Left half, 16 columns; column 15 touches the mirror axis (columns 15 and 16 are the centre).
# K = ink tile, w = a window in the wing (left empty), . = nothing.
LEFT = """
................
..........K.....
..........KK....
...........KK...
KK..........KK..
KKKK.........K..
KKKKKK........KK
KKKKKKKKK......K
.KKKKKKKKKK...KK
.KKKKKKKKKKKK.KK
..KKKKKKKKKKK.KK
..KKKKKwwKKKK.KK
...KKKKwwKKKK.KK
...KKKKKKKKKK.KK
....KKKKKKKKK..K
....KKKKKKKKK.KK
.....KKKKK....KK
......KK..KKK.KK
........KKKKK.KK
.....KKKKKKKK.KK
....KKKKKKKKK.KK
....KKKKKwwKK..K
....KKKKKKKKK..K
.....KKKKKKKK..K
......KKKKKK...K
.......KKKK....K
...............K
"""

CELL = 13                 # px per tile at 512 (26 at 1024)
V = 512 / CELL            # canvas side in tile units
GX = 48 / CELL            # grid offsets, chosen so tile edges land on whole pixels
GY = 91 / CELL
MARGIN = 1.9              # keep drifting tiles this far from the canvas edge (tile units)
SEED = 21
DRIFT = (0.75, -1.25)     # direction the loose tiles travel (up and out, toward the light)
MAX_D = 6.0               # how far the loosest tiles travel (tiles)
LIGHT = (V - 8.4, 6.6)    # centre of the orange tile
RADIUS = 18.9             # loose tiles stay inside this circle, so a round avatar crop keeps them


def _parse():
    rows = LEFT.strip("\n").split("\n")
    ink = {(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == "K"}
    return ink


def _mirror(s):
    return {(31 - x, y) for (x, y) in s}


def emblem(seed=SEED, drift=DRIFT, max_d=MAX_D, t0=0.12, t1=0.42, p=1.7, drop=0.30,
           min_s=0.32, spread=0.5, light=LIGHT, radius=RADIUS):
    """Return the emblem as squares (cx, cy, size, colour) in tile units on a V x V canvas."""
    rnd = random.Random(seed)
    ink = _parse()
    body = {(x, y) for (x, y) in ink if x >= 14}
    right_wing = _mirror(ink) - _mirror(body)
    sq, occ = [], []

    def put(cx, cy, s, c):
        sq.append((cx, cy, s, c))
        occ.append((cx, cy, s))

    def free(cx, cy, s, pad=0.12):
        return all(abs(ox - cx) >= (os_ + s) / 2 + pad or abs(oy - cy) >= (os_ + s) / 2 + pad
                   for (ox, oy, os_) in occ)

    for (x, y) in sorted(ink | _mirror(body)):                 # whole moth: left wings + body
        put(x + 0.5 + GX, y + 0.5 + GY, 1.0, INK)
    sx, sy = light                                             # the light
    L = math.hypot(*drift)
    dx, dy = drift[0] / L, drift[1] / L
    loose = []
    for (x, y) in sorted(right_wing):
        t = (x - 18) / 13 + rnd.uniform(-0.06, 0.06)            # 0 at the body, 1 at the wing tip
        cx, cy = x + 0.5 + GX, y + 0.5 + GY
        if t < t0:
            put(cx, cy, 1.0, INK)                              # still whole
        elif t < t1:
            a = (t - t0) / (t1 - t0)
            put(cx, cy, 0.84 if a < 0.5 else 0.78, INK)        # gaps open up
        elif rnd.random() >= drop * (t - t1) / (1 - t1):
            loose.append(((t - t1) / (1 - t1), cx, cy))       # comes loose
    for (u, cx, cy) in sorted(loose):
        for _ in range(10):
            d = max_d * u ** p * rnd.uniform(0.6, 1.3) + rnd.uniform(0.0, 0.5) * u
            a = rnd.uniform(-spread, spread) * (0.4 + u)
            vx, vy = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
            nx, ny = cx + vx * d, cy + vy * d
            s = max(min_s, 0.78 * (1 - 0.65 * u * rnd.uniform(0.75, 1.0)))
            inside = math.hypot(nx - V / 2, ny - V / 2) + s * 0.71 < radius   # stays in a round avatar
            if (MARGIN < nx < V - MARGIN and MARGIN < ny < V - MARGIN and inside
                    and math.hypot(nx - sx, ny - sy) > 1.4 and free(nx, ny, s)):
                put(nx, ny, s, INK)
                break
    sq.append((sx, sy, 1.0, ORANGE))
    return sq


def to_rects(squares, k):
    """Squares -> whole-pixel rects (x0, y0, x1, y1, colour, solid) at k px per tile."""
    out = []
    for (cx, cy, s, c) in squares:
        h = s / 2
        out.append((round((cx - h) * k), round((cy - h) * k), round((cx + h) * k), round((cy + h) * k), c, s >= 1.0))
    return out


def draw_emblem(k, colour_map=None, bg=None):
    size = math.ceil(V * k)
    img = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for (x0, y0, x1, y1, c, _) in to_rects(emblem(), k):
        d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=(colour_map or {}).get(c, c))
    return img


def _merge_solid(rects):
    """Greedy merge of whole tiles (same colour) into larger rectangles, to keep the SVG small and seamless."""
    cells = {}
    for (x0, y0, x1, y1, c, solid) in rects:
        if solid and c == INK:
            cells[(x0, y0)] = (x1 - x0, y1 - y0)
    used, merged = set(), []
    for (x0, y0) in sorted(cells, key=lambda p: (p[1], p[0])):
        if (x0, y0) in used:
            continue
        w, h = cells[(x0, y0)]
        x1 = x0 + w
        while (x1, y0) in cells and (x1, y0) not in used:
            x1 += w
        y1 = y0 + h
        while all((x, y1) in cells and (x, y1) not in used for x in range(x0, x1, w)):
            y1 += h
        for x in range(x0, x1, w):
            for y in range(y0, y1, h):
                used.add((x, y))
        merged.append((x0, y0, x1, y1))
    return merged


def write_svg(path, colour_map=None):
    cm = colour_map or {}
    rects = to_rects(emblem(), CELL)
    whole = _merge_solid(rects)
    loose = [r for r in rects if not (r[5] and r[4] == INK) and r[4] == INK]
    light = [r for r in rects if r[4] == ORANGE][0]

    def sub(x0, y0, x1, y1):
        return f"M{x0} {y0}h{x1 - x0}v{y1 - y0}h{x0 - x1}z"

    ink = cm.get(INK, INK)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="t d">
  <title id="t">What the Noise Remembers</title>
  <desc id="d">A moth made of ink squares. Its right wing comes apart into noise that drifts toward a small orange light.</desc>
  <!-- the moth, whole: wings, body and the near half of the right wing (the signal) -->
  <path fill="{ink}" d="{"".join(sub(*r) for r in whole)}"/>
  <!-- the right wing coming apart (the noise) -->
  <path fill="{ink}" d="{"".join(sub(*r[:4]) for r in loose)}"/>
  <!-- the light -->
  <rect x="{light[0]}" y="{light[1]}" width="{light[2] - light[0]}" height="{light[3] - light[1]}" fill="{cm.get(ORANGE, ORANGE)}"/>
</svg>
'''
    path.write_text(svg, encoding="utf-8")


# ---------------------------------------------------------------------------------------------------
# Banners

PIECES = [
    # (image, crop centre x, y as fractions, crop side as fraction of the shorter side)
    ("submission/01-penrose-hole/HERO_01-penrose-hole.png", 0.50, 0.50, 0.62),
    ("submission/04-magic-angle/HERO_04-magic-angle.png", 0.27, 0.27, 0.46),
    ("submission/13-moth-to-flame/HERO_13-moth-to-flame.png", 0.30, 0.40, 0.55),
    ("submission/03-moth-eye/HERO_03-moth-eye.png", 0.50, 0.45, 0.62),
    ("submission/15-tissue-blur/HERO_15-tissue-blur.png", 0.42, 0.50, 0.70),
    ("submission/18-oldest-light/HERO_18-oldest-light.png", 0.63, 0.40, 0.46),
    ("submission/19-frog-chorus/HERO_19-frog-chorus.png", 0.30, 0.40, 0.60),
    ("submission/07-flavour/HERO_07-flavour.png", 0.50, 0.30, 0.55),
]


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def crop_square(path, fx, fy, fs, size):
    im = Image.open(ROOT / path).convert("RGB")
    w, h = im.size
    side = fs * min(w, h)
    cx, cy = fx * w, fy * h
    x0 = min(max(0, cx - side / 2), w - side)
    y0 = min(max(0, cy - side / 2), h - side)
    return im.crop((round(x0), round(y0), round(x0 + side), round(y0 + side))).resize((size, size), Image.LANCZOS)


def framed(img, mat=4):
    """thin rule frame with a paper mat"""
    w, h = img.size
    f = Image.new("RGB", (w + 2 * mat + 2, h + 2 * mat + 2), PAPER)
    ImageDraw.Draw(f).rectangle([0, 0, f.width - 1, f.height - 1], outline=RULE, width=1)
    f.paste(img, (mat + 1, mat + 1))
    return f


def emblem_bbox(k):
    """visible bounds of the emblem's tiles (x0, y0, x1, y1) inside its canvas at k px per tile"""
    r = to_rects(emblem(), k)
    return min(a[0] for a in r), min(a[1] for a in r), max(a[2] for a in r), max(a[3] for a in r)


def put_line(d, x, cap_top, s, f, fill, tracking=0.0):
    """draw a line of text with the top of its capitals at cap_top; return its baseline y"""
    y = cap_top - f.getbbox("H")[1]
    if tracking:
        for ch in s:
            d.text((x, y), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) + tracking
    else:
        d.text((x, y), s, font=f, fill=fill)
    return y + f.getmetrics()[0]


def cap_h(f):
    b = f.getbbox("H")
    return b[3] - b[1]


def text_block(d, x, top, lines):
    """lines: (text, font, colour, gap_from_previous_baseline_to_this_cap_top, tracking)"""
    base = top
    for i, (s, f, c, gap, tr) in enumerate(lines):
        ct = top if i == 0 else base + gap
        base = put_line(d, x, ct, s, f, c, tr)
    return base


def block_height(lines):
    h = 0
    for i, (s, f, c, gap, tr) in enumerate(lines):
        h += cap_h(f) + (gap if i else 0)
    return h


TAGLINE = "SIGNAL  →  NOISE  →  REBUILT"
SUBTITLE = "22 playable quantum pieces · Moth Hack 2026"
PROOF = "Real Atlas jobs · IBM ibm_fez up to 156 qubits"


def banner():
    W, H = 1280, 640
    M = 72
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    lines = [
        (TAGLINE, font("consola.ttf", 19), ORANGE, 0, 2.2),
        ("What the Noise", font("seguisb.ttf", 84), INK, 34, 0),
        ("Remembers", font("seguisb.ttf", 84), INK, 36, 0),
        (SUBTITLE, font("segoeui.ttf", 30), INK2, 40, 0),
        (PROOF, font("consola.ttf", 22), INK, 22, 0),
    ]
    top = 84
    bh = block_height(lines)
    mid = top + bh / 2
    # emblem: 9 px tiles, its visible tiles left-aligned to the margin and centred on the text block
    k = 9
    em = draw_emblem(k)
    bx0, by0, bx1, by1 = emblem_bbox(k)
    ex = M - bx0
    ey = round(mid - (by0 + by1) / 2)
    img.paste(em, (ex, ey), em)
    tx = ex + bx1 + 44
    text_block(d, tx, top, lines)
    # strip of real piece images, with a hairline rule above
    n, gap = len(PIECES), 16
    fw = (W - 2 * M - (n - 1) * gap) // n
    side = fw - 10
    sy = H - 60 - fw
    d.line([(M, sy - 24), (W - M - 1, sy - 24)], fill=RULE, width=1)
    x = M
    for (p, fx, fy, fs) in PIECES:
        img.paste(framed(crop_square(p, fx, fy, fs, side)), (x, sy))
        x += fw + gap
    return img


def banner_wide():
    W, H = 1600, 400
    M = 56
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    lines = [
        (TAGLINE, font("consola.ttf", 17), ORANGE, 0, 2.0),
        ("What the Noise Remembers", font("seguisb.ttf", 60), INK, 30, 0),
        (SUBTITLE, font("segoeui.ttf", 26), INK2, 30, 0),
        (PROOF, font("consola.ttf", 19), INK, 18, 0),
    ]
    bh = block_height(lines)
    top = round((H - bh) / 2)
    k = 7
    em = draw_emblem(k)
    bx0, by0, bx1, by1 = emblem_bbox(k)
    ex = M - bx0
    ey = round(H / 2 - (by0 + by1) / 2)
    img.paste(em, (ex, ey), em)
    tx = ex + bx1 + 40
    text_block(d, tx, top, lines)
    # 2 x 3 grid of piece images on the right
    picks = [PIECES[i] for i in (0, 1, 2, 3, 4, 5)]
    fw, gap = 120, 12
    side = fw - 10
    gx0 = W - M - 3 * fw - 2 * gap
    gy0 = (H - 2 * fw - gap) // 2
    for i, (p, fx, fy, fs) in enumerate(picks):
        r, c = divmod(i, 3)
        img.paste(framed(crop_square(p, fx, fy, fs, side)), (gx0 + c * (fw + gap), gy0 + r * (fw + gap)))
    title_end = tx + d.textlength(lines[1][0], font=lines[1][1])
    assert title_end < gx0 - 40, f"title runs into the images ({title_end} vs {gx0})"
    return img


def main():
    OUT.mkdir(exist_ok=True)
    write_svg(OUT / "logo.svg")
    write_svg(OUT / "logo-dark.svg", DARK_MAP)
    draw_emblem(CELL).save(OUT / "logo.png", optimize=True)
    # 1024 = the 512 artwork at exactly 2x, i.e. what logo.svg renders at 1024
    draw_emblem(CELL).resize((1024, 1024), Image.NEAREST).save(OUT / "logo-1024.png", optimize=True)
    draw_emblem(CELL, DARK_MAP).save(OUT / "logo-dark.png", optimize=True)
    banner().save(OUT / "banner.png", optimize=True)
    banner_wide().save(OUT / "banner-wide.png", optimize=True)
    for f in sorted(OUT.iterdir()):
        if f.suffix in (".png", ".svg"):
            print(f"{f.name:20s} {f.stat().st_size / 1024:8.1f} KB", Image.open(f).size if f.suffix == ".png" else "")


if __name__ == "__main__":
    main()
