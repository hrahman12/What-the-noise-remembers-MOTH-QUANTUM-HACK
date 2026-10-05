"""Assemble site/index.html: brand CSS + every entries/*/piece.json + published URLs (site/urls.json), ASCII-only."""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402

# qubits that actually ran on an IBM chip, read from each piece's own qubits_note (None = not reported by the engine)
HW_QUBITS = {"05-jam-the-bat": 156, "06-tweezer": 156, "07-flavour": None, "08-pbit-or-qubit": 20,
             "11-maxwells-ribbon": 156, "13-moth-to-flame": 156, "20-antimatter-drop": 156}
urls = json.loads((HERE / "urls.json").read_text(encoding="utf-8")) if (HERE / "urls.json").exists() else {}
pieces = []
MASC = HERE / "img" / "mascots"
MASC.mkdir(parents=True, exist_ok=True)
for pj in sorted((ROOT / "entries").glob("*/piece.json")):
    p = json.loads(pj.read_text(encoding="utf-8"))
    slug = pj.parent.name
    ch = str(p.get("challenge") or slug[:2])
    ch = "".join(c for c in ch if c.isdigit())[:2].zfill(2)
    pieces.append({
        "slug": slug, "challenge": ch, "title": p.get("title"),
        "hook": p.get("hook"), "sub": p.get("sub"), "you_control": p.get("you_control") or [],
        "engines": p.get("engines") or [], "qubits": p.get("qubits"), "qubits_note": p.get("qubits_note"),
        "hardware": p.get("hardware") or "", "jobs": p.get("jobs"), "honesty": p.get("honesty"),
        "url": urls.get(slug, ""),
        "hw_qubits": p.get("hardware_qubits", HW_QUBITS.get(slug)),
        "mascot": "",
    })
    m = pj.parent / (p.get("mascot") or "web/img/mascot.png")
    if m.exists():
        shutil.copyfile(m, MASC / f"{slug}.png")
        pieces[-1]["mascot"] = f"img/mascots/{slug}.png"

html = (HERE / "template.html").read_text(encoding="utf-8")
html = html.replace("/*BRAND*/", (ROOT / "common" / "brand.css").read_text(encoding="utf-8"))
html = html.replace("/*PIECES*/[]", json.dumps(pieces))
(HERE / "index.html").write_text(to_ascii(html), encoding="ascii")
(HERE / "files.json").write_text(json.dumps({p["mascot"]: "site/" + p["mascot"] for p in pieces if p["mascot"]} | {"img/intact.webp": "site/img/intact.webp", "img/erased.webp": "site/img/erased.webp"}, indent=1), encoding="utf-8")
print(f"site/index.html written with {len(pieces)} pieces, {sum(1 for p in pieces if p['url'])} with URLs")
