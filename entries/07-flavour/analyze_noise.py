"""How the measured errors are structured, per machine. CLASSICAL analysis of the decoded qpixl outputs.

Residual = (measured - exact) / curve maximum, in the order the values were sent (4 curves concatenated).
Reports the lag-1 correlation of residuals, and the mean |jump| between neighbouring residuals inside
vs across 4-value-aligned blocks. Writes out/noise_stats.json.
"""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
stats = {}
for f in sorted((HERE / "out").glob("qpixl_*.json")):
    r = json.loads(f.read_text(encoding="utf-8"))
    s = np.array(r["scale"])
    res = ((np.array(r["measured"]) - np.array(r["exact"])) / s[:, None]).ravel()
    d = np.abs(np.diff(res))
    cross = (np.arange(len(d)) + 1) % 4 == 0
    stats[r["machine"]] = {"values": len(res), "lag1_corr": round(float(np.corrcoef(res[:-1], res[1:])[0, 1]), 3),
                           "jump_inside_block4": round(float(d[~cross].mean()), 4),
                           "jump_across_block4": round(float(d[cross].mean()), 4),
                           "rms_normalised": round(float(np.sqrt(np.mean(res ** 2))), 4)}
(HERE / "out" / "noise_stats.json").write_text(json.dumps(stats, indent=1), encoding="utf-8")
for m, v in stats.items():
    print(f"  {m:16s} lag1 {v['lag1_corr']:+.3f}  jump in/across 4-blocks {v['jump_inside_block4']:.4f} / "
          f"{v['jump_across_block4']:.4f}  rms {v['rms_normalised']:.4f}")
