"""hero.png: the submitted track as a click raster, plus token shares real vs reservoir. CLASSICAL plotting
of real data and real qrc-gen-v2 outputs (out/events.json).

Drawn in the same paper-and-ink look as the page (common/brand.css): warm paper, one ultramarine ink, hairline
rules. As on the page's timeline, real callers are in the lighter ink and the reservoir in solid ink on a faint band.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = Path(__file__).resolve().parent
# brand tokens (common/brand.css): --paper, --ink, --ink-2, --ink-3, --rule
PAPER, INK, INK2, INK3, RULE = "#FBFAF9", "#19238E", "#545BA9", "#A1A4CE", "#D3D3E6"
LANES = [1, 2, 3, 4, 5, 0]
NAMES = {1: "CALLER 1", 2: "CALLER 2", 3: "CALLER 3", 4: "CALLER 4", 5: "CALLERS 5-6", 0: "RESERVOIR"}
MONO = ["DejaVu Sans Mono"]
DISPLAY = ["Segoe UI Light", "DejaVu Sans"]          # a light sans heading, falling back to matplotlib's own font


def offsets(ev, D):
    if ev[3] >= 0:
        ici = [x / 10000 for x in D["icis"][ev[3]]]
    else:
        v = D["vocab"][ev[1]]
        ici = [x * v["d"] for x in v["r"]]
    return np.concatenate([[0.0], np.cumsum(ici)])


def hairlines(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(INK)
        ax.spines[s].set_linewidth(0.8)
    ax.tick_params(colors=INK2, width=0.8)


def main():
    D = json.loads((HERE / "out" / "events.json").read_text(encoding="utf-8"))
    tr = D["tracks"]["handoff"]
    plt.rcParams.update({"font.family": MONO, "font.size": 9, "text.color": INK, "axes.labelcolor": INK2,
                         "xtick.color": INK2, "ytick.color": INK2, "axes.edgecolor": INK,
                         "svg.hashsalt": "02-coda-reservoir"})
    fig = plt.figure(figsize=(14, 7.2), facecolor=PAPER)
    ax = fig.add_axes([0.08, 0.47, 0.9, 0.43], facecolor=PAPER)
    r = LANES.index(0)
    ax.axhspan(r - 0.5, r + 0.5, color=INK, alpha=0.045, lw=0)          # the reservoir lane, as on the page
    for y in range(len(LANES)):
        ax.axhline(y, color=RULE, lw=0.8, zorder=0)
    for ev in tr["ev"]:
        y = LANES.index(ev[2])
        ts = ev[0] + offsets(ev, D)
        ax.vlines(ts, y - 0.32, y + 0.32, color=INK if ev[2] == 0 else INK2, lw=0.9)
    ax.axvline(tr["split"], color=INK, ls="--", lw=1)
    ax.text(tr["split"] + 0.4, -0.75, "THE RESERVOIR TAKES OVER (qrc-gen-v2)", color=INK, va="center")
    ax.set_yticks(range(len(LANES)), [NAMES[l] for l in LANES])
    ax.set_ylim(len(LANES) - 0.4, -1.1)
    ax.set_xlim(0, tr["dur"])
    ax.set_xlabel("seconds")
    hairlines(ax)
    fig.text(0.08, 0.95, "Coda Reservoir: the submitted track (coda_reservoir.wav)", fontsize=17, color=INK,
             family=DISPLAY)
    fig.text(0.08, 0.915, f"{tr['real_n']} real codas (recorded clicks), then {tr['gen_n']} codas from a 12-qubit "
             "quantum reservoir (Atlas qrc-gen-v2, Aer simulator). One tick = one click. Caller labels are per recording.",
             color=INK2)

    ax2 = fig.add_axes([0.08, 0.08, 0.9, 0.28], facecolor=PAPER)
    nv = len(D["vocab"])
    order = sorted(range(nv), key=lambda i: -D["vocab"][i]["c"])
    corpus = np.array([D["vocab"][i]["c"] for i in order]) / D["total"]
    x = np.arange(nv)
    ax2.bar(x - 0.3, np.sqrt(corpus), 0.2, color=INK3, label="real corpus (3,840 codas)")
    vs = [v for v in D["variations"] if v in (1, 16, 64)]
    # variation 1 solid ink, 16 the lighter ink, 64 an ink outline: three readable tones of the one ink
    styles = [dict(color=INK), dict(color=INK2), dict(facecolor=PAPER, edgecolor=INK, linewidth=0.7)]
    for k, v in enumerate(vs):
        toks = [e[1] for e in D["tracks"][f"var_{v:g}"]["ev"]]
        share = np.bincount(toks, minlength=nv)[order] / len(toks)
        ax2.bar(x - 0.1 + 0.4 * k / max(len(vs) - 1, 1), np.sqrt(share), 0.4 / len(vs) * 0.9,
                label=f"reservoir, variation {v:g}", **styles[k % len(styles)])
    ax2.set_xticks(x, [D["vocab"][i]["t"] for i in order], rotation=90)
    ax2.set_ylabel("√ share of codas")
    ax2.yaxis.grid(True, color=RULE, lw=0.8)
    ax2.set_axisbelow(True)
    ax2.legend(frameon=False, ncol=4, loc="upper right", labelcolor=INK)
    hairlines(ax2)
    fig.text(0.08, 0.385, "Rhythm-token shares (take 1 at variation 1, 16 and 64). No meaning is claimed; "
             "codas are treated as rhythm tokens.", color=INK2)
    fig.savefig(HERE / "hero.png", dpi=110, facecolor=PAPER)
    print("hero.png written")


if __name__ == "__main__":
    main()
