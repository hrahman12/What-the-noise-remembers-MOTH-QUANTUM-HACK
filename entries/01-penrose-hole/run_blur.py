"""Run the blur-v1 sweep on intact.png inside mask.png. QUANTUM (classical statevector simulator).

12 jobs: strength {0.3, 0.6, 1.0} x style {rx, ry} x reach {0.0, 1.0}.
Every job is cached in cache/blur-v1/ (re-runs are free, MOTH_OFFLINE-safe); outputs are copied
to out/ and listed in out/jobs.csv. Failed jobs are retried once and never replaced by a fake.
"""
from __future__ import annotations

import csv
import itertools
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

STRENGTHS = [0.3, 0.6, 1.0]
STYLES = ["rx", "ry"]
REACHES = [0.0, 1.0]


def main():
    a = Atlas()
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    rows = []
    for s, st, r in itertools.product(STRENGTHS, STYLES, REACHES):
        params = {"strength": s, "style": st, "reach": r}
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("blur-v1", params, files={"image": HERE / "intact.png", "mask": HERE / "mask.png"})
                break
            except AtlasError as e:
                print(f"  {params} attempt {attempt} failed: {str(e)[:200]}")
        if rec is None:
            rows.append({**params, "job_id": "", "status": "failed", "file": "", "seconds": ""})
            continue
        src = a.outputs(rec)["result"]
        name = f"blur_s{s}_{st}_r{r}.png"
        shutil.copyfile(src, out / name)
        rows.append({**params, "job_id": rec["job_id"], "status": "completed", "file": name,
                     "seconds": rec["seconds"]})
        print(f"  {name}  {rec['job_id']}")
    with open(out / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["strength", "style", "reach", "job_id", "status", "file", "seconds"])
        w.writeheader()
        w.writerows(rows)
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} jobs completed -> out/jobs.csv")


if __name__ == "__main__":
    main()
