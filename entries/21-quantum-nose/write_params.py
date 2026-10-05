"""Write PARAMS.md from out/jobs.csv, out/input_tracks.json and the downloaded MIDI files. CLASSICAL."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

from synth import read_tracks

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import CACHE  # noqa: E402

PIECE = "21-quantum-nose"


def main():
    tracks = json.loads((HERE / "out" / "input_tracks.json").read_text(encoding="utf-8"))
    rows = list(csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")))
    used = {r["job_id"] for r in rows if r["job_id"]}
    ledger = []
    for line in (CACHE / "ledger.jsonl").read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if e.get("piece") == PIECE:
            ledger.append(e)
    inp = read_tracks(HERE / "midi" / "nose_input.mid")
    L = ["# Parameters: blur-midi-v1 sweep (20 qubits per pass)", "",
         "Engine: **blur-midi-v1** (Atlas, \"Blur Jazz\"), run on Atlas's classical statevector simulator "
         "(the engine has no QPU mode). 1 credit per job.",
         "Input: `midi/nose_input.mid` (SMF type 1, 480 ticks/beat, 120 bpm), written by `make_midi.py`: "
         "track 0 = tempo, tracks 1-6 = one vibrational chord each.",
         "Fixed in every job: `qubits` = 20 (the engine maximum), `resolution` = 1 tick per piano-roll step; "
         "`threshold` 0.1, `margin` 0.15 and `mask` (none) at their defaults.", "",
         "## Qubits per track (computed, not reported by the engine)", "",
         "Quantum Blur stores a w x h grid in ceil(log2 w) + ceil(log2 h) qubits. Pitch rows = the track's "
         "bin span plus the engine's 15 % margin above and below (our estimate of its rounding); time steps = "
         "6,720 ticks at 1 tick per step. The engine's progress messages confirmed that it processes the six "
         "tracks one by one (\"Track 2/6: 'acetophenone D' (ticks_per_step=1 ...)\").", "",
         "| track | chord | lines in | MIDI bins | pitch rows (est.) | time steps | qubits |",
         "|---|---|---|---|---|---|---|"]
    for t in tracks:
        L.append(f"| {t['track']} | {t['molecule']} {t['isotope']} | {t['lines']} | {t['bins'][0]}-{t['bins'][1]} | "
                 f"{t['pitch_rows_est']} ({t['pitch_qubits']} qubits) | {t['time_steps']} ({t['time_qubits']} qubits) | "
                 f"**{t['qubits']}** |")
    L += ["", "## Jobs", "",
          "| strength | reach | qubits | resolution | job_id | status | seconds | notes out (6 tracks) |",
          "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        nout = ""
        if r["status"] == "completed":
            tr = read_tracks(HERE / r["file"])
            nout = " / ".join(str(len(tr.get(f"{t['molecule']} {t['isotope']}", []))) for t in tracks)
        L.append(f"| {r['strength']} | {r['reach']} | {r['qubits']} | {r['resolution']} | `{r['job_id'] or '-'}` | "
                 f"{r['status']} | {r['seconds']} | {nout} |")
    n_in = " / ".join(str(len(inp[f"{t['molecule']} {t['isotope']}"])) for t in tracks)
    L += ["", f"Notes in the input score, same track order: {n_in}.", ""]
    extra = [e for e in ledger if e["job_id"] not in used]
    L.append(f"Ledgered spend for `{PIECE}`: **{sum(float(e['credits']) for e in ledger):g} credits** "
             f"({len(ledger)} submissions, cap 10).")
    if extra:
        L.append("Ledgered but not used (failed or superseded): " + ", ".join(f"`{e['job_id']}`" for e in extra) + ".")
    else:
        L.append("Every ledgered submission completed and is used above.")
    (HERE / "PARAMS.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("PARAMS.md written")


if __name__ == "__main__":
    main()
