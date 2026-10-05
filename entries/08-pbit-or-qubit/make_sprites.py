"""Draw the realistic pixel-art cast of "p-bit or qubit?" and write web/sprites.json. CLASSICAL, offline.

Realism pass (user, 5 Oct 2026: "make the sprites real life"). The two fighters are drawn as the real objects:

  THE SAUNA   a hardware p-bit: a stochastic magnetic tunnel junction (sMTJ) nanopillar, seen in three-quarter
              view. From the top: cap, CoFeB free layer (its magnetisation flips on room-temperature heat), MgO
              tunnel barrier (about 1 nm), CoFeB reference layer, Ru spacer, CoFe pinned layer, IrMn antiferromagnet,
              seed, with the top and bottom electrodes. Heat shimmer in the warm accent (O, heat only).
  THE FRIDGE  a dilution refrigerator with its cans off (the "chandelier"): the room-temperature flange with the
              pulse-tube head, then the 50 K, 4 K, still, cold-plate and mixing-chamber plates on support rods,
              coax lines with an attenuator under each plate, the still pot, the heat exchanger, the mixing-chamber
              pot and the shielded sample can at the bottom.

Layer thicknesses are exaggerated so they can be seen (the real MgO barrier is about 1 nm in a pillar some tens of
nm across). The large labelled versions on the page are hand-written SVG engravings in web/template.html; these
pixel versions are the hub mascot and the small button icons.

Palette (common/inksprite.js): K ink, B ink-2, L ink-3, T tint, W paper, O warm accent (heat only).
Usage: python make_sprites.py [--sheet out.png]   (the sheet is a scaled contact sheet for eyeballing the art)
"""
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"


class Grid:
    def __init__(self, w, h, fill="."):
        self.w, self.h = w, h
        self.a = [[fill] * w for _ in range(h)]

    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y][x] = c

    def get(self, x, y):
        return self.a[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def hline(self, x0, x1, y, c):
        for x in range(int(round(x0)), int(round(x1)) + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(int(round(y0)), int(round(y1)) + 1):
            self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c, only=None):
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (only is None or self.a[y][x] in only):
                    self.a[y][x] = c

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def outline(self, c="K"):
        """Ink a 1 px outline around every non-transparent shape (4-neighbourhood)."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x] != ".":
                    continue
                if any(self.get(x + dx, y + dy) not in (".", c) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add:
            self.a[y][x] = c

    def paste(self, rows, x0, y0, transparent="."):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch != transparent:
                    self.px(x0 + i, y0 + j, ch)

    def rows(self):
        return ["".join(r) for r in self.a]


# ---------------------------------------------------------------- the sMTJ nanopillar
# The in-plane stochastic MTJ used for p-bits (Borders et al., Nature 2019; the same stack in Yoon et al. 2026):
# from the substrate up Ta(5) / PtMn(20) / Co(2.4) / Ru(0.9) / CoFeB(2) / MgO / CoFeB(2.1) / Ta / Ru / Ta (nm).
# Drawn top down here; every magnetisation lies IN the plane of its layer, so the arrows point sideways.
# (name, thickness in px, base tone, texture) from the top of the pillar down
MTJ_LAYERS = [
    ("cap", 3, "L", None),          # Ta / Ru / Ta cap
    ("free", 10, "W", "free"),      # CoFeB free layer: low energy barrier, flips on thermal noise
    ("mgo", 3, "T", "dots"),        # MgO tunnel barrier (~1 nm in reality)
    ("ref", 6, "T", None),          # CoFeB reference layer (fixed)
    ("ru", 1, "B", None),           # Ru spacer (synthetic antiferromagnet)
    ("pin", 6, "T", None),          # Co pinned layer, antiparallel to the reference
    ("afm", 6, "L", "cross"),       # PtMn antiferromagnet that pins it
    ("seed", 2, "T", None),         # Ta seed
]


def pillar(g, cx, ytop, rx, ry, layers, free_right=True, arrows=True):
    """Draw a cylinder of stacked layers in three-quarter view. Returns ({name: (y0, y1)} on the centre line, ybot)."""
    bands, y = {}, ytop
    for name, h, *_ in layers:
        bands[name] = (y, y + h - 1)
        y += h
    ybot = y - 1
    x0, x1 = int(math.floor(cx - rx)), int(math.ceil(cx + rx))
    for x in range(x0, x1 + 1):
        u = (x - cx) / rx
        if abs(u) > 1:
            continue
        off = int(round(ry * math.sqrt(max(0.0, 1 - u * u))))     # the front arc bulges down toward the viewer
        for yy in range(ytop + off, ybot + off + 1):
            yrel = yy - off
            name, tone, tex = None, None, None
            for nm, h, tn, tx in layers:
                if bands[nm][0] <= yrel <= bands[nm][1]:
                    name, tone, tex = nm, tn, tx
                    break
            c = tone
            # cylindrical shading: the left flank in shadow, a highlight right of centre
            if abs(u) > 0.86 or u < -0.62:
                c = {"W": "T", "T": "L", "L": "B", "B": "K"}[tone]
            elif -0.05 < u < 0.22 and tone in "TL":
                c = {"T": "W", "L": "T"}[tone]
            if tex == "dots" and (x + yy) % 3 == 0:
                c = "B"
            if tex == "cross" and ((x + yy) % 4 == 0 or (x - yy) % 4 == 0):
                c = "B" if c != "B" else "K"
            if yy == bands[name][1] + off and name != layers[-1][0]:
                c = "B" if c in "WTL" else c           # a hairline where one layer meets the next
            g.px(x, yy, c)
    # the top face: an ellipse, lit
    g.ellipse(cx, ytop, rx - 0.3, ry, "T")
    g.ellipse(cx + 1, ytop, rx * 0.55, ry * 0.5, "W", only="T")
    if arrows:
        o = int(round(ry))
        mid = lambda nm: (bands[nm][0] + bands[nm][1]) // 2 + o
        harrow(g, cx, mid("free"), 13, right=free_right, c="K", thick=True)
        harrow(g, cx, mid("ref"), 9, right=True, c="B")
        harrow(g, cx, mid("pin"), 9, right=False, c="B")
    return bands, ybot


def harrow(g, cx, y, length, right=True, c="K", thick=False):
    """An in-plane magnetisation arrow, centred on cx, pointing right (or left)."""
    x0, x1 = int(round(cx - length / 2)), int(round(cx + length / 2))
    g.hline(x0, x1, y, c)
    if thick:
        g.hline(x0, x1, y + 1, c)
    head, s = (x1, -1) if right else (x0, 1)
    n = 4 if thick else 3
    for k in range(1, n):
        g.px(head + s * k, y - k, c)
        g.px(head + s * k, y + k + (1 if thick else 0), c)
        if thick:
            g.px(head + s * (k + 1), y - k, c)
            g.px(head + s * (k + 1), y + k + 1, c)


def heat(g, x, y0, y1, phase=0):
    """A wavering column of heat shimmer in the warm accent (heat only)."""
    for y in range(y0, y1 + 1):
        dx = int(round(1.0 * math.sin((y + phase) * 0.55)))
        if (y + phase) % 7 not in (0, 1):
            g.px(x + dx, y, "O")


def mtj(free_right=True, phase=0, with_heat=True):
    """The p-bit as a stochastic MTJ nanopillar with its electrodes (40 x 64)."""
    g = Grid(40, 64)
    cx, rx, ry, ytop = 19.5, 12.5, 3.4, 14
    # bottom electrode: a slab running off to the left, lit on top
    g.rect(0, 52, 31, 55, "L")
    g.hline(0, 31, 52, "T")
    g.hline(0, 31, 53, "W")
    g.rect(0, 56, 31, 57, "B")
    bands, ybot = pillar(g, cx, ytop, rx, ry, MTJ_LAYERS, free_right=free_right)
    # top electrode: a slab across the top running off to the right
    g.rect(9, 7, 39, 10, "L")
    g.hline(11, 39, 7, "T")
    g.hline(12, 39, 8, "W")
    g.rect(9, 11, 39, 12, "B")
    g.outline("K")
    if with_heat:
        heat(g, 3, 14, 36, phase)
        heat(g, 37, 18, 40, phase + 2)
        heat(g, 6, 22, 44, phase + 4)
    return g.rows()


def mtj_icon(right=True):
    """Button icon: a tiny nanopillar with its in-plane free-layer arrow (14 x 20)."""
    g = Grid(14, 20)
    layers = [("cap", 1, "L", None), ("free", 6, "W", None), ("mgo", 2, "T", "dots"), ("ref", 3, "T", None),
              ("pin", 3, "L", None)]
    pillar(g, 6.5, 3, 5.6, 1.6, layers, arrows=False)
    harrow(g, 6.5, 7, 7, right=right, c="K")
    g.outline("K")
    return g.rows()


# ---------------------------------------------------------------- the dilution refrigerator
DR_PLATES = [  # (label, y of the top face centre, half width): room temperature, 50 K, 4 K, still, cold plate, MXC
    ("300K", 10, 27), ("50K", 27, 25), ("4K", 43, 23), ("still", 57, 20), ("cold", 69, 17), ("mxc", 79, 14)]


def plate(g, cx, y, rx, ry=None, bolts=True, edge=2):
    """A gold-plated copper plate in three-quarter view: a lit top face (an ellipse, brightest along its far rim), a bolt
    circle, and a darker front edge that curves toward the viewer, so it reads as a thick disc. The face's depth
    scales with its width (one viewing angle for the whole stack)."""
    ry = ry if ry is not None else 0.115 * rx
    for x in range(int(math.ceil(cx - rx)), int(math.floor(cx + rx)) + 1):
        u = (x - cx) / rx
        t = max(0.0, 1 - u * u) ** 0.5
        top, bot = int(round(y - ry * t)), int(round(y + ry * t))
        for yy in range(top, bot + 1):
            g.px(x, yy, "T")
        if -0.8 < u < 0.6 and bot - top >= 2:
            g.px(x, top, "W")                       # the far rim catches the light
        for k, yy in enumerate(range(bot + 1, bot + 1 + edge)):
            g.px(x, yy, "L" if (k == 0 and -0.4 < u < 0.3) else "B")
    if bolts:
        for k in range(12):
            t = (k + 0.5) / 12 * 2 * math.pi
            x, yy = cx + 0.84 * rx * math.cos(t), y + 0.62 * ry * math.sin(t)
            if g.get(int(round(x)), int(round(yy))) == "T":
                g.px(x, yy, "L")


def tube(g, x, y0, y1, w):
    """A thin vertical tube without a heavy outline: shaded edges, lit centre."""
    for y in range(y0, y1 + 1):
        g.px(x, y, "B")
        for k in range(1, w - 1):
            g.px(x + k, y, "W" if k == 1 else "T")
        g.px(x + w - 1, y, "B")


def dr(frost=True):
    """The dilution refrigerator with its cans off: the gold 'chandelier' (58 x 96).

    Drawn in two layers: the open frame behind (support rods, a curtain of coax lines with their attenuators, the
    readout lines, the pulse tube's two stages: thin, no outline) and the solid parts in front (plates, the pulse-tube
    head, HEMTs, the still pot, the heat exchanger, the mixing chamber, the cold finger and the sample can: outlined)."""
    cx = 28.5
    P = {k: (y, rx) for k, y, rx in DR_PLATES}
    back, g = Grid(58, 96), Grid(58, 96)
    # support rods between plates, set in from the edge of the plate below
    for (_, ya, rxa), (_, yb, rxb) in zip(DR_PLATES, DR_PLATES[1:]):
        for s in (-1, 1):
            back.vline(int(round(cx + s * (rxb - 2))), ya + 2, yb, "L")
    # a curtain of input coax lines; an attenuator (a small block) just under the 4 K, still, cold and MXC plates
    xs = (15, 17, 19, 21, 23, 25, 27)
    ymxc = P["mxc"][0]
    for j, x in enumerate(xs):
        back.vline(x, P["300K"][0], ymxc + 1, "K" if j % 2 == 0 else "B")
        for k in ("4K", "still", "cold"):
            y, rx = P[k]
            if abs(x - cx) < rx - 2:
                back.rect(x, y + 5, x, y + 7, "K")
                back.px(x, y + 6, "W")
    # flexible bends in the lines between 300 K and 50 K (they take up thermal contraction)
    for x in xs[::2]:
        for y in (16, 17, 18):
            back.px(x, y, ".")
            back.px(x - 1, y, "K")
    # readout lines back up from the sample to the HEMT amplifiers under the 4 K plate
    for x in (32, 34):
        back.vline(x, P["4K"][0] + 4, ymxc + 2, "B")
    # the pulse tube's first stage (300 K -> 50 K) and second stage (50 K -> 4 K): regenerator and pulse tube
    y300, y50, y4 = P["300K"][0], P["50K"][0], P["4K"][0]
    tube(back, 37, y300 + 3, y50, 4); tube(back, 42, y300 + 3, y50, 3)
    tube(back, 38, y50 + 3, y4, 3); tube(back, 42, y50 + 3, y4, 2)
    # pulse-tube cold head with its rotary valve on the room-temperature flange
    g.rect(37, 0, 44, 6, "L"); g.vline(39, 1, 5, "W"); g.vline(43, 1, 5, "B")
    g.rect(36, 0, 45, 0, "B")
    # HEMT amplifiers hanging under the 4 K plate
    g.rect(31, y4 + 5, 33, y4 + 7, "B"); g.rect(35, y4 + 5, 37, y4 + 7, "B")
    # still pot under the still plate, the step heat exchanger, the mixing chamber standing on the MXC plate
    ys, yc = P["still"][0], P["cold"][0]
    g.rect(29, ys + 4, 36, ys + 8, "L"); g.hline(29, 36, ys + 4, "T"); g.vline(30, ys + 4, ys + 8, "W")
    for k in range(3):
        g.hline(30, 35, yc + 4 + 2 * k, "L")
    g.rect(31, ymxc - 6, 35, ymxc - 2, "T"); g.vline(32, ymxc - 6, ymxc - 2, "W"); g.hline(31, 35, ymxc - 6, "L")
    # the plates, top to bottom
    for _, y, rx in DR_PLATES:
        plate(g, cx, y, rx)
    # cold finger, sample holder and the shielded can, with the chip seen through its open front
    yf = ymxc + 4
    g.rect(27, yf, 29, yf + 2, "L"); g.vline(28, yf, yf + 2, "W")
    g.rect(22, yf + 3, 34, yf + 11, "T")
    g.vline(23, yf + 3, yf + 11, "W"); g.vline(33, yf + 3, yf + 11, "L"); g.vline(34, yf + 3, yf + 11, "B")
    g.hline(22, 34, yf + 3, "L")
    g.rect(26, yf + 5, 30, yf + 8, "W")
    g.rect(27, yf + 6, 29, yf + 7, "B"); g.px(28, yf + 6, "K")
    g.outline("K")
    out = Grid(58, 96)
    out.paste(back.rows(), 0, 0)
    out.paste(g.rows(), 0, 0)
    if frost:   # cold glints (decoration)
        for x, y in ((6, 58), (52, 52), (9, 74), (49, 72), (13, 89), (44, 90)):
            out.px(x, y, "L"); out.px(x - 1, y, "T"); out.px(x + 1, y, "T"); out.px(x, y - 1, "T"); out.px(x, y + 1, "T")
    return out.rows()


def dr_icon():
    """Button icon: three plates, the lines between them and a can (16 x 20)."""
    g = Grid(16, 20)
    cx = 7.5
    for x in (5, 7, 9):
        g.vline(x, 3, 15, "B")
    for y, rx in ((3, 7), (8, 6), (12, 4.6)):
        plate(g, cx, y, rx, ry=1, bolts=False)
    g.rect(5, 15, 10, 18, "T")
    g.rect(7, 16, 8, 17, "B")
    g.outline("K")
    return g.rows()


def duo():
    """Hub mascot: the sweating p-bit (an MTJ nanopillar shimmering with heat) beside the fridge (98 x 96)."""
    g = Grid(98, 96)
    g.paste(mtj(free_right=True, with_heat=True), 0, 30)
    g.paste(dr(), 40, 0)
    return g.rows()


def build():
    S = {
        "mtj": {"frames": [mtj(True, 0), mtj(False, 2)], "fps": 2},
        "dr": {"frames": [dr()], "fps": 1},
        "mtj_icon": {"frames": [mtj_icon(True), mtj_icon(False)], "fps": 1},
        "dr_icon": {"frames": [dr_icon()], "fps": 1},
        "duo": {"frames": [duo()], "fps": 1},
    }
    # every frame of a sprite must share one size, and only palette letters may appear
    for k, v in S.items():
        fr = v["frames"]
        w, h = len(fr[0][0]), len(fr[0])
        for f in fr:
            assert len(f) == h and all(len(r) == w for r in f), k
            assert set("".join(f)) <= set(".KBLTWOG"), (k, set("".join(f)))
    return S


def sheet(S, path, scale=6):
    from PIL import Image
    sys.path.insert(0, str(HERE.parent.parent / "common"))
    from mascot import render
    tiles = []
    for name, sp in S.items():
        for i in range(len(sp["frames"])):
            tiles.append(render(sp, i, scale))
    W = 1400
    x = y = rowh = 0
    pos = []
    for t in tiles:
        if x + t.size[0] > W:
            x, y, rowh = 0, y + rowh + 12, 0
        pos.append((x, y)); x += t.size[0] + 12; rowh = max(rowh, t.size[1])
    img = Image.new("RGBA", (W, y + rowh), (251, 250, 249, 255))
    for t, p in zip(tiles, pos):
        img.alpha_composite(t, p)
    img.save(path)
    print("sheet", path, img.size)


if __name__ == "__main__":
    S = build()
    OUT.write_text(json.dumps(S, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT}: {len(S)} sprites, {OUT.stat().st_size / 1024:.1f} KB")
    if "--sheet" in sys.argv:
        sheet(S, sys.argv[sys.argv.index("--sheet") + 1])
