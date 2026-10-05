"""Render the 30 s moving-image deliverable: quantum_lenia.mp4 (1920 x 1080, 30 fps, H.264).

Act 1 (0-19 s): the same five Orbia in four 256 x 256 worlds, one per kernel: the original ring kernel and the
three real blur-core-v1 outputs (strength 0.25 / 0.5 / 1.0). Act 2 (19-30 s): "what the noise remembers":
the colony snapshot, un-blurred and as returned by blur-core-v1 at strength 0.25 and 0.5, seeded into the
world and run with the original kernel.

The DYNAMICS ARE CLASSICAL LENIA (lenia.py), run here frame by frame. Only the kernels and the snapshots are
quantum-engine outputs (Atlas blur-core-v1, classical statevector simulator). Nothing in a frame is
fabricated or edited; captions name the job behind each panel.
"""
from __future__ import annotations

import csv
import json
import os

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import lenia as L
from qblur import HERE

W, H, FPS, SECONDS = 1920, 1080, 30, 30
N = 256
FONTS = r"C:\Windows\Fonts"
# Look: the Moth Hack brief-page style of common/brand.css (paper ground, one ultramarine ink, light sans headings,
# uppercase mono labels, hairlines, a solid-ink bar). Segoe UI Light / Consolas stand in for Geist / IBM Plex Mono,
# which are web fonts the page loads but which are not installed on this machine.
F = {
    "display": ImageFont.truetype(FONTS + r"\segoeuil.ttf", 66),
    "h2": ImageFont.truetype(FONTS + r"\segoeuil.ttf", 38),
    "body": ImageFont.truetype(FONTS + r"\segoeui.ttf", 24),
    "small": ImageFont.truetype(FONTS + r"\segoeui.ttf", 19),
    "mono": ImageFont.truetype(FONTS + r"\consola.ttf", 19),
    "monob": ImageFont.truetype(FONTS + r"\consolab.ttf", 21),
}
PAPER, RULE, INK, INK2 = (251, 250, 249), (211, 211, 230), (25, 35, 142), (84, 91, 169)

# Colour map shared with the page (web/template.html, function lut()): paper (empty) to ink (full), on v^0.7.
STOPS = [(0.0, PAPER), (0.2, RULE), (0.55, INK2), (1.0, INK)]


def lut():
    xs = np.linspace(0, 1, 256)
    out = np.zeros((256, 3))
    for c in range(3):
        out[:, c] = np.interp(xs, [s[0] for s in STOPS], [s[1][c] for s in STOPS])
    return out.astype(np.uint8)


LUT = lut()


def colour(A):
    return LUT[np.clip(np.rint(np.clip(A, 0, 1) ** 0.7 * 255), 0, 255).astype(np.uint8)]


def jobs():
    k = {r["strength"]: r["job_id"] for r in csv.DictReader(open(HERE / "out" / "kernel_jobs.csv")) if r["status"] == "completed"}
    s = {r["strength"]: r["job_id"] for r in csv.DictReader(open(HERE / "out" / "snapshot_jobs.csv")) if r["status"] == "completed"}
    return k, s


SCENE = [(40, 46, 0), (64, 176, 5), (150, 60, 2), (176, 188, 7), (112, 118, 1)]   # (y, x, stamp orientation)


def scene():
    st = json.load(open(HERE / "out" / "stamps.json"))
    A = np.zeros((N, N))
    for y, x, t in SCENE:
        c = np.array(st[t]["cells"], float) / 255
        A[y:y + 20, x:x + 20] = np.maximum(A[y:y + 20, x:x + 20], c)
    return A


def panel(img, A, x, y, size, caption, sub, kern=None):
    d = ImageDraw.Draw(img)
    im = Image.fromarray(colour(A)).resize((size, size), Image.BICUBIC)
    img.paste(im, (x, y))
    d.rectangle([x - 1, y - 1, x + size, y + size], outline=INK, width=1)
    if kern is not None:
        k = kern / kern.max()
        ki = Image.fromarray(colour(k)).resize((96, 96), Image.NEAREST)
        img.paste(ki, (x + size - 106, y + 10))
        d.rectangle([x + size - 107, y + 9, x + size - 10, y + 106], outline=INK, width=1)
    d.text((x, y + size + 12), caption.upper(), font=F["monob"], fill=INK)
    d.text((x, y + size + 40), sub, font=F["mono"], fill=INK2)


def footer(d):
    d.rectangle([0, H - 64, W, H], fill=INK)   # solid-ink bar, as on the brief pages
    d.text((60, H - 43), "WHAT THE NOISE REMEMBERS  \u00b7  MOTH HACK 2026  \u00b7  CHALLENGE 04", font=F["mono"], fill=PAPER)
    msg = "DYNAMICS: CLASSICAL LENIA (CHAN 2019)  \u00b7  QUANTUM: ATLAS BLUR-CORE-V1, CLASSICAL STATEVECTOR SIMULATOR"
    d.text((W - 60 - d.textlength(msg, font=F["mono"]), H - 43), msg, font=F["mono"], fill=PAPER)


def main():
    kj, sj = jobs()
    dyn = json.load(open(HERE / "out" / "dynamics.json"))
    sp = {k: dyn["orbium"][f"ring|{k}"] for k in ("orig", "s0.25", "s0.5", "s1.0")}
    fate = lambda k: (f"glides  {sp[k]['speed']:.2f} cells/step" if sp[k]["fate"] == "glides" else
                      "life floods the world" if sp[k]["fate"] == "fills the world" else sp[k]["fate"])
    rg = {k: dyn["regrow"][k]["1000"]["creatures"] for k in ("orig", "s0.25", "s0.5")}
    bank = np.load(HERE / "out" / "kernels" / "bank_input.npy")
    K = {"orig": bank[0]}
    for s in ("0.25", "0.5", "1.0"):
        K[s] = np.load(HERE / "out" / "kernels" / f"k_s{s}_r0.0.npy")[0]
    act1 = [("orig", "Original ring kernel", "classical \u00b7 Chan 2019 Orbium kernel"),
            ("0.25", "Quantum-blurred \u00b7 strength 0.25", f"blur-core-v1 job {kj['0.25'][:8]}"),
            ("0.5", "Quantum-blurred \u00b7 strength 0.5", f"blur-core-v1 job {kj['0.5'][:8]}"),
            ("1.0", "Quantum-blurred \u00b7 strength 1.0", f"blur-core-v1 job {kj['1.0'][:8]}")]
    worlds1 = [scene() for _ in act1]
    kf1 = [L.kernel_fft(K[k].astype(float)) for k, _, _ in act1]
    corners = [np.load(HERE / "out" / "world.npy").astype(float)[:128, :128] / 99,
               np.load(HERE / "out" / "snapshot" / "w_s0.25.npy").astype(float)[:128, :128] / 99,
               np.load(HERE / "out" / "snapshot" / "w_s0.5.npy").astype(float)[:128, :128] / 99]
    worlds2 = []
    for c in corners:
        A = np.zeros((N, N))
        A[64:192, 64:192] = np.clip(c, 0, 1)
        worlds2.append(A)
    kf_orig = L.kernel_fft(K["orig"].astype(float))
    act2 = [("Un-blurred colony", "classical snapshot \u00b7 528\u00b2 world"),
            ("Blurred \u00b7 strength 0.25", f"blur-core-v1 job {sj['0.25'][:8]} \u00b7 20 qubits"),
            ("Blurred \u00b7 strength 0.5", f"blur-core-v1 job {sj['0.5'][:8]} \u00b7 20 qubits")]

    T1, FADE = 19 * FPS, 15
    HOLD2 = 45
    out = HERE / "quantum_lenia.mp4"
    preview = os.environ.get("PREVIEW")   # e.g. PREVIEW=dir: save a few PNG frames instead of encoding
    keep = {0, 300, 330, 569, 575, 640, 899}
    wr = None if preview else imageio_ffmpeg.write_frames(str(out), (W, H), fps=FPS, codec="libx264", quality=None,
                                     output_params=["-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"],
                                     macro_block_size=8)
    if wr:
        wr.send(None)
    t1 = t2 = 0
    last1 = None
    for f in range(SECONDS * FPS):
        img = Image.new("RGB", (W, H), PAPER)
        d = ImageDraw.Draw(img)
        if f < T1:
            size, gap, x0, y0 = 400, 30, 60, 46
            for i, (key, cap, sub) in enumerate(act1):
                px, py = x0 + (i % 2) * (size + gap), y0 + (i // 2) * (size + 78)
                kb = K[key][112:144, 112:144]
                panel(img, worlds1[i], px, py, size, cap, sub, kb)
            rx = 960
            d.text((rx, 60), "QUANTUM LENIA", font=F["mono"], fill=INK)
            d.line([rx, 88, W - 60, 88], fill=INK, width=1)
            d.text((rx, 100), "Same creatures,", font=F["display"], fill=INK)
            d.text((rx, 174), "four senses of touch.", font=F["display"], fill=INK)
            for j, line in enumerate([
                    "Five Orbium creatures start each world. Each cell grows or",
                    "decays from a ring-weighted sum of its neighbours: the kernel",
                    "(inset). Three kernels went through a quantum blur:",
                    "blur-core-v1 on an 18-qubit register, Atlas simulator.",
                    "",
                    "Measured in our runs (lone Orbium, \u03bc 0.15, \u03c3 0.015):",
                    "  original   " + fate("orig"),
                    "  s = 0.25   " + fate("s0.25"),
                    "  s = 0.5    " + fate("s0.5"),
                    "  s = 1.0    " + fate("s1.0")]):
                d.text((rx, 280 + j * 34), line, font=F["mono"] if line.startswith("  ") else F["body"], fill=INK if line.startswith("  ") else INK2)
            d.line([rx, 640, W - 60, 640], fill=RULE, width=1)
            d.text((rx, 656), f"t = {t1:4d} steps", font=F["h2"], fill=INK)
            d.text((rx, 712), "1 LENIA STEP PER FRAME \u00b7 T = 10 \u00b7 R = 13", font=F["mono"], fill=INK2)
            for i in range(4):
                worlds1[i] = L.step(worlds1[i], kf1[i])
            t1 += 1
            footer(d)
            if f >= T1 - FADE:
                last1 = img.copy()
        else:
            size, gap, x0, y0 = 520, 50, 125, 250
            d.text((125, 62), "WHAT THE NOISE REMEMBERS", font=F["mono"], fill=INK)
            d.line([125, 90, W - 125, 90], fill=INK, width=1)
            d.text((125, 100), "Seed the world from a quantum-blurred snapshot. What regrows?", font=F["h2"], fill=INK)
            d.text((125, 160), f"Original kernel for all three. Measured after 1,000 steps: {rg['orig']} creatures from the un-blurred colony, "
                   f"{rg['s0.25']} from strength 0.25, {rg['s0.5']} from strength 0.5.",
                   font=F["body"], fill=INK2)
            for i, (cap, sub) in enumerate(act2):
                panel(img, worlds2[i], x0 + i * (size + gap), y0, size, cap, sub)
            d.text((125, 870), "Each panel: the 128 x 128 colony corner of the 528 x 528 snapshot (the only non-zero region of all three), "
                   "centred in a 256 x 256 world.", font=F["small"], fill=INK2)
            d.text((125, 898), "Engine outputs are used exactly as returned, divided by the input maximum (99). "
                   "Then classical Lenia takes over.", font=F["small"], fill=INK2)
            d.text((W - 400, 160 + 40), f"t = {t2:4d}", font=F["h2"], fill=INK)
            if f - T1 >= HOLD2:
                for i in range(3):
                    worlds2[i] = L.step(worlds2[i], kf_orig)
                t2 += 1
            footer(d)
            if f - T1 < FADE and last1 is not None:
                img = Image.blend(last1, img, (f - T1 + 1) / FADE)
        if wr:
            wr.send(np.asarray(img, dtype=np.uint8).tobytes())
        elif f in keep:
            img.save(os.path.join(preview, f"frame_{f:03d}.png"))
        if f % 150 == 0:
            print("frame", f, flush=True)
    if wr:
        wr.close()
        print("wrote", out)


if __name__ == "__main__":
    main()
