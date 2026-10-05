"""Measure the moire period in every engine output from its FFT. CLASSICAL analysis.

Geometry. Two honeycomb layers with lattice constant a, twisted by theta, have Bragg vectors
G_A and G_B = R(theta) G_A. Their difference dG = G_B - G_A is the moire reciprocal vector, with
|dG| = 2 |G| sin(theta/2), and the moire superlattice constant is

    L = a / (2 sin(theta/2)).

Method, per frame (nothing here reads the frame's theta):
  1. Hann-window the image, zero-pad to 4096 x 4096, take the power spectrum |FFT|^2.
  2. For every Bragg vector g of the input lattice below 0.45 cycles/px (18 vectors in 5 shells),
     sample the spectrum on an arc of radius |g| (+-2 %) over angles THETA0 +- 5 deg around g.
     THETA0 = 15 deg is the bilayer's fixed axis, the same for every frame. The engine's mirror
     copies sit at -THETA0, 30 deg away, outside these arcs.
  3. Normalise the arcs within each shell and average the shells. A twist splits every shell by
     the same angle, so the profile should show layer A at -theta/2 and layer B at +theta/2.
  4. FINAL rule ("symmetric pair"): the construction puts the two layers symmetrically about the
     axis, so score every split 2*delta by s(-delta) * s(+delta) on the smoothed, background-
     normalised profile, for delta >= delta_min, and take the best. delta_min is the FWHM of the
     single peak in the 0-degree frame (the instrument's own peak width). If the best pair sits
     on that boundary the frame is "unresolved". theta_m = 2 * delta.
     Null check: the 0-degree frame (no twist at all) also yields a best pair, made by the
     register itself. Any frame whose split lies within delta_min/2 of that null split is
     flagged "null": it cannot be told apart from the engine's own echo.
     The ring radius gives a_m = 4 pi / (sqrt3 |G_m|), and L_m = a_m / (2 sin(theta_m / 2)),
     the same as 4 pi / (sqrt3 |G_B - G_A|).
  5. The first rule tried ("naive": fit two free Gaussians to the profile) is kept in the output
     for the record. On the engine output it locks onto register satellites; see README.
The naive fit on the classical overlay (A + B)/2 of the two inputs is the method check.

Moire maps (for display, from a fixed band, independent of any fit): band-pass the image around
each first-shell Bragg direction at THETA0 with a tangential width covering twists up to 5 deg,
and sum the three envelopes |IFFT|. Bright = the two layers in phase (AA stacking). Made for the
engine output (out/maps/) and for the input overlay (out/maps_in/).

    python measure.py   -> out/measure.json, out/maps/, out/maps_in/
"""
from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d, map_coordinates
from scipy.optimize import curve_fit
from scipy.signal.windows import tukey

import lattice as L

HERE = Path(__file__).resolve().parent
N, PAD = 1024, 4096
WIN = np.outer(np.hanning(N), np.hanning(N))
B = 2 * math.pi * np.linalg.inv(np.array([L.A1, L.A2])).T
B_MAG = float(np.hypot(*B[0]))
ANG = np.round(np.arange(-5, 5.0001, 0.02), 4)        # angle offsets from THETA0, deg
BIN = 2 * math.pi / N


def rot(v, deg):
    p = math.radians(deg)
    c, s = math.cos(p), math.sin(p)
    return np.array([c * v[0] - s * v[1], s * v[0] + c * v[1]])


def _gvecs():
    out = []
    for i in range(-6, 7):
        for j in range(-6, 7):
            g = i * B[0] + j * B[1]
            f = np.hypot(*g) / (2 * math.pi)
            if 0 < f < 0.45 and -90 <= math.degrees(math.atan2(g[1], g[0])) < 90:   # one of each +-g
                out.append(g)
    return out


GV = _gvecs()
SHELL_OF = [int(round((np.hypot(*g) / B_MAG) ** 2)) for g in GV]      # 1, 3, 4, 7, 9


def load(p) -> np.ndarray:
    return np.asarray(Image.open(p).convert("L")).astype(np.float64) / 255


def power(img):
    P = np.abs(np.fft.fft2((img - img.mean()) * WIN, s=(PAD, PAD))) ** 2
    return np.fft.fftshift(P)


def angular_profiles(Ps, theta0=L.THETA0, rad=0.02):
    """Normalised angular profile per shell around theta0 (sum over that shell's vectors)."""
    per = {}
    for g, sh in zip(GV, SHELL_OF):
        gm = np.hypot(*g)
        ph = math.atan2(g[1], g[0]) + np.radians(theta0 + ANG)
        prof = np.zeros_like(ANG)
        for d in np.linspace(-rad, rad, 7):
            r = gm * (1 + d) / (2 * math.pi) * PAD
            prof += map_coordinates(Ps, [r * np.sin(ph) + PAD / 2, r * np.cos(ph) + PAD / 2], order=1)
        per[sh] = per.get(sh, 0) + prof
    return {sh: p / p.sum() for sh, p in per.items()}


def ring_radius(Ps, theta0=L.THETA0):
    """Measured first-shell |G| (rad/px): power-weighted radius of the strongest arc samples."""
    rs, ws = [], []
    for g, sh in zip(GV, SHELL_OF):
        if sh != 1:
            continue
        gm = np.hypot(*g)
        ph = math.atan2(g[1], g[0]) + np.radians(theta0 + ANG[::5])
        for d in np.linspace(-0.04, 0.04, 33):
            r = gm * (1 + d)
            v = map_coordinates(Ps, [r / (2 * math.pi) * PAD * np.sin(ph) + PAD / 2,
                                     r / (2 * math.pi) * PAD * np.cos(ph) + PAD / 2], order=1)
            rs.append(np.full_like(v, r))
            ws.append(v)
    rs, ws = np.concatenate(rs), np.concatenate(ws)
    top = ws >= np.percentile(ws, 99)
    return float(np.sum(rs[top] * ws[top]) / np.sum(ws[top]))


def _two(x, a1, m1, a2, m2, w, c):
    return a1 * np.exp(-(x - m1) ** 2 / (2 * w * w)) + a2 * np.exp(-(x - m2) ** 2 / (2 * w * w)) + c


def fit_doublet(prof):
    """Naive rule: two free Gaussians of equal width plus a constant."""
    sm = gaussian_filter1d(prof, 3)
    lm = [i for i in range(1, len(sm) - 1) if sm[i] > sm[i - 1] and sm[i] >= sm[i + 1]]
    lm = sorted(lm, key=lambda i: -sm[i])[:2]
    if not lm:
        return None
    if len(lm) == 1:
        lm.append(min(len(ANG) - 1, lm[0] + 15))
    p0 = [sm[lm[0]], ANG[lm[0]], sm[lm[1]], ANG[lm[1]], 0.2, float(np.median(sm))]
    try:
        p, _ = curve_fit(_two, ANG, prof, p0=p0, maxfev=20000,
                         bounds=([0, -5, 0, -5, 0.02, 0], [np.inf, 5, np.inf, 5, 2.5, np.inf]))
    except (RuntimeError, ValueError):
        return None
    a1, m1, a2, m2, w, c = (float(x) for x in p)
    if m2 < m1:
        a1, m1, a2, m2 = a2, m2, a1, m1
    sep = m2 - m1
    weak = min(a1, a2) / max(a1, a2) if max(a1, a2) > 0 else 0.0
    return {"m1": m1, "m2": m2, "a1": a1, "a2": a2, "w": w, "c": c, "sep": sep, "weak": weak,
            "resolved": bool(sep >= 2.3548 * w and weak >= 0.05)}


def measure(img):
    Ps = power(img)
    per = angular_profiles(Ps)
    comb = sum(per.values()) / len(per)
    f = fit_doublet(comb)
    a_m = 4 * math.pi / (math.sqrt(3) * ring_radius(Ps))
    out = {"a_meas": a_m, "fit": f, "profile": comb}
    if f and f["resolved"]:
        out["theta_meas"] = f["sep"]
        out["L"] = a_m / (2 * math.sin(math.radians(f["sep"]) / 2))
    return out


def norm_profile(p):
    p = np.asarray(p, float)
    return gaussian_filter1d(p / (np.median(p) + 0.01 * p.max()), 1.5)


def peak_fwhm(p):
    """FWHM (deg) of the single peak nearest the axis, above the median background."""
    s = gaussian_filter1d(np.asarray(p, float), 1.5)
    c = int(np.argmin(np.abs(ANG)))
    i = c - 25 + int(np.argmax(s[c - 25:c + 26]))
    half = (s[i] + np.median(s)) / 2
    lft, rgt = i, i
    while lft > 0 and s[lft] > half:
        lft -= 1
    while rgt < len(s) - 1 and s[rgt] > half:
        rgt += 1
    return float((rgt - lft) * (ANG[1] - ANG[0]))


def symmetric_pair(p, delta_min):
    """Final rule: best split 2*delta scored by s(-delta) * s(+delta), delta >= delta_min."""
    s = norm_profile(p)
    step = ANG[1] - ANG[0]
    c = int(np.argmin(np.abs(ANG)))
    ks = np.arange(int(round(delta_min / step)), c)
    score = s[c - ks] * s[c + ks]
    k = int(np.argmax(score))
    dx = 0.0
    if 0 < k < len(ks) - 1:
        y0, y1, y2 = np.log(score[k - 1]), np.log(score[k]), np.log(score[k + 1])
        den = y0 - 2 * y1 + y2
        dx = 0.0 if den == 0 else 0.5 * (y0 - y2) / den
    delta = float((ks[k] + dx) * step)
    bg = float(np.median(s))
    return {"delta": delta, "theta_m": 2 * delta, "edge": bool(k == 0),
            "A": float(s[c - ks[k]] / bg), "B": float(s[c + ks[k]] / bg)}


def moire_map(img, half_deg=2.5):
    """Envelope of the three first-shell Bragg directions, band-passed around THETA0 (fixed band)."""
    t = tukey(N, 0.2)
    F = np.fft.fft2((img - img.mean()) * np.outer(t, t))
    ky = np.fft.fftfreq(N)[:, None] * 2 * math.pi
    kx = np.fft.fftfreq(N)[None, :] * 2 * math.pi
    env = np.zeros((N, N))
    for g, sh in zip(GV, SHELL_OF):
        if sh != 1:
            continue
        c = rot(g, L.THETA0)
        u = c / np.hypot(*c)
        v = np.array([-u[1], u[0]])
        dr = (kx - c[0]) * u[0] + (ky - c[1]) * u[1]
        dt = (kx - c[0]) * v[0] + (ky - c[1]) * v[1]
        st = np.hypot(*c) * math.radians(half_deg) + 2.5 * BIN
        env += np.abs(np.fft.ifft2(F * np.exp(-dr ** 2 / (2 * (2.5 * BIN) ** 2) - dt ** 2 / (2 * st ** 2))))
    return env


STOPS = np.array([[13, 15, 23], [52, 40, 28], [237, 185, 92], [250, 236, 205]], float)


def to_png(m, path, lo=2, hi=99.7):
    a, b = np.percentile(m[100:-100, 100:-100], [lo, hi])
    v = np.clip((m - a) / (b - a + 1e-12), 0, 1)
    t = v * (len(STOPS) - 1)
    i = np.clip(t.astype(int), 0, len(STOPS) - 2)
    f = (t - i)[..., None]
    Image.fromarray((STOPS[i] * (1 - f) + STOPS[i + 1] * f).astype(np.uint8), "RGB").save(path, optimize=True)


def classify(result, delta_min):
    """status: ok | null (same split as the untwisted frame) | unresolved."""
    zero = [x for x in result if x["theta"] == 0.0]
    null = zero[0]["pair"]["theta_m"] if zero else None
    for x in result:
        if not x["resolved"]:
            x["status"] = "unresolved"
        elif null is not None and (x["theta"] == 0.0 or abs(x["pair"]["theta_m"] - null) < delta_min / 2):
            x["status"] = "null"
        else:
            x["status"] = "ok"
    return null


def band(ok, lo, hi):
    r = [x["L_meas"] / x["L_pred"] for x in ok if lo <= x["theta"] <= hi]
    return {"n": len(r), "median": round(float(np.median(r)), 3), "min": round(min(r), 3),
            "max": round(max(r), 3)} if r else None


def _r(x, n=3):
    return None if x is None else round(float(x), n)


def main():
    rows = [r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    for d in ("maps", "maps_in"):
        (HERE / "out" / d).mkdir(parents=True, exist_ok=True)
    meas = []
    for r in rows:
        th = float(r["theta"])
        out_img = load(HERE / "out" / "frames" / r["file"])
        pa, pb = L.make_pair(th, HERE / "inputs")
        ref_img = (load(pa) + load(pb)) / 2
        m, ref = measure(out_img), measure(ref_img)
        to_png(moire_map(out_img), HERE / "out" / "maps" / f"map_{th:.2f}.png")
        to_png(moire_map(ref_img), HERE / "out" / "maps_in" / f"map_{th:.2f}.png")
        meas.append((r, th, m, ref))
        print(f"  analysed {th:.2f}", flush=True)
    zero = [m for r, th, m, ref in meas if th == 0.0]
    delta_min = peak_fwhm(zero[0]["profile"]) if zero else 0.32
    result = []
    for r, th, m, ref in meas:
        sp = symmetric_pair(m["profile"], delta_min)
        pred = L.predicted_period(th)
        L_m = None if sp["edge"] else m["a_meas"] / (2 * math.sin(math.radians(sp["theta_m"]) / 2))
        f = m["fit"] or {}
        rec = {"theta": th, "job_id": r["job_id"], "file": r["file"],
               "L_pred": None if math.isinf(pred) else round(pred, 2),
               "L_meas": _r(L_m, 2), "theta_meas": None if sp["edge"] else _r(sp["theta_m"]),
               "resolved": not sp["edge"],
               "pair": {k: (_r(v, 4) if isinstance(v, float) else v) for k, v in sp.items()},
               "a_meas": _r(m["a_meas"], 4),
               "naive": {"L": _r(m.get("L"), 2), "theta_m": _r(m.get("theta_meas")),
                         "fit": {k: (_r(v, 5) if isinstance(v, float) else v) for k, v in f.items()}},
               "L_ref": _r(ref.get("L"), 2), "theta_ref": _r(ref.get("theta_meas")),
               "profile": [round(float(x), 6) for x in m["profile"][::2]],
               "profile_ref": [round(float(x), 6) for x in ref["profile"][::2]]}
        result.append(rec)
        print(f"theta {th:4.2f}  pred {rec['L_pred'] or float('inf'):7.1f}  meas {rec['L_meas'] or float('nan'):7.1f}"
              f"  th_m {rec['theta_meas'] or float('nan'):5.2f}  naive {rec['naive']['L'] or float('nan'):7.1f}"
              f"  ref {rec['L_ref'] or float('nan'):7.1f}  {'ok' if rec['resolved'] else 'unresolved'}")
    classify(result, delta_min)
    ok = [x for x in result if x["status"] == "ok" and x["L_pred"]]
    ratios = [x["L_meas"] / x["L_pred"] for x in ok]

    def slope(lo, hi):
        pts = [(x["theta"], x["pair"]["theta_m"]) for x in result if x["resolved"] and lo <= x["theta"] <= hi]
        if len(pts) < 3:
            return None
        t, y = np.array(pts).T
        return round(float(np.polyfit(t, y, 1)[0]), 3)

    refs = [x["L_ref"] / x["L_pred"] for x in result if x["L_ref"] and x["L_pred"]]
    nulls = [x["theta"] for x in result if x["status"] == "null"]
    summary = {"delta_min_deg": round(delta_min, 3), "null_split_deg": result[0]["pair"]["theta_m"],
               "n_frames": len(result), "n_ok": len(ok), "null_frames": nulls,
               "unresolved_frames": [x["theta"] for x in result if x["status"] == "unresolved"],
               "first_resolved_deg": min((x["theta"] for x in ok), default=None),
               "ratio_median": round(float(np.median(ratios)), 3) if ratios else None,
               "ratio_min": round(min(ratios), 3) if ratios else None,
               "ratio_max": round(max(ratios), 3) if ratios else None,
               "slope_1.05_1.40": slope(1.05, 1.40), "slope_1.5_5.0": slope(1.5, 5.0),
               "ref_n": len(refs), "ref_ratio_min": round(min(refs), 4) if refs else None,
               "ref_ratio_max": round(max(refs), 4) if refs else None,
               "band_1.5_5.0": band(ok, 1.5, 5.0),
               "naive_within_10pct": sum(1 for x in result if x["naive"]["L"] and x["L_pred"]
                                         and abs(x["naive"]["L"] / x["L_pred"] - 1) < 0.1)}
    print(json.dumps(summary, indent=1))
    (HERE / "out" / "measure.json").write_text(json.dumps({"angles_deg": [float(x) for x in ANG[::2]],
                                                           "a_px": L.A, "theta0": L.THETA0, "summary": summary,
                                                           "frames": result}, indent=1), encoding="utf-8")
    print(f"{len(result)} frames measured -> out/measure.json")


if __name__ == "__main__":
    main()
