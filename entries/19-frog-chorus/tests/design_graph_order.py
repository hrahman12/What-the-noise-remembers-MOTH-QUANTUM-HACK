"""Design aid for run_graph_fez.py: which edge order and rotation strength keep "take turns" alive? CLASSICAL.

Uses entries/08-pbit-or-qubit/qg_replica.py (another piece in this set, imported read-only): a small numpy
re-implementation of QuantumGraph's set_bloch / set_relationship acting on an exact 20-qubit statevector. For each
recipe it prints the expected number of the pond's 27 hearing pairs taking turns (one frog calling, one silent) in a
Z-basis shot, against coin flips (13.5) and the best any night can do (22, brute-force maximum cut).

Its numbers chose the recipe (breadth-first order, ZZ = -0.7 at fraction (2/pi) asin 0.7). They are never shown as
engine output: the page uses only graph-v1's own shots. Takes about a minute.

    python tests/design_graph_order.py
"""
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent.parent / "08-pbit-or-qubit"))
from qg_replica import Replica  # noqa: E402

import pond  # noqa: E402
from run_graph_fez import bfs_order  # noqa: E402

N = 20
es = pond.edges(N)
orders = {"layers (qdrive build order)": [e for lay in pond.layers(es) for e in lay], "breadth-first": bfs_order(es, N)}
idx = np.arange(2 ** N, dtype=np.int64)
bits = ((idx[:, None] >> np.arange(N)) & 1).astype(np.int8)          # bits[s, k] = bit of qubit k in state s
cut = sum((bits[:, i] != bits[:, j]).astype(np.int16) for i, j in es)  # pairs taking turns in each state
rev = np.zeros(2 ** N, dtype=np.int64)                                # replica index (qubit 0 most significant) -> ours
for k in range(N):
    rev |= ((idx >> (N - 1 - k)) & 1) << k
print(f"{len(es)} hearing edges; best any night can do: {cut.max()}; coin flips: {len(es) / 2}")


def expected_turns(order, c, frac):
    R = Replica(N, seed=0)
    for k in range(N):
        R.set_bloch({"X": 1.0}, k)
    for i, j in orders[order]:
        R.set_relationship({"ZZ": -c}, i, j, frac)
    p = np.zeros(2 ** N)
    p[rev] = R.probs()
    return float((cut * p).sum())


for order in orders:
    for c in (0.7, 1.0):
        f = 2 / math.pi * math.asin(c)
        print(f"{order:28s} ZZ = -{c:.1f}, fraction {f:.4f}: {expected_turns(order, c, f):5.2f} of {len(es)} pairs taking turns")
