"""Quantify the five 1.10-degree probes from their FFTs. CLASSICAL analysis.

For each probe output, first-shell Bragg power (Hann window, 4096 zero-pad) is read at the four
orientations where something could sit, as a ratio to the spectrum's median:
  A  = theta0 - theta/2  (image1)          B  = theta0 + theta/2  (image2)
  A' = -(theta0 - theta/2) (mirror of A)   B' = -(theta0 + theta/2) (mirror of B)
For theta0 = 0 the pairs coincide (B == A', A == B'), which is the confound the offset removes.
"Leak" is B/A in layer A alone: how much of A's own peak spills onto B's position through the
window, i.e. the floor below which B cannot be told apart from A.

    python analyse_probes.py  -> out/probe_notes.json, printed table
"""
import csv
import json
import math
from pathlib import Path

import numpy as np

import lattice as L
import measure as M

HERE = Path(__file__).resolve().parent
TH = 1.10


def at(P, k):
    iy = int(round(k[1] / (2 * math.pi) * M.PAD))
    ix = int(round(k[0] / (2 * math.pi) * M.PAD))
    return P[np.ix_([(iy + d) % M.PAD for d in range(-2, 3)], [(ix + d) % M.PAD for d in range(-2, 3)])].max()


def bragg(img, theta0):
    P = np.abs(np.fft.fft2((img - img.mean()) * M.WIN, s=(M.PAD, M.PAD))) ** 2
    fl = float(np.median(P))
    g1 = [g for g, s in zip(M.GV, M.SHELL_OF) if s == 1]
    pos = {"A": theta0 - TH / 2, "B": theta0 + TH / 2, "A'": -(theta0 - TH / 2), "B'": -(theta0 + TH / 2)}
    return {k: float(np.mean([at(P, M.rot(g, a)) for g in g1]) / fl) for k, a in pos.items()}


NOTE = {
    (0.5, 0.0): "timing frame (9.8 s at 1024 px, 21 qubits). A 4 px register pattern dominates; the lattice is gone",
    (0.1, 0.0): "honeycomb visible, but with a symmetric twist B is the mirror of A, so 'B' peaks may be mirror copies",
    (0.25, 0.0): "speckle; same mirror ambiguity",
    (0.1, 15.0): "honeycomb visible, but layer B is weak; the mirror copy of A is 30x stronger than true B",
    (0.25, 15.0): "speckle; layer B clearly present. Chosen for the sweep (this job is also the 1.10 deg frame)",
}


def main():
    rows = list(csv.DictReader(open(HERE / "out" / "probes.csv", encoding="utf-8")))
    a_only = bragg(M.load(HERE / "inputs" / "A_r15_1.10.png"), 15.0)
    leak = a_only["B"] / a_only["A"]
    notes = []
    print(f"window leak floor (layer A alone, B/A) = {leak:.4f}")
    for r in rows:
        s, t0 = float(r["strength"]), float(r["theta0"])
        b = bragg(M.load(HERE / "out" / "probes" / r["file"]), t0)
        ratio = b["B"] / b["A"]
        print(f"s={s:<5} theta0={t0:<4}  A {b['A']:.3g}  B {b['B']:.3g}  A' {b[chr(65) + chr(39)]:.3g}  "
              f"B' {b['B' + chr(39)]:.3g}  B/A {ratio:.3f}  {r['job_id']}")
        note = NOTE[(s, t0)]
        if t0 == 15.0:
            note += f" (Bragg power B/A = {ratio:.2f}; A alone leaks {leak:.3f})"
        notes.append({"s": s, "r": "symmetric" if t0 == 0 else "15 deg offset", "note": note,
                      "j": r["job_id"], "A": b["A"], "B": b["B"], "mirrorA": b["A'"], "mirrorB": b["B'"]})
    (HERE / "out" / "probe_notes.json").write_text(json.dumps(notes, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
