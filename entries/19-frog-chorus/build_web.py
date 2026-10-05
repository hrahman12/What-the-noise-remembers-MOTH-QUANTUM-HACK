"""Assemble web/index.html: inline the shared brand CSS, the shared sprite helper (common/inksprite.js), this
piece's pixel-art cast (web/sprites.json), the engine's pond data, the example index and the
entanglement-witness check (tests/check_witness.py), the real-hardware counterpart (out/hardware.json: graph-v1 on
IBM ibm_fez and its Aer-emulator baseline, from extract.py), every ledgered job (out/jobs.json, for the "Jobs and
credits" section) and the credit cap (run_qdrive.py), plus the shared piece-to-piece navigation (common/nav.py)
at the <!--NAV--> marker.

Reads out/pond.json (extract.py), out/wav/examples.json (render_wav.py) and web/sprites.json; writes
web/index.html as pure ASCII and web/files.json (published path -> path relative to the project root) for
every file the page uses, plus the hub mascot (web/img/mascot.png, made by common/mascot.py).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = ROOT / "common" / "inksprite.js"
SPRITES = WEB / "sprites.json"
MASCOT = WEB / "img" / "mascot.png"
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set)

ponds = json.loads((HERE / "out" / "pond.json").read_text(encoding="utf-8"))
examples = json.loads((HERE / "out" / "wav" / "examples.json").read_text(encoding="utf-8"))
witness = json.loads((HERE / "out" / "witness_check.json").read_text(encoding="utf-8"))
hardware = json.loads((HERE / "out" / "hardware.json").read_text(encoding="utf-8"))
sprites = json.loads(SPRITES.read_text(encoding="utf-8"))
jobs = [{k: j[k] for k in ("name", "engine", "job_id", "credits", "status", "n_qubits", "machine", "error")}
        for j in json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))]
cap = int(re.search(r'^CAP = (\d+)', (HERE / "run_qdrive.py").read_text(encoding="utf-8"), re.M).group(1))
for x in examples:
    x.pop("wav", None)
    assert (WEB / x["file"]).exists(), x["file"]
for name, sp in sprites.items():  # every frame the same size, even sides (pixels stay on the grid), ink palette only
    h, w = len(sp["frames"][0]), len(sp["frames"][0][0])
    assert w % 2 == 0 and h % 2 == 0, name
    for f in sp["frames"]:
        assert len(f) == h and all(len(r) == w and set(r) <= set(".KBLTWOG") for r in f), name

# the hub mascot: the frog mid-croak (frame 3: vocal sac full)
subprocess.run([sys.executable, str(ROOT / "common" / "mascot.py"), str(SPRITES), "frog", str(MASCOT),
                "--scale", "6", "--frame", "3"], check=True)

html = (WEB / "template.html").read_text(encoding="utf-8")
for ph, val in (("/*BRAND*/", BRAND.read_text(encoding="utf-8")),
                # the helper's header comment mentions a script tag; reword it so the inlined copy never contains one
                ("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element")),
                ("/*SPRITES*/{}", json.dumps({k: {"frames": v["frames"], "fps": v.get("fps", 6)} for k, v in sprites.items()},
                                             separators=(",", ":"))),
                ("/*POND*/[]", json.dumps(ponds, separators=(",", ":"))),
                ("/*EXAMPLES*/[]", json.dumps(examples, separators=(",", ":"))),
                ("/*WITNESS*/[]", json.dumps(witness, separators=(",", ":"))),
                ("/*JOBS*/[]", json.dumps(jobs, separators=(",", ":"))),
                ("/*HW*/null", json.dumps(hardware, separators=(",", ":"))),
                ("/*CAP*/0", str(cap))):
    assert html.count(ph) == 1, ph
    html = html.replace(ph, val)
assert html.count("<!--NAV-->") == 1, "<!--NAV-->"
html = html.replace("<!--NAV-->", nav_html("19-frog-chorus"))
(WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

files = {x["file"]: (WEB / x["file"]).relative_to(ROOT).as_posix() for x in examples}
files["img/mascot.png"] = MASCOT.relative_to(ROOT).as_posix()
(WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
size = (WEB / "index.html").stat().st_size + sum((WEB / k).stat().st_size for k in files)
print(f"web/index.html written: {len(ponds)} ponds, {len(examples)} examples, {len(sprites)} sprites, "
      f"hardware {'on ' + hardware['runs']['fez']['backend'] if hardware else 'none'}, total {size / 1e6:.2f} MB")
