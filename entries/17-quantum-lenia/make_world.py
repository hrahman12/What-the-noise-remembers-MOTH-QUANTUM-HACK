"""Build the world-state snapshot that goes to blur-core-v1. CLASSICAL (classical Lenia, lenia.py).

A 528 x 528 torus (528 > 512 per side, so the engine pads each axis to 1024: 10 + 10 = 20 qubits) holding a
colony of 6 Orbium unicaudatus, run for 40 steps of classical Lenia. Quantised to integers 0..99 (smaller JSON)
and saved as out/world.npy.

Why the colony sits in the aligned top-left 128 x 128 corner: Atlas rejects request bodies over 1 MiB and
fails jobs whose result payload is too large (TMPRL1103). Attempt 1 (`--attempt1`: 22 Orbia spread over the
whole world, 240 steps) failed that way. At reach 0 the blur only spreads inside aligned Gray-code blocks;
keeping every creature inside one aligned 128-cell block bounds the output's non-zero region to 128 x 128
under every block rule our measurements allow. See README "Payload limits".
"""
from __future__ import annotations

import numpy as np

import lenia as L

W, CREATURES, STEPS, SEED = 528, 22, 240, 17          # attempt 1 (failed job, kept for the record)
COLONY, COLONY_STEPS, CORNER = 6, 40, 128


def build_colony():
    """6 Orbia on a jittered grid inside [0, 128)^2, in the 8 grid orientations, then 40 Lenia steps."""
    rng = np.random.default_rng(5)
    C = np.load("orbium.npy").astype(float)
    A = np.zeros((W, W))
    spots = [(16, 14), (16, 58), (16, 98), (60, 34), (60, 80), (96, 56)]
    for y, x in spots[:COLONY]:
        c = np.rot90(C, int(rng.integers(4)))
        if rng.random() < .5:
            c = c[:, ::-1]
        y, x = y + int(rng.integers(-3, 4)), x + int(rng.integers(-3, 4))
        A[y:y + c.shape[0], x:x + c.shape[1]] = np.maximum(A[y:y + c.shape[0], x:x + c.shape[1]], c)
    Kf = L.kernel_fft(L.kernel_world(W, "ring"))
    for _ in range(COLONY_STEPS):
        A = L.step(A, Kf)
    # The world is a torus, so rolling it is an exact symmetry: centre the colony's bounding box in the corner.
    shift = []
    for ax in (0, 1):
        occ = np.nonzero((A > 0).any(axis=1 - ax))[0]
        gaps = np.diff(np.r_[occ, occ[0] + W])          # circular gaps between occupied rows/cols
        start = occ[(np.argmax(gaps) + 1) % len(occ)]    # first occupied index after the largest gap
        span = (occ[np.argmax(gaps)] - start) % W + 1
        shift.append((CORNER - span) // 2 - start)
    return np.roll(A, shift, axis=(0, 1))


def build_attempt1():
    rng = np.random.default_rng(SEED)
    C = np.load("orbium.npy").astype(float)
    A = np.zeros((W, W))
    placed = []
    while len(placed) < CREATURES:
        y, x = rng.integers(0, W, 2)
        if any(min(abs(y - py), W - abs(y - py)) < 60 and min(abs(x - px), W - abs(x - px)) < 60 for py, px in placed):
            continue
        c = np.rot90(C, int(rng.integers(4)))
        if rng.random() < .5:
            c = c[:, ::-1]
        ys = (np.arange(c.shape[0]) + y) % W
        xs = (np.arange(c.shape[1]) + x) % W
        A[np.ix_(ys, xs)] = np.maximum(A[np.ix_(ys, xs)], c)
        placed.append((y, x))
    Kf = L.kernel_fft(L.kernel_world(W, "ring"))
    for _ in range(STEPS):
        A = L.step(A, Kf)
    return A


def blocks16(A):
    """Number of aligned 16 x 16 blocks holding any non-zero cell (support of a reach-0 blur)."""
    nz = A > 0
    h, w = (A.shape[0] + 15) // 16, (A.shape[1] + 15) // 16
    P = np.zeros((h * 16, w * 16), bool)
    P[:A.shape[0], :A.shape[1]] = nz
    return int(P.reshape(h, 16, w, 16).any(axis=(1, 3)).sum())


if __name__ == "__main__":
    import sys
    if "--attempt1" in sys.argv:
        Q = np.rint(build_attempt1() * 99).astype(np.int16)
        np.save("out/world_attempt1.npy", Q)
        print("attempt-1 world", Q.shape, "16x16 blocks", blocks16(Q))
        raise SystemExit
    A = build_colony()
    Q = np.rint(A * 99).astype(np.int16)
    ys, xs = np.nonzero(Q)
    assert ys.max() < CORNER and xs.max() < CORNER, (ys.max(), xs.max())
    np.save("out/world.npy", Q)
    print("world", Q.shape, "mass", round(A.sum(), 1), "nonzero cells", int((Q > 0).sum()), "16x16 blocks", blocks16(Q))
