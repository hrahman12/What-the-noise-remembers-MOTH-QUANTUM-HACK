"""Write PARAMS.md: every completed Atlas job, its params, qubits, backend and job_id. CLASSICAL.

    python write_params.py
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    frames = list(csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")))
    probes = list(csv.DictReader(open(HERE / "out" / "probes.csv", encoding="utf-8")))
    meas = {f"{f['theta']:.2f}": f for f in json.loads((HERE / "out" / "measure.json").read_text(encoding="utf-8"))["frames"]}
    sweep_ids = {r["job_id"] for r in frames}
    out = ["# Parameters: telablur-v1 twist sweep (21 qubits per job)", "",
           "Engine: **telablur-v1** (Atlas, Quantum Teleblur), classical statevector simulator. Backend for every job: "
           "Atlas simulator (the engine has no hardware mode and reports no backend or qubit count).", "",
           "Qubits: every job uses a 1024 x 1024 image with no mask, so the region is the whole frame: "
           "log2(1024) + log2(1024) = 20 pixel qubits, plus 1 selector qubit = **21**. This is computed from the engine's "
           "documented rule (`size` = 1024 is the per-pass maximum), not reported by the engine.", "",
           "Inputs: `image1` = honeycomb layer A at theta0 - theta/2, `image2` = layer B at theta0 + theta/2 "
           "(`inputs/A_r<theta0>_<theta>.png`, `inputs/B_r<theta0>_<theta>.png`, made by `lattice.py`, a = 8 px). "
           "Fixed params: `direction` = full, `size` = 1024, `downscale`, `mask_bin_size`, `mask_min_region` at defaults.", "",
           "Credits: 1 per job, 49 jobs, 49 credits of the 50-credit cap. No job failed.", "",
           "## Probes at theta = 1.10 deg (5 jobs)", "",
           "| strength | theta0 | job_id | seconds | note |", "|---|---|---|---|---|"]
    notes = {(n["s"], n["r"]): n["note"] for n in json.loads((HERE / "out" / "probe_notes.json").read_text(encoding="utf-8"))}
    for r in probes:
        rr = "symmetric" if float(r["theta0"]) == 0 else "15 deg offset"
        extra = ""
        out.append(f"| {r['strength']} | {float(r['theta0']):g} | `{r['job_id']}` | {r['seconds']} | "
                   f"{notes.get((float(r['strength']), rr), '')}.{extra} |")
    out += ["", "## Sweep: strength 0.25, theta0 = 15 deg (45 jobs)", "",
            "Measured period (classical FFT of the output, see `measure.py`): status `ok` = tracks the twist, "
            "`null` = same split as the untwisted frame (register echo), `unresolved` = no pair beyond the resolution limit.", "",
            "| theta (deg) | job_id | seconds | L predicted (px) | L from morph (px) | status |", "|---|---|---|---|---|---|"]
    for r in frames:
        m = meas[r["theta"]]
        lp = "inf" if m["L_pred"] is None else f"{m['L_pred']:.1f}"
        lm = "-" if m["L_meas"] is None else f"{m['L_meas']:.1f}"
        out.append(f"| {r['theta']} | `{r['job_id']}` | {r['seconds']} | {lp} | {lm} | {m['status']} |")
    (HERE / "PARAMS.md").write_text("\n".join(out) + "\n", encoding="utf-8")
    print("PARAMS.md written")


if __name__ == "__main__":
    main()
