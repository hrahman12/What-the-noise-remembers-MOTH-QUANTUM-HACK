"""Run the entanglement-shader-v1 layer sweep. QUANTUM CIRCUITS on Atlas's classical statevector simulator.

Design (credit cap 12, 1 credit per job):
  * Budget probing (see record_probes.py / out/probes.json) found the maximum valid combination:
    layers = 6, incoming_rays = 6. Seven layers allows at most 5 rays, but the engine needs rays >= layers.
  * Main sweep: layers 1..6 with incoming_rays fixed at 6 (so only the layer count changes);
    reflectance 0.2, absorption 0.95, engine defaults otherwise (interaction 1, style peaked, resolution 60).
    The 6-layer job is the budget-limit run (the engine says 6 layers allows at most 6 rays under 21 qubits).
  * Control: interaction 0 (nonlinear terms off) at layers 1 and 6, run only if credit is left.

Every job is cached in cache/entanglement-shader-v1/ (re-runs are free and offline). Each ZIP is unpacked
into out/jobs/<tag>/ and listed in out/jobs.csv. Failed jobs are retried once and never replaced by a fake.
"""
from __future__ import annotations

import csv
import shutil
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

ENGINE = "entanglement-shader-v1"
RAYS = 6
BASE = {"reflectance": 0.2, "absorption": 0.95}

# (tag, params, series)
PLAN = [(f"L{L}_R{RAYS}", {**BASE, "layers": L, "incoming_rays": RAYS}, "sweep") for L in range(1, 7)]
PLAN += [(f"L{L}_R{RAYS}_int0", {**BASE, "layers": L, "incoming_rays": RAYS, "interaction": 0}, "control")
         for L in (1, 6)]


def main():
    a = Atlas(piece="03-moth-eye", credit_cap=12)
    out = HERE / "out" / "jobs"
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for tag, params, series in PLAN:
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run(ENGINE, params, timeout=3600)
                break
            except AtlasError as e:
                msg = str(e)
                print(f"  {tag} attempt {attempt} failed: {msg[:300]}")
                if "credit cap" in msg or "MOTH_FREEZE" in msg or "max_qubits_exceeded" in msg:
                    break
        if rec is None:
            rows.append({"tag": tag, "series": series, **params, "job_id": "", "status": "not run", "seconds": ""})
            continue
        z = a.outputs(rec)["result"]
        dest = out / tag
        if dest.exists():
            shutil.rmtree(dest)
        zipfile.ZipFile(z).extractall(dest)
        shutil.copyfile(z, dest.with_suffix(".zip"))
        rows.append({"tag": tag, "series": series, **params, "job_id": rec["job_id"], "status": "completed",
                     "seconds": rec["seconds"]})
        print(f"  {tag}  {rec['job_id']}")
    fields = ["tag", "series", "layers", "incoming_rays", "reflectance", "absorption", "interaction",
              "job_id", "status", "seconds"]
    with open(HERE / "out" / "jobs.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            r.setdefault("interaction", 1)
            w.writerow(r)
    done = sum(r["status"] == "completed" for r in rows)
    print(f"{done}/{len(rows)} jobs completed -> out/jobs.csv   (ledgered spend {a.spent():g} of 12 credits)")


if __name__ == "__main__":
    main()
