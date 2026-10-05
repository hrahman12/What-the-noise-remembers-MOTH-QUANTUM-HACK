# Parameters and jobs: tamagotchi-v1

Engine: **Atlas `tamagotchi-v1`** (Steane code, `code = "steane"`), Qiskit Aer **stabilizer simulator** (`method = "stabilizer"`). No QPU mode, no hardware. 0 credits per run; every job is ledgered under piece `09-syndrome-loom` (credit cap 5).

Qubits: 7 physical data qubits per Steane logical qubit (computed from the code; the engine reports `n_logical`). The engine also allocates ancillas for syndrome extraction but does not document how many, so they are not counted.

## Calibration grid (used by the loom)

n_logical = 256 (1792 data qubits), shots = 64, seed = 2026. Pattern: X on odd-indexed logicals (stored bit 1), even-indexed stay 0. `se` = actions end with one `["SE", [0..n-1]]` round (syndrome extraction + in-circuit correction on every logical); `bare` = the same circuit without it.

| profile | noise params | p | SE round | logical error rate | syndrome events / block (X+Z) | wall s | job_id |
|---|---|---|---|---|---|---|---|
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.001 | yes | 0.763 % | 0.0656 | 208 | `00747c70-eaa2-400d-9b71-7f9d5ea2008d` |
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.001 | no | 0.336 % | 0.0000 | 20 | `065612b5-7863-45f1-88a9-a918f5433297` |
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.005 | yes | 4.06 % | 0.3148 | 217 | `7a9ce534-2768-4c98-87b4-0c1ab4e939c3` |
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.005 | no | 2.00 % | 0.0000 | 20 | `38e46cd7-579a-4332-a9bd-810a5a2864df` |
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.01 | yes | 8.84 % | 0.5773 | 259 | `a5ca0dfd-dba3-48f7-a61c-ccdbf35cfc1d` |
| loom | `p_1q = p_gate = p_idle = p_meas = p` | 0.01 | no | 4.49 % | 0.0000 | 21 | `6ce56245-be91-49b5-9766-d5ccfa972187` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.001 | yes | 0.012 % | 0.0109 | 250 | `2b720144-23fa-4eb6-a0c8-091b05f2c038` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.001 | no | 0.000 % | 0.0000 | 23 | `fc6aa200-c7fa-4257-9d6a-b7c54028238d` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.005 | yes | 0.153 % | 0.0627 | 215 | `7f22c6d3-c544-4f0c-a5bb-1f06bbc11677` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.005 | no | 0.037 % | 0.0000 | 22 | `4be3d79b-653f-458e-be93-563dd1751e13` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.01 | yes | 0.555 % | 0.1247 | 215 | `70161217-2606-4ee1-a43c-a042bd44b3c0` |
| thread | `p_idle = p_meas = p; p_1q = p_gate = 0` | 0.01 | no | 0.183 % | 0.0000 | 22 | `78350aec-f9a4-4ba7-bcd8-3e0674cec551` |

## Size ladder (how far one job stretched)

p = 0.005 on every channel, X on odd logicals, one SE round on all, seed 11.

| n_logical | data qubits (7 x n) | shots | wall s (submit to done) | logical error rate | job_id |
|---|---|---|---|---|---|
| 64 | 448 | 1024 | 75 | 4.30 % | `97400f96-2c85-410a-b20f-2e8452eee025` |
| 128 | 896 | 1024 | 473 | 4.34 % | `1dd2fd92-a57a-4dba-9918-bca80117cb0f` |
| 256 | 1,792 | 1024 | 3788 | 4.28 % | `0833a836-e2f0-4b45-a4b9-c42ad31140e4` |
| 512 | 3,584 | 8 | 233 | 4.32 % | `7ea460be-3e71-4511-bfda-e2740171662a` |

Still running at write-up (not used, not counted): n_logical = 1024 (7,168 data qubits), 2 shots, job `191803b3-afb4-4706-bfb6-0b5eea975c85`, submitted 06:43 UTC on 5 Oct 2026. Re-running `engine/run_calibration.py` resumes it.

## Probes (reading the engine's semantics)

Small jobs used to learn what the output fields mean (n_logical 1-2, 2000-8000 shots). Listed in `engine/probe_jobs.json`.

| probe | actions | noise | logical errors | syndromes_detected | shots | job_id |
|---|---|---|---|---|---|---|
| storage_se_p1e-2_n2 | `[["X", 0], ["SE", [0, 1]]]` | p_idle=0.01, p_meas=0.01 | 47 | 1020 | 4000 | `185a6cc1-4eda-4566-ac04-82f2c91d4403` |
| storage_nose_p1e-2_n2 | `[["X", 0]]` | p_idle=0.01, p_meas=0.01 | 19 | 0 | 4000 | `4986e54c-ee57-403e-bb1c-ea99fb76ff1d` |
| idleonly_nose_n1 | `[["I", 0]]` | p_idle=0.05 | 104 | 0 | 8000 | `4fdb76d3-6f61-43c0-8a12-f58923d21ba2` |
| idleonly_nose3_n1 | `[["I", 0], ["I", 0], ["I", 0]]` | p_idle=0.05 | 587 | 0 | 8000 | `5ffa3912-3990-43dc-96c9-f4c9b69f16b2` |
| x0_se_p1e-2_n2 | `[["X", 0], ["SE", [0, 1]]]` | p_1q=0.01, p_gate=0.01, p_idle=0.01, p_meas=0.01 | 706 | 4704 | 4000 | `a2ae2fd0-fc13-4f34-8004-d087494dd402` |
| x0_nose_p1e-2_n2 | `[["X", 0]]` | p_1q=0.01, p_gate=0.01, p_idle=0.01, p_meas=0.01 | 351 | 0 | 4000 | `7d3ac067-83b7-40be-b29f-5f5ded1d9f05` |
| x0_se_p1e-2_n1 | `[["X", 0], ["SE", 0]]` | p_1q=0.01, p_gate=0.01, p_idle=0.01, p_meas=0.01 | 374 | 2435 | 4000 | `e09f1ad6-e02d-4538-9a2b-aa3e3f2a38fb` |
| x0_se2_p1e-2_n1 | `[["X", 0], ["SE", 0], ["SE", 0]]` | p_1q=0.01, p_gate=0.01, p_idle=0.01, p_meas=0.01 | 540 | 4741 | 4000 | `5ff946b5-5b66-44e1-a3d5-f57f9dfc747d` |
| measonly_nose_n1 | `[["I", 0]]` | p_meas=0.01 | 15 | 0 | 8000 | `ec9d1a99-b0f1-4e1f-bd91-200809cf4c84` |
| measonly_se_n1 | `[["SE", 0]]` | p_meas=0.01 | 31 | 501 | 8000 | `96752e57-f5e0-4c96-a9f0-757c77387b75` |
| idleonly_se_n1 | `[["SE", 0]]` | p_idle=0.01 | 5 | 480 | 8000 | `adf02dfe-fa03-4827-b58f-9dc39a6b076e` |
| gateonly_se_n1 | `[["SE", 0]]` | p_gate=0.01 | 625 | 3528 | 8000 | `808484ff-c98e-4a50-b953-18e51a698445` |
| 1qonly_nose_n1 | `[["I", 0]]` | p_1q=0.01 | 0 | 0 | 8000 | `8c38fc43-650c-4a97-942a-a3342d9a2c57` |
| measonly_se_p0.5_n1 | `[["SE", 0]]` | p_meas=0.5 | 998 | 3514 | 2000 | `adb1f47e-203d-4b43-90bd-dbbb2514d71a` |

Ledgered submissions that did not complete (0 credits, not counted): `97ce4646-27f1-40ca-ba12-9adb381e8e1a` (deliberately invalid `code` to read the registry; the error lists only `steane`); `7ef8fb38-4016-4b5a-888c-9e27cabb0567`, `780ffeb1-7e78-44c9-9d55-ffb19768a63f`, `353c7c61-4e2f-452c-b0ad-dbf59a2da798` (engine_timeout while the engine was busy with the n=256 job; the same probes were resubmitted and completed above).
