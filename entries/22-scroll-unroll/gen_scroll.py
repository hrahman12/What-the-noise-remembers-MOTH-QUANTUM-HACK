"""Generate the synthetic rolled papyrus. CLASSICAL. No real scroll data is used.

Outputs (all 1024 x 1024, 8-bit grey):
  scroll_base.png  the CT-like cross-section WITHOUT ink: air, papyrus layers, ring artefacts, noise
  ink_clean.png    the ink layer alone (white on black), in scan coordinates. This is the blur-v1 input.
  mask.png         white disk r = 500 px around the roll: bbox 1001 x 1001 px -> 10 + 10 = 20 qubits
  scan_clean.png   base + INK_GAIN * ink, the clean scan a reader would see
  strip_truth.png  the ink as written, in flat sheet coordinates (the answer key)
  scroll.json      geometry, where the hidden line sits, and the ink gain

The hidden line is the Epicurean "four-part cure" (tetrapharmakos) as Philodemus gives it in
Herculaneum papyrus PHerc. 1005, written here in capitals with word spaces. Everything is seeded.

Artistic simplification, stated on the page: in a real scroll a line of text runs ACROSS many CT
slices. Here the letters are written into the thickness of the layer in one slice, so that a single
1024 px image can carry a readable line.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

import geometry as G

HERE = Path(__file__).resolve().parent
RNG = np.random.default_rng(2026_10_04)
TEXT = "\u0391\u03a6\u039f\u0392\u039f\u039d \u039f \u0398\u0395\u039f\u03a3 \u00b7 \u0391\u039d\u03a5\u03a0\u039f\u03a0\u03a4\u039f\u039d \u039f \u0398\u0391\u039d\u0391\u03a4\u039f\u03a3 \u00b7 \u039a\u0391\u0399 \u03a4\u0391\u0393\u0391\u0398\u039f\u039d \u039c\u0395\u039d \u0395\u03a5\u039a\u03a4\u0397\u03a4\u039f\u039d \u00b7 \u03a4\u039f \u0394\u0395 \u0394\u0395\u0399\u039d\u039f\u039d \u0395\u03a5\u0395\u039a\u039a\u0391\u03a1\u03a4\u0395\u03a1\u0397\u03a4\u039f\u039d"
TRANSLATION = ("God is nothing to fear, death nothing to worry about; "
               "the good is easy to get, and the terrible easy to endure.")
TEXT_TURN = 2.15           # the line starts this many turns out from the core
INK_GAIN = 0.20            # how much brighter ink makes the scan (synthetic: real carbon ink is far fainter)
SS = 2                     # supersampling of the strip-space drawing
FONT = r"C:\Windows\Fonts\palab.ttf"   # Palatino Linotype Bold (system font, used only to rasterise)
FONT_PX = 27
MASK_R = 500


def smooth_noise(n, sigma, amp):
    v = ndi.gaussian_filter1d(RNG.standard_normal(n), sigma)
    return v / v.std() * amp


def papyrus_strip():
    """Density of the papyrus in sheet coordinates (H x L), 0 = air."""
    L, H = G.L, G.H
    yc = (H - 1) / 2
    half = 16 + smooth_noise(L, 120, 1.6)            # half-thickness ~16 px, slowly varying
    off = smooth_noise(L, 200, 1.2)                   # the layer drifts a little inside its pitch
    y = np.arange(H)[:, None]
    d = np.abs(y - yc - off[None, :]) - half[None, :]
    body = 1 / (1 + np.exp(d / 0.9))                  # soft edges
    # fibres run along the sheet: strongly anisotropic noise
    fib = ndi.gaussian_filter(RNG.standard_normal((H, L)), (0.7, 14)) * 9.0
    seam = np.exp(-((y - yc - off[None, :]) ** 2) / (2 * 1.4 ** 2))   # the join between the two fibre layers
    dens = body * (0.52 + 0.075 * fib - 0.10 * seam)
    # cracks across the layer and a frayed outer end
    for x0 in RNG.integers(300, L - 300, size=int(L / 650)):
        w = RNG.uniform(1.5, 3.5)
        dens *= 1 - 0.75 * np.exp(-((np.arange(L)[None, :] - x0) ** 2) / (2 * w ** 2))
    xs = np.arange(L)[None, :]
    dens *= np.clip((xs - 4) / 18, 0, 1) * np.clip((L - 6 - xs) / 30, 0, 1)
    return np.clip(dens, 0, 1)


def ink_strip():
    """Ink in sheet coordinates (H x L) plus the hidden line's extent [x0, x1]."""
    L, H = G.L, G.H
    im = Image.new("L", (L * SS, H * SS), 0)
    dr = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT, FONT_PX * SS)
    x0 = float(G.s_of_phi(2 * math.pi * TEXT_TURN))
    bbox = dr.textbbox((0, 0), TEXT, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ytop = (H * SS - th) / 2 - bbox[1]
    # letter by letter with slight jitter: a hand, not a printer
    x = x0 * SS
    for ch in TEXT:
        jy = RNG.normal(0, 0.6) * SS
        dr.text((x, ytop + jy), ch, fill=255, font=font)
        x += dr.textlength(ch, font=font) + RNG.normal(0.6, 0.4) * SS
    x1 = x / SS
    # carbon flecks scattered along the whole sheet: decoys, so the line is not obvious in the scan
    for _ in range(int(L / 55)):
        cx = RNG.uniform(20, L - 20) * SS
        cy = ((H - 1) / 2 + RNG.normal(0, 6)) * SS
        rx, ry = RNG.uniform(1.0, 3.2) * SS, RNG.uniform(0.8, 2.4) * SS
        dr.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=int(RNG.uniform(110, 255)))
    # abraded stroke debris along the whole sheet: ink-like marks that are not letters
    for _ in range(int(L / 32)):
        cx = RNG.uniform(20, L - 20) * SS
        cy = ((H - 1) / 2 + RNG.normal(0, 5)) * SS
        ln, ang = RNG.uniform(3, 11) * SS, RNG.uniform(0, math.pi)
        dx, dy = math.cos(ang) * ln / 2, math.sin(ang) * ln / 2
        dr.line((cx - dx, cy - dy, cx + dx, cy + dy), fill=int(RNG.uniform(90, 230)), width=int(RNG.integers(2, 5)))
    a = np.asarray(im, float) / 255
    a = a.reshape(H, SS, L, SS).mean(axis=(1, 3))      # back to 1 px per px of arc
    # uneven ink: some strokes faded
    fade = 0.72 + 0.28 * ndi.gaussian_filter(RNG.random((H, L)), (3, 9)) / 0.5
    return np.clip(a * np.clip(fade, 0.55, 1.0), 0, 1), x0, x1


def to_image(strip, order=1):
    """Paint a sheet-space array into scan coordinates (inverse map + bilinear sampling)."""
    yy, xx = np.mgrid[0:G.N, 0:G.N].astype(float)
    s, t, valid = G.image_to_sheet(xx, yy)
    row = t + (G.H - 1) / 2
    v = ndi.map_coordinates(strip, [row, s], order=order, mode="constant", cval=0.0)
    return np.where(valid, v, 0.0)


def main():
    pap = papyrus_strip()
    ink, x0, x1 = ink_strip()
    pap_img = to_image(pap)
    ink_img = ndi.gaussian_filter(to_image(ink), 0.6)

    # CT-like formation: air, papyrus, detector blur, ring artefacts around the rotation axis, grain
    yy, xx = np.mgrid[0:G.N, 0:G.N].astype(float)
    base = 0.075 + 0.62 * pap_img
    base = ndi.gaussian_filter(base, 0.8)
    rr = np.hypot(xx - (G.CX + 7), yy - (G.CY - 5))
    ring_prof = ndi.gaussian_filter1d(RNG.standard_normal(900), 0.7) * 0.022
    base += np.interp(rr, np.arange(900), ring_prof) * (rr < 520)
    base += 0.018 * (rr / 520) ** 2 * (rr < 520)                     # mild cupping
    base += ndi.gaussian_filter(RNG.standard_normal((G.N, G.N)), 0.55) * 0.085
    base = np.clip(base, 0, 1)

    ink8 = np.round(np.clip(ink_img, 0, 1) * 255).astype(np.uint8)
    base8 = np.round(base * 255).astype(np.uint8)
    Image.fromarray(base8).save(HERE / "scroll_base.png")
    Image.fromarray(ink8).save(HERE / "ink_clean.png")
    scan = np.clip(base8 / 255 + INK_GAIN * ink8 / 255, 0, 1)
    Image.fromarray(np.round(scan * 255).astype(np.uint8)).save(HERE / "scan_clean.png")
    Image.fromarray(np.round(ink * 255).astype(np.uint8)).save(HERE / "strip_truth.png")

    m = ((xx - G.CX) ** 2 + (yy - G.CY) ** 2 <= MASK_R ** 2).astype(np.uint8) * 255
    Image.fromarray(m).save(HERE / "mask.png")
    ys, xs = np.nonzero(m)
    bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    qubits = math.ceil(math.log2(bw)) + math.ceil(math.log2(bh))

    info = {"geometry": G.PARAMS, "L": G.L, "H": G.H, "text": TEXT, "translation": TRANSLATION,
            "text_s": [round(x0, 1), round(x1, 1)],
            "text_turns": [round(float(G.turn_of_s(x0)), 3), round(float(G.turn_of_s(x1)), 3)],
            "ink_gain": INK_GAIN, "mask": {"r": MASK_R, "bbox": [int(bw), int(bh)], "qubits": qubits},
            "check": [{"s": float(s), "t": float(t), "xy": [round(float(v), 4) for v in G.sheet_to_image(s, t)]}
                      for s, t in [(0, 0), (1000, -20), (5000.5, 13), (G.L - 1, 25.5), (8123, 0)]]}
    (HERE / "scroll.json").write_text(json.dumps(info, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"L = {G.L} px of sheet, H = {G.H} px, line at s = {x0:.0f}..{x1:.0f} "
          f"(turns {info['text_turns']}), mask bbox {bw}x{bh} -> {qubits} qubits")


if __name__ == "__main__":
    main()
