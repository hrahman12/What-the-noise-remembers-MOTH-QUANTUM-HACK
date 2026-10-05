"""The pond: 20 lily pads around an oval bank, who can hear whom, and the qdrive-api-v1 job recipes.

CLASSICAL. Pad positions, the hearing graph, the requested starting phases and the edge layering
are all chosen here, deterministically (no randomness). Each pad is one qubit.

Hearing graph (27 edges, max degree 3):
  * the bank: every pad hears its two neighbours along the bank (a 20-cycle, which is even), and
  * five short "inlet" chords (k, k+2) that close triangles (odd cycles, where alternation is frustrated),
  * two long chords across the water.

Requested phases: a golden-angle splay, phi_k = k * 137.508 deg, so no two neighbours start in step.

Lock target on every edge: <XX> = <YY> = s * C, s = +1 (sync pond) or -1 (alternating pond), C = 0.7.
For two separately phased (unentangled) qubits, |<XX> + <YY>| <= 1, so asking for 1.4 asks for more
than any pair of independent phases can give; how close the engine gets is part of the data.

qdrive applies targets in order and only re-measures the state at an update() (a null entry), so pair
targets are grouped into layers of disjoint edges (a proper edge colouring) with an update() before each
layer. Inside a layer no two targets share a qubit, so each one is computed on a fresh reduced state.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
N = 20
LOCK = 0.7
SEED = 19
SHOTS = 1024
HARDWARE = "ibm_fez"  # the IBM chip (Heron r2, 156 qubits) every hardware attempt in this piece targets
GOLDEN = 137.50776405003785  # degrees



def inlets(n=N):
    return [(k, k + 2) for k in range(1, n - 2, 4)]


def across(n=N):
    return [(4, n - 4), (6, n - 6)]


def positions(n=N):
    """Pads on an oval bank (unit-free, x in [-1, 1]); a gentle deterministic wobble so it looks hand-placed."""
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n + 0.06 * math.sin(3.1 * k)
        rx, ry = 1.0 + 0.035 * math.cos(5.3 * k), 0.62 + 0.03 * math.sin(4.7 * k)
        pts.append((round(rx * math.cos(t), 4), round(ry * math.sin(t), 4)))
    return pts


def edges(n=N):
    ring = [(k, (k + 1) % n) for k in range(n)]
    return [tuple(sorted(e)) for e in ring + inlets(n) + across(n)]


def layers(es):
    """Greedy proper edge colouring: each layer is a set of disjoint edges. Deterministic order."""
    out = []
    for e in es:
        for lay in out:
            if all(not set(e) & set(f) for f in lay):
                lay.append(e)
                break
        else:
            out.append([e])
    return out


def phases_deg(n=N):
    return [round((k * GOLDEN) % 360, 3) for k in range(n)]


def build_params(sign: int, machine="aer", n=N):
    es = edges(n)
    targets = []
    for k, ph in enumerate(phases_deg(n)):
        r = math.radians(ph)
        targets.append({"qubits": [k], "expvals": {"X": round(math.cos(r), 6), "Y": round(math.sin(r), 6)}})
    for lay in layers(es):
        targets.append(None)  # update(): re-measure before this layer
        for i, j in lay:
            targets.append({"qubits": [i, j], "expvals": {"XX": sign * LOCK, "YY": sign * LOCK}})
    return {"n_qubits": n, "coupling_map": [list(e) for e in es], "targets": targets, "machine": machine,
            "seed": SEED, "shots": SHOTS, "tomography": 2, "sample": True}


def readout_params(machine, n=N):
    """Re-read a finished pond circuit (chained by its output asset) on another machine: no targets,
    just two-qubit tomography of the hearing edges and a shot sample."""
    return {"n_qubits": n, "coupling_map": [list(e) for e in edges(n)], "machine": machine,
            "seed": SEED, "shots": SHOTS, "tomography": 2, "sample": True}


def circuit_asset(name):
    """The asset id of a finished build job's `circuit` output (Atlas's JSON API takes a bare asset UUID
    for input_files; a job:<id>/circuit reference was rejected with 422 before any job was created)."""
    p = HERE / "out" / f"qdrive_{name}.json"
    if not p.exists():
        raise KeyError(f"{name} has not completed yet (run it first)")
    outs = json.loads(p.read_text(encoding="utf-8"))["response"]["outputs"]
    return next(o["output_asset_id"] for o in outs if o["slot"] == "circuit")


def plan():
    """name -> () -> (params, files). Chained readouts take the build job's circuit output asset.

    `<pond>_build_ibm_fez` is the full pond build sent straight to the IBM chip (machine = HARDWARE). qdrive
    rejects it ("not wired up yet", see PARAMS.md); the `aer` builds are the ones that complete."""
    P = {}
    for n in (20, 22, 24):
        P[f"alt{n}"] = (lambda n=n: (build_params(-1, n=n), {}))
        P[f"sync{n}"] = (lambda n=n: (build_params(+1, n=n), {}))
        P[f"alt{n}_build_{HARDWARE}"] = (lambda n=n: (build_params(-1, machine=HARDWARE, n=n), {}))
        P[f"sync{n}_build_{HARDWARE}"] = (lambda n=n: (build_params(+1, machine=HARDWARE, n=n), {}))
        for base in (f"alt{n}", f"sync{n}"):
            for m in ("ibm_fez", "fake_fez"):
                P[f"{base}_{m}"] = (lambda b=base, mm=m, n=n: (readout_params(mm, n=n),
                                                                {"initial_circuit": circuit_asset(b)}))
    return P


if __name__ == "__main__":
    es = edges()
    print(len(es), "edges; degrees", sorted({sum(k in e for e in es) for k in range(N)}))
    for i, lay in enumerate(layers(es)):
        print("layer", i, lay)
    print("targets", len(build_params(1)["targets"]))
