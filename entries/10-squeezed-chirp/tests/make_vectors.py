"""Reference values from the Python pipeline for the page's pure-logic unit test (tests/test_page.js)."""
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import chirp  # noqa: E402

G = np.load(HERE / "out" / "grid_input.npy").astype(np.float64)
ax = json.loads((HERE / "out" / "axes.json").read_text(encoding="utf-8"))
tt, ff = np.asarray(ax["t_s"]), np.asarray(ax["f_hz"])
track = chirp.ridge_track(G, tt, ff)
ht, hf = int(round(0.03 / (tt[1] - tt[0]))), int(round(40.0 / (ff[1] - ff[0])))
vec = {"cells": [[int(i), int(j), float(G[i, j])] for i, j in [(0, 0), (10, 200), (190, 60), (256, 256)]],
       "time_cuts": [], "freq_cuts": []}
A4 = np.load(HERE / "out" / "r4.npy").astype(np.float64)
for r, c in list(zip(track["rows"], track["t_idx"]))[::10]:
    vec["time_cuts"].append({"j": int(r), "c": int(c), "orig": chirp._moment_width(G[:, r], int(c), ht)[0],
                             "r4": chirp._moment_width(np.round(A4[:, r] * 10) / 10, int(c), ht)[0]})
for c, r in list(zip(track["cols"], track["f_idx"]))[::10]:
    vec["freq_cuts"].append({"i": int(c), "c": int(r), "orig": chirp._moment_width(G[c, :], int(r), hf)[0],
                             "r4": chirp._moment_width(np.round(A4[c, :] * 10) / 10, int(r), hf)[0]})
(HERE / "tests" / "vectors.json").write_text(json.dumps(vec, indent=1), encoding="utf-8")
print("vectors:", len(vec["time_cuts"]), "time cuts,", len(vec["freq_cuts"]), "freq cuts")
