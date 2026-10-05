Quantum Graph Engine — prepare a quantum graph state and sample it.

You describe a graph: which qubits are coupled (`coupling_map`, defaulting to
fully connected) and what state to prepare on it (`operations` — single-qubit
Bloch targets and two-qubit Pauli correlations, applied in order). The engine
prepares that state, returns its exact tomography (per-qubit Bloch vectors and
per-edge two-qubit expectation values), samples it (locally or on IBM
hardware), and scores the dominant outcome against the graph's edges. Omit
graph and operations and it demos itself with a random (seedable) state.

Built on [QuantumGraph](https://github.com/moth-quantum/QuantumGraph).

## What you send

`application/json`:

```json
{
  "num_qubits": 4,
  "coupling_map": [[0, 1], [1, 2], [2, 3]],
  "operations": [
    {"type": "bloch", "qubit": 0, "paulis": {"X": 1.0}},
    {"type": "relationship", "qubits": [0, 1], "paulis": {"ZZ": 1.0}}
  ],
  "shots": 1024,
  "mode": "emu"
}
```

- **`coupling_map`** *(optional)* — the graph edges as qubit pairs. Omit for a
  fully connected graph.
- **`operations`** *(optional)* — state-preparation targets, applied in order.
  `"bloch"` sets single-qubit Pauli expectation targets on one qubit;
  `"relationship"` sets two-qubit targets (e.g. `ZZ`) on a coupled pair, which
  must be a `coupling_map` edge. Each operation's `update` flag (default true)
  refreshes the tracked state so later operations account for earlier ones;
  set it false for a faster, blind application. Omit `operations` entirely for
  a random state — every qubit gets a random Bloch vector and every edge a
  random ±1 ZZ correlation.
- **`seed`** — fixes the random state when `operations` is omitted: the same
  seed always builds the same circuit, so you can compare `emu` and `qpu` runs
  on identical states.
- **`mode`** — `"emu"` (local simulator, noiseless, seconds) or `"qpu"`
  (IBM hardware, real noise, queue can be minutes–hours; requires
  `qpu_token` and `qpu_instance`).

Remaining parameters (`num_qubits`, `shots`, `backend_name`) are documented in
the request schema below.

## What you get back

- **`output.tomography`** — the exact prepared state, before any sampling:
  `bloch` (per-qubit `{X, Y, Z}` expectation values) and `relationships`
  (per-edge two-qubit Pauli expectation values, keyed `"a,b"`). Computed
  classically at build time, so it is noise-free even on QPU runs — compare it
  against the sampled counts to see what the hardware did.
- **`output.measurements`** — the top 20 bitstrings with count and
  probability — plus `dominant_bitstring` and `edge_agreement_score`: the
  fraction of graph edges whose two bits agree in the dominant bitstring.
- The resolved `coupling_map` is echoed back so both are interpretable
  without the request.

---

## Pipeline (internal)

  build   → graph from coupling_map (default fully connected) → operations or
             random (seeded) targets → capture exact tomography → QASM bytes
  submit  → EMU: run Aer locally → counts │ QPU: transpile + submit to IBM → job_id
  collect → EMU: passthrough │ QPU: poll IBM until done → counts
  format  → rank bitstrings, score edge agreement → final output

Bitstring convention: submit/collect reverse Qiskit's qubit-0-rightmost counts
to qubit-0-LEFTMOST before returning — index i of a bitstring addresses
qubit i directly.
input_files None
output_files None
spent 0.0
