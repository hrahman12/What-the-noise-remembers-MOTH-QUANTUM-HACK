"""Run one labyrinth-v1 job per level on IBM ibm_fez. QUANTUM (IBM hardware, every level).

Each level's street plan comes from town.py (classical, seeded). labyrinth-v1 turns every street
into a ZZ coupling, prepares the state from |+> and samples it; the sampled bits become the
lamp pattern of the town. One job = one level, and every level runs on the same chip, ibm_fez
(IBM Heron, 156 qubits), which is the default hardware target below.

    python run_levels.py              # every level and both comparison runs (cached jobs replay free and offline)
    python run_levels.py L1 L2        # only these levels
    python run_levels.py L1-emu       # only this comparison run

Two earlier runs of the same towns are kept ONLY as labelled comparisons on the page (COMPARE below):
L1 on the noiseless Aer emulator (the baseline: what the circuit gives with no noise) and L2 on ibm_miami
(IBM Nighthawk, a square lattice: the same 120-qubit town on a chip shaped like the grid). They are not
levels you fly; they replay from cache for free and are never resubmitted by default.

History of submissions (credit cap 27 = 15 for the first three jobs + 12 for the ibm_fez re-runs):
L1 on the emulator, then L3 on ibm_fez, then L2 on ibm_miami (15 credits); then L1 and L2 again on
ibm_fez at the same sizes (10 credits), so that all three levels are real ibm_fez jobs.

Every completed job is cached in ../../cache/labyrinth-v1/ and ledgered under this piece.
Failed jobs are retried once and never replaced by a fake; the raw engine result is copied to
out/<id>.json unchanged and listed in out/jobs.csv.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402
from town import street_plan  # noqa: E402

PIECE, CAP = "13-moth-to-flame", 27
BACKEND = "ibm_fez"   # default hardware target for every level (IBM Heron, 156 qubits)

# Engine defaults for steps / fraction / k; top_n=-1 keeps every distinct measured bitstring.
COMMON = {"shots": 4096, "steps": 3, "fraction": 1 / 3, "k": 3, "top_n": -1}

LEVELS = {
    # 4x5 = 20 qubits: the same town as the emulator baseline below, so the two compare edge for edge.
    "L1": {"name": "Lamp Lane", "rows": 4, "cols": 5, "seed": 13, "mode": "qpu", "backend_name": BACKEND},
    # 10x12 = 120 qubits: the same town as the ibm_miami comparison below (Nighthawk's 120 qubits).
    "L2": {"name": "Hedge Row", "rows": 10, "cols": 12, "seed": 1313, "mode": "qpu", "backend_name": BACKEND},
    # 12x13 = 156 qubits: the whole ibm_fez chip.
    "L3": {"name": "Night Town", "rows": 12, "cols": 13, "seed": 2024, "mode": "qpu", "backend_name": BACKEND},
}

# Labelled comparison runs (same towns, other backends). Kept only because the page compares them.
COMPARE = {
    # the engine's local Aer simulator (noiseless, capped at 20 qubits): the no-noise baseline for L1
    "L1-emu": {**LEVELS["L1"], "of": "L1", "mode": "emu", "backend_name": None},
    # IBM Nighthawk: 120 qubits on a square lattice, the shape of the 10x12 town
    "L2-miami": {**LEVELS["L2"], "of": "L2", "mode": "qpu", "backend_name": "ibm_miami"},
}
ALL = {**LEVELS, **COMPARE}


def level_params(spec):
    rows, cols = spec["rows"], spec["cols"]
    n = rows * cols
    level_data = {
        "name": f"Moth to Flame: {spec['name']}",
        "grid_size": {"rows": rows, "cols": cols},
        "num_qubits": n,
        "coupling_map": street_plan(rows, cols, spec["seed"]),
        # game metadata only (copied verbatim by the engine): the moth's home square
        "initial_states": {str(n - 1): {"radiating": False, "home": True}},
    }
    p = {"level_data": level_data, "mode": spec["mode"], **COMMON}
    if spec.get("backend_name"):
        p["backend_name"] = spec["backend_name"]
    return p


def main(which):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    rows = []
    for lid in which:
        spec = ALL[lid]
        role = "comparison" if lid in COMPARE else "level"
        params = level_params(spec)
        nq = params["level_data"]["num_qubits"]
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("labyrinth-v1", params, timeout=3600)
                break
            except AtlasError as e:
                print(f"  {lid} attempt {attempt} failed: {str(e)[:400]}")
                if "credit cap" in str(e) or "MOTH_FREEZE" in str(e):
                    break
        if rec is None:
            rows.append({"level": lid, "role": role, "name": spec["name"], "mode": spec["mode"], "qubits": nq,
                         "backend": spec.get("backend_name") or "", "job_id": "", "status": "failed", "seconds": ""})
            continue
        res = rec["response"]["result"]
        (out / f"{lid}.json").write_text(json.dumps({"job_id": rec["job_id"], "seconds": rec["seconds"],
                                                     "params": params, "result": res}), encoding="utf-8")
        backend = ((res.get("output") or {}).get("metrics") or {}).get("backend") if isinstance(res, dict) else None
        if spec.get("backend_name") and backend != spec["backend_name"]:
            print(f"  WARNING {lid}: asked for {spec['backend_name']}, engine reports {backend}")
        rows.append({"level": lid, "role": role, "name": spec["name"], "mode": spec["mode"], "qubits": nq,
                     "backend": backend or "", "job_id": rec["job_id"], "status": "completed", "seconds": rec["seconds"]})
        print(f"  {lid} {spec['name']}: {rec['job_id']} ({spec['mode']}, {backend}, {nq} qubits)")
    # merge with rows already on disk for ids not run this time
    csv_path = out / "jobs.csv"
    fields = ["level", "role", "name", "mode", "qubits", "backend", "job_id", "status", "seconds"]
    keep = {}
    if csv_path.exists():
        for r in csv.DictReader(open(csv_path, encoding="utf-8")):
            if r["level"] in ALL:
                r.setdefault("role", "comparison" if r["level"] in COMPARE else "level")
                keep[r["level"]] = {k: r.get(k, "") for k in fields}
    for r in rows:
        keep[r["level"]] = r
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for lid in ALL:
            if lid in keep:
                w.writerow(keep[lid])
    print(f"spent {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    main(sys.argv[1:] or list(ALL))
