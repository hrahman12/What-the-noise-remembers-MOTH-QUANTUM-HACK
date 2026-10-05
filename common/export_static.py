"""Export the whole set as a static website for GitHub Pages: python common/export_static.py [out_dir]

Default out_dir is ./docs (GitHub Pages can serve a repo's /docs folder). Layout:
  docs/index.html                     the hub
  docs/img/...                        hub images and mascots
  docs/pieces/<slug>/index.html       each piece, plus the files listed in its web/files.json
Every claude.ai artifact link is rewritten to a relative path, so the hub, the prev/next nav and the
"jump to any piece" lists all work with no login. Pages get a proper <!doctype html> head (the artifact
platform normally supplies one). Prints a size report and any link that would still leave the site.
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "docs"
HUB = "https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa"
urls = json.loads((ROOT / "site" / "urls.json").read_text(encoding="utf-8"))

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="What the Noise Remembers: 22 playable quantum pieces for Moth Hack 2026, built on real Moth Quantum Atlas jobs.">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#FBFAF9}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""


def wrap(html):
    if html.lstrip().lower().startswith("<!doctype"):
        return html
    return HEAD + html + "\n</body>\n</html>\n"


def rewrite(html, here):
    """here = None for the hub, or the slug of the piece page being written."""
    for slug, u in urls.items():
        target = f"pieces/{slug}/index.html" if here is None else f"../{slug}/index.html"
        html = html.replace(u, target)
    html = html.replace(HUB, "index.html" if here is None else "../../index.html")
    return html


def copy_files(src_web, dst, files_json):
    n = 0
    for pub, src in files_json.items():
        s = ROOT / src
        if not s.exists():
            s = src_web / pub
        if not s.exists():
            print(f"  ! missing {src}")
            continue
        d = dst / pub
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(s, d)
        n += 1
    return n


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / ".nojekyll").write_text("", encoding="ascii")
    total = 0
    # hub
    hub = (ROOT / "site" / "index.html").read_text(encoding="ascii")
    (OUT / "index.html").write_text(wrap(rewrite(hub, None)), encoding="ascii")
    hub_files = json.loads((ROOT / "site" / "files.json").read_text(encoding="utf-8"))
    copy_files(ROOT / "site", OUT, hub_files)
    # pieces
    for slug in sorted(urls):
        web = ROOT / "entries" / slug / "web"
        dst = OUT / "pieces" / slug
        dst.mkdir(parents=True)
        html = (web / "index.html").read_text(encoding="ascii")
        (dst / "index.html").write_text(wrap(rewrite(html, slug)), encoding="ascii")
        fj = json.loads((web / "files.json").read_text(encoding="utf-8")) if (web / "files.json").exists() else {}
        n = copy_files(web, dst, fj)
        size = sum(f.stat().st_size for f in dst.rglob("*") if f.is_file())
        total += size
        print(f"  {slug:22s} {n:4d} files  {size / 1e6:6.2f} MB")
    total += sum(f.stat().st_size for f in OUT.glob("*") if f.is_file())
    # anything still pointing at claude.ai?
    left = []
    for f in OUT.rglob("index.html"):
        for u in set(re.findall(r"https://claude\.ai/artifact/[A-Za-z0-9]+", f.read_text(encoding="ascii"))):
            left.append(f"{f.relative_to(OUT)} -> {u}")
    print(f"exported to {OUT}  total {total / 1e6:.1f} MB")
    print("links still leaving the site:", left or "none")


if __name__ == "__main__":
    main()
