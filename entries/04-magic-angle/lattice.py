"""Honeycomb (graphene-like) lattice images for the twist sweep. CLASSICAL.

Each layer is a sum of Gaussian "atoms" on a honeycomb lattice, written as a Fourier series over
the reciprocal lattice and truncated below the pixel Nyquist frequency. The image is therefore
exactly band-limited: the pixel grid cannot alias with the lattice and invent a moire of its own.

Geometry (all lengths in pixels):
  lattice constant  a      = 8 px      (graphene: a = 0.246 nm, so 1 px = 0.0308 nm)
  atom width        sigma  = 1.1 px   (Gaussian)
  layer A rotated by THETA0 - theta/2 and layer B by THETA0 + theta/2 about the image centre, which
  is a hexagon centre in both layers (AA stacking at the centre, as in the usual twisted-bilayer
  construction). THETA0 = 15 deg is a global offset, half-way between the honeycomb's mirror lines.
  Why: telablur's Gray-coded register mirrors pixel blocks (x -> -x about block centres). Without the
  offset, layer B (+theta/2) is exactly the mirror image of layer A (-theta/2), so mirror copies of A
  would be indistinguishable from B. With it, mirror copies land at -THETA0 (30 deg away in Fourier
  space) and any Bragg peak at THETA0 + theta/2 can only come from image2. The probes (run_probe.py)
  used THETA0 = 0.

Predicted moire lattice constant: L(theta) = a / (2 sin(theta/2)).

Usage:  python lattice.py            # writes frames/inputs for every angle in angles.json
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
N = 1024
A = 8.0            # lattice constant, px
SIGMA = 1.1        # Gaussian atom radius, px
F_CUT = 0.5        # keep reciprocal vectors strictly below Nyquist (cycles/px)
THETA0 = 15.0      # global orientation of the bilayer, deg (see docstring)

A1 = np.array([1.0, 0.0]) * A
A2 = np.array([0.5, math.sqrt(3) / 2]) * A
TAU = [(A1 + A2) / 3, 2 * (A1 + A2) / 3]      # two sublattices; the origin is a hexagon centre


def _reciprocal():
    m = np.array([A1, A2])                      # rows a1, a2
    b = 2 * math.pi * np.linalg.inv(m).T        # rows b1, b2 with a_i . b_j = 2 pi delta_ij
    terms = []
    for i in range(-6, 7):
        for j in range(-6, 7):
            g = i * b[0] + j * b[1]
            f = np.hypot(*g) / (2 * math.pi)
            if f >= F_CUT:
                continue
            s = sum(np.exp(-1j * g @ t) for t in TAU)           # honeycomb structure factor
            amp = s * math.exp(-SIGMA ** 2 * (g @ g) / 2)       # Gaussian atom form factor
            if abs(amp) > 1e-9:
                terms.append((g, amp))
    return terms


TERMS = _reciprocal()


def layer(angle_deg: float, n: int = N) -> np.ndarray:
    """Float image in [0, 1] of one honeycomb layer rotated by angle_deg about the centre."""
    c = (n - 1) / 2
    y, x = np.mgrid[0:n, 0:n].astype(np.float64)
    x -= c
    y -= c
    ph = math.radians(angle_deg)
    # evaluate the unrotated lattice at R(-phi) r  ==  lattice rotated by +phi
    xr = math.cos(ph) * x + math.sin(ph) * y
    yr = -math.sin(ph) * x + math.cos(ph) * y
    rho = np.zeros((n, n))
    for g, amp in TERMS:
        rho += (amp * np.exp(1j * (g[0] * xr + g[1] * yr))).real
    return rho


def _norm():
    """Global scale: the peak of an unrotated layer maps to 1.0 (same for every angle)."""
    r = layer(0.0, 64)
    return float(r.max()), float(r.min())


RHO_MAX, RHO_MIN = _norm()


def to_u8(rho: np.ndarray) -> np.ndarray:
    v = np.clip(rho / RHO_MAX, 0, 1)
    return np.round(v * 255).astype(np.uint8)


def save_rgb(u8: np.ndarray, path: Path):
    Image.fromarray(np.stack([u8] * 3, -1), "RGB").save(path, optimize=True)


def predicted_period(theta_deg: float) -> float:
    return math.inf if theta_deg == 0 else A / (2 * math.sin(math.radians(theta_deg) / 2))


def make_pair(theta: float, out: Path, theta0: float = THETA0):
    """image1 = layer A at theta0 - theta/2, image2 = layer B at theta0 + theta/2."""
    out.mkdir(parents=True, exist_ok=True)
    tag = f"r{theta0:g}_{theta:.2f}"
    pa, pb = out / f"A_{tag}.png", out / f"B_{tag}.png"
    if not pa.exists():
        save_rgb(to_u8(layer(theta0 - theta / 2)), pa)
    if not pb.exists():
        save_rgb(to_u8(layer(theta0 + theta / 2)), pb)
    return pa, pb


if __name__ == "__main__":
    angles = json.loads((HERE / "angles.json").read_text())
    for th in angles:
        make_pair(th, HERE / "inputs")
        print(f"theta {th:.2f}  L_pred = {predicted_period(th):.1f} px")
    print(f"{len(TERMS)} Fourier terms, max freq "
          f"{max(np.hypot(*g) for g, _ in TERMS) / (2 * math.pi):.3f} cyc/px, rho range {RHO_MIN:.3f}..{RHO_MAX:.3f}")
