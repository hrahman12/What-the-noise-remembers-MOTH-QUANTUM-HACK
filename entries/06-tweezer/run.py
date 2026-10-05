"""Tweezer: a day in the life of a neutral-atom quantum computer, told across Atlas engines.

Each stage runs one Atlas engine on an input derived from an earlier stage's REAL output, and
scores the hop with the classical fidelity F (see lib.py). Atlas runs gate-model circuits and
simulators, never atoms: every stage is an analogy for a step of a neutral-atom experiment.

    python run.py                 # run (or replay from cache) every stage, write out/chain.json
    python run.py --upto graph    # stop after the named stage (spend credits step by step)
    python run.py --skip qrcimage # leave stages out of this pass (used to run slow jobs in parallel)

Every completed job is cached in ../../cache/, so a re-run is free and works offline
(MOTH_FREEZE=1 makes the client refuse any job that is not already cached).
A stage whose job FAILED is recorded in out/failed.json and is not re-submitted on later runs:
engines with known server timeouts are tried once, listed as failures, and not credited.

Hardware: every hardware-capable stage targets IBM's ibm_fez (stages.HW) first, on the same input it had in the recorded
day. A failed ibm_fez job is logged in out/fez_failed.json (tried at most twice; the credit cap may refuse the second try),
and the stage then keeps its recorded run, labelled. TWEEZER_QPU_WAIT=<seconds> sets how long to wait on a hardware queue
(a job still queued is left pending and resumed by the next run).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from atlas.client import Atlas, AtlasError  # noqa: E402
from lib import OUT, dump, load  # noqa: E402
from stages import INFO, STAGES  # noqa: E402

PIECE, CAP = "06-tweezer", 98     # 50 for the recorded day + 24 for the first ibm_fez pass + 22 for the ibm_fez retries
#                                   + 2, so the 08:15 downscaled-frame retry (run_tessa_small.py) had 4 credits of room


def main():
    upto = sys.argv[sys.argv.index("--upto") + 1] if "--upto" in sys.argv else None
    skip = set(sys.argv[sys.argv.index("--skip") + 1].split(",")) if "--skip" in sys.argv else set()
    a = Atlas(piece=PIECE, credit_cap=CAP)
    OUT.mkdir(exist_ok=True)
    failed_path = OUT / "failed.json"
    failed = load(failed_path) if failed_path.exists() else {}
    ctx, records = {"atlas": a, "cap": CAP}, []
    def blank(name, **kw):
        return {"id": name, "completed": False, **INFO.get(name, {}), **kw}

    for st in STAGES:
        name = st.__name__.replace("stage_", "")
        if name in skip:
            ctx[name] = None
            continue
        if name in failed:
            print(f"[{name}] skipped: failed earlier ({failed[name]['job_id']}), not retried")
            records.append(blank(name, **failed[name]))
            ctx[name] = None
        else:
            try:
                rec = st(ctx)
                records.append(rec)
                h = rec.get("hop", {})
                print(f"[{name}] {rec['engine']}  F={h.get('F')} (chance {h.get('null')})  job={rec.get('job_id')}")
            except AtlasError as e:
                msg = str(e)
                ctx[name] = None
                if "MOTH_FREEZE" in msg or "credit cap" in msg:
                    print(f"[{name}] not run: {msg[:200]}")
                    records.append(blank(name, error=msg[:300]))
                elif "re-run to resume" in msg:   # still queued server-side: resumable, not a failure
                    m = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", msg)
                    print(f"[{name}] still pending ({m.group(1) if m else '?'}); continuing without it")
                    records.append(blank(name, pending=True, job_id=m.group(1) if m else None, error=msg[:300]))
                else:
                    m = re.search(r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", msg)
                    eng = msg.split()[0]
                    failed = load(failed_path) if failed_path.exists() else {}   # re-read: parallel passes
                    failed[name] = {"engine": eng, "job_id": m.group(1) if m else None, "error": msg[:500]}
                    dump(failed, failed_path)
                    print(f"[{name}] FAILED (recorded, will not retry): {msg[:300]}")
                    records.append(blank(name, **failed[name]))
        if upto and name == upto:
            break
    if not skip and not upto:
        dump(records, OUT / "chain.json")
    else:
        (HERE / "logs").mkdir(exist_ok=True)
        dump(records, HERE / "logs" / f"chain_partial_{os.getpid()}.json")
    print(f"spent (ledger): {a.spent():g} of {CAP} credits; frozen={os.environ.get('MOTH_FREEZE') == '1'}")


if __name__ == "__main__":
    main()
