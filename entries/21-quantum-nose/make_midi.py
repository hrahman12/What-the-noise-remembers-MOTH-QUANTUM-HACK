"""Write the input score midi/nose_input.mid from spectra.py. CLASSICAL.

SMF type 1, 480 ticks per beat, 120 bpm (960 ticks per second).
Track 0 = conductor (tempo only). Tracks 1-6 = one molecule each, normal (H) then deuterated (D):
  1 acetophenone H   2 acetophenone D   3 exaltone H   4 exaltone D   5 muscone H   6 muscone D
Each track is the molecule's vibrational "chord": its lines enter one by one from the lowest
wavenumber to the highest over the first 3 s (a strum), then all sustain until 7.0 s.
MIDI note number = spectral bin (28 cm^-1 per bin), velocity = rough IR strength class.
Two lines that land in the same bin are merged (louder velocity kept).

Qubits (computed, the engine does not report them): each track's piano roll is
  pitch rows = active bin span + 15 % margin above and below  -> 75-110 rows -> 7 qubits
  time steps = 6720 ticks / resolution 1 tick                   -> 6720 steps -> 13 qubits
so one track is exactly one 7 + 13 = 20-qubit register, the engine's maximum per pass.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import mido

from spectra import ISOTOPES, MOLECULES, ORDER, lines

HERE = Path(__file__).resolve().parent
PPQ, TEMPO = 480, 500_000
TPS = PPQ * 1_000_000 // TEMPO           # ticks per second = 960
STRUM_S, HOLD_END_S = 3.0, 7.0
TRACKS = [(m, iso) for m in ORDER for iso in ISOTOPES]


def track_notes(mol, iso):
    """[(onset_tick, off_tick, bin, velocity, label)] for one molecule/isotope."""
    merged = {}
    for d in lines(mol, iso):
        b = d["bin"]
        if b in merged:
            merged[b]["vel"] = max(merged[b]["vel"], d["vel"])
            merged[b]["label"] += " + " + d["label"]
        else:
            merged[b] = {"bin": b, "vel": d["vel"], "label": d["label"]}
    ls = [merged[b] for b in sorted(merged)]
    n = len(ls)
    off = int(HOLD_END_S * TPS)
    return [(int(round(i * STRUM_S / n * TPS)), off, d["bin"], d["vel"], d["label"]) for i, d in enumerate(ls)]


def build():
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    cond = mido.MidiTrack()
    cond.append(mido.MetaMessage("track_name", name="conductor", time=0))
    cond.append(mido.MetaMessage("set_tempo", tempo=TEMPO, time=0))
    cond.append(mido.MetaMessage("end_of_track", time=0))
    mid.tracks.append(cond)
    summary = []
    for ch, (mol, iso) in enumerate(TRACKS):
        tr = mido.MidiTrack()
        tr.append(mido.MetaMessage("track_name", name=f"{mol} {iso}", time=0))
        ev = []
        notes = track_notes(mol, iso)
        for on, off, b, v, _ in notes:
            ev.append((on, 1, mido.Message("note_on", channel=ch, note=b, velocity=v)))
            ev.append((off, 0, mido.Message("note_off", channel=ch, note=b, velocity=0)))
        ev.sort(key=lambda e: (e[0], e[1]))
        t = 0
        for tick, _, msg in ev:
            tr.append(msg.copy(time=tick - t))
            t = tick
        tr.append(mido.MetaMessage("end_of_track", time=0))
        mid.tracks.append(tr)
        bins = [b for _, _, b, _, _ in notes]
        span = max(bins) - min(bins)
        rows = span + 2 * math.ceil(0.15 * span) + 1
        steps = int(HOLD_END_S * TPS)
        summary.append({"track": ch + 1, "molecule": mol, "isotope": iso, "lines": len(notes),
                        "bins": [min(bins), max(bins)], "pitch_rows_est": rows,
                        "pitch_qubits": math.ceil(math.log2(rows)), "time_steps": steps,
                        "time_qubits": math.ceil(math.log2(steps)),
                        "qubits": math.ceil(math.log2(rows)) + math.ceil(math.log2(steps))})
    (HERE / "midi").mkdir(exist_ok=True)
    mid.save(HERE / "midi" / "nose_input.mid")
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "input_tracks.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
    for s in summary:
        print(s)
    print("midi/nose_input.mid written")


if __name__ == "__main__":
    build()
