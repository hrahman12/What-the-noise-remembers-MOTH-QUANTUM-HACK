"""Shared CLASSICAL signal processing for the chirp instrument: load GWOSC HDF5, gate, whiten, scalogram."""
from __future__ import annotations

import json
from pathlib import Path

import h5py
import numpy as np
from scipy.signal import welch
from scipy.signal.windows import tukey

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
TSUN = 4.925490947e-6          # G * M_sun / c^3 in seconds
TRANSPOSE = 4.0                # every frequency x4 (two octaves up) before it becomes a MIDI pitch
TICKS_PER_BEAT = 480
TEMPO_US = 500_000             # 120 bpm -> 960 ticks per second
TICKS_PER_S = TICKS_PER_BEAT * 1e6 / TEMPO_US
RESOLUTION = 2                 # ticks per piano-roll step we ask blur-midi-v1 to use
LEAD_IN = 1.5                  # seconds of silence before the first note


def meta():
    return json.loads((DATA / "events.json").read_text(encoding="utf-8"))


def load(ev, det, lo=None, hi=None):
    """Return (t relative to the catalogue GPS, strain, fs). lo/hi crop in seconds."""
    m = meta()[ev]
    with h5py.File(DATA / m["files"][det]["file"], "r") as f:
        s = f["strain/Strain"][:].astype(float)
        t0 = float(f["meta/GPSstart"][()])
        dt = float(f["strain/Strain"].attrs["Xspacing"])
    t = np.arange(len(s)) * dt + t0 - m["gps"]
    if lo is not None:
        keep = (t >= lo) & (t < hi)
        t, s = t[keep], s[keep]
    return t, s, 1.0 / dt


def gate(t, x, a, b, taper=0.1):
    """Inverse Tukey gate: zero [a, b] with cosine ramps of `taper` s on each side."""
    g = np.ones_like(x)
    left = (t > a - taper) & (t < a)
    right = (t > b) & (t < b + taper)
    g[(t >= a) & (t <= b)] = 0.0
    g[left] = 0.5 * (1 + np.cos(np.pi * (t[left] - (a - taper)) / taper))
    g[right] = 0.5 * (1 - np.cos(np.pi * (t[right] - b) / taper))
    return x * g


def whiten(x, fs):
    """Divide by the amplitude spectral density (Welch, 4 s segments, median average)."""
    f, p = welch(x, fs=fs, nperseg=int(4 * fs), average="median")
    n = len(x)
    X = np.fft.rfft(x * tukey(n, 0.1))
    fr = np.fft.rfftfreq(n, 1 / fs)
    return np.fft.irfft(X / np.sqrt(np.interp(fr, f, p)), n=n) * np.sqrt(2 / fs)


def scalogram(w, fs, freqs, q=6.0):
    """Complex Morlet-style (Gaussian-in-frequency) transform; rows = freqs."""
    n = len(w)
    X = np.fft.fft(w)
    nu = np.fft.fftfreq(n, 1 / fs)
    out = np.empty((len(freqs), n), complex)
    for k, f0 in enumerate(freqs):
        out[k] = np.fft.ifft(X * np.exp(-0.5 * ((nu - f0) / (f0 / q)) ** 2) * (nu > 0))
    return out


def midi_of(f_hz):
    return 69 + 12 * np.log2(TRANSPOSE * np.asarray(f_hz) / 440.0)
