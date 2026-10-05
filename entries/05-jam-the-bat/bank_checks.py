"""Classical sanity checks on the three jitter banks (not a certification, just a smoke test).

For each bank: monobit (binomial) test on all bits, chi-square of the 3-bit slot histogram (7 dof),
chi-square of the byte histogram (255 dof). Writes out/bank_checks.json. Offline: reads out/*.json.
"""
import json
from pathlib import Path

import numpy as np
from scipy.stats import binomtest, chi2

OUT = Path(__file__).resolve().parent / "out"
rows = []
for name in ["emu_20p0", "fez_148p8", "mar_148p8"]:
    b = bytes.fromhex(json.loads((OUT / f"{name}.json").read_text())["output"]["random"]["hex"])
    bits = np.unpackbits(np.frombuffer(b, dtype=np.uint8))
    k = len(bits) // 3
    slots = bits[: 3 * k].reshape(-1, 3) @ np.array([4, 2, 1])
    c = np.bincount(slots, minlength=8)
    xs = float(((c - k / 8) ** 2 / (k / 8)).sum())
    bc = np.bincount(np.frombuffer(b, dtype=np.uint8), minlength=256)
    xb = float(((bc - len(b) / 256) ** 2 / (len(b) / 256)).sum())
    r = {"bank": name, "bytes": len(b), "bits": int(len(bits)), "ones": int(bits.sum()),
         "monobit_p": round(binomtest(int(bits.sum()), len(bits)).pvalue, 4),
         "slots": int(k), "slot_counts": c.tolist(), "slot_chi2": round(xs, 2), "slot_p": round(float(chi2.sf(xs, 7)), 4),
         "byte_chi2": round(xb, 1), "byte_p": round(float(chi2.sf(xb, 255)), 4)}
    rows.append(r)
    print(f"{name:10s} {r['bytes']:6d} B  monobit p={r['monobit_p']:.3f}  slot chi2(7)={r['slot_chi2']:.2f} p={r['slot_p']:.3f}"
          f"  byte chi2(255)={r['byte_chi2']:.1f} p={r['byte_p']:.3f}")
(OUT / "bank_checks.json").write_text(json.dumps(rows, indent=1))
