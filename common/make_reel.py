"""Stitch highlight clips into one README reel: python common/make_reel.py slug1 slug2 ... [--max-mb 9]

Reads common/demo_work/<slug>.mp4 (from record_demo.cjs), trims each to <= 4.5 s, stamps the piece number
and title in a small ink pill (bottom-left), concatenates them, and writes docs/demos/highlights.mp4 and
docs/demos/highlights.gif (640 px wide). If the GIF is over --max-mb it retries at a lower frame rate and width.
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
WORK = ROOT / "common" / "demo_work"
OUT = ROOT / "docs" / "demos"
FONT = "C\\:/Windows/Fonts/consola.ttf"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
max_mb = 9.0
if "--max-mb" in sys.argv:
    max_mb = float(sys.argv[sys.argv.index("--max-mb") + 1])
    args = [a for a in args if a != str(sys.argv[sys.argv.index("--max-mb") + 1])]


def title(slug):
    p = json.loads((ROOT / "entries" / slug / "piece.json").read_text(encoding="utf-8"))
    t = f"{slug[:2]}  {p.get('title', slug)}"
    return t.replace("\\", "").replace("'", "’").replace(":", "\\:").replace("%", "\\%")


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    parts = []
    for k, slug in enumerate(args):
        src = WORK / f"{slug}.mp4"
        if not src.exists():
            print("skip (no clip):", slug)
            continue
        dst = WORK / f"_part{k:02d}.mp4"
        vf = (f"scale=960:600:force_original_aspect_ratio=decrease,pad=960:600:(ow-iw)/2:(oh-ih)/2:color=0xFBFAF9,"
              f"drawbox=x=16:y=ih-58:w=tw+40:h=40:color=0x19238E@1:t=fill,"
              f"drawtext=fontfile='{FONT}':text='{title(slug)}':x=36:y=h-48:fontsize=20:fontcolor=0xFBFAF9")
        # drawbox can't read text width, so draw a fixed pill sized from the title length
        tw = 12 * len(title(slug).replace("\\", "")) + 24
        vf = vf.replace("w=tw+40", f"w={tw}")
        run([FF, "-y", "-loglevel", "error", "-i", str(src), "-t", "4.5", "-vf", vf, "-r", "24",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-an", str(dst)])
        parts.append(dst)
    lst = WORK / "_list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    mp4 = OUT / "highlights.mp4"
    run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "25", "-movflags", "+faststart", str(mp4)])
    gif = OUT / "highlights.gif"
    for fps, width, colors in [(12, 640, 128), (10, 600, 112), (10, 540, 96), (8, 480, 96)]:
        run([FF, "-y", "-loglevel", "error", "-i", str(mp4), "-vf",
             f"fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];"
             f"[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", str(gif)])
        mb = gif.stat().st_size / 1e6
        print(f"gif {fps} fps {width}px -> {mb:.1f} MB")
        if mb <= max_mb:
            break
    print(f"wrote {mp4} ({mp4.stat().st_size / 1e6:.1f} MB) and {gif} ({gif.stat().st_size / 1e6:.1f} MB) from {len(parts)} clips")


if __name__ == "__main__":
    main()
