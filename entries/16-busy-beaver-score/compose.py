"""Turn the busy beaver's run into a piano roll and a MIDI file. CLASSICAL.

Reads out/run.json (from simulate.py). Writes:
  score_raw.mid      SMF type 1, 480 ticks/quarter, one column = one 16th note (120 ticks)
                     track 1 "Head": where the head is; track 2 "Rule": which branch of the rule is running
  out/score.json     every column's exact machine step, phrase and head cell, plus the pitch mapping
  out/roll_raw.png   the raw piano roll, for checking

How 47,176,870 steps become 4,574 sixteenth notes (time compression):
  1. Phrases. The run splits exactly into 15 phrases, one per application of the machine's
     Collatz-like rule g(x) -> g(x'), plus the halting coda (verified in simulate.py).
  2. Phrase length grows geometrically: phrase k gets round(15 * 1.41^k) notes, so the first phrase
     plays every one of its 15 steps and the 14th gets 1,306 notes for its 30.2 million steps.
  3. Inside a phrase:
     - if it has no more steps than notes, every step is a note;
     - else if it has at least 2 notes per sweep, every sweep gets its turnaround first, then
       cells evenly spaced along it (the head audibly walks);
     - else sweeps are sampled evenly, in (rightward, leftward) pairs, and each sampled sweep gives
       2 notes: its turnaround and its midpoint. That keeps the widening zigzag audible as a rolling
       low-centre-high-centre figure instead of aliasing into noise.
     The coda (two 12,288-cell sweeps and the halt) is spaced evenly in steps.
Pitch: the cells the head visits in a phrase are mapped, left = low, onto a D minor pentatonic range
that widens with the tape (6 notes for phrase 1, 21 notes = four octaves, A2-A6, by the end).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import mido
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PPQ, COL = 480, 120                  # one column = one 16th note
NOTES_PER_SEC = 15                   # default playback rate: 15 columns/s = 225 bpm in quarters
SCALE = [0, 3, 5, 7, 10]             # D minor pentatonic
LOW_D = 38                           # degree 0 = D2
CENTER = 13                          # degree 13 = A4: the centre of every phrase's range
CODA_COLS, CHORD_COLS = 96, 24
BASS = {0: 38, 1: 34, 2: 38}         # rule branch x mod 3 -> D2, Bb1, D2 (halting branch)


def deg2midi(d: int) -> int:
    return LOW_D + 12 * (d // 5) + SCALE[d % 5]


def pos_at(events, s):
    """Head cell at step s, from the turnaround list (linear between turnarounds)."""
    i = np.searchsorted(events[:, 0], s, side="right") - 1
    s0, p0 = events[i]
    if i + 1 < len(events):
        s1, p1 = events[i + 1]
        return int(p0 + np.sign(p1 - p0) * (s - s0))
    return int(p0)


def main():
    run = json.loads((HERE / "out" / "run.json").read_text(encoding="utf-8"))
    revs = np.array(run["reversals"], dtype=np.int64)
    bounds = run["bounds"] + [run["steps"]]
    xs = run["xs"]
    nph = len(run["bounds"])            # 15: 14 growing phrases + the halting coda
    # turnaround list with the final halt appended (head moves R from -12243 to -12242 on the last step)
    ev_all = np.vstack([revs, [[run["steps"], run["halt_cell"]]]])

    lengths = [round(15 * 1.41 ** k) for k in range(nph - 1)] + [CODA_COLS]
    widths, cols, phrases = [], [], []
    for k in range(nph):
        b0, b1 = bounds[k], bounds[k + 1]
        inner = ev_all[(ev_all[:, 0] > b0) & (ev_all[:, 0] < b1)]
        ev = np.vstack([[[b0, pos_at(ev_all, b0)]], inner, [[b1, pos_at(ev_all, b1)]]])
        L, nsteps, nseg = lengths[k], b1 - b0, len(ev) - 1
        if k == nph - 1 or L >= nsteps:
            mode = "steps"
            steps = [b0 + (c * nsteps) // L for c in range(L)]
        elif L >= 2 * nseg:
            # every sweep gets n_i >= 2 notes: its turnaround, then cells evenly spaced along it
            mode = "sweeps"
            steps = []
            for i in range(nseg):
                n_i = (i + 1) * L // nseg - i * L // nseg
                for j in range(n_i):
                    steps.append(int(ev[i, 0] + round(j / n_i * (ev[i + 1, 0] - ev[i, 0]))))
        else:
            # sample evenly spaced pairs of consecutive sweeps (one rightward, one leftward) and give
            # each sweep 2 notes: its turnaround and its midpoint -> low, centre, high, centre, ...
            mode = "sampled sweeps"
            npair, want = nseg // 2, -(-L // 4)
            steps = []
            for j in range(want):
                m = round(j * (npair - 1) / max(1, want - 1))
                for i in (2 * m, 2 * m + 1):
                    s0, s1 = int(ev[i, 0]), int(ev[i + 1, 0])
                    steps += [s0, s0 + (s1 - s0) // 2]
            steps = steps[:L]
            assert all(b >= a for a, b in zip(steps, steps[1:]))
        cells = [pos_at(ev_all, s) for s in steps]
        lo, hi = int(ev[:, 1].min()), int(ev[:, 1].max())
        phrases.append({"k": k, "x": xs[k], "branch": xs[k] % 3, "start_step": b0, "end_step": b1,
                        "steps": nsteps, "sweeps": nseg, "cols": L, "mode": mode, "lo": lo, "hi": hi})
        widths.append(hi - lo + 1)
        for s, p in zip(steps, cells):
            cols.append({"k": k, "step": s, "cell": p})

    # pitch range per phrase: 6 degrees for the first phrase, 21 by the last growing phrase
    w0, w13 = widths[0], widths[nph - 2]
    for ph, w in zip(phrases, widths):
        n = 6 + 15 * math.log(w / w0) / math.log(w13 / w0)
        n = int(min(21, max(2, min(w, round(n)))))
        ph["degrees"] = n
        ph["deg_lo"] = CENTER - (n - 1) // 2

    def degree(ph, cell):
        f = (cell - ph["lo"]) / max(1, ph["hi"] - ph["lo"])
        return ph["deg_lo"] + int(round(f * (ph["degrees"] - 1)))

    # ---- notes (in columns) ----
    head, bass = [], []
    col, i_in = 0, 0
    prev_k = -1
    for c in cols:
        ph = phrases[c["k"]]
        d = degree(ph, c["cell"])
        c["deg"] = d
        i_in = 0 if c["k"] != prev_k else i_in + 1
        vel = 112 if i_in == 0 else (96 if i_in % 2 == 0 else 80)   # accent phrase starts; turnarounds > midpoints
        head.append([col, 1, deg2midi(d), vel])
        prev_k = c["k"]
        col += 1
    # final chord: the halted tape. Every degree's share of the tape holds ones (it is the period-3
    # pattern 1 0 0 repeated), so every degree of the coda's range sounds, softly.
    coda = phrases[-1]
    for d in range(coda["deg_lo"], coda["deg_lo"] + coda["degrees"]):
        head.append([col, CHORD_COLS, deg2midi(d), 52])
    for _ in range(CHORD_COLS):
        cols.append({"k": nph - 1, "step": run["steps"], "cell": run["halt_cell"], "deg": -1, "halted": True})
    total = col + CHORD_COLS
    # bass: the rule branch (x mod 3) of the phrase, re-struck every 8 columns
    start = 0
    for ph in phrases:
        root = BASS[ph["branch"]]
        for j in range(0, ph["cols"], 8):
            dur = min(8, ph["cols"] - j)
            bass.append([start + j, dur, root, 92 if j == 0 else 70])
        ph["col0"] = start
        start += ph["cols"]
    bass.append([start, CHORD_COLS, 38, 80])
    bass.append([start, CHORD_COLS, 45, 64])

    # ---- MIDI ----
    mid = mido.MidiFile(type=1, ticks_per_beat=PPQ)
    meta = mido.MidiTrack()
    bpm = NOTES_PER_SEC * 60 / 4
    meta += [mido.MetaMessage("track_name", name="Busy Beaver Score", time=0),
             mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0),
             mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0),
             mido.MetaMessage("end_of_track", time=total * COL)]
    mid.tracks.append(meta)
    for name, ch, prog, notes in (("Head", 0, 46, head), ("Rule", 1, 32, bass)):
        tr = mido.MidiTrack()
        tr += [mido.MetaMessage("track_name", name=name, time=0),
               mido.Message("program_change", channel=ch, program=prog, time=0)]
        evs = []
        for c0, dur, p, v in notes:
            evs.append((c0 * COL + dur * COL, 0, p, 0))      # note-offs sort before note-ons
            evs.append((c0 * COL, 1, p, v))
        evs.sort()
        t = 0
        for tick, on, p, v in evs:
            tr.append(mido.Message("note_on" if on else "note_off", channel=ch, note=p,
                                   velocity=v if on else 0, time=tick - t))
            t = tick
        tr.append(mido.MetaMessage("end_of_track", time=0))
        mid.tracks.append(tr)
    mid.save(HERE / "score_raw.mid")

    # ---- columns + mapping for the page and the WAV renderer ----
    score = {"total_cols": total, "col_ticks": COL, "ppq": PPQ, "notes_per_sec": NOTES_PER_SEC,
             "scale": SCALE, "low_d": LOW_D, "phrases": phrases,
             "col_step": [c["step"] for c in cols], "col_phrase": [c["k"] for c in cols],
             "col_cell": [c["cell"] for c in cols], "machine": run["machine"], "steps": run["steps"],
             "ones": run["ones"], "tape_width": run["tape_width"], "extent": run["extent"],
             "bounds": run["bounds"], "xs": xs, "phrase_heads": run["phrase_heads"]}
    (HERE / "out" / "score.json").write_text(json.dumps(score), encoding="utf-8")

    # ---- check image: the raw piano roll ----
    pitches = [n[2] for n in head + bass]
    pmin, pmax = min(pitches) - 2, max(pitches) + 2
    H = (pmax - pmin + 1) * 4
    img = np.full((H, total), 13, np.uint8)
    for c0, dur, p, v in head + bass:
        y = (pmax - p) * 4
        img[y:y + 3, c0:c0 + dur] = 90 + v
    Image.fromarray(img).save(HERE / "out" / "roll_raw.png")
    print(f"{total} columns ({total / NOTES_PER_SEC / 60:.1f} min at {NOTES_PER_SEC} notes/s), "
          f"{len(head)} head notes, {len(bass)} rule notes, pitch {min(pitches)}..{max(pitches)}")
    for ph in phrases:
        print(f"  phrase {ph['k'] + 1:2d} g({ph['x']}) branch {ph['branch']}: {ph['steps']:>10,} steps "
              f"{ph['sweeps']:>5} sweeps -> {ph['cols']:>5} notes ({ph['mode']}), "
              f"cells {ph['lo']}..{ph['hi']}, {ph['degrees']} degrees")


if __name__ == "__main__":
    main()
