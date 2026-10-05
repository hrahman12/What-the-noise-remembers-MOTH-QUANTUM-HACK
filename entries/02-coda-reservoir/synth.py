"""Click synthesis. CLASSICAL (numpy + scipy). No recordings are used anywhere.

The click is a synthetic broadband pulse: a 0.5 ms decaying noise burst through two resonators.
We deliberately keep it low (main resonance 2.2 kHz, body 0.9 kHz; measured: half its energy lies
below about 2.7 kHz) so it reads on laptop and phone speakers. That is the "pitched down for audibility" step: it changes the click's colour only.
Click TIMING is never stretched or shifted; every inter-click interval is played at real time (1:1).
"""
from __future__ import annotations

import numpy as np
from scipy.signal import fftconvolve, lfilter

SR = 44100
CLICK_SEED = 7
F_MAIN, Q_MAIN = 2200.0, 1.5
F_BODY, Q_BODY = 900.0, 6.0
# pan per whale (-1 left .. +1 right); the reservoir has no whale identity and sits in the centre
PAN = {"1": -0.6, "2": 0.6, "3": -0.25, "4": 0.25, "5": -0.85, "6": 0.85}


def _bandpass(x, f0, q, sr=SR):
    w0 = 2 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2 * q)
    b = np.array([alpha, 0, -alpha])
    a = np.array([1 + alpha, -2 * np.cos(w0), 1 - alpha])
    return lfilter(b / a[0], a / a[0], x)


def click(sr=SR):
    n = int(0.030 * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(CLICK_SEED)
    exc = rng.standard_normal(n) * np.exp(-t / 0.0005)
    y = _bandpass(exc, F_MAIN, Q_MAIN, sr) + 0.6 * _bandpass(exc, F_BODY, Q_BODY, sr) + 0.12 * exc
    fade = np.ones(n)
    k = int(0.006 * sr)
    fade[-k:] = np.linspace(1, 0, k)
    y *= fade
    return (y / np.max(np.abs(y))).astype(np.float64)


def reverb_ir(sr=SR, seconds=0.9, seed=11):
    n = int(seconds * sr)
    t = np.arange(n) / sr
    rng = np.random.default_rng(seed)
    ir = rng.standard_normal(n) * np.exp(-t / 0.16)
    ir = _bandpass(ir, 1200.0, 0.5, sr)
    return ir / np.sqrt(np.sum(ir ** 2))


def render(events, total_s, sr=SR, gain=0.55, wet=0.22):
    """events: list of (time_s, pan) for every click. Returns float32 stereo array (n, 2)."""
    c = click(sr)
    n = int(np.ceil(total_s * sr)) + len(c) + sr
    L = np.zeros(n)
    R = np.zeros(n)
    for t, pan in events:
        i = int(round(t * sr))
        th = (pan + 1) * np.pi / 4          # equal-power pan
        L[i:i + len(c)] += np.cos(th) * c * gain
        R[i:i + len(c)] += np.sin(th) * c * gain
    ir = reverb_ir(sr)
    L = L + wet * fftconvolve(L, ir)[:n]
    R = R + wet * fftconvolve(R, ir)[:n]
    out = np.stack([L, R], 1)
    peak = np.max(np.abs(out))
    if peak > 0:                             # normalise to -1 dBFS peak; never clip
        out *= 0.89 / peak
    return out.astype(np.float32)


def coda_clicks(start, icis):
    """Click times for one coda: first click at `start`, then cumulative ICIs."""
    return [start] + list(start + np.cumsum(icis))
