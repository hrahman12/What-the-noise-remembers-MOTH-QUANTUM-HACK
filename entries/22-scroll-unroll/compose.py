"""Compose the brief's deliverable images from cached engine outputs. CLASSICAL layout only.

hero.png    clean scan | raw blur-v1 output at strength 1, reach 0 | raw output at strength 0.25, reach 1,
            above the flattened hidden line under five settings (scan view: papyrus + gain x ink)
ladder.png  all nine raw blur-v1 outputs, flattened over the hidden line, in damage order, with job IDs
No engine pixel is edited: panels show engine outputs as downloaded (greyscale, resized for layout only
where stated), composites are labelled as such.
Look: the page's paper-and-ultramarine kit (common/brand.css). Scan views are printed the way the page prints them,
denser = deeper ink on paper, at the page's default contrast; raw engine outputs keep their own greyscale (white ink
on black), as in the page's "Ink layer only" view.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

import geometry as G

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
PAPER, INK, INK2, RULE = (251, 250, 249), (25, 35, 142), (84, 91, 169), (211, 211, 230)   # brand.css tokens
F = r"C:\Windows\Fonts"


def font(name, size):
    try:
        return ImageFont.truetype(f"{F}\\{name}", size)
    except OSError:
        return ImageFont.load_default()


def f2(x):   # two decimals, with no "-0.00" (the page formats r the same way)
    t = f"{x:.2f}"
    return "0.00" if t == "-0.00" else t


def grey(p):
    return np.asarray(Image.open(p).convert("L"), float) / 255


def to8(a):
    return Image.fromarray(np.round(np.clip(a, 0, 1) * 255).astype(np.uint8))


def inkprint(d):
    """density 0..1 -> RGB image, mix(paper, ink, d): the page's scan colouring (shade() in web/template.html)"""
    d = np.clip(d, 0, 1)[..., None]
    rgb = np.array(PAPER, float) + (np.array(INK, float) - np.array(PAPER, float)) * d
    return Image.fromarray(np.round(rgb).astype(np.uint8), "RGB")


def frame(draw, x, y, w, h):
    draw.rectangle([x - 1, y - 1, x + w, y + h], outline=INK, width=1)


def main():
    info = json.loads((HERE / "scroll.json").read_text(encoding="utf-8"))
    met = json.loads((OUT / "metrics.json").read_text(encoding="utf-8"))
    jobs = sorted(met["jobs"], key=lambda m: m["off_ink"])
    gain, (x0, x1) = info["ink_gain"], info["text_s"]
    coords = G.strip_coords()
    base = grey(HERE / "scroll_base.png")
    title, body, mono = font("segoeuil.ttf", 58), font("segoeui.ttf", 24), font("consola.ttf", 20)
    a0, span = int(x0) - 20, 1500
    lo, hi = 0.125, 0.83   # the page's default contrast window

    def line_strip(ink_img):
        s = ndi.map_coordinates(np.clip(base + gain * ink_img, 0, 1), coords, order=1)[:, a0:a0 + span]
        return np.clip((s - lo) / (hi - lo), 0, 1)

    scan_print = inkprint((np.clip(base + gain * grey(HERE / "ink_clean.png"), 0, 1) - lo) / (hi - lo))

    # ---- hero ----
    W, Hh = 2400, 1520
    im = Image.new("RGB", (W, Hh), PAPER)
    d = ImageDraw.Draw(im)
    d.text((60, 34), "Scroll Unroll", font=title, fill=INK)
    d.text((60, 110), "A synthetic rolled papyrus; Atlas blur-v1 (20 qubits, statevector simulator) scrambles its ink; "
           "a classical virtual unwrapping lays it flat.", font=body, fill=INK2)
    panels = [(scan_print, "Clean scan (synthetic): papyrus + 0.2 x ink, printed as on the page"),
              (OUT / "ink_s1.00_r0.0.png", "Raw blur-v1 output: strength 1.0, reach 0"),
              (OUT / "ink_s0.25_r1.0.png", "Raw blur-v1 output: strength 0.25, reach 1")]
    for i, (p, lab) in enumerate(panels):
        x = 60 + i * 770
        pim = p if isinstance(p, Image.Image) else Image.open(p).convert("L")
        im.paste(pim.resize((740, 740), Image.LANCZOS).convert("RGB"), (x, 170))
        frame(d, x, 170, 740, 740)
        d.text((x, 922), lab, font=mono if i else font("consola.ttf", 18), fill=INK)
    d.line([(60, 968), (W - 60, 968)], fill=RULE, width=1)
    y = 980
    d.text((60, y), f"The hidden line, flattened (sheet px {a0}-{a0 + span}), scan view at the page's default contrast",
           font=body, fill=INK2)
    y += 44
    rows = [("clean ink", grey(HERE / "ink_clean.png"), None)]
    for m in jobs:
        if (m["strength"], m["reach"]) in [(0.25, 0.0), (0.5, 0.0), (1.0, 0.0), (0.25, 1.0)]:
            rows.append((f"s {m['strength']} reach {m['reach']:g}  r={f2(m['r_line'])}", grey(OUT / m["file"]), m))
    for lab, ink_img, m in rows:
        sw, sh = int(span * 1.35), int(G.H * 1.35)
        st = inkprint(line_strip(ink_img)).resize((sw, sh), Image.LANCZOS)
        d.text((60, y + 26), lab, font=mono, fill=INK2 if m is None else INK)
        im.paste(st, (330, y))
        frame(d, 330, y, sw, sh)
        y += int(G.H * 1.35) + 18
    im.save(HERE / "hero.png")

    # ---- ladder: every raw output, flattened over the line ----
    span2, sc = 1700, 1.0
    W2 = 360 + span2
    H2 = 120 + (len(jobs) + 1) * (G.H + 30)
    lad = Image.new("RGB", (W2, H2), PAPER)
    d = ImageDraw.Draw(lad)
    d.text((30, 24), "Raw ink layers, flattened over the hidden line (sheet px %d-%d), sorted by ink moved off the true ink"
           % (a0, a0 + span2), font=body, fill=INK)
    y = 80
    for lab, ink_img, m in [("clean ink (input)", grey(HERE / "ink_clean.png"), None)] + \
                           [(f"s {m['strength']} r {m['reach']:g}", grey(OUT / m["file"]), m) for m in jobs]:
        s = ndi.map_coordinates(ink_img, coords, order=1)[:, a0:a0 + span2]
        lad.paste(to8(s).convert("RGB"), (340, y))   # engine output: its own greyscale, white ink on black
        frame(d, 340, y, s.shape[1], s.shape[0])
        d.text((30, y + 4), lab, font=mono, fill=INK2 if m is None else INK)
        if m:
            d.text((30, y + 28), f"{m['job_id'][:8]}  r={f2(m['r_line'])}  off={m['off_ink']:.2f}", font=font("consola.ttf", 15), fill=INK2)
        y += G.H + 30
    lad.save(HERE / "ladder.png")
    print("hero.png and ladder.png written")


if __name__ == "__main__":
    main()
