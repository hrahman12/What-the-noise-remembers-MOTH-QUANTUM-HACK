# Parameters — blur-v1 sweep (20 qubits)

Engine: **blur-v1 v1.1.9** (Atlas), classical statevector simulator.
Inputs: `image` = `intact.png` (1024×1024 PNG), `mask` = `mask.png` (white disk, r = 270 px, centre (580, 440)). Bounding box 541 px → ⌈log₂ 541⌉ × 2 = 20 qubits per pass.
Fixed at defaults: `size` = 1024, `downscale` = true, `mask_bin_size` = 4, `mask_min_region` = 16.

| strength | style | reach | job_id | status |
|---|---|---|---|---|
| 0.3 | rx | 0.0 | `293d1eab-c60e-45c6-861c-0ca577bc6600` | completed |
| 0.3 | rx | 1.0 | `503dbecb-ad36-49c7-a249-d7bf48c0e421` | completed |
| 0.3 | ry | 0.0 | `626a30d7-0a25-4362-bffc-53e5b17c7794` | completed |
| 0.3 | ry | 1.0 | `6a9f3ccd-ffd8-45e8-9812-7c85180b0f8d` | completed |
| 0.6 | rx | 0.0 | `ae326af2-6b1a-4740-a5e2-df1d03303d3b` | completed |
| 0.6 | rx | 1.0 | `5a2b9604-fac6-4aaf-9a38-50da7f588e8c` | completed |
| 0.6 | ry | 0.0 | `a9799da5-622a-451f-8184-538b21d14f73` | completed |
| 0.6 | ry | 1.0 | `c9ea8972-b017-4a07-9fb2-ab024b316a41` | completed |
| 1.0 | rx | 0.0 | `d6fa2e88-1f36-4701-b5eb-608e1bf8866c` | completed |
| 1.0 | rx | 1.0 | `c868dccb-e0e4-4b14-a101-943fb3d5d2d8` | completed |
| 1.0 | ry | 0.0 | `c5050cda-a591-462f-9d8a-838fffd1b033` | completed |
| 1.0 | ry | 1.0 | `991947d2-7401-47f8-8ccf-a4ecc9681ce0` | completed |

**Hero:** strength 1.0, style rx, reach 1.0 (`c868dccb-e0e4-4b14-a101-943fb3d5d2d8`).

The interactive version adds 18 more jobs (9 hole positions × 2 settings), listed in `web/positions.json`.
