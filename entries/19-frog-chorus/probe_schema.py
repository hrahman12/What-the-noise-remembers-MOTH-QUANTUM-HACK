import sys, json
sys.path.insert(0, r"C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM")
from atlas.client import Atlas
a = Atlas(piece="19-frog-chorus", credit_cap=12)
for e in ["qdrive-api-v1", "graph-v1"]:
    s = a.get(f"/engines/{e}")
    (__import__("pathlib").Path("out") / f"schema_{e}.json").write_text(json.dumps(s, indent=2), encoding="utf-8")
    print("=====", e)
    print(json.dumps(s, indent=1)[:12000])
print("spent", a.spent())
