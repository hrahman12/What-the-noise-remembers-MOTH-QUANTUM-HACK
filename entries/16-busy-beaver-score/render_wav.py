"""Render the raw score and blurred MIDIs to WAV. CLASSICAL synthesis (numpy).

Timing: ticks are converted to columns (120 ticks = one 16th-note column) and played at
NOTES_PER_SEC columns per second, the same clock the web page uses, so raw and blurred files line
up note for note whatever tempo meta a MIDI carries.
Voices: track "Head" (and any other track) = a plucked harp-like tone; track "Rule" = a soft bass.
A short synthetic reverb (seeded noise impulse) is added; the mix is soft-limited and normalised.

Usage: python render_wav.py            -> score_raw.wav + the two 20-qubit blurs
       python render_wav.py <midi stem>...
"""
from __future__ import annotations

import sys
import wave
from pathlib import Path

import mido
import numpy as np
from scipy.signal import fftconvolve

HERE = Path(__file__).resolve().parent
SR = 44100
COL = 120
NOTES_PER_SEC = 15


def notes_from_midi(path):
    """[(start_col, dur_cols, pitch, velocity, track_name)] from note_on/note_off pairs (ticks)."""
    mid = mido.MidiFile(path)
    out = []
    for tr in mid.tracks:
        name = next((m.name for m in tr if m.type == "track_name"), "")
        t, on = 0, {}
        for m in tr:
            t += m.time
            if m.type == "note_on" and m.velocity > 0:
                on.setdefault((m.channel, m.note), []).append((t, m.velocity))
            elif m.type in ("note_off", "note_on"):
                st = on.get((m.channel, m.note))
                if st:
                    t0, v = st.pop(0)
                    if t > t0:
                        out.append((t0 / COL, (t - t0) / COL, m.note, v, name))
    out.sort()
    return out


def hz(p):
    return 440.0 * 2 ** ((p - 69) / 12)


def pluck(p, v, dur_s):
    f = hz(p)
    tau = 0.9 * (220 / max(f, 60)) ** 0.35          # lower notes ring longer
    n = int(SR * (dur_s + 0.35 + 1.5 * tau))
    t = np.arange(n) / SR
    tone = sum((1 / k ** 1.6) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * k * 0.6 / tau)
               for k in range(1, 6) if f * k < SR / 2.2)
    env = np.minimum(1, t / 0.004) * np.exp(-t / tau)
    rel = np.clip(1 - (t - dur_s - 0.15) / 0.35, 0, 1)   # damp after the note ends
    return tone * env * rel * (v / 127) ** 1.5


def bass(p, v, dur_s):
    f = hz(p)
    n = int(SR * (dur_s + 0.3))
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.03) * np.clip(1 - (t - dur_s) / 0.25, 0, 1) * np.exp(-t * 0.35)
    return 0.55 * tone * env * (v / 127) ** 1.5


def render(notes, path):
    spc = 1 / NOTES_PER_SEC
    end = max(s + d for s, d, *_ in notes) * spc + 3
    mix = np.zeros(int(end * SR) + SR)
    for s, d, p, v, name in notes:
        y = bass(p, v, d * spc) if name == "Rule" else pluck(p, v, d * spc)
        i = int(s * spc * SR)
        mix[i:i + len(y)] += y[: len(mix) - i]
    rng = np.random.default_rng(16)
    tir = np.arange(int(1.8 * SR)) / SR
    ir = rng.standard_normal(len(tir)) * np.exp(-tir / 0.45)
    ir[0] = 0
    wet = fftconvolve(mix, ir)[: len(mix)]
    out = mix + 0.18 * wet / (np.abs(ir).sum() ** 0.5 * 8)
    out = np.tanh(out / (np.percentile(np.abs(out), 99.9) + 1e-9) * 0.9)
    out = out / (np.abs(out).max() + 1e-9) * 0.89
    pcm = (out * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {path.name}: {len(notes)} notes, {len(pcm) / SR:.1f} s")


def main():
    # default: the raw score and the two full-20-qubit blurs (strength 0.2, 1/32 grid, reach 0 and 1).
    # Any other blur: python render_wav.py blur_s0.5_r0   (all MIDIs are in out/ and play on the page)
    jobs = [(HERE / "score_raw.mid", HERE / "score_raw.wav")]
    jobs += [(m, HERE / (m.stem + ".wav")) for m in sorted((HERE / "out").glob("blur_*.mid"))]
    picks = sys.argv[1:] or ["score_raw", "blur_s0.2_r0_res60", "blur_s0.2_r1_res60"]
    jobs = [j for j in jobs if j[0].stem in picks]
    for src, dst in jobs:
        render(notes_from_midi(src), dst)


if __name__ == "__main__":
    main()
