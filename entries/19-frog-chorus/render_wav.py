"""Render the WAV examples: the chorus model (chorus.py) driven by the engine's pond data. CLASSICAL audio.

Every example starts with the coupling off (frogs call independently, each at its own rate) and ramps
the coupling K up over the clip, so you hear the chorus organise itself. The same equations, rates,
pitches and call shape as the browser instrument; the engine numbers come from out/pond.json.

Writes 16-bit stereo 44.1 kHz WAVs to out/wav/ and small MP3 copies to web/audio/ for the page.
"""
from __future__ import annotations

import json
import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

import chorus as C

HERE = Path(__file__).resolve().parent
SR = 44100
SECONDS = 28.0
F0, SPREAD = 2.0, 0.04

EXAMPLES = [  # (file stem, dataset, coupling source, K max, caption); the 22-qubit ponds are the largest completed
    ("alt22_engine", "alt22", "engine", 8.0, "Alternating pond (22 qubits), engine-delivered couplings, K 0 to 8"),
    ("alt22_asked", "alt22", "asked", 4.0, "Alternating pond (22 qubits), the couplings we asked for, K 0 to 4"),
    ("sync22_engine", "sync22", "engine", 12.0, "Sync pond (22 qubits), engine-delivered couplings, K 0 to 12"),
    ("sync22_asked", "sync22", "asked", 4.0, "Sync pond (22 qubits), the couplings we asked for, K 0 to 4"),
]


def croak(f, vol):
    """One call: 3 short pulses of a gliding sawtooth through a band-pass, about 0.1 s long."""
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    freq = f * 1.06 * (0.94 / 1.06) ** (t / 0.09)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    env = np.zeros(n)
    for p in range(3):
        t0 = p * 0.032
        up = (t >= t0) & (t < t0 + 0.004)
        env[up] = (t[up] - t0) / 0.004
        dn = (t >= t0 + 0.004) & (t < t0 + 0.024)
        env[dn] = 1 - (t[dn] - t0 - 0.004) / 0.020
    lo, hi = f * 2.2 / 1.4, min(f * 2.2 * 1.4, SR / 2 - 100)
    sos = butter(2, [lo, hi], btype="band", fs=SR, output="sos")
    return vol * sosfilt(sos, saw) * env


def render(ds, source, kmax):
    n = ds["n"]
    theta = C.initial_phases(ds)
    w = [2 * math.pi * f for f in C.rates(n, F0, SPREAD)]
    edges = C.couplings(ds, source)
    occ = [1] * n
    out = np.zeros((int((SECONDS + 0.5) * SR), 2))
    cache = {k: croak(C.pitch(k), 0.22) for k in range(n)}
    pos = ds["frogs"]
    steps = int(SECONDS / C.DT)
    R_log = []
    for s in range(steps):
        t = s * C.DT
        K = kmax * min(1.0, max(0.0, (t - 4.0) / (SECONDS - 10.0)))  # 4 s free, ramp, 6 s at full K
        theta, calls = C.step(theta, w, edges, occ, K)
        for k in calls:
            pan = max(-1.0, min(1.0, pos[k]["x"]))
            a = int((t + C.DT) * SR)
            c = cache[k]
            seg = out[a:a + len(c)]
            gl, gr = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
            seg[:, 0] += c[:len(seg)] * gl
            seg[:, 1] += c[:len(seg)] * gr
        if s % 240 == 0:
            R_log.append([round(t, 2), round(K, 3), *[round(v, 3) for v in C.order(theta, occ, edges)]])
    peak = np.abs(out).max()
    out = out / peak * 0.89 if peak > 0 else out
    return out, R_log


def write_wav(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def main():
    data = {d["name"]: d for d in json.loads((HERE / "out" / "pond.json").read_text(encoding="utf-8"))}
    try:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = None
    index = []
    for stem, name, source, kmax, caption in EXAMPLES:
        if name not in data:
            print(f"skip {stem}: no {name} data")
            continue
        x, log = render(data[name], source, kmax)
        wav = HERE / "out" / "wav" / f"{stem}.wav"
        write_wav(wav, x)
        mp3 = HERE / "web" / "audio" / f"{stem}.mp3"
        if ffmpeg:
            mp3.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame",
                            "-b:a", "128k", str(mp3)], check=True)
        index.append({"file": f"audio/{stem}.mp3", "wav": f"out/wav/{stem}.wav", "dataset": name,
                      "job_id": data[name]["job_id"], "source": source, "kmax": kmax, "f0": F0,
                      "spread": SPREAD, "seconds": SECONDS, "caption": caption, "log": log})
        print(f"{stem}: final R {log[-1][2]:.2f}, turns {log[-1][3]:.2f} -> {wav.name}")
    (HERE / "out" / "wav" / "examples.json").write_text(json.dumps(index, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
