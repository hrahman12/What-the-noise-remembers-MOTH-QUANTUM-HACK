"""Summarise the cached results into out/summary.json, PARAMS.md and piece.json. CLASSICAL, offline.

Numbers per problem: mean edge correlation (signed by J) for the exact Boltzmann distribution, the THRML
p-bits (4,096 samples), the emulator and ibm_fez shots (20 each, with bootstrap standard errors), graph-v1's
own reported tomography, and the mean Z bias. Also checks each emulator job against qg_replica.py (our
numpy port of QuantumGraph): per-qubit Z versus the engine's tomography, and the shots' log-likelihood.
"""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT))
import problems as P  # noqa: E402
from qg_replica import Replica  # noqa: E402

PIECE = "08-pbit-or-qubit"


def spins_of(bits):
    return np.array([[1 - 2 * int(c) for c in b] for b in bits], dtype=float)


def signed_mean(S, edges, signs):
    return float(np.mean([np.mean(S[:, a] * S[:, b]) * s for (a, b), s in zip(edges, signs)]))


def boot(S, f, reps=400, seed=7):
    rng = np.random.default_rng(seed)
    return float(np.std([f(S[rng.integers(0, len(S), len(S))]) for _ in range(reps)], ddof=1))


def replica_check(name, J, defs, job):
    r = Replica(P.N)
    for op in P.graph_params(name, J, defs=defs)["operations"]:
        if op["type"] == "bloch":
            r.set_bloch(op["paulis"], op["qubit"])
        else:
            r.set_relationship(op["paulis"], *op["qubits"], fraction=op["fraction"])
    rz = np.array([r.bloch(q)["Z"] for q in range(P.N)])
    p = r.probs()
    ll = float(np.mean(np.log(p[[int(b, 2) for b in job["bitstrings"]]] + 1e-300)))
    ent = float(-np.sum(p[p > 0] * np.log(p[p > 0])))
    return {"max_abs_Z_replica_vs_engine": round(float(np.abs(rz - np.array(job["tomo_z"])).max()), 4),
            "shot_loglik_per_shot": round(ll, 2), "replica_expected_loglik": round(-ent, 2)}


def main():
    defs = P.graph_defs()
    jobs = json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))
    pbits = json.loads((HERE / "out" / "pbits.json").read_text(encoding="utf-8"))
    failed = json.loads((HERE / "out" / "failed.json").read_text(encoding="utf-8")) if (HERE / "out" / "failed.json").exists() else []
    rows = []
    for name in ["ring", "ladder", "random"]:
        e, sg = defs[name]["edges"], defs[name]["signs"]
        for J in P.JS:
            st = P.exact_stats(e, P.couplings(name, J, defs))
            pb = next(p for p in pbits if p["graph"] == name and p["J"] == J)
            Sp = spins_of([format(v, "020b") for v in pb["states"]])
            row = {"graph": name, "J": J, "edges": len(e),
                   "exact": round(float(np.mean(np.array(st["edge_zz"]) * sg)), 3),
                   "thrml": round(signed_mean(Sp, e, sg), 3), "thrml_max_edge_err": pb["max_abs_edge_err_vs_exact"]}
            for mode in ("emu", "qpu"):
                j = next((x for x in jobs if x["graph"] == name and x["J"] == J and x["mode"] == mode), None)
                if not j:
                    continue
                S = spins_of(j["bitstrings"])
                row[mode] = {"job_id": j["job_id"], "backend": j["backend"], "ibm_job_id": j.get("ibm_job_id"),
                             "num_qubits": j["num_qubits"], "shots": j["returned_shots"],
                             "mean_edge": round(signed_mean(S, e, sg), 3),
                             "se": round(boot(S, lambda X: signed_mean(X, e, sg)), 3),
                             "mean_z": round(float(S.mean()), 3), "se_z": round(boot(S, lambda X: float(X.mean())), 3),
                             "tomo_mean_edge": round(float(np.mean(np.array(j["tomo_edge_zz"]) * sg)), 3)}
                if mode == "emu":
                    row[mode]["replica"] = replica_check(name, J, defs, j)
            rows.append(row)
            print(f"{name:6s} J={J}: exact {row['exact']:.3f} thrml {row['thrml']:.3f} "
                  + " ".join(f"{m} {row[m]['mean_edge']:.2f}+-{row[m]['se']:.2f} (tomo {row[m]['tomo_mean_edge']:.2f}, Z {row[m]['mean_z']:+.2f})"
                             for m in ("emu", "qpu") if m in row))
    (HERE / "out" / "summary.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")

    # ledger spend for this piece (the Atlas client's ledger, plus any web-app jobs it appended)
    led = [json.loads(line) for line in (ROOT / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    mine = [x for x in led if x.get("piece") == PIECE]
    spent = sum(float(x["credits"]) for x in mine)
    done_ids = {j["job_id"] for j in jobs}

    lines = ["# Parameters: every graph-v1 job (20 qubits each)", "",
             "Engine: **graph-v1** (Atlas Quantum Graph Engine). `num_qubits` = 20, the engine maximum, reported back by every job "
             "as `num_qubits: 20`. `shots` = 20 for every job, because graph-v1 returns only its top 20 bitstrings; with 20 shots "
             "that list holds every shot.", "",
             "Recipe (identical for emulator and hardware): 20 `bloch` targets `{X: 1}` (qubit in |+>), then one `relationship` "
             "target per edge `{ZZ: t}` with `fraction = (2/pi) asin|t|`, where t is the exact Boltzmann edge correlation for that J "
             "(problems.py). Edges are sent in breadth-first build order (problems.json). Hardware jobs add `mode: qpu`, "
             "`backend_name: ibm_fez`.", "",
             "| graph | J | edges | where | backend | job_id | IBM job | shots back | mean edge corr (shots) | engine tomography |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        for mode in ("emu", "qpu"):
            if mode in r:
                m = r[mode]
                lines.append(f"| {r['graph']} | {r['J']} | {r['edges']} | {'emulator' if mode == 'emu' else 'hardware'} | {m['backend']} | "
                             f"`{m['job_id']}` | {('`' + m['ibm_job_id'] + '`') if m['ibm_job_id'] else '-'} | {m['shots']} | "
                             f"{m['mean_edge']:.2f} +- {m['se']:.2f} | {m['tomo_mean_edge']:.2f} |")
    lines += ["", "## Jobs that did not complete", ""]
    if failed:
        lines += ["| graph | J | where | job_id | what Atlas reported | credits |", "|---|---|---|---|---|---|"]
        for f in failed:
            lines.append(f"| {f['graph']} | {f['J']} | {f['mode']} | `{f['job_id']}` | {f['error']} | 5 (ledgered) |")
    else:
        lines.append("None.")
    other = [x for x in mine if x["job_id"] not in done_ids and x["job_id"] not in {f["job_id"] for f in failed}]
    if other:
        lines += ["", "Ledgered but not yet collected: " + ", ".join(f"`{x['job_id']}`" for x in other)]
    lines += ["", "## p-bits (THRML 0.1.4, CPU, classical)", "",
              "`IsingEBM(nodes, edges, biases=0, weights=J_ij, beta=1)`, blocks from a graph colouring, 64 chains, "
              "400 warm-up sweeps, 64 samples per chain 10 sweeps apart (4,096 samples), JAX key 2026.", "",
              "| graph | J | colours | max abs edge error vs exact | mean edge corr | exact |", "|---|---|---|---|---|---|"]
    for r in rows:
        pb = next(p for p in pbits if p["graph"] == r["graph"] and p["J"] == r["J"])
        lines.append(f"| {r['graph']} | {r['J']} | {pb['colours']} | {r['thrml_max_edge_err']:.3f} | {r['thrml']:.3f} | {r['exact']:.3f} |")
    lines += ["", f"Ledgered spend for this piece: **{spent:g} credits** of a 60-credit cap ({len(mine)} submissions at 5 credits)."]
    (HERE / "PARAMS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    hw = sorted({r["qpu"]["backend"] for r in rows if "qpu" in r})
    n_qpu = sum("qpu" in r for r in rows)
    piece = {
        "slug": PIECE, "challenge": "08", "bonus": False, "title": "p-bit or qubit?",
        "hook": "Sauna vs Fridge: call who sent the noise.",
        "sub": "An arcade showdown on one 20-spin Ising problem: p-bits, drawn as a real stochastic magnetic tunnel junction "
               "flipping on room-temperature heat (simulated here with Extropic's THRML on a CPU), against superconducting "
               "qubits on the bottom plate of a dilution refrigerator (Atlas's emulator, and IBM's ibm_fez as the boss). "
               "Call each envelope of 16 real samples before the clock runs out and descend the fridge plate by plate.",
        "you_control": ["Press start, then call each envelope: Sauna (p-bits) or Fridge (qubits), against a 15 s clock",
                        "Watch the 20-magnet board flip through the 16 real samples; step or tap through them",
                        "Descend the fridge plate by plate to a boss round of real ibm_fez shots",
                        "Turn the coupling-J dial and pick a graph; check the honest chance meter; scroll to The data for the fingerprints",
                        "Run graph-v1 live from the web app (node server.js)"],
        "mascot": "web/img/mascot.png",
        "engines": ["graph-v1"],
        "qubits": 20,
        "qubits_note": "graph-v1 num_qubits = 20 (engine maximum, one qubit per Ising node), reported by every job; shots = 20 so the top-20 output holds every shot",
        "hardware": hw[0] if hw else None,
        "jobs": len(jobs),
        "credits_spent": spent,
        "deliverables": ["app/server.js", "app/api/graph.js", "app/api/health.js", "app/vercel.json", "app/public/index.html",
                         "app/lib/atlas.js", "app/lib/ising.js", "web/index.html", "web/sprites.json", "web/img/mascot.png",
                         "make_sprites.py", "README.md", "PARAMS.md", "CREDITS.md"],
        "web_entry": "web/index.html",
        "status": "built" if n_qpu >= 1 else "partial",
        "honesty": "Emulated qubits are a classical simulation; ibm_fez batches are real hardware but only 20 shots each; THRML ran on a CPU; "
                   "the qubits were handed the Boltzmann pair correlations, so no advantage is claimed.",
        "blockers": []}
    if failed:
        no_hw = [f"{r['graph']} J={r['J']}" for r in rows if "qpu" not in r and any(f["graph"] == r["graph"] and f["J"] == r["J"] for f in failed)]
        piece["blockers"].append(f"{len(failed)} of {len(failed) + n_qpu} ibm_fez submissions came back 'QPU job ended as cancelled' (ibm_collection_failed) about 15 min after "
                                 f"submission; the retries that completed give hardware batches for {n_qpu} problems. No hardware batch for: {', '.join(no_hw)}, "
                                 "and ladder J=0.4 / spin glass J=0.4 were never sent to hardware. The 60-credit cap is fully spent, so no further retries.")
    piece["blockers"].append("Web app not deployed (by instruction); vercel.json and api/ are included but untested on Vercel")
    piece["blockers"].append("POST /api/graph was not run end to end against Atlas (credit cap reached); its request path was checked with a free "
                             "schema-invalid probe (422, no job), and GET /api/graph was tested live against a completed job")
    (HERE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")
    print(f"PARAMS.md, piece.json, out/summary.json written; spent {spent:g} credits; {len(jobs)} completed jobs ({n_qpu} on hardware)")


if __name__ == "__main__":
    main()
