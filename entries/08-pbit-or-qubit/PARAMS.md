# Parameters: every graph-v1 job (20 qubits each)

Engine: **graph-v1** (Atlas Quantum Graph Engine). `num_qubits` = 20, the engine maximum, reported back by every job as `num_qubits: 20`. `shots` = 20 for every job, because graph-v1 returns only its top 20 bitstrings; with 20 shots that list holds every shot.

Recipe (identical for emulator and hardware): 20 `bloch` targets `{X: 1}` (qubit in |+>), then one `relationship` target per edge `{ZZ: t}` with `fraction = (2/pi) asin|t|`, where t is the exact Boltzmann edge correlation for that J (problems.py). Edges are sent in breadth-first build order (problems.json). Hardware jobs add `mode: qpu`, `backend_name: ibm_fez`.

| graph | J | edges | where | backend | job_id | IBM job | shots back | mean edge corr (shots) | engine tomography |
|---|---|---|---|---|---|---|---|---|---|
| ring | 0.4 | 20 | emulator | aer | `baa86148-133b-4374-8c32-00020b24d4c4` | - | 20 | 0.39 +- 0.04 | 0.23 |
| ring | 0.4 | 20 | hardware | ibm_fez | `6b7a5915-34a7-473f-b94e-604018ac5591` | `db1jb1pb694s73dsc0tg` | 20 | 0.29 +- 0.04 | 0.23 |
| ring | 1.0 | 20 | emulator | aer | `cb5a9419-5e7f-4208-acae-9c8a7ce25e9b` | - | 20 | 0.76 +- 0.03 | 0.43 |
| ladder | 0.4 | 28 | emulator | aer | `68fe8996-9143-4dc7-93e2-52cab8943db0` | - | 20 | 0.46 +- 0.05 | 0.39 |
| ladder | 1.0 | 28 | emulator | aer | `91ce7ecd-cba3-4286-a92a-1f025149a04d` | - | 20 | 0.64 +- 0.04 | 0.48 |
| ladder | 1.0 | 28 | hardware | ibm_fez | `65da039d-0f27-4250-aa7f-b8003cbc983a` | `db1jb0avog1s73fi74h0` | 20 | 0.46 +- 0.04 | 0.48 |
| random | 0.4 | 30 | emulator | aer | `ca775471-64ec-46db-955d-113683dcdb50` | - | 20 | 0.37 +- 0.03 | 0.10 |
| random | 1.0 | 30 | emulator | aer | `8e431f87-f853-4c49-8789-9e4c5b0d45b4` | - | 20 | 0.59 +- 0.03 | 0.12 |

## Jobs that did not complete

| graph | J | where | job_id | what Atlas reported | credits |
|---|---|---|---|---|---|
| ring | 1.0 | qpu | `5d5ac18d-4f24-4c07-b448-b2d78c6ee6a2` | ibm_collection_failed: QPU job ended as cancelled | 5 (ledgered) |
| ladder | 1.0 | qpu | `837dae19-e175-4e0f-b20f-daee5b03d5ab` | ibm_collection_failed: QPU job ended as cancelled | 5 (ledgered) |
| random | 1.0 | qpu | `b1d47e77-1cf3-4924-a2e9-e4ab5c526496` | ibm_collection_failed: QPU job ended as cancelled | 5 (ledgered) |
| ring | 0.4 | qpu | `64974654-b115-428e-a3df-7fc9b6e5800e` | ibm_collection_failed: QPU job ended as cancelled | 5 (ledgered) |

## p-bits (THRML 0.1.4, CPU, classical)

`IsingEBM(nodes, edges, biases=0, weights=J_ij, beta=1)`, blocks from a graph colouring, 64 chains, 400 warm-up sweeps, 64 samples per chain 10 sweeps apart (4,096 samples), JAX key 2026.

| graph | J | colours | max abs edge error vs exact | mean edge corr | exact |
|---|---|---|---|---|---|
| ring | 0.4 | 2 | 0.035 | 0.373 | 0.380 |
| ring | 1.0 | 2 | 0.014 | 0.763 | 0.764 |
| ladder | 0.4 | 2 | 0.026 | 0.448 | 0.449 |
| ladder | 1.0 | 2 | 0.010 | 0.947 | 0.947 |
| random | 0.4 | 3 | 0.040 | 0.372 | 0.371 |
| random | 1.0 | 3 | 0.037 | 0.642 | 0.642 |

Ledgered spend for this piece: **60 credits** of a 60-credit cap (12 submissions at 5 credits).
