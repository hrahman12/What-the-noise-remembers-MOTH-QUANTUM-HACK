"""Assemble web/index.html: inline the brand CSS and the job table, export display images. CLASSICAL.

- Crops the measured maps and every completed blur-v1 output to the band that holds the section and
  all masks (y 192..831; outside the masks the engine output is byte-identical to its input, checked
  below), and saves them as lossless WebP under web/img/.
- Computes, per job and per gene channel, two plain image statistics inside the mask:
  agreement (Pearson r between measured and blurred pixel values) and ghost signal (share of the
  channel's brightness on pixels that were dark, < 4/255, in the measured map).
- Traces the whole-section mask outline for the page.
- Exports the classical tissue silhouette as a faint ink tint (web/img/tissue.webp) for the paper-ground display.
- Finds, per job and gene, the "ghost" hotspots the page's ghost sprites sit on: local maxima of blurred
  brightness on pixels that were dark (< 4/255) in the measured map, inside the mask. Each stored point is a
  real pixel with its measured and blurred values. Also finds each gene's measured hotspot (for the scene tags).
- Inlines web/sprites.json and common/inksprite.js, and exports the hub mascot (web/img/mascot.png).
"""
import csv
import json
import subprocess
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy.ndimage import gaussian_filter, maximum_filter  # noqa: E402

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = ROOT / "common" / "inksprite.js"
MASCOT = ROOT / "common" / "mascot.py"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402

Y0, BAND = 192, 640
DARK = 4
LENS_NAMES = {"lens_282": "Front lens", "lens_512": "Centre lens", "lens_742": "Back lens", "section": "Whole section"}


def ghost_spots(meas, blur, m, mk, n=14):
    """Real ghost pixels for one gene channel: blurred brightness where the measured map was dark (< DARK).
    Local maxima of the smoothed ghost map (41 px apart), strongest first, each refined to its brightest raw pixel.
    Returns [[x, y_in_band, measured/255, blurred/255], ...]."""
    g = np.where(m & (meas < DARK), blur, 0.0)
    gs = gaussian_filter(g, 5)
    if mk["kind"] == "lens":   # keep the sprites clear of the lens rim
        yy, xx = np.mgrid[:g.shape[0], :g.shape[1]]
        gs = gs * (((xx - mk["x"]) ** 2 + (yy - mk["y"]) ** 2) <= (mk["r"] - 22) ** 2)
    peaks = (gs == maximum_filter(gs, size=41)) & (gs > 0.6)
    ys, xs = np.nonzero(peaks)
    out = []
    for i in np.argsort(-gs[ys, xs]):
        py, px = int(ys[i]), int(xs[i])
        y0, x0 = max(0, py - 4), max(0, px - 4)
        win = g[y0:py + 5, x0:px + 5]
        dy, dx = np.unravel_index(int(np.argmax(win)), win.shape)
        qy, qx = y0 + int(dy), x0 + int(dx)
        if blur[qy, qx] < 12 or meas[qy, qx] >= DARK:
            continue
        out.append([qx, qy - Y0, round(float(meas[qy, qx]) / 255, 3), round(float(blur[qy, qx]) / 255, 3)])
        if len(out) >= n:
            break
    return out


def webp(src, dst):
    im = Image.open(src).convert("RGB")
    im.crop((0, Y0, 1024, Y0 + BAND)).save(dst, "WEBP", lossless=True, method=6)


def main():
    meta = json.loads((HERE / "maps" / "maps.json").read_text(encoding="utf-8"))
    (WEB / "img").mkdir(parents=True, exist_ok=True)
    files = {}
    comps = {}
    for key, c in meta["composites"].items():
        fn = f"img/measured_{key}.webp"
        webp(HERE / c["file"], WEB / fn)
        files[fn] = f"entries/15-tissue-blur/web/{fn}"
        arr = np.asarray(Image.open(HERE / c["file"]).convert("RGB")).astype(float)[Y0:Y0 + BAND]
        hot = []
        for ch in range(3):   # where each gene's measured ink is densest (classical), for the scene's gene tags
            sm = gaussian_filter(arr[..., ch], 16)
            hy, hx = np.unravel_index(int(np.argmax(sm)), sm.shape)
            hot.append([int(hx), int(hy)])
        comps[key] = {"name": c["name"], "measured": fn,
                      "genes": [{"gene": g["gene"], "channel": g["channel"], "cells": g["cells_expressing"], "hot": hot[i]}
                                for i, g in enumerate(c["channels"])]}

    # tissue silhouette (classical, from cell density in make_maps.py) as a faint ink tint for the paper ground
    t_arr = np.asarray(Image.open(HERE / "maps" / "tissue.png"))[Y0:Y0 + BAND] > 127
    rgba = np.zeros(t_arr.shape + (4,), np.uint8)
    rgba[t_arr] = (25, 35, 142, 18)   # brand ink #19238E at alpha .07 (the --tint token)
    Image.fromarray(rgba, "RGBA").save(WEB / "img" / "tissue.webp", "WEBP", lossless=True, method=6)
    files["img/tissue.webp"] = "entries/15-tissue-blur/web/img/tissue.webp"

    masks = {}
    for k, m in meta["masks"].items():
        mk = {"name": LENS_NAMES[k], "kind": m["kind"], "qubits": m["qubits"], "bbox": m["bbox"]}
        if m["kind"] == "lens":
            mk.update({"x": m["x"], "y": m["y"] - Y0, "r": m["r"]})
        else:
            arr = (np.asarray(Image.open(HERE / "masks" / f"{k}.png")) > 127).astype(float)
            cs = plt.contour(arr, levels=[0.5])
            seg = max(cs.allsegs[0], key=len)
            plt.close("all")
            step = max(1, len(seg) // 220)
            mk["outline"] = [[round(float(x), 1), round(float(y) - Y0, 1)] for x, y in seg[::step]]
        masks[k] = mk

    tissue = np.asarray(Image.open(HERE / "maps" / "tissue.png")) > 127
    jobs = []
    for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")):
        if r["status"] != "completed":
            continue
        meas = np.asarray(Image.open(HERE / "maps" / f"composite_{r['composite']}.png").convert("RGB")).astype(float)
        blur = np.asarray(Image.open(HERE / "out" / r["file"]).convert("RGB")).astype(float)
        m = np.asarray(Image.open(HERE / "masks" / f"{r['mask']}.png")) > 127
        assert np.abs(meas - blur)[~m].max() == 0, f"{r['file']} differs outside its mask"
        assert not m[:Y0].any() and not m[Y0 + BAND:].any(), "mask leaves the exported band"
        stats, ghosts = [], []
        mk = meta["masks"][r["mask"]]
        for c in range(3):
            x, y = meas[..., c][m], blur[..., c][m]
            dark = x < DARK
            present = bool(x.max() >= 64 and x.sum() > 0)
            stats.append({
                "r": round(float(np.corrcoef(x, y)[0, 1]), 3) if x.std() > 0 and y.std() > 0 else None,
                "ghost_measured": round(float(x[dark].sum() / x.sum()), 4) if x.sum() else None,
                "ghost_blurred": round(float(y[dark].sum() / y.sum()), 4) if y.sum() else None,
                "on_background": round(float(y[~tissue[m]].sum() / y.sum()), 4) if y.sum() else None,
                "present": present})
            ghosts.append(ghost_spots(meas[..., c], blur[..., c], m, mk) if present else [])
        fn = "img/" + r["file"].replace(".png", ".webp")
        webp(HERE / "out" / r["file"], WEB / fn)
        files[fn] = f"entries/15-tissue-blur/web/{fn}"
        jobs.append({"composite": r["composite"], "mask": r["mask"], "setting": r["setting"],
                     "strength": float(r["strength"]), "style": r["style"], "reach": float(r["reach"]),
                     "qubits": int(r["qubits"]), "job_id": r["job_id"], "seconds": float(r["seconds"]),
                     "file": fn, "stats": stats, "ghosts": ghosts})

    data = {"section": meta["section"], "cells": meta["cells"], "um_per_px": round(meta["um_per_px"], 3),
            "crop": {"y0": Y0, "h": BAND}, "tissue": "img/tissue.webp", "composites": comps, "masks": masks, "jobs": jobs,
            "engine": {"id": "blur-v1", "version": "1.1.9"}}
    (WEB / "data.json").write_text(json.dumps(data, indent=1), encoding="utf-8")

    # sprites: one home (web/sprites.json) for the page and the hub mascot
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    page_sprites = {k: {kk: vv for kk, vv in v.items() if kk != "about"} for k, v in sprites.items()}
    subprocess.run([sys.executable, str(MASCOT), str(WEB / "sprites.json"), "mascot", str(WEB / "img" / "mascot.png"),
                    "--scale", "4"], check=True)
    files["img/mascot.png"] = "entries/15-tissue-blur/web/img/mascot.png"
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")

    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
    html = html.replace("/*SPRITES*/{}", json.dumps(page_sprites, separators=(",", ":")))
    html = html.replace("/*DATA*/{}", json.dumps(data, separators=(",", ":")))
    assert "<!--NAV-->" in html, "template lost its <!--NAV--> marker"
    html = html.replace("<!--NAV-->", nav_html("15-tissue-blur"))   # shared prev / hub / next navigation
    assert "/*INKSPRITE*/" not in html and "/*SPRITES*/" not in html and "/*DATA*/" not in html
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    total = sum((WEB / p).stat().st_size for p in files) + (WEB / "index.html").stat().st_size
    print(f"web/index.html written: {len(jobs)} jobs, {len(files)} files, {total / 1e6:.2f} MB total")


if __name__ == "__main__":
    main()
