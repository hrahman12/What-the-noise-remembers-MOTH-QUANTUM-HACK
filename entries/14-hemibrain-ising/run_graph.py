"""QUANTUM step: sample each connectome Ising toy with Atlas graph-v1 at 20 qubits (the engine maximum).

How a circuit becomes graph-v1 operations (built classically here, prepared by the engine):
  1. every qubit gets a Bloch target X = +1 (|+>: spin up/down equally likely, no correlations);
  2. for each of the 30 modelled edges, strongest synapse count first, a two-qubit target ZZ = +1
     with `fraction` f_ij. f_ij is chosen so that, acting alone on two fresh |+> qubits, it would give
     <Z_i Z_j> = tanh(beta * J_ij), the thermal correlation of an isolated Ising bond. The f -> <ZZ>
     curve comes from qg_replica.pair_curve (a classical re-implementation of QuantumGraph's rule).
On the full graph the operations act on already-correlated qubits, so the prepared state is NOT the
Boltzmann distribution; comparing the two is the point of the piece.

coupling_map lists all 190 pairs so the engine reports tomography for every pair (only the 30
modelled edges receive operations). Runs: every circuit (compass, memory, smell) on IBM hardware
(`qpu`, QPU_BACKEND, default ibm_fez, 156-qubit Heron; the engine uses 20 of its qubits) with identical
parameters, plus compass and memory on `emu` (Aer simulator) kept as the labelled noiseless baseline.
graph-v1 costs 5 credits per run; the piece cap is 40 (25 for the first round, 15 for the ibm_fez
round). Every job is cached, so re-runs are free; MOTH_FREEZE=1 refuses new jobs.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from atlas.client import Atlas, AtlasError, CACHE, _hash  # noqa: E402
from qg_replica import pair_curve  # noqa: E402

PIECE, CAP = "14-hemibrain-ising", 40  # 25 first round + 15 for the ibm_fez round
BETA = 0.7
SHOTS = 4096
N = 20
QPU_BACKEND = os.environ.get("MOTH_QPU_BACKEND", "ibm_fez")  # IBM Heron, 156 qubits: the default hardware target
# Budget (every submission is listed in out/atlas_jobs.json):
#  * round 1 (25 credits): two early compass/emu submissions at 16384 shots failed inside Atlas ("mothbackend"
#    unreachable) but are ledgered; compass/emu and memory/emu at 4096 shots completed; the first compass/qpu
#    job on ibm_fez (8642a642...) ended "QPU job ended as cancelled" (ibm_collection_failed);
#  * round 2 (15 credits): the compass/qpu job is resubmitted on ibm_fez with identical parameters, then
#    memory/qpu and smell/qpu, so all three networks have hardware samples.
# Hardware runs come first: they are the primary results. The two emu runs stay as the noiseless baseline.
RUNS = [("compass", "qpu"), ("memory", "qpu"), ("smell", "qpu"), ("compass", "emu"), ("memory", "emu")]
ALL_PAIRS = [[i, j] for i in range(N) for j in range(i + 1, N)]

_F = np.linspace(0, 1, 2001)
_G = pair_curve(_F)


def fraction_for(c):
    """Fraction whose isolated-pair <ZZ> equals c (inverse of the monotone replica curve)."""
    return round(float(np.interp(c, _G, _F)), 4)


def operations(circuit, beta=BETA):
    ops = [{"type": "bloch", "qubit": q, "paulis": {"X": 1.0}} for q in range(N)]
    for e in circuit["edges"]:  # already sorted strongest first
        ops.append({"type": "relationship", "qubits": [e["i"], e["j"]], "paulis": {"ZZ": 1.0},
                    "fraction": fraction_for(np.tanh(beta * e["J"]))})
    return ops


def params(circuit, mode, beta=BETA):
    p = {"num_qubits": N, "coupling_map": ALL_PAIRS, "operations": operations(circuit, beta),
         "shots": SHOTS, "mode": mode}
    if mode == "qpu":
        p["backend_name"] = QPU_BACKEND
    return p


def summarise(circuit, rec, mode):
    out = rec["response"]["result"]["output"]
    tomo = out["tomography"]
    zz = {k: v["ZZ"] for k, v in tomo["relationships"].items()}
    z = [tomo["bloch"][str(q)]["Z"] for q in range(N)]
    meas = out["measurements"]
    edges = [(e["i"], e["j"]) for e in circuit["edges"]]

    def agree(b):
        return sum(b[i] == b[j] for i, j in edges) / len(edges)

    return {
        "circuit": circuit["id"], "mode": mode, "job_id": rec["job_id"], "backend": out.get("backend"),
        "ibm_job_id": out.get("ibm_job_id"), "num_qubits": out.get("num_qubits"), "shots": out.get("shots"),
        "seconds": rec.get("seconds"), "beta": BETA,
        "cache_key": _hash({"e": "graph-v1", "p": rec["params"], "f": rec.get("input_files") or {}}),
        "dominant_bitstring": out.get("dominant_bitstring"),
        "edge_agreement_score_engine": out.get("edge_agreement_score"),  # engine: over coupling_map (190 pairs)
        "top20": [{"b": m["bitstring"], "count": m["count"], "p": m["probability"],
                   "agree": round(agree(m["bitstring"]), 4)} for m in meas],
        "top20_mass": round(sum(m["probability"] for m in meas), 6),
        "tomo_zz": [round(zz[f"{i},{j}"], 6) for i, j in ALL_PAIRS],
        "tomo_z": [round(v, 6) for v in z],
    }


def ledger():
    """This piece's graph-v1 entries in the shared credit ledger (job id, cache key, credits), oldest first."""
    out = []
    for line in (CACHE / "ledger.jsonl").read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("piece") == PIECE and e.get("engine") == "graph-v1":
            out.append(e)
    return out


def refresh_jobs_table(a):
    """Every graph-v1 job this piece put in the shared credit ledger -> out/atlas_jobs.json.

    Reads cache/ledger.jsonl (job id, cache key, credits) and asks Atlas for each job's status (a free,
    read-only GET) until the job is completed or failed; finished rows are kept as they are, so with
    MOTH_FREEZE=1 (or offline) the table is rebuilt from the existing file with no network call."""
    path = HERE / "out" / "atlas_jobs.json"
    old = {j["job_id"]: j for j in json.loads(path.read_text(encoding="utf-8"))} if path.exists() else {}
    rows = []
    for e in ledger():
        row = old.get(e["job_id"])
        if (row is None or row["status"] not in ("completed", "failed")) and os.environ.get("MOTH_FREEZE") != "1":
            try:
                st = a.get(f"/jobs/{e['job_id']}/status")
            except Exception as err:  # offline: keep what we had
                print(f"  status of {e['job_id']} unavailable: {str(err)[:200]}")
                st = None
            if st:
                steps = st.get("steps") or []
                ex = (steps[0].get("extra") or {}) if steps else {}
                failed = [x["name"] for x in steps if x.get("status") == "failed"]
                row = {"job_id": e["job_id"], "cache_key": e["key"], "credits_ledgered": float(e["credits"]),
                       "status": st.get("status"), "mode": ex.get("mode"),
                       "backend_name": ex.get("backend_name") if ex.get("mode") == "qpu" else None,
                       "shots": ex.get("shots"), "num_qubits": ex.get("num_qubits"),
                       "submitted_at": st.get("submitted_at"), "updated_at": st.get("updated_at"),
                       "failed_step": failed[0] if failed else None, "error": st.get("error")}
        if row is not None:
            rows.append(row)
    path.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    return rows


def main():
    a = Atlas(piece=PIECE, credit_cap=CAP)
    circuits = {c["id"]: c for c in json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))["circuits"]}
    only = set(sys.argv[1:])  # optional filter like compass:qpu
    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)
    results = []
    for cid, mode in RUNS:
        tag = f"{cid}:{mode}"
        if only and tag not in only:
            prev = out_dir / "runs.json"
            if prev.exists():
                results += [r for r in json.loads(prev.read_text(encoding="utf-8"))
                            if r["circuit"] == cid and r["mode"] == mode]
            continue
        p = params(circuits[cid], mode)
        key = _hash({"e": "graph-v1", "p": p, "f": {}})
        rec = None
        try:  # one submission per call: a failed job is still ledgered, so retries are deliberate
            rec = a.run("graph-v1", p, timeout=3600 if mode == "qpu" else 900)
        except AtlasError as e:
            print(f"  {tag}: no result: {str(e)[:400]}")
        if rec is None:  # failed at Atlas or IBM (it is in the ledger), or never sent (no credits left / MOTH_FREEZE=1)
            tried = [e["job_id"] for e in ledger() if e["key"] == key]
            results.append({"circuit": cid, "mode": mode, "status": "failed" if tried else "not_submitted",
                            "cache_key": key, "jobs": tried})
            continue
        s = summarise(circuits[cid], rec, mode)
        s["status"] = "completed"
        results.append(s)
        print(f"  {tag}: job {s['job_id']} backend {s['backend']} qubits {s['num_qubits']} "
              f"top20 mass {s['top20_mass']:.3f} dominant {s['dominant_bitstring']}")
    (out_dir / "runs.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    (out_dir / "pair_curve.json").write_text(json.dumps(
        {"fraction": [round(float(x), 4) for x in _F[::50]], "zz": [round(float(x), 5) for x in _G[::50]]}),
        encoding="utf-8")
    jobs = refresh_jobs_table(a)
    print(f"spent {a.spent():g} of {CAP} credits; {sum(r.get('status') == 'completed' for r in results)} runs completed; "
          f"{len(jobs)} ledgered jobs in out/atlas_jobs.json")


if __name__ == "__main__":
    main()
