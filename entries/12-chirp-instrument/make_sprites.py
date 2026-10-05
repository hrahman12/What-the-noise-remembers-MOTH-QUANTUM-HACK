"""Author the Chirp Instrument's cast and write web/sprites.json (the ONE place the pixel data and the drawn geometry
live; build_web.py inlines it, and common/mascot.py renders the hub mascot from it).

Realism pass 2 (common/SPRITES.md, "make the sprites real life"): no faces, no characters, no schematic map boxes.
Every subject is drawn from how the real thing looks, in the shared ink palette (K outline ink, B mid ink, L light ink,
T tint, W paper; O only for light and heat).

What is in sprites.json
  mascot, remnant  GW150914's black holes as the page draws them: dark shadows (radius sqrt(27) GM/c^2, so sized
                   36 : 29 and then 62 by mass), each edged by its photon ring, with the starfield and a Milky-Way-like
                   band bent around them by thin-lens ray shooting through point masses (Einstein radius 1.35x the
                   larger shadow, a drawing choice), exactly the rule renderSky() applies live in the page. 76 x 76 and
                   56 x 56, in a round window, dithered in 5 ink tones. The mascot is the hub's icon for this piece.
  ns               the cast-list icon for GW170817: the two neutron stars, 1.46 and 1.27 Msun, each about 24 km across,
                   as bright limb-darkened spheres with a little light bent around them, in front of the host galaxy
                   NGC 4993. (The page draws each star on its orbit itself.)
  pad              the tap pad: the pair on a patch of night sky (51 x 33), same lens rule; frames 1-3 a ripple running out.
  flash            GW170817's light after the merger (light, so O), 4 growing frames (drawn decoration).
  grain, star, note, font   small props and the 3x5 pixel font.
  obsH, obsL       LIGO Hanford (H1) and LIGO Livingston (L1) as oblique aerial engravings, 224 x 118 (obsHn, obsLn:
                   156 x 72 for tablets and phones), each in 3 frames (at rest; X arm stretched; Y arm stretched) with
                   the anchor points the page labels and animates in "meta". A pinhole camera hangs behind the outside
                   corner of each L and looks along the bisector of its arms, over the site's real geometry: the arms'
                   true azimuths (Abbott et al., NIM A 517, 154, 2004), 3994.5 m long (Aasi et al., CQG 32, 074001,
                   2015), Hanford's mid stations at 2 km (Livingston has none), the end stations at 4 km, each 1.2 m
                   beam tube under its arched concrete cover (Abbott et al., Rep. Prog. Phys. 72, 076901, 2009), and
                   at Hanford the crest of the
                   Rattlesnake Hills with Rattlesnake Mountain (1,076 m) and Lookout Summit (1,106 m) at their real
                   positions. Drawn, not measured: the building footprints (approximate) and their enlargement (corner
                   station 1.6x, mid and end stations 3.5x), the LVEA's cut-away roof with a schematic of the optics
                   inside, the hills' height (x2.5), the sagebrush and pine textures, and the light.
  sites            the geometry behind them (vertices, azimuths, arm length, the ridge in local east/north metres).
Run: python make_sprites.py   (Python + numpy, no Atlas, no network)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"
TONES = "KBLTW"


def blank(w, h, ch="."):
    return [[ch] * w for _ in range(h)]


def rows(g):
    return ["".join(r) for r in g]


def h32(x, y, s=7):
    """Integer hash, bit-identical to skyHash() in the page (Math.imul arithmetic)."""
    h = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return h / 4294967296.0


def vnoise(u, v, cell=7.0, seed=5):
    """Smooth value noise in [0, 1] (bilinear between hashed lattice values), as in the page."""
    x, y = u / cell, v / cell
    xi, yi = math.floor(x), math.floor(y)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = h32(xi, yi, seed), h32(xi + 1, yi, seed)
    c, d = h32(xi, yi + 1, seed), h32(xi + 1, yi + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


# ---------------------------------------------------------------- the night sky and the lensing (same rules as the page)
def star_I(u, v, seed=7, dens=1.0):
    """Starlight in one source cell: very bright, bright, medium and faint stars (ink-tone units, 0 = night)."""
    r = h32(math.floor(u), math.floor(v), seed) / dens
    if r < 0.0012:
        return 3.6
    if r < 0.005:
        return 2.8
    if r < 0.014:
        return 1.8
    if r < 0.035:
        return 0.9
    return 0.0


def sky_I(u, v, band=None, gal=None, seed=7, dens=1.0):
    """The unlensed sky at source position (u, v): the night, stars, a Milky-Way-like band or a galaxy."""
    I = star_I(u, v, seed, dens)
    if band:
        bx, by, ang, w = band
        d = (u - bx) * -math.sin(ang) + (v - by) * math.cos(ang)
        if abs(d) < 3 * w:
            I += math.exp(-(d / w) ** 2) * (.25 + .9 * vnoise(u, v)) * 1.7
    if gal:
        gx, gy, ang, a, b = gal
        dx, dy = u - gx, v - gy
        p = (dx * math.cos(ang) + dy * math.sin(ang)) / a
        q = (-dx * math.sin(ang) + dy * math.cos(ang)) / b
        r2 = p * p + q * q
        I += 3.4 * math.exp(-2.2 * math.sqrt(r2)) + (1.2 if r2 < .02 else 0)
    return I


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def tone(I, x, y):
    """Ink tone of intensity I (0 night ... 4 paper white), ordered-dithered at pixel (x, y), as in the page."""
    lv = int(math.floor(I + (BAYER[y % 4][x % 4] + .5) / 16))
    return TONES[max(0, min(4, lv))]


# ---------------------------------------------------------------- the page's own lens rule, for the mascot and the tap pad
def page_sky(u, v, band):
    """The unlensed sky at source cell (u, v), exactly as the page's skyAt/skyCache: star classes from the integer hash,
    plus a Milky-Way-like band. Returns (star class 0-4, diffuse intensity)."""
    r = h32(math.floor(u), math.floor(v), 7)
    cls = 4 if r < 0.006 else 3 if r < 0.02 else 2 if r < 0.05 else 1 if r < 0.21 else 0
    I = 0.0
    if band:
        bx, by, a, w = band
        d = (u + .5 - bx) * -math.sin(a) + (v + .5 - by) * math.cos(a)
        if abs(d) < 3 * w:
            I = math.exp(-(d / w) ** 2) * (.35 + .9 * vnoise(u + .5, v + .5)) * 2.6
    return cls, I


def page_lens_icon(w, h, holes, band, window=True):
    """Thin-lens ray shooting through point masses, one ray per pixel, as renderSky() in the page: a shadow where
    sum (r_i/d_i)^4 >= 1 (two discs while apart), the photon ring just outside it, otherwise the sky at
    beta = theta - sum E_i^2 (theta - c_i)/|theta - c_i|^2, ordered-dithered."""
    g = blank(w, h)
    cx0, cy0, R0 = (w - 1) / 2, (h - 1) / 2, min(w, h) / 2 - .3
    rmax = max(q["rs"] for q in holes)
    ringS = (rmax / (rmax + 1.1)) ** 4
    for y in range(h):
        for x in range(w):
            if window and math.hypot(x - cx0, y - cy0) > R0:
                continue
            px, py = x + .5, y + .5
            s = smax = 0.0
            bx, by, near = px, py, False
            for q in holes:
                dx, dy = px - q["x"], py - q["y"]
                d2 = dx * dx + dy * dy + 1e-6
                if d2 < (q["rs"] + 1) ** 2:
                    near = True
                q2 = (q["rs"] * q["rs"] / d2) ** 2
                s += q2
                smax = max(smax, q2)
                f = q["E"] * q["E"] / d2
                bx -= dx * f
                by -= dy * f
            if len(holes) > 1:
                s = smax
            if s >= 1:
                g[y][x] = "K"
                continue
            if near or s >= ringS:
                g[y][x] = "W"
                continue
            cls, I = page_sky(math.floor(bx), math.floor(by), band)
            if cls >= 2:
                g[y][x] = "LTW"[cls - 2]
                continue
            if I > 0:
                I += (BAYER[y % 4][x % 4]) / 16
                if I >= 3:
                    g[y][x] = "T"
                    continue
                if I >= 2:
                    g[y][x] = "L"
                    continue
                if I >= 1:
                    g[y][x] = "B"
                    continue
            g[y][x] = "B" if cls == 1 else "K"
    if window:
        for y in range(h):
            for x in range(w):
                d = math.hypot(x - cx0, y - cy0)
                if R0 - 1.0 < d <= R0:
                    g[y][x] = "L"
    return rows(g)


def pair_page(n=76, sep=33.0, ang=-22.0, rs=9.0, band_w=7.0, band_ang=-0.24, band_off=3.0):
    """GW150914's pair as the page draws it: shadows 36 : 29, Einstein radii 1.35x the larger shadow (the page's choice)."""
    c = n / 2
    a = math.radians(ang)
    q = (36 / 65, 29 / 65)
    A = dict(x=c - sep * q[1] * math.cos(a), y=c - sep * q[1] * math.sin(a), rs=rs, E=1.35 * rs)
    B = dict(x=c + sep * q[0] * math.cos(a), y=c + sep * q[0] * math.sin(a), rs=rs * 29 / 36, E=1.35 * rs * math.sqrt(29 / 36))
    return page_lens_icon(n, n, [A, B], (c, c + band_off, band_ang, band_w))


def pair_icon():
    """The hub mascot: GW150914's pair, drawn by the page's own lens rule, in a round window (76 x 76)."""
    return pair_page(76, 33.0, -22.0, 9.0, 7.0, -0.24, 3.0)


def remnant_icon():
    """The 62 Msun remnant on the same rule (56 x 56)."""
    return page_lens_icon(56, 56, [dict(x=28.0, y=28.0, rs=11.5, E=1.35 * 11.5)], (28.0, 31.0, -0.24, 6.5))


# ---------------------------------------------------------------- neutron stars (GW170817)
def ns_icon():
    """The two neutron stars, the same size (a neutron star's radius barely depends on its mass), with a little light
    bent around each, in front of their host galaxy NGC 4993. Hot surfaces, so white, darkening towards the limb."""
    n = 44
    g = blank(n, n)
    c = (n - 1) / 2 + .5
    stars = [(c - 9.5, c + 3.2, 3.3), (c + 9.0, c - 3.0, 3.3)]
    gal = (c - 4, c - 6, math.radians(-25), 9.0, 5.0)
    for y in range(n):
        for x in range(n):
            if math.hypot(x - (n - 1) / 2, y - (n - 1) / 2) > n / 2 - .3:
                continue
            px, py = x + .5, y + .5
            sx, sy, body, halo = px, py, None, 0.0
            for (sxx, syy, r) in stars:
                dx, dy = px - sxx, py - syy
                d = math.hypot(dx, dy) + 1e-9
                if d <= r:
                    body = 4.25 - 1.9 * (d / r) ** 2
                    break
                halo += 1.3 * math.exp(-2.6 * (d / r - 1))
                E = 1.5 * r
                sx, sy = sx - dx * E * E / (d * d), sy - dy * E * E / (d * d)
            I = body if body is not None else sky_I(sx, sy, None, gal, 13, 1.4) + halo
            g[y][x] = tone(I, x, y)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - (n - 1) / 2, y - (n - 1) / 2)
            if n / 2 - 1.3 < d <= n / 2 - .3:
                g[y][x] = "L"
    return rows(g)


# ---------------------------------------------------------------- effects
def flash_frames():
    out = []
    for k, (r_in, r_out) in enumerate(((1.6, 2.6), (2.6, 4.6), (3.6, 7.2), (5.5, 9.8))):
        n = 21
        g = blank(n, n)
        c = 10
        for y in range(n):
            for x in range(n):
                d = math.hypot(x - c, y - c)
                if d <= r_in:
                    g[y][x] = "W"
                elif d <= r_in + 1.4:
                    g[y][x] = "O"
                elif d <= r_out:
                    g[y][x] = "T"
        L = int(r_out + 1.5)
        for d in range(1, min(L, 10) + 1):
            for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                x, y = c + sx * d, c + sy * d
                if 0 <= x < n and 0 <= y < n and g[y][x] in ".T":
                    g[y][x] = "O" if d < r_out else "L"
        if k == 3:
            for y in range(n):
                for x in range(n):
                    if g[y][x] == "T" and (x + y) % 2:
                        g[y][x] = "."
        out.append(rows(g))
    return out


def pad_frames():
    """The tap pad: the pair's shadows (36 : 29) on a patch of night sky, lensed as in the scene; a hit sends a ripple out."""
    W_, H_ = 51, 33
    c = (W_ / 2, H_ / 2)
    a = math.radians(-18)
    q = (36 / 65, 29 / 65)
    holes = [dict(x=c[0] - 22 * q[1] * math.cos(a), y=c[1] - 22 * q[1] * math.sin(a), rs=5.4, E=1.35 * 5.4),
             dict(x=c[0] + 22 * q[0] * math.cos(a), y=c[1] + 22 * q[0] * math.sin(a), rs=5.4 * 29 / 36,
                  E=1.35 * 5.4 * math.sqrt(29 / 36))]
    base = [list(r) for r in page_lens_icon(W_, H_, holes, (c[0], c[1] + 2, -0.21, 4.5), window=False)]
    out = []
    for k in range(4):
        g = [row[:] for row in base]
        if k:
            r = 4.0 + 5.2 * k
            for y in range(H_):
                for x in range(W_):
                    d = math.hypot(x + .5 - c[0], (y + .5 - c[1]) / .62)
                    if r - 1.1 < d <= r and g[y][x] != "K":
                        g[y][x] = "T" if k < 3 else "L"
        for x in range(W_):
            g[0][x] = g[H_ - 1][x] = "K"
        for y in range(H_):
            g[y][0] = g[y][W_ - 1] = "K"
        out.append(rows(g))
    return out


# ---------------------------------------------------------------- the observatories: oblique aerial pixel engravings
# Each LIGO site is drawn as an aerial view from a pinhole camera hanging behind the outside corner of the L, looking
# along the bisector of the two arms, over flat ground in local east/north metres. Everything real is placed from
# published geometry and then projected: the arms' true azimuths, their 3994.5 m length, the mid stations at 2 km, the
# end stations at 4 km, and at Hanford the crest of the Rattlesnake Hills (its two named summits at their real positions
# and heights). What is drawn rather than measured: the buildings' footprints (approximate) and their enlargement, the
# LVEA's cut-away roof with a schematic of the optics inside, the hills' height (x2.5), the ground textures and the light.
def local_en(lat0, lon0, lat, lon):
    """Local east/north metres from (lat0, lon0) (equirectangular; fine over tens of km)."""
    return [round((lon - lon0) * 111320 * math.cos(math.radians(lat0)), 1), round((lat - lat0) * 110574, 1)]


LHO = (46.45514, -119.40766, 142.0)     # vertex, NIM A 517, 154 (2004) site table; ground elevation approximate
LLO = (30.56290, -90.77424, 0.0)
# The crest of the Rattlesnake Hills seen from LIGO Hanford. Rattlesnake Mountain (46.41556 N, 119.63028 W, 1,076 m) and
# Lookout Summit (46.44763 N, 119.84004 W, 1,106 m) are the two named summits; the hills run east-west from Benton City
# towards Yakima, and the other crest points are sketched along that line (approximate).
RIDGE = [(46.300, -119.480, 300), (46.345, -119.545, 650), (46.385, -119.595, 950), (46.41556, -119.63028, 1076),
         (46.428, -119.700, 1000), (46.440, -119.770, 1060), (46.44763, -119.84004, 1106), (46.470, -119.960, 1000),
         (46.500, -120.100, 950), (46.530, -120.300, 850), (46.550, -120.500, 720), (46.560, -120.700, 650)]
ARM = 3994.5          # arm cavity length, m (Aasi et al., CQG 32, 074001, 2015)


def sites():
    ridge = [local_en(LHO[0], LHO[1], la, lo) + [z - LHO[2]] for la, lo, z in RIDGE]
    rm = local_en(LHO[0], LHO[1], 46.41556, -119.63028)
    rm_km = math.hypot(*rm) / 1000
    rm_brg = (math.degrees(math.atan2(rm[0], rm[1])) + 360) % 360
    # Hanford has mid stations at 2 km (they held the end mirrors of its former 2 km interferometer, H2); Livingston's
    # buildings stand at the corner and the two ends only (Daw et al., CQG 21, 2255, 2004, Fig. 1).
    common = {"arm": ARM, "tube_d": 1.2}
    return {
        "H": dict(common, id="H1", name="LIGO HANFORD, WASHINGTON", short="H1 HANFORD", xaz=324.0, yaz=234.0,
                  lat=LHO[0], lon=LHO[1], veg="sage", ridge=ridge, mids=2000.0,
                  peak={"en": rm, "z": round(1076 - LHO[2], 1), "km": round(rm_km, 1), "brg": round(rm_brg, 1)}),
        "L": dict(common, id="L1", name="LIGO LIVINGSTON, LOUISIANA", short="L1 LIVINGSTON", xaz=252.3, yaz=162.3,
                  lat=LLO[0], lon=LLO[1], veg="pine", ridge=[], mids=None),
    }


TK, TB, TL, TT, TW = range(5)      # tone indices into TONES ("KBLTW")
BAYER_NP = np.array(BAYER, float)


def hv(x, y, s):
    """Vectorised h32 (bit-identical on integers)."""
    x = np.asarray(x, np.int64) & 0xFFFFFFFF
    y = np.asarray(y, np.int64) & 0xFFFFFFFF
    h = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return h / 4294967296.0


def vn(u, v, seed=5):
    """Vectorised value noise in [0, 1] (unit cells)."""
    xi, yi = np.floor(u), np.floor(v)
    fx, fy = u - xi, v - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    xi, yi = xi.astype(np.int64), yi.astype(np.int64)
    a, b = hv(xi, yi, seed), hv(xi + 1, yi, seed)
    c, d = hv(xi, yi + 1, seed), hv(xi + 1, yi + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


class Cam:
    """Pinhole camera over flat ground, looking along azimuth va (deg), D m behind the vertex, H m up, pitched p deg down."""
    def __init__(s, va, D, H, p, f, w, h):
        s.va = math.radians(va)
        s.fh = (math.sin(s.va), math.cos(s.va))
        s.rh = (math.cos(s.va), -math.sin(s.va))
        s.pos = (-D * s.fh[0], -D * s.fh[1])
        s.D, s.H, s.p, s.f, s.w, s.h = D, H, math.radians(p), f, w, h
        s.cp, s.sp = math.cos(s.p), math.sin(s.p)
        s.cx, s.cy = w / 2, h / 2
        s.hz = s.cy - f * math.tan(s.p)

    def proj(s, E, N, Z=0.0):
        rx, ry = np.asarray(E, float) - s.pos[0], np.asarray(N, float) - s.pos[1]
        d = rx * s.fh[0] + ry * s.fh[1]
        r = rx * s.rh[0] + ry * s.rh[1]
        z = np.asarray(Z, float) - s.H
        Zc = d * s.cp - z * s.sp
        Yc = d * s.sp + z * s.cp
        with np.errstate(divide="ignore", invalid="ignore"):
            return s.cx + s.f * r / Zc, s.cy - s.f * Yc / Zc, Zc

    def ground(s, x, y):
        a = (x - s.cx) / s.f
        b = -(y - s.cy) / s.f
        hor = b * s.sp + s.cp
        vert = b * s.cp - s.sp
        ok = vert < -1e-6
        t = np.where(ok, -s.H / np.where(ok, vert, -1), 0.0)
        E = s.pos[0] + t * (a * s.rh[0] + hor * s.fh[0])
        N = s.pos[1] + t * (a * s.rh[1] + hor * s.fh[1])
        return E, N, np.where(ok, t * hor, 1e9), ok


def fit_camera(va, w, h, y_h, y_v, x_e, D, arm):
    """Focal length, pitch and height that put the horizon at y_h, the vertex at y_v and the 4 km ends x_e px from the sides."""
    best = None
    cy = h / 2
    a = arm / math.sqrt(2)
    for f in np.arange(50, 500, 0.25):
        p = math.atan((cy - y_h) / f)
        cp, sp = math.cos(p), math.sin(p)
        k = (y_v - cy) / f
        H = D * (sp + k * cp) / (cp - k * sp)
        if H <= 0:
            continue
        err = abs(f * a / ((D + a) * cp + H * sp) - (w / 2 - x_e))
        if best is None or err < best[0]:
            best = (err, f, math.degrees(p), H)
    _, f, p, H = best
    return Cam(va, D, H, p, f, w, h)


def line_px(x0, y0, x1, y1):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
    out = []
    for x, y in zip(np.floor(np.linspace(x0, x1, n)).astype(int), np.floor(np.linspace(y0, y1, n)).astype(int)):
        if not out or out[-1] != (int(x), int(y)):
            out.append((int(x), int(y)))
    return out


def poly_mask(shape, pts):
    h, w = shape
    m = np.zeros(shape, bool)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1 = max(0, int(math.floor(min(xs)))), min(w - 1, int(math.ceil(max(xs))))
    y0, y1 = max(0, int(math.floor(min(ys)))), min(h - 1, int(math.ceil(max(ys))))
    if x1 < x0 or y1 < y0:
        return m
    X, Y = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
    inside = np.zeros_like(X, bool)
    for i in range(len(pts)):
        (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % len(pts)]
        if ya == yb:
            continue
        inside ^= ((ya > Y) != (yb > Y)) & (X < xa + (Y - ya) * (xb - xa) / (yb - ya))
    m[y0:y1 + 1, x0:x1 + 1] = inside
    return m


def hull(pts):
    pts = sorted(set(pts))
    if len(pts) <= 2:
        return pts
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


class Plate:
    """One site's view: arm coordinates (a along the X arm, b along the Y arm, metres from the vertex) and the camera."""
    def __init__(s, sd, w, h, D, y_h, y_v, x_e, cscale, bscale, hill_x):
        s.sd, s.w, s.h, s.kind, s.arm = sd, w, h, sd["veg"], sd["arm"]
        s.ux = (math.sin(math.radians(sd["xaz"])), math.cos(math.radians(sd["xaz"])))
        s.uy = (math.sin(math.radians(sd["yaz"])), math.cos(math.radians(sd["yaz"])))
        s.det = s.ux[0] * s.uy[1] - s.ux[1] * s.uy[0]
        s.view = math.degrees(math.atan2(s.ux[0] + s.uy[0], s.ux[1] + s.uy[1])) % 360   # the arms' bisector
        s.cam = fit_camera(s.view, w, h, y_h, y_v, x_e, D, s.arm)
        s.cscale, s.bscale, s.hill_x = cscale, bscale, hill_x

    def en(s, a, b):
        return a * s.ux[0] + b * s.uy[0], a * s.ux[1] + b * s.uy[1]

    def ab(s, E, N):
        return (E * s.uy[1] - N * s.uy[0]) / s.det, (s.ux[0] * N - s.ux[1] * E) / s.det

    def P(s, a, b, z=0.0):
        E, N = s.en(a, b)
        x, y, Zc = s.cam.proj(E, N, z)
        return float(x), float(y), float(Zc)

    def px_per_m_at_end(s, axis):
        p0 = s.P(s.arm, 0) if axis == 0 else s.P(0, s.arm)
        p1 = s.P(s.arm + 10, 0) if axis == 0 else s.P(0, s.arm + 10)
        return math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 10


def site_boxes(pl, ex, ey):
    """The buildings, (a0, a1, b0, b1, height m, enlargement, kind). Footprints are approximate; the corner complex is
    drawn cscale times and the mid and end stations bscale times their size so they read at this scale."""
    cs, bs = pl.cscale, pl.bscale
    out = {
        "hall": (-40, 50, -40, 50, 13, cs, "hall"),     # the LVEA high bay: laser, beam splitter, input test masses, photodetector
        "xwing": (50, 138, -15, 15, 13, cs, "wing"),    # X-arm wing
        "ywing": (-15, 15, 50, 138, 13, cs, "wing"),    # Y-arm wing
        "office": (-78, -40, 4, 56, 10, cs, "office"),  # offices and the control room
        "endx": (ex - 26, ex + 30, -20, 20, 11, bs, "station"),     # end stations, 4 km: the end test masses
        "endy": (-20, 20, ey - 26, ey + 30, 11, bs, "station"),
    }
    m = pl.sd.get("mids")
    if m:                                                        # Hanford's mid stations, 2 km
        out["midx"] = (m - 18, m + 18, -16, 16, 9, bs, "station")
        out["midy"] = (-16, 16, m - 18, m + 18, 9, bs, "station")
    return out


def scaled_box(b):
    a0, a1, b0, b1, hh, sc, kind = b
    ac, bc = (a0 + a1) / 2, (b0 + b1) / 2
    return (ac + (a0 - ac) * sc, ac + (a1 - ac) * sc, bc + (b0 - bc) * sc, bc + (b1 - bc) * sc, hh * sc, kind)


def light_dir(pl):
    """The light comes from the picture's left and from behind the viewer (a plate convention)."""
    c = pl.cam
    return (-c.rh[0] - 0.35 * c.fh[0], -c.rh[1] - 0.35 * c.fh[1])


def draw_hills(pl, g):
    cam, (h, w) = pl.cam, g.shape
    hz, yhz = cam.hz, int(math.floor(cam.hz))
    pts = []
    for e_, n_, z_ in pl.sd["ridge"]:
        x, y, Zc = cam.proj(e_, n_, z_ * pl.hill_x)
        if Zc > 0:
            pts.append((float(x), float(y)))
    pts.sort()
    px_, py_ = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
    cols = np.arange(w) + .5
    prof = np.interp(cols, px_, py_)
    prof = np.where(cols < px_[0], py_[0] + (px_[0] - cols) * 0.30, prof)       # beyond the crest points the hills fall
    prof = np.where(cols > px_[-1], py_[-1] + (cols - px_[-1]) * 0.30, prof)    # away to the plain
    prof = np.minimum(prof + (vn(cols / 2.5, np.full(w, 3.3), 11) - .5) * 1.4, hz)
    for x in range(w):
        top = prof[x]
        if top > hz - 1:
            continue
        y0 = int(math.floor(top))
        shaded = prof[min(w - 1, x + 1)] > prof[x] + 0.15        # a slope falling to the right, away from the light
        for y in range(max(1, y0), yhz):
            dep = (y - top) / max(1.0, hz - top)
            if y == y0:
                g[y, x] = TB if shaded else TL
            elif y % 2 == 0:                                     # engraved horizontal hatching, thinning into the haze
                if hv(x, y, 3) < (0.95 - 0.55 * dep):
                    g[y, x] = TB if (shaded and dep < 0.35 and hv(x, y, 5) < .6) else TL
            elif shaded and dep < 0.3 and hv(x, y, 4) < 0.5:
                g[y, x] = TL


def draw_treeline(pl, g):
    hz, w = pl.cam.hz, g.shape[1]
    band = 1.2 + 1.6 * vn((np.arange(w) + .5) / 3.0, np.full(w, 1.7), 23)
    for x in range(w):
        for y in range(max(1, int(math.floor(hz - band[x]))), int(math.floor(hz)) + 1):
            g[y, x] = TL if (x + y) % 2 == 0 or y >= hz - 1 else TT


def stipple(pl, g, gm, cell, prob, seed):
    """Sagebrush: one bush per jittered cell, thinning with distance; each casts a pixel of shadow to the right."""
    cam, (h, w) = pl.cam, g.shape
    R = 9000
    E0, N0 = cam.pos
    I, J = np.meshgrid(np.arange(math.floor((E0 - R) / cell), math.ceil((E0 + R) / cell)),
                       np.arange(math.floor((N0 - R) / cell), math.ceil((N0 + R) / cell)))
    x, y, Zc = cam.proj((I + hv(I, J, seed + 1)) * cell, (J + hv(I, J, seed + 2)) * cell, 0)
    size = cell * cam.f / np.maximum(Zc, 1)
    keep = hv(I, J, seed) < prob * np.clip((size - 1.6) / 4.0, 0, 1)
    ok = keep & (Zc > 10) & (x >= 1) & (x < w - 2) & (y >= 1) & (y < h - 1)
    for X, Y, s_, bb in zip(x[ok].astype(int), y[ok].astype(int), size[ok], hv(I[ok], J[ok], seed + 3)):
        if not gm[Y, X] or g[Y, X] not in (TW, TT):
            continue
        g[Y, X] = TB
        if s_ > 3.0 and bb < 0.6 and g[Y, X + 1] in (TW, TT):
            g[Y, X + 1] = TL
        if s_ > 4.4 and bb < 0.3 and g[Y - 1, X] in (TW, TT):
            g[Y - 1, X] = TB


def cleared(pl, a, b):
    """Livingston: the forest is cleared along each arm and around the stations (widths approximate)."""
    La = pl.arm
    corr = ((np.abs(b) < 45) & (a > -100) & (a < La + 160)) | ((np.abs(a) < 45) & (b > -100) & (b < La + 160))
    rr = 250 + 90 * vn(np.arctan2(b - 40, a - 40) * 2.2 + 9.0, np.full(np.shape(a), 2.5), 29)
    st = (np.hypot(a - La, b) < 140) | (np.hypot(a, b - La) < 140)
    if pl.sd.get("mids"):
        m = pl.sd["mids"]
        st = st | (np.hypot(a - m, b) < 110) | (np.hypot(a, b - m) < 110)
    return corr | (np.hypot(a - 40, b - 40) < rr) | st


def forest(pl, g, gm, A, Bb, d, bay):
    """Loblolly pine forest: a tone in clumps far off (lighter towards the horizon), single crowns nearer, lit from the left."""
    cam, (h, w) = pl.cam, g.shape
    cl = cleared(pl, A, Bb)
    nz = vn(A / 220.0, Bb / 220.0, 17)
    lvl = (1.0 - 0.6 * np.clip((d - 2500) / 9000, 0, 1)) * (2.2 + 1.2 * nz)
    q = np.floor(lvl + (bay + .5) / 16)
    fm = gm & ~cl
    g[fm & (q >= 3)] = TB
    g[fm & (q == 2)] = TL
    g[fm & (q <= 1)] = TT
    clr = gm & cl                       # clearings: mown grass, a sparse tint stipple
    g[clr] = TW
    yy, xx = np.nonzero(clr)
    sel = hv(xx, yy, 41) < 0.09
    g[yy[sel], xx[sel]] = TT
    cell, R = 15.0, 5000
    E0, N0 = cam.pos
    I, J = np.meshgrid(np.arange(math.floor((E0 - R) / cell), math.ceil((E0 + R) / cell)),
                       np.arange(math.floor((N0 - R) / cell), math.ceil((N0 + R) / cell)))
    ce, cn = (I + hv(I, J, 51)) * cell, (J + hv(I, J, 52)) * cell
    ca, cb = pl.ab(ce, cn)
    x, y, Zc = cam.proj(ce, cn, 24.0)
    rad = (5.0 + 3.0 * hv(I, J, 53)) * cam.f / np.maximum(Zc, 1)
    ok = (~cleared(pl, ca, cb)) & (Zc > 10) & (x > -3) & (x < w + 3) & (y > cam.hz) & (y < h + 3) & (rad > 0.75)
    o = np.argsort(-Zc[ok])
    for cx_, cy_, r in zip(x[ok][o], y[ok][o], rad[ok][o]):
        rr = min(r, 3.4)
        for yy_ in range(max(1, int(cy_ - rr)), min(h - 1, int(cy_ + rr) + 1)):
            for xx_ in range(max(1, int(cx_ - rr)), min(w - 1, int(cx_ + rr) + 1)):
                dx, dy = xx_ + .5 - cx_, yy_ + .5 - cy_
                dd = math.hypot(dx, dy)
                if dd > rr or not gm[yy_, xx_]:
                    continue
                s = (dx + dy) / max(rr, .6)
                if rr < 1.2:
                    g[yy_, xx_] = TB if s < 0.3 else TK
                elif s < -0.75:
                    g[yy_, xx_] = TL
                elif s > 0.4 or (dd > rr - .6 and s > 0):
                    g[yy_, xx_] = TK
                else:
                    g[yy_, xx_] = TB


def road(pl, g, gm, pts_ab, tone, dash=None, width=1):
    h, w = g.shape
    P = [pl.P(a, b) for a, b in pts_ab]
    for p0, p1 in zip(P, P[1:]):
        if p0[2] < 30 or p1[2] < 30:
            continue
        for (x, y) in line_px(p0[0], p0[1], p1[0], p1[1]):
            for k in range(width):
                xx = x + k
                if 0 < xx < w - 1 and 0 < y < h - 1 and gm[y, xx] and (dash is None or (xx + y) % dash):
                    g[y, xx] = tone


def shadow(pl, g, b):
    a0, a1, b0, b1, hh, kind = b
    Ld = light_dir(pl)
    va, vb = pl.ab(-Ld[0], -Ld[1])
    pts = []
    for (a, bb) in ((a0, b0), (a1, b0), (a1, b1), (a0, b1)):
        pts.append(pl.P(a, bb)[:2])
        pts.append(pl.P(a + va * hh, bb + vb * hh)[:2])
    yy, xx = np.nonzero(poly_mask(g.shape, hull(pts)))
    on = (xx + yy) % 2 == 0
    g[yy[on], xx[on]] = np.where(g[yy[on], xx[on]] == TW, TL, TB)
    g[yy[~on], xx[~on]] = np.where(g[yy[~on], xx[~on]] == TW, TT, g[yy[~on], xx[~on]])


def cutaway(pl, g, b, mt):
    """Inside the LVEA with the roof cut away: the far walls' inner faces, the floor, the vacuum chambers as short
    cylinders (the beam splitter's and the two input test masses' BSC chambers, an input and an output HAM chamber), the
    laser on its table and the photodetector, and the Michelson's beam paths: laser -> beam splitter -> each input test
    mass and on into its arm, and back from the beam splitter to the photodetector at the dark port. A schematic: the
    positions and the chamber sizes are exaggerated."""
    a0, a1, b0, b1, hh, kind = b
    h, w = g.shape
    yy, xx = np.nonzero(mt)
    g[yy, xx] = np.where((xx % 2) == 0, TB, TL).astype(np.uint8)
    floor = poly_mask(g.shape, [pl.P(a, bb, 0)[:2] for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]) & mt
    yy, xx = np.nonzero(floor)
    g[yy, xx] = np.where(((xx + 2 * yy) % 5) == 0, TT, TW).astype(np.uint8)
    cs = pl.cscale
    z = 1.5 * cs
    O = {k: tuple(v * cs for v in xy) for k, xy in {"laser": (-34, -6), "bs": (0, 0), "itmx": (24, 0), "itmy": (0, 24),
                                                     "pd": (-6, -34), "exx": (50, 0), "exy": (0, 50)}.items()}
    paths = {"in": [O["laser"], (O["laser"][0], 0), O["bs"]], "x": [O["bs"], O["itmx"], O["exx"]],
             "y": [O["bs"], O["itmy"], O["exy"]], "out": [O["bs"], (0, O["pd"][1]), O["pd"]]}
    pl.beam_px = {}
    for k_, pts in paths.items():
        P = [pl.P(a, bb, z)[:2] for a, bb in pts]
        px = []
        for p0, p1 in zip(P, P[1:]):
            for q in line_px(p0[0], p0[1], p1[0], p1[1]):
                if 0 <= q[0] < w and 0 <= q[1] < h and floor[q[1], q[0]] and q not in px:
                    px.append(q)
        pl.beam_px[k_] = px
        for i_, (x, y) in enumerate(px):
            if i_ % 2 == 0:
                g[y, x] = TB

    def inside(X, Y, cx_, cy_, by_, rx, ry):
        dx = (X + .5 - cx_) / rx
        return dx * dx + ((Y + .5 - cy_) / ry) ** 2 <= 1 or (abs(dx) <= 1 and cy_ <= Y + .5 <= by_ + ry * math.sqrt(max(0, 1 - dx * dx)))

    def cyl(ab, rad, hgt):
        cx_, cy_, Zc = pl.P(ab[0], ab[1], hgt)
        _, by_, _ = pl.P(ab[0], ab[1], 0)
        rx = max(1.0, rad * pl.cam.f / Zc)
        ry = max(0.8, rx * 0.55)
        box_ = [(X, Y) for Y in range(int(cy_ - ry - 1), int(by_ + ry + 2)) for X in range(int(cx_ - rx - 1), int(cx_ + rx + 2))
                if 0 < X < w - 1 and 0 < Y < h - 1 and mt[Y, X]]
        for (X, Y) in box_:
            dx = (X + .5 - cx_) / rx
            if dx * dx + ((Y + .5 - cy_) / ry) ** 2 <= 1:
                g[Y, X] = TW
            elif inside(X, Y, cx_, cy_, by_, rx, ry):
                g[Y, X] = TB if dx > -0.2 else TL
        for (X, Y) in box_:
            if inside(X, Y, cx_, cy_, by_, rx, ry) and not all(inside(X + i, Y + j, cx_, cy_, by_, rx, ry)
                                                               for i, j in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                g[Y, X] = TK
        return [round(cx_, 1), round(cy_, 1)]

    pl.parts = {}
    for name, ab, rad, hgt in (("ham_in", (O["laser"][0] * 0.5, 0), 2.2, 3.5), ("ham_out", (0, O["pd"][1] * 0.55), 2.2, 3.5),
                               ("itmy", O["itmy"], 2.6, 5.0), ("bs", O["bs"], 2.6, 5.0), ("itmx", O["itmx"], 2.6, 5.0)):
        pl.parts[name] = cyl(ab, rad * cs * 1.8, hgt * cs)
    for name, ab in (("laser", O["laser"]), ("pd", O["pd"])):
        x_, y_, _ = pl.P(ab[0], ab[1], z)
        X, Y = int(x_), int(y_)
        for dx in (-1, 0, 1):
            for dy in (-1, 0):
                if 0 < X + dx < w - 1 and 0 < Y + dy < h - 1 and mt[Y + dy, X + dx]:
                    g[Y + dy, X + dx] = TK if dy == 0 else TB
        pl.parts[name] = [round(x_, 1), round(y_, 1)]


def box(pl, g, b):
    """A building as a shaded box: sunlit walls in paper with a blue band under the eaves (LIGO's corner, mid and end
    stations are white-and-blue buildings), walls in shade hatched, a light roof, an ink outline. The LVEA is cut away."""
    a0, a1, b0, b1, hh, kind = b
    foot = [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]
    bot = [pl.P(a, bb, 0)[:2] for a, bb in foot]
    top = [pl.P(a, bb, hh)[:2] for a, bb in foot]
    c, (h, w) = pl.cam, g.shape
    mask = np.zeros(g.shape, bool)
    Ld = light_dir(pl)
    cen = pl.en((a0 + a1) / 2, (b0 + b1) / 2)
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        (E0, N0), (E1, N1) = pl.en(*foot[i]), pl.en(*foot[j])
        nx, ny = (N1 - N0), -(E1 - E0)
        mx, my = (E0 + E1) / 2, (N0 + N1) / 2
        if nx * (mx - cen[0]) + ny * (my - cen[1]) < 0:
            nx, ny = -nx, -ny
        if nx * (c.pos[0] - mx) + ny * (c.pos[1] - my) <= 0:
            continue
        faces.append((i, j, (nx * Ld[0] + ny * Ld[1]) / math.hypot(nx, ny) / math.hypot(*Ld)))
    small = max(p[0] for p in top + bot) - min(p[0] for p in top + bot) < 12
    mt = poly_mask(g.shape, top)
    yy, xx = np.nonzero(mt)
    if kind == "hall":
        cutaway(pl, g, b, mt)
    elif kind == "wing":
        g[yy, xx] = np.where(((xx - 2 * yy) % 3) == 0, TL, TT).astype(np.uint8)
    elif kind == "office":
        g[yy, xx] = np.where((xx + yy) % 2 == 0, TL, TT).astype(np.uint8)
    else:
        g[yy, xx] = TT
    mask |= mt
    walls = np.zeros(g.shape, bool)
    for (i, j, lit) in faces:
        m = poly_mask(g.shape, [bot[i], bot[j], top[j], top[i]])
        yy, xx = np.nonzero(m)
        if not len(xx):
            continue
        order = (lambda u, v: [u, v]) if bot[i][0] <= bot[j][0] else (lambda u, v: [v, u])
        ybot = np.interp(xx + .5, sorted([bot[i][0], bot[j][0]]), order(bot[i][1], bot[j][1]))
        ordt = (lambda u, v: [u, v]) if top[i][0] <= top[j][0] else (lambda u, v: [v, u])
        ytop = np.interp(xx + .5, sorted([top[i][0], top[j][0]]), ordt(top[i][1], top[j][1]))
        fr = (ybot - (yy + .5)) / np.maximum(ybot - ytop, 0.5)          # 0 at the ground, 1 at the eaves
        if lit > 0.25:
            tone = np.full(len(xx), TW, np.uint8)
            if not small:
                tone[(xx % 4) == 0] = TT
            tone[fr > (0.72 if not small else 0.6)] = TB if kind != "office" else TL
        elif lit > -0.25:
            tone = np.full(len(xx), TT, np.uint8)
            tone[fr > 0.72] = TB
        else:
            tone = np.where((xx % 2) == 0, TB, TL).astype(np.uint8)
            tone[fr > 0.72] = TK
        if kind == "office" and not small:      # rows of windows
            tone[((np.abs(fr - 0.33) < 0.09) | (np.abs(fr - 0.62) < 0.09)) & ((xx % 2) == 0)] = TK
        g[yy, xx] = tone
        mask |= m
        walls |= m
    if kind == "hall":
        pl.beam_px = {k: [q for q in v if not walls[q[1], q[0]]] for k, v in pl.beam_px.items()}
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    g[edge] = TK
    for i in range(4):
        for (x, y) in line_px(*top[i], *top[(i + 1) % 4]):
            if 0 <= x < w and 0 <= y < h and mask[y, x]:
                g[y, x] = TK
    if not small:
        for (i, j, lit) in faces:
            for k in (i, j):
                for (x, y) in line_px(*bot[k], *top[k]):
                    if 0 <= x < w and 0 <= y < h and mask[y, x] and not edge[y, x]:
                        g[y, x] = TK
    return [round((top[0][0] + top[2][0]) / 2, 1), round((top[0][1] + top[2][1]) / 2, 1)]


N_GLYPH = ["K..K", "KK.K", "K.KK", "K..K", "K..K"]


def compass(pl, g):
    """A north arrow laid on the ground in the lower-left corner: it shows which way the view looks."""
    h, w = g.shape
    c = pl.cam
    x0, y0 = 12.5, h - 12.5
    E, N, _, _ = c.ground(np.array([x0]), np.array([y0]))
    x1, y1, _ = c.proj(float(E[0]), float(N[0]) + 40.0, 0)
    dx, dy = float(x1) - x0, float(y1) - y0
    n = math.hypot(dx, dy)
    dx, dy = dx / n, dy / n
    tip, tail = (x0 + dx * 4, y0 + dy * 4), (x0 - dx * 4, y0 - dy * 4)
    pix = set(line_px(tail[0], tail[1], tip[0], tip[1]))
    for s_ in (-1, 1):
        pix |= set(line_px(tip[0] - dx * 2.6 - s_ * dy * 1.9, tip[1] - dy * 2.6 + s_ * dx * 1.9, tip[0], tip[1]))
    lx = int(round(min(w - 7, max(3, tip[0] + dx * 4.5 - 1.5))))
    ly = int(round(min(h - 8, max(3, tip[1] + dy * 4.5 - 2.5))))
    for j, row in enumerate(N_GLYPH):
        for q, ch in enumerate(row):
            if ch == "K":
                pix.add((lx + q, ly + j))
    for (x, y) in list(pix):                     # a paper halo, so it reads on sagebrush or forest
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                if 0 < x + ox < w - 1 and 0 < y + oy < h - 1:
                    g[y + oy, x + ox] = TW
    for (x, y) in pix:
        if 0 < x < w - 1 and 0 < y < h - 1:
            g[y, x] = TK


def render_site(sd, w, h, frame, D=300.0, y_h=None, y_v=None, x_e=None, stretch_px=2.0, cscale=1.6, bscale=3.5, hill_x=2.5):
    """One frame of one site: 0 at rest; 1 the X arm stretched and the Y arm squeezed; 2 the other way round. The end
    station moves stretch_px pixels along its arm (drawn: the real change at GW150914's peak was ~4e-18 m)."""
    y_h = round(h * 0.2) if y_h is None else y_h
    y_v = h - round(h * 0.24) if y_v is None else y_v
    x_e = round(w * 0.035) if x_e is None else x_e
    pl = Plate(sd, w, h, D, y_h, y_v, x_e, cscale, bscale, hill_x)
    cam = pl.cam
    g = np.full((h, w), TW, np.uint8)
    xs, ys = np.meshgrid(np.arange(w) + .5, np.arange(h) + .5)
    E, N, d, isg = cam.ground(xs, ys)
    A, Bb = pl.ab(E, N)
    gm = isg & (ys > cam.hz + 0.5)
    yhz = int(math.floor(cam.hz))
    if sd.get("ridge"):
        draw_hills(pl, g)
    else:
        draw_treeline(pl, g)
    row = g[yhz]
    row[row == TW] = TL
    bay = BAYER_NP[(np.arange(h)[:, None] % 4), (np.arange(w)[None, :] % 4)]
    if pl.kind == "sage":
        last = 10 ** 9      # engraved ground: lines of constant distance (level in this view) every 150 m, then the sage
        for y in range(h - 2, yhz, -1):
            if gm[y].any() and math.floor(d[y, w // 2] / 150.0) != math.floor(d[y + 1, w // 2] / 150.0) and last - y >= 3:
                last = y
                sel = gm[y] & (vn(xs[y] / 9.0, np.full(w, y * 1.37), 21) > 0.32) & (g[y] == TW)
                g[y][sel] = TT
        stipple(pl, g, gm, cell=34.0, prob=0.34, seed=31)
    else:
        forest(pl, g, gm, A, Bb, d, bay)
    sage = pl.kind == "sage"
    La = pl.arm
    road(pl, g, gm, [(150, -34), (La + 80, -34)], TT if sage else TL, dash=3)        # service roads, outside the L
    road(pl, g, gm, [(-34, 150), (-34, La + 80)], TT if sage else TL, dash=3)
    road(pl, g, gm, [(-120, -100), (-200, -150), (-300, -190), (-420, -215), (-560, -225), (-700, -228)],
         TT if sage else TW, width=2)                                                 # the access road
    sx, sy = stretch_px / pl.px_per_m_at_end(0), stretch_px / pl.px_per_m_at_end(1)
    ex = La + (sx if frame == 1 else -sx if frame == 2 else 0)
    ey = La + (sy if frame == 2 else -sy if frame == 1 else 0)
    bd = {k: scaled_box(b) for k, b in site_boxes(pl, ex, ey).items()}
    for b in bd.values():
        shadow(pl, g, b)
    # the arms: the beam tube under its arched concrete cover, a dark line with its shadow below
    arm_px = {}
    for key, ab0, ab1 in (("x", (bd["xwing"][1], 0), (ex, 0)), ("y", (0, bd["ywing"][3]), (0, ey))):
        p0, p1 = pl.P(*ab0, 2.5), pl.P(*ab1, 2.5)
        pix = [q for q in line_px(p0[0], p0[1], p1[0], p1[1]) if 0 < q[0] < w - 1 and 0 < q[1] < h - 2]
        for (x, y) in pix:
            g[y, x] = TK
        for (x, y) in pix:
            if g[y + 1, x] != TK:
                g[y + 1, x] = TL if sage else TT
        arm_px[key] = pix
    roofs = {}
    for k, b in sorted(bd.items(), key=lambda kb: -pl.P((kb[1][0] + kb[1][1]) / 2, (kb[1][2] + kb[1][3]) / 2)[2]):
        roofs[k] = box(pl, g, b)
    compass(pl, g)
    g[0, :] = TK
    g[-1, :] = TK
    g[:, 0] = TK
    g[:, -1] = TK
    # what the page needs: where things are, in sprite pixels
    vis = lambda pix: [[x, y] for (x, y) in pix if g[y, x] == TK]
    meta = {
        "w": w, "h": h, "hz": round(cam.hz, 1), "view": round(pl.view, 1),
        "V": pl.parts["bs"], "parts": pl.parts, "beams": {k: [[x, y] for x, y in v] for k, v in pl.beam_px.items()},
        "arms": {"x": vis(arm_px["x"]), "y": vis(arm_px["y"])},
        "ends": {"x": roofs["endx"], "y": roofs["endy"]},
        "mids": {"x": roofs["midx"], "y": roofs["midy"]} if "midx" in roofs else None,
        "corner": roofs["hall"], "office": roofs["office"],
        "cam": {"D": cam.D, "H": round(cam.H), "pitch": round(math.degrees(cam.p), 1), "f": cam.f,
                "scale_corner": cscale, "scale_stations": bscale, "hills_x": hill_x},
    }
    if sd.get("peak"):
        pk = sd["peak"]
        x, y, _ = cam.proj(pk["en"][0], pk["en"][1], pk["z"] * hill_x)
        meta["peak"] = [round(float(x), 1), round(float(y), 1)]
    return ["".join(TONES[v] for v in r) for r in g], meta


def observatory(sd, w, h):
    """Three frames (rest, X stretched, Y stretched) and the anchor points the page labels and animates."""
    frames, metas = [], []
    for fr in range(3):
        rows_, meta = render_site(sd, w, h, fr)
        frames.append(rows_)
        metas.append(meta)
    meta = metas[0]
    meta["arms_f"] = [m["arms"] for m in metas]
    meta["ends_f"] = [m["ends"] for m in metas]
    del meta["arms"], meta["ends"]
    return {"frames": frames, "fps": 1, "meta": meta}


# ---------------------------------------------------------------- props
STAR = [[".L.", "LTL", ".L."], ["...", ".T.", "..."]]
GRAIN = [[".B.", "BKB", ".B."], ["...", ".L.", "..."]]
NOTE = ["..KK.",
        "..KBK",
        "..K.K",
        "..K..",
        "KKK..",
        "KBK..",
        "KK..."]

# the 3x5 pixel font shared with the other pieces (02's face), plus a few extra glyphs
FONT_CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()/-.:!"
FONT_ROWS = ["....K.KK..KKKK.KKKKKK.KKK.KKKK..KK.KK..K.KKK..K.KK..K.KK..KKKKKK.KK.KK.KK.KK.KKKKKKK.K.KK.KK.K.KKKK.KKKKKKKKKKK..KK....K..........K.",
             "...K.KK.KK..K.KK..K..K..K.K.K...KK.KK..KKKK.KK.KK.KK.KK.KK...K.K.KK.KK.KK.KK.K..KK.KKK...K..KK.KK..K....KK.KK.K.K..K...K.......K..K.",
             "...KKKKK.K..K.KKK.KK.K.KKKK.K...KKK.K..KKKK.KK.KKK.K.KKK..K..K.K.KK.KKKK.K..K..K.K.K.K..K..K.KKKKK.KKK.K.KKKKKK.K..K..K.KKK.......K.",
             "...K.KK.KK..K.KK..K..K.KK.K.K.K.KK.KK..K.KK.KK.KK..KK.K.K..K.K.K.KK.KKKKK.K.K.K..K.K.K.K....K..K..KK.K.K.K.K..K.K..K.K.........K....",
             "...K.KKK..KKKK.KKKK...KKK.KKKK.K.K.KKKKK.KK.K.K.K...KKK.KKK..K.KKK.K.K.KK.K.K.KKKKKKKKKKKKKK...KKK.KKK.K.KKKKK...KK..K......K.....K."]


def font():
    extra = {"+": ["...", ".K.", "KKK", ".K.", "..."], "?": ["KK.", "..K", ".K.", "...", ".K."],
             ",": ["...", "...", "...", ".K.", "K.."], "=": ["...", "KKK", "...", "KKK", "..."],
             "~": ["...", "...", ".KK", "KK.", "..."], "'": [".K.", ".K.", "...", "...", "..."],
             "%": ["K.K", "..K", ".K.", "K..", "K.K"]}
    rws, chars = list(FONT_ROWS), FONT_CHARS
    for ch, art in extra.items():
        if ch in chars:
            continue
        chars += ch
        rws = [r + art[j] for j, r in enumerate(rws)]
    return {"chars": chars, "w": 3, "h": 5, "rows": rws}


def main():
    sprites = {
        "mascot": {"frames": [pair_icon()], "fps": 1},
        "remnant": {"frames": [remnant_icon()], "fps": 1},
        "ns": {"frames": [ns_icon()], "fps": 1},
        "flash": {"frames": flash_frames(), "fps": 8},
        "pad": {"frames": pad_frames(), "fps": 12},
        "grain": {"frames": GRAIN, "fps": 6},
        "star": {"frames": STAR, "fps": 1},
        "note": {"frames": [NOTE], "fps": 1},
    }
    st = sites()
    for key in ("H", "L"):
        sprites["obs" + key] = observatory(st[key], 224, 118)        # wide screens
        sprites["obs" + key + "n"] = observatory(st[key], 156, 72)   # tablets and phones
    sprites["font"] = font()
    sprites["sites"] = st
    OUT.write_text(json.dumps(sprites, separators=(",", ":")), encoding="utf-8")
    pk = st["H"]["peak"]
    print(f"{OUT}: {len(sprites) - 2} sprites + font + sites, {OUT.stat().st_size / 1e3:.1f} kB; "
          f"Rattlesnake Mtn from H1: {pk['km']} km at bearing {pk['brg']} deg; "
          f"views H1 {sprites['obsH']['meta']['view']} deg, L1 {sprites['obsL']['meta']['view']} deg")


if __name__ == "__main__":
    main()
