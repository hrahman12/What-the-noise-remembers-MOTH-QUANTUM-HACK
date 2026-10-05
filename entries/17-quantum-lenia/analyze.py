"""Measure what each real kernel does to Orbium, and what regrows from each snapshot. CLASSICAL (lenia.py).

Every number the page and README quote about the dynamics comes from out/dynamics.json, written here.
World 256 x 256 (the browser's world), mu = 0.15, sigma = 0.015, T = 10 unless noted.
"""
from __future__ import annotations

import json

import numpy as np
from scipy import ndimage

import lenia as L
from qblur import HERE

N, STEPS = 256, 2000
KDIR = HERE / "out" / "kernels"
SETTINGS = [("orig", None), ("s0.25", "k_s0.25_r0.0.npy"), ("s0.5", "k_s0.5_r0.0.npy"), ("s1.0", "k_s1.0_r0.0.npy")]


def kernels():
    bank = np.load(KDIR / "bank_input.npy")
    out = {}
    for key, f in SETTINGS:
        arr = bank if f is None else np.load(KDIR / f)
        for i, sh in enumerate(L.SHAPES):
            out[(sh, key)] = arr[i].astype(float)
    return out


def creatures(A):
    lab, n = ndimage.label(A > 0.05)
    m = ndimage.sum(A, lab, range(1, n + 1)) if n else []
    return int(sum(55 <= x <= 95 for x in m)), round(float(A.sum()), 1)


def classify(Kw, mu=L.MU, sigma=L.SIGMA):
    """One Orbium in the middle of the world; track it with centre-of-mass on the unwrapped path."""
    C = np.load(HERE / "orbium.npy").astype(float)
    A = np.zeros((N, N))
    A[118:138, 118:138] = C
    Kf = L.kernel_fft(Kw)
    ang = 2 * np.pi * np.arange(N) / N
    def com(A):  # circular centre of mass (torus-safe), in cells
        wy, wx = A.sum(1), A.sum(0)
        return np.array([np.angle((wy * np.exp(1j * ang)).sum()), np.angle((wx * np.exp(1j * ang)).sum())]) * N / (2 * np.pi)
    disp = np.zeros(2)
    prev = None
    for t in range(STEPS):
        A = L.step(A, Kf, mu, sigma)
        if t >= STEPS - 500 and A.sum() > 1:
            c = com(A)
            if prev is not None:
                disp += (c - prev + N / 2) % N - N / 2
            prev = c
    path = float(np.hypot(*disp))          # net displacement over the last 500 steps
    mass = float(A.sum())
    n, _ = creatures(A)
    if mass < 5:
        fate = "dies"
    elif mass > N * N * 0.1:
        fate = "fills the world"
    elif n == 1 and path > 5:
        fate = "glides"
    elif path <= 5:
        fate = "stops"
    else:
        fate = "breaks up"
    return {"fate": fate, "mass": round(mass, 1), "speed": round(path / 500, 4), "creatures": n}


def regrow():
    """Seed the browser's 256 x 256 world with each 128 x 128 snapshot corner, centred, original kernel."""
    Kf = L.kernel_fft(L.kernel_world(N, "ring"))
    res = {}
    for key, f, scale in [("orig", HERE / "out" / "world.npy", 99), ("s0.25", HERE / "out/snapshot/w_s0.25.npy", 99),
                          ("s0.5", HERE / "out/snapshot/w_s0.5.npy", 99)]:
        W = np.load(f).astype(float)[:128, :128] / scale
        A = np.zeros((N, N))
        A[64:192, 64:192] = np.clip(W, 0, 1)
        track = {}
        for t in range(1, 1001):
            A = L.step(A, Kf)
            if t in (50, 200, 500, 1000):
                track[t] = creatures(A)
        res[key] = {str(t): {"creatures": c, "mass": m} for t, (c, m) in track.items()}
    return res


def stamps():
    """The 8 grid orientations of Orbium (rot90 k times, then optional left-right flip) and the heading each one
    glides in under the original ring kernel, measured over 200 steps in a 512 x 512 world (no wrap)."""
    C = np.load(HERE / "orbium.npy").astype(float)
    Kf = L.kernel_fft(L.kernel_world(512, "ring"))
    out = []
    for t in range(8):
        c = np.rot90(C, t % 4)
        if t >= 4:
            c = c[:, ::-1]
        A = np.zeros((512, 512))
        A[246:266, 246:266] = c
        c0 = np.array(ndimage.center_of_mass(A))
        for _ in range(200):
            A = L.step(A, Kf)
        d = np.array(ndimage.center_of_mass(A)) - c0
        out.append({"t": t, "cells": np.rint(c * 255).astype(int).tolist(), "heading": [round(float(d[0] / 200), 4), round(float(d[1] / 200), 4)]})
    return out


if __name__ == "__main__":
    st = stamps()
    for x in st:
        print("stamp", x["t"], "heading (dy, dx) cells/step", x["heading"])
    (HERE / "out" / "stamps.json").write_text(json.dumps(st), encoding="utf-8")
    K = kernels()
    dyn = {f"{sh}|{key}": classify(K[(sh, key)]) for sh in L.SHAPES for key, _ in SETTINGS}
    for k, v in dyn.items():
        print(k, v)
    rg = regrow()
    for k, v in rg.items():
        print("regrow", k, v)
    (HERE / "out" / "dynamics.json").write_text(json.dumps({"orbium": dyn, "regrow": rg}, indent=1), encoding="utf-8")
