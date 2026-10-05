"""Tokenise sperm-whale codas into rhythm tokens. CLASSICAL (numpy only).

Input : data/sperm-whale-dialogues.csv (Sharma et al. 2024, Zenodo 10.5281/zenodo.10817697, CC BY 4.0).
        Columns REC, nClicks, Duration, ICI1..ICI28, Whale, TsTo. Only the first nClicks-1 ICIs are used.
Output: out/tokens.json

A token is   <nClicks><rhythm letter>   e.g. "5A", "5B", "4A", "17".
  - nClicks is read straight from the data.
  - The rhythm letter is our own k-means cluster of the duration-normalised ICI vector
    (ICIs / sum of ICIs), fitted separately for each click count. Letters are ordered by cluster
    size (A = most common). Click counts with fewer than MIN_FOR_CLUSTERING codas, or where no
    k >= 2 separates cleanly (silhouette < SIL_MIN or a cluster smaller than MIN_CLUSTER), keep a
    single token with no letter.
These are NOT the rhythm types published by Sharma et al.; they are a simple, reproducible stand-in.
No meaning is claimed; codas are treated as rhythm tokens.
"""
from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CSV = HERE / "data" / "sperm-whale-dialogues.csv"
OUT = HERE / "out"

MIN_FOR_CLUSTERING = 60
MIN_CLUSTER = 8
SIL_MIN = 0.45
SEED = 3617  # article number of Sharma et al., Nat. Commun. 15:3617


def load():
    rows = []
    for i, r in enumerate(csv.DictReader(open(CSV, encoding="utf-8"))):
        n = int(r["nClicks"])
        icis = [float(r[f"ICI{k}"]) for k in range(1, 29)][: max(n - 1, 0)]
        rows.append({"i": i, "rec": r["REC"], "n": n, "dur": float(r["Duration"]), "icis": icis,
                     "whale": r["Whale"], "t": float(r["TsTo"])})
    return rows


def kmeans(X, k, rng, restarts=20, iters=100):
    best = None
    for _ in range(restarts):
        # k-means++ init
        c = [X[rng.integers(len(X))]]
        for _ in range(1, k):
            d2 = np.min(((X[:, None, :] - np.array(c)[None]) ** 2).sum(-1), axis=1)
            c.append(X[rng.choice(len(X), p=d2 / d2.sum())] if d2.sum() > 0 else X[rng.integers(len(X))])
        C = np.array(c)
        for _ in range(iters):
            lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
            newC = np.array([X[lab == j].mean(0) if np.any(lab == j) else C[j] for j in range(k)])
            if np.allclose(newC, C):
                break
            C = newC
        inertia = ((X - C[lab]) ** 2).sum()
        if best is None or inertia < best[0]:
            best = (inertia, lab, C)
    return best[1], best[2]


def silhouette(X, lab):
    D = np.sqrt(((X[:, None, :] - X[None]) ** 2).sum(-1))
    ks = np.unique(lab)
    s = np.zeros(len(X))
    for i in range(len(X)):
        own = lab == lab[i]
        a = D[i, own].sum() / max(own.sum() - 1, 1)
        b = min(D[i, lab == j].mean() for j in ks if j != lab[i])
        s[i] = 0 if own.sum() == 1 else (b - a) / max(a, b)
    return float(s.mean())


def main():
    OUT.mkdir(exist_ok=True)
    rows = load()
    rng = np.random.default_rng(SEED)
    by_n = defaultdict(list)
    for r in rows:
        by_n[r["n"]].append(r)

    vocab = []          # list of token dicts
    choice_log = {}
    for n in sorted(by_n):
        grp = by_n[n]
        if n < 3 or len(grp) < MIN_FOR_CLUSTERING:
            labels, k = np.zeros(len(grp), int), 1
            choice_log[n] = {"count": len(grp), "k": 1, "reason": "too few codas or < 3 clicks"}
        else:
            X = np.array([np.array(r["icis"]) / sum(r["icis"]) for r in grp])
            kmax = 5 if len(grp) >= 500 else 3
            best = (None, -1, None)
            tried = {}
            for k in range(2, kmax + 1):
                lab, _ = kmeans(X, k, rng)
                sizes = np.bincount(lab, minlength=k)
                sil = silhouette(X, lab)
                tried[k] = {"silhouette": round(sil, 3), "sizes": sizes.tolist()}
                if sizes.min() >= MIN_CLUSTER and sil > best[1]:
                    best = (k, sil, lab)
            if best[0] is not None and best[1] >= SIL_MIN:
                k, labels = best[0], best[2]
            else:
                k, labels = 1, np.zeros(len(grp), int)
            choice_log[n] = {"count": len(grp), "k": k, "tried": tried}
        # order clusters by size so A is the most common
        order = [j for j, _ in Counter(labels.tolist()).most_common()]
        for rank, j in enumerate(order):
            members = [r for r, l in zip(grp, labels) if l == j]
            name = f"{n}{chr(65 + rank)}" if k > 1 else f"{n}"
            if n >= 2:
                R = np.array([np.array(m["icis"]) / sum(m["icis"]) for m in members])
                proto = R.mean(0)
                proto = (proto / proto.sum()).round(5).tolist()
            else:
                proto = []
            durs = np.array([m["dur"] for m in members])
            vocab.append({"token": name, "n": n, "count": len(members), "rhythm": proto,
                          "dur_median": round(float(np.median(durs)), 4),
                          "dur_iqr": [round(float(np.percentile(durs, 25)), 4), round(float(np.percentile(durs, 75)), 4)]})
            for m in members:
                m["token"] = name

    tokens = [r["token"] for r in rows]
    counts = Counter(tokens)
    data = {
        "source": "Sharma et al. 2024, Nat. Commun. 15:3617; Zenodo 10.5281/zenodo.10817697 (CC BY 4.0)",
        "method": {"min_for_clustering": MIN_FOR_CLUSTERING, "min_cluster": MIN_CLUSTER, "sil_min": SIL_MIN,
                   "seed": SEED, "per_click_count": {str(k): v for k, v in choice_log.items()}},
        "vocab": vocab,
        "codas": [{"rec": r["rec"], "n": r["n"], "dur": round(r["dur"], 5), "icis": [round(x, 5) for x in r["icis"]],
                   "whale": r["whale"], "t": r["t"], "token": r["token"]} for r in rows],
    }
    (OUT / "tokens.json").write_text(json.dumps(data), encoding="utf-8")
    print(f"{len(rows)} codas -> {len(vocab)} tokens")
    for v in vocab:
        print(f"  {v['token']:>4}  n={v['count']:5d}  dur~{v['dur_median']:.3f}s  rhythm={v['rhythm'][:6]}")
    for n, c in choice_log.items():
        if "tried" in c:
            print(f"  n={n}: chose k={c['k']}  tried={c['tried']}")


if __name__ == "__main__":
    main()
