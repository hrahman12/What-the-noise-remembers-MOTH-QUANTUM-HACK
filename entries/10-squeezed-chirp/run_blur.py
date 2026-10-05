"""Squeezed Chirp: run blur-core-v1 on the GW150914 spectrogram grid. QUANTUM CIRCUIT, run on
Atlas's classical statevector simulator (blur-core-v1 has no QPU mode).

Grid: 257 (time) x 257 (frequency) integers 0..999. The engine pads each axis to the next power of
two (512), so every job runs on a 9 + 9 = 18-qubit register (25% of the 2^18 grid points carry data;
the rest is zero padding, the same practice as entry 01's 541 px hole on a 1024 register).
Why not 24, 22 or 20 (all measured, see out/probes.json and README):
  * the API rejects request bodies over 1 MiB (HTTP 413, limit=1048576 bytes): a 4096 x 4096
    grid (24 q) is 48 MB, 2048 x 2048 (22 q) 12 MB; a 640 x 640 grid (20 q) fits at 0.89 MiB, but
  * the engine's result has to fit Atlas's internal 2 MB payload limit: two 640 x 640 jobs
    computed the "20-qubit grid" and then failed with TMPRL1103 ("payloads ... exceeded the error
    limit"), because ~410k floats come back as ~8 MB of JSON. 257 x 257 returns ~1.4 MB.

Jobs (6, one credit each): per-axis strength [s_time, s_freq] on the constant-product curve
s_time * s_freq = 0.25 at five squeeze ratios r = s_time / s_freq in {1/4, 1/2, 1, 2, 4}, plus an
isotropic control that passes a single scalar strength 0.5 (the engine's own isotropic path).
reach = 0 (local), style = "x" (Rx), exact probabilities (no shots).

Every job is cached in cache/blur-core-v1/ (re-runs are free, MOTH_FREEZE=1-safe). A failed job is
retried once and never replaced by anything else. Outputs: out/<name>.npy, out/jobs.json.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import BASE, Atlas, AtlasError  # noqa: E402

import chirp  # noqa: E402

PIECE, CAP = "10-squeezed-chirp", 12
N_T = N_F = 257
QMAX = 999
PRODUCT = 0.25
RATIOS = [0.25, 0.5, 1.0, 2.0, 4.0]
OUT = HERE / "out"


class SafeAtlas(Atlas):
    """Atlas client whose job-submission POST is attempted exactly once. The stock client retries
    5xx/timeouts, which for a paid submission could create duplicate jobs that never reach the
    ledger. Every other request (status, result polling) keeps the normal retries."""

    def _req(self, method, path, ok=(), **kw):
        if method == "POST" and path.endswith("/process"):
            # compact JSON (no spaces): the API caps bodies at 1 MiB and the stock `json=` adds ~1 byte/value
            body = json.dumps(kw.pop("json"), separators=(",", ":")).encode()
            headers = {**self._headers(), "Content-Type": "application/json"}
            r = requests.request(method, BASE + path, headers=headers, data=body, timeout=600, **kw)
            if r.status_code >= 400:
                raise AtlasError(f"{method} {path} -> {r.status_code}: {r.text[:1200]}")
            return r
        return super()._req(method, path, ok, **kw)


def strengths(r, product=PRODUCT):
    return [round(float(np.sqrt(product * r)), 4), round(float(np.sqrt(product / r)), 4)]


def job_plan():
    plan = [{"name": "iso_control", "label": "isotropic control (scalar strength)", "ratio": 1.0,
             "strength": round(float(np.sqrt(PRODUCT)), 4)}]
    for r in RATIOS:
        tag = f"r{r:g}".replace(".", "p")
        plan.append({"name": tag, "label": f"s_time/s_freq = {r:g}", "ratio": r, "strength": strengths(r)})
    return plan


def build_grid():
    P, tt, ff = chirp.spectrogram(N_T, N_F)
    G, top = chirp.quantise(P, QMAX)
    return G, tt, ff, top


def params_for(G, job):
    return {"values": G.tolist(), "strength": job["strength"], "reach": 0, "style": "x", "max_qubits": 24}


def unpack(result):
    """blur-core-v1 returns the grid as a nested list (possibly wrapped in a dict)."""
    if isinstance(result, dict):
        for k in ("values", "result", "grid", "output"):
            if k in result:
                return np.asarray(result[k], dtype=np.float64), {x: y for x, y in result.items() if x != k}
        raise AtlasError(f"unexpected result keys {list(result)}")
    return np.asarray(result, dtype=np.float64), {}


def run(only=None):
    OUT.mkdir(exist_ok=True)
    G, tt, ff, top = build_grid()
    np.save(OUT / "grid_input.npy", G.astype(np.int16))
    (OUT / "axes.json").write_text(json.dumps({"t_s": tt.tolist(), "f_hz": ff.tolist(), "qmax": QMAX,
                                              "power_top": top}), encoding="utf-8")
    a = SafeAtlas(piece=PIECE, credit_cap=CAP)
    rows = []
    for job in job_plan():
        if only and job["name"] not in only:
            continue
        params = params_for(G, job)
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("blur-core-v1", params, timeout=1800)
                break
            except AtlasError as e:
                print(f"  {job['name']} attempt {attempt} failed: {str(e)[:300]}")
                if "MOTH_FREEZE" in str(e) or "credit cap" in str(e):
                    break
        if rec is None:
            rows.append({**job, "job_id": "", "status": "failed"})
            continue
        A, meta = unpack(rec["response"]["result"])
        assert A.shape == G.shape, (A.shape, G.shape)
        np.save(OUT / f"{job['name']}.npy", A.astype(np.float32))
        rows.append({**job, "job_id": rec["job_id"], "status": "completed", "seconds": rec.get("seconds"),
                     "qubits": int(np.ceil(np.log2(N_T)) + np.ceil(np.log2(N_F))), "engine_meta": meta,
                     "grid": [N_T, N_F], "reach": 0, "style": "x", "max_qubits": 24})
        print(f"  {job['name']:12s} {rec['job_id']}  {rec.get('seconds')} s")
    if not only:
        (OUT / "jobs.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"{sum(r['status'] == 'completed' for r in rows)}/{len(rows)} jobs completed; "
          f"ledgered spend for {PIECE}: {a.spent():g} of {CAP} credits")
    return rows


if __name__ == "__main__":
    run(only=set(sys.argv[1:]) or None)
