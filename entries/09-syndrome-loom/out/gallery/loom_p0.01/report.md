# Syndrome Loom report

- Input: `C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\entries\09-syndrome-loom\demo\moth.png` binarised to 32 x 24 pixels (Otsu threshold)
- Cloth: 224 warp ends x 168 picks (24 bands of 6 code picks + 1 red syndrome pick)
- Noise: p = 0.01, profile `loom` (noisy loom: every gate, idle step and readout is noisy)
- View: `received`, codewords: `plain`, seed: 1
- Engine: `tamagotchi-v1` (code `steane`), Qiskit Aer stabilizer simulator on Atlas (no QPU)

## Logical vs physical flip rates per p (measured by the engine)

Physical p is the per-operation fault probability fed to the engine's noise model. The logical flip rate is the engine's `logical_error_rate` averaged over all logical qubits (one Steane block each). Syndrome events per block = `syndromes_detected / (shots x n_logical)`. The engine counts a nonzero bit-flip syndrome and a nonzero phase-flip syndrome as separate events (up to 2 per block), so the loom draws bit-flip syndromes at half that rate, assuming the two types are equally likely. The per-thread rate is inferred, not measured: `1 - (1 - events/2)^(1/7)`.

**Profile `loom`: noisy loom: every gate, idle step and readout is noisy.** Noise mapping: `p_1q = p_gate = p_idle = p_meas = p`.

| physical p (per operation) | n_logical | data qubits (7 x n) | shots | block samples | logical flip rate, 1 SE round | logical flip rate, no SE round | syndrome events per block (X+Z) | per-thread flip rate (inferred) | logical vs physical | SE job | no-SE job |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.001 | 256 | 1792 | 64 | 16,384 | 0.763 % | 0.336 % | 0.0656 | 0.475 % | logical > p: the code hurts here | `00747c70-eaa2-400d-9b71-7f9d5ea2008d` | `065612b5-7863-45f1-88a9-a918f5433297` |
| 0.005 | 256 | 1792 | 64 | 16,384 | 4.06 % | 2.00 % | 0.3148 | 2.42 % | logical > p: the code hurts here | `7a9ce534-2768-4c98-87b4-0c1ab4e939c3` | `38e46cd7-579a-4332-a9bd-810a5a2864df` |
| 0.01 | 256 | 1792 | 64 | 16,384 | 8.84 % | 4.49 % | 0.5773 | 4.75 % | logical > p: the code hurts here | `a5ca0dfd-dba3-48f7-a61c-ccdbf35cfc1d` | `6ce56245-be91-49b5-9766-d5ccfa972187` |

**Profile `thread`: fraying thread: only stored threads (idle) and readout are noisy, the loom's gates are clean.** Noise mapping: `p_idle = p_meas = p; p_1q = p_gate = 0`.

| physical p (per operation) | n_logical | data qubits (7 x n) | shots | block samples | logical flip rate, 1 SE round | logical flip rate, no SE round | syndrome events per block (X+Z) | per-thread flip rate (inferred) | logical vs physical | SE job | no-SE job |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.001 | 256 | 1792 | 64 | 16,384 | 0.012 % | 0.000 % | 0.0109 | 0.078 % | logical < p: the code helps | `2b720144-23fa-4eb6-a0c8-091b05f2c038` | `fc6aa200-c7fa-4257-9d6a-b7c54028238d` |
| 0.005 | 256 | 1792 | 64 | 16,384 | 0.153 % | 0.037 % | 0.0627 | 0.454 % | logical < p: the code helps | `7f22c6d3-c544-4f0c-a5bb-1f06bbc11677` | `4be3d79b-653f-458e-be93-563dd1751e13` |
| 0.01 | 256 | 1792 | 64 | 16,384 | 0.555 % | 0.183 % | 0.1247 | 0.915 % | logical < p: the code helps | `70161217-2606-4ee1-a43c-a042bd44b3c0` | `78350aec-f9a4-4ba7-bcd8-3e0674cec551` |

## This weave

Each pixel's events are sampled with mulberry32 from the three measured numbers for this p (classical sampling; the engine reports aggregate counts, not per-shot records, so the two events are drawn independently).

| quantity | engine rate used | expected in this cloth | drawn in this cloth |
|---|---|---|---|
| bit-flip syndromes (red stitches) | s = 0.2886 per block (half the engine's X+Z count) | 221.7 | 204 of 768 blocks |
| logical flips (pixels inverted after correction) | L0 = 8.50 %, L1 = 9.18 % | 67.5 | 65 of 768 pixels |
| threads read flipped before correction | from s | 221.7 | 204 of 5376 threads (3.79 %) |

## What ran where

| step | where | kind |
|---|---|---|
| Steane encoding, transversal gates, one syndrome-extraction round with in-circuit correction, readout, under noise p | Atlas `tamagotchi-v1`, Aer stabilizer simulator | quantum circuit, simulated |
| Binarise the image, pick codewords, sample flips and syndromes from the measured rates, Hamming decode, WIF, render | this package (`loom`) | classical |

No quantum hardware was used. The loom does not run a circuit per pixel: it reuses the engine's measured rates. See README.md for the full honesty notes.
