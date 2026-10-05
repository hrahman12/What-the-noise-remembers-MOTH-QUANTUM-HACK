"""Page copy that depends on the real job data (proof chips, drawers, quiz). Imported by build_web.py.
Every number here is computed from web/data.json, out/attempts.jsonl and data/topology.json."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def pct(x):
    return f"{round(100 * x)}%"


def tessa_failures():
    out = []
    for line in (HERE / "out" / "attempts.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        a = json.loads(line)
        if a.get("engine", "tessa-image-v1") != "tessa-image-v1":
            continue
        jid = a.get("job_id") or a["error"].split()[1]
        out.append(jid)
    return out


def build_meta(data):
    jobs, topo, meta = data["jobs"], data["meta"]["topology"], dict(data["meta"])
    hw = next((j for j in jobs if j["kind"] == "hw"), None)
    aer = next((j for j in jobs if j["machine"] == "aer" and j["shots"] == 1024), None)
    tessa = tessa_failures()
    meta["machines"] = [m for m in meta["machines"] if m["kind"] != "hw" or any(j["machine"] == m["id"] for j in jobs)]

    proof = []
    if hw:
        proof.append({"b": str(topo[hw["machine"]]["qubits_used_at_capacity"]), "t": f"qubits on {hw['backend']}", "hot": True})
    proof.append({"b": str(len(jobs)), "t": "real Atlas jobs"})
    if hw:
        proof.append({"b": "1", "t": "run on a real IBM chip"})
    proof.append({"b": "3", "t": "numbers per colour"})
    meta["proof"] = proof

    if hw:
        vs = (f" On the perfect simulator they came back at full length ({pct(aer['shrink'])}; shot noise scatters "
              "them both ways)." if aer else "")
        meta["ch3_noise"] = (f"On the real {hw['backend']} chip the test colours came back with arrows only {pct(hw['shrink'])} "
                             f"as long as the ones we sent.{vs} Noise drags colours toward grey.")
    else:
        meta["ch3_noise"] = ""
    meta["ch4_honesty"] = ("Quantum: storing each number on qubits and measuring it back (qpixl-v1, on the machine named). "
                           "Classical: splitting colours into X, Y and Z and putting them back together (our own code).")
    meta["runs_cap"] = ("Miss = average distance between each test colour's arrow and the rebuilt arrow (ball radius 1; 0 is perfect). "
                        "Every cell is one real job. The real chip ran once, at 1024 shots.")
    meta["ch5_note"] = "A ribbon pixel you click is rebuilt from that exact pixel's measured numbers, not from the nearest test colour."
    by = {(j["machine"], j["shots"]): j for j in jobs}
    find = []
    aer_runs = [by[("aer", s)] for s in (16, 128, 1024) if ("aer", s) in by]
    if len(aer_runs) > 1:
        find.append("On the perfect simulator, more shots meant a smaller miss: " +
                    ", ".join(f"{j['err']:.2f} at {j['shots']}" for j in aer_runs) + " shots.")
    a16 = by.get(("aer", 16))
    if a16:
        find.append(f"At 16 shots each stored number gets only a couple of clicks, so {pct(a16['extremes'])} of them came back as "
                    "exactly 0 or 1 with nothing in between. The colours turn into random noise, and the ribbon disappears.")
    noisy = [by[(m, 1024)] for m in ("fake_fez", "fake_brisbane") if (m, 1024) in by] + ([hw] if hw else [])
    if noisy and aer:
        find.append("On the noisy machines, extra shots stop helping: even at 1024 shots the miss stays at " +
                    ", ".join(f"{j['err']:.2f}" for j in noisy) + f" (against {aer['err']:.2f} on the perfect simulator).")
    ff, ib = by.get(("fake_fez", 1024)), hw
    if ff and ib:
        find.append(f"That's because noise shrinks the arrows toward grey. At 1024 shots the Fez noise model kept "
                    f"{pct(ff['shrink'])} of their length and the real Fez chip kept {pct(ib['shrink'])}, so the model predicted "
                    "the chip quite well.")
    meta["findings"] = ("<b>What we found.</b> " + " ".join(find)) if find else ""
    meta["engine_note"] = f"tessa-image-v1 timed out {len(tessa)} times, see chapter 4"
    meta["tessa_jobs"] = tessa   # the failed Tessa job IDs, listed in "Jobs and credits"

    fz = topo["ibm_fez"]
    qline = ""
    if hw:
        qline = (f"<b>Qubits:</b> on {hw['backend']} the 448 numbers filled the chip's whole capacity: {fz['data_qubits']} data + "
                 f"{fz['address_qubits']} address = {fz['qubits_used_at_capacity']} qubits in one joint circuit (IBM job "
                 f"{hw['ibm_job_id']}, {hw['qpu_seconds']} s of QPU time). qpixl doesn't report a qubit count, so we counted it from "
                 "the chip's coupling map with the engine's documented checkerboard rule. That rule reproduces all three capacities "
                 "measured on the live engine (Fez 448, Brisbane 360, Torino 378). ")
    meta["drawer_engine"] = [
        f"<b>Planned engine: tessa-image-v1.</b> All {len(tessa)} jobs failed with <code>engine_timeout</code> "
        f"({', '.join(t[:8] for t in tessa)}): two on a 64&times;64 picture, then two on a 32&times;32 one (one size down), then "
        "one more at 16 shots after a nine-minute wait. Five failures at every size meant the engine was not answering, so we "
        "switched engines instead of guessing.",
        "<b>Engine used: qpixl-v1</b> (Interwoven QPIXL, from the same <code>iqpixl</code> library Tessa is built on). It takes a "
        "list of numbers between 0 and 1. Each data qubit stores 4 or 8 of them as rotation angles, its neighbouring address "
        "qubits pick the slot, and shots measure them back. <code>dynamic_range</code> was left at <code>none</code>, so the "
        "measured numbers are not rescaled.",
        "<b>Our classical part:</b> each colour becomes the arrow (X, Y, Z) of our colour ball. We send (c+1)/2 for each "
        "component, as three plates (all X, then all Y, then all Z), and rebuild the colour from what comes back. An arrow "
        "longer than 1 is shortened to 1.",
        qline + "The noise models run each data-qubit group (at most 4 qubits) as its own small circuit on the matching physical "
        f"qubits (Brisbane: {topo['fake_brisbane']['qubits_used_at_capacity']}-qubit layout, {topo['fake_brisbane']['data_qubits']} data "
        f"+ {topo['fake_brisbane']['address_qubits']} address). aer does the same on a lattice it sizes to the 4,096 numbers, and "
        "doesn't report its size.",
        "<b>Shots</b> are counted per data-qubit group on the simulators, and per run on the real chip. Each group shares its "
        "shots across the 4 or 8 numbers it holds.",
    ]
    meta["drawer_honest"] = [
        "Photography isn't quantum. Maxwell's filters are classical optics. The link is an analogy: three filtered "
        "measurements make one picture.",
        "A colour isn't a qubit. The colour ball is a map we chose (grey centre, white and black poles, hue around the "
        "equator) with our own formula. Tessa's built-in colour sphere uses the same landmarks but differs in detail.",
        "qpixl measured every number the same way, by counting 0s and 1s. The X, Y and Z here are the colour arrow's "
        "three coordinates, each stored and measured on its own. That's the same bookkeeping as tomography, but not "
        "three-basis tomography of one qubit. The hidden-arrow game in chapter 2 shows real tomography, played with "
        "classical random numbers.",
        "When you pick a free colour, the rebuild shown is the engine's result for the nearest of the 112 test colours, and "
        "the page says how far away that is. Ribbon pixels are rebuilt from their own measured numbers.",
        "fake_fez and fake_brisbane are classical simulations that use the noise models of real IBM chips. Only the ibm_fez "
        "run touched a quantum computer: one run at 1024 shots.",
        "No quantum advantage is claimed: a laptop could store these colours perfectly. The point is to see what measurement "
        "and noise do.",
        "Maxwell's studio at the top is a cartoon of the pipeline, not a simulation. The sitter's colour, each plate's grey "
        "(the number the run measured back), the rebuilt portrait and its arrow, and Maxwell's mood (set by the real miss) all "
        "come from the cached jobs. The flash, the flying plates, the blinking machine lights, the spinning colour top and the "
        "light rays are decoration. Maxwell never took photos of qubits; the cartoon borrows his three-filter method.",
    ]
    hs = pct(hw["shrink"]) if hw else "less"
    meta["quiz"] = [
        {"q": "Why did Maxwell need three photographs to make one colour picture?",
         "a": ["Each grey plate records only how much of one colour got through its filter.",
               "Photos in 1861 faded fast, so he took spares.", "Three angles made the picture look 3D."],
         "right": 0,
         "why": ["One plate gives one number per spot. Colour needs three numbers, so three filtered plates are needed.",
                 "The three plates weren't spares: each recorded something different, one colour's worth of light.",
                 "All three were taken from the same spot, through different filters. Colour, not depth, was the point."]},
        {"q": "You measure a qubit along Z a thousand times and get 0 half the time and 1 half the time. What do you know?",
         "a": ["The arrow points straight up.",
               "The arrow has no up-down part: it lies somewhere in the flat equator slice of the ball, from the grey centre "
               "out to the edge. You need X and Y to tell where.",
               "The qubit is broken."],
         "right": 1,
         "why": ["Straight up would give 0 every time.",
                 "Z only tells you the up-down part, which is zero here. Every arrow in the equator slice, long or short, "
                 "gives 50/50 along Z, right down to the grey centre. That's why tomography also measures X and Y.",
                 "50/50 is a perfectly healthy answer. It just means the arrow has no up-down part."]},
        {"q": "On the real IBM chip, what happened to the rebuilt colours?",
         "a": ["They came back exactly right.",
               f"They were pulled toward grey: on average the arrows kept only {hs} of their length.",
               "They all turned white."],
         "right": 1,
         "why": ["Noise and limited shots always leave some error. Check the miss numbers in chapter 4.",
                 "Noise makes every measurement more coin-like, so each number drifts to the middle and the arrow shrinks "
                 "toward the grey centre.",
                 "White is the top of the ball. Noise pulls toward the centre, which is grey."]},
    ]
    return meta
