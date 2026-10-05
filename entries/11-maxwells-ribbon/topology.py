"""How many qubits did qpixl-v1 use on each chip? CLASSICAL check, written to data/topology.json.

qpixl-v1 does not report a qubit count. Its docs say it builds a "checkerboard lattice" on the chip:
data qubits whose neighbours are address qubits, each data qubit holding 2**(number of neighbours)
values, read out by "tiny (<= 4-qubit)" sub-circuits. On IBM's heavy-hex chips the coupling graph is
bipartite, so we 2-colour it and take the colour class with the larger sum of 2**degree as the data
qubits. That rule reproduces all three capacities measured on the live engine (insufficient_qubits
errors / successful full runs logged by entry 07): fake_fez 448, fake_brisbane 360, fake_torino 378.
At full capacity every address qubit is a neighbour of some data qubit, so the whole chip is in use.
Needs qiskit-ibm-runtime (already installed here) for the fake backends' coupling maps.
"""
import json
from collections import deque
from pathlib import Path

from qiskit_ibm_runtime.fake_provider import FakeBrisbane, FakeFez, FakeTorino

HERE = Path(__file__).resolve().parent
MEASURED = {"fake_fez": 448, "fake_brisbane": 360, "fake_torino": 378}


def lattice(backend):
    n = backend.num_qubits
    adj = {i: set() for i in range(n)}
    for a, b in backend.coupling_map.get_edges():
        adj[a].add(b)
        adj[b].add(a)
    col, dq = {0: 0}, deque([0])
    while dq:
        u = dq.popleft()
        for v in adj[u]:
            if v not in col:
                col[v] = 1 - col[u]
                dq.append(v)
            assert col[v] != col[u], "coupling graph is not bipartite"
    cap = [sum(2 ** len(adj[u]) for u in range(n) if col[u] == k) for k in (0, 1)]
    data_cls = 0 if cap[0] >= cap[1] else 1
    data = [u for u in range(n) if col[u] == data_cls]
    addr = sorted({v for u in data for v in adj[u]})
    return {"chip_qubits": n, "data_qubits": len(data), "address_qubits": len(addr),
            "qubits_used_at_capacity": len(data) + len(addr), "capacity_values": cap[data_cls],
            "max_group_qubits": 1 + max(len(adj[u]) for u in data)}


def main():
    out = {}
    for B in (FakeFez, FakeBrisbane, FakeTorino):
        b = B()
        info = lattice(b)
        info["measured_capacity"] = MEASURED[b.backend_name]
        info["rule_matches_measurement"] = info["capacity_values"] == info["measured_capacity"]
        out[b.backend_name] = info
        print(b.backend_name, info)
    out["ibm_fez"] = dict(out["fake_fez"], note="same Heron r2 coupling map as fake_fez")
    (HERE / "data" / "topology.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
