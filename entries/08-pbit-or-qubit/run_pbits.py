"""Run the p-bit side: Extropic THRML (0.1.4) block Gibbs sampling of the same 20-node Ising problems. CLASSICAL.

THRML simulates the block-Gibbs programs that Extropic's probabilistic chips run natively: every node is a
p-bit that flips to +1 with probability sigmoid(2 * local field), and nodes of one graph colour update
together. Here it runs on this laptop's CPU through JAX, not on Extropic hardware.

For each problem: 64 independent chains, 400 warm-up sweeps, then 64 samples per chain 10 sweeps apart
(4,096 samples). Samples are checked against the exact Boltzmann statistics from enumeration
(problems.exact_stats) and written to out/pbits.json. Seeded, so re-runs reproduce exactly.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import jax
import jax.numpy as jnp
import networkx as nx
import numpy as np
from thrml import Block, SpinNode, SamplingSchedule, sample_states
from thrml.models import IsingEBM, IsingSamplingProgram, hinton_init

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import problems as P  # noqa: E402

N_CHAINS, N_WARMUP, N_SAMPLES, STEPS = 64, 400, 64, 10
SEED = 2026


def sample_problem(name, J, defs, key):
    edges_idx = defs[name]["edges"]
    weights = jnp.array(P.couplings(name, J, defs), dtype=jnp.float32)
    nodes = [SpinNode() for _ in range(P.N)]
    edges = [(nodes[a], nodes[b]) for a, b in edges_idx]
    G = nx.Graph()
    G.add_nodes_from(range(P.N))
    G.add_edges_from(edges_idx)
    if nx.is_bipartite(G):
        col = nx.bipartite.color(G)
    else:
        col = nx.coloring.greedy_color(G, strategy="DSATUR")
    ncol = max(col.values()) + 1
    free_blocks = [Block([nodes[i] for i in range(P.N) if col[i] == k]) for k in range(ncol)]
    model = IsingEBM(nodes, edges, jnp.zeros(P.N), weights, jnp.array(1.0))
    program = IsingSamplingProgram(model, free_blocks, [])
    schedule = SamplingSchedule(n_warmup=N_WARMUP, n_samples=N_SAMPLES, steps_per_sample=STEPS)
    k_init, k_run = jax.random.split(key)
    init = hinton_init(k_init, model, free_blocks, (N_CHAINS,))
    run = jax.jit(jax.vmap(lambda i, k: sample_states(k, program, schedule, i, [], [Block(nodes)])))
    out = run(init, jax.random.split(k_run, N_CHAINS))[0]  # (chains, samples, 20) bool, True = +1
    spins = np.where(np.asarray(out), 1, -1).astype(np.int8)
    return spins, ncol


def main():
    defs = P.graph_defs()
    key = jax.random.key(SEED)
    res = []
    for name in ["ring", "ladder", "random"]:
        for J in P.JS:
            key, k = jax.random.split(key)
            t0 = time.time()
            spins, ncol = sample_problem(name, J, defs, k)
            flat = spins.reshape(-1, P.N)
            st = P.exact_stats(defs[name]["edges"], P.couplings(name, J, defs))
            zz = np.array([np.mean(flat[:, a] * flat[:, b]) for a, b in defs[name]["edges"]])
            err = float(np.abs(zz - np.array(st["edge_zz"])).max())
            # bitstrings in graph-v1's convention: qubit 0 leftmost, '0' = Z = +1 = spin up
            ints = [int("".join("0" if s > 0 else "1" for s in row), 2) for row in flat]
            # order: sample index major, chain minor, so consecutive 16 come from 16 different chains
            order = np.arange(len(ints)).reshape(N_CHAINS, N_SAMPLES).T.reshape(-1)
            res.append({"graph": name, "J": J, "colours": int(ncol), "chains": N_CHAINS, "warmup": N_WARMUP,
                        "samples_per_chain": N_SAMPLES, "steps_per_sample": STEPS, "seed": SEED,
                        "max_abs_edge_err_vs_exact": round(err, 4), "states": [ints[i] for i in order]})
            print(f"  {name:6s} J={J}: {len(ints)} samples, {ncol} colour blocks, "
                  f"max |<ss>_thrml - <ss>_exact| = {err:.3f}  ({time.time() - t0:.1f}s)")
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "pbits.json").write_text(json.dumps(res), encoding="utf-8")
    print("out/pbits.json written")


if __name__ == "__main__":
    main()
