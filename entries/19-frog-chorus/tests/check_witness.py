"""Classical check of every edge whose engine estimate of |<XX> + <YY>| exceeds 1. CLASSICAL verification.

For any separable two-qubit state |<XX> + <YY>| <= 1 (Cauchy-Schwarz on the two Bloch vectors, then
convexity), so a larger value witnesses entanglement of that pair. The engine's values are 1,024-shot
estimates; here we replay the engine's own returned circuit exactly (qiskit Statevector) for those edges
and record both numbers in out/witness_check.json. This is a check, not an engine output.
"""
import json
from pathlib import Path

from qiskit import qasm3
from qiskit.quantum_info import Pauli, Statevector

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "out"
rows = []
for d in json.loads((OUT / "pond.json").read_text(encoding="utf-8")):
    hits = [e for e in d["edges"] if abs(e["L"]) > 1]
    if not hits:
        continue
    rec = json.loads((OUT / f"qdrive_{d['name']}.json").read_text(encoding="utf-8"))
    sv = Statevector(qasm3.loads(rec["result"]["circuit"]))
    n = d["n"]
    for e in hits:
        def exact(p):
            s = ["I"] * n
            s[n - 1 - e["i"]] = s[n - 1 - e["j"]] = p
            return sv.expectation_value(Pauli("".join(s))).real
        ex = exact("X") + exact("Y")
        sigma = (2 / 1024) ** 0.5  # rough shot-noise scale of a sum of two 1,024-shot +/-1 estimates
        rows.append({"pond": d["name"], "job_id": d["job_id"], "edge": [e["i"], e["j"]], "layer": e["layer"],
                     "engine_estimate": e["L"], "exact_replay": round(ex, 4),
                     "sigma_beyond_1": round((abs(e["L"]) - 1) / sigma, 1)})
        print(rows[-1])
(OUT / "witness_check.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
