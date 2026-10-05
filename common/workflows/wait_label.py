"""Wait until an agent with the given label has a result in a workflow run, then print it and exit.

python common/workflows/wait_label.py <run_id> <label> [<label> ...]   (exits on the first label that finishes)
"""
import json
import sys
import time
from pathlib import Path

WF = Path(r"C:\Users\Rahma\.claude\projects\C--Users-Rahma-OneDrive-Desktop-MOTH-QUANTUM\abc1849e-0bb4-4519-a365-7fdd300b83b2\subagents\workflows")
run, labels = sys.argv[1], set(sys.argv[2:])

while True:
    j = WF / run / "journal.jsonl"
    lab, res = {}, {}
    if j.exists():
        for line in j.read_text(encoding="utf-8").splitlines():
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("type") == "started":
                lab[e["agentId"]] = e["label"]
            elif e.get("type") == "result":
                res[e["agentId"]] = e.get("result")
    done = [(lab[a], res[a]) for a in res if lab.get(a) in labels]
    if done:
        print("DONE:", done[0][0], json.dumps(done[0][1])[:400])
        break
    time.sleep(20)
