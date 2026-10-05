"""THE QUANTUM STEP. Run Atlas tamagotchi-v1 (Steane code on the Aer stabilizer simulator) and store the
measured rates the loom samples from in loom/data/calibration.json.

Grid: 2 noise profiles x p in {1e-3, 5e-3, 1e-2} x {one syndrome-extraction round, no round}, all at
n_logical = GRID_N logical qubits (7 x GRID_N physical data qubits). Every logical holds a bit: X is applied
to odd-indexed logicals, so each job measures stored 0s and stored 1s side by side.
Ladder: the same circuit at growing n_logical (p = 5e-3, loom profile) to find how far the engine stretches.

tamagotchi-v1 costs 0 credits per run; every job is still ledgered under piece 09-syndrome-loom (cap 5).
Jobs are cached in cache/tamagotchi-v1/, so re-running this script is free and works offline (MOTH_FREEZE=1).
Failed jobs are retried once and never replaced by made-up numbers.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIECE = HERE.parent
sys.path.insert(0, str(PIECE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

ENGINE = "tamagotchi-v1"
PS = [1e-3, 5e-3, 1e-2]
GRID_N = 256
GRID_SHOTS = 64
SEED = 2026
PROFILES = {
    "loom": {"title": "noisy loom: every gate, idle step and readout is noisy",
             "noise": "p_1q = p_gate = p_idle = p_meas = p",
             "fn": lambda p: {"p_1q": p, "p_gate": p, "p_idle": p, "p_meas": p}},
    "thread": {"title": "fraying thread: only stored threads (idle) and readout are noisy, the loom's gates are clean",
               "noise": "p_idle = p_meas = p; p_1q = p_gate = 0",
               "fn": lambda p: {"p_idle": p, "p_meas": p}},
}
# (n_logical, shots) for the size ladder; p = 5e-3 loom profile, seed 11 (same params as probe_size.py)
LADDER = [(64, 1024), (128, 1024), (256, 1024), (512, 8), (1024, 2)]
_tp = HERE / "job_times.json"
TIMES = json.loads(_tp.read_text(encoding="utf-8")) if _tp.exists() else {}


def actions(n, se=True):
    acts = [["X", i] for i in range(1, n, 2)]
    if se:
        acts.append(["SE", list(range(n))])
    return acts


def grid_params(profile, p, se):
    return {"n_logical": GRID_N, "shots": GRID_SHOTS, "seed": SEED, "actions": actions(GRID_N, se),
            "noise": PROFILES[profile]["fn"](p)}


def ladder_params(n, shots):
    p = 5e-3
    return {"n_logical": n, "shots": shots, "seed": 11, "actions": actions(n, True),
            "noise": {"p_1q": p, "p_gate": p, "p_idle": p, "p_meas": p}}


def run(a, params, label):
    """Retry once on a real failure. 'did not respond in time' means the shared engine was busy with
    another job and never started ours, so that case waits and resubmits (up to 8 times)."""
    last, real_failures, busy = None, 0, 0
    while real_failures < 2 and busy < 8:
        try:
            return a.run(ENGINE, params, timeout=7200)
        except AtlasError as e:
            last = e
            if "did not respond in time" in str(e):
                busy += 1
                print(f"  {label}: engine busy ({busy}), waiting", flush=True)
                time.sleep(75)
            else:
                real_failures += 1
                print(f"  {label}: attempt {real_failures} failed: {str(e)[:240]}", flush=True)
    raise last


def stats(rec):
    out = rec["response"]["result"]["output"]
    pl = out["per_logical"]
    n, shots = out["n_logical"], out["shots"]
    b0 = [x["logical_error_rate"] for x in pl if x["expected"] == 0]
    b1 = [x["logical_error_rate"] for x in pl if x["expected"] == 1]
    wall = TIMES.get(rec["job_id"], {}).get("wall_seconds")  # engine-side created -> updated (fetch_job_times.py)
    return {"job_id": rec["job_id"], "seconds": rec["seconds"], "wall_seconds": wall, "n_logical": n, "shots": shots,
            "logical_error_rate": sum(b0 + b1) / len(pl),
            "ler_bit0": sum(b0) / len(b0) if b0 else None,
            "ler_bit1": sum(b1) / len(b1) if b1 else None,
            "logical_error_count": out["logical_error_count"],
            "syndromes_detected": out["syndromes_detected"],
            "corrections_applied": out["corrections_applied"],
            "syndrome_rate": out["syndromes_detected"] / (shots * n),
            "success_rate": out["success_rate"], "noise": out["noise"], "simulator": out["simulator"]}


def credits(a):
    try:
        return a.credits_per_run(ENGINE)
    except Exception:  # offline replay: the engine schema lists credits_per_run = 0
        return 0.0


def main(only=None):
    a = Atlas(piece="09-syndrome-loom", credit_cap=5)
    jobs, failed = [], []
    cal = {"engine": ENGINE, "code": "steane",
           "simulator": "Qiskit Aer stabilizer simulator on Atlas (no QPU)",
           "credits_per_run": credits(a),
           "grid": {"n_logical": GRID_N, "physical_data_qubits": 7 * GRID_N, "shots": GRID_SHOTS, "seed": SEED,
                    "pattern": "X on odd-indexed logicals (stored bit 1), even-indexed stay 0"},
           "profiles": {}, "ladder": []}
    for prof, spec in PROFILES.items():
        if only and only != "ladder" and prof != only:
            continue
        levels = []
        for p in PS:
            lv = {"p": p, "n_logical": GRID_N, "shots": GRID_SHOTS}
            for se in (True, False):
                key = "se" if se else "bare"
                label = f"{prof} p={p:g} {key}"
                try:
                    rec = run(a, grid_params(prof, p, se), label)
                except AtlasError as e:
                    failed.append({"label": label, "error": str(e)[:300]})
                    continue
                lv[key] = stats(rec)
                jobs.append({"group": "grid", "profile": prof, "p": p, "se": se, **{k: lv[key][k] for k in (
                    "job_id", "n_logical", "shots", "seconds", "wall_seconds", "logical_error_rate", "syndrome_rate")}})
                print(f"  {label}: {rec['job_id']}  LER {lv[key]['logical_error_rate']:.5f}  "
                      f"synd/blk {lv[key]['syndrome_rate']:.4f}  ({rec['seconds']}s)", flush=True)
            if "se" in lv and "bare" in lv:
                levels.append(lv)
        cal["profiles"][prof] = {"title": spec["title"], "noise": spec["noise"], "levels": levels}
    if not only or only == "ladder":
        ladder_max = int(os.environ.get("LOOM_LADDER_MAX", "1000000"))  # replay a shorter ladder while a big job runs
        for n, shots in [(n, s) for n, s in LADDER if n <= ladder_max]:
            label = f"ladder n={n} shots={shots}"
            try:
                rec = run(a, ladder_params(n, shots), label)
            except AtlasError as e:
                failed.append({"label": label, "error": str(e)[:300]})
                print(f"  {label}: stopping the ladder here")
                break
            st = stats(rec)
            st["physical_data_qubits"] = 7 * n
            cal["ladder"].append(st)
            jobs.append({"group": "ladder", "profile": "loom", "p": 5e-3, "se": True, **{k: st[k] for k in (
                "job_id", "n_logical", "shots", "seconds", "wall_seconds", "logical_error_rate", "syndrome_rate")}})
            print(f"  {label}: {rec['job_id']}  LER {st['logical_error_rate']:.5f}  ({rec['seconds']}s)", flush=True)
    if only:
        print("partial run (only=%s): calibration.json not rewritten" % only)
        return
    (PIECE / "loom" / "data").mkdir(parents=True, exist_ok=True)
    (PIECE / "loom" / "data" / "calibration.json").write_text(json.dumps(cal, indent=1), encoding="utf-8")
    (HERE / "jobs.json").write_text(json.dumps({"jobs": jobs, "failed": failed}, indent=1), encoding="utf-8")
    print(f"{len(jobs)} completed jobs, {len(failed)} failed -> loom/data/calibration.json, engine/jobs.json; "
          f"spent {a.spent():g} credits")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
