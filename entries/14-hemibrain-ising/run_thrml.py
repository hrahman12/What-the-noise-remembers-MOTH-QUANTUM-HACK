"""CLASSICAL baseline: block Gibbs sampling with THRML on the same couplings, checked by exact enumeration.

For each circuit and each inverse temperature beta, THRML samples the Ising model
    p(s) ~ exp(beta * sum_{(i,j) in modelled edges} J_ij s_i s_j),   s_i in {-1,+1}, no fields,
with one Block per colour of a greedy graph colouring (no two neighbours update together).
20 spins is small enough to enumerate all 2^20 states exactly, so every THRML estimate is compared
with the exact answer (the error is reported in out/thrml.json and on the page).

Bit convention matches graph-v1: spin +1 <-> qubit |0> <-> '0', spin -1 <-> '1', qubit 0 leftmost.
Writes out/thrml.json.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import jax
import jax.numpy as jnp
import numpy as np
from thrml import Block, SamplingSchedule, SpinNode, sample_states
from thrml.models import IsingEBM, IsingSamplingProgram, hinton_init

HERE = Path(__file__).resolve().parent
N = 20
BETAS = [round(0.1 * k, 1) for k in range(1, 16)]  # 0.1 .. 1.5; the quantum runs use 0.7
N_CHAINS, SCHEDULE = 64, SamplingSchedule(n_warmup=300, n_samples=250, steps_per_sample=4)
TRACE_LEN = 160
PAIRS = [(i, j) for i in range(N) for j in range(i + 1, N)]

IDX = np.arange(2 ** N, dtype=np.int64)
BITS = ((IDX[:, None] >> (N - 1 - np.arange(N))) & 1).astype(np.int8)  # qubit 0 = leftmost = MSB
SPINS = (1 - 2 * BITS).astype(np.float32)


def colour(edges):
    """Greedy colouring, highest degree first: every colour class is an independent set."""
    nb = {q: set() for q in range(N)}
    for i, j in edges:
        nb[i].add(j)
        nb[j].add(i)
    col = {}
    for q in sorted(range(N), key=lambda q: (-len(nb[q]), q)):
        used = {col[r] for r in nb[q] if r in col}
        col[q] = min(c for c in range(N) if c not in used)
    return [[q for q in range(N) if col[q] == c] for c in range(max(col.values()) + 1)]


def exact(edges, J, beta):
    I = np.array([e[0] for e in edges])
    K = np.array([e[1] for e in edges])
    lp = beta * ((SPINS[:, I] * SPINS[:, K]) @ J.astype(np.float32)).astype(np.float64)
    lp -= lp.max()
    p = np.exp(lp)
    p /= p.sum()
    C = (SPINS * p[:, None].astype(np.float32)).T @ SPINS
    top = np.argsort(p)[::-1][:20]
    return ([round(float(C[i, j]), 5) for i, j in PAIRS],
            [{"b": format(int(t), "020b"), "p": round(float(p[t]), 6)} for t in top],
            round(float(np.sort(p)[-20:].sum()), 5))


def bits_of(spins_bool):
    """THRML state (True = +1) -> graph-v1 bitstring ('0' = +1)."""
    return "".join("0" if s else "1" for s in spins_bool)


def main():
    circuits = json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))["circuits"]
    out = {"betas": BETAS, "n_chains": N_CHAINS, "schedule": {"n_warmup": SCHEDULE.n_warmup,
           "n_samples": SCHEDULE.n_samples, "steps_per_sample": SCHEDULE.steps_per_sample},
           "jax": jax.__version__, "circuits": {}}
    key = jax.random.key(14)
    for c in circuits:
        edges_ix = [(e["i"], e["j"]) for e in c["edges"]]
        J = np.array([e["J"] for e in c["edges"]], dtype=np.float32)
        nodes = [SpinNode() for _ in range(N)]
        edges = [(nodes[i], nodes[j]) for i, j in edges_ix]
        colours = colour(edges_ix)
        free_blocks = [Block([nodes[q] for q in cl]) for cl in colours]
        read = Block(nodes)
        per_beta = {}
        for beta in BETAS:
            model = IsingEBM(nodes, edges, jnp.zeros(N), jnp.asarray(J), jnp.array(beta, dtype=jnp.float32))
            program = IsingSamplingProgram(model, free_blocks, [])
            key, ki, ks = jax.random.split(key, 3)
            init = hinton_init(ki, model, free_blocks, (N_CHAINS,))
            run = jax.jit(jax.vmap(lambda i, k: sample_states(k, program, SCHEDULE, i, [], [read])))
            S = np.asarray(run(init, jax.random.split(ks, N_CHAINS))[0])  # (chains, samples, 20) bool
            flat = S.reshape(-1, N)
            spins = np.where(flat, 1.0, -1.0)
            C = spins.T @ spins / len(spins)
            m = spins.mean(0)
            counts = Counter(bits_of(r) for r in flat)
            ex_corr, ex_top, ex_mass = exact(edges_ix, J, beta)
            corr = [round(float(C[i, j]), 5) for i, j in PAIRS]
            d = np.abs(np.array(corr) - np.array(ex_corr))
            per_beta[f"{beta:.1f}"] = {
                "corr": corr, "m": [round(float(x), 4) for x in m], "n": int(len(flat)),
                "top20": [{"b": b, "count": n, "p": round(n / len(flat), 6)} for b, n in counts.most_common(20)],
                "trace": [bits_of(r) for r in S[0, :TRACE_LEN]],
                "exact_corr": ex_corr, "exact_top20": ex_top, "exact_top20_mass": ex_mass,
                "err_mean": round(float(d.mean()), 5), "err_max": round(float(d.max()), 5),
            }
            print(f"  {c['id']} beta {beta:.1f}: edge<ss> "
                  f"{np.mean([C[i, j] for i, j in edges_ix]):.3f}  |THRML-exact| mean {d.mean():.4f} max {d.max():.4f}")
        out["circuits"][c["id"]] = {"colours": colours, "betas": per_beta}
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "thrml.json").write_text(json.dumps(out), encoding="utf-8")
    print("out/thrml.json written")


if __name__ == "__main__":
    main()
