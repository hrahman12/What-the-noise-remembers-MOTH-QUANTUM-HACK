"""Quantum-blur the Lenia kernel bank with Atlas blur-core-v1. QUANTUM (Atlas classical statevector simulator).

The bank is 4 kernel shells (lenia.SHAPES), each on the full 256 x 256 world grid that the browser's FFT
convolution uses, stacked into one [4, 256, 256] grid: 2 + 8 + 8 = 18 qubits. `axes = [1, 2]` blurs only
the two spatial axes, so the four kernels never mix. One job per setting in JOBS. Every job is cached in
cache/blur-core-v1/ (re-runs are free and work offline). Outputs -> out/kernels/*.npy + out/kernel_jobs.csv.
"""
from __future__ import annotations

import csv
import sys

import numpy as np

import lenia as L
from qblur import HERE, AtlasError, blur, body_bytes, qubits_for

N = 256
# (strength, reach) per job; style "x" (Rx on every qubit), the engine default.
JOBS = [(0.5, 0.0), (0.25, 0.0), (1.0, 0.0)]
# reach = 1 was tried twice (strength 0.5) and failed both times after the simulation finished: a fully
# non-local blur makes all 262,144 outputs non-zero floats, over the platform's result-payload limit
# ("[TMPRL1103] Attempted to upload payloads with size that exceeded the error limit."). Both are ledgered.
FAILED = [{"strength": 0.5, "reach": 1.0, "job_id": "95f0b491-2f30-4575-b890-2f3b70c7881b", "status": "failed: TMPRL1103 payload"},
          {"strength": 0.5, "reach": 1.0, "job_id": "0c641ba0-11e4-4af0-ab62-abe905dda3e5", "status": "failed: TMPRL1103 payload"}]


def bank() -> np.ndarray:
    return np.round(np.stack([L.kernel_world(N, s) for s in L.SHAPES]), 5)


def as_list(a: np.ndarray):
    """Nested list with exact zeros as int 0 (shorter JSON)."""
    return [[[0 if v == 0 else float(v) for v in row] for row in sl] for sl in a]


def main(only=None):
    out = HERE / "out" / "kernels"
    out.mkdir(parents=True, exist_ok=True)
    K = bank()
    np.save(out / "bank_input.npy", K.astype(np.float32))
    vals = as_list(K)
    q = qubits_for(K.shape)
    rows = []
    for s, r in JOBS if only is None else JOBS[:only]:
        params = {"strength": s, "reach": r, "style": "x", "axes": [1, 2], "max_qubits": 24}
        print(f"kernel bank s={s} reach={r}: {body_bytes({'values': vals, **params}):,} bytes, {q} qubits")
        res = rec = None
        for attempt in (1, 2):
            try:
                res, rec = blur(vals, **params)
                break
            except AtlasError as e:
                print(f"  attempt {attempt} failed: {str(e)[:300]}")
        if rec is None:
            rows.append({"strength": s, "reach": r, "job_id": "", "status": "failed", "file": ""})
            continue
        arr = np.asarray(res, dtype=np.float64)
        assert arr.shape == K.shape, arr.shape
        name = f"k_s{s}_r{r}.npy"
        np.save(out / name, arr.astype(np.float32))
        rows.append({"strength": s, "reach": r, "job_id": rec["job_id"], "status": "completed", "file": name,
                     "qubits": q, "seconds": rec.get("seconds", "")})
        print(f"  {rec['job_id']}  max {arr.max():.4g}  sum/slice {np.round(arr.sum(axis=(1, 2)), 3)}")
    with open(HERE / "out" / "kernel_jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["strength", "reach", "job_id", "status", "file", "qubits", "seconds"])
        w.writeheader()
        w.writerows(rows + ([] if only else FAILED))
    print(f"{sum(r['status'] == 'completed' for r in rows)}/{len(rows)} kernel jobs completed (+{len(FAILED)} documented failures)")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else None)
