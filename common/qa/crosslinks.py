"""Cross-link checker for the whole set: python common/qa/crosslinks.py

Maps every published artifact URL (site/urls.json + the hub) to its local built page and checks that:
- the hub links to every piece, and every hub link points at a known piece;
- every piece links back to the hub (brand bar and/or nav) and its prev/next nav links point at known pieces;
- every relative src/href in every page exists in that page's web/ folder and is listed in web/files.json;
- every piece.json title/qubits/jobs/mascot is present and the mascot file exists.
Prints a report and exits 1 if anything is broken.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HUB = "https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa"
urls = json.loads((ROOT / "site" / "urls.json").read_text(encoding="utf-8"))
by_url = {u: s for s, u in urls.items()}
problems, notes = [], []


def links(html):
    return re.findall(r"""(?<![\w-])(?:href|src)\s*=\s*["']([^"']+)["']""", html)


def check_relatives(name, web, html):
    fm = {}
    if (web / "files.json").exists():
        fm = json.loads((web / "files.json").read_text(encoding="utf-8"))
    for l in links(html):
        if l.startswith(("http", "data:", "#", "mailto:", "blob:", "javascript:")) or "${" in l or "{" in l:
            continue
        rel = l.split("#")[0].split("?")[0]
        if not rel:
            continue
        if not (web / rel).exists():
            problems.append(f"{name}: missing file {rel}")
        elif fm and rel not in fm and rel != "index.html":
            problems.append(f"{name}: {rel} exists but is not in web/files.json (would not be published)")


# hub
hub_html = (ROOT / "site" / "index.html").read_text(encoding="ascii", errors="replace")
hub_targets = set(re.findall(r"https://claude\.ai/artifact/[A-Za-z0-9]+", hub_html))
for s, u in urls.items():
    if u not in hub_targets:
        problems.append(f"hub: no link to {s} ({u})")
for u in hub_targets:
    if u != HUB and u not in by_url:
        problems.append(f"hub: links to unknown artifact {u}")

# pieces
for s, u in sorted(urls.items()):
    d = ROOT / "entries" / s
    web = d / "web"
    idx = web / "index.html"
    if not idx.exists():
        problems.append(f"{s}: web/index.html missing")
        continue
    html = idx.read_text(encoding="ascii", errors="replace")
    if any(ord(c) > 127 for c in html):
        problems.append(f"{s}: index.html is not ASCII")
    if HUB not in html:
        problems.append(f"{s}: no link back to the hub")
    nav = re.search(r'<nav class="wtnr-nav".*?</nav>', html, re.S)
    if not nav:
        problems.append(f"{s}: shared piece nav (<!--NAV--> from common/nav.py) not present")
    else:
        for t in re.findall(r"https://claude\.ai/artifact/[A-Za-z0-9]+", nav.group(0)):
            if t != HUB and t not in by_url:
                problems.append(f"{s}: nav links to unknown artifact {t}")
    for t in set(re.findall(r"https://claude\.ai/artifact/[A-Za-z0-9]+", html)):
        if t != HUB and t not in by_url:
            problems.append(f"{s}: links to unknown artifact {t}")
    if "wtnr-foot" not in html:
        problems.append(f"{s}: footer disclaimer missing")
    check_relatives(s, web, html)
    pj = d / "piece.json"
    if not pj.exists():
        problems.append(f"{s}: piece.json missing")
        continue
    p = json.loads(pj.read_text(encoding="utf-8"))
    for k in ("title", "hook", "qubits", "jobs", "engines", "honesty"):
        if not p.get(k) and p.get(k) != 0:
            problems.append(f"{s}: piece.json missing {k}")
    m = d / (p.get("mascot") or "web/img/mascot.png")
    if not m.exists():
        problems.append(f"{s}: mascot missing ({m.relative_to(ROOT)})")
    t = re.search(r"<title>(.*?)</title>", html)
    notes.append(f"{s}: title={t.group(1) if t else '?'} | piece.json title={p.get('title')}")

print("\n".join(notes))
print(f"\n{len(problems)} problem(s)")
print("\n".join(problems))
sys.exit(1 if problems else 0)
