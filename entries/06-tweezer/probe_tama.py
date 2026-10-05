"""Probe tamagotchi-v1's logical-qubit ceiling. tamagotchi-v1 costs 0 credits, so these probes are free."""
import sys, time
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError
a = Atlas(piece="06-tweezer", credit_cap=50)
for n in [int(x) for x in sys.argv[1:]]:
    p = {"code": "steane", "n_logical": n, "shots": 64, "seed": 1, "actions": [["X", 0], ["SE", list(range(n))]]}
    t = time.time()
    try:
        r = a.run("tamagotchi-v1", p, timeout=900)
        o = r["response"]["result"]["output"]
        print(n, "ok", round(time.time() - t, 1), "s", {k: v for k, v in o.items() if k not in ("per_logical",)}, flush=True)
    except AtlasError as e:
        print(n, "FAILED", str(e)[:300], flush=True)
