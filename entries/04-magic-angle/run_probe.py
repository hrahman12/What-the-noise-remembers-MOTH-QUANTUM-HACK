"""Probes at theta = 1.10 deg. QUANTUM circuit, Atlas statevector simulator.

The first job (strength 0.5, symmetric bilayer) was the timing frame: 1024x1024, 21 qubits, ~10 s.
Its output was dominated by a register artefact, so lower strengths were tried, and then the
15-degree offset (see lattice.py) was added to separate the engine's mirror copies from layer B.
The last probe (0.25, offset 15) has exactly the sweep's params, so it doubles as the 1.10 frame.
Results go to out/probes/ and out/probes.csv. Cached, so re-runs are free.
"""
from __future__ import annotations

import csv
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

import lattice  # noqa: E402

# (strength, theta0): theta0 = 0 is the symmetric bilayer, 15 the offset used for the sweep
PROBES = [(0.5, 0.0), (0.1, 0.0), (0.25, 0.0), (0.1, 15.0), (0.25, 15.0)]   # first = the timing frame
THETA = 1.10


def main():
    a = Atlas(piece="04-magic-angle", credit_cap=50)
    out = HERE / "out" / "probes"
    out.mkdir(parents=True, exist_ok=True)

    def one(probe):
        s, t0 = probe
        pa, pb = lattice.make_pair(THETA, HERE / "inputs", theta0=t0)
        params = {"strength": s, "direction": "full", "size": 1024}
        for attempt in (1, 2):
            try:
                rec = a.run("telablur-v1", params, files={"image1": pa, "image2": pb}, timeout=3600)
                name = f"probe_s{s}_r{t0:g}_{THETA:.2f}.png"
                shutil.copyfile(a.outputs(rec)["result"], out / name)
                return {"strength": s, "theta0": t0, "theta": f"{THETA:.2f}", "job_id": rec["job_id"],
                        "file": name, "seconds": rec["seconds"]}
            except AtlasError as e:
                print(f"  s={s} attempt {attempt}: {str(e)[:300]}")
        return {"strength": s, "theta0": t0, "theta": f"{THETA:.2f}", "job_id": "", "file": "", "seconds": ""}

    with ThreadPoolExecutor(3) as ex:
        rows = list(ex.map(one, PROBES))
    with open(HERE / "out" / "probes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["strength", "theta0", "theta", "job_id", "file", "seconds"])
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(r)
    print("spent", a.spent())


if __name__ == "__main__":
    main()
