"""Neutrino flavour curves vs L/E. CLASSICAL: closed-form vacuum oscillation formulas, numpy only.

Parameters: NuFIT 6.0 global fit (Esteban, Gonzalez-Garcia, Maltoni, Martinez-Soler, Pinheiro,
Schwetz, JHEP 12 (2024) 216, arXiv:2410.05380), Table 1, normal ordering, "IC19 without SK
atmospheric data" best fit. Values checked against the arXiv PDF on 2026-10-04.

Four curves on a log-spaced L/E grid (km/GeV):
  0  P2(mu->e)   two-flavour approximation: sin^2(2 theta_eff) sin^2(1.267 dm31^2 L/E),
                 sin^2(2 theta_eff) = 4 s13^2 c13^2 s23^2 (leading-order atmospheric term)
  1  P3(mu->e)   full three-flavour vacuum probability with the PMNS matrix
  2  P3(mu->mu)
  3  P3(mu->tau)
Every interference term is averaged over a Gaussian spread of L/E (relative width SIGMA), the way
a detector's finite energy resolution washes out fast wiggles. Matter effects (MSW) are ignored.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

NUFIT = {  # NuFIT 6.0, Table 1, NO, IC19 without SK-atm, best fit
    "s12sq": 0.307, "s23sq": 0.561, "s13sq": 0.02195, "delta_deg": 177.0,
    "dm21": 7.49e-5, "dm31": 2.534e-3,   # eV^2 ; dm3l = dm31 > 0 for normal ordering
}
SOURCE = ("NuFIT 6.0 (Esteban et al., JHEP 12 (2024) 216, arXiv:2410.05380), Table 1, "
          "normal ordering, IC19 without SK atmospheric data, best fit")
LE_MIN, LE_MAX = 20.0, 50000.0   # km/GeV
SIGMA = 0.05                     # relative Gaussian spread of L/E
CURVES = ["P2(mu->e)", "P3(mu->e)", "P3(mu->mu)", "P3(mu->tau)"]
K = 1.26693                      # 1.267: dm^2[eV^2] L[km] / (4 E[GeV]) in natural units


def pmns(p=NUFIT):
    s12, s23, s13 = (math.sqrt(p[k]) for k in ("s12sq", "s23sq", "s13sq"))
    c12, c23, c13 = (math.sqrt(1 - s * s) for s in (s12, s23, s13))
    d = math.radians(p["delta_deg"])
    e = complex(math.cos(d), -math.sin(d))   # e^{-i delta}
    ep = complex(math.cos(d), math.sin(d))   # e^{+i delta}
    return np.array([
        [c12 * c13, s12 * c13, s13 * e],
        [-s12 * c23 - c12 * s23 * s13 * ep, c12 * c23 - s12 * s23 * s13 * ep, s23 * c13],
        [s12 * s23 - c12 * c23 * s13 * ep, -c12 * s23 - s12 * c23 * s13 * ep, c23 * c13],
    ])


def le_grid(n):
    return np.geomspace(LE_MIN, LE_MAX, n)


def prob3(alpha, beta, le, p=NUFIT, sigma=SIGMA):
    """P(nu_alpha -> nu_beta) in vacuum, averaged over a Gaussian L/E spread. alpha, beta in 0..2 (e, mu, tau)."""
    U = pmns(p)
    m2 = np.array([0.0, p["dm21"], p["dm31"]])
    P = np.zeros_like(le, dtype=float)
    for i in range(3):
        for j in range(3):
            w = np.conj(U[alpha, i]) * U[beta, i] * U[alpha, j] * np.conj(U[beta, j])
            phi = 2 * K * (m2[i] - m2[j]) * le          # (m_i^2 - m_j^2) L / 2E
            damp = np.exp(-0.5 * (phi * sigma) ** 2)
            P += np.real(w * np.exp(-1j * phi) * damp)
    return P


def prob2_mue(le, p=NUFIT, sigma=SIGMA):
    s2t = 4 * p["s13sq"] * (1 - p["s13sq"]) * p["s23sq"]
    phi = 2 * K * p["dm31"] * le                        # 2 x (1.267 dm^2 L/E)
    return s2t * 0.5 * (1 - np.cos(phi) * np.exp(-0.5 * (phi * sigma) ** 2))


def curves(n):
    le = le_grid(n)
    c = np.stack([prob2_mue(le), prob3(1, 0, le), prob3(1, 1, le), prob3(1, 2, le)])
    return le, c


def check():
    U = pmns()
    assert np.allclose(U @ U.conj().T, np.eye(3), atol=1e-12), "PMNS not unitary"
    le, c = curves(1024)
    tot = c[1] + c[2] + c[3]
    assert np.allclose(tot, 1, atol=1e-9), f"probabilities do not sum to 1: {abs(tot - 1).max()}"
    assert c.min() > -1e-9 and c.max() < 1 + 1e-9
    # no smearing: two-flavour formula is exactly sin^2 2theta sin^2(1.267 dm^2 L/E)
    s2t = 4 * NUFIT["s13sq"] * (1 - NUFIT["s13sq"]) * NUFIT["s23sq"]
    assert np.allclose(prob2_mue(le, sigma=0), s2t * np.sin(K * NUFIT["dm31"] * le) ** 2)
    return le, c


if __name__ == "__main__":
    le, c = check()
    print("unitarity and two-flavour checks passed")
    for name, y in zip(CURVES, c):
        k = int(np.argmax(y))
        print(f"  {name:12s} min {y.min():.4f} max {y.max():.4f} (max at L/E = {le[k]:.0f} km/GeV)")
    out = Path(__file__).resolve().parent / "out" / "curves_exact_1024.json"
    out.write_text(json.dumps({"source": SOURCE, "params": NUFIT, "sigma": SIGMA, "le": le.round(4).tolist(),
                               "curves": CURVES, "P": c.round(6).tolist()}), encoding="utf-8")
    print("wrote", out.name)
