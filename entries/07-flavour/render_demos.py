"""Render the three audio demos with the Python replica of the plugin engine (synth.py).
CLASSICAL DSP over the measured curves in plugin/Resources/flavour_curves.json.

  audio/flavour_sweep.wav         one held note while L/E sweeps 20 -> 50,000 km/GeV, ibm_fez curves
  audio/flavour_chip_compare.wav  the same two-note phrase on exact, aer, 5 noise models and ibm_fez
  audio/flavour_pad.wav           a slow chord pad flying outward in L/E, ibm_fez curves
Also writes web/audio/*.mp3 for the page and out/demos.json (settings + cue sheet).
"""
from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import numpy as np

import synth

HERE = Path(__file__).resolve().parent
SR = 44100
HW = "ibm_fez"


def sweep(data):
    dur, t1 = 26.0, 24.0
    u0, u1 = math.log10(20), math.log10(50000)

    def autom(t):
        return {"le": 10 ** (u0 + (u1 - u0) * min(1.0, t / t1))}
    x = synth.render(data, [(57, 0.0, t1)], dur, SR, chip=HW, mix=1.0, model=3, attack=0.4, release=1.5,
                     le=20, autom=autom)
    return x, {"title": "Sweep", "file": "audio/flavour_sweep.mp3",
               "text": "One held A3 while L/E sweeps from 20 to 50,000 km/GeV over 24 s, on the curves measured on ibm_fez. "
                       "You hear nu-mu (A3) fade into nu-tau (an octave down) at the first atmospheric maximum, "
                       "beat back and forth through the fast atmospheric wiggles, then nu-e (a fifth up) swell near the solar maximum.",
               "settings": f"chip {HW} (real hardware) / mix 1 / 3 flavours / L/E 20 -> 50,000 km/GeV"}


def chip_compare(data):
    chips = [("exact", "aer", 0.0)] + [(c, c, 1.0) for c in
             ["aer", "fake_fez", "fake_torino", "fake_brisbane", "fake_kyoto", "ibm_fez"] if c in data.machines]
    seg, notes, cues = 3.4, [], []
    for k, (name, chip, mix) in enumerate(chips):
        t = k * seg
        notes += [(57, t + 0.05, t + 2.6), (64, t + 0.05, t + 2.6)]
        cues.append({"t": round(t, 2), "label": name, "chip": chip, "mix": mix})

    def autom(t):
        k = min(len(chips) - 1, int(t // seg))
        return {"chip": chips[k][1], "mix": chips[k][2]}
    dur = len(chips) * seg + 0.6
    x = synth.render(data, notes, dur, SR, chip="aer", mix=1.0, model=3, flight=0.18, attack=0.02, release=0.6,
                     le=2500, autom=autom)
    names = ", ".join(c["label"] for c in cues)
    return x, {"title": "Chip compare", "file": "audio/flavour_chip_compare.mp3",
               "text": f"The same A3 + E4 phrase, flying outward from L/E 2,500 km/GeV, played {len(cues)} times: {names}. "
                       "Same physics every time; what changes is each machine's noise in the measured curves.",
               "settings": "every 3.4 s: " + " / ".join(c["label"] for c in cues) + " / flight 0.18 dec/s",
               "cues": cues}


def pad(data):
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]   # Am F C G
    notes, step = [], 4.5
    for k, ch in enumerate(chords):
        notes += [(n, k * step, k * step + step - 0.3) for n in ch]
    dur = len(chords) * step + 3.0
    x = synth.render(data, notes, dur, SR, chip=HW, mix=1.0, model=3, flight=0.12, attack=0.9, release=2.6,
                     le=300, gain=0.6)
    return x, {"title": "Pad", "file": "audio/flavour_pad.mp3",
               "text": "Am, F, C, G with slow attacks. Every chord starts at L/E 300 km/GeV and flies outward while held, "
                       "so each chord drifts from muon-flavoured into tau-flavoured. Curves measured on ibm_fez.",
               "settings": f"chip {HW} (real hardware) / mix 1 / 3 flavours / L/E 300 km/GeV / flight 0.12 dec/s"}


def mp3(wav, dst):
    import imageio_ffmpeg
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(wav),
                    "-codec:a", "libmp3lame", "-b:a", "160k", str(dst)], check=True)


def main():
    data = synth.Data()
    (HERE / "audio").mkdir(exist_ok=True)
    meta = []
    for fn, name in [(sweep, "flavour_sweep"), (chip_compare, "flavour_chip_compare"), (pad, "flavour_pad")]:
        x, info = fn(data)
        x = x * (0.89 / max(1e-9, float(np.abs(x).max())))   # peak-normalise each demo to -1 dBFS
        wav = HERE / "audio" / f"{name}.wav"
        synth.write_wav(wav, x, SR)
        mp3(wav, HERE / "web" / "audio" / f"{name}.mp3")
        info["wav"] = f"audio/{name}.wav"
        info["seconds"] = round(len(x) / SR, 1)
        info["peak"] = round(float(np.abs(x).max()), 3)
        meta.append(info)
        print(f"  {wav.name}: {info['seconds']} s, peak {info['peak']}")
    (HERE / "out" / "demos.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
