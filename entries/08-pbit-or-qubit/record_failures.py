"""Record ledgered graph-v1 jobs of this piece that ended without a result (read-only status calls, no credits).

Writes out/failed.json with the error Atlas reported, so PARAMS.md can list every credit spent.
Jobs still pending are skipped. Offline (MOTH_FREEZE=1) it keeps the existing file.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import Atlas  # noqa: E402

import problems as P  # noqa: E402


def main():
    out = HERE / "out" / "failed.json"
    if os.environ.get("MOTH_FREEZE") == "1":
        print("MOTH_FREEZE=1: keeping", out.name)
        return
    a = Atlas(piece="08-pbit-or-qubit", credit_cap=60)
    done = {j["job_id"] for j in json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))}
    led = [json.loads(x) for x in (ROOT / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    defs = P.graph_defs()
    # map a ledger cache key back to (graph, J, mode) by rebuilding the recipe hashes
    from atlas.client import _hash
    keys = {}
    for name in defs:
        for J in P.JS:
            for mode in ("emu", "qpu"):
                keys[_hash({"e": "graph-v1", "p": P.graph_params(name, J, mode=mode, defs=defs), "f": {}})] = (name, J, mode)
    failed = []
    for e in led:
        if e.get("piece") != "08-pbit-or-qubit" or e["job_id"] in done:
            continue
        s = a.get(f"/jobs/{e['job_id']}/status")
        if s.get("status") not in ("failed", "cancelled", "canceled"):
            continue
        name, J, mode = keys.get(e.get("key"), ("?", None, "?"))
        err = s.get("error") or {}
        failed.append({"job_id": e["job_id"], "graph": name, "J": J, "mode": mode, "status": s.get("status"),
                       "error": f"{err.get('type', '')}: {err.get('message', '')}".strip(": "),
                       "submitted_at": s.get("submitted_at"), "updated_at": s.get("updated_at")})
    out.write_text(json.dumps(failed, indent=1), encoding="utf-8")
    print(f"{len(failed)} failed job(s) recorded in out/failed.json")


if __name__ == "__main__":
    main()
