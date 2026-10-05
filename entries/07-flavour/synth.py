"""FLAVOUR synth, Python replica. CLASSICAL DSP over the measured qpixl curves.

This is the same algorithm as the JUCE plugin (plugin/Source/FlavourEngine.h) and the browser synth
(web/template.html). It reads the bundle written by bundle.py (plugin/Resources/flavour_curves.json).

Per voice and per block of BLOCK samples:
  u      = log10(L/E) for this voice: the L/E knob plus FLIGHT x seconds since note-on (clamped)
  curve  = (1 - MIX) * exact curve + MIX * the chosen chip's measured curve (linear interp in u)
  level  = curve(u) for each flavour, clamped to [0, 1]
  wave   = a window of the same curve, WIN decades wide around u, sampled at NWIN points, mean removed,
           mirrored into a 2*NWIN sample cycle, divided by its peak. That cycle is the wavetable.
  table  = the cycle's harmonics 1..min(63, 0.45 sr / f) rebuilt on TAB samples (band-limited)
Oscillators: e at 1.5 x f (a fifth up), mu at f (the note you play), tau at 0.5 x f (an octave down).
MODEL 3: e, mu, tau follow P3(mu->e), P3(mu->mu), P3(mu->tau). MODEL 2: e follows P2(mu->e),
mu follows 1 - P2(mu->e), tau is silent. Envelope: linear attack, sustain 1, linear release.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
BUNDLE = HERE / "plugin" / "Resources" / "flavour_curves.json"

NWIN, WIN, TAB, BLOCK, MAXH = 64, 0.5, 256, 256, 63
MULT = {"e": 1.5, "mu": 1.0, "tau": 0.5}
FLAVOURS = ["e", "mu", "tau"]


class Data:
    def __init__(self, path=BUNDLE):
        d = json.loads(Path(path).read_text(encoding="utf-8"))
        self.d = d
        self.umin, self.umax = math.log10(d["le_min"]), math.log10(d["le_max"])
        self.exact = np.array(d["exact"]["P"], dtype=float)
        self.machines = {m["id"]: np.array(m["P"], dtype=float) for m in d["machines"]}
        self.meta = {m["id"]: m for m in d["machines"]}

    def interp(self, P, ci, u):
        n = P.shape[1]
        x = (np.clip(u, self.umin, self.umax) - self.umin) / (self.umax - self.umin) * (n - 1)
        i = np.minimum(np.floor(x).astype(int), n - 2)
        t = x - i
        return P[ci, i] * (1 - t) + P[ci, i + 1] * t

    def mixed(self, chip, mix, ci, u):
        u = np.asarray(u, dtype=float)
        return (1 - mix) * self.interp(self.exact, ci, u) + mix * self.interp(self.machines[chip], ci, u)

    def flavour_curve(self, chip, mix, model, flav, u):
        if model == 3:
            return self.mixed(chip, mix, {"e": 1, "mu": 2, "tau": 3}[flav], u)
        if flav == "e":
            return self.mixed(chip, mix, 0, u)
        if flav == "mu":
            return 1 - self.mixed(chip, mix, 0, u)
        return np.zeros_like(np.asarray(u, dtype=float))


def cycle_spectrum(data, chip, mix, model, flav, u):
    """Harmonics 1..MAXH of the mirrored window cycle, normalised so the cycle's peak is 1."""
    us = u + (np.arange(NWIN) / (NWIN - 1) - 0.5) * WIN
    s = data.flavour_curve(chip, mix, model, flav, us)
    w = s - s.mean()
    cyc = np.concatenate([w, w[::-1]])
    peak = np.abs(cyc).max()
    X = np.fft.rfft(cyc)[1:MAXH + 1]
    if peak < 1e-9:                      # perfectly flat window: fall back to a sine
        X = np.zeros(MAXH, complex)
        X[0] = -1j * NWIN                # (2/128) * |X| = 1 -> unit sine
        peak = 1.0
    return X / peak


def table_from(X, hmax):
    Y = np.zeros(TAB // 2 + 1, complex)
    h = min(hmax, MAXH)
    Y[1:h + 1] = X[:h] * (TAB / (2 * NWIN))
    return np.fft.irfft(Y, TAB)


def level(data, chip, mix, model, flav, u):
    return float(np.clip(data.flavour_curve(chip, mix, model, flav, u), 0, 1))


class Voice:
    def __init__(self, note, t_on, t_off, vel=0.8):
        self.f = 440.0 * 2 ** ((note - 69) / 12)
        self.t_on, self.t_off, self.vel = t_on, t_off, vel
        self.phase = {f: 0.0 for f in FLAVOURS}
        self.prev = None


def render(data, notes, dur, sr=44100, chip="aer", mix=1.0, model=3, flight=0.0, attack=0.02,
           release=0.6, gain=0.8, le=None, autom=None):
    """notes: list of (midi_note, t_on, t_off). le: fixed L/E (km/GeV), or autom(t) -> dict of
    any of {le, chip, mix, model, flight} evaluated per block (automation)."""
    n = int(dur * sr)
    out = np.zeros(n)
    voices = [Voice(*nt) for nt in notes]
    for b0 in range(0, n, BLOCK):
        b1 = min(n, b0 + BLOCK)
        t0 = b0 / sr
        st = {"le": le, "chip": chip, "mix": mix, "model": model, "flight": flight}
        if autom:
            st.update(autom(t0))
        uk = math.log10(st["le"])
        tt = (np.arange(b0, b1)) / sr
        for v in voices:
            if t0 < v.t_on - BLOCK / sr or t0 > v.t_off + release:
                continue
            env = np.clip((tt - v.t_on) / max(attack, 1e-4), 0, 1)
            rel = np.where(tt > v.t_off, np.clip(1 - (tt - v.t_off) / max(release, 1e-4), 0, 1), 1)
            env = env * rel * (tt >= v.t_on)
            if not env.any():
                continue
            u = min(data.umax, uk + st["flight"] * max(0.0, t0 - v.t_on))
            for fl in FLAVOURS:
                fo = v.f * MULT[fl]
                X = cycle_spectrum(data, st["chip"], st["mix"], st["model"], fl, u)
                tab = table_from(X, int(0.45 * sr / fo))
                a1 = level(data, st["chip"], st["mix"], st["model"], fl, u)
                key = (fl,)
                a0 = v.prev.get(key, a1) if v.prev else a1
                amp = np.linspace(a0, a1, b1 - b0, endpoint=False)
                ph = v.phase[fl] + np.arange(b1 - b0) * fo / sr
                v.phase[fl] = (v.phase[fl] + (b1 - b0) * fo / sr) % 1.0
                x = (ph % 1.0) * TAB
                i = x.astype(int) % TAB
                fr = x - np.floor(x)
                sig = tab[i] * (1 - fr) + tab[(i + 1) % TAB] * fr
                out[b0:b1] += v.vel * env * amp * sig
                v.prev = v.prev or {}
                v.prev[key] = a1
    return out * gain * 0.3


def write_wav(path, x, sr=44100):
    import wave
    x = np.asarray(x, dtype=float)
    peak = np.abs(x).max()
    if peak > 0.98:                       # never clip: normalise down only if needed
        x = x * (0.98 / peak)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
