"""Parse the engine's R/T lookup tables and measure reflectance vs layers. CLASSICAL post-processing.

Inputs: out/jobs.csv and out/jobs/<tag>/{R_lut.exr,T_lut.exr,entanglement_texture.glsl} (real engine outputs).
Outputs:
  out/reflectance.json        every number used by the README, the plot and the page
  web/data/luts.json          the LUTs themselves (float32, base64) for the interactive page
(plot.py draws reflectance_vs_layers.png from these numbers plus out/view_sweep.json.)

Metrics (all from the LUTs; none is an engine output by itself):
  lut_mean_R      plain mean over all 60x60 (phase x angle) bins: the brief's "mean reflectance"
  normal_R        the engine's own GLSL evaluated at normal incidence (theta=0, uThickness=500 nm), luminance
  hemi_R          the same shader averaged over a uniform sky (cos*sin weighted over theta): flat-slab albedo
  head_on[kind]   the shader averaged over a facet seen head-on (orthographic, projected-area weighted,
                  no shadowing), for kind = eye (dome + nanopillars), dome (no pillars), slab (flat control)
"""
from __future__ import annotations

import base64
import csv
import json
import math
from pathlib import Path

import numpy as np
import OpenEXR

import geometry

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
LAMBDA = np.array([650.0, 530.0, 470.0])          # nm, R G B, from the engine's GLSL
LUM = np.array([0.2126, 0.7152, 0.0722])           # Rec. 709 luminance weights
THICKNESS = 500.0                                  # nm, the engine shader's default uThickness


def load_lut(path):
    with OpenEXR.File(str(path)) as f:
        px = f.channels()["RGB"].pixels.astype(np.float64)   # (angle rows, phase cols, 3)
    assert np.allclose(px[..., 0], px[..., 1]) and np.allclose(px[..., 0], px[..., 2]), "channels differ"
    return px[..., 0]


def sample(lut, s, t):
    """GL_LINEAR sampling with REPEAT on s (phase, columns) and CLAMP_TO_EDGE on t (angle, rows)."""
    H, W = lut.shape
    x = s * W - 0.5
    x0 = np.floor(x)
    fx = x - x0
    i0 = x0.astype(int) % W
    i1 = (i0 + 1) % W
    y = np.clip(t * H - 0.5, 0, H - 1)
    y0 = np.floor(y).astype(int)
    y1 = np.minimum(y0 + 1, H - 1)
    fy = y - y0
    top = lut[y0, i0] * (1 - fx) + lut[y0, i1] * fx
    bot = lut[y1, i0] * (1 - fx) + lut[y1, i1] * fx
    return top * (1 - fy) + bot * fy


def shader(lut, cos_theta, thickness=THICKNESS):
    """Port of the engine's entanglement_texture.glsl: returns (..., 3) RGB for |N.V| = cos_theta."""
    c = np.clip(np.abs(cos_theta), 0, 1)
    theta = np.arccos(c)
    D = -2.0 * 2 * math.pi * thickness * c
    t = theta / (math.pi / 2)
    out = []
    for lam in LAMBDA:
        s = np.mod(D / lam, 2 * math.pi) / (2 * math.pi)
        out.append(sample(lut, s, t))
    return np.stack(out, -1)


def lum(rgb):
    return rgb @ LUM


def main():
    rows = [r for r in csv.DictReader(open(OUT / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    mesh = {}
    for kind in ("eye", "dome", "slab"):
        v, t = geometry.facet(kind)
        n, a = geometry.face_normals(v, t)
        w = a * np.clip(n[:, 2], 0, None)                     # projected area toward a +z viewer
        mesh[kind] = (np.clip(n[:, 2], 0, 1), w / w.sum())
    th = np.linspace(0, math.pi / 2, 2001)
    wh = np.cos(th) * np.sin(th)
    wh /= np.trapezoid(wh, th)
    results, luts = [], {}
    for r in rows:
        d = OUT / "jobs" / r["tag"]
        R, T = load_lut(d / "R_lut.exr"), load_lut(d / "T_lut.exr")
        hemi = lambda L: float(np.trapezoid(lum(shader(L, np.cos(th))) * wh, th))
        res = {
            "tag": r["tag"], "series": r["series"], "layers": int(r["layers"]), "rays": int(r["incoming_rays"]),
            "interaction": float(r["interaction"]), "job_id": r["job_id"],
            "lut_shape": list(R.shape),
            "lut_mean_R": float(R.mean()), "lut_mean_T": float(T.mean()),
            "lut_min_R": float(R.min()), "lut_max_R": float(R.max()),
            "lut_R_theta0_mean": float(R[0].mean()), "lut_R_above_1_frac": float((R > 1.0).mean()),
            "normal_R": float(lum(shader(R, np.array(1.0)))), "normal_R_rgb": shader(R, np.array(1.0)).tolist(),
            "normal_T": float(lum(shader(T, np.array(1.0)))),
            "hemi_R": hemi(R), "hemi_T": hemi(T),
            "head_on": {k: float((lum(shader(R, cz)) * w).sum()) for k, (cz, w) in mesh.items()},
            "glsl_sha_prefix": __import__("hashlib").sha256((d / "entanglement_texture.glsl").read_bytes()).hexdigest()[:12],
        }
        results.append(res)
        luts[r["tag"]] = {"layers": res["layers"], "rays": res["rays"], "interaction": res["interaction"],
                          "job_id": r["job_id"], "w": R.shape[1], "h": R.shape[0],
                          "R": base64.b64encode(R.astype("<f4").tobytes()).decode(),
                          "T": base64.b64encode(T.astype("<f4").tobytes()).decode()}
        print(f"  {r['tag']:<12} meanR {res['lut_mean_R']:.4f}  R(0) {res['normal_R']:.4f}  hemi {res['hemi_R']:.4f}"
              f"  eye {res['head_on']['eye']:.4f}  dome {res['head_on']['dome']:.4f}  slab {res['head_on']['slab']:.4f}"
              f"  meanT {res['lut_mean_T']:.4f}")
    probes = json.loads((OUT / "probes.json").read_text(encoding="utf-8"))
    summary = {"engine": "entanglement-shader-v1", "params_fixed": {"reflectance": 0.2, "absorption": 0.95,
               "style": "peaked (default)", "resolution": "60 (default)", "thickness_nm_in_shader": THICKNESS},
               "geometry": geometry.GEOM, "results": results, "probes": probes}
    (OUT / "reflectance.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    (HERE / "web" / "data").mkdir(parents=True, exist_ok=True)
    (HERE / "web" / "data" / "luts.json").write_text(json.dumps(luts), encoding="utf-8")


if __name__ == "__main__":
    main()
