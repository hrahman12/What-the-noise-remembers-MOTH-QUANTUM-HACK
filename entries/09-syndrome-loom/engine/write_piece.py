"""Write piece.json from the completed-job records, so the numbers match PARAMS.md and the page."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIECE = HERE.parent
sys.path.insert(0, str(PIECE.parent.parent))
from atlas.client import Atlas  # noqa: E402

cal = json.loads((PIECE / "loom" / "data" / "calibration.json").read_text(encoding="utf-8"))
jobs = json.loads((HERE / "jobs.json").read_text(encoding="utf-8"))
probes = json.loads((HERE / "probe_jobs.json").read_text(encoding="utf-8"))
completed = {j["job_id"] for j in jobs["jobs"]} | {v["job_id"] for v in probes.values() if "job_id" in v}
max_n = max([cal["grid"]["n_logical"]] + [l["n_logical"] for l in cal["ladder"]])
spent = Atlas(piece="09-syndrome-loom", credit_cap=5).spent()

piece = {
    "slug": "09-syndrome-loom",
    "challenge": "09 Quantum-native 1",
    "bonus": False,
    "title": "Syndrome Loom",
    "hook": "Weave a picture through a noisy quantum code.",
    "sub": "Each pixel is a Steane codeword of seven threads; turn up the noise and threads flip, red syndrome "
           "stitches catch them, and some pixels still come out wrong.",
    "you_control": ["Turn the noise dial (each notch replays a real tamagotchi-v1 job) and choose where the noise lives",
                    "Weave from the top or scrub the picks: Ada the weaver moth throws the shuttle and Inspector Hamming flags every row whose syndrome pick caught a flip",
                    "Click any block to have the inspector read its syndrome; switch between threads as read and after correction; load your own image",
                    "Copy the WIF 1.1 draft or a link to the view; the logical-vs-physical chart is in The data section below the loom, with a live copy beside the dial under Data"],
    "engines": ["tamagotchi-v1"],
    "qubits": 7 * max_n,
    "qubits_note": (f"{max_n} Steane logical qubits x 7 = {7 * max_n} physical data qubits in the largest completed job "
                    f"(size ladder); every calibration job used {cal['grid']['n_logical']} logical = "
                    f"{cal['grid']['physical_data_qubits']} data qubits. Counted from the code (7 per logical); "
                    "ancillas exist but are not documented, so not counted. Aer stabilizer simulator."),
    "hardware": None,
    "jobs": len(completed),
    "credits_spent": spent,
    "deliverables": ["pyproject.toml", "loom/", "tests/", "out/draft.wif", "out/render.png", "out/report.md",
                     "out/gallery.png", "loom/data/calibration.json", "engine/run_calibration.py", "web/index.html",
                     "README.md", "PARAMS.md", "CREDITS.md"],
    "web_entry": "web/index.html",
    "status": "built",
    "honesty": "Rates come from tamagotchi-v1 jobs on Atlas's Aer stabilizer simulator (no hardware); the weave samples "
               "them classically, drawing syndrome and logical flip independently and red stitches at half the "
               "engine's X+Z syndrome count (our assumption).",
    "blockers": [],
}
pend = [p for p in (PIECE.parent.parent / "cache" / "pending" / "tamagotchi-v1").glob("*.json")
        if json.loads(p.read_text())["job_id"] not in completed]
if any(json.loads(p.read_text())["job_id"] == "191803b3-afb4-4706-bfb6-0b5eea975c85" for p in pend):
    piece["blockers"].append("Ladder job n_logical=1024 (191803b3) was still processing on the shared engine at write-up; "
                             "not counted. Re-running engine/run_calibration.py resumes it.")
(PIECE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")
print(json.dumps({k: piece[k] for k in ("qubits", "jobs", "credits_spent", "blockers")}))
