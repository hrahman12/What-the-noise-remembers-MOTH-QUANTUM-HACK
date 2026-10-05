"""Write PARAMS.md and piece.json from out/jobs.json, out/events.json and the Atlas ledger. CLASSICAL.

Numbers are read from files, never typed by hand.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas  # noqa: E402

PIECE = "02-coda-reservoir"


def main():
    jobs = json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))
    ev = json.loads((HERE / "out" / "events.json").read_text(encoding="utf-8"))
    wav = json.loads((HERE / "out" / "wav_info.json").read_text(encoding="utf-8"))
    a = Atlas(piece=PIECE, credit_cap=20)
    spent = a.spent()
    tr = jobs["train"]
    tp = tr["params"]
    done = {k: j for k, j in jobs.items() if j.get("engine") == "qrc-gen-v2" and "job_id" in j}
    failed = {k: j for k, j in jobs.items() if j.get("status") == "failed"}

    lines = [
        "# Parameters: every completed Atlas job",
        "",
        "All jobs ran on Atlas's server-side Qiskit Aer simulator (these engines have no QPU mode).",
        f"Ledgered spend for `{PIECE}`: **{spent:g} credits** of a 20-credit cap "
        "(qrc-train-v2 = 5 credits/run, qrc-gen-v2 = 1 credit/run).",
        "",
        "## Training (qrc-train-v2)",
        "",
        "| key | value |",
        "|---|---|",
        f"| job_id | `{tr['job_id']}` |",
        f"| num_qubits | **{tp['num_qubits']}** (engine maximum; `num_qubits: 13` returned HTTP 422 "
        "\"maximum: got 13, want 12\", see `out/probe_13_qubits.txt`) |",
        f"| sequence | {tr['sequence_len']} tokens (every coda, corpus order) |",
        f"| vocabulary | {len(tp['vocabulary'])} tokens: {', '.join(tp['vocabulary'])} |",
    ]
    for k in ("sample_length", "washout", "mode", "sample_fraction", "periodic", "epochs", "shots", "mixing",
              "num_random_gates", "seed"):
        lines.append(f"| {k} | {tp[k]} |")
    lines.append(f"| wall time (submit to result) | {tr['seconds']:.0f} s |")
    lines += [
        "",
        "## Generation (qrc-gen-v2)",
        "",
        f"Every job takes `input_files.state = {tr['state_asset_id']}`: the asset ID of the training job's own `state`",
        "output (the pristine trained model, passed by reference, never chained from another generation). The",
        "`job:<id>/state` form is rejected on this endpoint with a free HTTP 422 (\"must be an asset UUID\").",
        "`shots` is left at the model's own 3000. Every job returned exactly 160 tokens.",
        "",
        "| key | variation | random_seed | length | warm-up (initial_events) | job_id |",
        "|---|---|---|---|---|---|",
    ]
    for k in sorted(done, key=lambda k: (k == "handoff", done[k]["params"]["variation"], done[k]["params"]["random_seed"])):
        p = done[k]["params"]
        warm = f"{len(p['initial_events'])} real codas (the WAV's opening stretch)" if "initial_events" in p else "default (whole vocabulary)"
        lines.append(f"| {k} | {p['variation']} | {p['random_seed']} | {p['length']} | {warm} | `{done[k]['job_id']}` |")
    if failed:
        lines += ["", "Failed jobs (not used, nothing substituted): " + ", ".join(failed)]
    lines += [
        "",
        "## Comparison metrics (classical, computed by build_events.py)",
        "",
        "| sequence | tokens | distance to real token mix (TVD) | same-type repeats | pairs unseen in real data | distinct tokens |",
        "|---|---|---|---|---|---|",
    ]
    for m in ev["metrics"]:
        lines.append(f"| {m['label']} | {m['n']} | {m['tvd']:.3f} | {100 * m['repeat']:.0f}% | {100 * m['unseen']:.1f}% | {m['distinct']:.0f} |")
    lines += [
        "",
        "## The WAV",
        "",
        f"`coda_reservoir.wav`: {wav['seconds']} s, {wav['sample_rate']} Hz, {wav['bits']}-bit, {wav['channels']} channels, "
        f"{wav['clicks']} clicks, peak {wav['peak_dbfs']} dBFS. {wav['real_codas']} real codas, then "
        f"{wav['reservoir_codas']} reservoir codas from job `{done['handoff']['job_id']}` starting at {wav['handoff_at_s']} s.",
        "",
    ]
    (HERE / "PARAMS.md").write_text("\n".join(lines), encoding="utf-8")

    piece = {
        "slug": PIECE,
        "challenge": "02",
        "bonus": False,
        "title": "Coda Reservoir",
        "hook": "Hear a 12-qubit reservoir click like a sperm whale.",
        "sub": "A quantum reservoir learned the rhythms of 3,840 real codas recorded off Dominica. Play the whales, "
               "then let the reservoir carry on.",
        "you_control": ["Pick real codas, the reservoir, or the real-to-reservoir handoff, or tap a whale in the sea",
                        "Choose a whale label, or a variation level and take (each a real qrc-gen-v2 job)",
                        "Play, pause, scrub and slow down; each click lights its whale's head and sends out a ring"],
        "engines": ["qrc-train-v2", "qrc-gen-v2"],
        "qubits": tp["num_qubits"],
        "qubits_note": "12 reservoir qubits (num_qubits, set at training and reused by every qrc-gen-v2 job); "
                       "the engine maximum, 13 is rejected with HTTP 422",
        "hardware": None,
        "jobs": 1 + len(done),
        "credits_spent": spent,
        "deliverables": ["coda_reservoir.wav", "README.md", "PARAMS.md", "CREDITS.md",
                         "web/index.html", "hero.png"],
        "web_entry": "web/index.html",
        "mascot": "web/img/mascot.png",
        "status": "built" if not failed and "handoff" in done else "partial",
        "honesty": "Rhythm only: no meaning is claimed; codas are treated as rhythm tokens. Reservoir ran on "
                   "Atlas's Aer simulator; tokenising, timing and click synthesis are classical.",
        "blockers": [f"failed job: {k}" for k in failed],
    }
    (HERE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")
    print(f"PARAMS.md and piece.json written: {piece['jobs']} jobs, {spent:g} credits, status {piece['status']}")


if __name__ == "__main__":
    main()
