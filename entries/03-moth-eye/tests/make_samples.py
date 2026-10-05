"""Reference values from the Python side (geometry.py, analyze.py) for test_core.cjs. CLASSICAL."""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import analyze  # noqa: E402
import geometry  # noqa: E402

rng = np.random.default_rng(3)
pts = rng.uniform(-12, 12, size=(200, 2))
out = {"pillar": [[float(x), float(y), float(geometry.pillar_height(np.array(x), np.array(y)))] for x, y in pts]}
for k in ("eye", "dome", "slab"):
    v, t = geometry.facet(k)
    idx = [0, 1, 777, len(v) // 2, len(v) - 1]
    out[k] = {"nv": len(v), "nt": len(t), "samples": {str(i): v[i].tolist() for i in idx}}
R = analyze.load_lut(HERE.parent / "out" / "jobs" / "L6_R6" / "R_lut.exr")
cs = [1.0, 0.9, 0.7, 0.5, 0.3, 0.1, 0.02]
out["shader_L6"] = {"cos": cs, "rgb": analyze.shader(R, np.array(cs)).tolist()}
(HERE / "samples.json").write_text(json.dumps(out), encoding="utf-8")
print("tests/samples.json written")
