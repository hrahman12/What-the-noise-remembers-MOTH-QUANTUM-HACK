"""Pull the jitter banks for Jam the Bat from comet-qrng-v1 (Atlas).

Four jobs, 5 credits each (cap 45 for this piece):
  emu_12p8   emu, 12 register + 8 Bell-witness qubits = 20 (the emu cap)   -> uncertified classical baseline
  emu_20p0   emu, 20 register qubits, no witness = 20 (the emu cap)        -> uncertified classical baseline
  fez_148p8  qpu ibm_fez,       148 register + 8 Bell = 156 (the full chip)
  mar_148p8  qpu ibm_marrakesh, 148 register + 8 Bell = 156 (the full chip)

Usage: python run_comet.py [name ...]   (default: all). Every completed job is cached under
cache/comet-qrng-v1/, so re-runs are free and offline (MOTH_FREEZE=1 refuses any new submission).
A failed job is retried once; a job that still fails is recorded as failed and never replaced.
Outputs: out/<name>.json (the engine's result.output minus the raw counts, which stay in the cache)
and out/jobs.json (one summary row per job).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

PIECE, CAP = "05-jam-the-bat", 45
BASE = {"shots": 10000, "output_bytes": 1000000, "include_raw_counts": True}
JOBS = {
    "emu_12p8": {**BASE, "mode": "emu", "num_qubits": 12, "bell_witness": True},
    "emu_20p0": {**BASE, "mode": "emu", "num_qubits": 20, "bell_witness": False},
    "fez_148p8": {**BASE, "mode": "qpu", "backend_name": "ibm_fez", "num_qubits": 148, "bell_witness": True},
    "mar_148p8": {**BASE, "mode": "qpu", "backend_name": "ibm_marrakesh", "num_qubits": 148, "bell_witness": True},
}


def summarize(name, params, rec):
    out = rec["response"]["result"]["output"]
    # this engine version reports its certificate as `entropy_report` (the docs' `certificate`)
    prov, bw = out.get("provenance", {}), out.get("bell_witness") or {}
    cert = out.get("entropy_report") or out.get("certificate") or {}
    reg = params["num_qubits"]
    total = reg + (8 if params["bell_witness"] else 0)
    return {
        "name": name, "job_id": rec["job_id"], "status": "completed", "mode": params["mode"],
        "backend": prov.get("backend"), "provider_job_id": prov.get("provider_job_id"),
        "register_qubits": reg, "witness_qubits": total - reg, "total_qubits": total,
        "shots": params["shots"], "bytes": out.get("random", {}).get("bytes"),
        "entropy_accounted": cert.get("entropy_accounted", cert.get("certified")), "grade": cert.get("grade"),
        "accounting_basis": cert.get("accounting_basis"), "h_bit": cert.get("h_bit"),
        "budget_bits": cert.get("budget_bits"), "health_passed": cert.get("health_passed"),
        "S": bw.get("S"), "sigma_S": bw.get("sigma_S"),
        "violates_classical_3sigma": bw.get("violates_classical_3sigma"), "seconds": rec.get("seconds"),
    }


def main(names):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    od = HERE / "out"
    od.mkdir(exist_ok=True)
    idx_path = od / "jobs.json"
    rows = {r["name"]: r for r in json.loads(idx_path.read_text())} if idx_path.exists() else {}
    for name in names:
        params = JOBS[name]
        rec, err = None, ""
        for attempt in (1, 2):
            try:
                rec = a.run("comet-qrng-v1", params, timeout=7200)
                break
            except AtlasError as e:
                err = str(e)[:600]
                print(f"  {name} attempt {attempt} failed: {err}")
                if "credit cap" in err or "MOTH_FREEZE" in err:
                    break
        if rec is None:
            rows[name] = {"name": name, "status": "failed", "error": err, **{k: params[k] for k in ("mode", "num_qubits")}}
            continue
        out = dict(rec["response"]["result"]["output"])
        raw = dict(out.pop("raw", {}) or {})
        counts = raw.pop("counts", None) or {}
        raw["n_distinct_counts"] = len(counts)
        out["raw"] = raw
        (od / f"{name}.json").write_text(json.dumps({"job_id": rec["job_id"], "params": params, "output": out}, indent=1))
        rows[name] = summarize(name, params, rec)
        print(f"  {name}: {rec['job_id']} backend={rows[name]['backend']} bytes={rows[name]['bytes']} "
              f"S={rows[name]['S']} accounted={rows[name]['entropy_accounted']} grade={rows[name]['grade']}")
    # re-read before writing so parallel runs (one per QPU) never drop each other's rows
    merged = {r["name"]: r for r in json.loads(idx_path.read_text())} if idx_path.exists() else {}
    merged.update({n: rows[n] for n in names if n in rows})
    idx_path.write_text(json.dumps([merged[n] for n in JOBS if n in merged], indent=1))
    print(f"spent for {PIECE}: {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    main(sys.argv[1:] or list(JOBS))
