"""Section-7 checks for the built page and the metric (BUILD_GUIDE.md). Run after build_web.py."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from lib import bern_fid, fid, fid_null  # noqa: E402

ok = True


def check(cond, msg):
    global ok
    print(("PASS " if cond else "FAIL ") + msg)
    ok &= bool(cond)


# metric unit tests
check(abs(fid([1, 2, 3], [2, 4, 6]) - 1) < 1e-12, "F(p, p) = 1 (scale-free)")
check(fid([1, 0, 0, 0], [0, 1, 0, 0]) == 0, "F of disjoint supports = 0")
check(abs(bern_fid(0.5, 0.5) - 1) < 1e-12 and abs(bern_fid(1, 0)) < 1e-12, "Bernoulli fidelity endpoints")
rng = np.random.default_rng(0)
p = (rng.random(144) < 0.5).astype(float)
check(fid_null(p, p) < 0.75 and fid(p, p) == 1, "chance baseline of a random half-filled pattern sits well below 1")

# page checks
html = (HERE / "web" / "index.html").read_bytes()
check(all(b < 128 for b in html), "web/index.html is pure ASCII")
r = subprocess.run(["node", "-e", "const h=require('fs').readFileSync('web/index.html','utf8');let n=0;"
                    "for(const s of h.split('<script>').slice(1)){new Function(s.split('</script>')[0]);n++}console.log(n)"],
                   cwd=HERE, capture_output=True, text=True)
check(r.returncode == 0, f"every inline script parses ({r.stdout.strip()} script blocks)")
text = html.decode("ascii")
check(not re.search(r"<!doctype|<html[\s>]|<head[\s>]|<body[\s>]", text, re.I), "no doctype/html/head/body tags")
check(text.lstrip().startswith("<title>"), "page starts with <title>")
check("fetch(" not in text and "XMLHttpRequest" not in text, "no fetch/XMLHttpRequest")
hosts = set(re.findall(r"https?://([a-zA-Z0-9.-]+)", text))
allowed = {"fonts.googleapis.com", "fonts.gstatic.com", "claude.ai", "www.w3.org", "example.test"}
check(hosts <= allowed, f"only allowed hosts referenced: {sorted(hosts)}")
check(not re.search(r"<script\s+src", text), "no external scripts")
check(not re.search(r"\balert\(|\bconfirm\(|\bprompt\(|<iframe|window\.print|\sdownload[\s=>]", text), "no alert/confirm/prompt/iframe/print/download")
files = json.loads((HERE / "web" / "files.json").read_text(encoding="utf-8"))
refs = set(re.findall(r"(?:media|audio|video)/[A-Za-z0-9_.-]+\.(?:webp|wav|mp3|mp4)", text))
check(refs <= set(files), f"every referenced media file is in files.json ({len(refs)} referenced, {len(files)} listed)")
missing = [v for v in files.values() if not (ROOT / v).exists()]
check(not missing, f"every files.json entry exists on disk {missing[:3]}")
total = len(html) + sum((ROOT / v).stat().st_size for v in files.values())
big = [k for k, v in files.items() if (ROOT / v).stat().st_size > 15e6]
check(total < 15e6 and not big, f"total published size {total / 1e6:.2f} MB (< 15 MB, no file over 15 MB)")
check("prefers-reduced-motion" in text, "respects prefers-reduced-motion (brand CSS)")
check(not re.search(r"<(?:video|audio)[^>]*\sautoplay", text, re.I), "no autoplay on audio/video elements")
check(re.search(r"<video[^>]*\scontrols[^>]*\splaysinline[^>]*preload=\"metadata\"", text) is not None, "film is a <video controls playsinline preload=metadata>")
check("wtnr-foot" in text and "Not an official Moth Quantum page." in text, "footer disclaimer present")
check(":focus-visible" in text, "visible focus style present")
print("ALL PASS" if ok else "SOME CHECKS FAILED")
sys.exit(0 if ok else 1)
