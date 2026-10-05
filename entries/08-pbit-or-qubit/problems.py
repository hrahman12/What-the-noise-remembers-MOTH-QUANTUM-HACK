"""The three 20-node Ising problems, their exact Boltzmann statistics, and the graph-v1 recipe. CLASSICAL.

Energy (zero field):  E(s) = -sum_{(i,j) in edges} J_ij s_i s_j,  s_i in {-1,+1},  p(s) ~ exp(-E(s)).

- ring:   20-cycle, every J_ij = +J (ferromagnet)
- ladder: 2 x 10 ladder (rails 0-9 and 10-19, ten rungs), every J_ij = +J
- random: a fixed random 3-regular graph (30 edges) with fixed random signs, J_ij = +-J (spin glass)

The exact statistics come from enumerating all 2^20 = 1,048,576 states.
The graph-v1 recipe: put every qubit in |+> (a 'bloch' target X = 1, i.e. no field), then for each edge
ask for a 'relationship' target ZZ = <s_i s_j>_Boltzmann with rotation fraction (2/pi) asin|<s_i s_j>|.
On a single isolated edge, QuantumGraph's partial rotation from |++> gives ZZ = sin(pi f / 2), so this
fraction lands exactly on the target for an isolated edge (checked with qg_replica.py). On graphs with
loops the engine builds the edges one after another, and the result is whatever the engine reports.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
N = 20
JS = [0.4, 1.0]

# Fixed random 3-regular graph (networkx random_regular_graph(3, 20, seed=7) at nx 2.8.5, frozen here
# so the problem does not depend on the networkx version) and fixed random signs (numpy seed 8).
RANDOM_EDGES = None  # filled from problems.json on first build


def ring_edges():
    return [(i, (i + 1) % N) for i in range(N)]


def ladder_edges():
    rails = [(i, i + 1) for i in range(9)] + [(i, i + 1) for i in range(10, 19)]
    rungs = [(i, i + 10) for i in range(10)]
    return rails + rungs


def random_graph():
    import networkx as nx
    G = nx.random_regular_graph(3, N, seed=7)
    edges = sorted((min(a, b), max(a, b)) for a, b in G.edges())
    rng = np.random.default_rng(8)
    signs = [int(s) for s in rng.choice([-1, 1], size=len(edges))]
    return edges, signs


def build_order(edges):
    """Order edges as the graph 'grows' by breadth-first search from node 0: each new node is attached,
    then any edge back to nodes already present (these close loops). Deterministic."""
    adj = {i: [] for i in range(N)}
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    order, seen, q = [], {0}, [0]
    while q:
        u = q.pop(0)
        order.append(u)
        for v in sorted(adj[u]):
            if v not in seen:
                seen.add(v)
                q.append(v)
    idx = {u: k for k, u in enumerate(order)}
    return sorted(((min(a, b), max(a, b)) for a, b in edges), key=lambda e: (max(idx[e[0]], idx[e[1]]), min(idx[e[0]], idx[e[1]])))


def graph_defs():
    p = HERE / "problems.json"
    if p.exists():
        d = json.loads(p.read_text(encoding="utf-8"))
        return {k: {"edges": [tuple(e) for e in v["edges"]], "signs": v["signs"]} for k, v in d.items()}
    redges, rsigns = random_graph()
    d = {"ring": {"edges": [tuple(sorted(e)) for e in ring_edges()], "signs": [1] * N},
         "ladder": {"edges": ladder_edges(), "signs": [1] * 28},
         "random": {"edges": redges, "signs": rsigns}}
    for k, v in d.items():  # store edges in build order, signs permuted with them
        sign_of = {tuple(e): s for e, s in zip(v["edges"], v["signs"])}
        order = build_order(v["edges"])
        v["edges"] = order
        v["signs"] = [sign_of[e] for e in order]
    p.write_text(json.dumps({k: {"edges": [list(e) for e in v["edges"]], "signs": v["signs"]} for k, v in d.items()}, indent=1), encoding="utf-8")
    return d


_S = None


def all_states():
    """(2^20, 20) int8 spins; row index read as a bitstring with qubit 0 LEFTMOST (graph-v1 convention),
    bit 0 -> s = +1, bit 1 -> s = -1 (Z eigenvalue)."""
    global _S
    if _S is None:
        idx = np.arange(2 ** N, dtype=np.int64)
        bits = ((idx[:, None] >> np.arange(N - 1, -1, -1)) & 1).astype(np.int8)
        _S = (1 - 2 * bits).astype(np.int8)
    return _S


def h2(p):
    p = np.clip(p, 1e-15, 1 - 1e-15)
    return -(p * np.log2(p) + (1 - p) * np.log2(1 - p))


def exact_stats(edges, J):
    """Exact Boltzmann statistics by enumeration. J: list of couplings parallel to edges."""
    S = all_states()
    E = np.zeros(S.shape[0])
    for (a, b), j in zip(edges, J):
        E -= j * (S[:, a].astype(np.int32) * S[:, b])
    w = np.exp(-(E - E.min()))
    p = w / w.sum()
    Sf = S.astype(np.float64)
    C = Sf.T @ (Sf * p[:, None])  # <s_i s_j>
    mag = S.sum(1).astype(np.int32)
    hist = np.bincount((mag + N) // 2, weights=p, minlength=N + 1)
    MI = 1 - h2((1 + C) / 2)  # zero field: marginals are exactly 1/2
    np.fill_diagonal(MI, 0)
    return {"edge_zz": [float(C[a, b]) for a, b in edges], "C": C, "mag_hist": hist, "MI": MI,
            "mean_s": (Sf * p[:, None]).sum(0)}


def couplings(name, J, defs=None):
    d = (defs or graph_defs())[name]
    return [s * J for s in d["signs"]]


def graph_params(name, J, mode="emu", shots=20, defs=None, stats=None):
    """The graph-v1 request for one problem. `stats` = exact_stats(...) (computed if omitted)."""
    d = (defs or graph_defs())[name]
    edges = d["edges"]
    st = stats or exact_stats(edges, couplings(name, J, defs))
    ops = [{"type": "bloch", "qubit": q, "paulis": {"X": 1.0}} for q in range(N)]
    for (a, b), t in zip(edges, st["edge_zz"]):
        t = round(float(t), 4)
        f = round(2 / math.pi * math.asin(min(abs(t), 1.0)), 4)
        ops.append({"type": "relationship", "qubits": [a, b], "paulis": {"ZZ": t}, "fraction": f})
    p = {"num_qubits": N, "coupling_map": [list(e) for e in edges], "operations": ops, "shots": shots, "mode": mode}
    if mode == "qpu":
        p["backend_name"] = "ibm_fez"
    return p


if __name__ == "__main__":
    defs = graph_defs()
    for name, d in defs.items():
        neg = sum(s < 0 for s in d["signs"])
        print(name, len(d["edges"]), "edges,", neg, "negative")
        for J in JS:
            st = exact_stats(d["edges"], couplings(name, J, defs))
            zz = np.array(st["edge_zz"])
            print(f"  J={J}: edge <ss> min {zz.min():.3f} max {zz.max():.3f} mean|.| {np.abs(zz).mean():.3f}")
