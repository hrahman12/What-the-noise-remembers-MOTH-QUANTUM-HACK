"""Assemble web/index.html: inline the shared brand CSS, the measured-curve bundle, the demo list, the
shared InkSprite helper, the plate script, the small pixel sprites and the classical electron-flavour rows.

Inputs: web/template.html, web/plate.js (the ink-engraved plate, the synth and the controls), common/brand.css, common/inksprite.js,
common/nav.py (the shared prev / hub / next links, at the <!--NAV--> marker before the footer), web/sprites.json (make_sprites.py),
plugin/Resources/flavour_curves.json (bundle.py), out/demos.json and web/audio/*.mp3 (render_demos.py),
physics.py (classical NuFIT 6.0 vacuum formulas).
Output is pure ASCII. web/img/mascot.png (common/mascot.py) is listed in files.json for the hub.

The chips only ever measured the muon-born curves. The reactor and the Sun make electron-flavoured
neutrinos, so for those two sources the page uses CLASSICAL curves computed here by physics.py and labels
them that way: the antineutrino row P(anti-nu_e -> anti-nu_x) on the same L/E grid (reactor), and the
vacuum-averaged row sum_i |U_ei|^2 |U_xi|^2 (Sun). Nothing here is a job output.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links across the set)
sys.path.insert(0, str(HERE))
import numpy as np  # noqa: E402
import physics  # noqa: E402

bundle = json.loads((HERE / "plugin" / "Resources" / "flavour_curves.json").read_text(encoding="utf-8"))
demos = json.loads((HERE / "out" / "demos.json").read_text(encoding="utf-8"))
# the page player needs the length (preload="none") and the chip-compare cue sheet (jump buttons)
page_demos = [{k: d[k] for k in ("title", "file", "text", "settings", "seconds", "cues") if k in d} for d in demos]

# classical electron-flavour rows (never measured on a chip; see the docstring)
le = physics.le_grid(len(bundle["exact"]["P"][0]))
anti = {**physics.NUFIT, "delta_deg": -physics.NUFIT["delta_deg"]}      # antineutrinos: U -> U*
erow = np.stack([physics.prob3(0, b, le, p=anti) for b in range(3)])
assert np.allclose(erow.sum(0), 1, atol=1e-9)
# CPT: P(anti-nu_e -> anti-nu_mu) = P(nu_mu -> nu_e), which is the exact curve the chips measured
assert np.allclose(erow[1], bundle["exact"]["P"][1], atol=2e-5), "CPT check failed"
a2 = np.abs(physics.pmns()) ** 2
sun = [round(float((a2[0] * a2[b]).sum()), 5) for b in range(3)]
ER = {"P": erow.round(5).tolist(), "sun": sun,
      "what": "classical (physics.py, NuFIT 6.0, vacuum); reactor row is for antineutrinos; never run on a chip"}

sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
# the helper's header comment names a script tag; keep that text out of the page so script splitting stays simple
ink = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "a script tag")

html = (WEB / "template.html").read_text(encoding="utf-8")
# the plate (scene, synth, controls) is authored in web/plate.js and inlined at the SCENE marker
assert html.count("/*SCENE*/") == 1
html = html.replace("/*SCENE*/", (WEB / "plate.js").read_text(encoding="utf-8"))
for ph in ("/*BRAND*/", "/*DATA*/{}", "/*DEMOS*/[]", "/*INKSPRITE*/", "/*SPRITES*/{}", "/*EROW*/{}"):
    assert html.count(ph) == 1, ph
html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
html = html.replace("/*INKSPRITE*/", ink)
html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
html = html.replace("/*DATA*/{}", json.dumps(bundle, separators=(",", ":")))
html = html.replace("/*DEMOS*/[]", json.dumps(page_demos))
html = html.replace("/*EROW*/{}", json.dumps(ER, separators=(",", ":")))
assert html.count("<!--NAV-->") == 1
html = html.replace("<!--NAV-->", nav_html("07-flavour"))
assert html.count('<nav class="wtnr-nav"') == 1
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

files = {d["file"]: f"entries/07-flavour/web/{d['file']}" for d in page_demos}
files["img/mascot.png"] = "entries/07-flavour/web/img/mascot.png"
for pub, rel in files.items():
    assert (ROOT / rel).exists(), rel
(WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
size = (WEB / "index.html").stat().st_size + sum((ROOT / r).stat().st_size for r in files.values())
print(f"web/index.html written ({len(bundle['machines'])} machines, {len(page_demos)} demos, {len(sprites)} sprites, "
      f"total {size / 1e6:.2f} MB)")
