"""Classical virtual unwrapping of the synthetic scroll, plus agreement numbers. CLASSICAL.

We know the spiral exactly because we generated it (geometry.py). A real pipeline has to find the
surface in a 3D scan first (segmentation), which is the hard part; this script only does the last step:
sample the scan along the known surface and lay it flat (bilinear sampling, 1 px per px of arc).

Writes:
  out/strip_scan_clean.png         flattened clean scan (base + ink)
  out/strip_ink_clean.png          flattened clean ink
  out/strip_<job>.png              flattened blur-v1 output for every completed job
  out/metrics.json                 Pearson r between each blurred ink layer and the clean one,
                                   over the hidden line (sheet space) and over the whole roll (scan space),
                                   and the share of ink brightness that lands off the true ink
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

import geometry as G

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


def grey(path):
    return np.asarray(Image.open(path).convert("L"), float) / 255


def flatten(img, coords):
    return ndi.map_coordinates(img, coords, order=1, mode="constant", cval=0.0)


def save(a, path):
    Image.fromarray(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8)).save(path)


def pearson(a, b):
    a, b = a.ravel() - a.mean(), b.ravel() - b.mean()
    return float((a @ b) / np.sqrt((a @ a) * (b @ b)))


def main():
    info = json.loads((HERE / "scroll.json").read_text(encoding="utf-8"))
    x0, x1 = (int(round(v)) for v in info["text_s"])
    coords = G.strip_coords()
    base, ink = grey(HERE / "scroll_base.png"), grey(HERE / "ink_clean.png")
    gain = info["ink_gain"]
    save(flatten(np.clip(base + gain * ink, 0, 1), coords), OUT / "strip_scan_clean.png")
    ink_s = flatten(ink, coords)
    save(ink_s, OUT / "strip_ink_clean.png")
    yy, xx = np.mgrid[0:G.N, 0:G.N]
    disk = (xx - G.CX) ** 2 + (yy - G.CY) ** 2 <= info["mask"]["r"] ** 2
    truth = ndi.binary_dilation(ink > 0.08, iterations=2)
    metrics = []
    for r in csv.DictReader(open(OUT / "jobs.csv", encoding="utf-8")):
        if r["status"] != "completed":
            continue
        b = grey(OUT / r["file"])
        bs = flatten(b, coords)
        save(bs, OUT / ("strip_" + r["file"]))
        metrics.append({"file": r["file"], "job_id": r["job_id"], "strength": float(r["strength"]),
                        "reach": float(r["reach"]),
                        "r_line": round(pearson(bs[:, x0:x1], ink_s[:, x0:x1]), 5),
                        "r_roll": round(pearson(b[disk], ink[disk]), 5),
                        "off_ink": round(float(b[disk & ~truth].sum() / max(1e-9, b[disk].sum())), 5)})
        print(f"  {r['file']}: r_line {metrics[-1]['r_line']}, r_roll {metrics[-1]['r_roll']}, "
              f"off-ink share {metrics[-1]['off_ink']}")
    clean_off = float(ink[disk & ~truth].sum() / ink[disk].sum())
    (OUT / "metrics.json").write_text(json.dumps({"clean_off_ink": round(clean_off, 3), "jobs": metrics},
                                                 indent=1), encoding="utf-8")
    print(f"strips {G.L} x {G.H} px written; clean off-ink share {clean_off:.3f}")


if __name__ == "__main__":
    main()
