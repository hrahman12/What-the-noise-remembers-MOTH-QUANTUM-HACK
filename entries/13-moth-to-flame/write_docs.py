"""Write PARAMS.md and piece.json from the real job records (out/jobs.csv, web/levels.json, web/compare.json) and
the local credit ledger. No network: Atlas.spent() only reads cache/ledger.jsonl.  Run after build_web.py."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas  # noqa: E402
from run_levels import ALL as SPEC, CAP, PIECE  # noqa: E402


def where(lv):
    return f"IBM {lv['backend']}" if lv["mode"] == "qpu" else "Aer emulator"


def main():
    levels = json.loads((HERE / "web" / "levels.json").read_text(encoding="utf-8"))
    comps = json.loads((HERE / "web" / "compare.json").read_text(encoding="utf-8")) if (HERE / "web" / "compare.json").exists() else []
    rows = list(csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")))
    spent = Atlas(piece=PIECE, credit_cap=CAP).spent()
    led = [json.loads(x) for x in (HERE.parent.parent / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    mine = [e for e in led if e.get("piece") == PIECE]

    def row(lv, role):
        return (f"| {role} | {lv['id']} {lv['name']} | {lv['rows']}×{lv['cols']} | {lv['qubits']} | {lv['mode']} | {lv['backend']} | "
                f"`{lv['job']}` | {('`' + lv['ibmJob'] + '`') if lv['ibmJob'] else '–'} | {lv['planStreets']} / {lv['nEdges']} | "
                f"{lv['match']}/{lv['nEdges']} | {lv['szMeas']:.4f} | {lv['szSamp']:.4f} | {lv['szTomo']:.4f} | {lv['distinct']} |")

    out = ["# Parameters and jobs", "",
           "Every completed `labyrinth-v1` job used by the page. One job = one level, and every level ran on **IBM ibm_fez** "
           "(`mode=\"qpu\"`, `backend_name=\"ibm_fez\"`, the default in `run_levels.py`). Two earlier runs of the same towns on other "
           "backends are kept only as labelled **comparison runs** (Figure 4 on the page): they are not levels and are never flown. "
           "Common parameters: `shots=4096, steps=3, fraction=1/3, k=3, top_n=-1` (engine defaults except `top_n`, which keeps every "
           "distinct bitstring so ⟨ZZ⟩ can be computed from the complete counts).", "",
           "| Role | Run | Grid | Qubits | Mode | Backend (engine-reported) | Atlas job_id | IBM job | Planned streets / edges | Measured hedges match plan | mean(sign·⟨ZZ⟩) measured | engine sz_samp | engine sz_tomo (classical estimate, not used) | Distinct shots |",
           "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    out += [row(lv, "level") for lv in levels]
    out += [row(c, f"comparison (same town as {c['of']})") for c in comps]
    out += ["", "Qubit counts are the engine's reported `num_qubits` (one qubit per town square, rows × cols). On ibm_fez the limit is "
            "the chip: Night Town uses all 156 qubits. Lamp Lane (20) and Hedge Row (120) keep the sizes of their comparison runs, "
            "so each pair is the same street plan edge for edge: the emulator's documented ceiling is 20 qubits, and ibm_miami "
            "(Nighthawk) has 120.", ""]
    if comps:
        out += ["Edges where a comparison run and its ibm_fez level disagree on hedge vs street: "
                + "; ".join(f"{c['id']} vs {c['of']}: {c['diff']} of {c['nEdges']}" for c in comps) + ".", ""]
    out += ["Street-plan seeds (`town.py`, `extra=0.3`): " + ", ".join(f"{lv['id']} seed {SPEC[lv['id']]['seed']}" for lv in levels) + ".", "",
            "## Every ledgered submission for this piece", "",
            "| Atlas job_id | Credits | Status |", "|---|---|---|"]
    role_of = {r["job_id"]: (r.get("role") or "level", r["level"], r["backend"]) for r in rows if r["status"] == "completed"}
    for e in mine:
        r = role_of.get(e["job_id"])
        st = f"completed, used as {'level ' + r[1] if r[0] == 'level' else 'comparison run ' + r[1]} ({r[2]})" if r else "not completed / not used"
        out.append(f"| `{e['job_id']}` | {e['credits']:g} | {st} |")
    out += ["", f"Ledgered spend: **{spent:g} of {CAP} credits** (15 for the first three jobs, then 10 for the ibm_fez re-runs of "
            "Lamp Lane and Hedge Row; the cap was raised by a 12-credit allowance for that pass)."]
    failed = [r for r in rows if r["status"] != "completed"]
    if failed:
        out += ["", "Runs that did not complete: " + ", ".join(f"{r['level']} ({r['mode']}, {r['qubits']} qubits)" for r in failed)]
    (HERE / "PARAMS.md").write_text("\n".join(out) + "\n", encoding="utf-8")

    hw = [lv for lv in levels if lv["mode"] == "qpu"]
    hwq = max((lv["qubits"] for lv in hw), default=None)
    maxq = max(lv["qubits"] for lv in levels)
    piece = {
        "slug": PIECE,
        "challenge": "05",
        "bonus": True,
        "title": "Moth to Flame",
        "hook": "Fly a moth home before the lamps catch it.",
        "sub": "Every hedge in this night town was read from the shots of a quantum circuit, and one real shot decides which "
               "lamps are lit. The moth's own light reflex will try to keep it circling.",
        "you_control": ["Steer and flap against the lamp pull", "Pick a shot to re-light the town",
                        "Let go and watch the reflex trap the moth",
                        "Compare the planned streets with the measured hedges, or flip to the Data view"],
        "engines": ["labyrinth-v1"],
        "qubits": maxq,
        "qubits_note": "; ".join(f"{lv['id']} {lv['name']}: {lv['rows']}x{lv['cols']} = {lv['qubits']} qubits ({where(lv)}), "
                                 "engine-reported num_qubits" for lv in levels)
                       + "".join(f"; comparison run (not a level) {c['name']}: {c['qubits']} qubits ({where(c)}"
                                 + (", its 20-qubit ceiling" if c["mode"] == "emu" else "") + ")" for c in comps),
        "hardware": max(hw, key=lambda lv: lv["qubits"])["backend"] if hw else None,
        "hardware_all": sorted({lv["backend"] for lv in hw}),
        "hardware_qubits": hwq,
        "comparison_runs": [{"of": c["of"], "name": c["name"], "mode": c["mode"], "backend": c["backend"], "qubits": c["qubits"],
                             "job": c["job"], "ibm_job": c["ibmJob"]} for c in comps],
        "jobs": len(levels) + len(comps),
        "jobs_note": f"{len(levels)} levels, all on IBM ibm_fez, plus {len(comps)} labelled comparison runs of the same towns "
                     f"({', '.join(where(c) for c in comps)})",
        "credits_spent": spent,
        "deliverables": ["web/index.html", "web/template.html", "web/sim.js", "web/levels.json", "web/compare.json", "web/sprites.json",
                         "web/img/mascot.png", "build_web.py",
                         "run_levels.py", "town.py", "write_docs.py", "test_sim.js", "out/levels.png", "out/compare.png", "out/jobs.csv"]
                        + [f"out/{lv['id']}.json" for lv in levels] + [f"out/{c['id']}.json" for c in comps]
                        + ["README.md", "PARAMS.md", "CREDITS.md"],
        "web_entry": "web/index.html",
        "mascot": "web/img/mascot.png",
        "status": "built",
        "honesty": "The flight model is a classical, simplified 2D steering rule inspired by Fabian et al. 2024; "
                   "labyrinth-v1 only supplies hedges (signs of <ZZ> measured from the shots) and lit lamps (measured bits); "
                   "all three levels ran on IBM ibm_fez; an earlier noiseless emulator run and an ibm_miami run of the same towns "
                   "are shown only as labelled comparisons; no quantum advantage is claimed.",
        "blockers": [],
    }
    extra = json.loads((HERE / "piece_extra.json").read_text(encoding="utf-8")) if (HERE / "piece_extra.json").exists() else {}
    piece.update(extra)
    (HERE / "piece.json").write_text(json.dumps(piece, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PARAMS.md + piece.json written: {len(levels)} levels + {len(comps)} comparison runs, max {maxq} qubits, "
          f"hardware {piece['hardware']} ({hwq} qubits), spent {spent:g}")


if __name__ == "__main__":
    main()
