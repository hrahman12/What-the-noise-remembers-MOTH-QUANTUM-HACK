"""Procedural moth-eye facet (classical geometry). Mirrors makeFacet() in web/src/core.js exactly.

One ommatidium facet: a regular hexagon (circumradius FACET_R) whose top is a spherical dome of sag
DOME_SAG, covered with a hexagonal array of paraboloid nanopillars (pitch 1, base radius PILLAR_R,
height PILLAR_H) standing along the local dome normal. Units are pillar pitches. Real moth-eye
nanopillars are ~200 nm apart on ~20 um facets; the facet here is shrunk to 24 pitches across so the
pillars stay visible.

Variants: "eye" (dome + pillars), "dome" (dome, no pillars), "slab" (flat hexagon, the control).
"""
from __future__ import annotations

import numpy as np

GEOM = {"facet_R": 12.0, "dome_sag": 6.0, "pillar_h": 1.0, "pillar_r": 0.5, "sub": 8}


def _nearest_pillar_dist(x, y):
    """Distance from (x, y) to the nearest point of the unit-pitch triangular lattice (pillar centres)."""
    # axial coords for a lattice with basis a1=(1,0), a2=(1/2, sqrt3/2)
    r = y / (np.sqrt(3) / 2)
    q = x - r / 2
    # cube rounding
    cx, cz = q, r
    cy = -cx - cz
    rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
    dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
    fix_x = (dx > dy) & (dx > dz)
    fix_y = ~fix_x & (dy > dz)
    rx = np.where(fix_x, -ry - rz, rx)
    ry = np.where(fix_y, -rx - rz, ry)
    rz = np.where(~fix_x & ~fix_y, -rx - ry, rz)
    px = rx + rz / 2
    py = rz * np.sqrt(3) / 2
    return np.hypot(x - px, y - py)


def pillar_height(x, y, g=GEOM):
    d = _nearest_pillar_dist(x, y)
    return np.where(d < g["pillar_r"], g["pillar_h"] * (1 - (d / g["pillar_r"]) ** 2), 0.0)


def facet(kind="eye", g=GEOM):
    """Return (vertices (N,3), triangles (M,3)) for the top surface; z is up, the facet faces +z."""
    n = int(round(g["facet_R"] * g["sub"]))
    d = 1.0 / g["sub"]
    qs, rs = [], []
    for q in range(-n, n + 1):
        for r in range(max(-n, -q - n), min(n, -q + n) + 1):
            qs.append(q)
            rs.append(r)
    q = np.array(qs, float)
    r = np.array(rs, float)
    # pointy-side hexagon in the plane: x along a1, rows along a2
    x = d * (q + r / 2)
    y = d * (r * np.sqrt(3) / 2)
    index = {(a, b): i for i, (a, b) in enumerate(zip(qs, rs))}
    tris = []
    for (a, b), i in index.items():
        j, k = index.get((a + 1, b)), index.get((a, b + 1))
        if j is not None and k is not None:
            tris.append((i, j, k))
        j2, k2 = index.get((a + 1, b - 1)), index.get((a + 1, b))
        if j2 is not None and k2 is not None:
            tris.append((i, j2, k2))
    tris = np.array(tris, int)
    if kind == "slab":
        return np.stack([x, y, np.zeros_like(x)], 1), tris
    A, H = g["facet_R"], g["dome_sag"]
    Rc = (A * A + H * H) / (2 * H)
    zc = np.sqrt(np.maximum(Rc * Rc - x * x - y * y, 0)) - (Rc - H)
    nrm = np.stack([x, y, zc + Rc - H], 1) / Rc
    p = np.stack([x, y, zc], 1)
    if kind == "eye":
        p = p + nrm * pillar_height(x, y, g)[:, None]
    return p, tris


def face_normals(v, t):
    a, b, c = v[t[:, 0]], v[t[:, 1]], v[t[:, 2]]
    cr = np.cross(b - a, c - a)
    area2 = np.linalg.norm(cr, axis=1)
    return cr / np.maximum(area2, 1e-12)[:, None], area2 / 2


if __name__ == "__main__":
    for k in ("eye", "dome", "slab"):
        v, t = facet(k)
        n, a = face_normals(v, t)
        print(k, v.shape, t.shape, "area", round(a.sum(), 2), "mean n_z", round(float((n[:, 2] * a).sum() / a.sum()), 3))
