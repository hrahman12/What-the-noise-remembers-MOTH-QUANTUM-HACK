"""Pick three 20-neuron circuits from the hemibrain v1.2 export and turn synapse counts into couplings.

CLASSICAL data preparation. For each brain region we grow a densely wired 20-neuron set greedily:
start from the region's strongest connected pair, then repeatedly add the neuron with the most
synapses onto/from the neurons already chosen (at most `per_type` neurons of any one cell type,
so a single type cannot fill the set).

Couplings. Synapses are directed and signless in this export, so every coupling is ferromagnetic
(J >= 0) and symmetric: w_ij = synapses(i->j) + synapses(j->i), and J_ij = w_ij / w_ref, where
w_ref is the median w over the circuit's modelled edges (so a typical modelled edge has J = 1).
The modelled graph is the maximum spanning tree (19 edges) plus the next-strongest pairs, 30 edges
in total, small enough for a hardware circuit. The full 20x20 synapse matrix is kept for exploring.

Writes data/circuits.json and data/hemibrain_subset.csv (every connection among the 60 neurons).
"""
import collections
import csv
import json
import math
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
RAW = HERE / "data" / "raw" / "exported-traced-adjacencies-v1.2"
N, N_EDGES = 20, 30

CIRCUITS = [
    {"id": "compass", "name": "Compass", "region": "Central complex, protocerebral bridge",
     "pattern": r"^(EPG|EPGt|PEN_a|PEN_b|PEG|Delta7)", "per_type": 6,
     "blurb": "Head-direction ring neurons: EPG, PEN, PEG and Delta7 cells that keep track of which way the fly faces."},
    {"id": "memory", "name": "Memory", "region": "Mushroom body output",
     "pattern": r"^(KC|MBON|APL|DPM|PAM|PPL)", "per_type": 4,
     "blurb": "The mushroom body's hubs: APL and DPM, output neurons (MBONs) and PPL1 dopamine neurons that tag memories."},
    {"id": "smell", "name": "Smell", "region": "Lateral horn",
     "pattern": r"(lPN|adPN|vPN)$|^LH", "per_type": 3,
     "blurb": "Olfactory projection neurons and the lateral-horn cells they feed: the fly's innate-smell pathway."},
]


def load():
    neurons = {int(r["bodyId"]): (r["type"], r["instance"])
               for r in csv.DictReader(open(RAW / "traced-neurons.csv", encoding="utf-8"))}
    conn = np.loadtxt(RAW / "traced-total-connections.csv", delimiter=",", skiprows=1, dtype=np.int64)
    return neurons, conn


def greedy(conn, neurons, cands, per_type):
    cands = np.array(sorted(cands))
    sub = conn[np.isin(conn[:, 0], cands) & np.isin(conn[:, 1], cands)]
    W = collections.defaultdict(lambda: collections.defaultdict(int))
    for p, q, w in sub:
        if p != q:
            W[p][q] += w
            W[q][p] += w
    a, b, _ = max(((p, q, w) for p in W for q, w in W[p].items()), key=lambda x: (x[2], -x[0], -x[1]))
    S = [a, b]
    tc = collections.Counter(neurons[x][0] for x in S)
    while len(S) < N:
        score = collections.defaultdict(int)
        for s in S:
            for q, w in W[s].items():
                if q not in S:
                    score[q] += w
        w, q = max((w, q) for q, w in score.items() if tc[neurons[q][0]] < per_type)
        S.append(q)
        tc[neurons[q][0]] += 1
    return S


def max_spanning_tree(n, wsym):
    """Prim's algorithm on the symmetric synapse matrix."""
    inside, edges = {0}, []
    while len(inside) < n:
        best = max(((wsym[i, j], i, j) for i in inside for j in range(n) if j not in inside and wsym[i, j] > 0))
        edges.append((best[1], best[2]))
        inside.add(best[2])
    return edges


def layout(n, J_full, seed=7):
    """Deterministic force-directed layout (Fruchterman-Reingold) weighted by coupling strength."""
    rng = np.random.default_rng(seed)
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False)
    pos = np.c_[np.cos(ang), np.sin(ang)] + rng.normal(0, 0.05, (n, 2))
    k = 1.0 / math.sqrt(n)
    t = 0.1
    for _ in range(600):
        d = pos[:, None, :] - pos[None, :, :]
        dist = np.linalg.norm(d, axis=-1) + 1e-9
        rep = (k * k / dist ** 2)[..., None] * d
        att = -(dist * J_full / k)[..., None] * d
        np.einsum("iij->ij", rep)[:] = 0
        disp = (rep + att).sum(1)
        ln = np.linalg.norm(disp, axis=1, keepdims=True) + 1e-9
        pos += disp / ln * np.minimum(ln, t)
        t *= 0.993
    pos -= pos.mean(0)
    pos /= np.abs(pos).max()
    return pos


def main():
    neurons, conn = load()
    out, rows = [], []
    for c in CIRCUITS:
        cands = {b for b, (t, _) in neurons.items() if re.search(c["pattern"], t or "")}
        S = greedy(conn, neurons, cands, c["per_type"])
        # stable display order: by cell type, then instance
        S = sorted(S, key=lambda b: (neurons[b][0], neurons[b][1], b))
        idx = {b: i for i, b in enumerate(S)}
        Wd = np.zeros((N, N), dtype=int)
        for p, q, w in conn[np.isin(conn[:, 0], S) & np.isin(conn[:, 1], S)]:
            if p != q:
                Wd[idx[p], idx[q]] += w
                rows.append((c["id"], p, q, w))
        wsym = Wd + Wd.T
        wmax = wsym.max()
        tree = max_spanning_tree(N, wsym)
        tset = {tuple(sorted(e)) for e in tree}
        rest = sorted(((wsym[i, j], i, j) for i in range(N) for j in range(i + 1, N)
                       if wsym[i, j] > 0 and (i, j) not in tset), reverse=True)
        edges = sorted(tset | {(i, j) for _, i, j in rest[:N_EDGES - len(tset)]},
                       key=lambda e: (-wsym[e], e))
        wref = float(np.median([wsym[e] for e in edges]))
        Jfull = wsym / wref
        pos = layout(N, np.log1p(wsym) / np.log1p(wmax))
        out.append({
            "id": c["id"], "name": c["name"], "region": c["region"], "blurb": c["blurb"],
            "selection": f"greedy dense set from types matching {c['pattern']}, at most {c['per_type']} per type",
            "neurons": [{"i": i, "bodyId": int(b), "type": neurons[b][0], "instance": neurons[b][1],
                         "x": round(float(pos[i, 0]), 4), "y": round(float(pos[i, 1]), 4)}
                        for i, b in enumerate(S)],
            "synapses": Wd.tolist(),               # directed: synapses[i][j] = i -> j
            "w_max": int(wmax),
            "w_ref": wref,
            "total_synapses": int(Wd.sum()),
            "n_pairs_connected": int(((wsym > 0).sum()) // 2),
            "edges": [{"i": int(i), "j": int(j), "w": int(wsym[i, j]), "J": round(float(Jfull[i, j]), 6),
                       "tree": (i, j) in tset} for i, j in edges],
        })
        print(f"{c['id']}: {Wd.sum()} synapses, {out[-1]['n_pairs_connected']} connected pairs, "
              f"modelled {len(edges)} edges, w {wsym[edges[-1]]}..{wmax}")
    (HERE / "data").mkdir(exist_ok=True)
    (HERE / "data" / "circuits.json").write_text(json.dumps(
        {"source": "Janelia FlyEM hemibrain v1.2 exported traced adjacencies (CC BY 4.0)",
         "source_url": "https://www.janelia.org/project-team/flyem/hemibrain",
         "download_url": "https://storage.googleapis.com/hemibrain/v1.2/exported-traced-adjacencies-v1.2.tar.gz",
         "coupling_rule": "J_ij = w_ij / w_ref, w_ij = synapses i->j + j->i, w_ref = median w over the 30 modelled edges; all J >= 0",
         "circuits": out}, indent=1), encoding="utf-8")
    with open(HERE / "data" / "hemibrain_subset.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["circuit", "bodyId_pre", "bodyId_post", "weight"])
        w.writerows(rows)
    print("data/circuits.json, data/hemibrain_subset.csv written")


if __name__ == "__main__":
    main()
