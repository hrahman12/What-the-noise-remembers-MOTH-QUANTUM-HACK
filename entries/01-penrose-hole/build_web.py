"""Assemble web/index.html: inline the shared brand CSS, the sprite helper + cast, and the job tables.

Engine images. blur-v1 only touches pixels inside the mask: outside the hole every downloaded output is
bit-identical to intact.png (checked below for all 30 jobs). So the page ships intact.webp once plus a
lossless 541 x 541 crop of each job around its hole, and draws crop-over-intact. The reconstruction is
asserted to be pixel-exact against the downloaded PNG, so what the page shows IS the engine output.

Nibble metric (classical, measured here from the real images): inside the hole disk, the share of pixels
whose colour moved by more than 10 % of full scale in any channel ("changed"), and the mean of the largest
per-channel change ("shift"). The Nibbler sprite's belly and crumb pile are driven by these numbers.

The page works from file://, a local server, or as a published artifact.
"""
import csv
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
COMMON = ROOT / "common"
sys.path.insert(0, str(COMMON))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / next / hub links for the whole set)

R = 270                      # hole radius used by every job (mask.py, run_positions.py)
BOX = 2 * R + 1              # 541 px crop: every changed pixel lies within +-270 of the centre
INTACT = np.asarray(Image.open(HERE / "intact.png").convert("RGB"))
YY, XX = np.mgrid[0:1024, 0:1024]


def crop_and_measure(src, cx, cy, out_rel):
    """Write a lossless crop of the job image around (cx, cy), verify crop-over-intact == job image, measure."""
    full = np.asarray(Image.open(src).convert("RGB"))
    x0, y0 = cx - R, cy - R
    crop = full[y0:y0 + BOX, x0:x0 + BOX]
    Image.fromarray(crop).save(WEB / out_rel, "WEBP", lossless=True, method=6)
    back = np.asarray(Image.open(WEB / out_rel).convert("RGB"))
    recon = INTACT.copy()
    recon[y0:y0 + BOX, x0:x0 + BOX] = back
    assert np.array_equal(recon, full), f"crop-over-intact differs from the engine output for {src}"
    d = np.abs(full.astype(int) - INTACT.astype(int)).max(axis=2)
    inside = (XX - cx) ** 2 + (YY - cy) ** 2 <= R * R
    return {"crop": [x0, y0, BOX, BOX], "changed": round(float((d[inside] > 25).mean()), 3),
            "shift": round(float(d[inside].mean() / 255), 3)}


# 12-job sweep at the original hole (mask.png: centre (580, 440))
sweep = []
for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")):
    if r["status"] != "completed":
        continue
    fn = "img/sweep_" + r["file"].replace("blur_", "").replace(".png", ".webp")
    m = crop_and_measure(HERE / "out" / r["file"], 580, 440, fn)
    sweep.append({"strength": float(r["strength"]), "style": r["style"], "reach": float(r["reach"]),
                  "job_id": r["job_id"], "file": fn, **m})
# a record of the measured sweep (not used by the page, which gets the same data inlined), kept outside web/
(HERE / "out" / "sweep.json").write_text(json.dumps(sweep, indent=1), encoding="utf-8")
(WEB / "sweep.json").unlink(missing_ok=True)

# 18 jobs: 9 hole positions x 2 settings (run_positions.py saves the downloaded PNGs in out/positions/; only the
# lossless crops made here go into web/img/, so web/ holds nothing the page does not use)
pos = []
for p in json.loads((WEB / "positions.json").read_text(encoding="utf-8")):
    fn = "img/" + Path(p["file"]).with_suffix(".webp").name
    m = crop_and_measure(HERE / p["file"], p["x"], p["y"], fn)
    pos.append({**p, "file": fn, **m})

Image.open(HERE / "intact.png").save(WEB / "img" / "intact.webp", "WEBP", lossless=True, method=6)

# mascot for the hub: the Mender, frame 0, from the same sprites.json the page uses
subprocess.run([sys.executable, str(COMMON / "mascot.py"), str(WEB / "sprites.json"), "mender",
                str(WEB / "img" / "mascot.png"), "--scale", "4"], check=True)

sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
html = (WEB / "template.html").read_text(encoding="utf-8")
html = html.replace("/*BRAND*/", (COMMON / "brand.css").read_text(encoding="utf-8"))
inksprite = (COMMON / "inksprite.js").read_text(encoding="utf-8")
# drop the helper's header comment (it mentions a literal script tag); keep the code itself verbatim
inksprite = "/* InkSprite: common/inksprite.js */\n" + re.sub(r"^\s*/\*.*?\*/\s*", "", inksprite, count=1, flags=re.S)
html = html.replace("/*INKSPRITE*/", inksprite)
html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
html = html.replace("/*POSITIONS*/[]", json.dumps(pos, separators=(",", ":")))
html = html.replace("/*SWEEP*/[]", json.dumps(sweep, separators=(",", ":")))
assert "<!--NAV-->" in html, "template.html needs the <!--NAV--> marker before the footer"
html = html.replace("<!--NAV-->", nav_html("01-penrose-hole"))
assert "/*" + "INKSPRITE*/" not in html and "/*SPRITES*/" not in html
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

files = {"img/intact.webp": "entries/01-penrose-hole/web/img/intact.webp",
         "img/mascot.png": "entries/01-penrose-hole/web/img/mascot.png"}
for j in pos + sweep:
    files[j["file"]] = "entries/01-penrose-hole/web/" + j["file"]
(WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
total = (WEB / "index.html").stat().st_size + sum((ROOT / v).stat().st_size for v in files.values())
print(f"web/index.html written ({len(pos)} position jobs, {len(sweep)} sweep jobs, all crops pixel-exact); "
      f"{len(files)} files, {total / 1e6:.2f} MB total")
