"""Wait until any of the given pieces has finished its pipeline in the given workflow runs, then print it and exit.

python common/workflows/wait_free.py <slug,slug,...> <run_id> [<run_id> ...]
A piece is finished when its last verdict stage (verify/reverify/judge/rejudge) has a result that passes, or when
a re-verify/re-judge has any result (the pipeline ends there).
"""
import json
import sys
import time
from pathlib import Path

WF = Path(r"C:\Users\Rahma\.claude\projects\C--Users-Rahma-OneDrive-Desktop-MOTH-QUANTUM\abc1849e-0bb4-4519-a365-7fdd300b83b2\subagents\workflows")
slugs = sys.argv[1].split(",")
runs = sys.argv[2:]


def finished():
    done = []
    for run in runs:
        j = WF / run / "journal.jsonl"
        if not j.exists():
            continue
        lab, res = {}, {}
        for line in j.read_text(encoding="utf-8").splitlines():
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("type") == "started":
                lab[e["agentId"]] = e["label"]
            elif e.get("type") == "result":
                res[e["agentId"]] = e.get("result")
        for aid, label in lab.items():
            stage, s = label.split(":", 1)
            if s not in slugs or aid not in res:
                continue
            r = res[aid] or {}
            if stage in ("verify", "judge") and r.get("pass"):
                done.append(s)
            if stage in ("reverify", "rejudge"):
                done.append(s)
    return sorted(set(done))


while True:
    d = finished()
    if d:
        print("FREE:", ",".join(d))
        break
    time.sleep(30)
