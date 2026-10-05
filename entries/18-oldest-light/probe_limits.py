"""FREE probes of blur-core-v1's size limits (no job is created, no credit is spent).

Each probe sends a grid of the given shape filled with 0 (the smallest possible JSON body, two bytes
per value) and an INVALID style "z" (the schema demands ^[xy]+$). Outcomes:
  413  -> the API refuses the request body itself (limit 1,048,576 bytes): this qubit count is
          impossible for ANY grid of that shape.
  422  -> the body was accepted and parsed, then rejected on the schema: no job, no cost.
Results are written to out/probes.json. If a job were ever created it would be ledgered honestly.
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import BASE, CACHE, Atlas  # noqa: E402

SHAPES = [(2049, 2049), (1025, 1025), (1025, 513), (513, 513), (257, 513)]


def qubits(shape):
    return sum(math.ceil(math.log2(d)) for d in shape)


def body_for(shape):
    row = "[" + ",".join(["0"] * shape[1]) + "]"
    vals = "[" + ",".join([row] * shape[0]) + "]"
    return ('{"params":{"values":' + vals + ',"style":"z","max_qubits":24}}').encode()


def main():
    out = HERE / "out" / "probes.json"
    if out.exists() and "--force" not in sys.argv:
        print(out.read_text(encoding="utf-8"))
        return
    a = Atlas(piece="18-oldest-light", credit_cap=8)
    h = {**a._headers(), "Content-Type": "application/json"}
    rows = []
    for shape in SHAPES:
        body = body_for(shape)
        t0 = time.time()
        try:
            for attempt in (1, 2, 3):   # a dropped connection on a huge body is retried; it can never create a job
                try:
                    r = requests.post(f"{BASE}/engines/blur-core-v1/process", data=body, headers=h, timeout=300)
                    break
                except requests.ConnectionError:
                    if attempt == 3:
                        raise
                    time.sleep(3)
            res = {"status": r.status_code, "body": r.text[:400]}
            if r.status_code < 300 and "job_id" in r.text:      # must not happen; ledger it if it does
                with open(CACHE / "ledger.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"piece": a.piece, "engine": "blur-core-v1", "job_id": r.json()["job_id"],
                                        "credits": 1.0, "key": "probe", "t": round(time.time())}) + "\n")
        except requests.RequestException as e:
            res = {"status": None, "error": repr(e)[:400]}
        res.update({"shape": list(shape), "qubits": qubits(shape), "body_bytes": len(body),
                    "seconds": round(time.time() - t0, 1)})
        rows.append(res)
        print(f"{shape} -> {qubits(shape)} qubits, body {len(body):,} B: HTTP {res['status']}")
    out.write_text(json.dumps(rows, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
