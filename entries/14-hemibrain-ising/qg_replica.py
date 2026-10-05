"""CLASSICAL replica of QuantumGraph's state-preparation recipe, on an exact 20-qubit statevector.

graph-v1 is built on QuantumGraph (github.com/moth-quantum/QuantumGraph, Apache-2.0). Its
`set_bloch` / `set_relationship` turn a target expectation value into a 1- or 2-qubit unitary by
mapping the current reduced density matrix's eigenvectors onto the target's eigenspaces, optionally
taking a fractional power of that unitary. This file re-implements that rule in numpy so we can
(1) design the operation list before spending credits and (2) cross-check the engine's reported
tomography afterwards. It is a classical simulation. Nothing it produces is shown as engine output.

Qubit order follows QuantumGraph/Qiskit: in a 2-qubit matrix the first-named qubit is the least
significant bit (matrices[p0+p1] = kron(P[p1], P[p0])).

Licence notice: set_bloch / set_relationship below are adapted from QuantumGraph/QuantumGraph.py,
licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0),
Copyright IBM Quantum 2020, Copyright Moth Quantum 2025-2026. Modified for this piece: the reduced
density matrices come from an exact numpy statevector instead of pairwise tomography, and unitaries
are applied directly rather than appended to a Qiskit circuit.
"""
from __future__ import annotations

import numpy as np
from scipy import linalg as la
from scipy.linalg import fractional_matrix_power as pwr

P = {"I": np.eye(2, dtype=complex), "X": np.array([[0, 1], [1, 0]], dtype=complex),
     "Y": np.array([[0, -1j], [1j, 0]]), "Z": np.array([[1, 0], [0, -1]], dtype=complex)}
M2 = {a + b: np.kron(P[b], P[a]) for a in "IXYZ" for b in "IXYZ"}


class Replica:
    def __init__(self, n):
        self.n = n
        self.psi = np.zeros((2,) * n, dtype=complex)  # axis k <-> qubit k
        self.psi[(0,) * n] = 1

    # -- reduced states ----------------------------------------------------
    def rdm1(self, q):
        t = np.moveaxis(self.psi, q, 0).reshape(2, -1)
        return t @ t.conj().T

    def rdm2(self, q0, q1):
        """4x4 RDM in QuantumGraph's basis: index = b0 + 2*b1 (q0 least significant)."""
        t = np.moveaxis(self.psi, (q1, q0), (0, 1)).reshape(4, -1)  # row = 2*b1 + b0
        return t @ t.conj().T

    def bloch(self, q):
        r = self.rdm1(q)
        return {p: float(np.real(np.trace(r @ P[p]))) for p in "XYZ"}

    def zz(self, q0, q1):
        return float(np.real(np.trace(self.rdm2(q0, q1) @ M2["ZZ"])))

    def z(self, q):
        return float(np.real(np.trace(self.rdm1(q) @ P["Z"])))

    # -- gates ---------------------------------------------------------------
    def apply1(self, U, q):
        self.psi = np.moveaxis(np.tensordot(U, np.moveaxis(self.psi, q, 0), axes=(1, 0)), 0, q)

    def apply2(self, U, q0, q1):
        t = np.moveaxis(self.psi, (q1, q0), (0, 1))
        sh = t.shape
        t = (U @ t.reshape(4, -1)).reshape(sh)
        self.psi = np.moveaxis(t, (0, 1), (q1, q0))

    # -- QuantumGraph rules ----------------------------------------------------
    def set_bloch(self, target, q, fraction=1.0):
        def rho(e):
            x, y, z = e.get("X", 0), e.get("Y", 0), e.get("Z", 0)
            return np.array([[(1 + z) / 2, (x - 1j * y) / 2], [(x + 1j * y) / 2, (1 - z) / 2]])

        def vecs(r):
            _, v = la.eigh(r)
            v = v[:, ::-1].copy()
            for k in range(v.shape[1]):
                i = np.argmax(np.abs(v[:, k]))
                v[:, k] *= np.exp(-1j * np.angle(v[i, k]))
            return v

        U = vecs(rho(target)) @ vecs(rho(self.bloch(q))).conj().T
        if fraction != 1:
            U = pwr(U, fraction)
        self.apply1(U, q)

    def set_relationship(self, rel, q0, q1, fraction=1.0, rng=None):
        rng = rng or np.random.default_rng(0)

        def normalize(v):
            r = np.sqrt(np.vdot(v, v))
            return v / r if abs(r) ** 2 > 1e-3 else None

        def make_vec(Pj, seed, ortho):
            v = Pj @ seed
            for b in ortho:
                v = v - np.vdot(b, v) * b
            nv = normalize(v)
            tries = 0
            while nv is None and tries < 100:
                r = rng.uniform(-1, 1, 4).astype(complex)
                r[0] = abs(r[0])
                v = Pj @ normalize(r)
                for b in ortho:
                    v = v - np.vdot(b, v) * b
                nv = normalize(v)
                tries += 1
            return nv

        raw_vals, raw_vecs = la.eigh(self.rdm2(q0, q1))
        cur = []
        for k in np.argsort(raw_vals)[::-1]:
            v = raw_vecs[:, k].copy()
            i = np.argmax(np.abs(v))
            cur.append(v * np.exp(-1j * np.angle(v[i])))
        trho = np.eye(4, dtype=complex)
        for p, val in rel.items():
            trho = trho + val * M2[p]
        trho /= 4
        tv, tvec = la.eigh(trho)
        tv = np.maximum(tv, 0)
        tv /= tv.sum()
        order = np.argsort(tv)[::-1]
        groups, i = [], 0
        while i < 4:
            j = i + 1
            while j < 4 and abs(tv[order[i]] - tv[order[j]]) < 1e-8:
                j += 1
            groups.append(order[i:j])
            i = j
        new, c = [None] * 4, 0
        for g in groups:
            Pj = sum(np.outer(tvec[:, k], tvec[:, k].conj()) for k in g)
            for _ in g:
                new[c] = make_vec(Pj, cur[c], [v for v in new[:c] if v is not None])
                c += 1
        U = sum(np.outer(new[j], cur[j].conj()) for j in range(4))
        if fraction != 1:
            U = pwr(U, fraction)
        self.apply2(U, q0, q1)

    def run(self, operations):
        for op in operations:
            if op["type"] == "bloch":
                self.set_bloch(op["paulis"], op["qubit"], op.get("fraction", 1.0))
            else:
                self.set_relationship(op["paulis"], *op["qubits"], fraction=op.get("fraction", 1.0))
        return self

    def probs(self):
        """Probabilities indexed by bitstring with qubit 0 LEFTMOST (graph-v1's convention)."""
        return np.abs(self.psi.reshape(-1)) ** 2  # C-order: axis 0 = qubit 0 = most significant = leftmost


def pair_curve(fractions):
    """<ZZ> after one set_relationship({'ZZ': 1}, fraction=f) on |++>: the single-edge response."""
    out = []
    for f in fractions:
        r = Replica(2)
        r.set_bloch({"X": 1.0}, 0)
        r.set_bloch({"X": 1.0}, 1)
        r.set_relationship({"ZZ": 1.0}, 0, 1, fraction=float(f))
        out.append(r.zz(0, 1))
    return np.array(out)


if __name__ == "__main__":
    fs = np.linspace(0, 1, 11)
    for f, z in zip(fs, pair_curve(fs)):
        print(f"fraction {f:.1f} -> <ZZ> {z:+.4f}")
