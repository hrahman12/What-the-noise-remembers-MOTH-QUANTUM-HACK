"""Oldest Light: blur the WMAP ILC sky window with Atlas blur-core-v1 at several strengths.
QUANTUM CIRCUIT, run on Atlas's classical statevector simulator (blur-core-v1 has no QPU mode).

Each job amplitude-encodes the integer temperature grid (out/grid_input.npy or out/grid_wide.npy,
from make_patch.py) on a Gray-coded register, applies one Rx rotation per qubit (style "x",
reach 0 = local) and reads exact probabilities back (no shots). Qubits = sum over axes of
ceil(log2 axis length): 257 x 257 -> 9 + 9 = 18; 257 x 513 -> 9 + 10 = 19. The engine also reports
it ("Recovered N-qubit grid from measurement"), which is saved in out/job_status.json.

Usage: python run_blur.py [name ...] [--retry-failed]   (no names = the whole PLAN, in order)
A job already recorded as failed in out/jobs.json is NOT resubmitted unless --retry-failed is given
(the 19-qubit attempt failed on the platform's result-size limit; resubmitting would cost a credit).
Every job is cached in cache/blur-core-v1/ (re-runs are free and MOTH_FREEZE=1-safe). A job is
submitted at most once per call (no blind retries: failed jobs are ledgered and cost credits);
a failure is recorded in out/jobs.json and never replaced by anything else.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import BASE, Atlas, AtlasError  # noqa: E402

PIECE, CAP = "18-oldest-light", 8
OUT = HERE / "out"
GRIDS = {"sq": "grid_input.npy", "wide": "grid_wide.npy"}
BASE_PARAMS = {"reach": 0, "style": "x", "max_qubits": 24}

# Order matters: the 19-qubit attempt goes first (step down from the infeasible 20+ qubits).
PLAN = [
    {"name": "wide_s0.5", "grid": "wide", "strength": 0.5},
    {"name": "sq_s0.25", "grid": "sq", "strength": 0.25},
    {"name": "sq_s0.5", "grid": "sq", "strength": 0.5},
    {"name": "sq_s1", "grid": "sq", "strength": 1.0},
    # added after looking at the first three: fill the gaps at the gentle and the heavy end
    {"name": "sq_s0.1", "grid": "sq", "strength": 0.1},
    {"name": "sq_s0.375", "grid": "sq", "strength": 0.375},
    {"name": "sq_s0.75", "grid": "sq", "strength": 0.75},
]


class SafeAtlas(Atlas):
    """Job-submission POST is attempted exactly once (the stock client retries 5xx/timeouts, which
    for a paid submission could create duplicate jobs) and sent as compact JSON (the API caps
    bodies at 1 MiB). Status/result polling keeps the normal retries. Params, and therefore the
    cache key, are unchanged."""

    def _req(self, method, path, ok=(), **kw):
        if method == "POST" and path.endswith("/process"):
            body = json.dumps(kw.pop("json"), separators=(",", ":")).encode()
            headers = {**self._headers(), "Content-Type": "application/json"}
            r = requests.request(method, BASE + path, headers=headers, data=body, timeout=600, **kw)
            if r.status_code >= 400:
                raise AtlasError(f"{method} {path} -> {r.status_code}: {r.text[:1200]}")
            return r
        return super()._req(method, path, ok, **kw)


def qubits_for(shape):
    return int(sum(int(np.ceil(np.log2(d))) for d in shape if d > 1))


def unpack(result):
    if isinstance(result, dict) and "output" in result:
        result = result["output"]
    return np.asarray(result, dtype=np.float64)


def load_json(p, default):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def job_status(a, job_id, cache):
    """Engine-reported status (incl. 'Recovered N-qubit grid'); cached so MOTH_FREEZE runs stay offline."""
    if job_id in cache:
        return cache[job_id]
    if __import__("os").environ.get("MOTH_FREEZE") == "1":
        return None
    try:
        st = a.get(f"/jobs/{job_id}/status")
    except AtlasError as e:
        return {"error": str(e)[:300]}
    cache[job_id] = {k: st.get(k) for k in ("status", "progress", "error", "submitted_at", "updated_at")}
    return cache[job_id]


def run(names=None):
    OUT.mkdir(exist_ok=True)
    a = SafeAtlas(piece=PIECE, credit_cap=CAP)
    jobs_path, st_path = OUT / "jobs.json", OUT / "job_status.json"
    rows = {r["name"]: r for r in load_json(jobs_path, [])}
    stc = load_json(st_path, {})
    for job in PLAN:
        if names and job["name"] not in names:
            continue
        if rows.get(job["name"], {}).get("status") == "failed" and not RETRY_FAILED:
            print(f"  {job['name']}: recorded as failed ({rows[job['name']]['job_id']}); not resubmitted")
            continue
        G = np.load(OUT / GRIDS[job["grid"]])
        params = {"values": G.astype(int).tolist(), "strength": job["strength"], **BASE_PARAMS}
        q = qubits_for(G.shape)
        row = {**job, "shape": list(G.shape), "qubits": q, **BASE_PARAMS}
        try:
            rec = a.run("blur-core-v1", params, timeout=1800)
        except AtlasError as e:
            msg = str(e)
            m = re.search(r"blur-core-v1 ([0-9a-f-]{36}) failed", msg)
            if m:   # a real, ledgered failure: keep its record and the engine's error
                row.update(status="failed", job_id=m.group(1), error=msg[:600])
                row["engine_status"] = job_status(a, m.group(1), stc)
                rows[job["name"]] = row
            elif job["name"] not in rows or rows[job["name"]].get("status") != "failed":
                print(f"  {job['name']}: not run ({msg[:200]})")
            print(f"  {job['name']}: FAILED {msg[:300]}")
            continue
        A = unpack(rec["response"]["result"])
        assert A.shape == G.shape, (A.shape, G.shape)
        np.save(OUT / f"{job['name']}.npy", A.astype(np.float32))
        row.update(status="completed", job_id=rec["job_id"], seconds=rec.get("seconds"),
                   out_min=float(A.min()), out_max=float(A.max()), out_mean=float(A.mean()))
        row["engine_status"] = job_status(a, rec["job_id"], stc)
        rows[job["name"]] = row
        det = ((row["engine_status"] or {}).get("progress") or {}).get("detail", "")
        print(f"  {job['name']:10s} {rec['job_id']}  {q} qubits  {rec.get('seconds')} s  [{det}]")
    order = [j["name"] for j in PLAN]
    out_rows = [rows[n] for n in order if n in rows]
    jobs_path.write_text(json.dumps(out_rows, indent=1), encoding="utf-8")
    st_path.write_text(json.dumps(stc, indent=1), encoding="utf-8")
    done = sum(r["status"] == "completed" for r in out_rows)
    print(f"{done}/{len(out_rows)} jobs completed; ledgered spend for {PIECE}: {a.spent():g} of {CAP} credits")
    return out_rows


RETRY_FAILED = "--retry-failed" in sys.argv

if __name__ == "__main__":
    run({a for a in sys.argv[1:] if not a.startswith("--")} or None)
