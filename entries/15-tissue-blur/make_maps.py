"""Build the expression maps and masks fed to blur-v1. CLASSICAL, no Atlas.

Source: Zhang et al. 2023 whole-mouse-brain MERFISH (CELLxGENE, CC BY 4.0), animal 4, sagittal
section C57BL6J-4.003 (95,104 cells, 1,120-gene panel). Values are the dataset's normalised
expression matrix `X` as distributed by CELLxGENE.

Each map is a 1024 x 1024 RGB PNG on black, with one gene per colour channel (blur-v1 processes
colour channels one at a time, per its documentation). Per gene: every cell's value is splatted
at its (x, y) position, smoothed with a Gaussian (sigma 1.6 px, about 17 um), scaled so the 99.5th
percentile of tissue pixels is 255, and clipped. The section is flipped vertically so dorsal is up.

Outputs:
  maps/composite_A.png, maps/composite_B.png    engine inputs
  maps/tissue.png                               tissue silhouette (classical, from cell density)
  masks/lens_<x>.png, masks/section.png         engine masks (white = blurred)
  maps/maps.json                                genes, channels, geometry
"""
import json
from pathlib import Path

import h5py
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = Path(__file__).resolve().parent
H5 = HERE / "data" / "WB_MERFISH_animal4_sagittal.h5ad"
SECTION = "C57BL6J-4.003"
N = 1024
WIDTH = 1000              # section spans 1000 px; height follows the aspect ratio
SIGMA = 1.6
COMPOSITES = {
    "A": {"name": "Three territories", "genes": ["Satb2", "Gpr88", "Gabra6"]},
    "B": {"name": "Folds and tracts", "genes": ["Fezf2", "C1ql2", "Mog"]},
}
LENS_R = 270              # 541 px bounding box -> ceil(log2 541) * 2 = 20 qubits
LENS_XS = [282, 512, 742]
LENS_Y = 512


def load():
    f = h5py.File(H5, "r")
    g = f["obs/brain_section_label"]
    cats = [c.decode() for c in g["categories"][:]]
    rows = np.where(np.array(cats)[g["codes"][:]] == SECTION)[0]
    names = [n.decode() if isinstance(n, bytes) else n for n in f["var/gene_name"][:]]
    xy = f["obsm/X_spatial_coords"][:][rows]
    indptr, ind, data = f["X/indptr"][:], f["X/indices"][:], f["X/data"][:]
    region = f["obs/major_brain_region"]
    rcats = [c.decode() for c in region["categories"][:]]
    regions = np.array(rcats)[region["codes"][:]][rows]
    return names, rows, xy, indptr, ind, data, regions


def gene_values(j, rows, indptr, ind, data):
    v = np.zeros(len(rows), np.float32)
    for k, r in enumerate(rows):
        a, b = indptr[r], indptr[r + 1]
        hit = np.nonzero(ind[a:b] == j)[0]
        if hit.size:
            v[k] = data[a + hit[0]]
    return v


def main():
    names, rows, xy, indptr, ind, data, regions = load()
    lo, hi = xy.min(0), xy.max(0)
    scale = WIDTH / (hi[0] - lo[0])
    hpx = (hi[1] - lo[1]) * scale
    ox, oy = (N - WIDTH) / 2, (N - hpx) / 2
    px = np.round((xy[:, 0] - lo[0]) * scale + ox).astype(int)
    py = np.round((hi[1] - xy[:, 1]) * scale + oy).astype(int)   # flip: dorsal up
    px, py = np.clip(px, 0, N - 1), np.clip(py, 0, N - 1)

    # tissue silhouette from cell density (classical)
    dens = np.zeros((N, N)); np.add.at(dens, (py, px), 1.0)
    tissue = ndimage.gaussian_filter(dens, 6) > 0.02
    tissue = ndimage.binary_fill_holes(ndimage.binary_closing(tissue, iterations=4))
    lab, nlab = ndimage.label(tissue)
    if nlab > 1:
        sizes = ndimage.sum(tissue, lab, range(1, nlab + 1))
        tissue = lab == (1 + int(np.argmax(sizes)))
    (HERE / "maps").mkdir(exist_ok=True)
    (HERE / "masks").mkdir(exist_ok=True)
    Image.fromarray((tissue * 255).astype(np.uint8)).save(HERE / "maps" / "tissue.png")

    meta = {"section": SECTION, "cells": int(len(rows)), "um_per_px": float(1 / scale),
            "composites": {}, "masks": {}}
    for key, comp in COMPOSITES.items():
        rgb = np.zeros((N, N, 3), np.uint8)
        stats = []
        for c, gname in enumerate(comp["genes"]):
            v = gene_values(names.index(gname), rows, indptr, ind, data)
            im = np.zeros((N, N)); np.add.at(im, (py, px), v)
            im = ndimage.gaussian_filter(im, SIGMA)
            top = float(np.percentile(im[tissue], 99.5))
            rgb[..., c] = np.round(np.clip(im / top, 0, 1) * 255).astype(np.uint8)
            stats.append({"gene": gname, "channel": "RGB"[c], "cells_expressing": int((v > 0).sum()),
                          "p995": top})
        Image.fromarray(rgb).save(HERE / "maps" / f"composite_{key}.png")
        meta["composites"][key] = {"name": comp["name"], "file": f"maps/composite_{key}.png", "channels": stats}
        print(f"composite_{key}: {comp['genes']}")

    for x in LENS_XS:
        m = Image.new("L", (N, N), 0)
        ImageDraw.Draw(m).ellipse([x - LENS_R, LENS_Y - LENS_R, x + LENS_R, LENS_Y + LENS_R], fill=255)
        m.save(HERE / "masks" / f"lens_{x}.png")
        meta["masks"][f"lens_{x}"] = {"kind": "lens", "x": x, "y": LENS_Y, "r": LENS_R,
                                      "bbox": [2 * LENS_R + 1, 2 * LENS_R + 1]}
    Image.fromarray((tissue * 255).astype(np.uint8)).save(HERE / "masks" / "section.png")
    ys, xs = np.nonzero(tissue)
    meta["masks"]["section"] = {"kind": "section", "bbox": [int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)],
                                "box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}
    for k, mk in meta["masks"].items():
        w, h = mk["bbox"]
        mk["qubits"] = int(np.ceil(np.log2(w)) + np.ceil(np.log2(h)))
        print(f"mask {k}: bbox {w} x {h} -> {mk['qubits']} qubits")
    (HERE / "maps" / "maps.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
