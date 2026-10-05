"""Assemble web/index.html: inline the brand CSS and the real engine outputs, write ASCII-only HTML.

Inlined data (all exact engine outputs, re-encoded losslessly or at stated precision):
- KERNELS: for each of the 4 shells x {original, blur 0.25, 0.5, 1.0}, the 32 x 32 block [112:144, 112:144] of
  the 256 x 256 kernel grid as float32. Outside that block every engine output is exactly 0 (asserted below).
- SNAP: the 128 x 128 top-left corner of the 528 x 528 snapshot (original, blur 0.25, blur 0.5), divided by the
  input maximum (99), as uint16 (x 65535). Outside that corner every value is exactly 0 (asserted below).
- STAMPS (Orbium in 8 orientations + measured headings), DYN (out/dynamics.json), job tables.
- SPRITES (web/sprites.json, written by make_sprites.py) and the shared common/inksprite.js helper: the pixel-art cast.
  The mascot PNG for the hub (web/img/mascot.png) is rendered from the same sprites with common/mascot.py.
The page plays a compact 1280 x 720 H.264 copy of the 1920 x 1080 film (web/media/quantum_lenia_720p.mp4, encoded
here with the bundled ffmpeg, kept under 2 MB so it starts fast on a phone), with a WebP poster made from hero.png.
The page uses preload="none" + poster: nothing is fetched until the viewer presses Play. (With preload="metadata",
Chromium reads the first frame, holds the request open and cancels it about 16 s later: net::ERR_ABORTED.)
"""
import base64
import csv
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = ROOT / "common" / "inksprite.js"
SPRITES = WEB / "sprites.json"
MASCOT = WEB / "img" / "mascot.png"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next navigation for the whole set)

sys.path.insert(0, str(HERE))
import lenia as L  # noqa: E402
from render_mp4 import SCENE  # noqa: E402

B0, BS = 112, 32
SETS = [("o", None, None), ("q25", "k_s0.25_r0.0.npy", 0.25), ("q50", "k_s0.5_r0.0.npy", 0.5), ("q100", "k_s1.0_r0.0.npy", 1.0)]


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode("ascii")


def main():
    (WEB / "media").mkdir(parents=True, exist_ok=True)
    kd = HERE / "out" / "kernels"
    bank = np.load(kd / "bank_input.npy")
    kj = {r["strength"]: r for r in csv.DictReader(open(HERE / "out" / "kernel_jobs.csv", encoding="utf-8"))
          if r["status"] == "completed"}
    kernels, kjobs = {sh: {} for sh in L.SHAPES}, {}
    for code, f, s in SETS:
        arr = bank if f is None else np.load(kd / f)
        mask = np.zeros(arr.shape[1:], bool)
        mask[B0:B0 + BS, B0:B0 + BS] = True
        assert not arr[:, ~mask].any(), f"{code}: non-zero outside the 32x32 block"
        for i, sh in enumerate(L.SHAPES):
            kernels[sh][code] = b64(arr[i, B0:B0 + BS, B0:B0 + BS].astype("<f4"))
        if s is not None:
            r = kj[str(s)]
            kjobs[code] = {"job_id": r["job_id"], "strength": s, "reach": 0, "style": "x", "axes": [1, 2], "qubits": int(r["qubits"])}

    sj = {r["strength"]: r for r in csv.DictReader(open(HERE / "out" / "snapshot_jobs.csv", encoding="utf-8"))
          if r["status"] == "completed"}
    snap, sjobs = {}, {}
    for code, f, s in [("orig", HERE / "out" / "world.npy", None), ("q25", HERE / "out/snapshot/w_s0.25.npy", 0.25),
                       ("q50", HERE / "out/snapshot/w_s0.5.npy", 0.5)]:
        a = np.load(f).astype(np.float64)
        assert a.shape == (528, 528) and not a[128:, :].any() and not a[:, 128:].any(), code
        snap[code] = b64(np.rint(np.clip(a[:128, :128] / 99, 0, 1) * 65535).astype("<u2"))
        if s is not None:
            r = sj[str(s)]
            sjobs[code] = {"job_id": r["job_id"], "strength": s, "reach": 0, "style": "x", "qubits": int(r["qubits"]),
                           "nonzero": int(r["nonzero"])}

    st = json.load(open(HERE / "out" / "stamps.json"))
    stamps = [{"t": x["t"], "cells": b64(np.array(x["cells"], dtype=np.uint8)), "heading": x["heading"]} for x in st]
    dyn = json.load(open(HERE / "out" / "dynamics.json"))

    mp4, web_mp4 = HERE / "quantum_lenia.mp4", WEB / "media" / "quantum_lenia_720p.mp4"
    if not web_mp4.exists() or web_mp4.stat().st_mtime < mp4.stat().st_mtime:
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp4),
                        "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "30",
                        "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(web_mp4)], check=True)
    assert web_mp4.stat().st_size < 2_000_000, f"web film too large: {web_mp4.stat().st_size:,} bytes"
    stale = WEB / "media" / "quantum_lenia.mp4"   # the earlier full-size copy, replaced by the 720p one
    if stale.exists():
        stale.unlink()
    poster = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "hero.png"
    if poster.exists():
        Image.open(poster).convert("RGB").resize((1280, 720), Image.LANCZOS).save(WEB / "media" / "poster.webp", "WEBP", quality=88, method=6)

    sprites = json.loads(SPRITES.read_text(encoding="utf-8"))
    subprocess.run([sys.executable, str(ROOT / "common" / "mascot.py"), str(SPRITES), "orbi", str(MASCOT), "--scale", "4"], check=True)

    html = (WEB / "template.html").read_text(encoding="utf-8")
    for key, val in [("/*BRAND*/", BRAND.read_text(encoding="utf-8")),
                     ("/*KERNELS*/{}", json.dumps(kernels)), ("/*KJOBS*/{}", json.dumps(kjobs)),
                     ("/*SNAP*/{}", json.dumps(snap)), ("/*SJOBS*/{}", json.dumps(sjobs)),
                     ("/*STAMPS*/[]", json.dumps(stamps)), ("/*DYN*/{}", json.dumps(dyn)),
                     ("/*SCENE*/[]", json.dumps(SCENE)),
                     ("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":"))),
                     ("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))]:
        assert key in html, key
        html = html.replace(key, val)
    assert "<!--NAV-->" in html, "<!--NAV-->"
    html = html.replace("<!--NAV-->", nav_html("17-quantum-lenia"))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

    files = {p.relative_to(WEB).as_posix(): p.relative_to(ROOT).as_posix()
             for d in ("media", "img") for p in sorted((WEB / d).glob("*")) if p.is_file()}
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    size = (WEB / "index.html").stat().st_size + sum((WEB / k).stat().st_size for k in files)
    print(f"web/index.html written ({(WEB / 'index.html').stat().st_size:,} bytes); page total {size / 1e6:.2f} MB; files {list(files)}")


if __name__ == "__main__":
    main()
