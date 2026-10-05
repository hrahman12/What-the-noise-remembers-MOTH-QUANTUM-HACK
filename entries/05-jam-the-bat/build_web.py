"""Assemble web/index.html for Jam the Bat.

Inlines the shared brand CSS, the game rule (web/core.js) and the comet-qrng-v1 job outputs
(conditioned bytes as base64, certificates, Bell witness, per-qubit P(1)) from out/. Nothing is
reshaped: jitter slots are cut from the engine's bytes by the page itself (3 bits each, MSB first).
Also inlines the cast (web/sprites.json, ink pixel art) and the shared sprite helper common/inksprite.js,
and renders the hub mascot (the tiger moth) to web/img/mascot.png with common/mascot.py.
Writes ASCII-only web/index.html and web/files.json. Runs offline (reads only out/ and web/).
"""
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB = HERE / "web"
OUT = HERE / "out"
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = ROOT / "common" / "inksprite.js"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from mascot import render  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links across the set)

LABEL = {"emu_12p8": ("emu12", "Emulator 12+8", None), "emu_20p0": ("emu", "Emulator", "emulator bank"),
         "fez_148p8": ("fez", "ibm_fez", "ibm_fez bank"), "mar_148p8": ("mar", "ibm_marrakesh", "ibm_marrakesh bank")}

jobs = json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))
banks = []
for j in jobs:
    if j.get("status") != "completed":
        continue
    o = json.loads((OUT / f"{j['name']}.json").read_text(encoding="utf-8"))["output"]
    rep, prov, bw, fp = o["entropy_report"], o["provenance"], o.get("bell_witness") or {}, o["device_fingerprint"]
    sid, short, src_label = LABEL[j["name"]]
    raw = bytes.fromhex(o["random"]["hex"])
    banks.append({
        "id": sid, "job": j["name"], "short": short, "label": src_label, "job_id": j["job_id"],
        "mode": prov["mode"], "backend": prov["backend"], "provider_job_id": prov.get("provider_job_id"),
        "qpu_seconds": prov.get("qpu_seconds"), "circuit_hash": prov.get("circuit_hash"),
        "layout": prov.get("initial_layout"),
        "reg": prov["circuit"]["n_rand"], "total": prov["circuit"]["n_total"], "shots": prov["shots"],
        "raw_bits": rep["raw_bits"], "h_bit": rep["h_bit"], "budget_bits": rep["budget_bits"],
        "budget_af": rep["budget_bits_assumption_free"], "basis": rep["accounting_basis"],
        "grade": rep["grade"], "accounted": rep["entropy_accounted"], "health": rep["health_passed"],
        "ordering_penalty": o["entropy"]["ordering_penalty_bits"],
        "n_biased": o["entropy"]["health"].get("n_biased_qubits_p<1e-6"),
        "bytes": o["random"]["bytes"], "b64": base64.b64encode(raw).decode("ascii"),
        "S": bw.get("S"), "sS": bw.get("sigma_S"), "zS": bw.get("z_above_classical"),
        "caveat": bw.get("caveat"), "p1": fp["p1"], "witness_pairs": prov["circuit"].get("witness_pairs"),
        "commit": o["commitment"]["commit"], "pulse_hash": o["pulse"]["pulse_hash"],
        "statements": rep["statements"],
    })
order = {"fez": 0, "mar": 1, "emu": 2, "emu12": 3}
banks.sort(key=lambda b: order[b["id"]])

sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))   # the cast: ink pixel art, one source

html = (WEB / "template.html").read_text(encoding="utf-8")
html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
html = html.replace("/*CORE*/", (WEB / "core.js").read_text(encoding="utf-8"))
# (its header comment mentions a script tag; reword it so the page's script blocks split cleanly for checks)
html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
html = html.replace("/*BANKS*/[]", json.dumps(banks, separators=(",", ":")))
tour = json.loads((OUT / "tournament.json").read_text(encoding="utf-8"))  # from sim.js (classical)
html = html.replace("/*TOURNAMENT*/null", json.dumps({"long": tour.get("long")}, separators=(",", ":")))
html = html.replace("<!--NAV-->", nav_html("05-jam-the-bat"))
for marker in ("/*BRAND*/", "/*CORE*/", "/*INKSPRITE*/", "/*SPRITES*/", "/*BANKS*/", "/*TOURNAMENT*/", "<!--NAV-->"):
    assert marker not in html, f"unreplaced marker {marker}"
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

# mascot for the hub: the tiger moth, frame 0, rendered by common/mascot.py from the same sprites.json
(WEB / "img").mkdir(exist_ok=True)
render(sprites["moth"], 0, 4).save(WEB / "img" / "mascot.png")
(WEB / "files.json").write_text(json.dumps({"img/mascot.png": "entries/05-jam-the-bat/web/img/mascot.png"}, indent=1),
                                encoding="utf-8")
size = (WEB / "index.html").stat().st_size
print(f"web/index.html written: {size/1024:.0f} KB, banks: " +
      ", ".join(f"{b['id']} ({b['bytes']} B, S={b['S']})" for b in banks))
