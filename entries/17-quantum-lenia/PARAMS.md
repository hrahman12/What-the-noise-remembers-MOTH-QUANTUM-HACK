# Parameters: every Atlas job for 17-quantum-lenia

Engine: **blur-core-v1** (Quantum Blur Core), 1 credit per run, Atlas **classical statevector simulator**
(exact probabilities, no `shots`). No QPU. Hardware backend: none. Qubit counts come from the engine's own
job status ("Recovered N-qubit grid from measurement", saved in `out/job_status.json`) and match the
documented rule (each axis padded to a power of two).

## Completed jobs (used on the page and in the film)

| # | Grid | Shape | strength | reach | style | axes | max_qubits | Qubits | Request bytes | Non-zero outputs | job_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | kernel bank | [4, 256, 256] | 0.5 | 0 | x | [1, 2] | 24 | 18 | 535,725 | 4,096 | `19d2ef47-9936-49b8-ac33-fdf3fd92ca60` |
| 2 | kernel bank | [4, 256, 256] | 0.25 | 0 | x | [1, 2] | 24 | 18 | 535,726 | 4,096 | `45d63aa5-5a73-44db-85b2-13ca300fc302` |
| 3 | kernel bank | [4, 256, 256] | 1.0 | 0 | x | [1, 2] | 24 | 18 | 535,725 | 4,096 | `511aa24c-205d-455e-ba12-ed0cb1a196fa` |
| 4 | world snapshot | 528 × 528 | 0.5 | 0 | x | all | 24 | 20 | 559,729 | 16,384 | `392b15b3-7eb2-4a9f-9283-9fb09e75a55c` |
| 5 | world snapshot | 528 × 528 | 0.25 | 0 | x | all | 24 | 20 | 559,730 | 16,384 | `284645e7-6f9c-4f2c-b1f1-c22cb66bdf9b` |

**Kernel bank values:** shells `ring` (Orbium's exponential core exp(4 − 1/(r(1−r)))), `bell` (Gaussian
ring, centre 0.5, width 0.15), `poly` ((4r(1−r))⁴) and `step` (1 on 1/4 ≤ r ≤ 3/4). Each has
R = 13, is centred on cell (128, 128), has peak 1 and is rounded to 5 decimals (`out/kernels/bank_input.npy`).

**Snapshot values:** `out/world.npy`. This is a 528×528 Lenia world: 6 Orbium in the 8 grid orientations
plus 40 classical steps, rolled on the torus so the colony sits in [0, 128)². It was quantised to
integers 0–99.

## Failed jobs (ledgered, not used)

| Grid | strength | reach | Qubits (engine) | Error | job_id |
|---|---|---|---|---|---|
| kernel bank [4, 256, 256] | 0.5 | 1 | 18 | [TMPRL1103] result payload over the platform limit | `95f0b491-2f30-4575-b890-2f3b70c7881b` |
| kernel bank [4, 256, 256] (retry) | 0.5 | 1 | 18 | [TMPRL1103] result payload over the platform limit | `0c641ba0-11e4-4af0-ab62-abe905dda3e5` |
| snapshot attempt 1 (22 Orbia spread over 528×528, `out/world_attempt1.npy`) | 0.5 | 0 | 20 | [TMPRL1103] result payload over the platform limit | `a8a739fb-daa2-4675-99e6-2447c32a179a` |

Credits: 8 jobs × 1 credit = **8 of the 8-credit cap** (`Atlas.spent()`).

## Free probes (no job created, no credit)

Invalid `style: "z"` → 422 for a 4×4 grid. HTTP 413 "request body is too large limit=1048576 bytes" for
1024×1024 and 4096×4096 grids of zeros. The 2048×2048 probe dropped the connection (SSL EOF), with no job created.

## Classical settings (page, film, measurements)

Lenia: R = 13, T = 10 (dt = 0.1), μ = 0.15, σ = 0.015, Gaussian growth 2·exp(−(u−μ)²/2σ²) − 1, torus,
FFT convolution. World 256×256 in the browser and the film. Snapshot seeds use the 128×128 corner,
centred at [64, 192)².
