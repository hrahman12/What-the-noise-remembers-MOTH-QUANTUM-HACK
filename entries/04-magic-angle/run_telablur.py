"""Run telablur-v1 once per twist angle. QUANTUM circuit, run on Atlas's classical statevector simulator.

For each theta in angles.json:
  image1 = honeycomb layer A at 15 - theta/2 deg   (inputs/A_r15_<theta>.png, 1024x1024)
  image2 = honeycomb layer B at 15 + theta/2 deg   (inputs/B_r15_<theta>.png)
  no mask -> the whole 1024x1024 frame is one region -> log2(1024)+log2(1024) = 20 pixel qubits
  plus 1 selector qubit = 21 qubits per pass.

Params are fixed for every frame: strength 0.25, direction full, size 1024 (one pass for the whole
frame, no downscale or tiling). Strength 0.25 was chosen from five probes (run_probe.py,
analyse_probes.py): at 0.1 the honeycomb survives but layer B carries only ~2 % of layer A's
first-shell Bragg power; at 0.5 a 4 px register artefact dominates; at 0.25 layer B reaches ~34 %
while the Bragg peaks stay ~1e4-1e5 above the spectral floor, although the image looks like speckle.

Every completed job is cached in cache/telablur-v1/ (re-runs are free and offline). Outputs are
copied to out/frames/ and listed in out/jobs.csv. A failed job is retried once and never faked.

    python run_telablur.py --only 1.10       # the timing frame
    python run_telablur.py --workers 6       # the whole sweep
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import CACHE, Atlas, AtlasError, _hash  # noqa: E402

import lattice  # noqa: E402

PIECE, CAP, ENGINE = "04-magic-angle", 50, "telablur-v1"
PARAMS = {"strength": 0.25, "direction": "full", "size": 1024}
QUBITS = 21   # 10 x-qubits + 10 y-qubits for a 1024x1024 region, + 1 selector


def cached(a: Atlas, files: dict) -> bool:
    inputs = {slot: a.upload(p) for slot, p in files.items()}
    return (CACHE / ENGINE / f"{_hash({'e': ENGINE, 'p': PARAMS, 'f': inputs})}.json").exists()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=float, default=None)
    ap.add_argument("--workers", type=int, default=1)
    args = ap.parse_args()

    angles = json.loads((HERE / "angles.json").read_text())
    if args.only is not None:
        angles = [t for t in angles if abs(t - args.only) < 1e-9]
    a = Atlas(piece=PIECE, credit_cap=CAP)
    lock = threading.Lock()
    a.log = lambda *m: (lock.acquire(), print(*m, flush=True), lock.release())

    jobs = []
    for th in angles:
        pa, pb = lattice.make_pair(th, HERE / "inputs")
        jobs.append((th, {"image1": pa, "image2": pb}))

    # hard budget guard: the client's cap check is per-call and could race across threads
    new = [th for th, f in jobs if not cached(a, f)]
    cost = a.credits_per_run(ENGINE) * len(new) if new else 0
    print(f"{len(jobs)} frames, {len(new)} not cached; spent {a.spent():g} of {CAP}, this run adds {cost:g}")
    if new and a.spent() + cost > CAP:
        sys.exit("refusing: this run would exceed the credit cap")

    out = HERE / "out" / "frames"
    out.mkdir(parents=True, exist_ok=True)

    def one(item):
        th, files = item
        for attempt in (1, 2):
            try:
                rec = a.run(ENGINE, PARAMS, files=files, timeout=7200)
                src = a.outputs(rec)["result"]
                name = f"morph_{th:.2f}.png"
                shutil.copyfile(src, out / name)
                return {"theta": f"{th:.2f}", "job_id": rec["job_id"], "status": "completed", "file": name,
                        "seconds": rec["seconds"]}
            except AtlasError as e:
                a.log(f"  theta {th:.2f} attempt {attempt} failed: {str(e)[:300]}")
        return {"theta": f"{th:.2f}", "job_id": "", "status": "failed", "file": "", "seconds": ""}

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        rows = list(ex.map(one, jobs))
    for r in rows:
        print(f"  {r['theta']:>5}  {r['status']:9}  {r['job_id']}  {r['seconds']}s")

    # merge with any rows already on disk (so --only runs do not wipe the table)
    path = HERE / "out" / "jobs.csv"
    old = {r["theta"]: {k: r[k] for k in ("theta", "job_id", "status", "file", "seconds")}
           for r in csv.DictReader(open(path, encoding="utf-8"))} if path.exists() else {}
    old.update({r["theta"]: r for r in rows})
    merged = sorted(old.values(), key=lambda r: float(r["theta"]))
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["theta", "job_id", "status", "file", "seconds"])
        w.writeheader()
        w.writerows(merged)
    done = sum(r["status"] == "completed" for r in merged)
    print(f"{done}/{len(merged)} frames completed -> out/jobs.csv ; spent {a.spent():g} credits")


if __name__ == "__main__":
    main()
