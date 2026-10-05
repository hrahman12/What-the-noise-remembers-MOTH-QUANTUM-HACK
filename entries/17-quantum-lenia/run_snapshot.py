"""Quantum-blur the 528 x 528 Lenia world snapshot with Atlas blur-core-v1 at several strengths.
QUANTUM (Atlas classical statevector simulator). 528 > 512 per side -> each axis padded to 1024 by the engine
-> 10 + 10 = 20 qubits. reach 0, style "x". Cached in cache/blur-core-v1/ (free, offline re-runs).
Outputs -> out/snapshot/w_s*.npy (float32, engine output exactly as returned) + out/snapshot_jobs.csv.
"""
from __future__ import annotations

import csv
import sys

import numpy as np

from qblur import HERE, AtlasError, blur, body_bytes, qubits_for

STRENGTHS = [0.5, 0.25]   # 2 of 8 credits were left after attempt 1 failed (see README)
# Attempt 1: out/world_attempt1.npy (22 Orbia spread over the whole 528 x 528 world, `make_world.py --attempt1`),
# strength 0.5. Failed after "Recovered 20-qubit grid from measurement" with TMPRL1103 (result payload too large).
FAILED = [{"strength": 0.5, "job_id": "a8a739fb-daa2-4675-99e6-2447c32a179a",
           "status": "failed: TMPRL1103 payload (attempt 1, world_attempt1.npy)", "qubits": 20}]


def main(only=None):
    out = HERE / "out" / "snapshot"
    out.mkdir(parents=True, exist_ok=True)
    Q = np.load(HERE / "out" / "world.npy")
    vals = Q.astype(int).tolist()
    q = qubits_for(Q.shape)
    rows = []
    for s in STRENGTHS if only is None else STRENGTHS[:only]:
        params = {"strength": s, "reach": 0.0, "style": "x", "max_qubits": 24}
        print(f"snapshot s={s}: {body_bytes({'values': vals, **params}):,} bytes, {q} qubits")
        res = rec = None
        try:  # one attempt only: a failed job is ledgered and the budget is 8 credits
            res, rec = blur(vals, **params)
        except AtlasError as e:
            print(f"  failed: {str(e)[:300]}")
        if rec is None:
            rows.append({"strength": s, "job_id": "", "status": "failed", "file": ""})
            continue
        arr = np.asarray(res, dtype=np.float64)
        assert arr.shape == Q.shape, arr.shape
        name = f"w_s{s}.npy"
        np.save(out / name, arr.astype(np.float32))
        rows.append({"strength": s, "job_id": rec["job_id"], "status": "completed", "file": name, "qubits": q,
                     "seconds": rec.get("seconds", ""), "nonzero": int((arr != 0).sum())})
        print(f"  {rec['job_id']}  max {arr.max():.4g}  non-zero {int((arr != 0).sum()):,}")
    with open(HERE / "out" / "snapshot_jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["strength", "job_id", "status", "file", "qubits", "seconds", "nonzero"])
        w.writeheader()
        w.writerows(rows + ([] if only else FAILED))
    print(f"{sum(r['status'] == 'completed' for r in rows)}/{len(rows)} snapshot jobs completed (+{len(FAILED)} documented failure)")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else None)
