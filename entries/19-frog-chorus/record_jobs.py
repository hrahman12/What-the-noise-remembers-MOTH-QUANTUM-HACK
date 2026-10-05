"""Audit every ledgered job of this piece: name, final status, Atlas's own error message. No credits used.

Reads cache/ledger.jsonl, maps each ledger cache key back to a PLAN entry of run_qdrive.py (qdrive-api-v1) or
run_graph_fez.py (graph-v1) by recomputing the client's job hash, and asks Atlas for the job's status (read-only GET). Writes out/jobs.json, which
make_docs.py turns into PARAMS.md and piece.json. With MOTH_FREEZE=1 it keeps the existing file.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import Atlas, _hash  # noqa: E402

import run_graph_fez as G  # noqa: E402
import run_qdrive as R  # noqa: E402

PIECE = "19-frog-chorus"


def main():
    out = HERE / "out" / "jobs.json"
    if os.environ.get("MOTH_FREEZE") == "1":
        print("MOTH_FREEZE=1: keeping", out.name)
        return
    a = Atlas(piece=PIECE, credit_cap=R.CAP)
    keys = {}
    for name, fn in R.PLAN.items():
        try:
            params, files = fn()
        except KeyError:
            continue
        keys[_hash({"e": "qdrive-api-v1", "p": params, "f": files})] = (name, params)
    for name, fn in G.PLAN.items():
        params = fn()
        keys[_hash({"e": G.ENGINE, "p": params, "f": {}})] = (name, {
            "n_qubits": params["num_qubits"],
            "machine": params["backend_name"] if params["mode"] == "qpu" else "emu (Aer)"})
    led = [json.loads(x) for x in (ROOT / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    rows = []
    for e in led:
        if e.get("piece") != PIECE:
            continue
        name, params = keys.get(e.get("key"), ("?", {}))
        s = a.get(f"/jobs/{e['job_id']}/status")
        err = s.get("error") or {}
        rows.append({"name": name, "job_id": e["job_id"], "engine": e["engine"], "credits": e["credits"],
                     "status": s.get("status"), "n_qubits": params.get("n_qubits"), "machine": params.get("machine"),
                     "error": f"{err.get('type', '')}: {err.get('message', '')}".strip(": "),
                     "submitted_at": s.get("submitted_at"), "updated_at": s.get("updated_at")})
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    for r in rows:
        print(f"  {r['name']:16s} {r['job_id']}  {r['status']:10s} {r['error'][:90]}")
    print(f"{len(rows)} ledgered jobs, {sum(r['credits'] for r in rows):g} credits; a.spent() = {a.spent():g}")


if __name__ == "__main__":
    main()
