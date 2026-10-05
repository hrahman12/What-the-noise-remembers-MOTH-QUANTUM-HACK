"""tweezer_day.mp4: a 60 s walk through the completed stages (4 s each), drawn from the real cached outputs.

Every picture is either an engine output file or a plain drawing of an engine's returned numbers (CLASSICAL rendering).
Soundtrack: retrocausal-echo-v1's output (the 18:00 stage), looped. Needs imageio-ffmpeg.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
W, H, FPS, SEC = 1280, 720, 24, 4
NIGHT, DUSK, LINE, MOON, HAZE, WING = (251, 250, 249), (255, 255, 255), (211, 211, 230), (25, 35, 142), (84, 91, 169), (25, 35, 142)  # brand paper / ink


def font(size, mono=False):
    for f in (["consola.ttf", "cour.ttf"] if mono else ["segoeuil.ttf", "segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_BIG, F_MID, F_SM, F_MONO = font(64), font(34), font(22), font(18, mono=True)


def fit(img, bw=600, bh=470):
    img = img.convert("RGB")
    s = min(bw / img.width, bh / img.height)
    return img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.NEAREST if max(img.size) < 200 else Image.LANCZOS)


def array_img(bits, size=600):
    im = Image.new("RGB", (size, size), NIGHT)
    d = ImageDraw.Draw(im)
    p = size / 12
    for i, b in enumerate(bits):
        x, y = (i % 12 + .5) * p, (i // 12 + .5) * p
        d.ellipse([x - p * .34, y - p * .34, x + p * .34, y + p * .34], outline=LINE, width=2)
        if b > 0:
            c = tuple(int(NIGHT[k] + (WING[k] - NIGHT[k]) * min(1, b)) for k in range(3))
            d.ellipse([x - p * .26, y - p * .26, x + p * .26, y + p * .26], fill=c)
    return im


def heat_img(grid, w=600, h=300):
    g = np.asarray(grid, float)
    g = g / max(g.max(), 1e-12)
    rgb = (np.array(NIGHT)[None, None] * (1 - g[..., None]) + np.array(WING)[None, None] * g[..., None]).astype(np.uint8)
    return Image.fromarray(rgb, "RGB").resize((w, h), Image.NEAREST)


def bars_img(a, b=None, w=600, h=300):
    im = Image.new("RGB", (w, h), NIGHT)
    d = ImageDraw.Draw(im)
    n = len(a)
    d.line([0, h // 2, w, h // 2], fill=LINE)
    for i, v in enumerate(a):
        x = 10 + i * (w - 20) / n
        y1 = h // 2 - v * h * .45
        d.rectangle([x, min(h // 2, y1), x + (w - 20) / n * .4, max(h // 2, y1)], fill=HAZE)
        if b is not None:
            y2 = h // 2 - b[i] * h * .45
            d.rectangle([x + (w - 20) / n * .45, min(h // 2, y2), x + (w - 20) / n * .85, max(h // 2, y2)], fill=WING)
    return im


def zone_img(nodes_on, edges, lit=None, w=600, h=480):
    im = Image.new("RGB", (w, h), NIGHT)
    d = ImageDraw.Draw(im)
    pos = lambda k: (70 + (k % 5) * 115, 70 + (k // 5) * 115)  # noqa: E731
    for e in edges:
        d.line([pos(e[0]), pos(e[1])], fill=WING, width=4)
    for k in range(20):
        x, y = pos(k)
        on = nodes_on[k]
        fill = WING if (lit and lit[k] == "1") else (DUSK if on else NIGHT)
        d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=fill, outline=MOON if on else LINE, width=2)
    return im


def roll_img(notes, w=600, h=300):
    im = Image.new("RGB", (w, h), NIGHT)
    d = ImageDraw.Draw(im)
    if not notes:
        return im
    pmin, pmax = min(n[2] for n in notes), max(n[2] for n in notes)
    T = max(n[0] + n[1] for n in notes)
    for s, du, p, v in notes:
        y = h - 10 - (p - pmin + 1) * (h - 20) / (pmax - pmin + 1)
        d.rectangle([10 + s / T * (w - 20), y, 10 + (s + du) / T * (w - 20) - 1, y + (h - 20) / (pmax - pmin + 1) - 1],
                    fill=tuple(int(NIGHT[k] + (WING[k] - NIGHT[k]) * (.3 + .7 * v / 127)) for k in range(3)))
    return im


def visual(r):
    d, m = r.get("data", {}), r.get("media", {})
    i = r["id"]
    if i == "coin":
        return bars_img([d["heads"] / d["shots"], d["tails"] / d["shots"]])
    if i == "comet":
        return array_img([int(c) for c in d["frames"][0]])
    if i == "qrcimage":
        sheet = Image.new("RGB", (4 * 192, 2 * 192), NIGHT)
        for k in range(8):
            sheet.paste(Image.open(OUT / "qrc_frames" / f"shot{k}.png").convert("RGB"), ((k % 4) * 192, (k // 4) * 192))
        return sheet
    if i == "shader":
        return heat_img(d["T"], 600, 600)
    if i in ("blur", "fryer", "telablur", "blurcore"):
        name = {"blur": "fluor_camera.png", "fryer": "fryer_out.png", "telablur": "rearr_mid.png", "blurcore": "blurcore_blur.png"}[i]
        return Image.open(OUT / name)
    if i == "qpixl":
        return array_img(d["out"])
    if i == "maze":
        return zone_img(d["after"], d["opened"])
    if i == "graph":
        return zone_img(d["zocc"], d["edges"], d["dominant"])
    if i == "blurmidi":
        return roll_img(d["notes_out"])
    if i == "retro":
        g = np.zeros((8, 24))
        tj = json.loads((OUT / d.get("taps_file", "echo_taps.json")).read_text(encoding="utf-8"))   # the stage's primary run
        for t in ((tj.get("extras") or {}).get("tap_map") or {}).get("taps") or []:
            g[t["depth"] - 1, t["site"]] = max(g[t["depth"] - 1, t["site"]], abs(t["level"]))
        return heat_img(g)
    if i == "otoc":
        return heat_img(np.array(d["noisy"]).T)
    if i == "tamagotchi":
        succ = d["runs"][0]["success"] + [0.0] * (40 - len(d["runs"][0]["success"]))
        return heat_img(np.clip((np.array(succ).reshape(2, 20) - 0.5) * 2, 0, 1), 600, 120)
    if i == "qdrive":
        return bars_img(d["z_target"], d["z_got"])
    return Image.new("RGB", (600, 300), NIGHT)


def card(r, done, k):
    im = Image.new("RGB", (W, H), NIGHT)
    d = ImageDraw.Draw(im)
    d.text((40, 24), "WHAT THE NOISE REMEMBERS  ·  CHALLENGE 06  ·  TWEEZER", font=F_MONO, fill=HAZE)
    v = fit(visual(r))
    im.paste(v, (40 + (600 - v.width) // 2, 64 + (470 - v.height) // 2))
    x0 = 700
    d.text((x0, 70), r["clock"], font=F_BIG, fill=WING)
    title = r["title"]
    lines, cur = [], ""
    for w_ in title.split():
        if d.textlength(cur + " " + w_, font=F_MID) > 540:
            lines.append(cur.strip())
            cur = w_
        else:
            cur += " " + w_
    lines.append(cur.strip())
    y = 150
    for ln in lines:
        d.text((x0, y), ln, font=F_MID, fill=MOON)
        y += 42
    y += 10
    for t in (r["engine"], r["where"], f"{r['qubits']} qubits" if r.get("qubits") else "qubits not reported by the engine"):
        d.text((x0, y), t, font=F_MONO, fill=WING if "IBM hardware" in t else HAZE)
        y += 28
    h_ = r["hop"]
    y += 14
    d.text((x0, y), f"survival F = {h_['F']:.3f}", font=F_MID, fill=MOON)
    y += 44
    if h_.get("null") is not None:
        d.text((x0, y), f"chance would score {h_['null']:.3f}", font=F_SM, fill=HAZE)
    # survival curve along the bottom
    cx0, cx1, cy0, cy1 = 60, W - 60, 700, 600
    d.line([cx0, cy0, cx1, cy0], fill=LINE)
    d.line([cx0, cy1, cx1, cy1], fill=LINE)
    pts = []
    for j, s in enumerate(done[: k + 1]):
        x = cx0 + (cx1 - cx0) * j / (len(done) - 1)
        pts.append((x, cy0 - (cy0 - cy1) * s["hop"]["F"]))
        if s["hop"].get("null") is not None:
            yn = cy0 - (cy0 - cy1) * s["hop"]["null"]
            d.line([x - 8, yn, x + 8, yn], fill=HAZE, width=2)
    if len(pts) > 1:
        d.line(pts, fill=WING, width=2)
    for x, y_ in pts:
        d.ellipse([x - 5, y_ - 5, x + 5, y_ + 5], fill=WING)
    d.text((cx0, cy1 - 30), "signal survival at each hop (dashes: chance)", font=F_MONO, fill=HAZE)
    if r["id"] == "blurcore":     # comet keeps no shot order: say what the columns are
        d.text((40, 540), "rows: 144 tweezers; columns: 375 bitstrings in the sorted order of comet's counts (not time)",
               font=F_MONO, fill=HAZE)
    d.text((700, 470), "Analogy: Atlas runs gate-model circuits", font=F_MONO, fill=HAZE)
    d.text((700, 494), "and simulators, not atoms.", font=F_MONO, fill=HAZE)
    return im


def main():
    import imageio_ffmpeg
    chain = sorted(json.loads((OUT / "chain.json").read_text(encoding="utf-8")), key=lambda r: r["clock"])
    done = [r for r in chain if r.get("completed")]
    dst = HERE / "tweezer_day.mp4"
    retro = next((r for r in done if r["id"] == "retro"), None)          # the 18:00 stage's primary echo (ibm_fez when it ran)
    audio = OUT / ((retro or {}).get("media") or {}).get("after", "echo_out.wav")
    if not audio.exists():
        audio = OUT / "echo_out.wav"
    per = round(60 * FPS / len(done))          # frames per stage, so the film is 60 s whatever the stage count
    total = len(done) * per / FPS
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-stream_loop", "-1", "-i", str(audio),
           "-t", f"{total:.2f}", "-af", f"afade=t=out:st={total - 2:.2f}:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p",
           "-crf", "22", "-c:a", "aac", "-b:a", "128k", "-shortest", str(dst)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    prev = None
    for k, r in enumerate(done):
        cur = card(r, done, k)
        for f in range(per):
            fr = Image.blend(prev, cur, min(1, f / 10)) if prev is not None and f < 10 else cur
            p.stdin.write(fr.tobytes())
        prev = cur
    p.stdin.close()
    p.wait()
    print(f"{dst.name}: {len(done)} stages x {per / FPS:.2f} s = {total:.1f} s")


if __name__ == "__main__":
    main()
