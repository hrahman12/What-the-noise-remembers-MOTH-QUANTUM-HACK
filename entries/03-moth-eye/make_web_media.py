"""Web copies of the film for the interactive page (classical media conversion, no Atlas calls).

moth_eye.mp4 (the brief's deliverable, rendered by render/render.cjs at crf 20) is re-encoded smaller for the
page: H.264 High, yuv420p, crf 28, faststart, no audio track (the film is silent). Also writes a lossless WebP
poster frame for the <video> element and refreshes hero.png from the same frame.
Run after render/render.cjs and before build_web.py.
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
SRC = HERE / "moth_eye.mp4"
VID = HERE / "web" / "video" / "moth_eye.mp4"
POSTER = HERE / "web" / "img" / "film-poster.webp"
POSTER_T = "33.5"   # 6 layers x 6 rays, the 21-qubit run
FF = imageio_ffmpeg.get_ffmpeg_exe()


def run(*args):
    subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)


if __name__ == "__main__":
    VID.parent.mkdir(parents=True, exist_ok=True)
    POSTER.parent.mkdir(parents=True, exist_ok=True)
    run("-i", str(SRC), "-an", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "28",
        "-preset", "slow", "-tune", "animation", "-movflags", "+faststart", str(VID))
    run("-ss", POSTER_T, "-i", str(SRC), "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1",
        "-compression_level", "6", str(POSTER))
    run("-ss", POSTER_T, "-i", str(SRC), "-frames:v", "1", str(HERE / "hero.png"))
    for f in (SRC, VID, POSTER, HERE / "hero.png"):
        print(f"{f.relative_to(HERE)}: {f.stat().st_size / 1e6:.2f} MB")
