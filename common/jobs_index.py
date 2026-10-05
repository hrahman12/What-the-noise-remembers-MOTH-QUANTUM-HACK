"""Write cache/jobs_index.json: one row per cached Atlas job, small enough to commit.

python common/jobs_index.py

The full job outputs (cache/<engine>/<key>.json) stay local because they run to ~100 MB. This index keeps
the proof: engine, Atlas job id, the piece that ran it (from cache/ledger.jsonl), qubits, mode and the
backend the job targeted and reported, so every number on the pages can be traced to a job.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"

ledger = {}
for line in (CACHE / "ledger.jsonl").read_text(encoding="utf-8").splitlines():
    try:
        e = json.loads(line)
    except json.JSONDecodeError:
        continue
    ledger[e.get("key")] = e

QUBIT_KEYS = ("num_qubits", "n_qubits", "n_sites", "n_logical", "qubits")
BACKEND_RE = re.compile(r'"(?:backend_name|backend|machine|device)"\s*:\s*"([^"]+)"')

rows = []
for f in sorted(CACHE.glob("*/*.json")):
    if f.parent.name in ("files", "pending", "publish") or f.parent.name.startswith("archive"):
        continue
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        continue
    if not isinstance(d, dict) or "engine" not in d:
        continue
    p = d.get("params") or {}
    resp = d.get("response") or {}
    reported = sorted(set(BACKEND_RE.findall(json.dumps(resp))))
    key = f.stem
    rows.append({
        "engine": d.get("engine"),
        "job_id": d.get("job_id") or resp.get("job_id") or resp.get("id"),
        "piece": (ledger.get(key) or {}).get("piece"),
        "credits": (ledger.get(key) or {}).get("credits"),
        "qubits": next((p[k] for k in QUBIT_KEYS if isinstance(p.get(k), (int, float))), None),
        "mode": p.get("mode"),
        "target": p.get("backend_name") or p.get("machine"),
        "reported_backends": reported,
        "status": resp.get("status"),
        "seconds": d.get("seconds"),
        "key": key,
    })

out = CACHE / "jobs_index.json"
out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
hw = [r for r in rows if any(b.startswith("ibm_") for b in r["reported_backends"]) or str(r["target"]).startswith("ibm_")]
print(f"wrote {out} ({len(rows)} jobs, {len(hw)} targeting or reporting IBM hardware, {out.stat().st_size / 1e3:.0f} kB)")
