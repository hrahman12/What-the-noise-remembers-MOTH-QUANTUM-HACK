"""Assemble web/index.html: inline the shared brand CSS, the engine-measured calibration, the demo bits, the
loom cast (web/sprites.json) and the shared InkSprite helper (common/inksprite.js); export the hub mascot.

The page needs no other files: the cloth is woven and rendered live in the browser from these numbers, and the
loom scene is drawn from the inlined pixel art. web/img/mascot.png is for the hub only.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(BRAND.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from mascot import render as render_sprite  # noqa: E402
from nav import nav_html  # noqa: E402
from loom import image  # noqa: E402

cal = json.loads((HERE / "loom" / "data" / "calibration.json").read_text(encoding="utf-8"))
jobs = json.loads((HERE / "engine" / "jobs.json").read_text(encoding="utf-8"))
probes = json.loads((HERE / "engine" / "probe_jobs.json").read_text(encoding="utf-8"))
completed = {j["job_id"] for j in jobs["jobs"]} | {v["job_id"] for v in probes.values() if "job_id" in v}
cal["jobs_completed"] = len(completed)
if jobs.get("failed"):
    cal["ladder_note"] = "Not completed: " + "; ".join(f["label"] for f in jobs["failed"]) + \
        " (see PARAMS.md). Only completed jobs are shown or counted."
pending = []  # ladder jobs of this piece still running on the shared engine: shown as not counted
led = ROOT / "cache" / "ledger.jsonl"
mine = {json.loads(l)["job_id"] for l in led.read_text(encoding="utf-8").splitlines()
        if l.strip() and json.loads(l).get("piece") == "09-syndrome-loom"} if led.exists() else set()
for pf in (ROOT / "cache" / "pending" / "tamagotchi-v1").glob("*.json"):
    jid = json.loads(pf.read_text(encoding="utf-8"))["job_id"]
    if jid in mine and jid not in completed:
        pending.append(jid)
if pending:
    # the job ID itself is listed in README.md and PARAMS.md; the page shows only completed jobs' IDs
    note = ("Also submitted: n_logical = 1,024 (7,168 data qubits, 2 shots). It had not completed when this page "
            "was built, so it is not shown or counted.")
    cal["ladder_note"] = (cal.get("ladder_note", "") + " " + note).strip()
for prof in cal["profiles"].values():  # keep the page lean: per-logical arrays are not needed
    for lv in prof["levels"]:
        for k in ("se", "bare"):
            lv[k].pop("noise", None)
            lv[k].pop("simulator", None)
for lad in cal.get("ladder", []):
    lad.pop("noise", None)
    lad.pop("simulator", None)

bits = image.binarise(HERE / "demo" / "moth.png", width=32)
# the page's Width control re-weaves the moth at each width it offers, binarised by the same code as `loom weave --width`
widths = {str(w): image.binarise(HERE / "demo" / "moth.png", width=w) for w in (24, 32, 48)}
demo = {"name": "moth.png", "stem": "moth", "bits": bits, "widths": widths}

html = (WEB / "template.html").read_text(encoding="utf-8")
html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
html = html.replace("/*CAL*/{}", json.dumps(cal, separators=(",", ":")))
html = html.replace("/*DEMO*/{}", json.dumps(demo, separators=(",", ":")))
sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
# the helper's header comment mentions a script tag; spell it out so tools that split the page on tags still work
ink = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "script element")
assert "</script" not in ink.lower()
html = html.replace("/*INKSPRITE*/", ink)
assert "/*SPRITES*/" not in html and "/*INKSPRITE*/" not in html
# shared piece-to-piece navigation (prev / hub / next and the full list), just above the footer
assert "<!--NAV-->" in html
html = html.replace("<!--NAV-->", nav_html("09-syndrome-loom"))
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

# mascot for the hub: Ada the weaver moth holding her shuttle (the same pixels the page draws)
(WEB / "img").mkdir(exist_ok=True)
render_sprite(sprites["weaver_idle"], 0, 4).save(WEB / "img" / "mascot.png")
files = {"img/mascot.png": "entries/09-syndrome-loom/web/img/mascot.png"}
(WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8")
print(f"web/index.html written ({len(html) // 1024} KB, {cal['jobs_completed']} completed jobs counted)")
