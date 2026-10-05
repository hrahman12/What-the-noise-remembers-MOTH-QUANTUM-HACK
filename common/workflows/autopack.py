"""Watch the per-piece deck workflow runs; as soon as a piece's publish step finishes, render its PDF and pack its zip.

python common/workflows/autopack.py <run_id> [<run_id> ...]
Prints one line per packed piece; exits when every piece seen in the runs has been packed (or after 2 hours).
"""
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WF = Path(r"C:\Users\Rahma\.claude\projects\C--Users-Rahma-OneDrive-Desktop-MOTH-QUANTUM\abc1849e-0bb4-4519-a365-7fdd300b83b2\subagents\workflows")
SLUG = {p.name[:2]: p.name for p in (ROOT / "entries").iterdir() if p.is_dir() and p.name[:2].isdigit()}
runs = sys.argv[1:]
packed, seen = set(), set()
t0 = time.time()
while time.time() - t0 < 7200:
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
            if label.startswith("setup:"):
                seen.add(label.split(":")[1])
            if label.startswith("publish:") and aid in res:
                n = label.split(":")[1]
                if n in packed:
                    continue
                packed.add(n)
                r = subprocess.run([sys.executable, str(ROOT / "common" / "piece_zip.py"), SLUG[n]], capture_output=True, text=True)
                print(time.strftime("%H:%M"), n, "publish:", json.dumps(res[aid])[:160], "|", (r.stdout.strip() or r.stderr.strip()[-300:]), flush=True)
    if seen and seen <= packed:
        print("ALL PACKED", sorted(packed), flush=True)
        break
    time.sleep(20)
