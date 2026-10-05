"""Pixel sprites for the realism pass (classical, offline, presentation only).

Draws, as aliased pixel art in the shared ink palette (K B L T W, O only for a lit lamp):
  fly      a male Drosophila melanogaster, dorsal view, at about 0.74 px per drawing unit (40 units = 1 mm): the
           same anatomy as the page's FIG. 1A (web/template.html): compound eyes with a facet dither, three ocelli,
           antennae with plumose aristae, head and thoracic macrochaetae (humeral, presutural, notopleural,
           supra-alar, postalar, 2 pairs of dorsocentrals, basal and crossing apical scutellars), wings with
           veins L1-L6 and both crossveins over a see-through membrane, halteres, six legs, banded abdomen with the
           male's dark A5-A6. The hub mascot is frame 0 of this sprite.
  flyIcon  the same fly, small, for the status line: rest, two wing-beat frames, grooming.
  signal   an upper-quadrant railway semaphore that replaces the old cartoon conductor: arm level (stop) or
           raised (clear), lamp dark or lit.

Writes the three sprites into web/sprites.json, keeping the other sprites (trains, lamps, puffs, sparks).
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
IDX = {".": 0, "K": 1, "B": 2, "L": 3, "T": 4, "W": 5, "O": 6}
CH = {v: k for k, v in IDX.items()}
LIGHTER = {0: 5, 1: 2, 2: 3, 3: 4, 4: 5, 5: 5, 6: 6}   # what shows through a wing membrane

FW_L, HINGE, REST = 76, (13.2, -5), 0.36
WING = [(0, -.02), (.06, -.06), (.18, -.1), (.36, -.135), (.56, -.155), (.74, -.16), (.87, -.145), (.96, -.105), (1, -.04), (1, .03),
        (.97, .1), (.9, .18), (.79, .25), (.64, .29), (.48, .29), (.34, .255), (.23, .205), (.15, .15), (.12, .185), (.08, .175), (.05, .12), (.02, .05)]
VEINS = {"L1": [(.05, -.04), (.25, -.105), (.44, -.146)], "L2": [(.16, -.055), (.45, -.105), (.79, -.157)], "L3": [(.1, -.03), (.55, -.045), (.995, -.03)],
         "L4": [(.08, 0), (.5, .05), (.99, .07)], "L5": [(.07, .03), (.38, .14), (.7, .275)], "ACV": [(.4, -.041), (.4, .041)], "PCV": [(.62, .057), (.572, .222)]}
LEGS = {"fore": [(-4.5, -20), (-16, -28), (-24.5, -41), (-31, -53)], "mid": [(-7, -9), (-24, -13), (-37, -3), (-46, 9)],
        "hind": [(-7, 1), (-21, 14), (-29, 30), (-34, 45)]}
GROOM = [(-4.5, -20), (-15.5, -31), (-12.5, -46), (-4, -43.5)]


def smooth(P, closed, per=6):
    """The page's quadratic-midpoint smoothing, sampled to a polyline."""
    n = len(P)
    pts = []

    def quad(a, c, b):
        for k in range(per):
            t = k / per
            pts.append(((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]))
    if closed:
        mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        for k in range(1, n + 1):
            quad(mid(P[k - 1], P[k % n]), P[k % n], mid(P[k % n], P[(k + 1) % n]))
        return pts
    pts.append(P[0])
    prev = P[0]
    for k in range(1, n - 1):
        m = ((P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2)
        quad(prev, P[k], m)
        prev = m
    pts.append(P[-1])
    return pts


def sym(half):
    return half + [(-x, y) for x, y in reversed(half[1:-1])]


def bez(P, n=10):
    if len(P) == 2:
        return list(P)
    a, c, b = P
    return [((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]) for t in (k / n for k in range(n + 1))]


class Canvas:
    def __init__(self, w, h, p, ox, oy):
        self.img = Image.new("L", (w, h), 0)
        self.d = ImageDraw.Draw(self.img)
        self.p, self.ox, self.oy = p, ox, oy

    def P(self, x, y):
        return (round(self.ox + x * self.p), round(self.oy + y * self.p))

    def poly(self, pts, fill, outline=None):
        q = [self.P(*a) for a in pts]
        self.d.polygon(q, fill=IDX[fill], outline=IDX[outline] if outline else None)

    def line(self, pts, col, w=1):
        self.d.line([self.P(*a) for a in pts], fill=IDX[col], width=w)

    def ellipse(self, cx, cy, rx, ry, fill, outline=None, rot=0.0):
        pts = [(cx + rx * math.cos(a) * math.cos(rot) - ry * math.sin(a) * math.sin(rot), cy + rx * math.cos(a) * math.sin(rot) + ry * math.sin(a) * math.cos(rot))
               for a in (2 * math.pi * k / 40 for k in range(40))]
        self.poly(pts, fill, outline)

    def dot(self, x, y, col):
        X, Y = self.P(x, y)
        if 0 <= X < self.img.width and 0 <= Y < self.img.height:
            self.img.putpixel((X, Y), IDX[col])

    def mask_of(self, pts):
        m = Image.new("1", self.img.size, 0)
        ImageDraw.Draw(m).polygon([self.P(*a) for a in pts], fill=1)
        return m

    def rows(self):
        px = self.img.load()
        return ["".join(CH[px[x, y]] for x in range(self.img.width)) for y in range(self.img.height)]


def wing_pt(sg, th, u, v, Ls=1.0):
    L = FW_L * Ls
    d = (sg * math.sin(th), math.cos(th))
    n = (-sg * math.cos(th), math.sin(th))
    return (sg * HINGE[0] + L * (u * d[0] + v * n[0]), HINGE[1] + L * (u * d[1] + v * n[1]))


def draw_fly(p, pose="rest", detail=True):
    """pose: rest, up (wings raised and foreshortened), down (wings low and back), groom."""
    W, H = round(118 * p) + 4, round(130 * p) + 4
    c = Canvas(W, H, p, W / 2, 61 * p + 2)
    # legs (under the body)
    for sg in (-1, 1):
        legs = ["mid", "hind"] + ([] if pose == "groom" else ["fore"])
        for name in legs:
            P = [(sg * x, y) for x, y in LEGS[name]]
            c.line(P[:2], "K", max(1, round(2.4 * p)))
            c.line(P[1:], "K", 1)
            if detail and name == "fore":                      # the sex comb: a dark notch on the first tarsal segment
                a, b = P[2], P[3]
                c.dot(a[0] + (b[0] - a[0]) * .1 - sg * .9, a[1] + (b[1] - a[1]) * .1, "K")
    # abdomen: tint tergites, dark posterior bands (A2-A4), the male's dark A5-A6
    ab = smooth(sym([(0, 8), (8, 9), (12.5, 15), (13.6, 24), (12.7, 33.5), (10.2, 41.5), (6.2, 47.4), (0, 49.6)]), True)
    c.poly(ab, "T", "K")
    m = c.mask_of(ab)
    mg = [14.2, 21.2, 28, 34.6, 40.8, 46.4]
    px = c.img.load()
    for Y in range(c.img.height):
        for X in range(c.img.width):
            if not m.getpixel((X, Y)) or px[X, Y] == IDX["K"]:
                continue
            y = (Y - c.oy) / p
            x = (X - c.ox) / p
            curve = 2.6 * (1 - (x / 15) ** 2)          # tergite margins bow backwards at the midline
            yy = y - curve
            if yy >= mg[3] - .2:
                px[X, Y] = IDX["K"] if (X + Y) % 2 == 0 else IDX["B"]
            elif any(mg[k] - 3.4 <= yy < mg[k] for k in (1, 2, 3)):
                px[X, Y] = IDX["B"]
            elif abs(x) > 10.5 and (X + Y) % 2 == 0:
                px[X, Y] = IDX["L"]
    # halteres
    for sg in (-1, 1):
        c.line([(sg * 10.6, 3.6), (sg * 14.4, 8.4)], "K", 1)
        c.ellipse(sg * 15.5, 10.2, 1.9, 2.4, "L", "K")
    # wings: see-through membrane (what lies under shows lighter), veins, costa
    for sg in (-1, 1):
        if pose == "up":
            th, Ls = 1.38, .55
        elif pose == "down":
            th, Ls = .62, 1.0
        else:
            th, Ls = REST, 1.0
        outline = [wing_pt(sg, th, u, v, Ls) for u, v in smooth(WING, True)]
        wm = c.mask_of(outline)
        for Y in range(c.img.height):
            for X in range(c.img.width):
                if wm.getpixel((X, Y)):
                    px[X, Y] = LIGHTER[px[X, Y]]
        if detail:
            for k, V in VEINS.items():
                c.line([wing_pt(sg, th, u, v, Ls) for u, v in bez(V)], "B", 1)
        c.line(outline + [outline[0]], "B", 1)
        c.line([wing_pt(sg, th, u, v, Ls) for u, v in WING[:10]], "K", 1)       # costa
    # thorax (scutum with humeral calli) and scutellum
    sc = smooth(sym([(0, -25.6), (6.5, -25.2), (11.2, -23.3), (14.1, -19.4), (15.5, -13), (15.7, -6.5), (14.7, -.8), (12.3, 3.4), (8.6, 6.1), (4, 6.6), (0, 6.7)]), True)
    c.poly(sc, "W", "K")
    sm = c.mask_of(sc)
    for Y in range(c.img.height):
        for X in range(c.img.width):
            if sm.getpixel((X, Y)) and px[X, Y] == IDX["W"]:
                x = (X - c.ox) / p
                e = abs(x) / 15.5
                if e > .62 and (X * 3 + Y) % 3 == 0 or e > .82 and (X + Y) % 2 == 0:
                    px[X, Y] = IDX["L"]
                elif abs(abs(x) - 6.2) < 1.0 and Y % 2 == 0:
                    px[X, Y] = IDX["T"]
    if detail:                                         # acrostichal microchaetae, as dotted rows
        for x in (-3, -1, 1, 3):
            for y in range(-22, 2, 4):
                c.dot(x, y, "B")
    for sg in (-1, 1):
        c.ellipse(sg * 12.4, -20.6, 3.1, 2.5, "W", "K", rot=sg * .5)
    scl = smooth(sym([(0, 6.4), (8.6, 6), (7.6, 10.4), (4.6, 13.7), (0, 15.1)]), True)
    c.poly(scl, "W", "K")
    # macrochaetae
    for sg in (-1, 1):
        S = lambda a, b, d, e: c.line([(sg * a, b), (sg * d, e)], "K", 1)
        if detail:
            S(12.6, -21.3, 16.9, -24.9); S(11.5, -18.8, 16.3, -19.4); S(13.6, -14.8, 17.7, -12.5)
            S(14.9, -11.6, 19.4, -10); S(15.2, -8.6, 19.7, -6); S(13.6, -5, 17.6, -.8); S(12.4, -1.8, 15.9, 3.4)
            S(11.2, 1.4, 14.1, 6.8); S(9.8, 3.4, 11.7, 9.2)
        S(6.2, -6, 6.9, 3); S(5.8, .8, 6.4, 10.2)                           # dorsocentrals
        S(7.4, 7.6, 12.6, 15.2); S(3, 12.6, -5.6, 24.2)                     # basal and crossing apical scutellars
    # head: capsule, eyes (facet dither), frons, ocelli, antennae and aristae, head bristles
    hd = smooth(sym([(0, -41.2), (3, -41.6), (9, -41.9), (15, -40.6), (18, -37.6), (18.7, -32.6), (16.8, -28.6), (12, -26.9), (6, -26.7), (0, -26.3)]), True)
    c.poly(hd, "W", "K")
    for sg in (-1, 1):
        eye = [(sg * (12.6 + 6.25 * math.cos(a) * math.cos(.18) - 7.65 * math.sin(a) * math.sin(.18)), -34.1 + 6.25 * math.cos(a) * math.sin(.18) + 7.65 * math.sin(a) * math.cos(.18))
               for a in (2 * math.pi * k / 40 for k in range(40))]
        em = c.mask_of(eye)
        for Y in range(c.img.height):
            for X in range(c.img.width):
                if em.getpixel((X, Y)):
                    x = (X - c.ox) / p
                    outer = sg * x > 14.5
                    hexa = (X + 2 * (Y % 2)) % 3 == 0 if detail else (X + Y) % 2 == 0
                    px[X, Y] = IDX["B"] if (hexa or (outer and (X + Y) % 2 == 0)) else IDX["L"]
        c.line(eye + [eye[0]], "K", 1)
        if detail:
            c.line([(sg * 5.4, -37.6), (sg * 4.1, -44.2)], "K", 1)                                    # proclinate orbital
            c.line([(sg * 5, -27.4), (sg * 2.6, -21.2)], "K", 1); c.line([(sg * 8.2, -27.2), (sg * 11.8, -21.6)], "K", 1)   # verticals
            c.line([(sg * 1.2, -30.8), (sg * 4.4, -37.4)], "K", 1)                                    # ocellar
        # antenna and arista
        c.ellipse(sg * 2.75, -45.1, 1.55, 2.6, "T", "K", rot=sg * .25)
        a0, ad, aL = (sg * 3.4, -45.6), (sg * .55, -.835), 12.5
        c.line([a0, (a0[0] + ad[0] * aL, a0[1] + ad[1] * aL)], "K", 1)
        if detail:
            for k in range(4):
                f = .3 + k * .17
                x, y = a0[0] + ad[0] * aL * f, a0[1] + ad[1] * aL * f
                c.line([(x, y), (x + (ad[0] * .5 - ad[1] * .87 * sg) * 2.6, y + (ad[1] * .5 + ad[0] * .87 * sg) * 2.6)], "B", 1)
    if detail:
        for x, y in ((0, -31.7), (-1.75, -29.3), (1.75, -29.3)):     # three ocelli
            c.dot(x, y, "K")
    else:
        c.dot(0, -30.5, "B")
    if pose == "groom":
        for sg in (-1, 1):
            P = [(sg * x, y) for x, y in GROOM]
            c.line(P[:2], "K", max(1, round(2.4 * p)))
            c.line(P[1:], "K", 1)
    return c.rows()


def crop(frames):
    """Trim the transparent margin shared by all frames (keeps frames aligned)."""
    h, w = len(frames[0]), len(frames[0][0])
    ys = [y for y in range(h) if any(f[y].strip(".") for f in frames)]
    xs = [x for x in range(w) if any(f[y][x] != "." for f in frames for y in range(h))]
    y0, y1, x0, x1 = ys[0], ys[-1] + 1, xs[0], xs[-1] + 1
    return [[r[x0:x1] for r in f[y0:y1]] for f in frames]


def draw_signal(raised, lit):
    """An upper-quadrant semaphore, 24 x 42 px: post with a finial, ladder, lamp, and a striped arm on a pivot."""
    img = Image.new("L", (24, 42), 0)
    d = ImageDraw.Draw(img)
    K, B, L, T, W, O = (IDX[k] for k in "KBLTWO")
    d.rectangle([12, 6, 15, 38], fill=L, outline=K)                    # post
    d.line([(13, 7), (13, 37)], fill=T)
    d.polygon([(11, 6), (16, 6), (13, 1), (14, 1)], fill=B, outline=K)  # finial cap
    for x in (18, 21):                                                  # ladder
        d.line([(x, 14), (x, 38)], fill=K)
    for y in range(16, 38, 3):
        d.line([(18, y), (21, y)], fill=B)
    d.rectangle([15, 10, 19, 15], fill=B, outline=K)                   # lamp case behind the spectacle
    d.rectangle([16, 11, 18, 13], fill=O if lit else T)
    if lit:
        d.point([(19, 12), (20, 12)], fill=O)
    d.rectangle([7, 38, 20, 41], fill=B, outline=K)                    # plinth
    px, py = 12, 9                                                     # arm pivot
    ang = -math.radians(45) if raised else 0.0
    def R(x, y):
        dx, dy = x - px, y - py
        return (round(px + dx * math.cos(ang) - dy * math.sin(ang)), round(py + dx * math.sin(ang) + dy * math.cos(ang)))
    arm = [R(1, 8), R(px, 8), R(px, 10), R(1, 10)]
    d.polygon(arm, fill=W, outline=K)
    d.line([R(3, 8), R(3, 10)], fill=B)                                 # the stripe near the blade's end
    d.line([R(4, 8), R(4, 10)], fill=B)
    d.ellipse([px - 1, py - 1, px + 1, py + 1], fill=K)                # pivot
    rows = ["".join(CH[img.getpixel((x, y))] for x in range(img.width)) for y in range(img.height)]
    return rows


def main():
    path = HERE / "web" / "sprites.json"
    sp = json.loads(path.read_text(encoding="utf-8"))
    big = crop([draw_fly(0.74, "rest")])
    sp["fly"] = {"about": "Drosophila melanogaster, male, dorsal view, drawn by fly_sprite.py from the same anatomy as FIG. 1A "
                          "(40 units = 1 mm, about 0.74 px per unit). The hub mascot is frame 0.", "frames": big, "fps": 1}
    icon = crop([draw_fly(0.235, pz, detail=False) for pz in ("rest", "up", "down", "groom")])
    sp["flyIcon"] = {"about": "The same fly, small, for the status line. Frames: rest, wing beat up, wing beat down, grooming (decoration).",
                     "frames": icon, "fps": 12}
    sp["signal"] = {"about": "Departure signal: an upper-quadrant railway semaphore. Frames: arm level (stop), arm raised (clear), "
                             "level with the lamp lit, raised with the lamp lit (riding). Lamp light is the only warm colour.",
                    "frames": [draw_signal(r, l) for l, r in ((False, False), (False, True), (True, False), (True, True))], "fps": 1}
    sp.pop("conductor", None)
    order = ["fly", "flyIcon", "signal", "steam", "puff", "maglev", "blueprint", "hardware", "lampOn", "lampOff", "spark"]
    out = {k: sp[k] for k in order if k in sp}
    out.update({k: v for k, v in sp.items() if k not in out})
    path.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    for k in ("fly", "flyIcon", "signal"):
        f = out[k]["frames"][0]
        print(f"{k}: {len(f[0])} x {len(f)} px, {len(out[k]['frames'])} frames")


if __name__ == "__main__":
    main()
