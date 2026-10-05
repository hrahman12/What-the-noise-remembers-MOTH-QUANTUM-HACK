"""Draw the realistic plates of Moth Eye as SVG ink engravings, in the shared palette.

Classical drawing only (no Atlas calls, no photos traced or embedded). Every shape is generated from
geometry written down from published descriptions and measurements (see CREDITS.md):

  head      a hawkmoth (Sphingidae) head in profile, facing right: scaled head capsule, compound eye,
            upcurved labial palp, coiled proboscis, scape + pedicel + annulated flagellum, collar and
            thorax scales, fore- and midleg on a twig. Units are millimetres. The eye's size comes from
            Manduca sexta numbers: ~27,000 facets of 30 um -> ~21 mm^2 -> a ~1.85 mm radius dome.
            The facet mesh on the head is drawn ~4x coarser than real so it reads at screen size.
  mosaic    the eye surface at ~x300: hexagonal facet lenses 30 um across (inset in the scene).
  bat       a flying big brown bat (Eptesicus fuscus) seen from below (3 wingbeat frames): forearm, thumb claw,
            digits 2-5, dactylo-/plagiopatagium, uropatagium with calcar, short round-tipped ears with tragus.
  batface   the same bat's head in profile (ribbed ear, rounded tragus, bare snout, open mouth with canines);
            the page draws its eye and the lid that opens in 8 steps (the meter).
  bulb      an incandescent lamp: glass envelope, coiled tungsten filament on lead-in and support wires,
            glass stem, Edison screw base with insulator and foot contact.
  omma      plate: superposition-eye ommatidia cut lengthwise (Yang et al. 2024 numbers for structure).
  nipples   plate: the corneal nipple array, top view (~200 nm pitch, a 5-7 defect) and side view against
            the wavelengths of visible light.

Outputs: web/data/plates.json (SVG fragments + anchors the page uses), qa/plates/*.svg previews for
checking (render them with render/svgshot.cjs), and the mascot rows ("mothhead") that make_sprites.py writes
into web/sprites.json.
Usage: python make_plates.py
"""
import json
import math
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAL = {"K": "#19238E", "B": "#545BA9", "L": "#A1A4CE", "T": "#D3D3E6", "W": "#FBFAF9", "O": "#B4541A"}
LIGHT = (0.38, -0.55, 0.74)          # fixed engraving light: upper right, in front (x right, y down, z to viewer)
_n = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _n for c in LIGHT)


# ---------------------------------------------------------------------------------------------- vector art
class Art:
    """A list of shapes in model units; emits compact SVG (integer coordinates at `scale` per unit).
    One item may hold several subpaths (closed outlines and open strokes) that share one fill and stroke,
    which keeps a plate of thousands of scales small. Strokes equal to the default (K, `sw0`) are inherited
    from the wrapping <g>."""

    def __init__(self, scale, sw0=0.012):
        self.s = scale
        self.sw0 = sw0
        self.items = []

    def multi(self, subs, fill=None, stroke="K", sw=None, op=None):
        subs = [(list(map(tuple, pts)), close) for pts, close in subs if len(pts) >= 2]
        if subs:
            self.items.append(("p", subs, fill, stroke, self.sw0 if sw is None else sw, op))

    def poly(self, pts, fill=None, stroke="K", sw=None, close=True, op=None):
        self.multi([(pts, close)], fill, stroke, sw, op)

    def line(self, pts, stroke="K", sw=None, op=None):
        self.multi([(pts, False)], None, stroke, sw, op)

    def circle(self, c, r, fill=None, stroke="K", sw=None):
        n = max(10, int(2 * math.pi * r * self.s / 3))
        self.poly([(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)], fill, stroke, sw)

    def raw(self, svg):
        self.items.append(("raw", svg))

    def d(self, pts, close):
        s = self.s
        q = [(round(x * s), round(y * s)) for x, y in pts]
        out, last = [f"M{q[0][0]} {q[0][1]}".replace(" -", "-")], q[0]
        rel = []
        for p in q[1:]:
            dx, dy = p[0] - last[0], p[1] - last[1]
            if dx or dy:
                rel.append(f"{dx} {dy}")
            last = p
        if rel:
            out.append(("l" + " ".join(rel)).replace(" -", "-"))
        if close:
            out.append("z")
        return "".join(out)

    def svg(self):
        parts = []
        w0 = round(self.sw0 * self.s, 2)
        for it in self.items:
            if it[0] == "raw":
                parts.append(it[1])
                continue
            _, subs, fill, stroke, sw, op = it
            d = "".join(self.d(pts, close) for pts, close in subs)
            a = [f'd="{d}"']
            if fill != "K":
                a.append(f'fill="{PAL[fill]}"' if fill else 'fill="none"')
            wv = round(sw * self.s, 2)
            if not stroke:
                a.append('stroke="none"')
            else:
                if stroke != "K":
                    a.append(f'stroke="{PAL[stroke]}"')
                if wv != w0:
                    a.append(f'stroke-width="{wv:g}"')
            if op is not None:
                a.append(f'opacity="{op:g}"')
            parts.append("<path " + " ".join(a) + "/>")
        # default fill K and stroke K at the hairline width come from the wrapping group
        return f'<g fill="{PAL["K"]}" stroke="{PAL["K"]}" stroke-width="{w0:g}">' + "".join(parts) + "</g>"


# ---------------------------------------------------------------------------------------------- geometry helpers
def catmull(cp, n=10):
    """Dense Catmull-Rom polyline through control points."""
    pts = [cp[0]] + list(cp) + [cp[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    out.append(cp[-1])
    return out


def resample(line, step):
    """Polyline -> points every `step` along it, with cumulative fractions."""
    seg = [math.dist(line[i], line[i + 1]) for i in range(len(line) - 1)]
    L = sum(seg)
    n = max(2, int(L / step) + 1)
    out, i, acc = [], 0, 0.0
    for k in range(n):
        target = L * k / (n - 1)
        while i < len(seg) - 1 and acc + seg[i] < target:
            acc += seg[i]
            i += 1
        u = 0 if seg[i] == 0 else (target - acc) / seg[i]
        u = min(1, max(0, u))
        out.append((line[i][0] + (line[i + 1][0] - line[i][0]) * u, line[i][1] + (line[i + 1][1] - line[i][1]) * u))
    return out, L


def frames_along(pts):
    """Tangent and left-normal at each point of a polyline."""
    out = []
    for i in range(len(pts)):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        m = math.hypot(dx, dy) or 1
        out.append(((dx / m, dy / m), (-dy / m, dx / m)))
    return out


def tube(center, hw, step=0.03):
    """Outline polygon, sample points, frames and half widths of a tube with half-width function hw(t)."""
    pts, L = resample(center, step)
    fr = frames_along(pts)
    n = len(pts)
    ws = [hw(i / (n - 1)) for i in range(n)]
    left = [(p[0] + f[1][0] * w, p[1] + f[1][1] * w) for p, f, w in zip(pts, fr, ws)]
    right = [(p[0] - f[1][0] * w, p[1] - f[1][1] * w) for p, f, w in zip(pts, fr, ws)]
    return {"pts": pts, "fr": fr, "w": ws, "L": L, "outline": left + right[::-1], "left": left, "right": right}


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def ellipse_pts(cx, cy, rx, ry, n=64, rot=0.0):
    c, s = math.cos(rot), math.sin(rot)
    return [(cx + rx * math.cos(2 * math.pi * i / n) * c - ry * math.sin(2 * math.pi * i / n) * s,
             cy + rx * math.cos(2 * math.pi * i / n) * s + ry * math.sin(2 * math.pi * i / n) * c) for i in range(n)]


def norm3(v):
    m = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / m for c in v)


def lambert(n):
    return max(0.0, sum(a * b for a, b in zip(n, LIGHT)))


def tone(s, ramp="WTLBK"):
    """Shade value 0..1 (1 = lit) -> palette key."""
    cuts = [0.80, 0.58, 0.36, 0.14]
    for c, k in zip(cuts, ramp):
        if s >= c:
            return k
    return ramp[-1]


def scale_shape(p, ang, l, w, teeth=True):
    """One lepidopteran scale: narrow pedicel at the socket, broad blade, toothed apex (local u = length)."""
    loc = [(0, -0.10), (0.22, -0.28), (0.5, -0.48), (0.84, -0.47)]
    if teeth:
        loc += [(0.95, -0.33), (0.9, -0.16), (1.0, -0.02), (1.0, 0.02), (0.9, 0.16), (0.95, 0.33)]
    else:
        loc += [(0.97, -0.25), (1.0, 0.0), (0.97, 0.25)]
    loc += [(0.84, 0.47), (0.5, 0.48), (0.22, 0.28), (0, 0.10)]
    c, s = math.cos(ang), math.sin(ang)
    return [(p[0] + u * l * c - v * w * s, p[1] + u * l * s + v * w * c) for u, v in loc]


def jittered(region, step, rng, jit=0.3, exclude=None):
    xs, ys = [p[0] for p in region], [p[1] for p in region]
    pts, y, row = [], min(ys), 0
    while y <= max(ys):
        x = min(xs) + (step / 2 if row % 2 else 0)
        while x <= max(xs):
            q = (x + rng.uniform(-jit, jit) * step, y + rng.uniform(-jit, jit) * step)
            if inside(q, region) and not (exclude and any(inside(q, e) for e in exclude)):
                pts.append(q)
            x += step
        y += step * 0.866
        row += 1
    return pts


def shade_of(n, rng, amb=0.2, jit=0.08):
    return amb + (1 - amb) * lambert(n) + rng.uniform(-jit, jit)


def scale_field(art, region, flow, normal, l, w, rng, *, key=None, exclude=None, pattern=None, ridge=True,
                jit=0.3, spacing=(0.42, 0.78), ramp="WTLBK", teeth=True, bias=0.0):
    """Cover a polygon with overlapping scales. flow(p) -> angle the scale points to; normal(p) -> 3D normal.
    Scales nearer their origin are drawn last, so their blades cover the sockets of the next row, as on a wing.
    Each scale carries two longitudinal ridges (real scales are ribbed) in the same path."""
    step = math.sqrt(l * spacing[0] * w * spacing[1])
    rows = []
    for q in jittered(region, step, rng, jit, exclude):
        a = flow(q) + rng.uniform(-0.12, 0.12)
        rows.append((key(q) if key else 0, q, a))
    rows.sort(key=lambda r: -r[0])
    for _, q, a in rows:
        n = normal(q)
        tilt = 0.15 * (math.cos(a) * LIGHT[0] + math.sin(a) * LIGHT[1])   # a scale lifts off the surface toward its tip
        s = shade_of(n, rng, 0.3) + tilt + bias
        if pattern:
            s = pattern(q, s)
        f = tone(s, ramp)
        ll, ww = l * rng.uniform(0.85, 1.15), w * rng.uniform(0.85, 1.12)
        subs = [(scale_shape(q, a, ll, ww, teeth), True)]
        if ridge and f in "WTL":
            c, s_ = math.cos(a), math.sin(a)
            for v in (-0.17, 0.17):
                subs.append(([(q[0] + 0.5 * ll * c - v * ww * s_, q[1] + 0.5 * ll * s_ + v * ww * c),
                              (q[0] + 0.84 * ll * c - v * ww * s_, q[1] + 0.84 * ll * s_ + v * ww * c)], False))
        art.multi(subs, fill=f, stroke="B" if f in "WTL" else "K")


def hair_field(art, region, flow, normal, length, rng, *, step, pattern=None, exclude=None, curl=0.3, sw=0.03,
               amb=0.15, base="T", hi=True, dens=1.0):
    """Fur engraving: a pale base fill, then curved ink strokes along the flow. Tone comes from stroke density and
    weight (more and darker strokes in shadow), with a few paper-white strokes catching the light."""
    if base:
        art.poly(region, fill=base, stroke=None)
    groups = {"B": [], "K": [], "W": [], "L": []}
    for q in jittered(region, step, rng, 0.5, exclude):
        s = shade_of(normal(q), rng, amb, 0.1)
        if pattern:
            s = pattern(q, s)
        dark = max(0.0, min(1.0, 1.0 - s))
        r = rng.random()
        if r < dark * 0.75 * dens:
            col = "K" if rng.random() < dark * 0.9 else "B"
        elif r < (dark * 0.75 + 0.35) * dens:
            col = "L" if s < 0.75 or not hi else "W"
        else:
            continue
        a = flow(q) + rng.uniform(-0.2, 0.2)
        L = length * rng.uniform(0.6, 1.2)
        bend = rng.uniform(-curl, curl)
        m = (q[0] + math.cos(a) * L / 2, q[1] + math.sin(a) * L / 2)
        e = (m[0] + math.cos(a + bend) * L / 2, m[1] + math.sin(a + bend) * L / 2)
        groups[col].append(([q, m, e], False))
    art.multi(groups["L"], None, "L", sw)
    art.multi(groups["W"], None, "W", sw * 0.9)
    art.multi(groups["B"], None, "B", sw)
    art.multi(groups["K"], None, "K", sw * 0.85)


def ellipsoid_normal(cx, cy, rx, ry, rz):
    def f(p):
        x, y = (p[0] - cx) / rx, (p[1] - cy) / ry
        r2 = x * x + y * y
        z = math.sqrt(max(0.02, 1 - r2))
        return norm3((x / rx, y / ry, z / rz))
    return f


def tube_normal(t, idx_of):
    """Normal on a tube at point p: from the nearest centre sample."""
    def f(p):
        i = idx_of(p)
        c, fr, w = t["pts"][i], t["fr"][i], t["w"][i]
        nx, ny = fr[1]
        d = ((p[0] - c[0]) * nx + (p[1] - c[1]) * ny) / max(1e-6, w)
        d = max(-0.97, min(0.97, d))
        return norm3((nx * d, ny * d, math.sqrt(1 - d * d)))
    return f


def nearest_idx(t):
    pts = t["pts"]

    def f(p):
        best, bi = 1e9, 0
        for i in range(0, len(pts)):
            d = (pts[i][0] - p[0]) ** 2 + (pts[i][1] - p[1]) ** 2
            if d < best:
                best, bi = d, i
        return bi
    return f


def shade_tube(art, t, base="L", ring_every=None, ring_col="K", hatch=True, stroke="K", hi=True, sw=None):
    """Fill a tube, then engrave its shadow side (two strokes) and highlight, and optional annuli."""
    art.poly(t["outline"], fill=base, stroke=None)
    pts, fr, ws = t["pts"], t["fr"], t["w"]
    wbar = sum(ws) / len(ws)
    if hatch:
        lines = {"B": [], "K": [], "W": []}
        for i in range(0, len(pts) - 1):
            nx, ny = fr[i][1]
            side = 1 if (nx * LIGHT[0] + ny * LIGHT[1]) < 0 else -1      # the side facing away from the light
            c, w, c2, w2, n2 = pts[i], ws[i], pts[i + 1], ws[i + 1], fr[i + 1][1]
            for f0, col in ((0.55, "B"), (0.82, "K")):
                lines[col].append(([(c[0] + side * nx * w * f0, c[1] + side * ny * w * f0),
                                    (c2[0] + side * n2[0] * w2 * f0, c2[1] + side * n2[1] * w2 * f0)], False))
            if hi:
                lines["W"].append(([(c[0] - side * nx * w * 0.42, c[1] - side * ny * w * 0.42),
                                    (c2[0] - side * n2[0] * w2 * 0.42, c2[1] - side * n2[1] * w2 * 0.42)], False))
        art.multi(lines["B"], None, "B", wbar * 0.34)
        art.multi(lines["K"], None, "K", wbar * 0.2)
        if hi:
            art.multi(lines["W"], None, "W", wbar * 0.14)
    if ring_every:
        rings, acc, last = [], 0.0, pts[0]
        for i in range(1, len(pts)):
            acc += math.dist(pts[i], last)
            last = pts[i]
            if acc >= ring_every:
                acc = 0.0
                nx, ny = fr[i][1]
                c, w = pts[i], ws[i]
                rings.append(([(c[0] + nx * w * 0.97, c[1] + ny * w * 0.97), (c[0] - nx * w * 0.97, c[1] - ny * w * 0.97)], False))
        art.multi(rings, None, ring_col, sw)
    art.poly(t["outline"], fill=None, stroke=stroke, sw=(sw or art.sw0) * 1.4)


# ---------------------------------------------------------------------------------------------- the eye (shared)
EYE = {"c": (0.0, 0.0), "R": 1.85, "axis": norm3((0.28, -0.12, 1.0)), "ds": 0.085}
# ds: angular facet spacing of the drawing (rad). Real: 30 um / 1.85 mm = 0.016 rad, so the drawn mesh is ~5x coarser.


def eye_basis():
    a = EYE["axis"]
    e1 = norm3((a[2], 0, -a[0]))
    e2 = norm3((a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]))
    return a, e1, e2


def eye_dir(u, v):
    a, e1, e2 = eye_basis()
    th, ph = math.hypot(u, v), math.atan2(v, u)
    s, c = math.sin(th), math.cos(th)
    return tuple(c * a[i] + s * (math.cos(ph) * e1[i] + math.sin(ph) * e2[i]) for i in range(3))


def eye_facets(c, R, ds, thmax=1.62):
    n = int((thmax + 0.3) / ds) + 2
    out = []
    for j in range(-n, n + 1):
        for i in range(-n, n + 1):
            u, v = (i + j / 2) * ds, j * ds * 0.8660254
            if math.hypot(u, v) > thmax:                 # the eye wraps a little past a hemisphere
                continue
            d = eye_dir(u, v)
            if d[2] < 0.03:
                continue
            hexv = []
            for k in range(6):
                ang = math.pi / 6 + k * math.pi / 3
                dd = eye_dir(u + ds / math.sqrt(3) * math.cos(ang), v + ds / math.sqrt(3) * math.sin(ang))
                hexv.append((c[0] + R * dd[0], c[1] + R * dd[1]))
            out.append((d, hexv))
    return out


def draw_eye(art):
    """A dark, matte dome tiled with hexagonal facets, foreshortened toward the rim. No glare: that is the point."""
    c, R = EYE["c"], EYE["R"]
    facets = eye_facets(c, R, EYE["ds"])
    hull = convex_hull([p for _, h in facets for p in h])
    art.poly(hull, fill="K", stroke="K", sw=art.sw0 * 2)
    groups = {}
    rng = random.Random(11)
    for d, hexv in facets:
        # smooth matte shading (a little jitter so the tone bands follow the facet rows, not a ruler)
        s = 0.02 + 0.85 * lambert(d) - 0.15 * (1 - d[2]) ** 2 + rng.uniform(-0.025, 0.025)
        f, st = ("L", "B") if s > 0.8 else ("B", "K") if s > 0.58 else ("K", "B")
        groups.setdefault((f, st), []).append((hexv, True))
    for (f, st), subs in groups.items():
        art.multi(subs, fill=f, stroke=st, sw=art.sw0 * 0.9)
    art.poly(hull, fill=None, stroke="K", sw=art.sw0 * 2.2)
    return hull


def convex_hull(pts):
    pts = sorted(set((round(x, 5), round(y, 5)) for x, y in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


# ---------------------------------------------------------------------------------------------- the head plate
HEAD_BOX = (-7.0, -7.4, 11.6, 13.2)     # x, y, w, h in mm (the art is clipped to this frame)


def draw_head(scale=40.0):
    rng = random.Random(3)
    art = Art(scale, sw0=0.012)            # hairline 0.012 mm
    anchors = {}

    # far antenna (the left one, behind the head), lighter ink
    far_c = catmull([(-0.25, -2.3), (-0.75, -3.1), (-1.8, -4.2), (-3.3, -5.2), (-5.2, -5.9), (-7.6, -6.2)], 8)
    ft = tube(far_c, lambda t: 0.14 + 0.08 * min(1, t * 1.6), 0.03)
    shade_tube(art, ft, base="T", ring_every=0.16, ring_col="L", stroke="B", hi=False)

    # thorax: dense hair-scales flowing back from the head; the tegula's edge and a darker collar band
    thor = [(-1.55, -2.15), (-2.5, -3.05), (-4.0, -3.5), (-5.6, -3.6), (-7.3, -3.3), (-7.3, 3.8), (-5.6, 4.15),
            (-3.9, 3.95), (-2.5, 3.25), (-1.65, 2.3), (-1.35, 1.0), (-1.45, -1.0)]
    tn = ellipsoid_normal(-4.6, 0.2, 3.6, 4.0, 3.2)

    def thor_pat(q, s):
        if -3.1 < q[0] < -1.7 and q[1] < -1.2:      # collar (patagia): a dark band behind the head
            return s - 0.3
        e = math.hypot((q[0] + 5.4) / 2.6, (q[1] + 0.9) / 1.6)
        if 0.86 < e < 1:
            return s - 0.4                            # the tegula's rim
        return s
    hair_field(art, thor, lambda q: math.atan2(q[1] - 0.2, q[0] + 1.0) + 0.25 * math.sin(q[1] * 0.9), tn, 0.5, rng,
               step=0.08, pattern=thor_pat, sw=0.03, base="T")

    # twig the moth stands on
    tw = tube(catmull([(-7.6, 5.78), (-3.0, 5.52), (1.0, 5.38), (6.0, 5.2), (11.0, 4.95), (17.0, 4.6)], 6), lambda t: 0.36 - 0.08 * t, 0.08)
    art.poly(tw["outline"], fill="L", stroke="K", sw=art.sw0 * 1.4)
    bark = {"B": [], "K": []}
    for i in range(0, len(tw["pts"]) - 1):
        c, f = tw["pts"][i], tw["fr"][i]
        for v in (-0.7, -0.4, -0.1, 0.2, 0.5, 0.78):
            if rng.random() < 0.5:
                l0 = rng.uniform(0.1, 0.32)
                p0 = (c[0] + f[1][0] * v * 0.36, c[1] + f[1][1] * v * 0.36)
                bark["B" if v < 0.1 else "K"].append(([p0, (p0[0] + f[0][0] * l0, p0[1] + f[0][1] * l0)], False))
    art.multi(bark["B"], None, "B", 0.02)
    art.multi(bark["K"], None, "K", 0.025)

    # legs: femur and tibia (scaled, with a fringe of long scales), five tarsomeres with spines, two claws
    def leg(pts, ws, n_long=2):
        for k in range(len(pts) - 1):
            a, b = ws[k], ws[k + 1]
            seg = tube([pts[k], pts[k + 1]], lambda t, a=a, b=b: (a + (b - a) * t) * (1.0 + 0.12 * math.sin(math.pi * t)), 0.025)
            shade_tube(art, seg, base="T" if k < n_long else "L")
            if k < n_long:   # a fringe of long scales on the outer (lower) edge
                fringe = []
                for i in range(1, len(seg["pts"]) - 1, 2):
                    c, f, w = seg["pts"][i], seg["fr"][i], seg["w"][i]
                    nx, ny = f[1]
                    if nx > 0:
                        nx, ny = -nx, -ny
                    root = (c[0] + nx * w * 0.9, c[1] + ny * w * 0.9)
                    L = rng.uniform(0.12, 0.22) * (1.6 if k == 1 else 1.0)
                    fringe.append(([root, (root[0] + nx * L * 0.5 + f[0][0] * L, root[1] + ny * L * 0.5 + f[0][1] * L)], False))
                art.multi(fringe, None, "B", 0.025)
            else:            # tarsal spines at each joint
                c = pts[k + 1]
                dx, dy = pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]
                m = math.hypot(dx, dy) or 1
                art.line([(c[0], c[1] + 0.03), (c[0] + dx / m * 0.08, c[1] + 0.09)], "K", 0.016)
        tip = pts[-1]
        dx, dy = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
        m = math.hypot(dx, dy)
        dx, dy = dx / m, dy / m
        art.line([tip, (tip[0] + dx * 0.1, tip[1] + dy * 0.1 + 0.03), (tip[0] + dx * 0.11, tip[1] + 0.15)], "K", 0.022)
        art.line([(tip[0] - 0.02, tip[1]), (tip[0] + dx * 0.05, tip[1] + 0.08), (tip[0] + dx * 0.03, tip[1] + 0.17)], "K", 0.02)

    leg([(-3.1, 2.9), (-2.8, 4.25), (-2.05, 5.1), (-1.7, 5.15), (-1.38, 5.16), (-1.1, 5.16), (-0.86, 5.16), (-0.66, 5.17)],
        [0.25, 0.21, 0.15, 0.085, 0.08, 0.075, 0.07, 0.06])
    leg([(-1.25, 2.25), (-1.05, 3.85), (0.32, 4.86), (0.72, 5.0), (1.08, 5.03), (1.4, 5.04), (1.67, 5.03), (1.9, 5.02)],
        [0.23, 0.2, 0.15, 0.08, 0.075, 0.07, 0.065, 0.055])
    anchors["leg"] = (-0.45, 4.42)

    # proboscis: two galeae zipped into one tube, coiled like a watch spring in the head's vertical plane
    cx, cy, Rout, rin, turns = 1.3, 3.38, 1.2, 0.16, 3.6
    sp = []
    N = 520
    for k in range(N + 1):
        u = k / N
        th = -math.pi / 2 + u * turns * 2 * math.pi
        r = Rout - (Rout - rin) * u
        sp.append((cx + r * math.cos(th), cy + r * math.sin(th)))
    pt = tube(catmull([(1.05, 1.95), (1.2, 2.08), sp[0]], 6) + sp[1:], lambda t: 0.115 - 0.035 * t, 0.025)
    shade_tube(art, pt, base="L", ring_every=0.055, ring_col="B")
    anchors["proboscis"] = (cx + Rout * 0.72, cy + Rout * 0.72)

    # head capsule: appressed scales radiating from the eye (frons, vertex, gena, occiput)
    head = [(-1.85, -1.55), (-1.25, -2.4), (-0.3, -2.7), (0.75, -2.6), (1.6, -2.1), (2.15, -1.25), (2.32, -0.2),
            (2.1, 0.95), (1.62, 1.82), (0.8, 2.22), (-0.2, 2.26), (-1.1, 2.0), (-1.7, 1.25), (-2.0, 0.0)]
    scale_field(art, head, lambda q: math.atan2(q[1], q[0]), ellipsoid_normal(0.15, -0.1, 2.6, 2.7, 2.3), 0.28, 0.16, rng,
                key=lambda q: math.hypot(q[0], q[1]), exclude=[ellipse_pts(0, 0, 1.6, 1.7, 48)], spacing=(0.4, 0.74), bias=-0.3)

    # the compound eye
    draw_eye(art)
    anchors["eye"] = EYE["c"]
    anchors["eye_r"] = EYE["R"]

    # collar fringe: long hair-scales of the collar lying over the back of the eye
    fr_reg = [(-1.45, -2.25), (-1.0, -1.7), (-1.25, -0.5), (-1.3, 0.7), (-1.0, 1.7), (-1.6, 2.2), (-2.3, 1.2), (-2.4, -1.2)]
    hair_field(art, fr_reg, lambda q: math.pi + math.atan2(-q[1] * 0.25, 1.0), tn, 0.55, rng, step=0.06, sw=0.028,
               base=None, curl=0.4, amb=0.2, dens=1.3)

    # labial palp: upcurved, densely scaled, flanking the proboscis base
    palp_c = catmull([(0.75, 2.15), (1.6, 1.98), (2.28, 1.25), (2.55, 0.35), (2.45, -0.3)], 10)

    def palp_w(t):
        w = 0.56 + 0.12 * math.sin(math.pi * min(1, t * 1.3))
        if t > 0.82:
            w *= math.sqrt(max(0.0, 1 - ((t - 0.82) / 0.18) ** 2))
        if t < 0.06:
            w *= math.sqrt(max(0.05, 1 - ((0.06 - t) / 0.06) ** 2))
        return w
    pp = tube(palp_c, palp_w, 0.03)
    art.poly(pp["outline"], fill="T", stroke="K", sw=art.sw0 * 1.4)
    idx = nearest_idx(pp)
    scale_field(art, pp["outline"], lambda q: (lambda f: math.atan2(f[0][1], f[0][0]))(pp["fr"][idx(q)]), tube_normal(pp, idx),
                0.26, 0.15, rng, key=lambda q: idx(q), bias=-0.06)
    art.poly(pp["outline"], fill=None, stroke="K", sw=art.sw0 * 1.8)
    anchors["palp"] = pp["pts"][int(len(pp["pts"]) * 0.62)]

    # near antenna: scape, pedicel, then the annulated flagellum (thickening toward the hooked tip, off-frame)
    sc = tube(catmull([(0.32, -2.2), (0.18, -2.62), (0.04, -2.95)], 6), lambda t: 0.3 * math.sqrt(max(0.05, 1 - (2 * t - 1) ** 6)) + 0.02, 0.02)
    art.poly(sc["outline"], fill="T", stroke="K", sw=art.sw0 * 1.4)
    sidx = nearest_idx(sc)
    scale_field(art, sc["outline"], lambda q: -2.0, tube_normal(sc, sidx), 0.16, 0.1, rng, key=lambda q: q[1])
    art.poly(sc["outline"], fill=None, stroke="K", sw=art.sw0 * 1.6)
    shade_tube(art, tube([(0.04, -2.95), (-0.08, -3.22)], lambda t: 0.17 + 0.03 * math.sin(math.pi * t), 0.02), base="L")
    fl = tube(catmull([(-0.08, -3.2), (-0.42, -4.1), (-1.25, -5.3), (-2.55, -6.45), (-4.2, -7.35), (-6.2, -7.85), (-7.6, -7.95)], 10),
              lambda t: 0.16 + 0.1 * min(1, t * 1.25), 0.025)
    shade_tube(art, fl, base="T", ring_every=0.15, ring_col="K")
    sens = []
    for i in range(3, len(fl["pts"]) - 1, 2):    # sensilla: fine hairs along the ventral (lower) edge
        c, f, w = fl["pts"][i], fl["fr"][i], fl["w"][i]
        nx, ny = f[1]
        if ny < 0:
            nx, ny = -nx, -ny
        b = (c[0] + nx * w, c[1] + ny * w)
        sens.append(([b, (b[0] + nx * 0.07 - f[0][0] * 0.03, b[1] + ny * 0.07 - f[0][1] * 0.03)], False))
    art.multi(sens, None, "B", 0.01)
    anchors["antenna"] = fl["pts"][int(len(fl["pts"]) * 0.22)]
    anchors["scape"] = (0.22, -2.62)
    anchors["scales"] = (-3.9, 0.6)
    return art, anchors


# ---------------------------------------------------------------------------------------------- facet mosaic inset
def draw_mosaic(scale=4.0, radius=105.0, pitch=30.0):
    """The eye surface at ~x300: corneal facet lenses ~30 um across, each a low dome. Units: micrometres.
    Returns art and the centre of the highlighted facet (the one the loupe enlarges)."""
    rng = random.Random(5)
    art = Art(scale, sw0=0.35)
    art.circle((0, 0), radius * 1.02, fill="K", stroke=None)
    a = pitch
    n = int(radius / a) + 3
    hi = None
    lenses = {"T": [], "L": [], "B": []}
    hatch = {"B": [], "K": [], "W": []}
    for j in range(-n, n + 1):
        for i in range(-n, n + 1):
            cx, cy = (i + (j % 2) * 0.5) * a + 0.15 * a * math.sin(j * 0.7), j * a * 0.8660254
            cx += rng.uniform(-0.6, 0.6)
            cy += rng.uniform(-0.6, 0.6)
            if math.hypot(cx, cy) > radius + a:
                continue
            hexv = [(cx + a / math.sqrt(3) * 0.985 * math.cos(math.pi / 6 + k * math.pi / 3),
                     cy + a / math.sqrt(3) * 0.985 * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
            # the whole patch is part of a dome: facets toward the lower left sit in shade
            g = 0.62 + 0.25 * (cx * LIGHT[0] + cy * LIGHT[1]) / radius
            lenses["T" if g > 0.62 else "L" if g > 0.45 else "B"].append((hexv, True))
            # each lens is a dome: a crescent of shade on the side away from the light, a soft highlight toward it
            for k, (rr, col) in enumerate(((0.36, "B"), (0.42, "K"))):
                arc = [(cx + a * rr * math.cos(t), cy + a * rr * math.sin(t))
                       for t in [math.atan2(-LIGHT[1], -LIGHT[0]) + u * 0.18 for u in range(-6, 7)]]
                hatch[col].append((arc, False))
            hl = [(cx + a * 0.2 * math.cos(t) + LIGHT[0] * a * 0.14, cy + a * 0.2 * math.sin(t) + LIGHT[1] * a * 0.14)
                  for t in [math.atan2(LIGHT[1], LIGHT[0]) + u * 0.22 for u in range(-4, 5)]]
            hatch["W"].append((hl, False))
            if i == 1 and j == -1:
                hi = (cx, cy, hexv)
    for k, subs in lenses.items():
        art.multi(subs, fill=k, stroke="K", sw=1.1)
    art.multi(hatch["B"], None, "B", 1.6)
    art.multi(hatch["K"], None, "K", 1.0)
    art.multi(hatch["W"], None, "W", 1.4)
    art.poly(hi[2], fill=None, stroke="W", sw=6.0)
    art.poly(hi[2], fill=None, stroke="K", sw=3.0)
    return art, (hi[0], hi[1])


# ---------------------------------------------------------------------------------------------- the bat (flying, ventral view)
def bat_wing(k=1.0, m=0.0):
    """Right wing skeleton and membrane outline in mm (body centre at 0,0; y toward the tail).
    k scales the span, m sweeps the tip forward (-) or back (+): three wingbeat poses."""
    S = (13.0, -8.0)

    def w(p):
        return (S[0] + (p[0] - S[0]) * k, p[1] + (p[0] - S[0]) * m)
    J = {"S": S, "E": w((46, 4)), "W": w((84, -30)), "T": w((90, -40)), "Tc": w((93, -45)),
         "D2a": w((128, -38)), "D2b": w((138, -37)),
         "D3a": w((132, -34)), "D3b": w((158, -24)), "D3c": w((174, -10)),
         "D4a": w((126, -10)), "D4b": w((138, 18)),
         "D5a": w((110, 6)), "D5b": w((114, 34)), "A": (24.0, 46.0)}
    bones = [("S", "E", 2.6), ("E", "W", 2.4), ("W", "T", 1.6), ("W", "D2a", 1.3), ("D2a", "D2b", 1.0),
             ("W", "D3a", 1.4), ("D3a", "D3b", 1.15), ("D3b", "D3c", 0.9),
             ("W", "D4a", 1.3), ("D4a", "D4b", 1.0), ("W", "D5a", 1.3), ("D5a", "D5b", 1.0)]

    def scallop(p, q, depth, n=8):
        dx, dy = q[0] - p[0], q[1] - p[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        return [(p[0] + dx * t + nx * depth * math.sin(math.pi * t), p[1] + dy * t + ny * depth * math.sin(math.pi * t))
                for t in [i / n for i in range(1, n)]]
    neck = (6.0, -16.0)
    lead = catmull([neck, (28, -26), w((60, -32)), J["W"]], 6)
    outline = lead + [J["D2b"], J["D3c"]] + scallop(J["D3c"], J["D4b"], -7) + [J["D4b"]] + scallop(J["D4b"], J["D5b"], -5) + \
        [J["D5b"]] + scallop(J["D5b"], J["A"], -12, 12) + [J["A"], (14, 30), (12, 0), S]
    return J, bones, outline


def draw_bat(scale=0.4, pose=0):
    """A flying insectivorous bat seen from below (ventral view), head turned to us. Units: mm (span ~330 mm)."""
    rng = random.Random(21 + pose)
    art = Art(scale, sw0=0.9)
    k, m = [(1.0, 0.0), (0.84, -0.2), (0.93, 0.16)][pose]
    J, bones, outline = bat_wing(k, m)
    mir = lambda pts: [(-x, y) for x, y in pts]
    # uropatagium (tail membrane) between the legs, edged by the calcar
    uro = [(24, 46), (18, 58), (8, 70), (0, 75), (-8, 70), (-18, 58), (-24, 46), (-10, 34), (10, 34)]
    art.poly(uro, fill="B", stroke="K", sw=1.0)
    art.multi([([(s * 24, 46), (s * 12, 64)], False) for s in (1, -1)], None, "K", 1.1)       # calcar
    art.line([(0, 30), (0, 72)], "K", 1.2)                                                   # tail vertebrae
    art.multi([([(s * 2, 36 + i * 6), (s * 14, 40 + i * 5)], False) for s in (1, -1) for i in range(5)], None, "L", 0.5)
    for side in (1, -1):
        f = (lambda pts: pts) if side == 1 else mir
        art.poly(f(outline), fill="L", stroke="K", sw=1.1)
        # membrane: elastin bundles running between neighbouring bones, darker toward the body
        fib = {"B": [], "K": []}
        pairs = [(("W", "D3c"), ("W", "D4b")), (("W", "D4b"), ("W", "D5b")), (("E", "W"), ("D5a", "D5b")),
                 (("W", "D2b"), ("W", "D3c"))]
        for (a0, a1), (b0, b1) in pairs:
            for t in [0.12 + 0.08 * i for i in range(11)]:
                p = (J[a0][0] + (J[a1][0] - J[a0][0]) * t, J[a0][1] + (J[a1][1] - J[a0][1]) * t)
                q = (J[b0][0] + (J[b1][0] - J[b0][0]) * t, J[b0][1] + (J[b1][1] - J[b0][1]) * t)
                mid = ((p[0] + q[0]) / 2 + rng.uniform(-1, 1), (p[1] + q[1]) / 2 + 2.0)
                fib["B" if t < 0.55 else "K"].append((f([p, mid, q]), False))
        art.multi(fib["B"], None, "B", 0.6)
        art.multi(fib["K"], None, "K", 0.35)
        # plagiopatagium near the body in shade
        sh = [J["E"], (40, 20), (24, 44), (14, 30), (12, 0), J["S"]]
        art.poly(f(sh), fill="B", stroke=None, op=0.55)
        for a, b, wd in bones:
            art.line(f([J[a], J[b]]), "K", wd)
            art.line(f([J[a], J[b]]), "W", wd * 0.3)
        knuck = [J[x] for x in ("E", "W", "D2a", "D3a", "D3b", "D4a", "D5a")]
        for p in knuck:
            art.circle(f([p])[0], 1.6, fill="K", stroke=None)
        tc = f([J["T"], J["Tc"], (J["Tc"][0] + 3, J["Tc"][1] + 2)])               # thumb claw
        art.line(tc, "K", 1.3)
        # legs (in the membrane plane): femur, tibia, foot with five clawed toes
        art.line(f([(9, 26), (19, 38), (24, 46)]), "K", 2.0)
        for t in range(5):
            art.line(f([(24, 46), (25 + t * 1.2 - 2, 53), (25 + t * 1.2 - 3, 55)]), "K", 0.6)
    # body: dense fur, paler belly
    body = ellipse_pts(0, 8, 14.5, 31, 40)
    hair_field(art, body, lambda q: math.atan2(q[1] - 8, q[0]) * 0.25 + math.pi / 2, ellipsoid_normal(0, 8, 14.5, 31, 12),
               5.0, rng, step=1.3, sw=0.7, base="T", amb=0.25)
    art.poly(body, fill=None, stroke="K", sw=0.9)
    # head turned toward us: ears with tragus, eyes, muzzle, nostrils, open mouth (echolocation call)
    for s in (1, -1):   # ears ~12 mm, short with rounded tips, dark (Eptesicus-like); a broad round-tipped tragus
        ear = [(s * 4, -31), (s * 5.5, -37), (s * 9, -42), (s * 13.5, -42.2), (s * 16.2, -37.5), (s * 16.8, -30.5)]
        art.poly(catmull(ear, 5), fill="B", stroke="K", sw=1.0)
        art.multi([([(s * (5.6 + i * 0.9), -33.5 - i * 2.1), (s * (15.6 - i * 0.6), -32.5 - i * 2.3)], False) for i in range(4)], None, "K", 0.45)
        trag = [(s * 8.6, -31), (s * 8.7, -35.2), (s * 10.0, -37.0), (s * 11.4, -35.2), (s * 11.3, -31)]
        art.poly(catmull(trag, 4), fill="L", stroke="K", sw=0.8)
    head = ellipse_pts(0, -24, 11.5, 11, 32)
    hair_field(art, head, lambda q: math.atan2(q[1] + 24, q[0]), ellipsoid_normal(0, -24, 11.5, 11, 8), 3.4, rng,
               step=1.0, sw=0.6, base="T", amb=0.3)
    art.poly(head, fill=None, stroke="K", sw=0.9)
    art.poly(ellipse_pts(0, -17, 6.2, 5, 20), fill="B", stroke="K", sw=0.8)                  # muzzle
    for s in (1, -1):
        art.circle((s * 5.2, -26), 1.5, fill="K", stroke=None)                                  # eyes
        art.circle((s * 5.2 + 0.5, -26.6), 0.45, fill="W", stroke=None)
        art.circle((s * 1.8, -20), 0.7, fill="K", stroke=None)                                  # nostrils
    art.poly([(-3.4, -15.5), (3.4, -15.5), (2.2, -12.2), (-2.2, -12.2)], fill="K", stroke="K", sw=0.6)   # open mouth
    art.multi([([(s * 2.6, -15.4), (s * 2.3, -14.2)], False) for s in (1, -1)], None, "W", 0.6)       # canines
    return art


BAT_BOX = (-180, -60, 360, 140)


# ---------------------------------------------------------------------------------------------- the bat's face (meter)
def draw_batface(scale=2.0):
    """A big brown bat's head (Eptesicus fuscus) in profile, facing right toward the moth and calling through its open
    mouth, as this species does (an oral emitter). Units: mm (head ~18 mm). Short ears (12-13 mm) with rounded tips, ribbed by transverse
    folds; a broad tragus with a rounded tip standing in the ear opening; a broad, flattened, hairless snout with fleshy
    lips and glandular swellings; dense fur, paler on the throat. The page draws the eye and its lid (the meter)."""
    rng = random.Random(8)
    art = Art(scale, sw0=0.12)
    eye = (3.0, -2.4)
    # the far ear: the same rounded shape, a little forward of the near one, so only its front edge shows
    ear_cp = [(0.7, -4.5), (0.3, -9.2), (-0.9, -13.6), (-3.0, -16.6), (-5.1, -16.4), (-6.5, -13.5), (-6.9, -9.0),
              (-6.6, -4.8), (-5.4, -1.6), (-3.6, -2.6), (-1.2, -3.6)]
    far = catmull([(x * 0.94 + 1.7, y * 0.94 - 0.2) for x, y in ear_cp], 6)
    art.poly(far, fill="L", stroke="B", sw=0.12)
    # head: rounded crown, forehead sloping to a short broad muzzle; lower jaw dropped (open mouth)
    head = catmull([(-8.7, 3.6), (-8.6, -0.6), (-7.0, -3.4), (-3.2, -4.9), (0.8, -5.3), (3.4, -4.7), (5.6, -3.5), (7.4, -2.7),
                    (8.7, -2.0), (9.35, -0.9), (9.05, 0.35), (8.4, 0.6), (7.5, 3.5), (6.2, 4.4), (3.0, 5.0), (-1.0, 5.7),
                    (-5.0, 5.6), (-8.7, 3.6)], 6)
    muzzle = [(4.3, -4.4), (5.6, -3.5), (7.4, -2.7), (8.7, -2.0), (9.35, -0.9), (9.05, 0.35), (8.4, 0.6), (5.8, 0.95),
              (4.1, 1.35), (3.7, 0.2), (4.6, -1.2)]
    lowlip = [(4.1, 1.35), (7.5, 3.5), (6.2, 4.4), (4.4, 3.6)]

    def fur_pat(q, s):
        return s + 0.18 if q[1] > 2.4 else s - 0.05      # back fur dark (reddish brown in life), throat paler
    hair_field(art, head, lambda q: math.pi - 0.12 + 0.07 * q[1], ellipsoid_normal(0.4, 0.0, 9.2, 5.6, 4.6), 1.15, rng,
               step=0.22, sw=0.11, base="L", amb=0.15, pattern=fur_pat, exclude=[muzzle, lowlip], hi=False, dens=1.15)
    # the bare snout: dark skin, a glandular swelling on the side, crescent nostril, whiskers
    art.poly(catmull(muzzle + [muzzle[0]], 4), fill="B", stroke="K", sw=0.13)
    art.line(catmull([(5.0, -1.9), (6.4, -2.2), (7.6, -1.6)], 5), "L", 0.16)
    art.line(catmull([(4.8, -0.6), (6.3, -0.9), (7.7, -0.4)], 5), "K", 0.1)
    art.poly(ellipse_pts(8.75, -1.15, 0.36, 0.22, 12, 0.5), fill="K", stroke=None)
    art.multi([([(7.8, -0.4 + i * 0.35), (9.6 + i * 0.25, -1.3 + i * 0.75)], False) for i in range(3)], None, "B", 0.06)
    art.poly(lowlip, fill="B", stroke="K", sw=0.12)
    # the open mouth (the echolocation call goes out through it) with upper and lower canines
    art.poly([(4.0, 1.4), (8.45, 0.6), (8.1, 1.7), (7.35, 3.4)], fill="K", stroke="K", sw=0.1)
    art.poly([(7.8, 0.72), (7.45, 0.75), (7.62, 2.05)], fill="W", stroke=None)
    art.poly([(6.55, 3.05), (6.95, 2.95), (6.85, 1.95)], fill="W", stroke=None)
    art.multi([([(8.05 + i * 0.12, 0.7), (8.07 + i * 0.12, 1.05)], False) for i in range(3)], None, "W", 0.1)
    art.poly(head, fill=None, stroke="K", sw=0.16)
    # the near ear: outer face dark, the paler concha opening forward, transverse folds across it; the tragus in front
    ear = catmull(ear_cp, 6)
    art.poly(ear, fill="B", stroke="K", sw=0.16)
    concha = catmull([(0.2, -4.7), (-0.3, -9.2), (-1.4, -13.1), (-3.1, -15.5), (-4.6, -14.4), (-4.7, -9.6), (-3.7, -5.4),
                      (-2.0, -3.9)], 6)
    art.poly(concha, fill="L", stroke="K", sw=0.1)
    folds = []
    for i in range(6):
        y = -5.9 - i * 1.6
        xf = 0.15 + (y + 4.7) * 0.3
        folds.append(([(xf - 0.25, y), (xf - 1.5, y + 0.3), (max(-4.5, xf - 3.1), y + 0.95)], False))
    art.multi(folds, None, "K", 0.09)
    trag = catmull([(-1.25, -3.9), (-0.85, -6.3), (-1.05, -8.3), (-1.8, -9.1), (-2.6, -8.4), (-2.9, -6.1), (-3.05, -3.4)], 5)
    art.poly(trag, fill="T", stroke="K", sw=0.12)
    # the eye socket: the page draws the eye and its lid on top of this
    art.circle(eye, 1.15, fill="K", stroke=None)
    return art, {"eye": eye, "r": 0.95}


FACE_BOX = (-9.0, -20.0, 20.0, 27.0)


# ---------------------------------------------------------------------------------------------- the lamp
def draw_bulb(scale=0.5):
    """A clear incandescent lamp hanging base-up in a lampholder. Units: mm (A60-like envelope, E27 base)."""
    art = Art(scale, sw0=0.5)
    # cord and lampholder
    art.line([(0, -130), (0, -82)], "K", 2.2)
    holder = [(-15, -82), (15, -82), (17, -50), (-17, -50)]
    art.poly(holder, fill="B", stroke="K", sw=0.8)
    art.multi([([(-16 + i * 0.2, -76 + i * 6), (16 - i * 0.2, -76 + i * 6)], False) for i in range(5)], None, "K", 0.6)
    art.multi([([(-8 + i * 4, -81), (-8.5 + i * 4.2, -51)], False) for i in range(5)], None, "L", 0.7)
    # E27 screw base: shell with thread, black-glass insulator, foot contact
    shell = [(-13.5, -50), (13.5, -50), (13.5, -26), (-13.5, -26)]
    art.poly(shell, fill="T", stroke="K", sw=0.8)
    thr = []
    for i in range(5):
        y0 = -48 + i * 4.8
        thr.append(([(-13.5, y0 + 2.2), (13.5, y0)], False))
    art.multi(thr, None, "K", 1.0)
    art.multi([([(-13.5, -48 + i * 4.8 + 3.4), (13.5, -48 + i * 4.8 + 1.2)], False) for i in range(5)], None, "W", 0.8)
    art.poly([(-13.5, -50), (-9, -50), (-9, -26), (-13.5, -26)], fill="B", stroke=None, op=0.6)
    art.poly([(-13.5, -26), (13.5, -26), (12.5, -22), (-12.5, -22)], fill="K", stroke="K", sw=0.6)
    # glass envelope (A60): neck flaring into a near-sphere 60 mm across
    env = catmull([(-12.5, -22), (-14, -12), (-22, -2), (-29, 12), (-30, 26), (-26, 42), (-15, 53), (0, 57),
                   (15, 53), (26, 42), (30, 26), (29, 12), (22, -2), (14, -12), (12.5, -22)], 6)
    art.poly(env, fill="W", stroke="K", sw=0.9)
    # glass reflections: two long arcs on the lit side, one short on the other
    art.line(catmull([(19, 0), (25, 12), (26.5, 27), (23, 40)], 5), "L", 1.4)
    art.line(catmull([(-22, 18), (-23, 30), (-20, 39)], 5), "L", 1.0)
    # stem: glass flare, press, exhaust tube, button rod
    art.poly([(-6, -22), (6, -22), (4.2, -4), (7, 2), (-7, 2), (-4.2, -4)], fill="T", stroke="B", sw=0.6)
    art.line([(0, -22), (0, 14)], "B", 1.0)
    art.circle((0, 14), 1.4, fill="T", stroke="B", sw=0.5)
    # lead-in wires and molybdenum support hooks
    art.multi([([(-3, -24), (-3.5, 2), (-12, 18)], False), ([(3, -24), (3.5, 2), (12, 18)], False)], None, "K", 0.7)
    art.multi([([(0, 14), (-4, 22)], False), ([(0, 14), (4, 22)], False)], None, "K", 0.5)
    # the coiled tungsten filament (lit): a fine helix sagging between the supports
    coil = []
    N = 160
    for i in range(N + 1):
        t = i / N
        x = -12 + 24 * t
        y = 18 + 4.2 * math.sin(math.pi * t) * 1.0 + 0.0
        coil.append((x + 0.9 * math.sin(t * 2 * math.pi * 22), y + 1.3 * math.cos(t * 2 * math.pi * 22)))
    art.line(coil, "O", 0.55)
    return art, {"glow": (0, 20), "top": (0, -130)}


BULB_BOX = (-34, -130, 68, 190)


# ---------------------------------------------------------------------------------------------- labelled plates
def txt(x, y, s, anchor="start", cls="pl", extra=""):
    s = s.replace("&", "&amp;").replace("<", "&lt;")
    return f'<text x="{x:g}" y="{y:g}" text-anchor="{anchor}" class="{cls}"{extra}>{s}</text>'


def leader(art, p, q, dot=True):
    art.line([p, q], "K", 0.7)
    if dot:
        art.circle(p, 2.0, fill="K", stroke=None)


def col_labels(art, T, items, lx):
    """A column of numbered callouts: leader -> ink badge with its number -> label text (class 'col', hidden when the
    page shows the plate compact, where an HTML key lists the same numbers)."""
    legend = []
    for n, (p, ly, lines) in enumerate(items, 1):
        bx, by = lx + 2, ly - 4
        leader(art, p, (bx - 9, by))
        art.circle((bx, by), 9, fill="K", stroke=None)
        T.append(f'<text x="{bx:g}" y="{by + 4.2:g}" text-anchor="middle" class="pbn">{n}</text>')
        for k, s in enumerate(lines):
            T.append(txt(lx + 16, ly + k * 13, s, cls=("pl" if k == 0 else "pl2") + " col"))
        legend.append(lines)
    return legend


def draw_omma():
    """Plate: ommatidia of a nocturnal moth's superposition eye, cut lengthwise. Units: viewBox px.
    Facet pitch is drawn at 64 px = 30 um; the lengthwise axis is compressed (schematic)."""
    rng = random.Random(4)
    art = Art(1.0, sw0=0.6)
    T = []
    n, a, x0 = 4, 64.0, 18.0
    yC0, yC1, yK1, yZ1, yR1, yB = 40.0, 64.0, 168.0, 318.0, 462.0, 486.0
    W = x0 + n * a
    # background tissue (between the cells) and the clear zone
    art.poly([(x0, yC1), (W, yC1), (W, yB), (x0, yB)], fill="T", stroke=None)
    art.poly([(x0, yK1 + 6), (W, yK1 + 6), (W, yZ1), (x0, yZ1)], fill="W", stroke=None)
    # secondary pigment cells between ommatidia (pigment pulled up: dark-adapted)
    for i in range(n + 1):
        cx = x0 + i * a
        sp = [(cx - 9, yC1), (cx + 9, yC1), (cx + 5, yK1 + 26), (cx + 2, yK1 + 60), (cx - 2, yK1 + 60), (cx - 5, yK1 + 26)]
        sp = [(max(x0, min(W, x)), y) for x, y in sp]
        art.poly(sp, fill="B", stroke="K", sw=0.5)
        art.multi([([(min(W - 1, max(x0 + 1, cx + rng.uniform(-4, 4))), y), (min(W - 1, max(x0 + 1, cx + rng.uniform(-4, 4))), y + 4)], False) for y in range(int(yC1) + 4, int(yK1) + 40, 7)], None, "K", 1.4)
    for i in range(n):
        cx = x0 + (i + 0.5) * a
        # corneal lens: biconvex, laminated, the nipple array on its outer surface
        top = [(cx - a / 2 + 1 + t * (a - 2), yC0 + 7 - 7 * math.sin(math.pi * t)) for t in [k / 24 for k in range(25)]]
        bot = [(cx + a / 2 - 1 - t * (a - 2), yC1 - 2 + 9 * math.sin(math.pi * t)) for t in [k / 24 for k in range(25)]]
        art.poly(top + bot, fill="T", stroke="K", sw=0.9)
        for k in (1, 2, 3):
            art.line([(x, y + 4.5 * k) for x, y in top[2:-2]], "L", 0.6)
        nip = []
        for k in range(1, 48):
            t = k / 48
            x = cx - a / 2 + 1 + t * (a - 2)
            y = yC0 + 7 - 7 * math.sin(math.pi * t)
            nip.append(([(x, y), (x, y - 1.6)], False))
        art.multi(nip, None, "K", 0.9)
        # crystalline cone with its two primary pigment cells
        cone = [(cx - 22, yC1 + 7), (cx + 22, yC1 + 7), (cx + 4, yK1), (cx - 4, yK1)]
        art.poly(cone, fill="L", stroke="K", sw=0.7)
        art.multi([([(cx - 16 + 8 * k * 0.5, yC1 + 12), (cx - 3 + k, yK1 - 6)], False) for k in range(5)], None, "B", 0.5)
        for s in (-1, 1):
            pp = [(cx + s * 22, yC1 + 4), (cx + s * 30, yC1 + 4), (cx + s * 14, yC1 + 66), (cx + s * 8, yC1 + 60)]
            art.poly(pp, fill="K", stroke="K", sw=0.5)
        # rhabdom (fused microvilli of 8 retinula cells) with the cell bodies and nuclei around it
        rc = [(cx - 15, yZ1 + 4), (cx + 15, yZ1 + 4), (cx + 13, yR1), (cx - 13, yR1)]
        art.poly(rc, fill="L", stroke="B", sw=0.6)
        for s in (-1, 1):
            for k in range(2):
                art.poly(ellipse_pts(cx + s * 9, yZ1 + 40 + 48 * k, 2.6, 6, 12), fill="B", stroke=None)
        art.poly([(cx - 3, yZ1), (cx + 3, yZ1), (cx + 4.5, yR1 - 18), (cx - 4.5, yR1 - 18)], fill="K", stroke="K", sw=0.5)
    # tracheal tapetum: layered tracheoles around the proximal rhabdoms (the eyeshine reflector)
    trach = []
    for k in range(6):
        y = yR1 - 22 + k * 4.6
        trach.append(([(x0 + t * (W - x0) / 80, y + 1.4 * math.sin(t * 0.9 + k)) for t in range(81)], False))
    art.multi(trach, None, "B", 1.1)
    art.multi(trach[::2], None, "K", 0.5)
    art.line([(x0, yB), (W, yB)], "K", 2.4)                                 # basement membrane
    ax = []
    for i in range(n):
        cx = x0 + (i + 0.5) * a
        ax.append(([(cx, yB + 2), (cx + (W / 2 + x0 / 2 - cx) * 0.3, yB + 28)], False))
    art.multi(ax, None, "K", 1.2)
    # light from one distant point: parallel rays through 3 facets, bent by the cones, meeting on one rhabdom
    tgt = (x0 + 2.5 * a, yZ1 + 2)
    rays = []
    for i in (1, 2, 3):
        for o in (-12, 0, 12):
            cx = x0 + (i + 0.5) * a
            p0 = (cx + o - 34, 4)
            p1 = (cx + o - 1.2 * 4, yC0 + 2)
            p2 = (cx + o * 0.15, yK1)
            rays.append(([p0, p1, p2, tgt], False))
    art.multi(rays, None, "O", 0.8)
    for x, y in [(tgt[0], tgt[1])]:
        art.circle((x, y), 2.4, fill="O", stroke=None)
    art.poly([(x0, 0), (W, 0), (W, yB + 34), (x0, yB + 34)], fill=None, stroke=None)
    # labels on the right
    lx = W + 22
    labels = [
        ((W - 6, yC0 + 2), yC0 - 12, ["corneal nipples", "outer surface"]),
        ((W - 16, yC0 + 16), yC0 + 20, ["corneal lens", "one facet, 30 \u00b5m"]),
        ((x0 + 3.5 * a + 8, yC1 + 40), yC1 + 52, ["crystalline cone"]),
        ((x0 + 4 * a - 4, yC1 + 30), yC1 + 90, ["pigment cells"]),
        ((W - 10, (yK1 + yZ1) / 2 + 20), (yK1 + yZ1) / 2 + 20, ["clear zone"]),
        ((x0 + 3.5 * a + 2, yZ1 + 60), yZ1 + 60, ["rhabdom", "from 9 retinula cells"]),
        ((W - 10, yR1 - 12), yR1 - 12, ["tracheal tapetum", "the eyeshine reflector"]),
        ((W - 10, yB), yB + 14, ["basement membrane"]),
    ]
    legend = col_labels(art, T, labels, lx)
    return art, "".join(T), (0, -18, 490, 548), (0, -18, lx + 14, 548), legend


def draw_nipples():
    """Plate: the corneal nipple array. Top view (pitch ~200 nm, with a 5-7 dislocation where domains meet) and a
    side view drawn to the same scale as a wave of green light. Units: viewBox px."""
    rng = random.Random(9)
    art = Art(1.0, sw0=0.6)
    T = []
    # ---- top view: hexagonal lattice with an edge dislocation (the classic elastic displacement field)
    p = 21.0                              # px per 200 nm
    ox, oy, w, h = 14.0, 22.0, 248.0, 210.0
    art.poly([(ox, oy), (ox + w, oy), (ox + w, oy + h), (ox, oy + h)], fill="B", stroke="K", sw=0.9)
    cx, cy, b, nu = ox + w * 0.52, oy + h * 0.5, p, 0.3
    domes = []
    for j in range(-8, 9):
        for i in range(-9, 10):
            x, y = (i + (j % 2) * 0.5) * p, j * p * 0.8660254
            dx, dy = x + 0.37 * p, y + 0.29 * p
            r2 = dx * dx + dy * dy + 1e-6
            th = math.atan2(dy, dx)
            ux = b / (2 * math.pi) * (th + dx * dy / (2 * (1 - nu) * r2))
            uy = -b / (2 * math.pi) * ((1 - 2 * nu) / (4 * (1 - nu)) * math.log(r2 / p ** 2) + (dx * dx - dy * dy) / (4 * (1 - nu) * r2))
            X, Y = cx + x + ux + rng.uniform(-0.7, 0.7), cy + y + uy + rng.uniform(-0.7, 0.7)
            if ox + 7 < X < ox + w - 7 and oy + 7 < Y < oy + h - 7:
                domes.append((X, Y))
    rr = 0.4 * p
    art.multi([(ellipse_pts(X, Y, rr, rr, 16), True) for X, Y in domes], fill="L", stroke="K", sw=0.6)
    art.multi([([(X + rr * 0.8 * math.cos(t), Y + rr * 0.8 * math.sin(t)) for t in [2.1 + k * 0.25 for k in range(9)]], False) for X, Y in domes], None, "K", 1.2)
    art.multi([([(X - rr * 0.32 + rr * 0.32 * math.cos(t), Y - rr * 0.32 + rr * 0.32 * math.sin(t)) for t in [3.6 + k * 0.3 for k in range(6)]], False) for X, Y in domes], None, "W", 1.3)
    # mark the 5-7 pair at the core
    art.circle((cx - 0.15 * p, cy - 0.05 * p), p * 0.95, fill=None, stroke="O", sw=1.4)
    # scale bar 500 nm
    sb = 2.5 * p
    art.line([(ox, oy + h + 9), (ox + sb, oy + h + 9)], "K", 3.0)
    T.append(txt(ox + sb + 8, oy + h + 13, "500 nm", cls="pl2"))
    T.append(txt(ox, oy - 8, "TOP VIEW, ~x40,000", cls="pl"))
    lx = ox + w + 16
    legend = col_labels(art, T, [((ox + w - 30, oy + 30), oy + 18, ["nipples ~200 nm apart", "180-240 nm measured"]),
                                 ((ox + w - 8, oy + 98), oy + 92, ["hexagonal domains", "about 2 \u00b5m across"]),
                                 ((cx + p * 0.95, cy + 8), oy + 152, ["a 5-7 defect", "where two rows meet"])], lx)
    # ---- side view: nipples and a wave of green light, drawn to the same scale
    q = 40.0                              # px per 200 nm
    sy, base = 300.0, 428.0
    T.append(txt(ox, sy - 24, "SIDE VIEW, SAME SCALE", cls="pl"))
    lam = 500 / 200 * q
    wave = [(ox + t, sy + 14 * math.sin(2 * math.pi * t / lam)) for t in range(0, 262, 2)]
    art.line(wave, "O", 1.8)
    art.line([(ox, sy + 28), (ox + lam, sy + 28)], "K", 0.8)
    art.multi([([(ox, sy + 24), (ox, sy + 32)], False), ([(ox + lam, sy + 24), (ox + lam, sy + 32)], False)], None, "K", 0.8)
    T.append(txt(ox + lam + 8, sy + 32, "green light, 500 nm", cls="pl2"))
    prof = [(ox, base)]
    for k0 in range(5):
        c = ox + (k0 + 0.5) * q
        for t_ in range(-10, 11):
            u = t_ / 10
            prof.append((c + u * 0.48 * q, base - q * (1 - u * u)))
    prof += [(ox + 5 * q, base), (ox + 5 * q, base + 24), (ox, base + 24)]
    art.poly(prof, fill="L", stroke="K", sw=0.9)
    art.multi([([(ox + 4 + i * 9, base + 22), (ox + 14 + i * 9, base + 4)], False) for i in range(int(5 * q / 9) - 1)], None, "B", 0.6)
    # dimension lines: pitch (over the first two nipples) and height (beside the last)
    c1, c2 = ox + 0.5 * q, ox + 1.5 * q
    art.line([(c1, base - q - 10), (c2, base - q - 10)], "K", 0.8)
    art.multi([([(c1, base - q - 14), (c1, base - q - 4)], False), ([(c2, base - q - 14), (c2, base - q - 4)], False)], None, "K", 0.8)
    T.append(txt((c1 + c2) / 2, base - q - 17, "~200 nm", anchor="middle", cls="pl2"))
    hx = ox + 5 * q + 12
    art.line([(hx, base), (hx, base - q)], "K", 0.8)
    art.multi([([(hx - 4, base), (hx + 4, base)], False), ([(hx - 4, base - q), (hx + 4, base - q)], False)], None, "K", 0.8)
    T.append(txt(hx, base - q - 8, "~200 nm", anchor="middle", cls="pl2"))
    T.append(txt(ox, base + 42, "cornea (chitin), n \u2248 1.5", cls="pl2"))
    # graded-index bar beside the profile: air at the tips (n = 1), cornea at the base (n ~ 1.5)
    gx = hx + 46
    for i in range(10):
        f = "W" if i < 2 else "T" if i < 4 else "L" if i < 7 else "B"
        art.poly([(gx, base - q + i * q / 10), (gx + 14, base - q + i * q / 10), (gx + 14, base - q + (i + 1) * q / 10), (gx, base - q + (i + 1) * q / 10)], fill=f, stroke=None)
    art.poly([(gx, base - q), (gx + 14, base - q), (gx + 14, base), (gx, base)], fill=None, stroke="K", sw=0.7)
    T.append(txt(gx + 7, base - q - 8, "n=1", anchor="middle", cls="pl2"))
    T.append(txt(gx + 7, base + 16, "1.5", anchor="middle", cls="pl2"))
    return art, "".join(T), (0, -4, 490, 480), (0, -4, lx + 14, 480), legend


# ---------------------------------------------------------------------------------------------- the mascot (pixel art)
def raster(art, box, px, ss=8):
    """Rasterise an Art (model units) into an RGBA image px x px, supersampled ss times (PIL, no browser needed)."""
    from PIL import Image, ImageDraw
    x0, y0, w, h = box
    S = px * ss / w
    img = Image.new("RGBA", (px * ss, round(h * S)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rgb = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) + (255,) for k, v in PAL.items()}
    for it in art.items:
        if it[0] != "p":
            continue
        _, subs, fill, stroke, sw, op = it
        for pts, close in subs:
            q = [((x - x0) * S, (y - y0) * S) for x, y in pts]
            if close and fill and len(q) >= 3:
                d.polygon(q, fill=rgb[fill])
            if stroke:
                wpx = max(1, round(sw * S))
                d.line(q + ([q[0]] if close else []), fill=rgb[stroke], width=wpx, joint="curve")
    return img


def mascot_rows(px=96):
    """The head plate rendered small and snapped to the five ink tones: a realistic mascot for the hub."""
    from PIL import Image
    art, _ = draw_head(40.0)
    box = (-4.3, -4.4, 9.4, 9.4)                  # mm: eye, palp, whole proboscis coil, scape, antenna base, some thorax
    big = raster(art, box, px, 8)
    small = big.resize((px, px), Image.BOX)
    keys = "KBLTW"
    cols = [tuple(int(PAL[k][i:i + 2], 16) for i in (1, 3, 5)) for k in keys]
    rows = []
    for j in range(px):
        r = []
        for i in range(px):
            R, G, B, A = small.getpixel((i, j))
            if A < 140:
                r.append(".")
                continue
            R, G, B = (R * 255 / A, G * 255 / A, B * 255 / A)    # un-premultiply the box filter's edge blend
            R, G, B = (255 * (R / 255) ** 1.35, 255 * (G / 255) ** 1.35, 255 * (B / 255) ** 1.2)   # a touch darker: reads at icon size
            best = min(range(5), key=lambda k: (cols[k][0] - R) ** 2 + (cols[k][1] - G) ** 2 + (cols[k][2] - B) ** 2)
            r.append(keys[best])
        rows.append(r)
    # framed as a loupe: tint sky inside a round ink rim (2 px), transparent outside
    c = (px - 1) / 2
    out = []
    for j in range(px):
        r = []
        for i in range(px):
            d = ((i - c) ** 2 + (j - c) ** 2) ** 0.5
            if d > c + 0.5:
                r.append(".")
            elif d > c - 2.0:
                r.append("K")
            elif d > c - 3.0:
                r.append("W")
            else:
                r.append(rows[j][i] if rows[j][i] != "." else "T")
        out.append(r)
    return ["".join(r) for r in out]


def svg_doc(inner, box, scale, bg=None, clip=True, extra=""):
    x, y, w, h = (round(v * scale) for v in box)
    defs = f'<defs><clipPath id="clip{x}{y}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath></defs>' if clip else ""
    rect = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{PAL[bg]}"/>' if bg else ""
    body = f'<g clip-path="url(#clip{x}{y})">{inner}</g>' if clip else inner
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" stroke-linejoin="round" stroke-linecap="round" {extra}>'
            f'{defs}{rect}{body}</svg>')


BAT_S, FACE_S, BULB_S = 2.0, 8.0, 4.0

PLATE_CSS = ('<style>.pl{font:500 12.5px/1 "IBM Plex Mono",monospace;letter-spacing:.06em;text-transform:uppercase;fill:#19238E}'
             '.pl2{font:400 12px/1 "IBM Plex Mono",monospace;fill:#545BA9}.pbn{font:600 12px/1 "IBM Plex Mono",monospace;fill:#FBFAF9}</style>')


def build():
    """Everything the page needs, as SVG fragments in their own unit boxes, plus anchors in those units."""
    head, anc = draw_head(40.0)
    mosaic, hi = draw_mosaic(4.0)
    bats = [draw_bat(BAT_S, k).svg() for k in range(3)]
    face, fanc = draw_batface(FACE_S)
    bulb, banc = draw_bulb(BULB_S)
    omma, omma_t, omma_box, omma_c, omma_l = draw_omma()
    nip, nip_t, nip_box, nip_c, nip_l = draw_nipples()
    s40 = lambda p: [round(p[0] * 40, 1), round(p[1] * 40, 1)]
    data = {
        "head": {"svg": head.svg(), "box": [round(v * 40) for v in HEAD_BOX],
                 "anchors": {k: s40(v) for k, v in anc.items() if isinstance(v, tuple) and len(v) == 2},
                 "eye_r": round(EYE["R"] * 40, 1), "mm": 40,
                 "eye_axis": EYE["axis"]},
        "mosaic": {"svg": mosaic.svg(), "r": 105 * 4, "hi": [round(hi[0] * 4, 1), round(hi[1] * 4, 1)], "um": 4},
        "bat": {"frames": bats, "box": [round(v * BAT_S) for v in BAT_BOX]},
        "face": {"svg": face.svg(), "box": [round(v * FACE_S) for v in FACE_BOX], "eye": [fanc["eye"][0] * FACE_S, fanc["eye"][1] * FACE_S], "r": fanc["r"] * FACE_S},
        "bulb": {"svg": bulb.svg(), "box": [round(v * BULB_S) for v in BULB_BOX], "glow": [banc["glow"][0] * BULB_S, banc["glow"][1] * BULB_S]},
        "omma": {"svg": omma.svg() + omma_t, "box": list(omma_box), "compact": list(omma_c), "legend": omma_l},
        "nipples": {"svg": nip.svg() + nip_t, "box": list(nip_box), "compact": list(nip_c), "legend": nip_l},
    }
    return data


if __name__ == "__main__":
    data = build()
    dst = HERE / "web" / "data" / "plates.json"
    dst.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"{dst.relative_to(HERE)}: {dst.stat().st_size / 1024:.0f} KB")
    for k, v in data.items():
        print(f"  {k}: {len(json.dumps(v)) / 1024:.0f} KB")
    # previews for checking (qa/plates/*.svg)
    out = HERE / "qa" / "plates"
    out.mkdir(parents=True, exist_ok=True)

    def doc(svg, box, bg=None):
        x, y, w, h = box
        rect = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{PAL[bg]}"/>' if bg else ""
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" stroke-linejoin="round" stroke-linecap="round">{PLATE_CSS}{rect}{svg}</svg>'
    (out / "head.svg").write_text(doc(data["head"]["svg"], data["head"]["box"], "T"), encoding="utf-8")
    r = data["mosaic"]["r"]
    (out / "mosaic.svg").write_text(doc(data["mosaic"]["svg"], [-r, -r, 2 * r, 2 * r], "T"), encoding="utf-8")
    for i, f in enumerate(data["bat"]["frames"]):
        (out / f"bat{i}.svg").write_text(doc(f, data["bat"]["box"], "T"), encoding="utf-8")
    (out / "face.svg").write_text(doc(data["face"]["svg"], data["face"]["box"], "W"), encoding="utf-8")
    (out / "bulb.svg").write_text(doc(data["bulb"]["svg"], data["bulb"]["box"], "T"), encoding="utf-8")
    (out / "omma.svg").write_text(doc(data["omma"]["svg"], data["omma"]["box"], "W"), encoding="utf-8")
    (out / "nipples.svg").write_text(doc(data["nipples"]["svg"], data["nipples"]["box"], "W"), encoding="utf-8")
