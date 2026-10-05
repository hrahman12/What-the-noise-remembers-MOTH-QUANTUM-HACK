"""Assemble web/index.html for Antimatter Drop. CLASSICAL build step.

Inlines the shared brand CSS, the shared sprite helper (common/inksprite.js), the cast's pixel art
(web/sprites.json), the pure logic (web/core.js), Table 1 of the paper (data/alphag_table1.json) and the two
dice banks (data/bank_<job>.hex, exactly as comet-qrng-v1 returned them, with metadata from out/jobs.json),
then passes the page through common/ascii_html.to_ascii() and writes it as ASCII.

It also renders the hub mascot (the antihydrogen host, from the same sprites.json) to web/img/mascot.png with
common/mascot.py. The page itself references no other files (fonts come from Google Fonts); web/files.json lists
the mascot for the hub. Refuses to build if a bank or its job record is missing: it never invents dice.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
SLUG = HERE.name                                   # "20-antimatter-drop"
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = BRAND.parent / "inksprite.js"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from mascot import render as render_sprite  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set, common/nav.py)

jobs = {r["name"]: r for r in json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))}
banks = {}
for key, name in (("fez", "fez_148p8"), ("emu", "emu_20p0")):
    r = jobs.get(name)
    hx = HERE / "data" / f"bank_{name}.hex"
    if not r or r.get("status") != "completed" or not hx.exists():
        sys.exit(f"missing completed job/bank for {name}: run run_qrng.py first")
    h = hx.read_text(encoding="ascii").strip()
    if len(h) != 2 * r["bytes"]:
        sys.exit(f"{name}: bank length {len(h) // 2} != reported {r['bytes']} bytes")
    banks[key] = {"hex": h, "job_id": r["job_id"], "provider_job_id": r["provider_job_id"], "backend": r["backend"],
                  "version": r["engine_version"], "reg": r["register_qubits"], "total": r["total_qubits"],
                  "bytes": r["bytes"], "S": r["S"], "sigma_S": r["sigma_S"], "grade": r["grade"], "h_bit": r["h_bit"]}

fez, emu = banks["fez"], banks["emu"]
tokens = {
    "%%FEZ_BACKEND%%": fez["backend"],
    "%%FEZ_QUBITS%%": str(fez["total"]),
    "%%FEZ_REG%%": str(fez["reg"]),
    "%%FEZ_DICE%%": f"{fez['bytes'] // 2:,}",
    "%%FEZ_BYTES%%": f"{fez['bytes']:,}",
    "%%FEZ_S%%": f"{fez['S']:.3f} ± {fez['sigma_S']:.3f}",
    "%%FEZ_HBIT%%": f"{fez['h_bit']:.3f}",
    "%%FEZ_JOB%%": fez["job_id"],
    "%%FEZ_PJOB%%": fez["provider_job_id"],
    "%%FEZ_GRADE%%": fez["grade"],
    "%%ENGINE_VER%%": fez["version"],
    "%%EMU_QUBITS%%": str(emu["total"]),
    "%%EMU_BYTES%%": f"{emu['bytes']:,}",
    "%%EMU_JOB%%": emu["job_id"],
    "%%NJOBS%%": str(sum(1 for r in jobs.values() if r.get("status") == "completed")),
}

html = (WEB / "template.html").read_text(encoding="utf-8")
html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
html = html.replace("/*CORE*/", (WEB / "core.js").read_text(encoding="utf-8"))
html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8"))
sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
table = json.loads((HERE / "data" / "alphag_table1.json").read_text(encoding="utf-8"))
html = html.replace("/*TABLE*/{}", json.dumps({"rows": table["rows"]}))
html = html.replace("/*BANKS*/{}", json.dumps(banks, separators=(",", ":")))
for k, v in tokens.items():
    html = html.replace(k, v)
if html.count("<!--NAV-->") != 1:
    sys.exit("template.html needs exactly one <!--NAV--> marker, just before the .wtnr-foot footer")
html = html.replace("<!--NAV-->", nav_html(SLUG))     # before to_ascii, like every other page of the set
left = [t for t in ("/*BRAND*/", "/*CORE*/", "/*INKSPRITE*/", "/*SPRITES*/", "/*TABLE*/", "/*BANKS*/", "%%", "<!--NAV-->") if t in html]
if left:
    sys.exit(f"unreplaced placeholders: {left}")
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii", newline="\n")
mascot = render_sprite(sprites["mascot"], 0, 6)          # the hub mascot: an antihydrogen atom, 168 x 168 px
(WEB / "img").mkdir(exist_ok=True)
mascot.save(WEB / "img" / "mascot.png")
files = {"img/mascot.png": "entries/20-antimatter-drop/web/img/mascot.png"}
(WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8", newline="\n")
size = (WEB / "index.html").stat().st_size
print(f"web/index.html written: {size / 1024:.0f} KB, fez bank {fez['bytes']:,} B ({fez['backend']}), "
      f"emu bank {emu['bytes']:,} B")
