"""Signal processing for Squeezed Chirp. Everything in this file is CLASSICAL.

Pipeline: GWOSC strain (H1, L1) -> whiten (Welch PSD) -> zero-phase bandpass 20-500 Hz
-> resample so one STFT frame = one sample -> Gaussian-window STFT evaluated on a linear
20-500 Hz frequency grid -> power |S|^2, H1 and time-aligned L1 averaged -> quantised
non-negative integer grid G[t, f] (axis 0 = time, axis 1 = frequency) for blur-core-v1.

Also: chirp-ridge width measurement and Griffin-Lim resynthesis to WAV.
"""
from __future__ import annotations

import json
import wave
from pathlib import Path

import h5py
import numpy as np
from scipy import signal
from scipy.ndimage import gaussian_filter, uniform_filter1d

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

T_MERGER = 1126259462.422       # GPS, approximate H1 merger time (GWOSC tutorial value)
L1_SHIFT = 0.0069               # s: L1 sees the signal ~6.9 ms before H1 (Abbott et al. 2016);
                                # our own H1/L1 cross-correlation peaks at -7.3 ms, sign-flipped
F_LO, F_HI = 20.0, 500.0        # analysis band (Hz)
T_BEFORE, T_AFTER = 0.30, 0.10  # grid time window around merger (s)
WIN_SIGMA = 0.012               # Gaussian STFT window std (s)
QMAX = 999                      # grid values are integers 0..QMAX (keeps the JSON payload small)


# ---------------------------------------------------------------- strain
def load(det: str):
    src = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))[det]
    with h5py.File(DATA / src["file"], "r") as f:
        x = f["strain/Strain"][()].astype(np.float64)
        dt = float(f["strain/Strain"].attrs["Xspacing"])
        t0 = float(f["strain/Strain"].attrs["Xstart"])
    return x, 1.0 / dt, t0


def whiten(x, fs, seg=4.0):
    """Divide by the amplitude spectral density (Welch, 4 s Hann segments) -> unit-variance noise."""
    f, psd = signal.welch(x, fs=fs, nperseg=int(seg * fs), window="hann")
    win = signal.windows.tukey(len(x), alpha=1.0 / 8)
    X = np.fft.rfft(x * win)
    fr = np.fft.rfftfreq(len(x), 1.0 / fs)
    asd = np.sqrt(np.interp(fr, f, psd))
    w = np.fft.irfft(X / asd, n=len(x)) * np.sqrt(2.0 / fs)
    return w


def bandpass(x, fs, lo=F_LO, hi=F_HI, order=4):
    sos = signal.butter(order, [lo, hi], btype="bandpass", fs=fs, output="sos")
    return signal.sosfiltfilt(sos, x)


UP = 4   # band-limited upsampling factor (4096 -> 16384 Hz) before interpolating onto the frame clock


def prepared(det: str):
    """Whitened, bandpassed strain for one detector, upsampled x4 (polyphase, band-limited),
    with its time axis (GPS)."""
    x, fs, t0 = load(det)
    y = signal.resample_poly(bandpass(whiten(x, fs), fs), UP, 1)
    fs = fs * UP
    t = t0 + np.arange(len(y)) / fs
    return y, fs, t


# ---------------------------------------------------------------- spectrogram grid
def stft_power(y, fs, t, n_t, n_f, shift=0.0):
    """Power |S(t,f)|^2 on an n_t x n_f grid: n_t frame centres evenly spanning the window,
    n_f frequencies linear in [F_LO, F_HI]. Each frame takes the 16384 Hz strain within +-4 sigma
    of its centre, applies a Gaussian window and evaluates the DFT at the grid frequencies
    (a zero-padded STFT without the padding cost). Units are arbitrary (rescaled later)."""
    T = T_BEFORE + T_AFTER
    t_frames = T_MERGER - T_BEFORE + (np.arange(n_t) + 0.5) * (T / n_t)
    half = int(np.ceil(4 * WIN_SIGMA * fs))
    k = np.arange(-half, half + 1)
    w = np.exp(-0.5 * (k / (WIN_SIGMA * fs)) ** 2)
    w /= np.sqrt(np.sum(w ** 2))
    freqs = np.linspace(F_LO, F_HI, n_f)
    E = (w[None, :] * np.exp(-2j * np.pi * freqs[:, None] * k[None, :] / fs)).astype(np.complex64)
    P = np.empty((n_t, n_f), dtype=np.float32)
    for a in range(0, n_t, 256):
        tc = t_frames[a:a + 256]
        # samples at tc + k/fs; y is band-limited to 500 Hz at 16384 Hz, so linear interp is ~exact
        seg = np.interp((tc[None, :] + k[:, None] / fs) - shift, t, y).astype(np.complex64)
        S = E @ seg                                            # (n_f, chunk)
        P[a:a + 256] = (np.abs(S) ** 2).T
    return P, t_frames - T_MERGER, freqs


def spectrogram(n_t, n_f):
    """H1 power and time-aligned L1 power, averaged (incoherent: the L1 sign flip does not matter)."""
    yh, fs, th = prepared("H1")
    yl, _, tl = prepared("L1")
    ph, tt, ff = stft_power(yh, fs, th, n_t, n_f)
    pl, _, _ = stft_power(yl, fs, tl, n_t, n_f, shift=L1_SHIFT)
    return 0.5 * (ph + pl), tt, ff


def quantise(P, qmax=QMAX):
    """Non-negative integers 0..qmax. Clip at the 99.99th percentile so one hot pixel cannot
    flatten the rest of the grid."""
    top = float(np.percentile(P, 99.99))
    G = np.clip(np.rint(P / top * qmax), 0, qmax).astype(np.int32)
    return G, top


# ---------------------------------------------------------------- ridge widths
# The chirp is shallow early on (slowly rising, ~35-80 Hz) and nearly vertical near merger
# (~90-220 Hz in a few ms). A frequency profile at fixed time cuts the shallow part cleanly, and a
# time profile at fixed frequency cuts the steep part cleanly, so each width is measured where its
# cut is clean. Both tracks come from the ORIGINAL grid and are reused for every blurred version.
TW_BAND = (90.0, 220.0)    # Hz: rows used for the time-width (steep part of the ridge)
FW_SPAN = (-0.09, -0.02)   # s: columns used for the freq-width (shallow part of the ridge)


def ridge_track(G, tt, ff):
    """Return (rows, t_idx) for the time-width and (cols, f_idx) for the freq-width."""
    Gs = gaussian_filter(G.astype(np.float64), sigma=(len(tt) / 400, len(ff) / 400))
    rows = np.where((ff >= TW_BAND[0]) & (ff <= TW_BAND[1]))[0]
    tw = np.where((tt >= -0.06) & (tt <= 0.03))[0]
    t_idx = tw[np.argmax(Gs[np.ix_(tw, rows)], axis=0)]
    cols = np.where((tt >= FW_SPAN[0]) & (tt <= FW_SPAN[1]))[0]
    fw = np.where((ff >= 25.0) & (ff <= 120.0))[0]
    f_idx = fw[np.argmax(Gs[np.ix_(cols, fw)], axis=1)]
    k = 2 * (len(rows) // 40) + 1
    t_idx = signal.medfilt(t_idx.astype(float), k).astype(int)
    k = 2 * (len(cols) // 40) + 1
    f_idx = signal.medfilt(f_idx.astype(float), k).astype(int)
    return {"rows": rows, "t_idx": t_idx, "cols": cols, "f_idx": f_idx}


def _moment_width(profile, centre, half):
    """RMS width (in samples) of a profile within +-half of `centre`, after removing the
    profile's median (the noise floor)."""
    lo, hi = max(0, centre - half), min(len(profile), centre + half + 1)
    p = np.clip(profile[lo:hi].astype(np.float64) - np.median(profile), 0, None)
    if p.sum() <= 0:
        return np.nan, 0.0
    x = np.arange(lo, hi)
    mu = np.sum(x * p) / p.sum()
    return float(np.sqrt(np.sum((x - mu) ** 2 * p) / p.sum())), float(p.max())


def ridge_widths(A, track, tt, ff, half_t=0.03, half_f=40.0):
    """Power-weighted mean RMS width of the chirp ridge along time (ms) and frequency (Hz)."""
    dt, df = tt[1] - tt[0], ff[1] - ff[0]
    ht, hf = int(round(half_t / dt)), int(round(half_f / df))
    wt = [_moment_width(A[:, r], int(c), ht) for r, c in zip(track["rows"], track["t_idx"])]
    wf = [_moment_width(A[c, :], int(r), hf) for c, r in zip(track["cols"], track["f_idx"])]

    def avg(pairs):
        w = np.array([p[0] for p in pairs]); m = np.array([p[1] for p in pairs])
        ok = np.isfinite(w) & (m > 0)
        return float(np.average(w[ok], weights=m[ok]))
    return {"time_width_ms": avg(wt) * dt * 1e3, "freq_width_hz": avg(wf) * df}


# ---------------------------------------------------------------- audio (Griffin-Lim)
AUDIO_FS = 22050
SLOW = 8          # sonification: 8x slower ...
PITCH = 4         # ... and 4x higher, so 35-250 Hz becomes 140-1000 Hz and 0.4 s becomes 3.2 s
NFFT, HOP = 1024, 128


AUDIO_T0 = -0.16  # s from merger where the sonification starts (the gated grid is silent before)


def to_audio_mag(A, tt, ff, t0=AUDIO_T0):
    """Map a grid (time x freq power) onto a Griffin-Lim STFT magnitude at AUDIO_FS, from source
    time t0 to the end of the grid: time stretched by SLOW, every frequency multiplied by PITCH.
    Linear interpolation only."""
    dur = (tt[-1] - t0) * SLOW
    n_frames = int(dur * AUDIO_FS / HOP) + 1
    tf = np.linspace(t0, tt[-1], n_frames)
    fb = np.fft.rfftfreq(NFFT, 1.0 / AUDIO_FS) / PITCH       # source frequency for each audio bin
    mag = np.sqrt(np.clip(A, 0, None)).astype(np.float64)    # power -> magnitude
    # interpolate along time then frequency
    m_t = np.stack([np.interp(tf, tt, mag[:, j]) for j in range(mag.shape[1])], axis=1)
    out = np.stack([np.interp(fb, ff, row, left=0.0, right=0.0) for row in m_t], axis=0)
    return out.T          # (bins, frames)


def griffin_lim(M, n_iter=80, seed=0):
    rng = np.random.default_rng(seed)
    phase = np.exp(2j * np.pi * rng.random(M.shape))
    for _ in range(n_iter):
        _, x = signal.istft(M * phase, fs=AUDIO_FS, nperseg=NFFT, noverlap=NFFT - HOP)
        _, _, S = signal.stft(x, fs=AUDIO_FS, nperseg=NFFT, noverlap=NFFT - HOP)
        S = S[:, :M.shape[1]]
        if S.shape[1] < M.shape[1]:
            S = np.pad(S, ((0, 0), (0, M.shape[1] - S.shape[1])))
        phase = np.exp(1j * np.angle(S))
    _, x = signal.istft(M * phase, fs=AUDIO_FS, nperseg=NFFT, noverlap=NFFT - HOP)
    return x


def write_wav(path, x, peak=0.85, fade=0.02):
    """16-bit mono WAV. peak=None keeps the caller's gain (used to share one gain across versions)."""
    x = np.array(x, dtype=np.float64)
    n = int(fade * AUDIO_FS)
    ramp = np.linspace(0, 1, n)
    x[:n] *= ramp
    x[-n:] *= ramp[::-1]
    if peak is not None:
        x = x / (np.max(np.abs(x)) + 1e-12) * peak
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(AUDIO_FS)
        w.writeframes(pcm.tobytes())
    return len(x) / AUDIO_FS
