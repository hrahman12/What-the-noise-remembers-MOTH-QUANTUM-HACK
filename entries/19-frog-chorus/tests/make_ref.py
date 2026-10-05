"""Reference values from chorus.py (Python) for the node test of the page's inline core. CLASSICAL."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import chorus as C  # noqa: E402

ponds = {d["name"]: d for d in json.loads((HERE.parent / "out" / "pond.json").read_text(encoding="utf-8"))}
ref = {"rates": C.rates(20, 2.0, 0.04), "pitch": [C.pitch(k) for k in range(24)], "runs": []}
for name, src, K in (("alt20", "engine", 3.0), ("sync20", "asked", 2.0), ("alt20", "asked", 5.0)):
    ds = ponds[name]
    th = C.initial_phases(ds)
    w = [2 * 3.141592653589793 * f for f in C.rates(ds["n"], 2.0, 0.04)]
    E = C.couplings(ds, src)
    occ = [int(b) for b in ds["nights"][3]]
    calls = 0
    for _ in range(480):
        th, c = C.step(th, w, E, occ, K)
        calls += len(c)
    R, turns = C.order(th, occ, E)
    ref["runs"].append({"name": name, "src": src, "K": K, "night": 3, "theta": th, "calls": calls, "R": R, "turns": turns})
(HERE / "ref.json").write_text(json.dumps(ref), encoding="utf-8")
print("ref.json written", [(r["name"], r["src"], r["calls"], round(r["R"], 3), round(r["turns"], 3)) for r in ref["runs"]])
