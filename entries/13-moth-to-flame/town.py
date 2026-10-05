"""Street plans for the night town. CLASSICAL, seeded, deterministic.

A town is a rows x cols grid of squares (one labyrinth-v1 room = one qubit per square).
Streets join grid-adjacent squares; any adjacent pair without a street is a hedge.
The plan is a randomised depth-first spanning tree (so home is always reachable from the
start) plus a seeded fraction of extra streets that make loops, the places a moth can circle.

This file only designs the candidate streets. labyrinth-v1 turns every street into a ZZ
coupling between the two squares' qubits, prepares that state and samples it; the sampled
bits decide which lamps are lit (see run_levels.py and the README).
"""
from __future__ import annotations

import random


def adjacent_pairs(rows: int, cols: int):
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            if c + 1 < cols:
                yield (i, i + 1)
            if r + 1 < rows:
                yield (i, i + cols)


def street_plan(rows: int, cols: int, seed: int, extra: float = 0.3):
    """Return a sorted list of [a, b] streets (a < b), row-major room numbers."""
    rng = random.Random(seed)
    n = rows * cols
    seen = {0}
    stack = [0]
    tree = set()
    while stack:
        i = stack[-1]
        r, c = divmod(i, cols)
        nbrs = [(r + dr) * cols + (c + dc) for dr, dc in ((0, 1), (1, 0), (0, -1), (-1, 0))
                if 0 <= r + dr < rows and 0 <= c + dc < cols]
        nbrs = [j for j in nbrs if j not in seen]
        if not nbrs:
            stack.pop()
            continue
        j = rng.choice(nbrs)
        seen.add(j)
        tree.add((min(i, j), max(i, j)))
        stack.append(j)
    assert len(seen) == n
    rest = [p for p in adjacent_pairs(rows, cols) if p not in tree]
    loops = {p for p in rest if rng.random() < extra}
    return sorted([list(p) for p in tree | loops])


if __name__ == "__main__":
    for rows, cols, seed in ((4, 5, 13), (5, 4, 1313), (12, 13, 2024)):
        s = street_plan(rows, cols, seed)
        print(rows, cols, len(s), "streets of", len(list(adjacent_pairs(rows, cols))), "possible")
