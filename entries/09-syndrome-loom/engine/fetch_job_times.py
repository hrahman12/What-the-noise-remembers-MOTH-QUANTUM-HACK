"""Fetch created_at / updated_at for every completed job of this piece from the Atlas API (metadata only,
no new jobs) and store wall times in engine/job_times.json. The client's own 'seconds' undercounts a job
that was resumed after a client-side timeout (the n=256 ladder job), so the page and PARAMS.md use these."""
import json
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent))
from atlas.client import Atlas  # noqa: E402


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")


def main():
    a = Atlas(piece="09-syndrome-loom", credit_cap=5)
    jobs = json.loads((HERE / "jobs.json").read_text(encoding="utf-8"))["jobs"]
    probes = json.loads((HERE / "probe_jobs.json").read_text(encoding="utf-8"))
    ids = [j["job_id"] for j in jobs] + [v["job_id"] for v in probes.values() if "job_id" in v]
    path = HERE / "job_times.json"
    out = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for jid in dict.fromkeys(ids):
        if jid in out:
            continue
        m = a.get(f"/jobs/{jid}")
        out[jid] = {"created_at": m["created_at"], "updated_at": m["updated_at"], "status": m["status"],
                    "wall_seconds": int((ts(m["updated_at"]) - ts(m["created_at"])).total_seconds())}
        print(jid, out[jid]["wall_seconds"], "s")
    path.write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
