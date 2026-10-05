"""Encode the four flavour curves with qpixl-v1 and measure them back. QUANTUM (Atlas qpixl-v1).

One job per machine: aer (noiseless simulator), the 12 fake_* IBM noise models (emulators), and
one real IBM run on ibm_fez (mode=qpu). Each job gets 4 curves x n points, concatenated
[P2(mu->e) | P3(mu->e) | P3(mu->mu) | P3(mu->tau)], each curve divided by its own maximum so it
spans the full [0, 1] range the encoding uses. The decoded output is multiplied back by that
maximum. Nothing else is done to the measured numbers (dynamic_range = "none").

n per machine is the largest that machine accepted (see PLAN and PARAMS.md). Jobs are cached in
cache/qpixl-v1/, so re-runs are free; MOTH_FREEZE=1 refuses anything not cached.

    python run_qpixl.py                 # run / replay the whole plan
    python run_qpixl.py aer 1024        # one machine at n points per curve (used for probing)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

import physics  # noqa: E402

SLUG, CAP = "07-flavour", 45
SHOTS = 8192
FAKES = ["fake_fez", "fake_marrakesh", "fake_torino", "fake_brisbane", "fake_kyiv", "fake_sherbrooke",
         "fake_kyoto", "fake_osaka", "fake_quebec", "fake_cusco", "fake_strasbourg", "fake_brussels"]
QPU = "ibm_fez"
# Data-qubit capacity (values) each machine reported when probed with 4096 values, and the points
# per curve we send = floor(capacity / 4). aer took all 4096. Capacities not probed directly are
# assumed equal to a chip of the same family; a failure would report the true one (see PARAMS.md).
CAPACITY = {"aer": 4096, "fake_fez": 448, "fake_torino": 378, "fake_brisbane": 360}
FAMILY = {"fake_marrakesh": "fake_fez", "ibm_fez": "fake_fez",
          **{m: "fake_brisbane" for m in ["fake_kyiv", "fake_sherbrooke", "fake_kyoto", "fake_osaka",
                                          "fake_quebec", "fake_cusco", "fake_strasbourg", "fake_brussels"]}}
PLAN = {m: CAPACITY[FAMILY.get(m, m)] // 4 for m in ["aer"] + FAKES + [QPU]}


def payload(n):
    le, P = physics.curves(n)
    scale = P.max(axis=1)
    vals = (P / scale[:, None]).round(6)
    return le, P, scale, vals.reshape(-1).tolist()


def params_for(machine, vals):
    if machine == QPU:
        return {"values": vals, "mode": "qpu", "backend_name": QPU, "shots": SHOTS}
    return {"values": vals, "mode": "emu", "machine": machine, "shots": SHOTS}


def run_one(a, machine, n):
    le, P, scale, vals = payload(n)
    rec = a.run("qpixl-v1", params_for(machine, vals), timeout=3600 if machine == QPU else 1800)
    res = rec["response"]["result"]
    raw = np.array(res["output"], dtype=float)
    assert raw.size == 4 * n, f"{machine}: got {raw.size} values back, sent {4 * n}"
    meas = raw.reshape(4, n) * scale[:, None]
    out = {"machine": machine, "kind": "qpu" if machine == QPU else ("sim" if machine == "aer" else "emu"),
           "backend": res.get("backend"), "job_id": rec["job_id"], "ibm_job_id": res.get("ibm_job_id"),
           "qpu_seconds": res.get("qpu_seconds"), "seconds": rec.get("seconds"), "n": n, "shots": SHOTS,
           "values_sent": 4 * n, "curves": physics.CURVES, "scale": scale.round(6).tolist(),
           "le": le.round(4).tolist(), "exact": P.round(6).tolist(), "measured": meas.round(6).tolist(),
           "rms_error": float(np.sqrt(np.mean((meas - P) ** 2)))}
    (HERE / "out" / f"qpixl_{machine}.json").write_text(json.dumps(out), encoding="utf-8")
    print(f"  {machine:16s} n={n:5d}  job {rec['job_id']}  backend {out['backend']}  rms {out['rms_error']:.4f}")
    return out


def main():
    a = Atlas(piece=SLUG, credit_cap=CAP)
    if len(sys.argv) == 3:
        try:
            run_one(a, sys.argv[1], int(sys.argv[2]))
        except AtlasError as e:
            print("FAILED:", str(e)[:1500])
        print(f"spent {a.spent():g} / {CAP}")
        return
    streak, missing = 0, []
    for machine, n in PLAN.items():   # strictly one job at a time: parallel submissions overloaded the backend
        ok = False
        for attempt in (1, 2):
            try:
                run_one(a, machine, n)
                ok, streak = True, 0
                break
            except AtlasError as e:
                streak += 1
                print(f"  {machine} attempt {attempt} failed: {str(e)[:300]}")
                if streak >= 3 or "MOTH_FREEZE" in str(e) or "credit cap" in str(e):
                    break
        if not ok:
            missing.append(machine)
        if streak >= 3:
            print("  three failures in a row: stopping to protect the credit cap")
            missing += [m for m in PLAN if m not in missing and not (HERE / "out" / f"qpixl_{m}.json").exists()]
            break
    print(f"missing: {missing or 'none'}")
    print(f"spent {a.spent():g} / {CAP}")


if __name__ == "__main__":
    main()
