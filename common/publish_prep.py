"""For each slug: check web/files.json entries exist, sum sizes, find external URLs in index.html, print title + files map."""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
for slug in sys.argv[1:]:
    d = ROOT / "entries" / slug
    web = d / "web"
    idx = web / "index.html"
    fm = json.loads((web / "files.json").read_text(encoding="utf-8")) if (web / "files.json").exists() else {}
    fm = {k: v for k, v in fm.items() if k not in ("index.html",)}
    missing = [v for v in fm.values() if not (ROOT / v).exists()]
    size = idx.stat().st_size + sum((ROOT / v).stat().st_size for v in fm.values() if (ROOT / v).exists())
    html = idx.read_text(encoding="ascii")
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    ext = sorted(set(re.findall(r"https?://[^\s\"'<>)]+", html)))
    ext = [u for u in ext if not u.startswith(("https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://claude.ai/artifact/"))]
    refs = set(re.findall(r"""(?:src|href)\s*=\s*["']([^"'#:]+?\.(?:webp|png|jpg|mp3|m4a|ogg|wav|mp4|webm|json|js|glb|bin|wif|txt|css))["']""", html))
    refs |= set(re.findall(r"""["'`]((?:img|audio|video|data|media|assets|frames|banks|lut|glsl)/[^"'`]+?)["'`]""", html))
    unlisted = sorted(r for r in refs if r not in fm and not r.startswith(("http", "data:")) and "${" not in r)
    print(json.dumps({"slug": slug, "title": title.group(1) if title else None, "bytes": size, "n_files": len(fm),
                      "missing": missing, "external_urls": ext[:15], "maybe_unlisted_refs": unlisted[:15],
                      "index_kb": idx.stat().st_size // 1024}))
    (ROOT / "cache" / "publish").mkdir(parents=True, exist_ok=True)
    (ROOT / "cache" / "publish" / f"{slug}.files.json").write_text(json.dumps(fm), encoding="utf-8")
