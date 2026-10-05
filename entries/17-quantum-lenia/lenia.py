"""Classical Lenia core (Chan 2019, Complex Systems 28(3)). CLASSICAL: no quantum anywhere in this file.

A(t+dt) = clip(A + dt * G(K * A), 0, 1), dt = 1/T, on a torus, with K * A done by FFT.
Orbium settings from the paper: R = 13, T = 10, mu = 0.15, sigma = 0.015, exponential kernel core,
single shell (beta = [1]), Gaussian growth G(u) = 2 exp(-(u - mu)^2 / (2 sigma^2)) - 1.
The browser (web/template.html) and render_mp4.py run exactly this rule.
"""
from __future__ import annotations

import numpy as np

R, T, MU, SIGMA = 13, 10, 0.15, 0.015

# Kernel shells. All are radial functions of r = distance / R on [0, 1).
# "ring" is Orbium's exponential core from Chan 2019. The others are variants built for this piece.
SHAPES = ["ring", "bell", "poly", "step"]


def _core_exp(r):
    out = np.zeros_like(r)
    m = (r > 0) & (r < 1)
    out[m] = np.exp(4 - 1 / (r[m] * (1 - r[m])))
    return out


def shell(r, shape):
    r = np.asarray(r, dtype=float)
    if shape == "ring":     # exponential core, beta = [1]  (Orbium's kernel)
        return _core_exp(r)
    if shape == "poly":     # polynomial core (4 r (1 - r))^4
        return np.where((r > 0) & (r < 1), (4 * r * (1 - r)) ** 4, 0.0)
    if shape == "step":     # rectangular core: 1 for 1/4 <= r <= 3/4
        return np.where((r >= .25) & (r <= .75), 1.0, 0.0)
    if shape == "bell":     # Gaussian ring exp(-((r - 0.5) / 0.15)^2 / 2)
        return np.where(r < 1, np.exp(-((r - 0.5) / 0.15) ** 2 / 2), 0.0)
    raise ValueError(shape)


def kernel_world(N=256, shape="ring", radius=R):
    """Kernel on an N x N grid, centred on cell (N/2, N/2), peak 1, not normalised.
    This is exactly the grid that goes to blur-core-v1 and the grid the FFT convolution uses."""
    y, x = np.mgrid[0:N, 0:N]
    d = np.hypot(x - N // 2, y - N // 2) / radius
    return shell(d, shape)


def kernel_fft(Kw):
    """FFT of a centred world-size kernel, normalised to sum 1, shifted so the centre is the origin."""
    K = np.asarray(Kw, dtype=float)
    K = K / K.sum()
    N = K.shape[0]
    return np.fft.rfft2(np.roll(K, (-(N // 2), -(N // 2)), axis=(0, 1)))


def growth(U, mu=MU, sigma=SIGMA):
    return 2 * np.exp(-((U - mu) ** 2) / (2 * sigma ** 2)) - 1


def step(A, Kf, mu=MU, sigma=SIGMA, dt=1 / T):
    U = np.fft.irfft2(np.fft.rfft2(A) * Kf, s=A.shape)
    return np.clip(A + dt * growth(U, mu, sigma), 0, 1)


def soup(N, rng, patches=8, size=40, density=1.0):
    """Random soup patches, as in Chan's random initialisation."""
    A = np.zeros((N, N))
    for _ in range(patches):
        cy, cx = rng.integers(0, N, 2)
        p = rng.random((size, size)) * density
        ys = (np.arange(size) + cy - size // 2) % N
        xs = (np.arange(size) + cx - size // 2) % N
        A[np.ix_(ys, xs)] = np.maximum(A[np.ix_(ys, xs)], p)
    return A
