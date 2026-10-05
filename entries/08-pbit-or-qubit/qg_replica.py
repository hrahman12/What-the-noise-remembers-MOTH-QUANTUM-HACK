"""Design aid only: a small numpy re-implementation of QuantumGraph's set_bloch / set_relationship
(moth-quantum/QuantumGraph, Apache-2.0) acting on an exact statevector. CLASSICAL.

Used to choose rotation fractions before spending credits. Its numbers are never shown as engine
output; the page uses only graph-v1's own tomography and shots."""
from __future__ import annotations

import random

import numpy as np
from scipy import linalg as la
from scipy.linalg import fractional_matrix_power as pwr

M = {"I": np.eye(2, dtype=complex), "X": np.array([[0, 1], [1, 0]], dtype=complex),
     "Y": np.array([[0, -1j], [1j, 0]]), "Z": np.array([[1, 0], [0, -1]], dtype=complex)}
for a in "IXYZ":
    for b in "IXYZ":
        M[a + b] = np.kron(M[b], M[a])  # QuantumGraph convention: index = 2*b(qubit1) + b(qubit0)


class Replica:
    def __init__(self, n, perturb=0.0, seed=0):
        self.n = n
        self.psi = np.zeros((2,) * n, dtype=complex)
        self.psi[(0,) * n] = 1
        self.perturb = perturb
        self.rng = np.random.default_rng(seed)
        random.seed(seed)

    # ---- reduced states -------------------------------------------------
    def rdm1(self, q):
        m = np.moveaxis(self.psi, q, 0).reshape(2, -1)
        return m @ m.conj().T

    def rdm2(self, q0, q1):
        m = np.moveaxis(self.psi, [q1, q0], [0, 1]).reshape(4, -1)
        r = m @ m.conj().T
        if self.perturb:
            h = self.rng.normal(size=(4, 4)) * self.perturb
            r = r + (h + h.T) / 2
        return r

    def apply1(self, U, q):
        p = np.moveaxis(self.psi, q, 0)
        p = np.tensordot(U, p, axes=([1], [0]))
        self.psi = np.moveaxis(p, 0, q)

    def apply2(self, U, q0, q1):
        p = np.moveaxis(self.psi, [q1, q0], [0, 1])
        sh = p.shape
        p = (U @ p.reshape(4, -1)).reshape(sh)
        self.psi = np.moveaxis(p, [0, 1], [q1, q0])

    # ---- QuantumGraph ops ----------------------------------------------
    def bloch(self, q):
        r = self.rdm1(q)
        return {P: float(np.real(np.trace(r @ M[P]))) for P in "XYZ"}

    def zz(self, a, b):
        r = self.rdm2(a, b)
        return float(np.real(np.trace(r @ M["ZZ"])))

    def set_bloch(self, target, q, fraction=1.0):
        def rho(e):
            x, y, z = e.get("X", 0), e.get("Y", 0), e.get("Z", 0)
            return np.array([[(1 + z) / 2, (x - 1j * y) / 2], [(x + 1j * y) / 2, (1 - z) / 2]])

        def vecs_of(r):
            _, v = la.eigh(r)
            v = v[:, ::-1]
            for k in range(v.shape[1]):
                i = np.argmax(np.abs(v[:, k]))
                v[:, k] *= np.exp(-1j * np.angle(v[i, k]))
            return v
        U = vecs_of(rho(target)) @ vecs_of(rho(self.bloch(q))).conj().T
        if fraction != 1:
            U = pwr(U, fraction)
        self.apply1(U, q)

    def set_relationship(self, rel, q0, q1, fraction=1.0):
        zero = 0.001

        def normalize(v):
            n = np.sqrt(np.vdot(v, v))
            return v / n if abs(n * np.conj(n)) > zero else np.full(4, np.nan)

        def rand_vec():
            v = np.array([2 * random.random() - 1 for _ in range(4)], dtype=complex)
            v[0] = abs(v[0])
            return normalize(v)

        def make_vec(P, seed_vec, ortho):
            v = P @ seed_vec
            for b in ortho:
                v = v - np.vdot(b, v) * b
            nv = normalize(v)
            tries = 0
            while np.isnan(nv).any() and tries < 100:
                v = P @ rand_vec()
                for b in ortho:
                    v = v - np.vdot(b, v) * b
                nv = normalize(v)
                tries += 1
            return nv

        raw_vals, raw_vecs = la.eigh(self.rdm2(q0, q1))
        vecs = []
        for k in np.argsort(raw_vals)[::-1]:
            v = raw_vecs[:, k].copy()
            v *= np.exp(-1j * np.angle(v[np.argmax(np.abs(v))]))
            vecs.append(v)
        T = np.eye(4, dtype=complex)
        for p, val in rel.items():
            T = T + val * M[p]
        T /= 4
        tv, tvec = la.eigh(T)
        tv = np.maximum(tv, 0)
        tv /= tv.sum()
        idx = np.argsort(tv)[::-1]
        groups, i = [], 0
        while i < 4:
            j = i + 1
            while j < 4 and abs(tv[idx[i]] - tv[idx[j]]) < 1e-8:
                j += 1
            groups.append(idx[i:j])
            i = j
        new, c = [None] * 4, 0
        for g in groups:
            P = sum(np.outer(tvec[:, k], tvec[:, k].conj()) for k in g)
            for _ in g:
                new[c] = make_vec(P, vecs[c], [v for v in new[:c] if v is not None])
                c += 1
        U = sum(np.outer(new[j], vecs[j].conj()) for j in range(4))
        if fraction != 1:
            U = pwr(U, fraction)
        self.apply2(U, q0, q1)

    def probs(self):
        return (np.abs(self.psi) ** 2).reshape(-1)
