"""Write PARAMS.md, piece.json and curves.png from the cached job outputs and the ledger.
CLASSICAL bookkeeping only. Re-run after run_qpixl.py / bundle.py / render_demos.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import Atlas  # noqa: E402

import physics  # noqa: E402

SLUG, CAP = "07-flavour", 45
B = json.loads((HERE / "plugin" / "Resources" / "flavour_curves.json").read_text(encoding="utf-8"))
MACH = B["machines"]
EAGLES = ["fake_brisbane", "fake_kyiv", "fake_sherbrooke", "fake_kyoto", "fake_osaka", "fake_quebec", "fake_cusco",
          "fake_strasbourg", "fake_brussels"]
PROBES = {"baf4dc7f-e679-4373-a80a-44c11e13c8ea": "fake_fez: 4096 values exceed capacity of 448",
          "e929ca96-9866-4123-b1bb-152b5cd42b93": "fake_torino: 4096 values exceed capacity of 378",
          "6dbeedd1-4d97-4133-ab7f-41669ea523cd": "fake_brisbane: 4096 values exceed capacity of 360"}


def qubit_note(m):
    q = m["qubits"]
    return f"{q['address']} address + 1 data = {q['rule']} (documented QPIXL rule for {m['values']} values); {q['how']}"


def ledger():
    rows = []
    led = ROOT / "cache" / "ledger.jsonl"
    for line in led.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("piece") == SLUG:
            rows.append(e)
    return rows


def main():
    a = Atlas(piece=SLUG, credit_cap=CAP)
    done = {m["job_id"] for m in MACH}
    led = ledger()
    failed = [e for e in led if e["job_id"] not in done]

    L = ["# Parameters: qpixl-v1 jobs for FLAVOUR", "",
         "Engine: **qpixl-v1** (Moth Atlas, Interwoven QPIXL), 1 credit per run.",
         "Fixed parameters on every job: `shots` = 8192, `discretize` = 0, `dynamic_range` = \"none\", "
         "`allow_high_shots` = false. Emulator jobs: `mode` = \"emu\", `machine` = the name below. Hardware job: "
         "`mode` = \"qpu\", `backend_name` = \"ibm_fez\".",
         "",
         "`values` = four curves on the same log-spaced L/E axis (20 to 50,000 km/GeV), concatenated "
         "[P2(mu->e) | P3(mu->e) | P3(mu->mu) | P3(mu->tau)], each divided by its own maximum "
         f"(maxima on the 1024-point grid: {', '.join(f'{x:.4f}' for x in physics.curves(1024)[1].max(axis=1))}). "
         "Points per curve = floor(machine capacity / 4). Curves are computed classically by `physics.py`.",
         "", "## Completed jobs (all used by the plugin, the page and the demos)", "",
         "| machine | where it ran | values | pts/curve | qubits (how counted) | backend reported | Atlas job_id | IBM job | rms e / mu / tau |",
         "|---|---|---|---|---|---|---|---|---|"]
    for m in MACH:
        ibm = ", ".join(m["ibm_job_id"]) or "-"
        L.append(f"| {m['id']} | {m['kind_label']} | {m['values']} | {m['n']} | {qubit_note(m)} | {m['backend']} | "
                 f"`{m['job_id']}` | {ibm}{' (' + str(m['qpu_seconds']) + ' s QPU)' if m['kind'] == 'qpu' else ''} | "
                 f"{m['rms'][1]:.3f} / {m['rms'][2]:.3f} / {m['rms'][3]:.3f} |")
    L += ["", "rms = root-mean-square difference between the decoded curve and the exact curve at the same points, "
          "in probability units.", "",
          "## Ledgered jobs that did not produce data", "",
          "Every submission is ledgered at 1 credit, including these. None of their outputs is used anywhere.", "",
          "| Atlas job_id | what happened |", "|---|---|"]
    for e in failed:
        why = PROBES.get(e["job_id"], "backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time")
        L.append(f"| `{e['job_id']}` | {why} |")
    L += ["", f"Ledgered credits for this piece: **{a.spent():g}** of the {CAP}-credit cap "
          f"({len(MACH)} completed jobs used, {len(failed)} ledgered without data).", ""]
    (HERE / "PARAMS.md").write_text("\n".join(L), encoding="utf-8")

    hw = next((m for m in MACH if m["kind"] == "qpu"), None)
    demos = json.loads((HERE / "out" / "demos.json").read_text(encoding="utf-8"))
    missing = [m for m in ["aer", "ibm_fez", "fake_fez", "fake_marrakesh", "fake_torino"] + EAGLES
               if m not in {x["id"] for x in MACH}]
    piece = {
        "slug": SLUG, "challenge": "07", "bonus": False, "title": "FLAVOUR",
        "hook": "Send a neutrino through the Earth. Hear which flavour arrives.",
        "sub": "A neutrino synth drawn as a scientific plate of the real objects: a reactor, a Fermilab-style beamline, "
               "a cosmic-ray shower or the Sun, a real baseline, and Super-Kamiokande lighting a sharp muon ring or a "
               "fuzzy electron ring. The muon-neutrino flavour curves went onto qubits and came back from a real IBM "
               "chip, 12 IBM noise models and a noiseless simulator; the bands, rings and notes use what came back.",
        "you_control": ["Pick a real source (reactor, accelerator beam, cosmic-ray air shower, the Sun) and its energy",
                        "Drag the neutrino along its real baseline (Daya Bay to KamLAND, T2K to DUNE, overhead to through the Earth, 1 AU)",
                        "Detect: play a photomultiplier key or click Super-K; one neutrino lights a ring and the synth plays the mix",
                        "Swap chips and slide Mix from the exact curves to the measured ones to hear each machine's noise"],
        "engines": ["qpixl-v1"],
        "qubits": 13,
        "qubits_note": "4096-value curves on aer = 2^12 addresses: 12 address + 1 data qubit by the documented QPIXL "
                       "rule (the engine splits them into data-qubit groups; shot-noise scatter suggests 256 groups of 16, our inference). Chips hold fewer values: the engine "
                       "reported data-qubit capacities of 448 (fez, marrakesh), 378 (torino) and 360 (127-qubit Eagles); "
                       "ibm_fez real hardware took 448 values. Physical qubits per circuit are not reported by the engine.",
        "hardware": hw["backend"] if hw else None,
        "jobs": len(MACH),
        "credits_spent": a.spent(),
        "deliverables": ["plugin/CMakeLists.txt", "plugin/Source/", "plugin/Resources/flavour_curves.json",
                         ".github/workflows/flavour-plugin.yml"] + [d["wav"] for d in demos] +
                        ["web/index.html", "web/sprites.json", "web/img/mascot.png", "curves.png", "README.md",
                         "PARAMS.md", "CREDITS.md"],
        "web_entry": "web/index.html",
        "mascot": "web/img/mascot.png",
        "status": "built" if not missing else "partial",
        "honesty": "Oscillation physics is computed classically (NuFIT 6.0, vacuum); qpixl-v1 only encodes and measures "
                   "the curves; fake_* are IBM noise models on a simulator; only ibm_fez is real hardware; plugin "
                   "binaries come from CI and were not built here.",
        "blockers": (["Plugin binaries (VST3/AU) are not built yet. They come from .github/workflows/flavour-plugin.yml "
                      "once this folder is pushed as a repo (lead step). CI has never run, so the full JUCE build, link, "
                      "pluginval and auval are unverified. Here the sources only type-check against JUCE 8.0.8 headers, "
                      "and the engine, compiled into a test program, matches the Python/browser engines.",
                      "The plugin editor was re-themed for the earlier gelateria page (colour constants, label strings, "
                      "one fillRect); that edit was not re-type-checked because the JUCE headers are no longer on this "
                      "machine."] +
                     ([f"missing machines: {', '.join(missing)}"] if missing else [])),
    }
    (HERE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    show = [m for m in MACH if m["id"] in ("ibm_fez", "aer", "fake_fez")]
    fig, axs = plt.subplots(len(show), 1, figsize=(11, 3.1 * len(show)), sharex=True, facecolor="#0D0F17")
    le_x = np.geomspace(B["le_min"], B["le_max"], len(B["exact"]["P"][0]))
    cols = ["#EDB95C", "#E7EAF4", "#7FD1A4"]
    for ax, m in zip(np.atleast_1d(axs), show):
        ax.set_facecolor("#0D0F17")
        lm = np.geomspace(B["le_min"], B["le_max"], m["n"])
        for f, (ci, nm) in enumerate([(1, "e"), (2, "mu"), (3, "tau")]):
            ax.semilogx(le_x, B["exact"]["P"][ci], color=cols[f], lw=1, alpha=.55)
            ax.semilogx(lm, m["P"][ci], "o", ms=2.2 if m["n"] < 400 else .9, color=cols[f], label=f"P(mu->{nm})")
        ax.set_ylim(-0.02, 1.05)
        ax.set_title(f"{m['id']}: {m['kind_label']}, {m['values']} values (lines: exact, dots: measured)",
                     color="#E7EAF4", fontsize=10, loc="left")
        ax.tick_params(colors="#959BB2")
        for s in ax.spines.values():
            s.set_color("#2B3046")
    np.atleast_1d(axs)[0].legend(loc="upper right", fontsize=8, facecolor="#161927", labelcolor="#E7EAF4", edgecolor="#2B3046")
    np.atleast_1d(axs)[-1].set_xlabel("L/E (km/GeV)", color="#959BB2")
    fig.tight_layout()
    fig.savefig(HERE / "curves.png", dpi=110, facecolor=fig.get_facecolor())
    print(f"PARAMS.md, piece.json, curves.png written; {len(MACH)} jobs, spent {a.spent():g}; missing {missing}")


if __name__ == "__main__":
    main()
