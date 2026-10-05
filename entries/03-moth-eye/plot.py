"""Draw reflectance_vs_layers.png (the brief's plot) and add view-averaged numbers to out/reflectance.json.

CLASSICAL. Inputs: out/reflectance.json (analyze.py, from the engine LUTs) and out/view_sweep.json
(render/measure_views.cjs: the page's own GPU meter at azimuth 0, tilt 0..85 degrees).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


def view_average(rows, kind):
    """Mean seen reflectance over every viewing direction in the front hemisphere (sin-weighted, 0..85 deg)."""
    el = np.radians([r["el"] for r in rows])
    w = np.sin(el)
    return float(np.trapezoid(np.array([r[kind] for r in rows]) * w, el) / np.trapezoid(w, el))


def main():
    rep = json.loads((OUT / "reflectance.json").read_text(encoding="utf-8"))
    views = json.loads((OUT / "view_sweep.json").read_text(encoding="utf-8"))
    for r in rep["results"]:
        rows = views["runs"][r["tag"]]["rows"]
        r["view_avg"] = {k: view_average(rows, k) for k in ("eye", "dome", "slab")}
        r["gpu_head_on"] = {k: rows[0][k] for k in ("eye", "dome", "slab")}
        cross = next((x["el"] for x in rows if x["slab"] > x["eye"]), None)
        r["slab_overtakes_eye_at_deg"] = cross
    rep["view_sweep_note"] = views["note"]
    (OUT / "reflectance.json").write_text(json.dumps(rep, indent=1), encoding="utf-8")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    # The brief-page look, as on the page and in the film: warm paper and ONE ultramarine ink, series told apart by
    # tint, weight, dash and marker (common/brand.css tokens --paper --ink --ink-2 --ink-3 --rule).
    bg, ink, ink2, ink3, rule = "#FBFAF9", "#19238E", "#545BA9", "#A1A4CE", "#D3D3E6"
    fg, haze, line = ink, ink2, rule
    res = rep["results"]
    sw = sorted([r for r in res if r["series"] == "sweep"], key=lambda r: r["layers"])
    ctl = sorted([r for r in res if r["series"] == "control"], key=lambda r: r["layers"])
    L = [r["layers"] for r in sw]
    fig, axes = plt.subplots(1, 3, figsize=(17, 5.4), facecolor=bg)
    for ax in axes:
        ax.set_facecolor(bg)
        for s in ax.spines.values():
            s.set_color(line)
        ax.tick_params(colors=haze)
        ax.xaxis.label.set_color(haze)
        ax.yaxis.label.set_color(haze)
        ax.grid(color=line, lw=0.6)
    leg = dict(facecolor=bg, edgecolor=ink, labelcolor=fg, fancybox=False)

    ax = axes[0]
    ax.plot(L, [r["lut_mean_R"] for r in sw], "-o", color=ink, lw=2.4, label="mean of R LUT (all angles x phases)")
    ax.plot(L, [r["hemi_R"] for r in sw], "-s", color=ink3, lw=2, label="shader, uniform sky (flat-slab albedo)")
    ax.plot(L, [r["normal_R"] for r in sw], "--^", color=ink2, lw=1.3, mfc=bg, label="shader at normal incidence")
    ax.plot(L, [r["lut_mean_T"] for r in sw], ":D", color=ink, lw=1.6, ms=4, mfc=bg, label="mean of T LUT (transmittance)")
    if ctl:
        ax.plot([r["layers"] for r in ctl], [r["lut_mean_R"] for r in ctl], "x", color=ink, ms=11, mew=2.2,
                label="control, interaction 0: mean R")
        ax.plot([r["layers"] for r in ctl], [r["lut_mean_T"] for r in ctl], "+", color=ink2, ms=12, mew=2.2,
                label="control, interaction 0: mean T")
    ax.set_ylim(0, 0.98)
    ax.set_xticks(range(1, 7))
    ax.set_xlabel("layers (incoming_rays = 6 throughout)")
    ax.set_ylabel("fraction of light")
    ax.set_title("1. More layers: R rises and saturates, T collapses", color=fg, loc="left", fontsize=11.5)
    ax.legend(fontsize=7.3, loc="upper center", ncol=2, **leg)

    ax = axes[1]
    for k, c, lab in (("eye", ink, "moth-eye facet (dome + nanopillars)"), ("dome", ink2, "bare dome"),
                      ("slab", ink3, "flat slab (control)")):
        ax.plot(L, [r["gpu_head_on"][k] for r in sw], "-o", color=c, lw=2 if k == "eye" else 1.4, label=f"{lab}, head-on")
        ax.plot(L, [r["view_avg"][k] for r in sw], "--", color=c, lw=1.2, label=f"{lab}, all directions")
    ax.set_xticks(range(1, 7))
    ax.set_ylim(0.15, 0.68)
    ax.set_xlabel("layers (incoming_rays = 6 throughout)")
    ax.set_ylabel("mean shader R over the visible object")
    ax.set_title("2. On the 3D mesh: head-on vs every direction", color=fg, loc="left", fontsize=11.5)
    ax.legend(fontsize=7.3, loc="upper center", ncol=2, **leg)

    ax = axes[2]
    six = views["runs"]["L6_R6"]["rows"]
    el = [x["el"] for x in six]
    for k, c, lab in (("eye", ink, "moth-eye facet"), ("dome", ink2, "bare dome"), ("slab", ink3, "flat slab")):
        ax.plot(el, [x[k] for x in six], "--o" if k == "dome" else "-o", ms=3, color=c, lw=2.4 if k == "eye" else 1.8,
                mfc=bg if k == "dome" else c, label=lab)
    x0 = next((x["el"] for x in six if x["slab"] > x["eye"]), None)
    if x0 is not None:
        ax.axvline(x0, color=ink3, lw=1.2, ls="--")
        ax.text(x0 + 1, 0.2, f"slab overtakes\nthe eye at {x0} deg", color=haze, fontsize=8)
    ax.set_xlabel("viewing tilt from the facet normal (degrees), 6 layers")
    ax.set_ylabel("mean shader R over the visible object")
    ax.set_ylim(0.15, 0.8)
    ax.set_title("3. Tilt test: pillars cost head-on, save from the side", color=fg, loc="left", fontsize=11.5)
    ax.legend(fontsize=8, loc="upper left", **leg)

    fig.text(0.01, 0.012, "entanglement-shader-v1 on Atlas (classical statevector simulator): reflectance 0.2, absorption 0.95, "
             "style peaked, resolution 60. Panels 2-3: classical WebGL2 meter (the page's own), 128x128 px, perspective camera, "
             "uThickness 500 nm; 'all directions' = sin-weighted mean over tilt 0-85 deg.", color=haze, fontsize=7.5)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(HERE / "reflectance_vs_layers.png", dpi=140, facecolor=bg)
    print("reflectance_vs_layers.png written")
    for r in sw + ctl:
        print(f"  {r['tag']:<11} head-on eye {r['gpu_head_on']['eye']:.3f} slab {r['gpu_head_on']['slab']:.3f} | "
              f"all-directions eye {r['view_avg']['eye']:.3f} dome {r['view_avg']['dome']:.3f} slab {r['view_avg']['slab']:.3f}"
              f" | slab > eye from {r['slab_overtakes_eye_at_deg']} deg")


if __name__ == "__main__":
    main()
