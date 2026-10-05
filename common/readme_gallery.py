"""Write the README demo section: python common/readme_gallery.py <github-user> <repo> [docs_dir]

Produces DEMO_README_SECTION.md in the project root: a "Live demo" link, the hub tour GIF, and a 2-column
gallery with one clickable demo GIF per piece (each opens that piece's live page on GitHub Pages).
GIFs are referenced by repo-relative paths (docs/demos/<slug>.gif), so they show up in the README as soon
as the docs/ folder is committed.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
user, repo = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("YOUR-USERNAME", "YOUR-REPO")
docs = Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "docs"
site = f"https://{user}.github.io/{repo}/"

pieces = []
for pj in sorted((ROOT / "entries").glob("*/piece.json")):
    p = json.loads(pj.read_text(encoding="utf-8"))
    pieces.append((pj.parent.name, p.get("title", pj.parent.name), p.get("hook", "")))

lines = [
    "## Live demo",
    "",
    f"**[Open the live demo: all 22 pieces, playable in your browser]({site})**",
    "",
    f"[![Tour of What the Noise Remembers]({'docs/demos/hub.gif'})]({site})",
    "",
    "### Every piece, in motion",
    "",
    "Click any clip to play that piece live.",
    "",
    "<table>",
]
for k in range(0, len(pieces), 2):
    lines.append("<tr>")
    for slug, title, hook in pieces[k:k + 2]:
        gif = f"docs/demos/{slug}.gif"
        have = (docs / "demos" / f"{slug}.gif").exists()
        url = f"{site}pieces/{slug}/"
        img = f'<a href="{url}"><img src="{gif}" alt="{title} demo" width="100%"></a>' if have else ""
        lines.append(f'<td width="50%" valign="top">{img}<br><b><a href="{url}">{slug[:2]} · {title}</a></b><br><sub>{hook}</sub></td>')
    lines.append("</tr>")
lines += ["</table>", "",
          "Every image, sound and number in these pieces comes from real Moth Quantum Atlas jobs (simulators and IBM hardware).",
          "Independent entry to Moth Hack 2026; not an official Moth Quantum project.", ""]
out = ROOT / "DEMO_README_SECTION.md"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {out} ({len(pieces)} pieces) for {site}")
