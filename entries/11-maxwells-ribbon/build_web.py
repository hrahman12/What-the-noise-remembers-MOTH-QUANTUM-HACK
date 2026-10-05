"""Assemble web/index.html: inline the brand CSS, ball.js, the shared sprite helper (common/inksprite.js), this
piece's pixel-art cast (web/sprites.json, written by make_sprites.py), the studio scene (web/scene.js), app.js and
the job data (web/data.json, written by extract.py), then make the page pure ASCII. Also writes the display
images, the hub mascot (web/img/mascot.png, via common/mascot.py) and files.json.
CLASSICAL (packaging only).
"""
import base64
import io
import json
import subprocess
import sys
from pathlib import Path

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
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set)
sys.path.insert(0, str(HERE))
from page_copy import build_meta  # noqa: E402

data = json.loads((WEB / "data.json").read_text(encoding="utf-8"))
meta = build_meta(data)
sprites = json.loads(SPRITES.read_text(encoding="utf-8"))
for name, sp in sprites.items():  # every frame the same even size, ink palette only (+ C/c: the sitter's colour)
    h, w = len(sp["frames"][0]), len(sp["frames"][0][0])
    assert w % 2 == 0 and h % 2 == 0, name
    for f in sp["frames"]:
        assert len(f) == h and all(len(r) == w and set(r) <= set(".KBLTWOGCc") for r in f), name
    assert name == "bloch" or not any(set(r) & set("Cc") for f in sp["frames"] for r in f), name

# display images
(WEB / "img").mkdir(exist_ok=True)
full = Image.open(HERE / "data" / "Tartan_Ribbon.jpg").convert("RGB")
full.resize((720, 589), Image.LANCZOS).save(WEB / "img" / "ribbon_full.webp", "WEBP", lossless=True, method=6)
crop = full.crop(tuple(meta["crop_box"])).resize((288, 288), Image.LANCZOS)
buf = io.BytesIO()
crop.save(buf, "WEBP", lossless=True, method=6)
crop_uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

# the hub mascot: Maxwell at his camera, mid-shot (scale 3: 168 x 144 px)
subprocess.run([sys.executable, str(ROOT / "common" / "mascot.py"), str(SPRITES), "mascot", str(MASCOT), "--scale", "3"],
               check=True)

html = (WEB / "template.html").read_text(encoding="utf-8")
for ph, val in (
        ("/*BRAND*/", BRAND.read_text(encoding="utf-8")),
        ("/*BALLJS*/", (WEB / "ball.js").read_text(encoding="utf-8").replace(
            "if (typeof module !== 'undefined') module.exports = BALL;", "")),
        ("/*SW*/[]", json.dumps(data["swatches"], separators=(",", ":"))),
        ("/*JOBS*/[]", json.dumps(data["jobs"], separators=(",", ":"))),
        ("/*META*/{}", json.dumps(meta, separators=(",", ":"), ensure_ascii=False)),
        ('/*RIB0*/""', json.dumps(data["rib0"], separators=(",", ":"))),
        ("/*CROP_URI*/", crop_uri),
        # the helper's header comment mentions a script tag; reword it so the inlined copy never contains one
        ("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element")),
        ("/*SPRITES*/{}", json.dumps({k: {"frames": v["frames"], "fps": v.get("fps", 6)} for k, v in sprites.items()
                                      if k != "mascot"}, separators=(",", ":"))),
        ("/*SCENEJS*/", (WEB / "scene.js").read_text(encoding="utf-8")),
        ("/*APPJS*/", (WEB / "app.js").read_text(encoding="utf-8"))):
    assert html.count(ph) == 1, ph
    html = html.replace(ph, val)
assert html.count("<!--NAV-->") == 1, "<!--NAV-->"
html = html.replace("<!--NAV-->", nav_html("11-maxwells-ribbon"))   # before to_ascii
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

files = {"img/ribbon_full.webp": "entries/11-maxwells-ribbon/web/img/ribbon_full.webp",
         "img/mascot.png": "entries/11-maxwells-ribbon/web/img/mascot.png"}
(WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
size = (WEB / "index.html").stat().st_size + sum((ROOT / p).stat().st_size for p in files.values())
print(f"web/index.html written ({len(data['jobs'])} jobs, {len(sprites)} sprites, {size / 1e6:.2f} MB with files)")
