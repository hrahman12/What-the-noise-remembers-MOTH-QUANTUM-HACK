"""Author the pixel-art cast of Moth Eye and write web/sprites.json (the ONE place the page and mascot read).

Classical drawing only, no Atlas calls. Every sprite uses the shared ink palette from common/inksprite.js:
K ink outline, B mid ink, L light ink, T tint, W paper, O warm accent (lamp light and glints only).
Shapes are built from small primitives (polygons, ellipses, lines) so that symmetric characters stay
symmetric, then mirrored. Every sprite is padded to an even width and height, so the page can place
it on exact device pixels at any integer scale.

Cast
  moth        the mascot: a moth from above, wings spread, two huge compound eyes with dark pseudopupils (4-frame wing fan)
  moth_peek   the same moth glancing up and right at the bat (4 frames)
  moth_alarm  wings tucked, antennae flat, eyes on the bat (2 frames; the page shivers it)
  bat         a flying bat (4-frame flap), eyes open
  bat_doze    the same bat with its eyes shut
  batface     the meter: a big-eared bat, wings spread, whose eyes open in 8 steps (frame = how much light comes back)
  bulb        the lamp: a bare bulb with a flickering filament (3 frames)
  bulb_s      a small bulb for the layer-stack diagram
  minimoth    tiny moths that circle the bulb (decoration)
  moon, star, zz, bang, glint, leaf, photon, lbl_r, lbl_t   props, effects and the stack's R/T labels

Usage: python make_sprites.py [--sheet preview.png]
"""
import argparse
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.p = [["."] * w for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = c

    def get(self, x, y):
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def rows(self):
        return ["".join(r) for r in self.p]

    def mirror_left(self, axis2):
        """Copy the left half onto the right. axis2 = twice the mirror axis (pixel x -> axis2 - 1 - x)."""
        for y in range(self.h):
            for x in range(self.w):
                xm = axis2 - 1 - x
                if x < xm and 0 <= xm < self.w:
                    self.p[y][xm] = self.p[y][x]

    def fill(self, pix, col, outline="K", pattern=None):
        for (x, y) in pix:
            edge = any((x + dx, y + dy) not in pix for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge and outline:
                self.set(x, y, outline)
            else:
                self.set(x, y, pattern(x, y) if pattern else col)

    def line(self, x0, y0, x1, y1, col):
        x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0, col)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def stamp(self, rows, x0, y0):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c not in ". ":
                    self.set(x0 + i, y0 + j, c)


def inside(px, py, pts):
    c = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
            c = not c
    return c


def poly(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return {(x, y) for y in range(math.floor(min(ys)), math.ceil(max(ys)) + 1)
            for x in range(math.floor(min(xs)), math.ceil(max(xs)) + 1) if inside(x + 0.5, y + 0.5, pts)}


def ellipse(cx, cy, rx, ry):
    return {(x, y) for y in range(math.floor(cy - ry) - 1, math.ceil(cy + ry) + 1)
            for x in range(math.floor(cx - rx) - 1, math.ceil(cx + rx) + 1)
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0}


def rot(pts, ox, oy, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return [(ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c) for x, y in pts]


def pad_even(rows):
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    if w % 2:
        rows = [r + "." for r in rows]
    if len(rows) % 2:
        rows = rows + ["." * len(rows[0])]
    return rows


# ------------------------------------------------------------------ the moth (48 x 38, axis at x = 24)
def moth_frame(flap=0.0, gaze=(0, 0), tucked=False, droop=False):
    """Top view, wings spread, with a cartoon-big pair of compound eyes looking at you."""
    c = Canvas(48, 38)
    oy = 3   # room above the head for the antennae
    root = (22.0, 15.0 + oy)
    ang = flap - (30 if tucked else 0)
    hind = rot([(22, 19 + oy), (15, 20.5 + oy), (9, 24 + oy), (8.5, 29 + oy), (13, 32 + oy), (18.5, 30 + oy), (21.5, 26 + oy)], *root, ang * 0.6)
    fore = rot([(22, 12.5 + oy), (14, 9.5 + oy), (6, 8.5 + oy), (1.2, 9.5 + oy), (0.6, 13 + oy), (3, 18 + oy), (9, 21.5 + oy),
                (16, 21.5 + oy), (21.5, 18.5 + oy)], *root, ang)
    hp = poly(hind)
    hc = ((hind[2][0] + hind[4][0]) / 2, (hind[2][1] + hind[4][1]) / 2)
    c.fill(hp, "L", pattern=lambda x, y: "B" if math.hypot(x + .5 - hc[0], y + .5 - hc[1]) > 3.4 else ("T" if (x + y) % 3 == 0 else "L"))
    fp = poly(fore)
    tip = fore[3]
    spot = (tip[0] + (root[0] - tip[0]) * 0.32, tip[1] + (root[1] - tip[1]) * 0.32 + 1.2)
    def fpat(x, y):
        d = math.hypot(x + .5 - spot[0], y + .5 - spot[1])
        if d < 1.2:
            return "K"
        if d < 2.2:
            return "W"
        if d < 3.2:
            return "L"
        r = math.hypot(x + .5 - root[0], y + .5 - root[1])
        if 13.0 < r < 14.3:
            return "L"
        if 6.0 < r < 7.0 and (x + y) % 2 == 0:
            return "L"
        return "B"
    c.fill(fp, "B", pattern=fpat)
    c.mirror_left(48)
    # abdomen, thorax, fluffy white collar
    c.fill(ellipse(24, 25.5 + oy, 3.2, 6.2), "B", pattern=lambda x, y: "L" if y % 2 == 0 else "B")
    c.fill(ellipse(24, 18.5 + oy, 4.8, 4.2), "L", pattern=lambda x, y: "B" if (x * 3 + y) % 4 == 0 else "L")
    c.fill(ellipse(24, 14.6 + oy, 6.8, 2.5), "W", pattern=lambda x, y: "T" if (x + y) % 3 == 0 else "W")
    # head fuzz behind the eyes
    c.fill(ellipse(24, 9.0 + oy, 4.0, 5.0), "T", pattern=lambda x, y: "L" if (x + 2 * y) % 5 == 0 else "T")
    # feathery antennae (left side, mirrored): rise from the head, then sweep out
    a = Canvas(48, 38)
    p0, p1, p2 = (22.4, 5.0 + oy), ((20.5, -1.5) if not droop else (19.0, 5.5)), ((12.5, 1.5) if not droop else (11.0, 9.5))
    pts = []
    for i in range(18):
        t = i / 17
        bx = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        by = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((round(bx), round(by)))
    pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    for i, (x, y) in enumerate(pts):
        if 2 < i < len(pts) - 1:
            a.set(x - 1, y - 1, "B") if i % 2 else a.set(x + 1, y + 1, "B")
    for (x, y) in pts:
        a.set(x, y, "K")
    a.mirror_left(48)
    for y in range(38):
        for x in range(48):
            if a.p[y][x] != "." and c.p[y][x] == ".":
                c.p[y][x] = a.p[y][x]
    # the big compound eyes: facet lattice, a paper highlight, the dark pseudopupil
    for ex in (18.0, 30.0):
        cy = 9.0 + oy
        e = ellipse(ex, cy, 5.7, 5.7)
        c.fill(e, "B", pattern=lambda x, y: "L" if (y % 2 == 0 and (x + (y // 2) % 2) % 2 == 0) else "B")
        hx0, hy0 = round(ex - 4), round(cy - 3)
        for (x, y) in ((hx0, hy0), (hx0 + 1, hy0 - 1), (hx0 + 1, hy0), (hx0, hy0 + 1), (hx0 + 2, hy0 - 1)):
            c.set(x, y, "W")
        px, py = round(ex) - 1 + gaze[0], round(cy) + gaze[1]
        for (x, y) in ((px, py), (px + 1, py), (px, py + 1), (px + 1, py + 1)):
            c.set(x, y, "K")
    return pad_even(c.rows())


# ------------------------------------------------------------------ the flying bat (34 x 20, axis at x = 17)
def bat_frame(angle, eyes_open=True):
    c = Canvas(34, 20)
    sh = (15.0, 10.5)
    wing = [(15.5, 8.5), (8, 4.5), (0.6, 7.5), (2.6, 12.5), (5, 10.8), (7.6, 14.6), (10, 12.4), (12.8, 15.2), (15.5, 13.5)]
    wing = rot(wing, *sh, angle)
    c.fill(poly(wing), "B", pattern=lambda x, y: "L" if (x + y) % 6 == 0 else "B")
    w2, tip, m1, m2 = wing[1], wing[2], wing[4], wing[6]
    for p in (tip, m1, m2):
        c.line(w2[0], w2[1], p[0], p[1], "K")
    c.line(sh[0], sh[1] - 1.5, w2[0], w2[1], "K")
    c.mirror_left(34)
    # ears, head, body
    for s in (-1, 1):
        ear = poly([(17 + s * 0.2, 7), (17 + s * 3.6, 0.5), (17 + s * 4.2, 7)]) if s > 0 else poly([(16.8, 7), (13.4, 0.5), (12.8, 7)])
        c.fill(ear, "B", pattern=lambda x, y: "L" if y in (3, 4) else "B")
    c.fill(ellipse(17, 8.2, 3.6, 3.2), "B")
    c.fill(ellipse(17, 12.5, 2.6, 4.0), "B", pattern=lambda x, y: "L" if (x + y) % 3 == 0 else "B")
    if eyes_open:
        for (x, y, col) in ((15, 8, "W"), (18, 8, "W")):
            c.set(x, y, col)
    else:
        for x in (15, 18):
            c.set(x, 9, "K")
    c.set(16, 10, "W")
    c.set(17, 10, "W")   # tiny fangs
    return pad_even(c.rows())


# ------------------------------------------------------------------ the bat for the meter (52 x 32, axis at x = 26)
def batface_frame(open_frac):
    """Wings spread behind a big head; the eyelids lift in 8 steps with the light the bat sees."""
    c = Canvas(52, 32)
    wing = [(18, 13), (10, 6.5), (0.6, 10), (2.6, 19), (6, 16), (8.6, 22), (12, 18), (15.6, 23), (18, 20)]
    c.fill(poly(wing), "B", pattern=lambda x, y: "L" if (x + 2 * y) % 11 == 0 else "B")
    for p in (wing[2], wing[4], wing[6]):
        c.line(wing[1][0], wing[1][1], p[0], p[1], "K")
    c.set(9, 5, "K")
    c.set(10, 5, "K")   # wrist claw
    ear = [(17.4, 15), (14.0, 0.6), (24.6, 11.0)]
    inner = [(18.2, 12.8), (15.6, 3.4), (22.4, 10.6)]
    c.fill(poly(ear), "B", pattern=lambda x, y: "L" if inside(x + 0.5, y + 0.5, inner) else "B")
    c.mirror_left(52)
    c.fill(ellipse(26, 19.2, 11.8, 10.4), "B", pattern=lambda x, y: "L" if (x * 3 + y * 2) % 13 == 0 else "B")
    for (x, y) in ((25, 10), (26, 10), (25, 11), (26, 11), (24, 10), (27, 10)):   # forehead tuft
        c.set(x, y, "L")
    c.fill(poly([(24.5, 25.4), (26, 22.4), (27.5, 25.4)]), "L")   # nose leaf
    for x in range(22, 30):
        c.set(x, 27, "K")
    c.set(21, 26, "K")
    c.set(30, 26, "K")
    for x in (23, 28):
        c.set(x, 28, "W")
        c.set(x, 29, "K")
    for ex in (20.5, 31.5):
        eye = ellipse(ex, 17.6, 5.0, 4.6)
        ys = sorted({y for _, y in eye})
        top, bot = ys[0], ys[-1]
        h = bot - top + 1
        n_open = round(open_frac * (h - 2))
        if n_open == 0:   # shut: a curved lid line, like a sleepy smile
            for (x, y) in eye:
                below = (x, y + 1) not in eye
                if below and y >= top + h // 2:
                    c.set(x, y, "K")
            continue
        lid_y = bot - n_open
        for (x, y) in eye:
            if y < lid_y:
                continue   # the lid is fur
            edge = any((x + dx, y + dy) not in eye for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            c.set(x, y, "K" if (edge or y == lid_y) else "W")
        px, py = round(ex) - 2, max(lid_y + 1, 18)   # pupil glancing down-left, at the moth
        for (x, y) in ((px, py), (px + 1, py), (px, py + 1), (px + 1, py + 1)):
            if (x, y) in eye and c.get(x, y) == "W":
                c.set(x, y, "K")
        if n_open >= 3:
            c.set(round(ex) + 1, lid_y + 1, "L")
    if open_frac >= 0.7:   # alert brows
        for i in range(5):
            c.set(16 + i, 10 + i // 2, "K")
            c.set(35 - i, 10 + i // 2, "K")
    return pad_even(c.rows())


# ------------------------------------------------------------------ lamp bulb (13 x 19)
def bulb_frame(k):
    c = Canvas(13, 19)
    c.fill(ellipse(6.5, 6.5, 5.8, 5.8), "W")
    c.fill(poly([(3.2, 10), (9.8, 10), (8.6, 14), (4.4, 14)]), "W")
    for y in range(9, 12):
        for x in range(4, 10):
            if c.get(x, y) == "K" and 9 < y < 12 and 3 < x < 9:
                c.set(x, y, "W")
    for y in range(14, 18):
        for x in range(4, 9):
            c.set(x, y, "K" if (y % 2 == 0 or x in (4, 8)) else "B")
    c.set(6, 18, "K")
    c.set(5, 18, "K")
    c.set(7, 18, "K")
    for (x, y) in ((5, 11), (5, 10), (5, 9), (7, 11), (7, 10), (7, 9)):
        c.set(x, y, "L")
    fil = [(4, 7), (5, 6), (6, 7), (7, 6), (8, 7)]
    for (x, y) in fil:
        c.set(x, y, "O")
    if k == 1:
        for (x, y) in ((5, 7), (6, 6), (7, 7), (6, 5), (4, 6), (8, 6)):
            c.set(x, y, "O")
    if k == 2:
        c.set(6, 6, "O")
    for (x, y) in ((3, 4), (3, 5), (4, 3)):
        c.set(x, y, "L")
    return pad_even(c.rows())


def small_bulb():
    return pad_even([
        "..KKK..",
        ".KWWWK.",
        "KWOOOWK",
        "KWWOWWK",
        ".KWWWK.",
        "..KBK..",
        "..KKK..",
    ])


def moon():
    c = Canvas(16, 16)
    outer = ellipse(8, 8, 7.0, 7.0)
    bite = ellipse(11.2, 5.6, 6.0, 6.0)
    cres = {p for p in outer if p not in bite}
    c.fill(cres, "W", pattern=lambda x, y: "T" if (x, y) in {(4, 9), (5, 12), (3, 6)} else "W")
    return pad_even(c.rows())


PROPS = {
    "star": {"frames": [pad_even(["...", ".B.", "..."]), pad_even([".L.", "LBL", ".L."])], "fps": 1},
    "zz": {"frames": [pad_even(["KKKK", "..K.", ".K..", "KKKK"])], "fps": 1},
    "bang": {"frames": [pad_even(["KK", "KK", "KK", "KK", "..", "KK"])], "fps": 1},
    "glint": {"frames": [
        pad_even(["..O..", "..O..", "OOWOO", "..O..", "..O.."]),
        pad_even([".....", "..O..", ".OWO.", "..O..", "....."]),
        pad_even(["O...O", ".O.O.", "..W..", ".O.O.", "O...O"]),
    ], "fps": 6},
    "minimoth": {"frames": [
        pad_even(["BB.BB", "BBKBB", ".BKB.", "..K.."]),
        pad_even([".....", "BBKBB", "BBKBB", "..K.."]),
    ], "fps": 10},
    "leaf": {"frames": [pad_even(["...KKK..", ".KKLLBK.", "KLLLBBBK", ".KKBBKK.", "...KK..."])], "fps": 1},
    "photon": {"frames": [pad_even(["OO", "OO"])], "fps": 1},
    "lbl_r": {"frames": [pad_even(["KK.", "K.K", "KK.", "K.K", "K.K"])], "fps": 1},
    "lbl_t": {"frames": [pad_even(["KKK", ".K.", ".K.", ".K.", ".K."])], "fps": 1},
}


def build():
    sp = {}
    sp["moth"] = {"frames": [moth_frame(a) for a in (0, -5, -9, -5)], "fps": 5}
    sp["moth_peek"] = {"frames": [moth_frame(a, gaze=(1, -1)) for a in (0, -5, -9, -5)], "fps": 5}
    sp["moth_alarm"] = {"frames": [moth_frame(0, gaze=(1, -1), tucked=True, droop=True),
                                   moth_frame(3, gaze=(1, -1), tucked=True, droop=True)], "fps": 12}
    sp["bat"] = {"frames": [bat_frame(a) for a in (-24, -6, 16, -6)], "fps": 8}
    sp["bat_doze"] = {"frames": [bat_frame(a, eyes_open=False) for a in (-24, -6, 16, -6)], "fps": 5}
    sp["batface"] = {"frames": [batface_frame(i / 7) for i in range(8)], "fps": 1}
    sp["bulb"] = {"frames": [bulb_frame(k) for k in (0, 1, 0, 2)], "fps": 5}
    sp["bulb_s"] = {"frames": [small_bulb()], "fps": 1}
    sp["moon"] = {"frames": [moon()], "fps": 1}
    sp.update(PROPS)
    for k, v in sp.items():
        for f in v["frames"]:
            assert len(f) % 2 == 0 and all(len(r) == len(f[0]) for r in f) and len(f[0]) % 2 == 0, k
            assert set("".join(f)) <= set(".KBLTWOG"), (k, set("".join(f)))
    return sp


def sheet(sp, path, scale=6):
    import sys
    sys.path.insert(0, str(HERE.parent.parent / "common"))
    from mascot import render
    from PIL import Image
    tiles = []
    for name, s in sp.items():
        for i in range(len(s["frames"])):
            tiles.append(render(s, i, scale))
    W = sum(t.width for t in tiles) + 8 * len(tiles)
    rows, row, x = [], [], 0
    for t in tiles:
        if x + t.width > 1800 and row:
            rows.append(row)
            row, x = [], 0
        row.append(t)
        x += t.width + 8
    rows.append(row)
    H = sum(max(t.height for t in r) + 8 for r in rows)
    img = Image.new("RGBA", (1800, H), (211, 211, 230, 255))
    y = 0
    for r in rows:
        x = 0
        for t in r:
            img.alpha_composite(t, (x, y))
            x += t.width + 8
        y += max(t.height for t in r) + 8
    img.save(path)
    print(f"{path}: {img.size}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet")
    a = ap.parse_args()
    sp = build()
    OUT.write_text("{\n" + ",\n".join(f' "{k}": ' + json.dumps(v, separators=(",", ":")) for k, v in sp.items()) + "\n}\n", encoding="utf-8")
    print(f"{OUT.relative_to(HERE)}: {len(sp)} sprites, {OUT.stat().st_size / 1024:.1f} KB")
    if a.sheet:
        sheet(sp, a.sheet)
