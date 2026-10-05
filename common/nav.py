"""Shared piece-to-piece navigation for every page of "What the Noise Remembers".

In a piece's build_web.py:
    sys.path.insert(0, str(ROOT / "common")); from nav import nav_html
    html = html.replace("<!--NAV-->", nav_html("NN-slug"))
Put <!--NAV--> just before the page's .wtnr-foot footer. The snippet carries its own scoped CSS
(.wtnr-nav*), so it needs nothing from the page. Links come from site/urls.json (the published URLs)
and entries/*/piece.json (titles), so prev/next/hub stay correct for every piece.
"""
import html as _h
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUB = "https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa"

CSS = """<style>
.wtnr-nav{margin-top:2.5rem;border-top:1px solid var(--ink,#19238E);padding-top:1.1rem;display:grid;gap:1rem}
.wtnr-nav .wn-row{display:flex;flex-wrap:wrap;gap:.6rem;justify-content:space-between;align-items:center}
.wtnr-nav a.wn-btn{display:inline-flex;align-items:center;gap:.45rem;min-height:44px;padding:.6rem 1rem;border:1px solid var(--ink,#19238E);border-radius:999px;color:var(--ink,#19238E);text-decoration:none;font:500 .82rem/1.2 var(--body,system-ui,sans-serif);max-width:100%}
.wtnr-nav a.wn-btn:hover,.wtnr-nav a.wn-btn:focus-visible{background:rgba(25,35,142,.07)}
.wtnr-nav a.wn-hub{background:var(--ink,#19238E);color:var(--on-ink,#FBFAF9)}
.wtnr-nav a.wn-hub:hover{background:#121A6E}
.wtnr-nav details{border:1px solid var(--rule,#D3D3E6);background:var(--panel,#fff)}
.wtnr-nav summary{cursor:pointer;padding:.75rem 1rem;font:500 .72rem/1.2 var(--mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--ink,#19238E)}
.wtnr-nav ol{list-style:none;margin:0;padding:.25rem 1rem 1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(14rem,1fr));gap:.15rem .9rem}
.wtnr-nav ol a{display:flex;gap:.6rem;padding:.4rem 0;color:var(--ink,#19238E);text-decoration:none;font-size:.9rem;border-bottom:1px solid var(--rule,#D3D3E6)}
.wtnr-nav ol a:hover{text-decoration:underline}
.wtnr-nav ol a b{font:500 .78rem/1.6 var(--mono,monospace);min-width:1.6rem}
.wtnr-nav ol a[aria-current="page"]{font-weight:600}
.wtnr-nav ol a small{color:var(--ink-2,#545BA9);font-size:.72rem}
</style>"""


def _pieces():
    urls = json.loads((ROOT / "site" / "urls.json").read_text(encoding="utf-8"))
    out = []
    for pj in sorted((ROOT / "entries").glob("*/piece.json")):
        p = json.loads(pj.read_text(encoding="utf-8"))
        slug = pj.parent.name
        out.append({"slug": slug, "n": slug[:2], "title": p.get("title") or slug,
                    "bonus": bool(p.get("bonus")), "url": urls.get(slug, "")})
    return out


def nav_html(slug: str) -> str:
    ps = _pieces()
    i = next(k for k, p in enumerate(ps) if p["slug"] == slug)
    prev, nxt = ps[i - 1], ps[(i + 1) % len(ps)]
    e = _h.escape
    items = "".join(
        f'<li><a href="{e(p["url"] or HUB)}"{" aria-current=\"page\"" if p["slug"] == slug else ""}>'
        f'<b>{p["n"]}</b><span>{e(p["title"])}</span></a></li>'
        for p in ps)
    return (CSS + '<nav class="wtnr-nav" aria-label="All pieces">'
            '<div class="wn-row">'
            f'<a class="wn-btn" href="{e(prev["url"] or HUB)}" rel="prev">&larr; {prev["n"]} {e(prev["title"])}</a>'
            f'<a class="wn-btn wn-hub" href="{HUB}">All 22 pieces</a>'
            f'<a class="wn-btn" href="{e(nxt["url"] or HUB)}" rel="next">{nxt["n"]} {e(nxt["title"])} &rarr;</a>'
            '</div>'
            f'<details><summary>Jump to any piece ({len(ps)})</summary><ol>{items}</ol></details>'
            '</nav>')


if __name__ == "__main__":
    import sys
    print(nav_html(sys.argv[1] if len(sys.argv) > 1 else "01-penrose-hole")[:600])
