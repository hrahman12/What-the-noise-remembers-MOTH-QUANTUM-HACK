"""Free payload probe: will the Atlas API accept a 24-qubit (4096 x 4096) blur-core-v1 request body?

We send the real 4096 x 4096 grid with max_qubits = 25 and style = "z", both of which break the
params schema (max_qubits <= 24, style ~ ^[xy]+$).
A schema 422 means the gateway accepted and parsed the whole body without creating a job (costs
nothing, per the build guide); a 413 or a gateway error means the body itself is too large.
No job is created either way. Result is appended to out/probes.json.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import BASE, Atlas  # noqa: E402

import chirp  # noqa: E402


def probe(n: int):
    P, tt, ff = chirp.spectrogram(n, n)
    G, _ = chirp.quantise(P)
    body = json.dumps({"params": {"values": G.tolist(), "max_qubits": 25, "style": "z", "strength": [0.5, 0.5]}},
                      separators=(",", ":")).encode()
    a = Atlas(piece="10-squeezed-chirp", credit_cap=12)
    h = a._headers()
    h["Content-Type"] = "application/json"
    t0 = time.time()
    try:
        r = requests.post(f"{BASE}/engines/blur-core-v1/process", data=body, headers=h, timeout=600)
        res = {"status": r.status_code, "body": r.text[:600]}
        if r.status_code < 300 and "job_id" in r.text:   # should never happen; ledger it honestly if it does
            jid = r.json()["job_id"]
            with open(HERE.parent.parent / "cache" / "ledger.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps({"piece": a.piece, "engine": "blur-core-v1", "job_id": jid, "credits": 1.0,
                                    "key": "probe", "t": round(time.time())}) + "\n")
    except requests.RequestException as e:
        res = {"status": None, "error": repr(e)[:600]}
    res.update({"grid": [n, n], "qubits": 2 * (n - 1).bit_length(), "body_mb": round(len(body) / 1e6, 2),
                "seconds": round(time.time() - t0, 1), "t": round(time.time())})
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    log = json.loads((out / "probes.json").read_text(encoding="utf-8")) if (out / "probes.json").exists() else []
    log.append(res)
    (out / "probes.json").write_text(json.dumps(log, indent=1), encoding="utf-8")
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    import os
    if os.environ.get("MOTH_FREEZE") == "1":   # frozen replay: show the recorded probe, send nothing
        print((HERE / "out" / "probes.json").read_text(encoding="utf-8"))
    else:
        probe(int(sys.argv[1]) if len(sys.argv) > 1 else 4096)
