"""Pull the two dice banks for Antimatter Drop from comet-qrng-v1 (Atlas).

QUANTUM step. Two jobs, 5 credits each (piece cap 12):
  fez_148p8  qpu on ibm_fez: 148 register + 8 Bell-witness qubits = 156, the whole Heron chip
  emu_20p0   emu on Aer:     20 register qubits, no witness = 20, the emu cap for the whole circuit
             (a 12 + 8 witness emu run returns 0 extractable bytes, see entries/05-jam-the-bat/PARAMS.md)

Both use shots = 10000 (the maximum) and epsilon_log2 = 128 (the strictest extractor setting: the
output is 2^-128-close to uniform under the engine's stated entropy model).

The page uses only the engine's conditioned bytes (`random.hex`) as dice. The physics (the
probability that an atom escapes downwards at each bias) comes from the paper, not from these jobs.

Usage: python run_qrng.py [name ...]   (default: both). Completed jobs are cached under
cache/comet-qrng-v1/, so re-runs are free and offline (MOTH_FREEZE=1 refuses any new submission).
A failed job is retried once; a job that still fails is recorded as failed and never replaced.
Outputs:
  out/<name>.json   the engine's result.output minus the raw counts and the hex (those stay in the cache)
  data/bank_<name>.hex  the conditioned bytes, exactly as returned
  out/jobs.json     one summary row per job
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

PIECE, CAP = "20-antimatter-drop", 12
BASE = {"shots": 10000, "output_bytes": 1000000, "include_raw_counts": True, "epsilon_log2": 128}
JOBS = {
    "fez_148p8": {**BASE, "mode": "qpu", "backend_name": "ibm_fez", "num_qubits": 148, "bell_witness": True},
    "emu_20p0": {**BASE, "mode": "emu", "num_qubits": 20, "bell_witness": False},
}


def summarize(name, params, rec):
    out = rec["response"]["result"]["output"]
    prov, bw = out.get("provenance", {}), out.get("bell_witness") or {}
    cert = out.get("entropy_report") or out.get("certificate") or {}
    circ = prov.get("circuit") or {}
    return {
        "name": name, "job_id": rec["job_id"], "status": "completed", "mode": params["mode"],
        "backend": prov.get("backend"), "provider_job_id": prov.get("provider_job_id"),
        "engine_version": prov.get("engine_version"),
        "register_qubits": circ.get("n_rand"), "total_qubits": circ.get("n_total"),
        "initial_layout_min": min(prov["initial_layout"]) if prov.get("initial_layout") else None,
        "initial_layout_max": max(prov["initial_layout"]) if prov.get("initial_layout") else None,
        "shots": params["shots"], "epsilon_log2": params["epsilon_log2"],
        "bytes": out.get("random", {}).get("bytes"), "raw_bits": cert.get("raw_bits"),
        "h_bit": cert.get("h_bit"), "budget_bits": cert.get("budget_bits"),
        "accounting_basis": cert.get("accounting_basis"), "grade": cert.get("grade"),
        "entropy_accounted": cert.get("entropy_accounted", cert.get("certified")),
        "health_passed": cert.get("health_passed"),
        "S": bw.get("S"), "sigma_S": bw.get("sigma_S"),
        "violates_classical_3sigma": bw.get("violates_classical_3sigma"),
        "collected_at": prov.get("collected_at"), "qpu_seconds": prov.get("qpu_seconds"),
        "seconds": rec.get("seconds"),
    }


def main(names):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    od, dd = HERE / "out", HERE / "data"
    od.mkdir(exist_ok=True)
    dd.mkdir(exist_ok=True)
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
            rows[name] = {"name": name, "status": "failed", "error": err,
                          **{k: params[k] for k in ("mode", "num_qubits")}}
            continue
        out = dict(rec["response"]["result"]["output"])
        rnd = dict(out.pop("random", {}) or {})
        hexstr = rnd.pop("hex", "") or ""
        (dd / f"bank_{name}.hex").write_text(hexstr, encoding="ascii")
        out["random"] = rnd
        raw = dict(out.pop("raw", {}) or {})
        counts = raw.pop("counts", None) or {}
        raw["n_distinct_counts"] = len(counts)
        out["raw"] = raw
        (od / f"{name}.json").write_text(json.dumps({"job_id": rec["job_id"], "params": params, "output": out},
                                                    indent=1), encoding="utf-8")
        rows[name] = summarize(name, params, rec)
        r = rows[name]
        print(f"  {name}: {rec['job_id']} backend={r['backend']} qubits={r['total_qubits']} bytes={r['bytes']} "
              f"S={r['S']} grade={r['grade']}")
    merged = {r["name"]: r for r in json.loads(idx_path.read_text())} if idx_path.exists() else {}
    merged.update({n: rows[n] for n in names if n in rows})
    idx_path.write_text(json.dumps([merged[n] for n in JOBS if n in merged], indent=1), encoding="utf-8")
    print(f"spent for {PIECE}: {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    main(sys.argv[1:] or list(JOBS))
