"""Blur the chirp MIDI with Atlas blur-midi-v1. QUANTUM CIRCUIT, run on Atlas's simulator (no QPU mode).

Planned sweep (9 jobs, 1 credit each, cap 10):
  GW150914: strength {0.5, 1.0} x reach {0, 0.5, 1}
  GW170817: strength {0.5}      x reach {0, 0.5, 1}
Fixed: qubits=20 (the engine's maximum budget per blur pass), resolution=2 ticks per piano-roll step
(chosen so each track's roll is ~42-47 pitch rows x ~11k steps = 6 + 14 = 20 qubits in one pass),
threshold and margin at their defaults (0.1, 0.15).

What actually happened (see README): the first job completed; I then launched the rest in parallel
and, by mistake, twice. The engine answered "did not respond in time" for 9 submissions, the
ledger reached 11 credits (over the cap by 1), and the client now refuses anything new.
This script is therefore SEQUENTIAL ONLY: it replays cached jobs for free, never submits once the
cap is reached, and writes out/jobs.csv with every ledgered job ID, including the failed ones.

Every completed job is cached under cache/blur-midi-v1/; outputs are copied to midi/blurred/.
"""
from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import CACHE, Atlas, AtlasError, _hash  # noqa: E402

PIECE, CAP = "12-chirp-instrument", 10
FIXED = {"qubits": 20, "resolution": 2}
PLAN = ([("GW150914", s, r) for s in (0.5, 1.0) for r in (0.0, 0.5, 1.0)] +
        [("GW170817", 0.5, r) for r in (0.0, 0.5, 1.0)])


def ledger_by_key():
    out = {}
    for line in (CACHE / "ledger.jsonl").read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("piece") == PIECE:
            out.setdefault(e["key"], []).append(e["job_id"])
    return out


def main():
    a = Atlas(piece=PIECE, credit_cap=CAP)
    out = HERE / "midi" / "blurred"
    out.mkdir(parents=True, exist_ok=True)
    assets = json.loads((CACHE / "assets.json").read_text(encoding="utf-8"))
    led = ledger_by_key()
    rows = []
    for ev, s, r in PLAN:
        params = {**FIXED, "strength": s, "reach": r}
        src_mid = HERE / "midi" / f"{ev}_chirp.mid"
        # cache key exactly as atlas.client computes it (asset id from the shared upload index)
        import hashlib
        aid = assets.get(hashlib.sha256(src_mid.read_bytes()).hexdigest(), {}).get("asset_id")
        key = _hash({"e": "blur-midi-v1", "p": params, "f": {"midi": aid}}) if aid else None
        tried = led.get(key, [])
        rec, note = None, ""
        try:
            rec = a.run("blur-midi-v1", params, files={"midi": src_mid})
        except AtlasError as e:
            note = str(e)[:160]
            print(f"  {ev} s{s} r{r}: not completed ({note})")
        row = {"event": ev, "strength": s, "reach": r, "qubits": 20, "resolution": 2,
               "job_id": "", "status": "not completed", "file": "", "seconds": "",
               "failed_job_ids": " ".join(j for j in tried if not rec or j != rec["job_id"]), "note": note}
        if rec is not None:
            src = a.outputs(rec)["result"]
            name = f"{ev}_s{s}_r{r}.mid"
            shutil.copyfile(src, out / name)
            row.update(job_id=rec["job_id"], status="completed", file=f"midi/blurred/{name}",
                       seconds=rec["seconds"], note="")
            print(f"  {name}  {rec['job_id']}")
        rows.append(row)
    with open(HERE / "out" / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} planned jobs completed; ledgered spend for {PIECE}: {a.spent():g} (cap {CAP})")


if __name__ == "__main__":
    main()
