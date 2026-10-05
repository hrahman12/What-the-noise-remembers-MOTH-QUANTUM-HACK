"""Render the WAV deliverables from the MIDI files. CLASSICAL synthesis (pure sines, see synth.py).

wav/<setting>/<molecule>_<H|D>.wav  every chord: the input score ("clean") and each completed blur job
wav/quantum_nose_demo.wav           a 144 s tour: each molecule normal then deuterated, unblurred, then
                                    the same pairs through blur strength 1 / reach 0 (local) and
                                    strength 0.5 / reach 1 (global)

Every blurred WAV is synthesised from a MIDI file downloaded from a completed blur-midi-v1 job
(out/jobs.csv); nothing here invents notes. Loudness is equalised per track (RMS), as on the page.
"""
from __future__ import annotations

import csv
import wave
from pathlib import Path

import numpy as np

from spectra import ORDER
from synth import loudness_gain, read_tracks, render

HERE = Path(__file__).resolve().parent
SR = 22050


def write_wav(path: Path, y: np.ndarray):
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak > 0.97:
        y = y * (0.97 / peak)
    pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    settings = {"clean": HERE / "midi" / "nose_input.mid"}
    for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")):
        if r["status"] == "completed":
            settings[f"s{float(r['strength']):g}_r{float(r['reach']):g}"] = HERE / r["file"]
    clips = {}
    for key, path in settings.items():
        tracks = read_tracks(path)
        for mol in ORDER:
            for iso in ("H", "D"):
                ns = tracks.get(f"{mol} {iso}", [])
                y = render(ns, sr=SR, dur=7.2, gain=loudness_gain(ns) if ns else 1.0)
                clips[(key, mol, iso)] = y
                write_wav(HERE / "wav" / key / f"{mol}_{iso}.wav", y)
        print(f"  wav/{key}/ (6 files)")
    # demo tour
    gap = np.zeros(int(0.8 * SR), dtype=np.float32)
    tour = [k for k in ("clean", "s1_r0", "s0.5_r1") if k in settings]
    parts = []
    for key in tour:
        for mol in ORDER:
            for iso in ("H", "D"):
                parts += [clips[(key, mol, iso)], gap]
    demo = np.concatenate(parts)
    write_wav(HERE / "wav" / "quantum_nose_demo.wav", demo)
    print(f"wav/quantum_nose_demo.wav: {len(demo) / SR:.1f} s, settings {tour}")


if __name__ == "__main__":
    main()
