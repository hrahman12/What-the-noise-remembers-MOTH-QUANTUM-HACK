"""Render the 30 s MP4 (1920x1080, 30 fps) from the real engine frames. CLASSICAL rendering.

Every picture in the video is either a completed telablur-v1 job (out/frames/), a classical FFT
envelope of one (out/maps/), or the same envelope of the original input layers (out/maps_in/).
Between consecutive real frames there is a 0.2 s crossfade, which is a classical display
transition and is labelled on screen. The sweep dwells longer near 1.1 deg.

Look: the brief-page style shared by the web page (warm paper, one ultramarine ink, hairlines).
The envelope maps are re-shown on a paper -> ink ramp (palette.py, display only); the raw engine
crops keep their own grey levels.

    python make_video.py   -> magic_angle.mp4
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import lattice as L
from palette import INK, INK2, INK3, PAPER, RULE, WARN, recolour

HERE = Path(__file__).resolve().parent
W, H, FPS, SECONDS = 1920, 1080, 30, 30
GRID = (232, 232, 241)
FONTS = Path("C:/Windows/Fonts")
NM_PER_PX = 0.246 / L.A
STATUS = {"ok": "tracks the twist", "null": "register echo (also in the 0\u00b0 frame)", "unresolved": "unresolved"}


def font(name, size):
    try:
        return ImageFont.truetype(str(FONTS / name), size)
    except OSError:
        return ImageFont.load_default()


F_TITLE = font("segoeuil.ttf", 58)
F_BIG = font("segoeuil.ttf", 88)
F_H = font("consola.ttf", 20)
F_BODY = font("segoeui.ttf", 22)
F_MONO = font("consola.ttf", 22)
F_S = font("consola.ttf", 17)

SQ = 560
ORIG_XY, MORPH_XY = (60, 130), (650, 130)
RAW = 200
PLOT = (130, 760, 1200, 990)
Y_MAX = 1000.0


def load_frames():
    m = json.loads((HERE / "out" / "measure.json").read_text(encoding="utf-8"))
    frames = []
    for r in m["frames"]:
        th = r["theta"]
        mp = recolour(Image.open(HERE / "out" / "maps" / f"map_{th:.2f}.png")).resize((SQ, SQ), Image.LANCZOS)
        mi = recolour(Image.open(HERE / "out" / "maps_in" / f"map_{th:.2f}.png")).resize((SQ, SQ), Image.LANCZOS)
        c = (1024 - 384) // 2
        raw = Image.open(HERE / "out" / "frames" / r["file"]).convert("RGB").crop((c, c, c + 384, c + 384)) \
            .resize((RAW, RAW), Image.BOX)
        frames.append({**r, "map": mp, "mapin": mi, "raw": raw})
    return frames, m["summary"]


def schedule(frames):
    start, end = int(1.5 * FPS), int(27.0 * FPS)
    dw = np.array([1 + 1.6 * math.exp(-((f["theta"] - 1.1) / 0.18) ** 2) for f in frames])
    dw = dw / dw.sum() * (end - start)
    return start, end, start + np.concatenate([[0], np.cumsum(dw)])


def px(theta, Lpx):
    x0, y0, x1, y1 = PLOT
    return x0 + (x1 - x0) * theta / 5.0, y1 - (y1 - y0) * min(Lpx, Y_MAX) / Y_MAX


def plot_base():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = PLOT
    for v in (250, 500, 750, 1000):
        _, y = px(0, v)
        d.line([x0, y, x1, y], fill=GRID)
        d.text((x0 - 52, y - 9), f"{v}", font=F_S, fill=INK2)
    d.rectangle([x0, y0, x1, y1], outline=INK)
    for t in range(6):
        x, _ = px(t, 0)
        d.text((x - 8, y1 + 8), f"{t}\u00b0", font=F_S, fill=INK2)
    d.text((60, y0 - 30), "MOIRE PERIOD L (PX)", font=F_S, fill=INK2)
    mx, _ = px(1.1, 0)
    for yy in range(y0, y1, 12):
        d.line([mx, yy, mx, yy + 6], fill=INK)
    d.text((mx + 6, y0 + 4), "1.1\u00b0 magic", font=F_S, fill=INK)
    d.line([px(t, L.predicted_period(t)) for t in np.linspace(0.46, 5, 300)], fill=INK2, width=3)
    lx = x1 - 360
    d.rectangle([lx - 12, y0 + 2, x1 - 2, y0 + 110], fill=(255, 255, 255, 235), outline=RULE)
    d.line([lx, y0 + 18, lx + 24, y0 + 18], fill=INK2, width=3)
    d.text((lx + 32, y0 + 8), "predicted a / (2 sin \u03b8/2)", font=F_S, fill=INK2)
    d.ellipse([lx + 6, y0 + 38, lx + 18, y0 + 50], fill=INK)
    d.text((lx + 32, y0 + 34), "from the quantum morph", font=F_S, fill=INK)
    d.polygon([(lx + 12, y0 + 62), (lx + 19, y0 + 69), (lx + 12, y0 + 76), (lx + 5, y0 + 69)], outline=WARN)
    d.text((lx + 32, y0 + 60), "register echo", font=F_S, fill=WARN)
    d.ellipse([lx + 6, y0 + 88, lx + 18, y0 + 100], outline=INK3, width=2)
    d.text((lx + 32, y0 + 84), "original layers (check)", font=F_S, fill=INK2)
    return im


def draw_points(d, frames, upto):
    for f in frames[:upto + 1]:
        x = px(f["theta"], 0)[0]
        if f["L_ref"]:
            y = px(f["theta"], f["L_ref"])[1]
            d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=INK3, width=2)
        if f["status"] == "ok":
            y = px(f["theta"], f["L_meas"])[1]
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=INK, outline=PAPER)
        elif f["status"] == "null":
            y = px(f["theta"], f["L_meas"])[1]
            d.polygon([(x, y - 7), (x + 7, y), (x, y + 7), (x - 7, y)], outline=WARN)
        else:
            y = PLOT[3]
            d.line([x - 4, y - 4, x + 4, y + 4], fill=INK3, width=2)
            d.line([x - 4, y + 4, x + 4, y - 4], fill=INK3, width=2)


def text_panel(d, f):
    th, x = f["theta"], 1290
    magic = abs(th - 1.1) < 0.026
    d.text((x, 66), "Magic Angle", font=F_TITLE, fill=INK)
    d.text((x + 2, 140), "Two honeycomb layers in one 21-qubit state", font=F_BODY, fill=INK2)
    d.text((x, 186), f"\u03b8 = {th:.2f}\u00b0", font=F_BIG, fill=INK)
    if magic:
        d.rounded_rectangle([x + 400, 222, x + 560, 258], radius=18, fill=INK)
        d.text((x + 420, 229), "MAGIC ANGLE", font=F_H, fill=PAPER)
    y = 320
    lp = f["L_pred"]
    d.line([x, y - 14, W - 60, y - 14], fill=RULE)
    d.text((x, y), "PREDICTED", font=F_S, fill=INK2)
    d.text((x, y + 22), "\u221e (layers aligned)" if lp is None else f"{lp:.1f} px  =  {lp * NM_PER_PX:.1f} nm in graphene",
           font=F_MONO, fill=INK)
    y += 70
    d.text((x, y), "FROM THE QUANTUM MORPH (FFT)", font=F_S, fill=INK2)
    if f["L_meas"] is None:
        d.text((x, y + 22), "no pair beyond the resolution limit", font=F_MONO, fill=INK2)
    else:
        d.text((x, y + 22), f"{f['L_meas']:.1f} px  (split {f['theta_meas']:.2f}\u00b0)", font=F_MONO,
               fill=INK if f["status"] == "ok" else WARN)
    d.text((x, y + 50), STATUS[f["status"]], font=F_S,
           fill=INK if f["status"] == "ok" else (WARN if f["status"] == "null" else INK2))
    y += 100
    d.text((x, y), "METHOD CHECK ON THE ORIGINAL LAYERS", font=F_S, fill=INK2)
    d.text((x, y + 22), "pattern larger than the frame" if not f["L_ref"] else f"{f['L_ref']:.1f} px", font=F_MONO, fill=INK2)
    y += 80
    d.line([x, y - 14, W - 60, y - 14], fill=RULE)
    d.text((x, y), "JOB", font=F_S, fill=INK2)
    d.text((x, y + 20), f["job_id"], font=F_S, fill=INK)
    d.text((x, y + 50), "telablur-v1 \u00b7 strength 0.25 \u00b7 1024 x 1024 px", font=F_S, fill=INK2)
    d.text((x, y + 72), "20 pixel + 1 selector = 21 qubits", font=F_S, fill=INK2)
    d.text((x, y + 94), "Atlas statevector simulator", font=F_S, fill=INK2)


def main():
    frames, summary = load_frames()
    n = len(frames)
    base = plot_base()
    start, end, edges = schedule(frames)
    xfade = int(0.2 * FPS)
    writer = imageio_ffmpeg.write_frames(str(HERE / "magic_angle.mp4"), (W, H), fps=FPS, codec="libx264",
                                         quality=8, pix_fmt_out="yuv420p", macro_block_size=8,
                                         output_params=["-movflags", "+faststart"])
    writer.send(None)
    for t in range(FPS * SECONDS):
        canvas = Image.new("RGB", (W, H), PAPER)
        if t < start:
            k, a = 0, 0.0
        elif t >= end:
            k, a = n - 1, 0.0
        else:
            k = min(int(np.searchsorted(edges, t, side="right") - 1), n - 1)
            into = t - edges[k]
            a = 1 - into / xfade if (k > 0 and into < xfade) else 0.0
        f = frames[k]
        imgs = {key: f[key] for key in ("map", "mapin", "raw")}
        if a > 0:
            imgs = {key: Image.blend(v, frames[k - 1][key], a) for key, v in imgs.items()}
        canvas.paste(imgs["mapin"], ORIG_XY)
        canvas.paste(imgs["map"], MORPH_XY)
        d = ImageDraw.Draw(canvas)
        d.text((60, 22), "WHAT THE NOISE REMEMBERS", font=F_S, fill=INK)
        d.text((W - 60, 22), "CHALLENGE 04 \u00b7 HIDE", font=F_S, fill=INK, anchor="ra")
        d.line([60, 52, W - 60, 52], fill=INK)
        for (x, y), lab in ((ORIG_XY, "ORIGINAL  \u00b7  THE TWO INPUT LAYERS"), (MORPH_XY, "QUANTUM MORPH  \u00b7  TELABLUR-V1 OUTPUT")):
            d.rectangle([x - 1, y - 1, x + SQ, y + SQ], outline=INK)
            d.text((x, y - 30), lab, font=F_S, fill=INK)
        d.text((ORIG_XY[0], ORIG_XY[1] + SQ + 8), "moire envelope (classical FFT band-pass), full 1024 px frame, same band for both",
               font=F_S, fill=INK2)
        rx, ry = MORPH_XY[0] + SQ - RAW - 12, MORPH_XY[1] + SQ - RAW - 12
        canvas.paste(imgs["raw"], (rx, ry))
        d.rectangle([rx - 2, ry - 2, rx + RAW + 1, ry + RAW + 1], outline=INK, width=2)
        d.rectangle([rx - 2, ry - 26, rx + RAW + 1, ry - 3], fill=INK)
        d.text((rx + 6, ry - 23), "RAW CENTRE CROP, 1:1", font=F_S, fill=PAPER)
        text_panel(d, f)
        canvas.paste(base, (0, 0), base)
        draw_points(d, frames, k if t < end else n - 1)
        if t < end:
            cx = px(f["theta"], 0)[0]
            d.line([cx, PLOT[1], cx, PLOT[3]], fill=INK)
        d.line([60, 1030, W - 60, 1030], fill=RULE)
        d.text((60, 1042), f"real frame {k + 1}/{n}  \u00b7  every image is a completed Atlas job or a classical FFT of one  \u00b7  0.2 s crossfades between frames are classical",
               font=F_S, fill=INK2)
        if t < start + 10:
            al = 1.0 if t < start else 1 - (t - start) / 10
            ov = Image.new("RGBA", (W, H), PAPER + (int(242 * al),))
            canvas.paste(ov, (0, 0), ov)
            if al > 0.3:
                d2 = ImageDraw.Draw(canvas)
                d2.text((W // 2, 470), "Magic Angle", font=font("segoeuil.ttf", 120), fill=INK, anchor="ms")
                d2.text((W // 2, 560), "Two honeycombs twist from 0\u00b0 to 5\u00b0 through 45 real 21-qubit quantum morphs.",
                        font=F_BODY, fill=INK2, anchor="ms")
                d2.line([W // 2 - 360, 600, W // 2 + 360, 600], fill=INK)
                d2.text((W // 2, 636), "WHAT THE NOISE REMEMBERS \u00b7 CHALLENGE 04 \u00b7 AN INDEPENDENT MOTH HACK 2026 ENTRY",
                        font=F_S, fill=INK, anchor="ms")
        if t >= end:
            al = min(1.0, (t - end) / 12)
            ov = Image.new("RGBA", (1150, 560), PAPER + (int(251 * al),))
            canvas.paste(ov, (60, 130), ov)
            if al > 0.5:
                d3 = ImageDraw.Draw(canvas)
                d3.rectangle([60, 130, 1209, 689], outline=INK)
                d3.rectangle([60, 130, 1209, 162], fill=INK)
                d3.text((80, 137), "RESULT", font=F_S, fill=PAPER)
                d3.text((100, 180), "What the noise remembers", font=F_TITLE, fill=INK)
                bd = summary["band_1.5_5.0"]
                lines = [
                    f"From 1.5\u00b0 to 5\u00b0 all {bd['n']} morph frames give a period that tracks the twist:",
                    f"median {bd['median']:.2f} of a / (2 sin \u03b8/2), range {bd['min']:.2f} to {bd['max']:.2f}.",
                    f"Near 1.1\u00b0 the split matches the register's own echo ({summary['null_split_deg']:.2f}\u00b0 in the",
                    "untwisted frame), so the magic angle itself is not resolved here.",
                    "Geometry only: no band structure or superconductivity is simulated.",
                ]
                for i, s in enumerate(lines):
                    d3.text((100, 270 + 40 * i), s, font=F_BODY, fill=INK2 if i < 4 else INK)
                d3.line([100, 488, 1170, 488], fill=RULE)
                d3.text((100, 504), "Magic angle: Cao et al., Nature 556, 43 (2018)", font=F_S, fill=INK)
                d3.text((100, 532), "Flat bands predicted: Bistritzer & MacDonald, PNAS 108, 12233 (2011)", font=F_S, fill=INK)
                d3.text((100, 574), "telablur-v1 on Moth Atlas \u00b7 statevector simulator \u00b7 1024 x 1024 px per frame",
                        font=F_S, fill=INK2)
        writer.send(np.asarray(canvas, dtype=np.uint8).tobytes())
    writer.close()
    print("magic_angle.mp4 written")


if __name__ == "__main__":
    main()
