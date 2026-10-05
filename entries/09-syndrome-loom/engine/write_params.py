"""Write PARAMS.md from engine/jobs.json, engine/probe_jobs.json and the cached job records. CLASSICAL bookkeeping."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIECE = HERE.parent

jobs = json.loads((HERE / "jobs.json").read_text(encoding="utf-8"))
probes = json.loads((HERE / "probe_jobs.json").read_text(encoding="utf-8"))
cal = json.loads((PIECE / "loom" / "data" / "calibration.json").read_text(encoding="utf-8"))


def pct(x):
    return f"{100 * x:.3f} %" if x < 0.01 else f"{100 * x:.2f} %"


L = ["# Parameters and jobs: tamagotchi-v1", "",
     "Engine: **Atlas `tamagotchi-v1`** (Steane code, `code = \"steane\"`), Qiskit Aer **stabilizer simulator** "
     "(`method = \"stabilizer\"`). No QPU mode, no hardware. 0 credits per run; every job is ledgered under "
     "piece `09-syndrome-loom` (credit cap 5).", "",
     "Qubits: 7 physical data qubits per Steane logical qubit (computed from the code; the engine reports `n_logical`). "
     "The engine also allocates ancillas for syndrome extraction but does not document how many, so they are not counted.", "",
     "## Calibration grid (used by the loom)", "",
     f"n_logical = {cal['grid']['n_logical']} ({cal['grid']['physical_data_qubits']} data qubits), shots = {cal['grid']['shots']}, "
     f"seed = {cal['grid']['seed']}. Pattern: {cal['grid']['pattern']}. `se` = actions end with one `[\"SE\", [0..n-1]]` "
     "round (syndrome extraction + in-circuit correction on every logical); `bare` = the same circuit without it.", "",
     "| profile | noise params | p | SE round | logical error rate | syndrome events / block (X+Z) | wall s | job_id |",
     "|---|---|---|---|---|---|---|---|"]
for j in jobs["jobs"]:
    if j["group"] != "grid":
        continue
    noise = cal["profiles"][j["profile"]]["noise"]
    L.append(f"| {j['profile']} | `{noise}` | {j['p']:g} | {'yes' if j['se'] else 'no'} | {pct(j['logical_error_rate'])} | "
             f"{j['syndrome_rate']:.4f} | {j.get('wall_seconds') or j['seconds']} | `{j['job_id']}` |")
L += ["", "## Size ladder (how far one job stretched)", "",
      "p = 0.005 on every channel, X on odd logicals, one SE round on all, seed 11.", "",
      "| n_logical | data qubits (7 x n) | shots | wall s (submit to done) | logical error rate | job_id |", "|---|---|---|---|---|---|"]
for j in jobs["jobs"]:
    if j["group"] == "ladder":
        L.append(f"| {j['n_logical']} | {7 * j['n_logical']:,} | {j['shots']} | {j.get('wall_seconds') or j['seconds']} | "
                 f"{pct(j['logical_error_rate'])} | `{j['job_id']}` |")
done = {j["job_id"] for j in jobs["jobs"]}
pend = [json.loads(f.read_text(encoding="utf-8"))["job_id"]
        for f in (PIECE.parent.parent / "cache" / "pending" / "tamagotchi-v1").glob("*.json")]
if "191803b3-afb4-4706-bfb6-0b5eea975c85" in pend and "191803b3-afb4-4706-bfb6-0b5eea975c85" not in done:
    L += ["", "Still running at write-up (not used, not counted): n_logical = 1024 (7,168 data qubits), 2 shots, "
          "job `191803b3-afb4-4706-bfb6-0b5eea975c85`, submitted 06:43 UTC on 5 Oct 2026. Re-running "
          "`engine/run_calibration.py` resumes it."]
if jobs.get("failed"):
    L += ["", "Not completed (not used, not counted):", ""]
    L += [f"- {f['label']}: {f['error'][:220]}" for f in jobs["failed"]]
L += ["", "## Probes (reading the engine's semantics)", "",
      "Small jobs used to learn what the output fields mean (n_logical 1-2, 2000-8000 shots). Listed in "
      "`engine/probe_jobs.json`.", "",
      "| probe | actions | noise | logical errors | syndromes_detected | shots | job_id |", "|---|---|---|---|---|---|---|"]
for name, v in probes.items():
    if "job_id" not in v:
        continue
    o = v["output"]
    acts = json.dumps(v["params"]["actions"])
    noise = ", ".join(f"{k}={x:g}" for k, x in v["params"].get("noise", {}).items())
    L.append(f"| {name} | `{acts}` | {noise} | {o['logical_error_count']} | {o['syndromes_detected']} | "
             f"{o['shots']} | `{v['job_id']}` |")
L += ["", "Ledgered submissions that did not complete (0 credits, not counted): `97ce4646-27f1-40ca-ba12-9adb381e8e1a` "
      "(deliberately invalid `code` to read the registry; the error lists only `steane`); "
      "`7ef8fb38-4016-4b5a-888c-9e27cabb0567`, `780ffeb1-7e78-44c9-9d55-ffb19768a63f`, "
      "`353c7c61-4e2f-452c-b0ad-dbf59a2da798` (engine_timeout while the engine was busy with the n=256 job; "
      "the same probes were resubmitted and completed above)."]
failed_probes = [k for k, v in probes.items() if "job_id" not in v]
if failed_probes:
    L += ["", "Probes that failed (engine busy or timed out; not used): " + ", ".join(failed_probes)]
L.append("")
(PIECE / "PARAMS.md").write_text("\n".join(L), encoding="utf-8")
print("PARAMS.md written")
