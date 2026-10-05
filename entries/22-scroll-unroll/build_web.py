"""Assemble web/index.html: inline the shared brand CSS, the shared pixel-sprite helper (common/inksprite.js) and
this piece's sprites (web/sprites.json, the one place the pixels live), the scroll geometry and the job ladder;
convert the scan, the clean ink and every blur-v1 output to lossless greyscale WebP; export the hub mascot
(the archaeologist moth, frame 0) to web/img/mascot.png with common/mascot.py.

blur-v1 returns RGB with three identical channels (checked below), so saving one channel is lossless.
Writes web/files.json (published path -> path from the project root) for the lead's publish step.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402


def webp(src, dst):
    im = Image.open(src)
    a = np.asarray(im)
    if a.ndim == 3:
        assert (a[..., 0] == a[..., 1]).all() and (a[..., 0] == a[..., 2]).all(), f"{src}: channels differ"
        im = Image.fromarray(a[..., 0])
    im.convert("L").save(dst, "WEBP", lossless=True, method=6)
    back = np.asarray(Image.open(dst).convert("L"))
    assert (back == np.asarray(im.convert("L"))).all(), f"{dst}: not lossless"


def main():
    (WEB / "img").mkdir(parents=True, exist_ok=True)
    info = json.loads((HERE / "scroll.json").read_text(encoding="utf-8"))
    metrics = json.loads((HERE / "out" / "metrics.json").read_text(encoding="utf-8"))
    files = {}
    for src, name in [(HERE / "scroll_base.png", "img/base.webp"), (HERE / "ink_clean.png", "img/ink_clean.webp")]:
        webp(src, WEB / name)
        files[name] = f"entries/{HERE.name}/web/{name}"
    jobs = []
    for m in sorted(metrics["jobs"], key=lambda m: m["off_ink"]):     # the damage ladder
        name = "img/" + m["file"].replace(".png", ".webp")
        webp(HERE / "out" / m["file"], WEB / name)
        files[name] = f"entries/{HERE.name}/web/{name}"
        jobs.append({"img": name, "job_id": m["job_id"], "strength": m["strength"], "reach": m["reach"],
                     "r_line": m["r_line"], "off_ink": m["off_ink"]})
    # mascot for the hub: the archaeologist moth, frame 0, from the same sprites.json the page uses
    subprocess.run([sys.executable, str(ROOT / "common" / "mascot.py"), str(WEB / "sprites.json"), "archaeologist",
                    str(WEB / "img" / "mascot.png"), "--scale", "4"], check=True)
    files["img/mascot.png"] = f"entries/{HERE.name}/web/img/mascot.png"
    scroll = {k: info[k] for k in ("geometry", "L", "H", "text", "translation", "text_s", "text_turns", "ink_gain")}
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    for marker in ("/*INKSPRITE*/", "/*SPRITES*/{}", "/*SCROLL*/{}", "/*JOBS*/[]"):
        assert html.count(marker) == 1, marker
    html = html.replace("/*INKSPRITE*/", (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*SCROLL*/{}", json.dumps(scroll, ensure_ascii=False))
    html = html.replace("/*JOBS*/[]", json.dumps(jobs))
    assert html.count("<!--NAV-->") == 1, "<!--NAV-->"
    html = html.replace("<!--NAV-->", nav_html("22-scroll-unroll"))   # shared prev / hub / next links (common/nav.py)
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum((ROOT / p).stat().st_size for p in files.values())
    print(f"web/index.html written ({len(jobs)} jobs, {len(files)} media files, {total / 1e6:.2f} MB in all)")


if __name__ == "__main__":
    main()
