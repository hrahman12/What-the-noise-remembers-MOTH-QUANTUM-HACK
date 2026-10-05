"""Run the colour plates through qpixl-v1. QUANTUM: Atlas aer simulator (noiseless), the fake_fez and
fake_brisbane noise models (Atlas emulator), and ONE run on real IBM hardware (ibm_fez).

Grid: shots {16, 128, 1024} x machine {aer, fake_fez, fake_brisbane} + ibm_fez at 1024 shots.
Payloads come from payload.py (data/payloads.json). dynamic_range is left at the engine default
("none"): the measured numbers are used exactly as returned.

    python run_qpixl.py              # run / replay everything in priority order
    python run_qpixl.py aer:1024     # one config

Each config is tried at most twice. Completed jobs are cached in ../../cache/qpixl-v1 (re-runs are free;
MOTH_FREEZE=1 refuses anything not cached) and written to out/qpixl_<machine>_<shots>.json.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

ENGINE, PIECE, CAP = "qpixl-v1", "11-maxwells-ribbon", 15
HW = "ibm_fez"
# priority order: if credits run out, the least important configs are the ones that go missing
ORDER = [("aer", 1024), (HW, 1024), ("fake_fez", 1024), ("aer", 16), ("aer", 128), ("fake_fez", 16),
         ("fake_fez", 128), ("fake_brisbane", 1024), ("fake_brisbane", 128), ("fake_brisbane", 16)]
OUT = HERE / "out"


def params_for(machine, shots, values):
    if machine == HW:
        return {"values": values, "mode": "qpu", "backend_name": HW, "shots": shots}
    return {"values": values, "mode": "emu", "machine": machine, "shots": shots}


def main():
    a = Atlas(piece=PIECE, credit_cap=CAP)
    payloads = json.loads((HERE / "data" / "payloads.json").read_text(encoding="utf-8"))
    todo = ORDER
    if len(sys.argv) > 1:
        m, s = sys.argv[1].split(":")
        todo = [(m, int(s))]
    OUT.mkdir(exist_ok=True)
    for m, s in todo:
        p = params_for(m, s, payloads[m]["values"])
        rec = None
        for attempt in (1, 2):
            try:
                rec = a.run(ENGINE, p, timeout=3600)
                break
            except AtlasError as e:
                msg = str(e)
                print(f"  {m}:{s} attempt {attempt} failed: {msg[:300]}")
                if "credit cap" in msg or "MOTH_FREEZE" in msg:
                    break
                with open(OUT / "attempts.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"engine": ENGINE, "machine": m, "shots": s, "attempt": attempt,
                                        "status": "failed", "error": msg[:600], "t": round(time.time())}) + "\n")
        if rec is None:
            continue
        res = rec["response"]["result"]
        row = {"engine": ENGINE, "machine": m, "shots": s, "job_id": rec["job_id"], "backend": res.get("backend"),
               "ibm_job_id": res.get("ibm_job_id"), "qpu_seconds": res.get("qpu_seconds"), "seconds": rec["seconds"],
               "params": {k: v for k, v in p.items() if k != "values"}, "n_values": len(p["values"]),
               "output": res["output"]}
        (OUT / f"qpixl_{m}_{s}.json").write_text(json.dumps(row), encoding="utf-8")
        print(f"  {m:14s} {s:5d} shots  job {rec['job_id']}  backend {row['backend']}  {rec['seconds']}s")
    print(f"ledgered spend {a.spent():g} / {CAP}")


if __name__ == "__main__":
    main()
