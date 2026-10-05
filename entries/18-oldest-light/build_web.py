"""Assemble web/index.html: inline the shared brand CSS, the input grid and every completed
blur-core-v1 output (as 16-bit base64, value x 50), the classical fit numbers and the job records;
render the full-sky locator to web/img/sky.webp (lossless). Classical packaging step only: the
engine outputs are shipped exactly as returned (float32 -> uint16 at 0.02 grid units = 0.012 uK);
the page applies the labelled display steps (mean shift, colour map) itself.
"""
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
WEB, OUT = HERE / "web", HERE / "out"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(ROOT / "common"))
sys.path.insert(0, str(HERE))
from ascii_html import to_ascii  # noqa: E402
from cmap import STOPS, colorize  # noqa: E402
from nav import nav_html  # noqa: E402  shared piece-to-piece navigation (prev / hub / next / jump list)

SCALE_UK = 230.0     # |dT| at the ends of the colour map (about 3 x the patch rms)
Q = 50.0             # uint16 quantisation: value * 50


def b64grid(A):
    a = np.rint(np.asarray(A, dtype=np.float64) * Q)
    assert a.min() >= 0 and a.max() < 65536
    return base64.b64encode(a.astype("<u2").tobytes()).decode("ascii")


def moll_xy(l_deg, b_deg, l_c):
    """Mollweide forward projection (l = l_c at the centre, l increasing to the left) -> pixel fraction [0, 1]."""
    lam = -np.radians(((l_deg - l_c + 180) % 360) - 180)
    phi = np.radians(b_deg)
    th = phi.copy()
    for _ in range(50):
        f = 2 * th + np.sin(2 * th) - np.pi * np.sin(phi)
        th = th - f / (2 + 2 * np.cos(2 * th) + 1e-12)
    x = 2 * np.sqrt(2) / np.pi * lam * np.cos(th)
    y = np.sqrt(2) * np.sin(th)
    return (x + 2 * np.sqrt(2)) / (4 * np.sqrt(2)), (np.sqrt(2) - y) / (2 * np.sqrt(2))


def main():
    (WEB / "img").mkdir(parents=True, exist_ok=True)
    meta = json.loads((OUT / "patch_meta.json").read_text(encoding="utf-8"))
    fits = {r["name"]: r for r in json.loads((OUT / "analysis.json").read_text(encoding="utf-8"))}
    jobs = json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))
    probes = json.loads((OUT / "probes.json").read_text(encoding="utf-8"))
    cobe = json.loads((OUT / "analysis_cobe.json").read_text(encoding="utf-8"))
    G = np.load(OUT / "grid_input.npy")
    levels, failed = [], []
    for j in jobs:
        det = ((j.get("engine_status") or {}).get("progress") or {}).get("detail", "")
        if j["status"] != "completed":
            failed.append({"name": j["name"], "strength": j["strength"], "shape": j["shape"], "qubits": j["qubits"],
                           "job_id": j["job_id"], "detail": det,
                           "error": ((j.get("engine_status") or {}).get("error") or {}).get("message", "")})
            continue
        f = fits[j["name"]]
        A = np.load(OUT / f"{j['name']}.npy")
        levels.append({"strength": j["strength"], "job_id": j["job_id"], "seconds": j.get("seconds"),
                       "qubits": j["qubits"], "shape": j["shape"], "detail": det,
                       "shift": f["mean_shift_units"], "shift_uK": f["mean_shift_uK"], "sigma_px": f["sigma_px"],
                       "fwhm_arcmin": f["fwhm_arcmin"], "beam_deg": f["equiv_beam_deg"], "fit_rms_uK": f["fit_rms_uK"],
                       "kept": f["detail_kept"], "kept_gauss": f["detail_kept_gauss"],
                       "std_ratio": f["std_ratio"], "std_ratio_gauss": f["std_ratio_gauss"], "grid": b64grid(A)})
    levels.sort(key=lambda r: r["strength"])
    # full-sky locator (classical rendering of the same ILC map)
    M = np.load(OUT / "sky_moll.npy") * 1000.0
    rgba = np.dstack([colorize(M, SCALE_UK), np.where(np.isnan(M), 0, 255).astype(np.uint8)])   # transparent off-sky
    Image.fromarray(rgba, "RGBA").save(WEB / "img" / "sky.webp", "WEBP", lossless=True, method=6)
    ol = np.array(meta["outline_lb"])
    x, y = moll_xy(ol[:, 0], ol[:, 1], meta["moll_centre_l"])
    cx, cy = moll_xy(np.array([meta["centre_lb"][0]]), np.array([meta["centre_lb"][1]]), meta["moll_centre_l"])
    data = {"meta": {k: meta[k] for k in ("source", "projection", "centre_lb", "deg_per_px", "field_deg", "t_lo_uK",
                                           "t_hi_uK", "qmax", "uK_per_unit", "patch_rms_uK", "map_resolution_deg")},
            "n": int(G.shape[0]), "q": Q, "scale_uK": SCALE_UK, "stops": [[s, list(c)] for s, c in STOPS],
            "original": b64grid(G), "levels": levels, "failed": failed,
            "cobe": {"sigma_px": cobe["sigma_px"], "kept": cobe["detail_kept"], "std_ratio": cobe["std_ratio"]},
            "probes": [{"shape": p["shape"], "qubits": p["qubits"], "status": p["status"], "body_bytes": p["body_bytes"]}
                       for p in probes],
            "outline": [[round(float(a), 4), round(float(b), 4)] for a, b in zip(x, y)],
            "centre_xy": [round(float(cx[0]), 4), round(float(cy[0]), 4)]}
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    # the cast: shared InkSprite helper + this piece's pixel art (web/sprites.json, also used for the hub mascot)
    assert "/*INKSPRITE*/" in html and "/*SPRITES*/{}" in html
    html = html.replace("/*INKSPRITE*/", (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8")
                        .replace("<script>", "script element"))   # its header comment names the tag; keep script splitting simple
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    assert "/*DATA*/{}" in html
    html = html.replace("/*DATA*/{}", json.dumps(data, separators=(",", ":")))
    assert html.count("<!--NAV-->") == 1
    html = html.replace("<!--NAV-->", nav_html("18-oldest-light"))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (OUT / "web_data_summary.json").write_text(json.dumps({k: v for k, v in data.items() if k not in ("original", "levels")}
                                                     | {"levels": [{k: v for k, v in L.items() if k != "grid"} for L in levels]},
                                                     indent=1), encoding="utf-8")
    files = {"img/sky.webp": "entries/18-oldest-light/web/img/sky.webp",
             "img/mascot.png": "entries/18-oldest-light/web/img/mascot.png"}
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    size = (WEB / "index.html").stat().st_size + (WEB / "img" / "sky.webp").stat().st_size
    print(f"web/index.html written: {len(levels)} engine outputs, {len(failed)} failed job(s) listed, total {size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
