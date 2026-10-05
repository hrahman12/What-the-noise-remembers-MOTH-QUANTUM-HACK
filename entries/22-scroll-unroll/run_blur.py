"""Scramble the ink layer with Atlas blur-v1. QUANTUM CIRCUIT on Atlas's classical statevector simulator.

Input image: ink_clean.png (the ink alone, in scan coordinates). Mask: mask.png, a white disk of r = 500 px
whose 1001 x 1001 px bounding box needs ceil(log2 1001) + ceil(log2 1001) = 10 + 10 = 20 qubits, the
engine's maximum (size = 1024 -> qubit budget ceil(log2 1024) * 2 = 20, so no downscaling or tiling).

Every job is cached in cache/blur-v1/ and ledgered against piece 22-scroll-unroll (cap 10 credits,
1 credit per job). Outputs are copied to out/ and listed in out/jobs.csv. A failed job is retried once
and never replaced by a fake. Usage: python run_blur.py [index ...] runs a subset of JOBS.
"""
from __future__ import annotations

import csv
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

PIECE, CAP = "22-scroll-unroll", 10
# (strength, reach). Local (reach 0) is the damage ladder; reach 1 is the non-local "echo" setting.
JOBS = [(0.5, 0.0), (0.25, 0.0), (0.75, 0.0), (1.0, 0.0), (0.25, 1.0), (0.5, 1.0), (1.0, 1.0),
        (0.1, 1.0), (0.5, 0.5)]   # the last two were added after seeing the first seven (see README)
STYLE = "rx"


def name(s, r):
    return f"ink_s{s:.2f}_r{r:.1f}.png"


def main(which=None):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    rows = []
    for i, (s, r) in enumerate(JOBS):
        if which is not None and i not in which:
            continue
        params = {"strength": s, "style": STYLE, "reach": r}
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run("blur-v1", params, files={"image": HERE / "ink_clean.png", "mask": HERE / "mask.png"})
                break
            except AtlasError as e:
                print(f"  {params} attempt {attempt} failed: {str(e)[:300]}")
                if "credit cap" in str(e) or "MOTH_FREEZE" in str(e):
                    break
        if rec is None:
            rows.append({**params, "job_id": "", "status": "failed", "file": "", "seconds": ""})
            continue
        src = a.outputs(rec)["result"]
        shutil.copyfile(src, out / name(s, r))
        rows.append({**params, "job_id": rec["job_id"], "status": "completed", "file": name(s, r),
                     "seconds": rec["seconds"]})
        print(f"  {name(s, r)}  {rec['job_id']}")
    if which is None:
        with open(out / "jobs.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["strength", "style", "reach", "job_id", "status", "file", "seconds"])
            w.writeheader()
            w.writerows(rows)
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} jobs completed; ledgered spend for {PIECE}: {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or None)
