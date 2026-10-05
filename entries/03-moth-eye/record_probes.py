"""Record the qubit-budget probes for entanglement-shader-v1 (out/probes.json).

The engine's 21-qubit check runs when the job starts, not at submission, so every probe was a real,
ledgered job (1 credit each). Four failed with max_qubits_exceeded; their messages state the largest
allowed incoming_rays for that layer count. The 6-layer, 6-ray probe completed and is reused as the
top of the sweep. This script re-reads each probe's server-side status record (GET only, no new jobs)
and saves it verbatim; under MOTH_FREEZE=1 or without network it keeps the saved file.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

# Submitted in this order on 2026-10-05 (UTC); params as sent (other params at engine defaults).
PROBES = [
    ("8285e98e-5ae7-4974-9898-696bb3ae2d14", 21, 30),
    ("aff508a9-2282-4f91-9328-4c9a413650a6", 8, 10),
    ("ea36ca02-1062-4d7c-92d1-025405e9824c", 7, 30),
    ("0dfd9339-f7f8-4fde-9b06-f3b5624bf888", 6, 6),
    ("b0ec46ef-00d6-4c06-84c6-589d9432fd14", 6, 7),
]


def main():
    path = HERE / "out" / "probes.json"
    if os.environ.get("MOTH_FREEZE") == "1" and path.exists():
        print("MOTH_FREEZE=1: keeping saved out/probes.json")
        return
    a = Atlas(piece="03-moth-eye", credit_cap=12)
    rows = []
    try:
        for job_id, layers, rays in PROBES:
            st = a.get(f"/jobs/{job_id}/status")
            err = (st.get("error") or {})
            m = re.search(r"incoming_rays must be at most (-?\d+)", err.get("message", ""))
            rows.append({"job_id": job_id, "layers": layers, "incoming_rays": rays, "status": st.get("status"),
                         "error_type": err.get("type"), "message": err.get("message"),
                         "max_rays_reported": int(m.group(1)) if m else None,
                         "submitted_at": st.get("submitted_at")})
            print(f"  L={layers:>2} R={rays:>2}  {st.get('status'):>9}  {err.get('message', '')}")
    except (AtlasError, OSError) as e:
        if path.exists():
            print(f"offline ({str(e)[:80]}): keeping saved out/probes.json")
            return
        raise
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"{len(rows)} probes -> out/probes.json")


if __name__ == "__main__":
    main()
