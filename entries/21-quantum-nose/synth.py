"""MIDI -> note lists -> sine-tone audio. CLASSICAL.

Shared by render_wav.py (WAV deliverables) and build_web.py (the page's note data and loudness
gains). The page's WebAudio synth uses the same rule: every note is one pure sine at
bin * 7 Hz (bin = MIDI note number = 28 cm^-1), 15 ms attack, 60 ms release, amplitude
proportional to velocity / 127, times a per-track gain that equalises loudness (RMS) so a louder
track never gives away which one is deuterated.
"""
from __future__ import annotations

from pathlib import Path

import mido
import numpy as np

from spectra import bin_hz

ATTACK, RELEASE = 0.015, 0.06
TARGET_RMS = 0.12


def read_tracks(path: Path):
    """{track_name: [[t_on_s, t_off_s, bin, velocity], ...]} using the file's tempo map."""
    mid = mido.MidiFile(path)
    tempo = 500_000
    for msg in mid.tracks[0]:
        if msg.type == "set_tempo":
            tempo = msg.tempo
            break
    tps = mid.ticks_per_beat * 1_000_000 / tempo
    out = {}
    for tr in mid.tracks[1:]:
        name = next((m.name for m in tr if m.type == "track_name"), f"track{len(out) + 1}")
        t, active, notes = 0, {}, []
        for m in tr:
            t += m.time
            if m.type == "note_on" and m.velocity > 0:
                if m.note in active:  # retrigger: close the open note first
                    on, v = active.pop(m.note)
                    notes.append([on / tps, t / tps, m.note, v])
                active[m.note] = (t, m.velocity)
            elif m.type in ("note_off", "note_on") and m.note in active:
                on, v = active.pop(m.note)
                notes.append([on / tps, t / tps, m.note, v])
        for n, (on, v) in active.items():
            notes.append([on / tps, t / tps, n, v])
        notes.sort(key=lambda x: (x[0], x[2]))
        out[name] = [[round(a, 4), round(b, 4), int(n), int(v)] for a, b, n, v in notes]
    return out


def render(notes, sr=22050, dur=None, gain=1.0):
    """Additive sine synthesis of a note list -> float32 mono array."""
    end = max((b for _, b, _, _ in notes), default=0.0) + RELEASE + 0.05
    dur = max(dur or 0, end)
    y = np.zeros(int(dur * sr) + 1, dtype=np.float64)
    for t0, t1, n, v in notes:
        length = max(t1 - t0, 0.005)
        k0 = int(t0 * sr)
        nk = int((length + RELEASE) * sr)
        tt = np.arange(nk) / sr
        env = np.minimum(1.0, tt / ATTACK)
        rel = tt > length
        env[rel] *= np.maximum(0.0, 1 - (tt[rel] - length) / RELEASE)
        seg = (v / 127.0) * env * np.sin(2 * np.pi * bin_hz(n) * (tt + t0))
        y[k0:k0 + nk] += seg[: len(y) - k0]
    return (y * gain).astype(np.float32)


def loudness_gain(notes, sr=8000):
    """Gain that brings the track's RMS (over its sounding part) to TARGET_RMS."""
    y = render(notes, sr=sr)
    nz = np.abs(y) > 1e-6
    rms = float(np.sqrt(np.mean(y[nz] ** 2))) if nz.any() else 0.0
    return TARGET_RMS / rms if rms > 0 else 1.0
