"""Write PARAMS.md and piece.json from out/jobs.json (record_jobs.py), out/pond.json, out/hardware.json and the job records."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import Atlas  # noqa: E402

import pond  # noqa: E402
import run_graph_fez as G  # noqa: E402
from run_qdrive import CAP  # noqa: E402

jobs = json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))
ponds = json.loads((HERE / "out" / "pond.json").read_text(encoding="utf-8"))
examples = json.loads((HERE / "out" / "wav" / "examples.json").read_text(encoding="utf-8"))
hw = json.loads((HERE / "out" / "hardware.json").read_text(encoding="utf-8"))
spent = Atlas(piece="19-frog-chorus", credit_cap=CAP).spent()


def qasm_qubits(name):
    rec = json.loads((HERE / "out" / f"qdrive_{name}.json").read_text(encoding="utf-8"))
    m = re.search(r"qubit\[(\d+)\]", rec["result"]["circuit"])
    return int(m.group(1)), len(next(iter(rec["result"]["measured"])))


used = [d["name"] for d in ponds]
fez = hw["runs"]["fez"] if hw else None
lines = ["# Parameters: every Atlas job of Frog Chorus", "",
         "Engines: **qdrive-api-v1** (Atlas, 1 credit per run) builds the chorus data. Every completed qdrive job ran on "
         "`machine = \"aer\"`, Atlas's Aer simulator (a noiseless classical simulation of the circuit; expectation values "
         "are 1,024-shot estimates). qdrive accepted no other machine: asked for `ibm_fez` three times (the last on "
         "5 October 2026, the full 22-qubit build) it failed with \"not wired up yet\" (see the failed rows).",
         "",
         "**graph-v1** (Atlas, 5 credits per run) gives the pond its real-hardware counterpart: "
         + (f"`mode = \"qpu\"`, `backend_name = \"ibm_fez\"`, {fez['n']} qubits (graph-v1's ceiling), and the engine reports "
            f"`backend: \"{fez['backend']}\"` (IBM job `{fez['ibm_job_id']}`). Its twin with identical parameters on graph-v1's "
            "Aer emulator is the deliberate noiseless baseline." if fez else "not run."),
         "",
         f"Ledgered spend: **{spent:g} credits** of the {CAP}-credit cap ({len(jobs)} ledgered jobs; the cap is the 10 credits "
         "spent on the first build plus a 12-credit allowance for the ibm_fez redo).", "",
         "## Completed jobs (qdrive-api-v1, Atlas Aer simulator)", "",
         "| name | used for | qubits (how known) | lock asked | targets / updates / layers | shots, tomography, sample | seed | job_id |",
         "|---|---|---|---|---|---|---|---|"]
for j in jobs:
    if j["status"] != "completed" or j["engine"] != "qdrive-api-v1":
        continue
    rec = json.loads((HERE / "out" / f"qdrive_{j['name']}.json").read_text(encoding="utf-8"))
    p = rec["params"]
    nq, plen = qasm_qubits(j["name"])
    tg = p["targets"]
    upd = sum(t is None for t in tg)
    if j["name"] == "probe3":
        use, lock, lay = "format probe (not in the page)", "XX=YY=-1 on (0,1), +1 on (1,2)", "4 / 1 / -"
    else:
        sign = -1 if j["name"].startswith("alt") else 1
        use = ("the page, WAVs" if j["name"] in [x["dataset"] for x in examples] else "the page") + f" ({'alternating' if sign < 0 else 'sync'} pond)"
        lock = f"<XX>=<YY>={sign * pond.LOCK:+.1f} on {len(p['coupling_map'])} edges"
        lay = f"{len(tg)} / {upd} / {len(pond.layers(pond.edges(p['n_qubits'])))}"
    lines.append(f"| {j['name']} | {use} | **{nq}** (QASM `qubit[{nq}]`, {plen}-qubit Pauli keys) | {lock} | {lay} | "
                 f"{p['shots']}, {p['tomography']}, {p['sample']} | {p['seed']} | `{j['job_id']}` |")
if hw:
    lines += ["", "## Real hardware: graph-v1 on IBM ibm_fez (and its emulator baseline)", "",
              "| name | used for | qubits (how known) | backend (reported by the engine) | operations | shots | job_id | IBM job | pairs taking turns per night (of 27) |",
              "|---|---|---|---|---|---|---|---|---|"]
    for key, use in (("fez", "the page: the 20 ibm_fez nights, both hardware charts"), ("emu", "the page: noiseless baseline")):
        r = hw["runs"].get(key)
        if not r:
            continue
        lines.append(f"| {r['name']} | {use} | **{r['n']}** (`num_qubits` echoed by the engine, {r['n']}-character bitstrings) | "
                     f"`{r['backend']}` ({'IBM hardware' if r['mode'] == 'qpu' else 'Aer emulator'}) | "
                     f"{r['n']} Bloch X = 1, then ZZ = {r['zz_target']} (fraction {r['fraction']}) on {len(hw['edges'])} edges | "
                     f"{r['shots']} (every shot returned) | `{r['job_id']}` | {('`' + r['ibm_job_id'] + '`') if r.get('ibm_job_id') else '-'} | "
                     f"{r['turns_mean']:.2f} +/- {r['turns_se']:.2f} |")
lines += ["", "## Failed jobs (ledgered, 1 credit each)", "", "| name | engine | qubits | machine | job_id | Atlas error |", "|---|---|---|---|---|---|"]
for j in jobs:
    if j["status"] == "completed":
        continue
    lines.append(f"| {j['name']} | {j['engine']} | {j['n_qubits']} | {j['machine']} | `{j['job_id']}` | {j['status']}: {j['error'].replace('|', '/')} |")
lines += ["", "Two earlier submissions of `alt20_ibm_fez` that referenced the circuit as `job:<id>/circuit` were rejected "
          "with HTTP 422 (\"must be an asset UUID\") before any job existed. They were not ledgered and cost nothing.", "",
          "## Fixed choices (classical, `pond.py`)", "",
          f"* Pads: 22 (default) or {pond.N}, one qubit each (24 was tried and timed out), around an oval bank. Hearing graph: the bank ring, "
          "inlet chords (k, k+2) for k = 1, 5, 9, ... and two chords across the water (4, n-4) and (6, n-6). "
          "Max degree 3; edges split into 3 layers of disjoint pairs by greedy edge colouring.",
          "* Requested phases: golden angle, phi_k = k * 137.508 deg, as single-qubit targets <X> = cos phi, <Y> = sin phi.",
          f"* Lock request per edge: <XX> = <YY> = s * {pond.LOCK} (s = -1 alternating, +1 sync), so <XX>+<YY> = s * {2 * pond.LOCK:.1f}.",
          "* Target list: all single-qubit targets, then for each layer an `update()` (null entry) followed by that layer's pair targets.",
          "", "## Fixed choices for the ibm_fez counterpart (classical, `run_graph_fez.py`)", "",
          f"* The 20-pad pond (graph-v1's ceiling is 20 qubits), the same {len(pond.edges(20))} hearing edges as `coupling_map`.",
          "* Every qubit first gets a Bloch target X = 1 (|+>): on its own, a frog is equally likely to be heard calling (1) or silent (0).",
          f"* Every hearing edge then gets a relationship target ZZ = {G.TURNS} (the same 0.7 the qdrive build asks of XX and of YY, with the "
          f"'take turns' sign), rotation fraction (2/pi) asin(0.7) = {G.FRACTION}, in breadth-first build order from pad 0 "
          "(chosen with a classical re-implementation of QuantumGraph's rules, a design aid that is never shown as engine output).",
          f"* shots = {G.SHOTS}: graph-v1 returns only its top 20 bitstrings, so 20 shots is the most for which the list holds every shot.",
          "* graph-v1 measures only in Z, so this run hears who calls, not the XX + YY phase locks. Its nights only seat frogs on the page.",
          "", "## Results used by the instrument", "",
          "| pond | qubits | job_id | mean <XX>+<YY> (all edges) | last layer | edges with abs > 1 | mean Bloch r | distinct shots |",
          "|---|---|---|---|---|---|---|---|"]
for d in ponds:
    s = d["stats"]
    lines.append(f"| {d['name']} | {d['n']} | `{d['job_id']}` | {s['L_mean']:+.3f} | {s['L_last_layer_mean']:+.3f} | "
                 f"{s['witness_edges']} | {s['r_mean']:.3f} | {s['distinct_nights']} |")
witness = json.loads((HERE / "out" / "witness_check.json").read_text(encoding="utf-8"))
lines += ["", "Entanglement-witness check (`tests/check_witness.py`, classical): for unentangled pairs |<XX>+<YY>| <= 1. "
          "Edges whose engine estimate exceeds 1, with an exact qiskit replay of the engine's own returned circuit:", "",
          "| pond | edge | layer | engine estimate (1,024 shots) | shot-noise widths past 1 | exact replay |", "|---|---|---|---|---|---|"]
for w in witness:
    lines.append(f"| {w['pond']} | {w['edge'][0]}-{w['edge'][1]} | {w['layer'] + 1} | {w['engine_estimate']:+.3f} | "
                 f"{w['sigma_beyond_1']} | {w['exact_replay']:+.3f} |")
if hw:
    emu = hw["runs"].get("emu")
    lines += ["", "Real-hardware counterpart (graph-v1, 20 qubits, 20 shots each). Pairs taking turns = hearing pairs with one frog "
              f"calling and the other silent in a shot, of {len(hw['edges'])}. Classical references: coin flips {hw['random_turns']}, "
              f"best any night can do {hw['max_turns']} (brute-force maximum cut; each of the five inlet triangles leaves a pair out of turn).", "",
              "| run | backend | job_id | mean +/- s.e. | lowest / highest night | mean P(calling) |", "|---|---|---|---|---|---|"]
    for r in (hw["runs"]["fez"], emu):
        if r:
            lines.append(f"| {r['name']} | `{r['backend']}` | `{r['job_id']}` | {r['turns_mean']:.2f} +/- {r['turns_se']:.2f} | "
                         f"{min(r['turns'])} / {max(r['turns'])} | {sum(r['p_call']) / len(r['p_call']):.2f} |")
    if emu and hw.get("tomo_diff"):
        td = hw["tomo_diff"]
        lines += ["", f"graph-v1 rebuilds the circuit for every job: the noiseless tomography it reports for the two jobs differs by more than 0.05 "
                  f"on {len(td['edges_any'])} of {len(hw['edges'])} edges (ZZ itself on {', '.join(f'{a}-{b}' for a, b in td['edges_zz'])}) and on qubits "
                  f"{', '.join(map(str, td['qubits']))}, so the baseline is the same recipe, not a guaranteed copy of the hardware circuit. "
                  "That reported tomography also disagrees with the engine's own noiseless shots, so the page compares shots with shots."]
lines += ["", "## WAV examples (classical renders of the chorus model with the engine data)", "",
          "| file | pond data | couplings | K ramp | tempo, individuality | final in-step R / taking turns |", "|---|---|---|---|---|---|"]
for x in examples:
    lines.append(f"| `{x['wav']}` | {x['dataset']} (`{x['job_id']}`) | {x['source']} | 0 to {x['kmax']} rad/s | "
                 f"{x['f0']} calls/s, +/-{round(x['spread'] * 100)} % | {x['log'][-1][2]:.2f} / {x['log'][-1][3]:.2f} |")
(HERE / "PARAMS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

hw_ids = [r["job_id"] for r in hw["runs"].values()] if hw else []
completed_used = [j for j in jobs if j["status"] == "completed" and (j["name"] in used or j["job_id"] in hw_ids)]
maxq = max(d["n"] for d in ponds)
piece = {
    "slug": "19-frog-chorus", "challenge": "07", "bonus": True, "title": "Frog Chorus",
    "hook": "Seat the frogs, then hear them learn to take turns.",
    "sub": f"We asked a {maxq}-qubit circuit to make every pair of neighbours on this pond alternate. "
           "The locks it actually delivered now decide who answers whom.",
    "you_control": ["Seat, lift or drag pixel frogs between lily pads and the log, or roll a night measured from the engine's state",
                    "Seat a night measured on IBM's real ibm_fez chip (graph-v1, 20 qubits), from a button or by tapping its row in the hardware chart",
                    "Start and stop the chorus; set coupling, tempo, individuality and volume",
                    "Switch between the alternating and sync ponds, and between engine-delivered and asked-for couplings",
                    "Watch each frog's throat puff on its real calls, in the live pond and in the four rendered chorus lines",
                    "Copy a link that reopens the exact chorus"],
    "engines": ["qdrive-api-v1"] + (["graph-v1"] if hw else []), "qubits": maxq,
    "qubits_note": (f"{maxq} qubits per pond build on Atlas's Aer simulator (n_qubits; confirmed by the returned QASM `qubit[{maxq}]` and "
                    f"{maxq}-character Pauli keys). 24-qubit builds timed out twice (engine_timeout, after about 5 min 45 s each), "
                    "so 24 is above what qdrive completes for this recipe; 22 completed. qdrive documents no qubit ceiling."
                    + (f" On IBM hardware: {fez['n']} qubits on ibm_fez through graph-v1 (its documented ceiling, num_qubits 2-20; "
                       f"{fez['n']}-character bitstrings returned)." if hw else "")),
    "hardware": fez["backend"] if hw else None, "hardware_qubits": fez["n"] if hw else 0,
    "hardware_jobs": [{"engine": "graph-v1", "job_id": fez["job_id"], "ibm_job_id": fez["ibm_job_id"], "backend": fez["backend"],
                       "qubits": fez["n"], "shots": fez["shots"]}] if hw else [],
    "jobs": len(completed_used), "credits_spent": spent,
    "deliverables": ["web/index.html", "web/template.html", "build_web.py", "web/files.json", "web/sprites.json", "web/img/mascot.png"] + [x["wav"] for x in examples] + ["web/" + x["file"] for x in examples] + ["README.md", "PARAMS.md", "CREDITS.md",
                     "run_qdrive.py", "run_graph_fez.py", "out/hardware.json", "pond.py", "extract.py", "chorus.py", "render_wav.py", "record_jobs.py", "make_docs.py",
                     "tests/test_core.js", "tests/browser_check.js", "tests/check_witness.py", "tests/check_pauli_order.py",
                     "tests/design_graph_order.py",
                     "qa/e2e.cjs"],
    "web_entry": "web/index.html", "mascot": "web/img/mascot.png", "status": "built",
    "honesty": ("Frogs are classical oscillators; a classical Kuramoto model runs the chorus in the browser. qdrive-api-v1 "
                "results from Atlas's Aer simulator (qdrive cannot reach hardware) set the couplings, starting phases and the default nights. "
                + (f"The one hardware run, graph-v1 on IBM ibm_fez ({fez['n']} qubits, job {fez['job_id']}), is a labelled counterpart: "
                   "its 20 Z-basis nights only seat frogs, set against the same recipe on the Aer emulator." if hw else "")),
    "blockers": ["qdrive-api-v1 cannot run on IBM hardware: it accepts only machine 'aer' ('ibm_fez' failed as 'not wired up yet' three times, "
                 "the last a 22-qubit build on 5 Oct 2026; 'fake_fez' unknown), so the chorus couplings stay on the Aer simulator."
                 + (" The hardware counterpart is graph-v1 on ibm_fez at 20 qubits, its ceiling, and it measures only in Z." if hw else ""),
                 "24-qubit builds timed out twice (engine_timeout); the largest completed pond is "
                 f"{maxq} qubits.",
                 "No VST/AU plugin built (optional in the brief); the instrument is the browser page plus WAV renders."],
}
(HERE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")
print(f"PARAMS.md and piece.json written: {len(completed_used)} completed jobs used, {spent:g} credits, max {maxq} qubits")
