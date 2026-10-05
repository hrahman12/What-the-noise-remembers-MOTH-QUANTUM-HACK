"""Assemble web/index.html: inline the brand CSS, the measured frames and the lattice formula,
insert the shared piece-to-piece navigation (common/nav.py, at the template's <!--NAV--> marker),
convert display images to lossless WebP, and write web/files.json. CLASSICAL.

Display images (to keep the page under 15 MB together with the film):
  img/map_<theta>.webp    moire envelope of the engine output (out/maps), 1024 -> MAP px
  img/mapin_<theta>.webp  moire envelope of the original layers (out/maps_in), 1024 -> MAP px
  img/raw_<theta>.webp    centre 384 x 384 px of the raw engine output, 1:1 pixels (never recoloured)
The envelope maps are re-shown on the paper -> ink ramp of the brief-page look (palette.py, display only).

Sprites: web/sprites.json (made by make_sprites.py) and common/inksprite.js are inlined into the page; Lec the
electron is exported as the hub mascot img/mascot.png with common/mascot.py.

Film: magic_angle.mp4 (1920 x 1080 deliverable) is re-encoded to video/magic_angle_web.mp4
(H.264 CRF 24, same 1920 x 1080 size, no audio track, faststart, about 2.2 MB) for the page's <video> element,
and its 1.10 deg frame (t = 10 s) becomes the poster img/film-poster.webp (960 x 540, lossless).
"""
import io
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB = HERE / "web"
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set)

import lattice as L  # noqa: E402
from palette import recolour  # noqa: E402

CROP = 384
MAP = 400
VIDEO = "video/magic_angle_web.mp4"
POSTER = "img/film-poster.webp"
MASCOT = "img/mascot.png"
REL = "entries/04-magic-angle/web/"

PROBE_NOTES = json.loads((HERE / "out" / "probe_notes.json").read_text(encoding="utf-8"))


def fresh(dst, *srcs):
    """True if dst exists and is newer than every source (delete web/img/ to force a full rebuild)."""
    return dst.exists() and all(dst.stat().st_mtime >= s.stat().st_mtime for s in srcs)


def encode_video():
    """Re-encode the 1080p deliverable into a smaller H.264 copy for the page (skipped if current)."""
    src, dst = HERE / "magic_angle.mp4", WEB / VIDEO
    if fresh(dst, src):
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "24",
                    "-profile:v", "high", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", str(dst)], check=True)


def make_poster():
    """One frame of the film (t = 10 s, the 1.10 deg frame) as the <video> poster."""
    png = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-ss", "10",
                          "-i", str(HERE / "magic_angle.mp4"), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                         check=True, capture_output=True).stdout
    Image.open(io.BytesIO(png)).convert("RGB").resize((960, 540), Image.LANCZOS).save(
        WEB / POSTER, "WEBP", lossless=True, method=6)


def make_mascot():
    """Lec, the electron, as the hub mascot (transparent PNG), rendered by the shared common/mascot.py."""
    subprocess.run([sys.executable, str(ROOT / "common" / "mascot.py"), str(WEB / "sprites.json"), "lec",
                    str(WEB / MASCOT), "--scale", "6", "--frame", "1"], check=True)


def main():
    (WEB / "img").mkdir(parents=True, exist_ok=True)
    m = json.loads((HERE / "out" / "measure.json").read_text(encoding="utf-8"))
    frames, files = [], {}
    for r in m["frames"]:
        t = r["theta"]
        mp, mi, rw = f"img/map_{t:.2f}.webp", f"img/mapin_{t:.2f}.webp", f"img/raw_{t:.2f}.webp"
        for src, dst in ((HERE / "out" / "maps" / f"map_{t:.2f}.png", mp), (HERE / "out" / "maps_in" / f"map_{t:.2f}.png", mi)):
            if fresh(WEB / dst, src, HERE / "palette.py"):
                continue
            recolour(Image.open(src)).resize((MAP, MAP), Image.LANCZOS).save(WEB / dst, "WEBP", lossless=True, method=6)
        c = (1024 - CROP) // 2
        src = HERE / "out" / "frames" / r["file"]
        if not fresh(WEB / rw, src):
            Image.open(src).convert("L").crop((c, c, c + CROP, c + CROP)).save(WEB / rw, "WEBP", lossless=True, method=6)
        for k in (mp, mi, rw):
            files[k] = REL + k
        frames.append({"t": t, "j": r["job_id"], "map": mp, "mapin": mi, "raw": rw, "lp": r["L_pred"],
                       "lm": r["L_meas"], "tm": r["theta_meas"], "st": r["status"],
                       "d": r["pair"]["delta"] if r["resolved"] else None,
                       "lr": r["L_ref"], "tr": r["theta_ref"],
                       "p": [round(x, 5) for x in r["profile"]], "pr": [round(x, 5) for x in r["profile_ref"]]})
    encode_video()
    make_poster()
    make_mascot()
    files[MASCOT] = REL + MASCOT
    files[VIDEO] = REL + VIDEO
    files[POSTER] = REL + POSTER
    summary = dict(m["summary"])
    summary["ref_ratio_max_pct"] = round(100 * (summary["ref_ratio_max"] - 1), 1)
    for k, v in (summary.get("band_1.5_5.0") or {}).items():
        summary["band_" + k] = v
    meta = {"a": L.A, "theta0": L.THETA0, "nmPerPx": 0.246 / L.A, "crop": CROP, "rhoMax": L.RHO_MAX,
            "terms": [[float(g[0]), float(g[1]), float(a.real), float(a.imag)] for g, a in L.TERMS],
            "angles": m["angles_deg"], "probes": PROBE_NOTES, "summary": summary}
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    # the pixel-art cast (make_sprites.py -> web/sprites.json) and the shared sprite helper, inlined
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    helper = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "script tag")
    html = html.replace("/*INKSPRITE*/", helper)
    html = html.replace("/*FRAMES*/[]", json.dumps(frames, separators=(",", ":")))
    html = html.replace("/*META*/{}", json.dumps(meta, separators=(",", ":")))
    # the shared piece-to-piece navigation (common/nav.py), just before the footer
    assert "<!--NAV-->" in html, "template.html lost its <!--NAV--> marker"
    html = html.replace("<!--NAV-->", nav_html("04-magic-angle"))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum((WEB / k).stat().st_size for k in files)
    print(f"web/index.html written: {len(frames)} frames, {len(files)} files, {total / 1e6:.2f} MB total")


if __name__ == "__main__":
    main()
