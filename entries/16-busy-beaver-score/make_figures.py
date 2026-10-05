"""Draw hero.png: the raw score and each blurred score as piano rolls, same scale. CLASSICAL plotting.

Top row: the whole 4,574-column score. Lower rows: a close-up of phrases 9 and 10, where the
wedge-shaped zigzag is wide enough to see what the blur does to it.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from render_wav import notes_from_midi

HERE = Path(__file__).resolve().parent
# the page's Moth Hack look: warm paper, one ultramarine ink (common/brand.css and the sprite palette)
PAPER, RULE, MELODY, BASS, TEXT = (251, 250, 249), (211, 211, 230), (25, 35, 142), (161, 164, 206), (25, 35, 142)


def roll(notes, c0, c1, pmin, pmax, w, h):
    img = np.zeros((h, w, 3), np.float32)
    img[:] = PAPER
    sx, sy = w / (c1 - c0), h / (pmax - pmin + 1)
    for s, d, p, v, name in notes:
        if s + d < c0 or s > c1:
            continue
        x0, x1 = int((s - c0) * sx), max(int((s - c0) * sx) + 1, int((s + d - c0) * sx) - 1)
        y0 = int((pmax - p) * sy)
        y1 = max(y0 + 1, int((pmax - p + 1) * sy) - 1)
        a = (v / 127) ** 0.8
        col = np.array(BASS if name == "Rule" else MELODY, np.float32)
        x0, x1 = max(0, x0), min(w, x1)
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + col * a
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))


def main():
    score = json.loads((HERE / "out" / "score.json").read_text(encoding="utf-8"))
    sets = [("Raw score (classical)", HERE / "score_raw.mid")]
    for stem in ("blur_s0.2_r0_res60", "blur_s0.2_r1_res60", "blur_s0.5_r1"):
        m = HERE / "out" / f"{stem}.mid"
        if m.exists():
            s, r = stem.split("_")[1:3]
            grid = "1/32 grid" if "res60" in stem else "1/16 grid"
            sets.append((f"blur-midi-v1  strength {s[1:]}  reach {r[1:]}  {grid}  qubits 20", m))
    data = [(t, notes_from_midi(p)) for t, p in sets]
    pmin = min(n[2] for _, ns in data for n in ns) - 1
    pmax = max(n[2] for _, ns in data for n in ns) + 1
    ph = score["phrases"]
    z0, z1 = ph[8]["col0"], ph[9]["col0"] + ph[9]["cols"]
    W, H1, H2, pad, lab = 1800, 150, 300, 24, 26
    rows = len(data)
    total_h = pad + rows * (lab + H1 + 10) + pad + rows * (lab + H2 + 10) + pad
    canvas = Image.new("RGB", (W + 2 * pad, total_h), PAPER)
    dr = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("consola.ttf", 18)
    except OSError:
        font = ImageFont.load_default()
    y = pad
    for t, ns in data:
        dr.text((pad, y), t + "   whole run", fill=TEXT, font=font)
        y += lab
        canvas.paste(roll(ns, 0, score["total_cols"], pmin, pmax, W, H1), (pad, y))
        dr.rectangle([pad - 1, y - 1, pad + W, y + H1], outline=RULE)
        for p_ in ph:
            x = pad + int(p_["col0"] / score["total_cols"] * W)
            dr.line([(x, y), (x, y + H1)], fill=RULE)
        y += H1 + 10
    y += pad
    for t, ns in data:
        dr.text((pad, y), t + f"   close-up: phrases 9-10 (machine steps "
                f"{ph[8]['start_step']:,}-{ph[9]['end_step']:,})", fill=TEXT, font=font)
        y += lab
        canvas.paste(roll(ns, z0, z1, pmin, pmax, W, H2), (pad, y))
        dr.rectangle([pad - 1, y - 1, pad + W, y + H2], outline=RULE)
        y += H2 + 10
    canvas.save(HERE / "hero.png", optimize=True)
    print(f"hero.png {canvas.size}, {rows} rolls")


if __name__ == "__main__":
    main()
