"""BUILD_GUIDE section 7, checks 2-5, for this entry. CLASSICAL. Run after `python build_web.py`.
(Check 1, the MOTH_FREEZE=1 replay, is run separately: see README "Reproduce".)
"""
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB = HERE / "web"
ok = True


def check(cond, msg):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + msg)


html_b = (WEB / "index.html").read_bytes()
check(all(b < 128 for b in html_b), f"web/index.html is pure ASCII ({len(html_b):,} bytes)")
html = html_b.decode("ascii")
check(not re.search(r"<!doctype|<html|<head|<body", html, re.I), "no doctype/html/head/body tags")
check(html.lstrip().startswith("<title>"), "page starts with <title>")

# every inline script parses (same one-liner as the guide)
r = subprocess.run(["node", "-e", "const h=require('fs').readFileSync(process.argv[1],'utf8');let n=0;"
                    "for(const s of h.split('<script>').slice(1)){new Function(s.split('</script>')[0]);n++}console.log(n)",
                    str(WEB / "index.html")], capture_output=True, text=True)
check(r.returncode == 0, f"inline scripts parse ({r.stdout.strip() or r.stderr.strip()[:200]})")

# external scripts / styles only from allowed hosts, pinned
srcs = re.findall(r'<script src="([^"]+)"', html)
check(all(s.startswith(("https://cdnjs.cloudflare.com/", "https://cdn.jsdelivr.net/npm/", "https://unpkg.com/")) for s in srcs),
      f"external scripts on allowed CDNs: {srcs}")
links = re.findall(r'<link[^>]+href="([^"]+)"', html)
check(all(l.startswith(("https://fonts.googleapis.com", "https://fonts.gstatic.com")) for l in links), "stylesheets only from Google Fonts")

# no network calls, no forbidden APIs
check("XMLHttpRequest" not in html, "no XMLHttpRequest")
fetches = re.findall(r"fetch\(([^)]{0,60})", html)
check(not fetches, f"no fetch() calls ({fetches})")
urls = sorted(set(re.findall(r"https?://[^\s\"'<>)]+", html)))
allowed = ("https://cdnjs.cloudflare.com/", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://claude.ai/artifact/")
check(all(u.startswith(allowed) for u in urls), f"only allowed URLs in the page: {urls}")
for bad in ("alert(", "confirm(", "prompt(", "<iframe", "window.print", " download"):
    check(bad not in html, f"no {bad.strip()}")

# referenced relative files exist and are listed in files.json; total size
files = json.loads((WEB / "files.json").read_text(encoding="utf-8"))
refs = set(re.findall(r'(?:src|href)="((?!https?:|data:|#)[^"]+)"', html))
check(refs <= set(files), f"every referenced file is in files.json: {sorted(refs)}")
check(all((ROOT / p).exists() for p in files.values()), "every files.json source exists")
total = len(html_b) + sum((ROOT / p).stat().st_size for p in files.values())
check(total < 15e6, f"total size {total / 1e6:.2f} MB < 15 MB")

# pure logic unit tests
r = subprocess.run(["node", str(HERE / "test_logic.js")], capture_output=True, text=True, cwd=HERE)
check(r.returncode == 0, f"node test_logic.js: {r.stdout.strip() or r.stderr.strip()[:300]}")

print("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
raise SystemExit(0 if ok else 1)
