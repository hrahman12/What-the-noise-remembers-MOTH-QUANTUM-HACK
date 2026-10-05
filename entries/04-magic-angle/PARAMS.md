# Parameters: telablur-v1 twist sweep (21 qubits per job)

Engine: **telablur-v1** (Atlas, Quantum Teleblur), classical statevector simulator. Backend for every job: Atlas simulator (the engine has no hardware mode and reports no backend or qubit count).

Qubits: every job uses a 1024 x 1024 image with no mask, so the region is the whole frame: log2(1024) + log2(1024) = 20 pixel qubits, plus 1 selector qubit = **21**. This is computed from the engine's documented rule (`size` = 1024 is the per-pass maximum), not reported by the engine.

Inputs: `image1` = honeycomb layer A at theta0 - theta/2, `image2` = layer B at theta0 + theta/2 (`inputs/A_r<theta0>_<theta>.png`, `inputs/B_r<theta0>_<theta>.png`, made by `lattice.py`, a = 8 px). Fixed params: `direction` = full, `size` = 1024, `downscale`, `mask_bin_size`, `mask_min_region` at defaults.

Credits: 1 per job, 49 jobs, 49 credits of the 50-credit cap. No job failed.

## Probes at theta = 1.10 deg (5 jobs)

| strength | theta0 | job_id | seconds | note |
|---|---|---|---|---|
| 0.5 | 0 | `4857f978-0fcf-4fb9-88f9-2086e4913dac` | 9.8 | timing frame (9.8 s at 1024 px, 21 qubits). A 4 px register pattern dominates; the lattice is gone. |
| 0.1 | 0 | `c36f717d-0df6-4b5e-81ed-87776a6ca0bb` | 20.8 | honeycomb visible, but with a symmetric twist B is the mirror of A, so 'B' peaks may be mirror copies. |
| 0.25 | 0 | `96779332-e7a5-4dcf-a803-632a43b5e7eb` | 21.8 | speckle; same mirror ambiguity. |
| 0.1 | 15 | `e221d40c-ee68-4e2f-91ed-f6aee92c1083` | 13.4 | honeycomb visible, but layer B is weak; the mirror copy of A is 30x stronger than true B (Bragg power B/A = 0.02; A alone leaks 0.001). |
| 0.25 | 15 | `47a90588-995e-4df7-80cf-905dfd9261ee` | 11.4 | speckle; layer B clearly present. Chosen for the sweep (this job is also the 1.10 deg frame) (Bragg power B/A = 0.34; A alone leaks 0.001). |

## Sweep: strength 0.25, theta0 = 15 deg (45 jobs)

Measured period (classical FFT of the output, see `measure.py`): status `ok` = tracks the twist, `null` = same split as the untwisted frame (register echo), `unresolved` = no pair beyond the resolution limit.

| theta (deg) | job_id | seconds | L predicted (px) | L from morph (px) | status |
|---|---|---|---|---|---|
| 0.00 | `aeef00f2-197d-468a-89bd-60ceaa409757` | 21.9 | inf | 402.8 | null |
| 0.10 | `92cd1f79-f092-4a81-a17f-206f67f9bcef` | 23.1 | 4583.7 | 400.6 | null |
| 0.20 | `0dc3bc1a-db3e-468a-baa0-6112652a68dd` | 23.3 | 2291.8 | - | unresolved |
| 0.30 | `1e0775c5-4d66-4264-b404-05cc4ee7100c` | 22.1 | 1527.9 | - | unresolved |
| 0.40 | `b89cf022-faf7-4677-a814-bde0b55fafe1` | 17.0 | 1145.9 | - | unresolved |
| 0.50 | `475df33b-f200-47c0-8090-6c2775afd621` | 17.9 | 916.7 | - | unresolved |
| 0.60 | `944be243-525c-4a8c-af8e-51562a38e3c5` | 22.0 | 764.0 | - | unresolved |
| 0.70 | `4616a314-692c-426f-a373-eb2ea7439156` | 22.0 | 654.8 | - | unresolved |
| 0.80 | `482b1cd7-ecfa-4537-a5ca-39bb87c2bc8f` | 17.8 | 573.0 | - | unresolved |
| 0.90 | `cb760d12-2d04-4e97-9a1c-2ae0dc3ea2b1` | 18.5 | 509.3 | - | unresolved |
| 0.95 | `a703bdfe-d324-4b8d-81dc-3f82881da9d4` | 27.4 | 482.5 | - | unresolved |
| 1.00 | `dadb271f-6c19-4536-bad4-59d6e7681b08` | 30.2 | 458.4 | 614.3 | ok |
| 1.05 | `ace9babc-f957-43f7-aab3-cfcb4ca2c35c` | 18.9 | 436.6 | 380.5 | null |
| 1.10 | `47a90588-995e-4df7-80cf-905dfd9261ee` | 11.4 | 416.7 | 378.7 | null |
| 1.15 | `c50cfc59-345c-4ab7-b39a-740937e56648` | 20.8 | 398.6 | 377.4 | null |
| 1.20 | `a2f114f6-7c1c-48b5-95fb-29f0cb2c2875` | 24.4 | 382.0 | 379.5 | null |
| 1.25 | `aa399415-f87b-4346-8db8-6fa8bf72e8ec` | 19.1 | 366.7 | 381.2 | null |
| 1.30 | `122ab53f-3f73-4763-8655-744441da0ec1` | 28.3 | 352.6 | 381.6 | null |
| 1.40 | `a90692ab-eeca-47b7-a46f-988a2b605dea` | 17.0 | 327.4 | 372.5 | null |
| 1.50 | `7f98d39e-c8fb-4d0d-91ae-97825c2ff159` | 15.4 | 305.6 | 279.5 | ok |
| 1.60 | `abad1801-0cdd-40bd-9326-72d9d17b082c` | 18.6 | 286.5 | 248.9 | ok |
| 1.70 | `2c4e2099-519e-4392-83c0-963a688fc508` | 22.6 | 269.6 | 243.2 | ok |
| 1.80 | `1c449d98-0693-4e76-987a-7b56872e9fbf` | 17.1 | 254.7 | 234.1 | ok |
| 1.90 | `203d9515-5a0b-41dc-9f5d-599a5a097d7c` | 19.8 | 241.3 | 220.2 | ok |
| 2.00 | `d3316d63-df2b-4dab-9229-7e5daac91a61` | 18.4 | 229.2 | 208.4 | ok |
| 2.10 | `94dbcfc5-e22c-422b-b7a5-c0327af988c4` | 15.4 | 218.3 | 201.9 | ok |
| 2.20 | `e05c0436-e4b5-445a-a60a-51b9d4bd6fa1` | 14.9 | 208.4 | 174.4 | ok |
| 2.30 | `5934d0e3-d8bd-487f-a618-9f0f8149ab12` | 15.6 | 199.3 | 169.3 | ok |
| 2.40 | `3ddb5f25-08cf-4de5-b30d-eb65aeef6b71` | 23.2 | 191.0 | 165.4 | ok |
| 2.50 | `d287362a-dd9d-462f-88a7-1b8395316985` | 22.2 | 183.4 | 162.5 | ok |
| 2.60 | `c1d61fc5-87d2-488c-a322-9d0d01876566` | 28.0 | 176.3 | 161.4 | ok |
| 2.70 | `b9b2337e-5e61-4a28-94e8-381de59e554b` | 16.9 | 169.8 | 159.4 | ok |
| 2.80 | `cdc16053-34a2-4f02-bce4-48659bad00cc` | 24.2 | 163.7 | 157.0 | ok |
| 2.90 | `477c7b38-8176-42ff-b7b1-130018be3054` | 25.6 | 158.1 | 154.0 | ok |
| 3.00 | `b1073ab2-43f9-4aba-a5d8-177a6846f02d` | 24.4 | 152.8 | 150.2 | ok |
| 3.20 | `33cd6308-ab78-471f-8e1b-0472090f95a3` | 19.9 | 143.3 | 147.4 | ok |
| 3.40 | `a1123aa1-caa9-4bae-a130-35e37324a2c7` | 17.8 | 134.8 | 147.2 | ok |
| 3.60 | `0d21343f-04f4-4fe1-b4fd-ca9622a3fe19` | 19.9 | 127.3 | 118.5 | ok |
| 3.80 | `eb95b162-6421-4c76-8d58-c768b6437b8c` | 19.1 | 120.6 | 118.7 | ok |
| 4.00 | `0ab5658c-c414-483b-ac3f-cda478cead11` | 25.1 | 114.6 | 117.9 | ok |
| 4.20 | `751ba59b-e6b5-4961-b06a-ccebf98499b9` | 13.8 | 109.2 | 103.8 | ok |
| 4.40 | `a4d3f200-aa0f-45a9-9a11-2a14e2ed14dd` | 22.1 | 104.2 | 104.4 | ok |
| 4.60 | `d38d310f-dcb5-4ecf-9beb-5ae534f2a54f` | 22.1 | 99.7 | 102.1 | ok |
| 4.80 | `b74e9a47-68c6-48f1-b6a8-b15f69dc1b0e` | 17.0 | 95.5 | 97.7 | ok |
| 5.00 | `4928f98d-9a84-46e1-a2c4-50b971eb5b7e` | 14.5 | 91.7 | 95.3 | ok |
