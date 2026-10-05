"""The chorus model, shared (line for line) with the page's inline script. CLASSICAL.

Each frog is a classical phase oscillator (Kuramoto model). Frog i calls whenever its phase passes a
whole cycle. On the hearing graph:

    d theta_i / dt = 2 pi f_i + K * sum_j A_ij * sin(theta_j - theta_i)      (occupied j only)

  f_i   natural call rate: f0 * (1 + spread * u_i), u_i = 2 * frac((i + 1) * 0.618034) - 1 (fixed, classical)
  A_ij  coupling weight of edge (i, j):
          "engine" source: the engine's realised lock L_ij = <XX> + <YY> (qdrive-api-v1, Aer simulator)
          "asked"  source: the lock we requested from the engine, 2 * (+/-0.7) = +/-1.4 on every edge
  K     coupling strength, set by the user (rad/s)
  theta_i(0) = the engine's Bloch azimuth of qubit i

A > 0 pulls a pair into step; A < 0 pushes it half a cycle apart, the alternation Japanese tree frogs
show (Aihara 2009; Aihara et al. 2011). Integration: midpoint (RK2) steps of DT seconds.
"""
from __future__ import annotations

import math

DT = 1 / 240
GOLD = 0.6180339887498949
PENTA = [0, 3, 5, 7, 10]  # minor pentatonic, semitones
BASE_HZ = 392.0


def rates(n, f0, spread):
    return [f0 * (1 + spread * (2 * ((i + 1) * GOLD % 1) - 1)) for i in range(n)]


def pitch(k):
    d = (k * 3) % 10
    return BASE_HZ * 2 ** ((PENTA[d % 5] + 12 * (d // 5)) / 12)


def couplings(ds, source):
    return [(e["i"], e["j"], e["L"] if source == "engine" else ds["lock_request"]) for e in ds["edges"]]


def deriv(theta, w, edges, occ, K):
    d = [w[i] for i in range(len(theta))]
    for i, j, A in edges:
        if occ[i] and occ[j]:
            s = math.sin(theta[j] - theta[i])
            d[i] += K * A * s
            d[j] -= K * A * s
    return d


def step(theta, w, edges, occ, K, dt=DT):
    """One RK2 step. Returns (new theta, list of frogs whose phase passed a whole cycle)."""
    k1 = deriv(theta, w, edges, occ, K)
    mid = [t + 0.5 * dt * a for t, a in zip(theta, k1)]
    k2 = deriv(mid, w, edges, occ, K)
    new = [t + dt * a for t, a in zip(theta, k2)]
    calls = [i for i in range(len(theta)) if occ[i] and math.floor(new[i] / (2 * math.pi)) > math.floor(theta[i] / (2 * math.pi))]
    return new, calls


def order(theta, occ, edges):
    """R: 1 = all in step. turns: mean over occupied edges of (1 - cos dtheta) / 2; 1 = every pair alternates."""
    idx = [i for i in range(len(theta)) if occ[i]]
    if not idx:
        return 0.0, 0.0
    c = sum(math.cos(theta[i]) for i in idx) / len(idx)
    s = sum(math.sin(theta[i]) for i in idx) / len(idx)
    pairs = [(i, j) for i, j, _ in edges if occ[i] and occ[j]]
    turns = sum((1 - math.cos(theta[i] - theta[j])) / 2 for i, j in pairs) / len(pairs) if pairs else 0.0
    return math.hypot(c, s), turns


def initial_phases(ds):
    return [math.radians(f["az"]) for f in ds["frogs"]]
