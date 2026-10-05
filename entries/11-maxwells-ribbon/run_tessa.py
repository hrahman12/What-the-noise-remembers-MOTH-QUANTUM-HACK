"""KEPT AS THE RECORD OF THE FAILED tessa-image-v1 ATTEMPTS (all 5 timed out; see PARAMS.md).
The piece itself was built with run_qpixl.py.

tessa-image-v1 on the 32x32 plate: shots {16,128,1024} x machine {aer, fake_fez, fake_brisbane},
plus ONE real IBM hardware run. QUANTUM (simulators / noise models / IBM hardware, labelled per row).

Usage:
  python run_tessa.py                 # the 9 simulator configs
  python run_tessa.py aer:1024        # just one config
  python run_tessa.py hw              # the one hardware run (ibm_fez, falls back to ibm_miami)
  python run_tessa.py aer:16 1        # optional 2nd arg = max attempts (default 2 = retry once)

Each config is tried at most twice (Tessa had server timeouts during the hack). Failures are logged
to out/attempts.jsonl and listed in PARAMS.md. Completed outputs are copied to out/ and every
completed job is listed in out/tessa_jobs.json. Re-runs replay from ../../cache for free.
"""
import json
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

ENGINE = "tessa-image-v1"
PIECE, CAP = "11-maxwells-ribbon", 15
MACHINES = ["aer", "fake_fez", "fake_brisbane"]
SHOTS = [16, 128, 1024]
HW = [("ibm_fez", 1024), ("ibm_miami", 1024)]   # second is only a fallback if the first fails twice
OUT = HERE / "out"


def log_attempt(entry):
    OUT.mkdir(exist_ok=True)
    with open(OUT / "attempts.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def run_one(a, machine, shots, tries=2):
    params = {"machine": machine, "shots": shots}
    for attempt in range(1, tries + 1):
        try:
            rec = a.run(ENGINE, params, files={"image": HERE / "plate.png"}, timeout=3600)
        except AtlasError as e:
            msg = str(e)
            print(f"  {machine}:{shots} attempt {attempt} failed: {msg[:240]}")
            if "MOTH_FREEZE" not in msg and "credit cap" not in msg:
                log_attempt({"machine": machine, "shots": shots, "attempt": attempt, "status": "failed",
                             "error": msg[:600], "t": round(time.time())})
            if "credit cap" in msg or "MOTH_FREEZE" in msg:
                return None
            continue
        src = a.outputs(rec)["result"]
        name = f"tessa_{machine}_{shots}.png"
        shutil.copyfile(src, OUT / name)
        res = rec["response"].get("result")
        print(f"  {name}  {rec['job_id']}  {rec['seconds']}s")
        return {"machine": machine, "shots": shots, "job_id": rec["job_id"], "file": name,
                "seconds": rec["seconds"], "result": res}
    return None


def main():
    a = Atlas(piece=PIECE, credit_cap=CAP)
    OUT.mkdir(exist_ok=True)
    arg = sys.argv[1] if len(sys.argv) > 1 else "sims"
    tries = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    jobs_path = OUT / "tessa_jobs.json"
    jobs = json.loads(jobs_path.read_text(encoding="utf-8")) if jobs_path.exists() else []
    done = {(j["machine"], j["shots"]) for j in jobs}

    if arg == "hw":
        todo = HW
    elif ":" in arg:
        m, s = arg.split(":")
        todo = [(m, int(s))]
    else:
        todo = [(m, s) for m in MACHINES for s in SHOTS]

    for m, s in todo:
        row = run_one(a, m, s, tries)   # cached configs replay free
        if row:
            jobs = [j for j in jobs if (j["machine"], j["shots"]) != (m, s)] + [row]
            done.add((m, s))
            if arg == "hw":
                break   # ONE hardware run only
    order = {m: i for i, m in enumerate(MACHINES + [h[0] for h in HW])}
    jobs.sort(key=lambda j: (order.get(j["machine"], 99), j["shots"]))
    jobs_path.write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    print(f"{len(jobs)} completed jobs in out/tessa_jobs.json; ledgered spend {a.spent():g} / {CAP}")


if __name__ == "__main__":
    main()
