"""Compose hero.png and sweep.png from the real engine outputs (classical layout/colour step only).

hero.png : original WMAP patch and the strength 0.25 / 0.5 / 1.0 blur-core-v1 outputs (18 qubits),
           with the full-sky locator. sweep.png: all six engine outputs (top) above the classical
           Gaussian beam of the same fitted width (bottom). Engine outputs are shown with the engine's
           average shift removed and the same colour map as the original (see README).

Drawn in the Moth Hack brief palette the page uses (common/brand.css): warm paper #FBFAF9, one ultramarine ink
#19238E for text and 1 px hairline frames, mono captions. The sky images keep their data colour map (cmap.py).
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from scipy.ndimage import gaussian_filter  # noqa: E402

from build_web import moll_xy  # noqa: E402
from cmap import colorize  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
PAPER, INK, INK2 = "#FBFAF9", "#19238E", "#545BA9"   # --paper, --ink, --ink-2 in common/brand.css
SANS, MONO = ["Segoe UI", "DejaVu Sans"], ["Consolas", "DejaVu Sans Mono"]   # local stand-ins for Geist / IBM Plex Mono
S = 230.0


def pct(x):
    """Whole percent, rounded half up like the page's Math.round (0.985 -> 99%; the unrounded value is 0.98524)."""
    return f"{int(np.floor(x * 100 + 0.5))}%"


def load():
    meta = json.loads((OUT / "patch_meta.json").read_text(encoding="utf-8"))
    fits = json.loads((OUT / "analysis.json").read_text(encoding="utf-8"))
    G = np.load(OUT / "grid_input.npy").astype(np.float64)
    toT = lambda X: X * meta["uK_per_unit"] + meta["t_lo_uK"]  # noqa: E731
    outs = {f["strength"]: (toT(np.load(OUT / f"{f['name']}.npy").astype(np.float64) - f["mean_shift_units"]), f) for f in fits}
    return meta, fits, G, toT, outs


def panel(ax, T, title, sub=""):
    ax.imshow(colorize(T, S), interpolation="bicubic")
    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_color(INK); sp.set_linewidth(0.8)
    ax.set_title(title, color=INK, fontsize=11, loc="left", pad=6, family=SANS)
    if sub:
        ax.text(0, -0.035, sub, transform=ax.transAxes, color=INK2, fontsize=7.5, va="top", family=MONO)


def main():
    meta, fits, G, toT, outs = load()
    fig = plt.figure(figsize=(16, 4.5), facecolor=PAPER)
    gs = fig.add_gridspec(1, 5, width_ratios=[1.35, 1, 1, 1, 1], wspace=0.06, left=0.02, right=0.99, top=0.80, bottom=0.11)
    ax = fig.add_subplot(gs[0]); ax.set_facecolor(PAPER)
    sky = np.load(OUT / "sky_moll.npy") * 1000
    ax.imshow(np.dstack([colorize(sky, S), np.where(np.isnan(sky), 0, 255).astype(np.uint8)])); ax.axis("off")   # off-sky transparent, as on the page
    ol = np.array(meta["outline_lb"] + meta["outline_lb"][:1])
    x, y = moll_xy(ol[:, 0], ol[:, 1], meta["moll_centre_l"])
    ax.plot(x * sky.shape[1], y * sky.shape[0], color=PAPER, lw=2.6)   # the page's outline: paper stroke, ink core
    ax.plot(x * sky.shape[1], y * sky.shape[0], color=INK, lw=1.0)
    ax.set_title("Whole sky, WMAP 9-year ILC\n(centred on the patch, l = 209°, b = −57°)", color=INK2, fontsize=9, loc="left", family=SANS)
    panel(fig.add_subplot(gs[1]), toT(G), "Original patch, 48°", "NASA WMAP / LAMBDA, 1° resolution")
    for k, s in enumerate([0.25, 0.5, 1.0]):
        T, f = outs[s]
        panel(fig.add_subplot(gs[2 + k]), T, f"Quantum blur, strength {s:g}",
              f"blur-core-v1, 18 qubits, job {f['job_id'][:8]}\n≈ {f['equiv_beam_deg']:.2f}° beam, spot pattern kept {pct(f['detail_kept'])}")
    fig.text(0.02, 0.91, "Oldest Light", color=INK, fontsize=22, family=["Segoe UI Light"] + SANS)   # light heading, like the page
    fig.text(0.155, 0.915, "the cosmic microwave background, blurred by an 18-qubit quantum circuit (Atlas statevector simulator) as an analogy for a telescope's beam",
             color=INK2, fontsize=10, family=SANS)
    fig.savefig(HERE / "hero.png", dpi=110, facecolor=PAPER)
    plt.close(fig)

    fig, axs = plt.subplots(2, 7, figsize=(17, 5.6), facecolor=PAPER)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.88, bottom=0.08, wspace=0.05, hspace=0.32)
    T0 = toT(G)
    panel(axs[0, 0], T0, "original"); panel(axs[1, 0], T0, "original")
    for k, f in enumerate(fits):
        T, _ = outs[f["strength"]]
        panel(axs[0, k + 1], T, f"quantum s={f['strength']:g}", f"job {f['job_id'][:8]}, kept {pct(f['detail_kept'])}")
        panel(axs[1, k + 1], gaussian_filter(T0, f["sigma_px"], mode="reflect"), f"Gaussian {f['equiv_beam_deg']:.2f}°",
              f"classical, sigma {f['sigma_px']:.2f} px, kept {pct(f['detail_kept_gauss'])}")
    fig.text(0.01, 0.95, "Top: blur-core-v1 outputs (18 qubits, statevector simulator). Bottom: classical Gaussian beam with the best-fit width.",
             color=INK, fontsize=11, family=SANS)
    fig.savefig(HERE / "sweep.png", dpi=100, facecolor=PAPER)
    plt.close(fig)
    print("hero.png and sweep.png written")


if __name__ == "__main__":
    main()
