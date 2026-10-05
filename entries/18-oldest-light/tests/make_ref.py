"""Reference values from the Python pipeline for the node unit tests (tests/test_logic.js)."""
import json
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

HERE = Path(__file__).resolve().parent
ENTRY = HERE.parent
sys.path.insert(0, str(ENTRY))
import make_patch  # noqa: E402
from cmap import STOPS, colorize  # noqa: E402

OUT = ENTRY / "out"
meta = json.loads((OUT / "patch_meta.json").read_text(encoding="utf-8"))
fits = json.loads((OUT / "analysis.json").read_text(encoding="utf-8"))
cobe = json.loads((OUT / "analysis_cobe.json").read_text(encoding="utf-8"))
G = np.load(OUT / "grid_input.npy").astype(np.float64)
uK = G * meta["uK_per_unit"] + meta["t_lo_uK"]
rng = np.random.default_rng(18)
idx = [(0, 0), (0, 256), (256, 0), (256, 256), (128, 128)] + [tuple(int(v) for v in rng.integers(0, 257, 2)) for _ in range(10)]
lon, lat = make_patch.oblique_lonlat(257, 257)
L = fits[3]  # strength 0.5
A = np.load(OUT / f"{L['name']}.npy").astype(np.float64)
g_l = gaussian_filter(uK, L["sigma_px"], mode="reflect")
g_c = gaussian_filter(uK, cobe["sigma_px"], mode="reflect")
ref = {"idx": idx, "orig_units": [G[i, j] for i, j in idx], "lb": [[float(lon[i, j]), float(lat[i, j])] for i, j in idx],
       "level": {"strength": L["strength"], "sigma_px": L["sigma_px"], "shift": L["mean_shift_units"],
                 "uK": [float((A[i, j] - L["mean_shift_units"]) * meta["uK_per_unit"] + meta["t_lo_uK"]) for i, j in idx],
                 "gauss_uK": [float(g_l[i, j]) for i, j in idx]},
       "cobe_uK": [float(g_c[i, j]) for i, j in idx],
       "colors": {str(t): colorize(np.array([t]), 230.0)[0].tolist() for t in (-230.0, -100.0, 0.0, 57.5, 230.0)}}


# hot-spot census (the page's "galaxy seeds"): same rule as hotSpots()/census() in web/template.html
def hot_spots(V, sep=6):
    from scipy.ndimage import maximum_filter
    thr = 2 * V.std()
    M = maximum_filter(V, size=5, mode="nearest")
    n = V.shape[0]
    c = sorted([(V[i, j], i, j) for i, j in zip(*np.where((V >= M) & (V >= thr))) if 0 < i < n - 1 and 0 < j < n - 1], reverse=True)
    out = []
    for v, i, j in c:
        if all((i - a) ** 2 + (j - b) ** 2 >= sep * sep for _, a, b in out):
            out.append((v, i, j))
    return out


def census(R, P, m=4):
    near = lambda a, b: (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 <= m * m
    kept = sum(1 for r in R if any(near(r, p) for p in P))
    return {"kept": kept, "lost": len(R) - kept, "phantom": sum(1 for p in P if not any(near(r, p) for r in R))}


Aq = np.rint(A * 50) / 50   # the page ships engine outputs as uint16 at 0.02 grid units
q_uK = ((Aq - L["mean_shift_units"]) * meta["uK_per_unit"] + meta["t_lo_uK"]).astype(np.float32).astype(np.float64)
R = hot_spots(uK)
ref["census"] = {"roots": len(R), "q": census(R, hot_spots(q_uK)), "g": census(R, hot_spots(g_l)), "c": census(R, hot_spots(g_c))}
print("census", ref["census"])
(HERE / "ref.json").write_text(json.dumps(ref), encoding="utf-8")
print("tests/ref.json written")
