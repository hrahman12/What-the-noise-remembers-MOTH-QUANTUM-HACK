# Parameters: every Atlas job of Frog Chorus

Engines: **qdrive-api-v1** (Atlas, 1 credit per run) builds the chorus data. Every completed qdrive job ran on `machine = "aer"`, Atlas's Aer simulator (a noiseless classical simulation of the circuit; expectation values are 1,024-shot estimates). qdrive accepted no other machine: asked for `ibm_fez` three times (the last on 5 October 2026, the full 22-qubit build) it failed with "not wired up yet" (see the failed rows).

**graph-v1** (Atlas, 5 credits per run) gives the pond its real-hardware counterpart: `mode = "qpu"`, `backend_name = "ibm_fez"`, 20 qubits (graph-v1's ceiling), and the engine reports `backend: "ibm_fez"` (IBM job `db1q0d9b694s73dslgv0`). Its twin with identical parameters on graph-v1's Aer emulator is the deliberate noiseless baseline.

Ledgered spend: **21 credits** of the 22-credit cap (13 ledgered jobs; the cap is the 10 credits spent on the first build plus a 12-credit allowance for the ibm_fez redo).

## Completed jobs (qdrive-api-v1, Atlas Aer simulator)

| name | used for | qubits (how known) | lock asked | targets / updates / layers | shots, tomography, sample | seed | job_id |
|---|---|---|---|---|---|---|---|
| probe3 | format probe (not in the page) | **3** (QASM `qubit[3]`, 3-qubit Pauli keys) | XX=YY=-1 on (0,1), +1 on (1,2) | 4 / 1 / - | 1024, 2, True | 7 | `1a5c3e5e-4132-415a-84b9-c3015e2bbc94` |
| alt20 | the page (alternating pond) | **20** (QASM `qubit[20]`, 20-qubit Pauli keys) | <XX>=<YY>=-0.7 on 27 edges | 50 / 3 / 3 | 1024, 2, True | 19 | `bdedb3ba-073f-49c8-ab9c-feccb3dea289` |
| sync20 | the page (sync pond) | **20** (QASM `qubit[20]`, 20-qubit Pauli keys) | <XX>=<YY>=+0.7 on 27 edges | 50 / 3 / 3 | 1024, 2, True | 19 | `4f7f0541-4d1d-4c36-ab8d-b8afc44570d6` |
| alt22 | the page, WAVs (alternating pond) | **22** (QASM `qubit[22]`, 22-qubit Pauli keys) | <XX>=<YY>=-0.7 on 29 edges | 54 / 3 / 3 | 1024, 2, True | 19 | `8ece2a2c-4035-4d0c-950c-5174a228b2d4` |
| sync22 | the page, WAVs (sync pond) | **22** (QASM `qubit[22]`, 22-qubit Pauli keys) | <XX>=<YY>=+0.7 on 29 edges | 54 / 3 / 3 | 1024, 2, True | 19 | `85baf230-d490-48fe-9825-86ea5f1015b6` |

## Real hardware: graph-v1 on IBM ibm_fez (and its emulator baseline)

| name | used for | qubits (how known) | backend (reported by the engine) | operations | shots | job_id | IBM job | pairs taking turns per night (of 27) |
|---|---|---|---|---|---|---|---|---|
| turns20_ibm_fez | the page: the 20 ibm_fez nights, both hardware charts | **20** (`num_qubits` echoed by the engine, 20-character bitstrings) | `ibm_fez` (IBM hardware) | 20 Bloch X = 1, then ZZ = -0.7 (fraction 0.4936) on 27 edges | 20 (every shot returned) | `6f175600-338d-4814-946d-b1da067312af` | `db1q0d9b694s73dslgv0` | 17.80 +/- 0.43 |
| turns20_emu | the page: noiseless baseline | **20** (`num_qubits` echoed by the engine, 20-character bitstrings) | `aer` (Aer emulator) | 20 Bloch X = 1, then ZZ = -0.7 (fraction 0.4936) on 27 edges | 20 (every shot returned) | `af1641e9-f45d-4359-bcc6-f176b60ae55f` | - | 19.95 +/- 0.30 |

## Failed jobs (ledgered, 1 credit each)

| name | engine | qubits | machine | job_id | Atlas error |
|---|---|---|---|---|---|
| alt20_ibm_fez | qdrive-api-v1 | 20 | ibm_fez | `35c1e8df-5bb1-491f-a41a-c7ebc53d8462` | failed: invalid_machine: machine 'ibm_fez' is reserved for a future IBM Quantum Runtime backend (qiskit_ibm_runtime.QiskitRuntimeService + EstimatorV2/SamplerV2 in job mode); not wired up yet |
| alt20_ibm_fez | qdrive-api-v1 | 20 | ibm_fez | `fa5a9846-b5b4-4d32-aff2-60287d9a5c2a` | failed: invalid_machine: machine 'ibm_fez' is reserved for a future IBM Quantum Runtime backend (qiskit_ibm_runtime.QiskitRuntimeService + EstimatorV2/SamplerV2 in job mode); not wired up yet |
| alt24 | qdrive-api-v1 | 24 | aer | `b622182d-99d7-461f-bc98-f9384088ffe3` | failed: engine_timeout: The engine did not respond in time — retry the job |
| alt20_fake_fez | qdrive-api-v1 | 20 | fake_fez | `84cded51-1a1e-43f7-a24e-de1e92cac207` | failed: invalid_machine: unknown machine 'fake_fez'; expected one of ('aer',) |
| alt24 | qdrive-api-v1 | 24 | aer | `f2ee8aa2-5ebd-406d-95b1-0838f49a3272` | failed: engine_timeout: The engine did not respond in time — retry the job |
| alt22_build_ibm_fez | qdrive-api-v1 | 22 | ibm_fez | `b4a7e89a-2ffd-41c8-a7b2-79e8500b7924` | failed: invalid_machine: machine 'ibm_fez' is reserved for a future IBM Quantum Runtime backend (qiskit_ibm_runtime.QiskitRuntimeService + EstimatorV2/SamplerV2 in job mode); not wired up yet |

Two earlier submissions of `alt20_ibm_fez` that referenced the circuit as `job:<id>/circuit` were rejected with HTTP 422 ("must be an asset UUID") before any job existed. They were not ledgered and cost nothing.

## Fixed choices (classical, `pond.py`)

* Pads: 22 (default) or 20, one qubit each (24 was tried and timed out), around an oval bank. Hearing graph: the bank ring, inlet chords (k, k+2) for k = 1, 5, 9, ... and two chords across the water (4, n-4) and (6, n-6). Max degree 3; edges split into 3 layers of disjoint pairs by greedy edge colouring.
* Requested phases: golden angle, phi_k = k * 137.508 deg, as single-qubit targets <X> = cos phi, <Y> = sin phi.
* Lock request per edge: <XX> = <YY> = s * 0.7 (s = -1 alternating, +1 sync), so <XX>+<YY> = s * 1.4.
* Target list: all single-qubit targets, then for each layer an `update()` (null entry) followed by that layer's pair targets.

## Fixed choices for the ibm_fez counterpart (classical, `run_graph_fez.py`)

* The 20-pad pond (graph-v1's ceiling is 20 qubits), the same 27 hearing edges as `coupling_map`.
* Every qubit first gets a Bloch target X = 1 (|+>): on its own, a frog is equally likely to be heard calling (1) or silent (0).
* Every hearing edge then gets a relationship target ZZ = -0.7 (the same 0.7 the qdrive build asks of XX and of YY, with the 'take turns' sign), rotation fraction (2/pi) asin(0.7) = 0.4936, in breadth-first build order from pad 0 (chosen with a classical re-implementation of QuantumGraph's rules, a design aid that is never shown as engine output).
* shots = 20: graph-v1 returns only its top 20 bitstrings, so 20 shots is the most for which the list holds every shot.
* graph-v1 measures only in Z, so this run hears who calls, not the XX + YY phase locks. Its nights only seat frogs on the page.

## Results used by the instrument

| pond | qubits | job_id | mean <XX>+<YY> (all edges) | last layer | edges with abs > 1 | mean Bloch r | distinct shots |
|---|---|---|---|---|---|---|---|
| alt20 | 20 | `bdedb3ba-073f-49c8-ab9c-feccb3dea289` | -0.197 | -0.765 | 0 | 0.140 | 1021 |
| sync20 | 20 | `4f7f0541-4d1d-4c36-ab8d-b8afc44570d6` | +0.104 | +0.550 | 0 | 0.092 | 1021 |
| alt22 | 22 | `8ece2a2c-4035-4d0c-950c-5174a228b2d4` | -0.260 | -0.753 | 1 | 0.146 | 1024 |
| sync22 | 22 | `85baf230-d490-48fe-9825-86ea5f1015b6` | +0.179 | +0.364 | 1 | 0.070 | 1023 |

Entanglement-witness check (`tests/check_witness.py`, classical): for unentangled pairs |<XX>+<YY>| <= 1. Edges whose engine estimate exceeds 1, with an exact qiskit replay of the engine's own returned circuit:

| pond | edge | layer | engine estimate (1,024 shots) | shot-noise widths past 1 | exact replay |
|---|---|---|---|---|---|
| alt22 | 0-21 | 2 | -1.315 | 7.1 | -1.348 |
| sync22 | 0-21 | 2 | +1.337 | 7.6 | +1.442 |

Real-hardware counterpart (graph-v1, 20 qubits, 20 shots each). Pairs taking turns = hearing pairs with one frog calling and the other silent in a shot, of 27. Classical references: coin flips 13.5, best any night can do 22 (brute-force maximum cut; each of the five inlet triangles leaves a pair out of turn).

| run | backend | job_id | mean +/- s.e. | lowest / highest night | mean P(calling) |
|---|---|---|---|---|---|
| turns20_ibm_fez | `ibm_fez` | `6f175600-338d-4814-946d-b1da067312af` | 17.80 +/- 0.43 | 15 / 21 | 0.49 |
| turns20_emu | `aer` | `af1641e9-f45d-4359-bcc6-f176b60ae55f` | 19.95 +/- 0.30 | 18 / 22 | 0.50 |

graph-v1 rebuilds the circuit for every job: the noiseless tomography it reports for the two jobs differs by more than 0.05 on 9 of 27 edges (ZZ itself on 5-6, 8-9, 5-7) and on qubits 6, 7, so the baseline is the same recipe, not a guaranteed copy of the hardware circuit. That reported tomography also disagrees with the engine's own noiseless shots, so the page compares shots with shots.

## WAV examples (classical renders of the chorus model with the engine data)

| file | pond data | couplings | K ramp | tempo, individuality | final in-step R / taking turns |
|---|---|---|---|---|---|
| `out/wav/alt22_engine.wav` | alt22 (`8ece2a2c-4035-4d0c-950c-5174a228b2d4`) | engine | 0 to 8.0 rad/s | 2.0 calls/s, +/-4 % | 0.05 / 0.73 |
| `out/wav/alt22_asked.wav` | alt22 (`8ece2a2c-4035-4d0c-950c-5174a228b2d4`) | asked | 0 to 4.0 rad/s | 2.0 calls/s, +/-4 % | 0.06 / 0.87 |
| `out/wav/sync22_engine.wav` | sync22 (`85baf230-d490-48fe-9825-86ea5f1015b6`) | engine | 0 to 12.0 rad/s | 2.0 calls/s, +/-4 % | 0.42 / 0.34 |
| `out/wav/sync22_asked.wav` | sync22 (`85baf230-d490-48fe-9825-86ea5f1015b6`) | asked | 0 to 4.0 rad/s | 2.0 calls/s, +/-4 % | 1.00 / 0.00 |
