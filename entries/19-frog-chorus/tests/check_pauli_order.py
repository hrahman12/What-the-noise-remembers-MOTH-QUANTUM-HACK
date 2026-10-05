"""Check qdrive's Pauli-key and bitstring order by replaying the probe's own returned circuit. CLASSICAL check.

The engine's `measured` keys (e.g. "IIX") could put qubit 0 on the left or the right. We load the probe
job's returned QASM with qiskit, compute exact expectation values both ways, and see which matches the
engine's 1,024-shot estimates. Nothing here is presented as engine output; it only fixes the convention
extract.py uses (qubit 0 = rightmost character, the Qiskit convention).
"""
import json
import sys
from pathlib import Path

from qiskit import qasm3
from qiskit.quantum_info import Pauli, Statevector

HERE = Path(__file__).resolve().parent
r = json.loads((HERE.parent / "out" / "qdrive_probe3.json").read_text(encoding="utf-8"))["result"]
sv = Statevector(qasm3.loads(r["circuit"]))
m = {k: v for k, v in r["measured"].items() if set(k) != {"I"}}
err_right = max(abs(v - sv.expectation_value(Pauli(k)).real) for k, v in m.items())
err_left = max(abs(v - sv.expectation_value(Pauli(k[::-1])).real) for k, v in m.items())
print(f"max |engine - exact|: qubit 0 rightmost {err_right:.3f}, qubit 0 leftmost {err_left:.3f}")
probs = sv.probabilities_dict()
tv = 0.5 * sum(abs(c / 1024 - probs.get(b, 0)) for b, c in r["counts"].items())
print(f"counts vs exact (qubit 0 rightmost): total variation {tv:.3f}")
ok = err_right < 0.15 < err_left and tv < 0.08
print("PASS: qubit 0 is the rightmost character" if ok else "FAIL")
sys.exit(0 if ok else 1)
