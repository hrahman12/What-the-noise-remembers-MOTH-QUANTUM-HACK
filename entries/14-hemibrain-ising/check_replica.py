"""CLASSICAL cross-check: rebuild each graph-v1 circuit as an exact statevector and test it against the engine.

For every circuit with a completed graph-v1 run, qg_replica.Replica applies the same operation list
(QuantumGraph's rule, exact reduced density matrices) to a 2^20-amplitude statevector. We then compare:
  * the engine's sampled top-20 bitstrings (emu: Aer; qpu: ibm_fez) with the replica's exact
    probabilities for the same bitstrings (chi-square, and total-variation distance on those 20);
  * the engine's reported tomography (<Z_i>, <Z_i Z_j>) with the replica's exact values.
The replica is a classical simulation. The page labels it "exact state (classical check)" and never
presents it as engine output. Writes out/replica.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run_graph as rg  # noqa: E402
from qg_replica import Replica  # noqa: E402

N = 20


def main():
    circuits = {c["id"]: c for c in json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))["circuits"]}
    runs = [r for r in json.loads((HERE / "out" / "runs.json").read_text(encoding="utf-8")) if r.get("status") == "completed"]
    out = {}
    for cid in sorted({r["circuit"] for r in runs}):
        c = circuits[cid]
        rep = Replica(N).run(rg.operations(c))
        p = rep.probs()
        zz = np.array([rep.zz(i, j) for i, j in rg.ALL_PAIRS])
        z = np.array([rep.z(q) for q in range(N)])
        edge_mask = np.array([(i, j) in {(e["i"], e["j"]) for e in c["edges"]} for i, j in rg.ALL_PAIRS])
        top = np.argsort(p)[::-1][:20]
        entry = {
            "zz": [round(float(x), 5) for x in zz], "z": [round(float(x), 5) for x in z],
            "top20": [{"b": format(int(t), "020b"), "p": round(float(p[t]), 6)} for t in top],
            "top20_mass": round(float(p[top].sum()), 5),
            "edge_zz_mean": round(float(zz[edge_mask].mean()), 4),
            "p_aligned": round(float(p[0] + p[-1]), 5),
            "runs": {},
        }
        for r in [r for r in runs if r["circuit"] == cid]:
            shots = r["shots"]
            obs = np.array([m["count"] for m in r["top20"]], dtype=float)
            exp = np.array([p[int(m["b"], 2)] for m in r["top20"]]) * shots
            chi2 = float(((obs - exp) ** 2 / np.maximum(exp, 1e-9)).sum())
            tvd = 0.5 * float(np.abs(obs / shots - exp / shots).sum())
            tz = np.array(r["tomo_zz"])
            aligned_obs = sum(m["count"] for m in r["top20"] if m["b"] in ("0" * N, "1" * N)) / shots
            entry["runs"][r["mode"]] = {
                "job_id": r["job_id"], "backend": r["backend"],
                "replica_p_of_returned": [round(float(x / shots), 6) for x in exp],
                "chi2_top20": round(chi2, 2), "tvd_top20": round(tvd, 4),
                "top20_mass_engine": r["top20_mass"], "top20_mass_replica_same_strings": round(float(exp.sum() / shots), 5),
                "p_aligned_engine": round(aligned_obs, 5),
                "tomo_vs_exact_zz_mean_abs": round(float(np.abs(tz - zz).mean()), 4),
                "tomo_vs_exact_zz_max_abs": round(float(np.abs(tz - zz).max()), 4),
                "tomo_edge_zz_mean": round(float(tz[edge_mask].mean()), 4),
                "tomo_vs_exact_z_max_abs": round(float(np.abs(np.array(r["tomo_z"]) - z).max()), 4),
            }
            print(f"{cid}/{r['mode']} ({r['backend']}): chi2 {chi2:.1f} on 20 strings, TVD {tvd:.4f}; "
                  f"top-20 mass engine {r['top20_mass']:.3f} vs replica {p[top].sum():.3f}; "
                  f"aligned {aligned_obs:.4f} vs {p[0] + p[-1]:.4f}; "
                  f"edge <ZZ> tomography {tz[edge_mask].mean():.3f} vs exact {zz[edge_mask].mean():.3f}")
        out[cid] = entry
    (HERE / "out" / "replica.json").write_text(json.dumps(out), encoding="utf-8")
    print("out/replica.json written")


if __name__ == "__main__":
    main()
