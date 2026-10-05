"""Render every MIDI (2 chirps + the blurred sweep) to a stereo WAV. CLASSICAL (numpy synth).

The voice matches the web page's Web Audio synth: triangle + soft octave partial, low-pass, ADSR,
velocity -> gain, H1 (Hanford) panned left and L1 (Livingston) right, one feedback echo.
Notes shorter than 40 ms (blur-midi-v1 emits some 2-6 ms "pre-echo" notes) are sounded for 40 ms
so they can be heard; that is a playback choice, the MIDI files are untouched.
Output: wav/<name>.wav, 44.1 kHz, 16-bit stereo, peak-normalised to -1 dBFS.
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
from scipy.signal import lfilter

from notes_of import notes_of

HERE = Path(__file__).resolve().parent
SR = 44100
MIN_DUR, ATTACK, DECAY, SUSTAIN, RELEASE = 0.04, 0.008, 0.12, 0.55, 0.25
PAN = {1: -0.45, 2: 0.45}
MAX_VOICES_PER_ONSET = 16


def tri(phase):
    return 2 * np.abs(2 * (phase - np.floor(phase + 0.5))) - 1


def render(path, out):
    notes = notes_of(path)
    # cap polyphony per onset (keep the loudest) exactly like the page does
    by_onset = {}
    for n in notes:
        by_onset.setdefault(round(n[0], 3), []).append(n)
    keep = []
    for group in by_onset.values():
        keep += sorted(group, key=lambda n: -n[3])[:MAX_VOICES_PER_ONSET]
    end = max(s + max(d, MIN_DUR) for s, d, *_ in keep) + RELEASE + 2.0
    buf = np.zeros((2, int(end * SR) + 1))
    for s, d, p, v, tr in keep:
        d = max(d, MIN_DUR)
        n = int((d + (RELEASE if d >= 0.1 else 0.1)) * SR)
        t = np.arange(n) / SR
        f = 440.0 * 2 ** ((p - 69) / 12)
        x = tri(f * t) + (0.25 * np.sin(2 * np.pi * 2 * f * t) if d >= 0.1 else 0.0)
        # one-pole low-pass at ~6x the fundamental
        fc = min(6 * f, 8000.0)
        a = np.exp(-2 * np.pi * fc / SR)
        y = lfilter([1 - a], [1, -a], x) if d >= 0.1 else x
        env = np.where(t < ATTACK, t / ATTACK,
                       np.where(t < ATTACK + DECAY, 1 - (1 - SUSTAIN) * (t - ATTACK) / DECAY, SUSTAIN))
        rel = t >= d
        tau = RELEASE / 4 if d >= 0.1 else 0.015       # short notes: grain-like release, as on the page
        env[rel] = env[rel] * np.exp(-(t[rel] - d) / tau)
        g = 0.22 * (v / 127) ** 1.6
        pan = PAN.get(tr, 0.0)
        i0 = int(s * SR)
        buf[0, i0:i0 + n] += y * env * g * np.sqrt((1 - pan) / 2)
        buf[1, i0:i0 + n] += y * env * g * np.sqrt((1 + pan) / 2)
    # feedback echo 0.27 s, feedback 0.28, wet 0.2
    dl = int(0.27 * SR)
    wet = np.zeros_like(buf)
    src = buf.copy()
    for k in range(1, 7):
        sh = k * dl
        if sh >= buf.shape[1]:
            break
        wet[:, sh:] += src[:, :-sh] * (0.28 ** (k - 1))
    mix = buf + 0.2 * wet
    mix /= np.max(np.abs(mix)) / 10 ** (-1 / 20)
    pcm = (mix.T * 32767).astype("<i2")
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return len(keep), len(notes), end


def main():
    wav = HERE / "wav"
    wav.mkdir(exist_ok=True)
    srcs = sorted((HERE / "midi").glob("*.mid")) + sorted((HERE / "midi" / "blurred").glob("*.mid"))
    for p in srcs:
        out = wav / (p.stem + ".wav")
        kept, total, end = render(p, out)
        print(f"  {out.name}: {kept}/{total} notes, {end:.1f} s")


if __name__ == "__main__":
    main()
