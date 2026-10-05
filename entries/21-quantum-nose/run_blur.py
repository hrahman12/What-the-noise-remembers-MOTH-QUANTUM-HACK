"""Blur the six vibrational chords with Atlas blur-midi-v1. QUANTUM circuit on Atlas's simulator.

Input: midi/nose_input.mid (make_midi.py): six tracks (3 molecules x normal/deuterated). The engine
turns each track into its own piano roll and blurs it as a height map, so one job blurs all six
chords with the same setting and the H and D versions of a molecule are always treated alike.

Every job: qubits = 20 (the engine's maximum budget per pass) and resolution = 1 tick, so each
track's roll is ~77-111 pitch rows x 6720 time steps = 7 + 13 = 20 qubits in a single pass
(computed from the grid rule; the engine does not report it). threshold, margin, mask: defaults.

Credit cap 10 (1 credit per job); 9 jobs planned, 1 credit kept for a retry. Jobs run ONE AT A TIME (parallel submissions made another
piece's blur-midi jobs time out). Each job is cached in cache/blur-midi-v1/, so re-runs are free and
offline (MOTH_FREEZE=1 refuses anything not cached). A failed job is retried once, never faked.
Outputs: midi/blurred/s<strength>_r<reach>.mid, listed in out/jobs.csv.

usage: python run_blur.py [N]   # run only the first N planned settings (default: all)
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
from atlas.client import CACHE, Atlas, AtlasError  # noqa: E402

PIECE, CAP, ENGINE = "21-quantum-nose", 10, "blur-midi-v1"
FIXED = {"qubits": 20, "resolution": 1}
PLAN = [  # (strength, reach)
    (0.5, 0.0),   # engine-default strength, local mixing: neighbouring bins = line broadening
    (1.0, 0.0),
    (0.5, 1.0),   # non-local: any bin can mix with any other
    (1.0, 1.0),
    (0.25, 0.0),
    (0.25, 1.0),
    (0.5, 0.5),   # added after the first six: the halfway reach, to hear the smear turn into a scatter
    (1.0, 0.5),
    (0.25, 0.5),
]


def ledger_ids():
    ids = []
    led = CACHE / "ledger.jsonl"
    for line in led.read_text(encoding="utf-8").splitlines() if led.exists() else []:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("piece") == PIECE:
            ids.append(e["job_id"])
    return ids


def main(n=None):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    out = HERE / "midi" / "blurred"
    out.mkdir(parents=True, exist_ok=True)
    rows, used = [], set()
    for strength, reach in PLAN[:n]:
        params = {**FIXED, "strength": strength, "reach": reach}
        rec, note = None, ""
        for attempt in (1, 2):
            try:
                rec = a.run(ENGINE, params, files={"midi": HERE / "midi" / "nose_input.mid"}, timeout=3600)
                break
            except AtlasError as e:
                note = str(e)[:300]
                print(f"  {params} attempt {attempt} failed: {note}")
                if "credit cap" in note or "FREEZE" in note:
                    break
        row = {"strength": strength, "reach": reach, "qubits": 20, "resolution": 1, "job_id": "",
               "status": "not completed", "file": "", "seconds": "", "note": note}
        if rec is not None:
            src = a.outputs(rec)["result"]
            name = f"s{strength:g}_r{reach:g}.mid"
            shutil.copyfile(src, out / name)
            used.add(rec["job_id"])
            row.update(job_id=rec["job_id"], status="completed", file=f"midi/blurred/{name}",
                       seconds=rec["seconds"], note="")
            print(f"  {name}  {rec['job_id']}  ({rec['seconds']} s)")
        rows.append(row)
    (HERE / "out").mkdir(exist_ok=True)
    with open(HERE / "out" / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    other = [j for j in ledger_ids() if j not in used]
    if other:
        print("ledgered but not used (failed or superseded):", " ".join(other))
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} planned jobs completed; ledgered spend for {PIECE}: {a.spent():g} of {CAP}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else None)
