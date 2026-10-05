"""Run the qubit side: graph-v1 at num_qubits = 20 (its maximum) on the Atlas emulator and on IBM ibm_fez.

QUANTUM. mode 'emu' = Atlas's Aer simulator (a classical simulation of the circuit, noiseless).
mode 'qpu' = real IBM hardware (ibm_fez, IBM Heron, 156 qubits). Every job: shots = 20, because graph-v1 returns only its
top-20 bitstrings; with 20 shots that list is guaranteed to hold every shot, so no sample is lost or
biased by the truncation.

Each completed job is cached in ../../cache/graph-v1/ and summarised in out/jobs.json. Re-running is free
and offline. Failed jobs are retried once and never replaced by anything else.

  python run_graph.py                      # the full plan (only uncached jobs are submitted; the cap is now spent)
  python run_graph.py ring:1.0:emu         # just these
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

import problems as P  # noqa: E402

PLAN = [("ring", 1.0, "emu"), ("ring", 0.4, "emu"), ("ladder", 1.0, "emu"), ("ladder", 0.4, "emu"),
        ("random", 1.0, "emu"), ("random", 0.4, "emu"),
        ("ring", 1.0, "qpu"), ("ladder", 1.0, "qpu"), ("random", 1.0, "qpu"), ("ring", 0.4, "qpu")]
OUT = HERE / "out"


def summarise(name, J, mode, rec, defs):
    o = rec["response"]["result"]["output"]
    edges = defs[name]["edges"]
    tomo = o["tomography"]
    shots = []
    for m in o["measurements"]:
        shots += [m["bitstring"]] * int(m["count"])
    return {"graph": name, "J": J, "mode": mode, "job_id": rec["job_id"], "backend": o.get("backend"),
            "ibm_job_id": o.get("ibm_job_id"), "num_qubits": o.get("num_qubits"), "shots": o.get("shots"),
            "seconds": rec.get("seconds"),
            "returned_shots": len(shots), "bitstrings": sorted(shots),
            "dominant_bitstring": o.get("dominant_bitstring"), "edge_agreement_score": o.get("edge_agreement_score"),
            "tomo_edge_zz": [float(tomo["relationships"][f"{a},{b}"]["ZZ"]) for a, b in edges],
            "tomo_z": [float(tomo["bloch"][str(q)]["Z"]) for q in range(P.N)],
            "coupling_map_echo": o.get("coupling_map")}


def main(argv):
    plan = PLAN
    if argv:
        plan = [(s.split(":")[0], float(s.split(":")[1]), s.split(":")[2]) for s in argv]
    a = Atlas(piece="08-pbit-or-qubit", credit_cap=60)
    defs = P.graph_defs()
    OUT.mkdir(exist_ok=True)
    jp = OUT / "jobs.json"
    jobs = json.loads(jp.read_text(encoding="utf-8")) if jp.exists() else []
    for name, J, mode in plan:
        params = P.graph_params(name, J, mode=mode, defs=defs)
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("graph-v1", params, timeout=3600 if mode == "qpu" else 900)
                break
            except AtlasError as e:
                if "MOTH_FREEZE" in str(e):
                    print(f"  {name:6s} J={J} {mode}: no completed job in the cache (see out/failed.json), skipped under MOTH_FREEZE")
                    break
                print(f"  {name} J={J} {mode} attempt {attempt} failed: {str(e)[:400]}")
                if "credit cap" in str(e) or "MOTH_FREEZE" in str(e) or "-> 402" in str(e):
                    break
        if rec is None:
            continue
        s = summarise(name, J, mode, rec, defs)
        jobs = [j for j in jobs if not (j["graph"] == name and j["J"] == J and j["mode"] == mode)] + [s]
        print(f"  {name:6s} J={J} {mode}: {s['job_id']} backend={s['backend']} shots={s['returned_shots']}/{s['shots']}")
    order = {k: i for i, k in enumerate(PLAN)}
    jobs.sort(key=lambda j: order.get((j["graph"], j["J"], j["mode"]), 99))
    jp.write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    print(f"{len(jobs)} jobs in out/jobs.json; ledgered spend for this piece: {a.spent():g} credits")


if __name__ == "__main__":
    main(sys.argv[1:])
