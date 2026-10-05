"""Fetch every Atlas engine's full schema (free GET) into schemas/<engine>.json."""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas

a = Atlas(piece="06-tweezer", credit_cap=50)
eng = a.engines()
items = eng.get("engines", eng) if isinstance(eng, dict) else eng
ids = [e.get("id") or e.get("engine_id") or e.get("name") for e in items]
print(ids)
for i in ids:
    s = a.get(f"/engines/{i}")
    (HERE / "schemas" / f"{i}.json").write_text(json.dumps(s, indent=1), encoding="utf-8")
    print(i, s.get("credits_per_run"), s.get("version"), s.get("modes") or s.get("mode"))
