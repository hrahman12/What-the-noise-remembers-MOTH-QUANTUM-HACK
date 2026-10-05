"""Author FLAVOUR's small pixel sprites and write web/sprites.json (the one home of the sprite pixels).

The big scene on the page is a hand-built SVG ink engraving (sources, the Earth, the far detector), drawn by
web/template.html. These are the small pixel pieces around it, in the shared ink palette (common/inksprite.js):
K ink outline, B mid ink, L light ink, T tint, W paper, O warm (light only: Cherenkov light on a PMT).

  mascot          Super-Kamiokande in its cavern, cut open (96 x 96): the inner wall lined with photomultiplier
                  tubes (PMTs), the outer-detector gap, electronics huts on the lid, a sharp muon Cherenkov ring
  pmt / pmt_lit   a 50 cm (20-inch) PMT: glass dome with the photocathode inside, neck, base and cable (keyboard keys)
  ring_e/mu/tau   tiny event displays: a fuzzy electron-like ring, a sharp muon-like ring, a messy multi-ring event
  chip_*          the machines that measured the curves (real IBM chip, noiseless simulator, noise model)

Drawn from published descriptions of the real objects (see CREDITS.md); no photo is traced or embedded.
Run: python make_sprites.py   (pure drawing, no data, no jobs)
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


class Px:
    def __init__(self, w, h):
        assert w % 2 == 0 and h % 2 == 0, (w, h)   # even sizes: InkSprite.draw centres land on whole pixels
        self.w, self.h = w, h
        self.g = [["."] * w for _ in range(h)]

    def set(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def frame(self, x, y, w, h, c):
        for i in range(x, x + w):
            self.set(i, y, c); self.set(i, y + h - 1, c)
        for j in range(y, y + h):
            self.set(x, j, c); self.set(x + w - 1, j, c)

    def ell(self, cx, cy, rx, ry, c, keep=None):
        for j in range(self.h):
            for i in range(self.w):
                if ((i + .5 - cx) / rx) ** 2 + ((j + .5 - cy) / ry) ** 2 <= 1 and (keep is None or keep(i, j)):
                    self.set(i, j, c(i, j) if callable(c) else c)

    def ring(self, cx, cy, rx, ry, c, t=1.0, keep=None):
        for j in range(self.h):
            for i in range(self.w):
                d = ((i + .5 - cx) / rx) ** 2 + ((j + .5 - cy) / ry) ** 2
                inner = ((i + .5 - cx) / max(rx - t, .1)) ** 2 + ((j + .5 - cy) / max(ry - t, .1)) ** 2
                if d <= 1 and inner > 1 and (keep is None or keep(i, j)):
                    self.set(i, j, c)

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / max(n, 1)
            self.set(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), c)

    def outline(self, c="K"):
        """1 px outline on the outside of every filled pixel (4-neighbour)."""
        add = []
        for j in range(self.h):
            for i in range(self.w):
                if self.g[j][i] != ".":
                    continue
                if any(self.get(i + dx, j + dy) != "." for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((i, j))
        for i, j in add:
            self.set(i, j, c)

    def rows(self):
        return ["".join(r) for r in self.g]


def rng(seed):
    """Tiny deterministic generator (same scatter every build)."""
    s = seed & 0xFFFFFFFF

    def nxt():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 2 ** 32
    return nxt


# ---------------------------------------------------------------- mascot: the far detector, cut open
def mascot():
    """96 x 96. Super-Kamiokande in its cavern: a cylinder 39.3 m wide and 41.4 m tall, seen a little from above.
    The front half of the wall is cut away below the lid so the inner wall shows as it does in photographs: a dark
    wall (black sheet) packed with pale 50 cm PMT faces, crowding towards the edges as the wall curves away; the
    outer-detector gap in the cut walls; four electronics huts on the lid; a sharp muon ring of Cherenkov light."""
    p = Px(96, 96)
    cx, R = 47.5, 32.0                 # tank centre column and outer radius (x 15.5..79.5)
    rid = R * 16.9 / 19.65             # inner-detector radius, to scale (27.5 px)
    top, bot, ry = 17.0, 85.0, 5.5     # lid and floor ellipse centres (height:width = 41.4:39.3), vertical radius
    e = ry / R
    # the rock round the cavern (hatched) and the cavern's domed roof
    def in_cav(i, j):
        if j >= 22:
            return 6 <= i <= 89
        return ((i + .5 - 47.5) / 42) ** 2 + ((j + .5 - 22) / 19) ** 2 < 1
    for j in range(96):
        for i in range(96):
            if not in_cav(i, j):
                near = any(in_cav(i + dx, j + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if near:
                    p.set(i, j, "K")
                elif (i + 2 * j) % 5 == 0:
                    p.set(i, j, "L")
    # inner back wall: the black sheet between the cut edges
    x0, x1 = cx - rid, cx + rid
    ztop, zbot = top + 4, bot - 2
    for j in range(int(ztop) - 4, int(zbot) + 6):
        for i in range(int(x0), int(x1) + 1):
            dx = (i + .5 - cx) / rid
            if abs(dx) >= 1:
                continue
            yb = math.sqrt(1 - dx * dx) * rid * e
            if ztop - yb <= j + .5 <= zbot + yb:
                p.set(i, j, "B" if abs(dx) < .82 else "K")
    rc_x, rc_y, rr = 53.0, 45.0, 11.5    # the ring's centre on the back wall; radius measured along the wall

    def ring_d(x, y):
        arc = rid * math.asin(max(-1, min(1, (x - cx) / rid)))
        arc0 = rid * math.asin(max(-1, min(1, (rc_x - cx) / rid)))
        return math.hypot(arc - arc0, y - rc_y)
    # PMT faces: columns at equal angles round the back half, rows every 3 px
    for k in range(-12, 13):
        th = k / 12.8 * (math.pi / 2)
        x = cx + rid * math.sin(th)
        yoff = math.cos(th) * rid * e
        for jj in range(24):
            y = ztop + 2 + jj * 3 - yoff
            if y > zbot - yoff - 1:
                break
            hit = rr - 2.6 <= ring_d(x, y) <= rr + .6
            xi, yi = int(x), int(round(y))
            p.set(xi, yi, "O" if hit else ("T" if math.cos(th) > .5 else "L"))
            if math.cos(th) > .5:
                p.set(xi + 1, yi, "O" if hit else "L")
    # the ring's sharp outer edge
    for j in range(int(ztop), int(zbot)):
        for i in range(int(x0) + 2, int(x1) - 1):
            if rr - .5 <= ring_d(i + .5, j + .5) <= rr + .45 and p.get(i, j) in "BK":
                p.set(i, j, "O")
    # the floor: the inside of the bottom ellipse, PMT faces looking up
    p.ell(cx, zbot, rid, rid * e, "K", keep=lambda i, j: j >= zbot - 1)
    for j in range(int(zbot - rid * e), int(zbot + rid * e) + 1, 2):
        for i in range(int(x0) + 2, int(x1) - 1, 3):
            if p.get(i, j) == "K" and j >= zbot - 1:
                p.set(i + (j % 4 == 0), j, "L")
    # the cut walls: outer steel tank, outer-detector gap (water; outward PMTs), inner-detector frame
    for j in range(int(top), int(bot) + 1):
        for (a, b, side) in ((16, int(x0) - 1, -1), (int(x1) + 1, 79, 1)):
            for i in range(a, b + 1):
                p.set(i, j, "T" if (i + j) % 4 == 0 else "W")
            p.set(a, j, "K"); p.set(b, j, "K")
            if j % 7 == 3:
                p.set(a + 1 if side < 0 else b - 1, j, "B")
    # front lip of the floor and the base slab
    p.ring(cx, bot, R, ry, "K", 1.0, keep=lambda i, j: j >= bot)
    for i in range(int(x0), int(x1) + 1):
        for j in range(int(bot), int(bot + ry) + 1):
            if p.get(i, j) == "." and ((i + .5 - cx) / R) ** 2 + ((j + .5 - bot) / ry) ** 2 <= 1:
                p.set(i, j, "W")
    p.rect(10, int(bot + ry) + 1, 76, 1, "K")
    p.rect(12, int(bot + ry) + 2, 72, 1, "L")
    # lid: a full ellipse with a rim, the inner-detector circle, four electronics huts standing on it
    p.ell(cx, top, R, ry, "W")
    p.ring(cx, top, R, ry, "K", 1.0)
    p.ring(cx, top, rid, rid * e, "T", 1.0)
    for i in range(16, 80):
        dx = (i + .5 - cx) / R
        if abs(dx) < 1:
            p.set(i, int(top + math.sqrt(1 - dx * dx) * ry) + 1, "K")
    for hx, hy in ((28, 16), (38, 13), (51, 13), (61, 16)):
        p.rect(hx, hy - 3, 7, 3, "L")
        p.rect(hx, hy - 3, 7, 1, "W")
        p.rect(hx + 5, hy - 3, 2, 3, "B")
        p.frame(hx - 1, hy - 4, 9, 5, "K")
    # the muon: vertex low in the water, a straight track towards the ring, the cone's edges (dotted)
    vx, vy = 42, 73
    for ex, ey in ((rc_x - rr + 1, rc_y + 3), (rc_x + rr - 1, rc_y + 3)):
        for k in range(1, 16, 2):
            t = k / 17
            p.set(round(vx + (ex - vx) * t), round(vy + (ey - vy) * t), "W")
    p.line(vx, vy, 49, 60, "W")
    p.line(vx + 1, vy, 50, 60, "W")
    p.set(vx, vy, "O"); p.set(vx + 1, vy, "O"); p.set(vx, vy + 1, "O")
    return p.rows()


# ---------------------------------------------------------------- a 50 cm (20-inch) PMT, dome up
def pmt(lit):
    p = Px(12, 18)
    # glass dome (photocathode inside): hemisphere and a little below the equator
    p.ell(6, 7, 5.6, 6.6, lambda i, j: "L", keep=lambda i, j: j <= 9)
    for j in range(1, 10):                      # shading: darker towards the lower right
        for i in range(12):
            if p.get(i, j) == "L" and (i - 6) * .6 + (j - 5) * .8 > 2.6:
                p.set(i, j, "B")
    p.set(3, 3, "W"); p.set(4, 2, "W"); p.set(3, 4, "W")   # highlight on the glass
    for j, half in ((10, 4), (11, 3), (12, 2)):           # glass neck
        for i in range(6 - half, 6 + half):
            p.set(i, j, "T")
    p.rect(4, 13, 4, 3, "B")                               # base (potting / housing)
    p.rect(4, 13, 4, 1, "L")
    p.outline("K")
    p.rect(5, 17, 2, 1, "K")                               # cable
    if lit:                                                # Cherenkov light landing on the photocathode
        for x, y in ((5, 4), (6, 5), (7, 4), (5, 6), (7, 6), (6, 3), (8, 5), (4, 5), (6, 7)):
            p.set(x, y, "O")
    return p.rows()


# ---------------------------------------------------------------- tiny event displays (unrolled tank wall)
def ring_icon(kind):
    p = Px(20, 14)
    p.rect(0, 0, 20, 14, "W")
    for j in range(2, 13, 3):
        for i in range(2, 19, 3):
            p.set(i, j, "L")                               # the PMT grid
    r = rng({"e": 7, "mu": 3, "tau": 11}[kind])
    if kind == "mu":                                       # sharp outer edge, filled in towards it
        for j in range(14):
            for i in range(20):
                d = math.hypot(i + .5 - 10, (j + .5 - 7) * 1.05)
                if 3.6 <= d <= 5.0:
                    p.set(i, j, "O")
    elif kind == "e":                                      # fuzzy: hits spill past the edge
        for j in range(14):
            for i in range(20):
                d = math.hypot(i + .5 - 10, (j + .5 - 7) * 1.05)
                if 3.8 <= d <= 4.9 and r() < .85:
                    p.set(i, j, "O")
                elif 2.6 <= d <= 7.4 and r() < .28:
                    p.set(i, j, "O")
    else:                                                  # several overlapping rings, messy
        for (ccx, ccy, rr) in ((7, 6, 3.2), (13, 8, 2.8), (11, 4, 2.2)):
            for j in range(14):
                for i in range(20):
                    d = math.hypot(i + .5 - ccx, (j + .5 - ccy) * 1.05)
                    if abs(d - rr) < .6 and r() < .8:
                        p.set(i, j, "O")
        for _ in range(9):
            p.set(int(r() * 18) + 1, int(r() * 12) + 1, "O")
    p.frame(0, 0, 20, 14, "K")
    return p.rows()


# ---------------------------------------------------------------- the machines that measured the curves
def chip(kind):
    p = Px(16, 16)
    body, die, pin = {"real": ("K", "B", "K"), "sim": ("B", "W", "B"), "model": ("L", "T", "L")}[kind]
    p.rect(3, 3, 10, 10, body)
    p.rect(5, 5, 6, 6, die)
    for k in range(4):
        for (x, y) in ((4 + 2 * k, 1), (4 + 2 * k, 14), (1, 4 + 2 * k), (14, 4 + 2 * k)):
            p.set(x, y, pin)
            if y in (1, 14):
                p.set(x, y + (1 if y == 1 else -1), pin)
            else:
                p.set(x + (1 if x == 1 else -1), y, pin)
    if kind == "real":
        p.set(6, 6, "W"); p.set(7, 6, "W"); p.set(6, 7, "W")
    elif kind == "sim":
        p.frame(3, 3, 10, 10, "K")
        for x, y in ((8, 6), (7, 7), (8, 7), (9, 7), (8, 8), (6, 8), (10, 8)):
            p.set(x, y, "B")
        p.set(8, 7, "K")
    else:
        for k in range(3, 13, 2):                                  # dashed ghost outline
            p.set(k, 3, "B"); p.set(k, 12, "B"); p.set(3, k, "B"); p.set(12, k, "B")
        p.set(7, 7, "B"); p.set(8, 8, "B")
    return p.rows()


S = {
    "mascot": {"frames": [mascot()], "fps": 1},
    "pmt": {"frames": [pmt(False)], "fps": 1},
    "pmt_lit": {"frames": [pmt(True)], "fps": 1},
    "ring_e": {"frames": [ring_icon("e")], "fps": 1},
    "ring_mu": {"frames": [ring_icon("mu")], "fps": 1},
    "ring_tau": {"frames": [ring_icon("tau")], "fps": 1},
    "chip_real": {"frames": [chip("real")], "fps": 1},
    "chip_sim": {"frames": [chip("sim")], "fps": 1},
    "chip_model": {"frames": [chip("model")], "fps": 1},
}

if __name__ == "__main__":
    for name, s in S.items():
        for f in s["frames"]:
            assert len({len(r) for r in f}) == 1, name
            assert set("".join(f)) <= set(".KBLTWOG"), name
    out = "{\n" + ",\n".join(f' "{k}": ' + json.dumps(v, separators=(",", ":")) for k, v in S.items()) + "\n}\n"
    (HERE / "web" / "sprites.json").write_text(out, encoding="utf-8")
    print("web/sprites.json:", ", ".join(f"{k} {len(v['frames'][0][0])}x{len(v['frames'][0])}" for k, v in S.items()))
