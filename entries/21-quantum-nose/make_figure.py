"""hero.png: piano rolls of every chord, input vs each completed blur job. CLASSICAL plotting of real data.

Rows: the three molecules, normal (H) and deuterated (D). Columns: the input score, then each
completed blur-midi-v1 job (out/jobs.csv). Every blurred panel is drawn from a downloaded engine MIDI.
"""
from __future__ import annotations

import csv
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from spectra import BIN_CM, MOLECULES, ORDER  # noqa: E402
from synth import read_tracks  # noqa: E402

HERE = Path(__file__).resolve().parent
# brand palette (common/brand.css): paper ground, one ultramarine ink, hairline rules
BG, PANEL, INK, INK2, RULE = "#FBFAF9", "#FFFFFF", "#19238E", "#545BA9", "#D3D3E6"


def main():
    cols = [("input score\n(no quantum step)", HERE / "midi" / "nose_input.mid")]
    done = [r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    for r in sorted(done, key=lambda r: (float(r["reach"]), float(r["strength"]))):
        cols.append((f"blur-midi-v1\nstrength {float(r['strength']):g}, reach {float(r['reach']):g}", HERE / r["file"]))
    data = [read_tracks(p) for _, p in cols]
    rows = [(m, iso) for m in ORDER for iso in ("H", "D")]
    fig, axes = plt.subplots(len(rows), len(cols), figsize=(2.3 * len(cols) + 1, 1.45 * len(rows) + 1),
                             sharex=True, sharey=True, squeeze=False)
    fig.patch.set_facecolor(BG)
    for i, (m, iso) in enumerate(rows):
        for j, tr in enumerate(data):
            ax = axes[i][j]
            ax.set_facecolor(PANEL)
            for t0, t1, b, v in tr.get(f"{m} {iso}", []):
                ax.plot([t0, max(t1, t0 + 0.02)], [b * BIN_CM] * 2, color=INK if j else INK2,
                        lw=2.2, alpha=0.3 + 0.7 * v / 127, solid_capstyle="butt")
            ax.set_ylim(400, 3250)
            ax.set_xlim(0, 7.1)
            ax.tick_params(colors=INK2, labelsize=6)
            for s in ax.spines.values():
                s.set_color(RULE)
            if i == 0:
                ax.set_title(cols[j][0], color=INK, fontsize=7)
            if j == 0:
                name = MOLECULES[m]["name"] if iso == "H" else MOLECULES[m]["d_name"]
                ax.set_ylabel(name, color=INK, fontsize=7)
    fig.text(0.5, 0.01, "time (s)  |  vertical axis: wavenumber, cm$^{-1}$ (x 0.25 = Hz)", color=INK2,
             ha="center", fontsize=7)
    fig.suptitle("The Quantum Nose Test: six vibrational chords, before and after a 20-qubit quantum blur",
                 color=INK, fontsize=9)
    fig.tight_layout(rect=(0, 0.03, 1, 0.96))
    fig.savefig(HERE / "hero.png", dpi=150, facecolor=BG)
    print("hero.png written")


if __name__ == "__main__":
    main()
