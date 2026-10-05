"""Run blur-v1 on the expression composites inside each mask. QUANTUM (Atlas classical statevector simulator).

Plan (8-credit cap, 1 credit per job):
  1 probe   composite A, centre lens, strength 1.0 / rx / reach 0.5 ("plaid")
  6 grid    composites A, B x 3 lens positions, strength 1.0 / rx / reach 0 ("echo")
  1 extra   composite A, whole-section mask, "echo" (submitted last)
Each composite carries three genes, one per colour channel, so one job blurs three gene maps.
Every job is cached in cache/blur-v1/ (re-runs are free and offline); outputs are copied to out/
and listed in out/jobs.csv. A failed job is retried once and never replaced by a fake.

Usage: python run_blur.py [max_new_jobs]
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

SETTINGS = {"plaid": {"strength": 1.0, "style": "rx", "reach": 0.5},
            "echo": {"strength": 1.0, "style": "rx", "reach": 0.0}}
# (composite, mask, setting) in submission order
PLAN = [("A", "lens_512", "plaid"),
        ("A", "lens_512", "echo"), ("A", "lens_282", "echo"), ("A", "lens_742", "echo"),
        ("B", "lens_512", "echo"), ("B", "lens_282", "echo"), ("B", "lens_742", "echo"),
        ("A", "section", "echo")]


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(PLAN)
    a = Atlas(piece="15-tissue-blur", credit_cap=8)
    meta = json.loads((HERE / "maps" / "maps.json").read_text(encoding="utf-8"))
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    rows = []
    for comp, mask, sname in PLAN[:limit]:
        SETTING = SETTINGS[sname]
        files = {"image": HERE / "maps" / f"composite_{comp}.png", "mask": HERE / "masks" / f"{mask}.png"}
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("blur-v1", SETTING, files=files)
                break
            except AtlasError as e:
                print(f"  {comp}/{mask} attempt {attempt} failed: {str(e)[:300]}")
                if "credit cap" in str(e) or "MOTH_FREEZE" in str(e):
                    break
        q = meta["masks"][mask]["qubits"]
        if rec is None:
            rows.append({"composite": comp, "mask": mask, "setting": sname, **SETTING, "qubits": q, "job_id": "",
                         "status": "failed", "file": "", "seconds": ""})
            continue
        name = f"blur_{comp}_{mask}_{sname}.png"
        shutil.copyfile(a.outputs(rec)["result"], out / name)
        rows.append({"composite": comp, "mask": mask, "setting": sname, **SETTING, "qubits": q, "job_id": rec["job_id"],
                     "status": "completed", "file": name, "seconds": rec["seconds"]})
        print(f"  {name}  {rec['job_id']}  ({q} qubits)")
    with open(out / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} jobs completed -> out/jobs.csv; ledgered spend {a.spent():g} credits")


if __name__ == "__main__":
    main()
