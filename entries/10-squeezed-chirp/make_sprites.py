"""Write web/sprites.json for LIGO Night Shift: realistic pixel art in the shared ink palette (common/SPRITES.md).

Realism pass (user, 5 Oct 2026): no cartoon characters. The one sprite family is the source of GW150914,
two black holes seen against a star field, drawn by the same gravitational-lensing rule the page uses on its
"source view" monitor:

    each black hole is a point lens: a sky ray at screen position x is bent to x - sum_i E_i^2 (x - p_i) / |x - p_i|^2
    (E_i = Einstein radius, proportional to sqrt(mass)); rays that pass inside a black hole's shadow radius
    (proportional to mass) are dark; a thin photon ring of lensed starlight sits on each shadow's edge.

Masses 36 and 29 suns (and 62 after the merger) are LIGO and Virgo's published estimates (Abbott et al.,
PRL 116, 061102, 2016). It is an illustration, not a general-relativity simulation: no accretion disc (GW150914's
black holes had none that we know of), sizes not to scale.

The star field is rendered at 4x4 supersampling, averaged, then quantised to the palette with an ordered dither:
'K' shadow, porthole rim and the darkest sky (dithered with 'B'), 'B' night sky, 'L' Milky Way, 'T' and 'W'
stars and the photon rings,
'.' transparent outside the round porthole.

    bh_pair   96 x 96, the inspiral (the hub mascot, web/img/mascot.png at 2x, and the title badge)
    bh_final  48 x 48, the single 62-sun black hole after the merger (the page's "caught" badge)

Run: python make_sprites.py   (no Atlas calls, no inputs)
"""
import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SS = 4                                   # supersampling per pixel
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def sky(n, seed):
    """Unlensed sky brightness on an n x n supersampled plane (0 = night, 1 = brightest star)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    # a Milky Way band across the field with dust lanes (sums of sines: smooth, deterministic)
    u = (x * 0.8 + y * 0.6) - 0.62
    lanes = 0.5 + 0.25 * np.sin(23 * x + 7 * np.sin(5 * y)) * np.sin(17 * y + 3 * np.cos(9 * x))
    b = 0.08 + 0.22 * np.exp(-(u / 0.13) ** 2) * lanes
    for _ in range(int(n * n / 640)):                      # stars, power-law brightness
        sx, sy = rng.random() * n, rng.random() * n
        amp = min(1.6, 0.5 / (rng.random() ** 0.8 + 0.12))
        sig = (0.5 + 0.35 * min(amp, 1.0)) * SS * 0.5
        r = int(4 * sig) + 1
        x0, x1, y0, y1 = max(0, int(sx) - r), min(n, int(sx) + r + 1), max(0, int(sy) - r), min(n, int(sy) + r + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1]
        b[y0:y1, x0:x1] += amp * np.exp(-((xx - sx) ** 2 + (yy - sy) ** 2) / (2 * sig * sig))
    return np.clip(b, 0, 1.4)


def lensed(size, lenses, seed):
    """Render a size x size lensed sky; lenses = [(cx, cy, shadow_r, einstein_r)] in pixels.
    Returns per-pixel brightness (NaN = inside a shadow)."""
    n = size * SS
    src = sky(n, seed)
    y, x = (np.mgrid[0:n, 0:n] + 0.5) / SS
    bx, by = x.copy(), y.copy()
    shadow = np.zeros_like(x, dtype=bool)
    ring = np.zeros_like(x)
    for cx, cy, rs, re in lenses:
        dx, dy = x - cx, y - cy
        r2 = dx * dx + dy * dy + 1e-9
        bx -= re * re * dx / r2
        by -= re * re * dy / r2
        r = np.sqrt(r2)
        shadow |= r < rs
        ring += np.exp(-((r - rs * 1.07) / (0.10 * rs)) ** 2)
    sxi = np.clip(np.round(bx * SS).astype(int) % n, 0, n - 1)
    syi = np.clip(np.round(by * SS).astype(int) % n, 0, n - 1)
    b = src[syi, sxi] + 1.5 * ring
    b[shadow] = np.nan
    # average each SS x SS block; a pixel is shadow if most of it is
    b4 = b.reshape(size, SS, size, SS)
    sh = np.isnan(b4).mean(axis=(1, 3)) > 0.5
    val = np.nanmean(np.where(np.isnan(b4), 0.0, b4), axis=(1, 3))
    val[sh] = np.nan
    return val


def quantise(val, rim_r):
    size = val.shape[0]
    c = (size - 1) / 2
    out = []
    for j in range(size):
        row = []
        for i in range(size):
            d = math.hypot(i - c, j - c)
            if d > rim_r + 0.5:
                row.append(".")
                continue
            if d > rim_r - 1.5:
                row.append("K")
                continue
            v = val[j, i]
            if np.isnan(v):
                row.append("K")
                continue
            t = BAYER[j % 4, i % 4] * 0.12 - 0.06                       # ordered dither, +-0.06
            v = v + t
            row.append("K" if v < 0.115 else "B" if v < 0.3 else "L" if v < 0.52 else "T" if v < 0.8 else "W")
        out.append("".join(row))
    return out


def bh_pair(size=96):
    c = (size - 1) / 2
    s36, s29 = 10.0, 10.0 * 29 / 36
    d, ang, tilt = 35.0, math.radians(-24), 0.62                        # separation, orbit angle, inclination squash
    r36, r29 = d * 29 / 65, d * 36 / 65                                # distances from the centre of mass
    p36 = (c + r36 * math.cos(ang), c + r36 * math.sin(ang) * tilt + 1)
    p29 = (c - r29 * math.cos(ang), c - r29 * math.sin(ang) * tilt + 1)
    val = lensed(size, [(p36[0], p36[1], s36, 2.0 * s36), (p29[0], p29[1], s29, 2.0 * s29)], seed=150914)
    return quantise(val, rim_r=c)


def bh_final(size=48):
    c = (size - 1) / 2
    s = 8.2 * 62 / 36 * 0.56
    val = lensed(size, [(c, c, s, 2.0 * s)], seed=62)
    return quantise(val, rim_r=c)


def main():
    pair, final = bh_pair(), bh_final()
    data = {
        "_meta": {"note": "LIGO Night Shift sprites: GW150914's black holes, lensed star field, shared ink palette. "
                          "Generated by make_sprites.py; illustration, not a GR simulation.",
                  "masses_msun": {"primary": 36, "secondary": 29, "final": 62},
                  "source": "Abbott et al., Phys. Rev. Lett. 116, 061102 (2016)"},
        "bh_pair": {"frames": [pair], "fps": 1},
        "bh_final": {"frames": [final], "fps": 1},
    }
    out = HERE / "web" / "sprites.json"
    out.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    for name in ("bh_pair", "bh_final"):
        print(name, len(data[name]["frames"][0][0]), "x", len(data[name]["frames"][0]))
    print(f"{out} written")


if __name__ == "__main__":
    main()
