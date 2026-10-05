"""Classical measurements of each blur-core-v1 output (no quantum step here).

For every completed job in out/jobs.json:
  * mean_shift_units: the engine rescales its output relative to the input's maximum, which moves the
    average; the page subtracts this shift for display (a classical, labelled step).
  * sigma_px / fwhm_arcmin: the classical Gaussian smoothing of the original grid that best matches
    the (mean-matched) engine output, by least squares over a sigma grid (0.05 px steps). The
    "equivalent beam" adds that FWHM in quadrature to the ILC map's own 1 degree resolution.
  * fit_rms_uK: how far the engine output still is from that best Gaussian (the blocky Gray-code
    residue that a real beam would not make).
  * detail_kept: correlation between the band-passed original and band-passed output (difference of
    Gaussians, sigma 1 px and 4 px = 11' and 45'): how much of the spot-scale pattern survives.
  * std_ratio: output / input standard deviation (a unitary blur shuffles weight rather than
    averaging it, so this stays near 1 while a Gaussian beam lowers it).
Writes out/analysis.json.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SIGMAS = np.round(np.arange(0.05, 16.0001, 0.05), 2)


def bandpass(X):
    return gaussian_filter(X, 1.0, mode="reflect") - gaussian_filter(X, 4.0, mode="reflect")


def corr(a, b):
    return float(np.corrcoef(a.ravel(), b.ravel())[0, 1])


def main():
    meta = json.loads((OUT / "patch_meta.json").read_text(encoding="utf-8"))
    upu, dpp = meta["uK_per_unit"], meta["deg_per_px"]
    G = np.load(OUT / "grid_input.npy").astype(np.float64)
    smooth = {s: gaussian_filter(G, s, mode="reflect") for s in SIGMAS}
    rows = []
    for job in json.loads((OUT / "jobs.json").read_text(encoding="utf-8")):
        if job["status"] != "completed" or job["grid"] != "sq":
            continue
        A = np.load(OUT / f"{job['name']}.npy").astype(np.float64)
        shift = float(A.mean() - G.mean())
        Am = A - shift
        rms = {s: float(np.sqrt(((smooth[s] - Am) ** 2).mean())) for s in SIGMAS}
        s_best = min(rms, key=rms.get)
        fwhm_arcmin = 2 * np.sqrt(2 * np.log(2)) * s_best * dpp * 60
        rows.append({"name": job["name"], "strength": job["strength"], "job_id": job["job_id"],
                     "mean_shift_units": round(shift, 3), "mean_shift_uK": round(shift * upu, 2),
                     "sigma_px": float(s_best), "fwhm_arcmin": round(float(fwhm_arcmin), 1),
                     "equiv_beam_deg": round(float(np.hypot(60.0, fwhm_arcmin) / 60), 3),
                     "fit_rms_uK": round(rms[s_best] * upu, 2),
                     "detail_kept": round(corr(bandpass(G), bandpass(A)), 3),
                     "detail_kept_gauss": round(corr(bandpass(G), bandpass(smooth[s_best])), 3),
                     "std_ratio": round(float(A.std() / G.std()), 3),
                     "std_ratio_gauss": round(float(smooth[s_best].std() / G.std()), 3),
                     "corr_with_original": round(corr(G, A), 4)})
    rows.sort(key=lambda r: r["strength"])
    # reference: an idealised, noise-free COBE-like view (7 deg total FWHM = the map's 1 deg plus 6.93 deg)
    s_cobe = float(np.sqrt(7.0 ** 2 - 1.0) / (2 * np.sqrt(2 * np.log(2))) / dpp)
    Gc = gaussian_filter(G, s_cobe, mode="reflect")
    cobe = {"name": "cobe_7deg_classical", "sigma_px": round(s_cobe, 3), "equiv_beam_deg": 7.0,
            "detail_kept": round(corr(bandpass(G), bandpass(Gc)), 3), "std_ratio": round(float(Gc.std() / G.std()), 3)}
    (OUT / "analysis_cobe.json").write_text(json.dumps(cobe, indent=1), encoding="utf-8")
    print(f"COBE-like 7 deg (classical): sigma {s_cobe:.2f} px, detail {cobe['detail_kept']}, std {cobe['std_ratio']}")
    (OUT / "analysis.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    for r in rows:
        print(f"s={r['strength']:<5} shift {r['mean_shift_uK']:+7.2f} uK  sigma {r['sigma_px']:5.2f} px  "
              f"beam {r['equiv_beam_deg']:.2f} deg  fit rms {r['fit_rms_uK']:5.1f} uK  detail {r['detail_kept']:.2f} "
              f"(gauss {r['detail_kept_gauss']:.2f})  std {r['std_ratio']:.3f} (gauss {r['std_ratio_gauss']:.3f})")


if __name__ == "__main__":
    main()
