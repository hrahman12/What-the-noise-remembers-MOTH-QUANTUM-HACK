"""Squeezed Chirp analysis: widths, classical reference, Griffin-Lim WAVs, figures. CLASSICAL.

Reads the real blur-core-v1 outputs saved by run_blur.py (out/*.npy, out/jobs.json) and writes
  out/widths.json        ridge widths for the original and every engine output (+ robustness)
  out/audio/*.wav        Griffin-Lim resynthesis of each version (8x slower, 4x higher)
  out/widths_vs_ratio.png, out/panels.png, hero.png
Nothing here calls Atlas or alters an engine output; the classical Gaussian reference is labelled.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

import chirp

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
VERSIONS = ["original", "r0p25", "r0p5", "r1", "r2", "r4"]
LABEL = {"original": "original", "r0p25": "r = 1/4", "r0p5": "r = 1/2", "r1": "r = 1", "r2": "r = 2",
         "r4": "r = 4", "iso_control": "isotropic control"}


def load():
    G = np.load(OUT / "grid_input.npy").astype(np.float64)
    ax = json.loads((OUT / "axes.json").read_text(encoding="utf-8"))
    tt, ff = np.asarray(ax["t_s"]), np.asarray(ax["f_hz"])
    jobs = {j["name"]: j for j in json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))}
    grids = {"original": G}
    for name, j in jobs.items():
        if j["status"] == "completed":
            grids[name] = np.load(OUT / f"{name}.npy").astype(np.float64)
    return G, tt, ff, jobs, grids


def classical_reference(G, ratio, sigma_product_px2):
    """CLASSICAL anisotropic Gaussian blur with sigma_t * sigma_f fixed (in grid cells^2) and
    sigma_t / sigma_f = ratio. A comparison only: it is not an engine output."""
    st, sf = np.sqrt(sigma_product_px2 * ratio), np.sqrt(sigma_product_px2 / ratio)
    return gaussian_filter(G, sigma=(st, sf), mode="constant")


def all_widths(G, tt, ff, grids, jobs):
    track = chirp.ridge_track(G, tt, ff)
    res = {"track": {"time_width_rows_hz": [float(ff[r]) for r in (track["rows"][0], track["rows"][-1])],
                     "freq_width_cols_s": [float(tt[c]) for c in (track["cols"][0], track["cols"][-1])]},
           "versions": {}, "robustness": {}, "classical": {}}
    for name, A in grids.items():
        w = chirp.ridge_widths(A, track, tt, ff)
        res["versions"][name] = {k: round(float(v), 4) for k, v in w.items()}
        if name in jobs:
            res["versions"][name].update({"ratio": jobs[name]["ratio"], "strength": jobs[name]["strength"],
                                          "job_id": jobs[name]["job_id"]})
    # robustness: does the trend survive other measurement windows?
    for ht, hf in [(0.02, 30.0), (0.03, 40.0), (0.04, 60.0)]:
        key = f"half_t={int(ht*1e3)}ms,half_f={int(hf)}Hz"
        res["robustness"][key] = {n: {k: round(float(v), 4) for k, v in
                                      chirp.ridge_widths(grids[n], track, tt, ff, half_t=ht, half_f=hf).items()}
                                  for n in VERSIONS if n in grids}
    # classical reference at the five ratios, sigma product chosen once (2 cells^2), not fitted per ratio
    for r in (0.25, 0.5, 1.0, 2.0, 4.0):
        B = classical_reference(G, r, 2.0)
        res["classical"][f"{r:g}"] = {k: round(float(v), 4) for k, v in chirp.ridge_widths(B, track, tt, ff).items()}
    (OUT / "widths.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    return res, track


# ---------------------------------------------------------------- audio
GATE_PCT = 95   # noise gate: subtract the original grid's 95th percentile (classical, for listening only)


def render_audio(G, tt, ff, grids, n_iter=80):
    """Griffin-Lim each version from the SAME magnitude mapping, the SAME floor and the SAME random
    initial phase, then apply ONE common gain, so loudness differences between versions are real."""
    floor = float(np.percentile(G, GATE_PCT))   # one gate level, from the ORIGINAL grid
    adir = OUT / "audio"
    adir.mkdir(exist_ok=True)
    xs = {}
    for name in VERSIONS:
        if name not in grids:
            continue
        A = np.clip(grids[name] - floor, 0, None)        # same noise-floor gate for every version
        M = chirp.to_audio_mag(A, tt, ff)
        xs[name] = chirp.griffin_lim(M, n_iter=n_iter, seed=0)
    gain = 0.85 / max(np.max(np.abs(x)) for x in xs.values())
    info = {}
    for name, x in xs.items():
        dur = chirp.write_wav(adir / f"{name}.wav", x * gain, peak=None)
        info[name] = {"file": f"out/audio/{name}.wav", "seconds": round(dur, 3),
                      "peak": round(float(np.max(np.abs(x * gain))), 4)}
    (adir / "audio.json").write_text(json.dumps({"floor": floor, "gate_percentile": GATE_PCT, "t0_s": chirp.AUDIO_T0,
                                                 "t1_s": float(tt[-1]), "slow": chirp.SLOW, "pitch": chirp.PITCH,
                                                 "fs": chirp.AUDIO_FS, "gl_iters": n_iter, "files": info},
                                                indent=1), encoding="utf-8")
    return info


# ---------------------------------------------------------------- figures
def wing_cmap():
    from matplotlib.colors import LinearSegmentedColormap
    return LinearSegmentedColormap.from_list("wing", ["#0D0F17", "#2A2033", "#7A4E22", "#EDB95C", "#FFF4DC"])


def figures(G, tt, ff, grids, widths):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    cm = wing_cmap()
    ext = [tt[0] * 1e3, tt[-1] * 1e3, ff[0], ff[-1]]
    vmax = np.sqrt(G.max())
    names = [n for n in VERSIONS if n in grids]
    fig, axs = plt.subplots(1, len(names), figsize=(3.2 * len(names), 3.6), facecolor="#0D0F17")
    for a, n in zip(axs, names):
        a.imshow(np.sqrt(grids[n]).T, origin="lower", aspect="auto", extent=ext, cmap=cm, vmin=0, vmax=vmax,
                 interpolation="nearest")
        w = widths["versions"][n]
        a.set_title(f"{LABEL[n]}\n{w['time_width_ms']:.2f} ms · {w['freq_width_hz']:.2f} Hz", color="#E7EAF4", fontsize=9)
        a.set_xlim(-150, 60)
        a.set_ylim(20, 320)
        a.tick_params(colors="#959BB2", labelsize=7)
        for s in a.spines.values():
            s.set_color("#2B3046")
    axs[0].set_ylabel("frequency (Hz)", color="#959BB2")
    fig.supxlabel("time from merger (ms)   ·   GW150914, LIGO H1+L1   ·   blur-core-v1, 18 qubits, Atlas simulator",
                  color="#959BB2", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "panels.png", dpi=110, facecolor=fig.get_facecolor())
    fig.savefig(HERE / "hero.png", dpi=110, facecolor=fig.get_facecolor())
    plt.close(fig)

    ratios = [0.25, 0.5, 1, 2, 4]
    keys = ["r0p25", "r0p5", "r1", "r2", "r4"]
    o = widths["versions"]["original"]
    fig, ax = plt.subplots(1, 2, figsize=(9, 3.6))
    for a, k, unit in [(ax[0], "time_width_ms", "ms"), (ax[1], "freq_width_hz", "Hz")]:
        q = [widths["versions"][x][k] for x in keys]
        c = [widths["classical"][f"{r:g}"][k] for r in ratios]
        a.plot(ratios, q, "o-", color="#C98A1E", label="blur-core-v1 (quantum circuit, simulator)")
        a.plot(ratios, c, "s--", color="#6B7390", label="Gaussian blur (classical reference)")
        a.axhline(o[k], color="k", lw=0.8, ls=":", label="original")
        a.set_xscale("log", base=2)
        a.set_xticks(ratios, ["1/4", "1/2", "1", "2", "4"])
        a.set_xlabel("squeeze ratio r = s_time / s_freq")
        a.set_ylabel(f"ridge {k.split('_')[0]}-width ({unit})")
    ax[0].legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(OUT / "widths_vs_ratio.png", dpi=110)
    plt.close(fig)


def main():
    G, tt, ff, jobs, grids = load()
    widths, _ = all_widths(G, tt, ff, grids, jobs)
    audio = render_audio(G, tt, ff, grids)
    figures(G, tt, ff, grids, widths)
    for n in VERSIONS + ["iso_control"]:
        if n in widths["versions"]:
            w = widths["versions"][n]
            print(f"  {n:12s} time {w['time_width_ms']:7.3f} ms   freq {w['freq_width_hz']:7.3f} Hz")
    print("  audio:", {k: v["seconds"] for k, v in audio.items()})


if __name__ == "__main__":
    main()
