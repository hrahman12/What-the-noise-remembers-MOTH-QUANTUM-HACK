"""The measurement plot: moire period read from each quantum-morph frame vs a/(2 sin(theta/2)).
CLASSICAL. Reads out/measure.json, writes measurement_plot.png (two panels: period, and split).

    python plot_measure.py
"""
import json
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

import lattice as L  # noqa: E402

HERE = Path(__file__).resolve().parent
# brief-page palette (common/brand.css): paper ground, one ultramarine ink, orange only for the register echo
PAPER, PANEL, RULE, INK, INK2, INK3, WARN = "#FBFAF9", "#FFFFFF", "#D3D3E6", "#19238E", "#545BA9", "#A1A4CE", "#B4541A"
NIGHT, DUSK, LINE, MOON, HAZE = PAPER, PANEL, RULE, INK, INK2


def main():
    d = json.loads((HERE / "out" / "measure.json").read_text(encoding="utf-8"))
    F, S = d["frames"], d["summary"]
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11, "text.color": MOON, "axes.labelcolor": MOON,
                         "xtick.color": HAZE, "ytick.color": HAZE, "axes.edgecolor": LINE})
    fig, (ax, bx) = plt.subplots(1, 2, figsize=(14, 6), facecolor=NIGHT, gridspec_kw={"width_ratios": [1.25, 1]})
    for a in (ax, bx):
        a.set_facecolor(DUSK)
        a.grid(color=LINE, lw=0.6)
        a.axvline(1.1, color=INK, ls=(0, (4, 4)), lw=1.2)
    th = np.linspace(0.3, 5, 400)
    ax.plot(th, [L.predicted_period(t) for t in th], color=INK2, lw=2.5, label="predicted  L = a / (2 sin θ/2)")
    ok = [f for f in F if f["status"] == "ok"]
    nu = [f for f in F if f["status"] == "null"]
    un = [f for f in F if f["status"] == "unresolved"]
    ref = [f for f in F if f["L_ref"]]
    ax.scatter([f["theta"] for f in ref], [f["L_ref"] for f in ref], s=46, facecolors="none", edgecolors=INK3,
               lw=1.3, label="original layers, plain fit (method check)", zorder=3)
    ax.scatter([f["theta"] for f in ok], [f["L_meas"] for f in ok], s=30, color=MOON, zorder=4,
               label=f"quantum morph, tracks the twist ({len(ok)})")
    ax.scatter([f["theta"] for f in nu], [f["L_meas"] for f in nu], s=50, marker="D", facecolors="none",
               edgecolors=WARN, lw=1.4, zorder=4, label=f"quantum morph, register echo ({len(nu)})")
    ax.scatter([f["theta"] for f in un], [20] * len(un), s=40, marker="x", color=INK3, zorder=4,
               label=f"quantum morph, unresolved ({len(un)})")
    ax.set_ylim(0, 1000)
    ax.set_xlim(0, 5.1)
    ax.set_xlabel("twist θ (deg)")
    ax.set_ylabel("moire period L (px, a = 8 px)")
    ax.text(1.14, 960, "1.1° magic angle", color=INK, fontsize=10)
    ax.legend(facecolor=NIGHT, edgecolor=LINE, labelcolor=MOON, fontsize=9, loc="upper right")
    bd = S["band_1.5_5.0"]
    ax.set_title(f"Period from each telablur-v1 frame (21 qubits, 1024² px)\n"
                 f"1.5–5°: {bd['n']} frames, median {bd['median']:.2f} of predicted, range {bd['min']:.2f}–{bd['max']:.2f}",
                 color=MOON, fontsize=12, loc="left")
    # right: the split itself against the true twist, with the echo line
    bx.plot([0, 5], [0, 5], color=INK2, lw=2, label="split = twist")
    bx.axhline(S["null_split_deg"], color=WARN, ls=":", lw=1.5,
               label=f"register echo in the 0° frame ({S['null_split_deg']:.2f}°)")
    bx.axhspan(0, 2 * S["delta_min_deg"], color=RULE, alpha=0.6, label="below the resolution limit")
    bx.scatter([f["theta"] for f in ok], [f["theta_meas"] for f in ok], s=30, color=MOON, zorder=4)
    bx.scatter([f["theta"] for f in nu], [f["theta_meas"] for f in nu], s=50, marker="D", facecolors="none",
               edgecolors=WARN, lw=1.4, zorder=4)
    bx.set_xlim(0, 5.1)
    bx.set_ylim(0, 5.1)
    bx.set_xlabel("true twist θ (deg)")
    bx.set_ylabel("split of the symmetric peak pair (deg)")
    bx.set_title(f"Slope 1.5–5°: {S['slope_1.5_5.0']:.2f}   ·   slope 1.05–1.40°: {S['slope_1.05_1.40']:.2f}",
                 color=MOON, fontsize=12, loc="left")
    bx.legend(facecolor=NIGHT, edgecolor=LINE, labelcolor=MOON, fontsize=9, loc="upper left")
    fig.text(0.01, 0.01, "Measurement is classical (FFT of each engine output). Engine: Atlas telablur-v1, statevector "
             "simulator. Geometry only: no band structure is simulated.", color=HAZE, fontsize=9)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    fig.savefig(HERE / "measurement_plot.png", dpi=110, facecolor=NIGHT)
    print("measurement_plot.png written")


if __name__ == "__main__":
    main()
