"""Draw the pixel sprites that are easier to construct than to type, and write them into web/sprites.json.

web/sprites.json stays the ONE place the page and the hub mascot read sprite pixels from (common/SPRITES.md rule 5);
this script only (re)generates some of its entries:
  mascot      the hub mascot: a nose in sagittal section (facing left, like Plate I) sniffing an odorant, with the
              conchae, the olfactory epithelium on the roof, the cribriform plate and the olfactory bulb and tract
              on top. Transparent outside the silhouette.
              frame 1 is the same head mid-sniff (the odorant drawn up the vestibule to the cleft); the page uses both
              frames for the side-note mascot and for the blind test's sniffing nose
  neutron     the neutron that turns H into D (a 5x5 dark ball), drawn in the loupe on Plate I when you swap
  spike       an action potential travelling up a receptor neuron's axon (Fig. b)
Palette letters are the shared ink palette of common/inksprite.js.
Run: python make_sprites.py   (then python build_web.py)
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPRITES = HERE / "web" / "sprites.json"


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [["."] * w for _ in range(h)]

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def poly(self, pts, c, only=None):
        """fill a polygon (pixel centres inside); only: restrict to pixels currently holding one of these chars"""
        for y in range(self.h):
            for x in range(self.w):
                px, py = x + 0.5, y + 0.5
                inside = False
                j = len(pts) - 1
                for i in range(len(pts)):
                    xi, yi = pts[i]
                    xj, yj = pts[j]
                    if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                        inside = not inside
                    j = i
                if inside and (only is None or self.g[y][x] in only):
                    self.g[y][x] = c

    def ellipse(self, cx, cy, rx, ry, c, only=None):
        for y in range(self.h):
            for x in range(self.w):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and (only is None or self.g[y][x] in only):
                    self.g[y][x] = c

    def line(self, x0, y0, x1, y1, c, dash=None):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        e, i = dx + dy, 0
        while True:
            if not dash or (i % dash[0]) < dash[1]:
                self.set(x0, y0, c)
            i += 1
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * e
            if e2 >= dy:
                e += dy
                x0 += sx
            if e2 <= dx:
                e += dx
                y0 += sy

    def pts(self, lst, c):
        for x, y in lst:
            self.set(x, y, c)

    def outline(self, inside, c="K", diag=False):
        """pixels in `inside` that touch a pixel not in `inside` (or the edge) become c"""
        out = []
        nb = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (-1, -1), (1, -1), (-1, 1)] if diag else [])
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] in inside and any(self.get(x + a, y + b) not in inside for a, b in nb):
                    out.append((x, y))
        for x, y in out:
            self.g[y][x] = c

    def rows(self):
        return ["".join(r) for r in self.g]


# a benzene ring drawn the way chemists do: a hexagon with a circle inside (9 x 9 px, pointy top)
BENZENE = ["....K....", "..KKWKK..", ".KWLLLWK.", "KWLWWWLWK", "KWLWWWLWK", "KWLWWWLWK", ".KWLLLWK.", "..KKWKK..",
           "....K...."]
ATOM_O = [".K.", "KTK", ".K."]


def stamp(g, rows, x0, y0):
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c != ".":
                g.set(x0 + i, y0 + j, c)


def odorant(g, x0, y0):
    """acetophenone, schematically: a benzene ring with its acetyl arm (C=O) reaching up to the right"""
    stamp(g, BENZENE, x0, y0)
    g.line(x0 + 8, y0 + 2, x0 + 10, y0, "K")      # ring -> carbonyl carbon
    stamp(g, ATOM_O, x0 + 10, y0 - 3)              # the oxygen of C=O
    g.set(x0 + 9, y0 - 1, "B")                     # second line of the double bond


def nose_section(sniff=False):
    """a head in profile (facing left, anterior to the left as in Plate I), cut in the midline: the brain with the
    olfactory bulb and tract under its frontal lobe, the cribriform plate, the olfactory epithelium on the roof
    of the cleft, the nasal airway with its three conchae, and the palate. An odorant waits below the naris; in
    the sniff frame it is drawn up the vestibule into the cleft. Transparent outside the silhouette."""
    import math
    OX = 4
    W, H = 52, 46
    g = Grid(W, H)
    T = lambda pts: [(x + OX, y) for x, y in pts]
    # ---- the head: facial profile on the left, rounded cranium on the right, cut below the upper lip ----
    face = [(21.5, 2.6), (18, 5), (16, 8.5), (15.4, 10.8), (17.2, 13.4), (15.4, 15.6), (12.6, 19.4), (10.2, 22.4),
            (7.6, 25.8), (4.6, 28.6), (2.8, 30.4), (3.0, 32.6), (5.0, 33.9), (8.4, 33.7), (11.2, 33.9), (13, 34.6),
            (14, 36.4), (13.2, 38.6), (14.2, 40.8), (16, 42)]
    cx, cy, rx, ry = 29.5, 21.6, 18.0, 20.4
    arc = [(cx + rx * math.cos(math.radians(t)), cy - ry * math.sin(math.radians(t))) for t in range(-80, 112, 4)]
    g.poly(T(face + [(24, 42.6)] + arc), "T")
    # ---- the brain (frontal lobe over the anterior cranial fossa, deeper behind) ----
    brain = Grid(W, H)
    brain.ellipse(cx + OX + 0.6, cy - 0.4, rx - 2.6, ry - 2.6, "X")
    floor = lambda x: 15.6 if x < 30 + OX else 15.6 + (x - 30 - OX) * 0.95
    for y in range(H):
        for x in range(W):
            if brain.g[y][x] == "X" and (y + 0.5 > floor(x) or x < 19.5 + OX):
                brain.g[y][x] = "."
    inner = [(x, y) for y in range(H) for x in range(W) if brain.g[y][x] == "X"]
    brain.outline({"X"}, "K")
    for x, y in inner:
        g.set(x, y, "B" if brain.g[y][x] == "K" else "L")
    # gyri: a few folds
    for pts in [[(24, 6), (26, 5), (28, 6)], [(31, 5), (33, 6), (34, 8)], [(37, 9), (39, 11), (40, 14)],
                [(27, 9), (29, 10), (31, 9)], [(34, 12), (36, 13), (37, 16)], [(22, 10), (23, 12)]]:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            g.line(x0 + OX, y0, x1 + OX, y1, "B")
    # frontal sinus behind the brow
    g.ellipse(18.0 + OX, 9.2, 1.4, 2.2, "W")
    # nasal bone and the dorsal cartilage, under the skin of the dorsum
    g.line(16 + OX, 13, 12 + OX, 19, "B")
    g.line(11 + OX, 20, 7 + OX, 26, "L")
    g.line(6 + OX, 27, 5 + OX, 29, "L")
    # the alar cartilage: the wing of the nostril, a curl above the naris
    g.pts(T([(5, 31), (6, 30), (7, 29), (8, 29), (9, 29), (10, 30), (11, 31), (11, 32)]), "B")
    # ---- the airway: naris -> vestibule -> cavity -> choana -> nasopharynx (paper) ----
    cav = [(13.4, 33.8), (13.6, 28.6), (15.6, 23.6), (18.0, 20.0), (19.8, 17.8), (29, 17.8), (31.0, 20.4), (32.0, 25),
           (32.8, 30.5), (33.4, 36), (34.0, 43), (30.4, 43), (30.0, 36.6), (29.0, 33.8)]
    g.poly(T(cav), "W")
    # the vestibule: a narrow passage from the naris up into the cavity (wider while sniffing)
    nw = 1.4 if sniff else 0.9
    g.poly(T([(7.6 - nw, 34.2), (10.4 + nw, 34.2), (14.2, 30.4), (14.2, 27.6)]), "W")
    # hard palate (bone, hatched) and the soft palate hanging behind it
    g.poly(T([(11, 33.8), (29.6, 33.8), (31.4, 36.4), (12.4, 35.8)]), "B")
    for x in range(OX + 10, OX + 33):
        if g.get(x, 35) == "B" and x % 2:
            g.set(x, 35, "L")
    # ---- three conchae (scroll bones of the lateral wall): plump, blunt in front, tapering behind; the meatuses
    # between them are narrow slots of air ----
    conchae = [(13.0, 32.0, 30.7, 2.0), (15.2, 31.6, 25.7, 2.0), (19.0, 30.6, 21.4, 1.5)]
    for x0, x1, yc, ry in conchae:
        tmp = Grid(W, H)
        tmp.ellipse((x0 + x1) / 2 + OX, yc, (x1 - x0) / 2, ry, "X")
        cols = {}
        for y in range(H):
            for x in range(W):
                if tmp.g[y][x] == "X" and g.get(x, y) == "W":
                    cols.setdefault(x, []).append(y)
        for x, ys in cols.items():
            for y in ys:
                g.set(x, y, "K" if y == min(ys) else ("B" if y == max(ys) else "L"))
        # the blunt front end curls down, and the scroll's free edge is inked
        fx = min(cols)
        g.set(fx, max(cols[fx]) + 1, "B") if g.get(fx, max(cols[fx]) + 1) == "W" else None
        for y in cols[fx]:
            g.set(fx, y, "K")
    # ---- roof of the cleft: the cribriform plate (perforated) over the olfactory epithelium (stippled) ----
    for x in range(OX + 17, OX + 30):
        g.set(x, 16, "K" if x % 3 else "B")
        g.set(x, 17, "B")
        g.set(x, 18, "B" if x % 2 else "W")
    # ---- olfactory bulb on the plate, and its tract running back under the brain ----
    tr = Grid(W, H)
    tr.poly(T([(26, 13.2), (34, 11.6), (35.6, 12.8), (27.6, 15.2)]), "X")
    tr.ellipse(22.8 + OX, 14.4, 5.4, 1.9, "X")
    inner = [(x, y) for y in range(H) for x in range(W) if tr.g[y][x] == "X"]
    tr.outline({"X"}, "K")
    for x, y in inner:
        g.set(x, y, "K" if tr.g[y][x] == "K" else "B")
    g.pts(T([(20, 14), (22, 14), (24, 14), (26, 14), (21, 15), (23, 15), (25, 15)]), "W")   # glomeruli
    # ---- outlines: the head's silhouette in ink; the airway edged in mid ink ----
    g.outline(set("TBWLK"), "K")
    edge = [(x, y) for y in range(H) for x in range(W)
            if g.get(x, y) == "W" and any(g.get(x + a, y + b) == "T" for a, b in [(1, 0), (-1, 0), (0, 1), (0, -1)])]
    for x, y in edge:
        g.set(x, y, "B")
    # the naris: an opening in the underside of the nose
    for x in range(OX + 5, OX + 12):
        if g.get(x, 33) == "K" and g.get(x, 32) in "WB" and g.get(x, 34) == ".":
            g.set(x, 33, ".")
    # ---- the sniff: an odorant below the naris, drawn up the vestibule to the cleft ----
    if sniff:
        odorant(g, 1, 36)
        for x, y in T([(8, 31), (9, 28), (12, 24), (14, 21), (16, 19)]):
            if g.get(x, y) in "W":
                g.set(x, y, "K")
        g.pts([(0, 33), (1, 34), (3, 33)], "L")
    else:
        odorant(g, 0, 37)
    for x, y in T([(19, 19), (22, 19), (25, 19), (28, 19)] if sniff else [(20, 19), (26, 19)]):
        g.set(x, y, "K")
    return g.rows()


def trim(frames):
    """drop rows and columns that are empty in every frame (keeps frames aligned)"""
    h, w = len(frames[0]), len(frames[0][0])
    rows = [j for j in range(h) if any(f[j][i] != "." for f in frames for i in range(w))]
    cols = [i for i in range(w) if any(f[j][i] != "." for f in frames for j in range(h))]
    return [[f[j][cols[0]:cols[-1] + 1] for j in range(rows[0], rows[-1] + 1)] for f in frames]


def main():
    data = json.loads(SPRITES.read_text(encoding="utf-8"))
    rest, sniff = trim([nose_section(sniff=False), nose_section(sniff=True)])
    data["mascot"] = {"fps": 2, "frames": [rest, sniff]}
    data["neutron"] = {"fps": 1, "frames": [[".KKK.", "KBBBK", "KBTBK", "KBBBK", ".KKK."]]}
    data["spike"] = {"fps": 8, "frames": [["..K..", ".KBK.", "KBWBK", ".KBK.", "..K.."],
                                          ["..K..", ".KLK.", "KLWLK", ".KLK.", "..K.."]]}
    SPRITES.write_text("{\n" + ",\n".join(f' "{k}": ' + json.dumps(v, separators=(",", ":")) for k, v in data.items())
                       + "\n}\n", encoding="utf-8")
    for r in rest:
        print(r)


if __name__ == "__main__":
    main()
