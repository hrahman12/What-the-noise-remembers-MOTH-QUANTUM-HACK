"""Section-7 checks for web/index.html: ASCII only, scripts parse, no external fetches, page logic matches the CLI.

Runs the Python CLI on the demo moth for several settings, then node web/test_logic.js must rebuild every
WIF draft byte for byte from the inlined data. Usage: python web/verify_page.py
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

WEB = Path(__file__).resolve().parent
PIECE = WEB.parent
sys.path.insert(0, str(PIECE))
from loom import cli  # noqa: E402

html_path = WEB / "index.html"
raw = html_path.read_bytes()
bad = sum(b > 127 for b in raw)
assert bad == 0, f"{bad} non-ASCII bytes in index.html"
html = raw.decode("ascii")
for tag in ("<!doctype", "<html", "<head", "<body"):
    assert tag not in html.lower(), tag
srcs = re.findall(r"<script[^>]*src=", html)
assert not srcs, "external scripts present"
script = html.split("<script>")[1].split("</script>")[0]
for pat in ("fetch(", "XMLHttpRequest", "alert(", "confirm(", "prompt(", "download", "window.print", "<iframe"):
    assert pat not in script, pat
hosts = set(re.findall(r"https?://([^/\"' )]+)", html))
allowed = {"fonts.googleapis.com", "fonts.gstatic.com", "claude.ai", "www.w3.org"}
assert hosts <= allowed, hosts - allowed
size = len(raw)
assert size < 15 * 1024 * 1024
files = json.loads((WEB / "files.json").read_text())
print(f"index.html: {size / 1024:.0f} KB, ASCII, hosts {sorted(hosts)}, files.json entries {len(files)}")

cases = []
tmp = Path(tempfile.mkdtemp(prefix="loomcheck-"))
for i, (p, prof, seed, view, cw, width) in enumerate([(5e-3, "loom", 1, "received", "plain", 32),
                                                      (1e-3, "loom", 7, "corrected", "plain", 32),
                                                      (1e-2, "loom", 3, "received", "measured", 32),
                                                      (1e-2, "thread", 42, "received", "plain", 32),
                                                      (5e-3, "thread", 9999, "corrected", "measured", 32),
                                                      (1e-2, "loom", 5, "received", "plain", 48),
                                                      (1e-3, "thread", 2, "corrected", "measured", 24)]):
    out = tmp / f"c{i}"
    rc = cli.main(["weave", str(PIECE / "demo" / "moth.png"), "--p", str(p), "--profile", prof, "--seed", str(seed),
                   "--view", view, "--codewords", cw, "--width", str(width), "--out", str(out), "--cell", "2"])
    assert rc == 0
    cases.append({"p": p, "profile": prof, "seed": seed, "view": view, "codewords": cw, "width": width,
                  "wif": str(out / "draft.wif")})
(tmp / "cases.json").write_text(json.dumps(cases))
subprocess.run(["node", str(WEB / "test_logic.js"), str(html_path), str(tmp / "cases.json")], check=True)
subprocess.run(["node", "-e", "const h=require('fs').readFileSync(process.argv[1],'utf8');"
                "for(const s of h.split('<script>').slice(1))new Function(s.split('</script>')[0]);console.log('inline scripts parse')",
                str(html_path)], check=True)
