"""Blur the busy beaver score with Atlas blur-midi-v1. QUANTUM circuit on Atlas's simulator.

Every job: qubits = 20 (the engine's maximum), the input score_raw.mid, engine defaults for margin
(0.15), threshold (0.1), resolution (0 = auto) and mask (none: both note tracks blurred in full).
The sweep varies reach in {0, 1} (local vs non-local mixing), strength, and for two jobs the time
resolution (see SWEEP).

Credit cap 6 (1 credit per job). Each job is cached in cache/blur-midi-v1/, so re-runs are free and
offline (MOTH_FREEZE=1 refuses anything that is not cached). Failed jobs are retried once and never
replaced by anything synthetic. Outputs are copied to out/blur_s<strength>_r<reach>.mid and listed
in out/jobs.csv with the job id and the engine's own result JSON in out/jobs.json.
"""
from __future__ import annotations

import csv
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

ENGINE = "blur-midi-v1"
QUBITS = 20
SWEEP = [  # (strength, reach, resolution). 0.5 is the engine default; 0.2 was added after 0.5 at reach 1
    (0.5, 0.0, 0),   # scattered the score into a near-uniform cloud, to hear a gentler global echo.
    (0.5, 1.0, 0),   # resolution 0 = auto = 120 ticks (one 16th-note column): 4,574 time steps.
    (0.2, 0.0, 0),
    (0.2, 1.0, 0),
    (0.2, 0.0, 60),  # resolution 60 = half a column: 9,148 time steps = 14 qubits, so with the 6 pitch
    (0.2, 1.0, 60),  # qubits (33-64 rows) the melody roll needs exactly 20 = the full budget.
]


def main():
    a = Atlas(piece="16-busy-beaver-score", credit_cap=6)
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    rows, results = [], {}
    for strength, reach, res in SWEEP:
        params = {"qubits": QUBITS, "reach": reach, "strength": strength}
        if res:  # only set when not auto, so the first four jobs keep their original cache keys
            params["resolution"] = res
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run(ENGINE, params, files={"midi": HERE / "score_raw.mid"}, timeout=3600)
                break
            except AtlasError as e:
                print(f"  {params} attempt {attempt} failed: {str(e)[:300]}")
                if "credit cap" in str(e) or "FREEZE" in str(e):
                    break
        if rec is None:
            rows.append({"strength": strength, "reach": reach, "resolution": res, "qubits": QUBITS, "job_id": "",
                         "status": "failed", "file": "", "seconds": ""})
            continue
        src = a.outputs(rec)["result"]
        name = f"blur_s{strength}_r{reach:g}" + (f"_res{res}" if res else "") + ".mid"
        shutil.copyfile(src, out / name)
        results[name] = {"job_id": rec["job_id"], "params": params, "result": rec["response"].get("result")}
        rows.append({"strength": strength, "reach": reach, "resolution": res, "qubits": QUBITS, "job_id": rec["job_id"],
                     "status": "completed", "file": name, "seconds": rec["seconds"]})
        print(f"  {name}  {rec['job_id']}")
    with open(out / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["strength", "reach", "resolution", "qubits", "job_id", "status", "file", "seconds"])
        w.writeheader()
        w.writerows(rows)
    (out / "jobs.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} jobs completed -> out/jobs.csv; ledgered spend {a.spent():g} of 6 credits")


if __name__ == "__main__":
    main()
