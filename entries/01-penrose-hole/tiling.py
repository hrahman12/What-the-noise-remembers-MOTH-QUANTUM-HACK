"""Penrose P3 (rhombus) tiling by Robinson-triangle deflation. CLASSICAL.

Start from a wheel of 10 half-rhomb triangles, deflate N times, render the
triangles' legs (not their bases) so each pair reads as one thick or thin rhomb.

Writes intact.png (1024x1024) and tiles.json. Deterministic: same N, same picture.
"""
from __future__ import annotations

import cmath
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PHI = (1 + 5 ** 0.5) / 2
W = H = 1024
SS = 4                      # supersampling for anti-aliased edges
ITERATIONS = 7              # 7 -> ~27 px edges on a 1024 canvas
RADIUS = 1.08 * math.hypot(W, H) / 2

THICK = (233, 196, 106)     # warm moth-wing ochre
THIN = (58, 74, 92)         # slate
EDGE = (24, 22, 20)


def wheel():
    tris = []
    for i in range(10):
        b = cmath.rect(RADIUS, (2 * i - 1) * math.pi / 10)
        c = cmath.rect(RADIUS, (2 * i + 1) * math.pi / 10)
        if i % 2 == 0:
            b, c = c, b                         # mirror every other triangle
        tris.append((0, 0j, b, c))              # type 0 = half of a thick rhomb
    return tris


def deflate(tris):
    out = []
    for kind, a, b, c in tris:
        if kind == 0:
            p = a + (b - a) / PHI
            out += [(0, c, p, b), (1, p, c, a)]
        else:
            q = b + (a - b) / PHI
            r = b + (c - b) / PHI
            out += [(1, r, c, a), (1, q, r, b), (0, r, q, a)]
    return out


def generate(iterations=ITERATIONS):
    tris = wheel()
    for _ in range(iterations):
        tris = deflate(tris)
    cx, cy = W / 2, H / 2
    # keep triangles that touch the canvas
    keep = []
    for kind, a, b, c in tris:
        xs = [z.real + cx for z in (a, b, c)]
        ys = [z.imag + cy for z in (a, b, c)]
        if max(xs) < 0 or min(xs) > W or max(ys) < 0 or min(ys) > H:
            continue
        keep.append((kind, [(z.real + cx, z.imag + cy) for z in (a, b, c)]))
    return keep


def render(tris, only=None):
    """Render triangles; `only` = optional set of indices to draw (others left transparent)."""
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = max(1, int(1.2 * SS))
    for i, (kind, pts) in enumerate(tris):
        if only is not None and i not in only:
            continue
        P = [(x * SS, y * SS) for x, y in pts]
        d.polygon(P, fill=THICK if kind == 0 else THIN)
    for i, (kind, pts) in enumerate(tris):
        if only is not None and i not in only:
            continue
        a, b, c = [(x * SS, y * SS) for x, y in pts]
        d.line([b, a, c], fill=EDGE, width=lw)  # legs only -> rhombs, not triangles
    return img.resize((W, H), Image.LANCZOS)


def main():
    tris = generate()
    bg = Image.new("RGB", (W, H), EDGE)
    bg.paste(render(tris), mask=render(tris).split()[3])
    bg.save(HERE / "intact.png")
    (HERE / "tiles.json").write_text(json.dumps(
        {"iterations": ITERATIONS, "radius": RADIUS, "canvas": [W, H],
         "tiles": [{"type": "thick" if k == 0 else "thin", "half_rhomb": [list(map(lambda v: round(v, 3), p)) for p in pts]}
                   for k, pts in tris]}), encoding="utf-8")
    print(f"intact.png: {len(tris)} half-rhomb triangles, {ITERATIONS} deflations")


if __name__ == "__main__":
    main()
