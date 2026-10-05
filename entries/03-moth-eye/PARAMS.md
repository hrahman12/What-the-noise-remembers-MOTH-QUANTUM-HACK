# Parameters: entanglement-shader-v1 (Moth Eye)

Engine **entanglement-shader-v1** (Atlas), 1 credit per run, classical statevector simulator (no QPU mode).
Fixed in every run: `reflectance` 0.2, `absorption` 0.95. Engine defaults (not sent): `style` peaked, `resolution` 60,
`interaction` 1 unless stated. Output: a ZIP with GLSL/HLSL/OSL/.frag/MaterialX shaders and 60x60 float32 R and T tables.

## Completed runs (8), all used

| tag | layers | incoming_rays | interaction | qubits | mean R | mean T | job_id |
|---|---|---|---|---|---|---|---|
| L1_R6 | 1 | 6 | 1 | ~17 (fit) | 0.4183 | 0.4627 | `2ff303ed-dcc4-481d-b981-db2aa94de39e` |
| L2_R6 | 2 | 6 | 1 | ~18 (fit) | 0.4729 | 0.2188 | `761ee901-278b-4b78-982d-0c0ac87431e5` |
| L3_R6 | 3 | 6 | 1 | ~19 (fit) | 0.4767 | 0.1527 | `3ba1f189-a5b0-485e-a6af-f83427e1fdfe` |
| L4_R6 | 4 | 6 | 1 | ~19 (fit) | 0.4789 | 0.0727 | `6b0fcb3c-a6c5-429a-8f6e-80cc43d4e88e` |
| L5_R6 | 5 | 6 | 1 | ~20 (fit) | 0.4788 | 0.0502 | `20510fd1-5d75-4ca8-966f-83ab860029ca` |
| L6_R6 | 6 | 6 | 1 | **21** (limit, engine-confirmed) | 0.4788 | 0.0147 | `0dfd9339-f7f8-4fde-9b06-f3b5624bf888` |
| L1_R6_int0 | 1 | 6 | 0 | ~17 (fit) | 0.6189 | 0.2373 | `dd9c780f-5fe3-48c2-a436-a87cad9d5fce` |
| L6_R6_int0 | 6 | 6 | 0 | **21** (same 6x6 stack) | 0.6659 | 0.0038 | `49da4043-6974-46c2-8556-a74c3b1ea18f` |

The 6-layer, 6-ray run (`0dfd9339...`) was submitted as a budget probe and is reused as the top of the sweep.

## Budget probes (real jobs: the 21-qubit check runs at job start)

| layers | incoming_rays | outcome | engine message | job_id |
|---|---|---|---|---|
| 21 | 30 | failed | Configuration of(30 rays, 21 layers), exceeds the limit of 21 qubits. With 21 layers, incoming_rays must be at most -5. | `8285e98e-5ae7-4974-9898-696bb3ae2d14` |
| 8 | 10 | failed | Configuration of(10 rays, 8 layers), exceeds the limit of 21 qubits. With 8 layers, incoming_rays must be at most 5. | `aff508a9-2282-4f91-9328-4c9a413650a6` |
| 7 | 30 | failed | Configuration of(30 rays, 7 layers), exceeds the limit of 21 qubits. With 7 layers, incoming_rays must be at most 5. | `ea36ca02-1062-4d7c-92d1-025405e9824c` |
| 6 | 6 | completed | completed | `0dfd9339-f7f8-4fde-9b06-f3b5624bf888` |
| 6 | 7 | failed | Configuration of(7 rays, 6 layers), exceeds the limit of 21 qubits. With 6 layers, incoming_rays must be at most 6. | `b0ec46ef-00d6-4c06-84c6-589d9432fd14` |

Four rejected probes and eight completed runs = 12 ledgered submissions = 12 credits (the cap).
Whether Atlas bills rejected jobs is not visible to us; the project ledger counts them.
The eight completed runs have result files in `cache/entanglement-shader-v1/`; the four rejected probes
returned no result, so they are recorded only in the project ledger (`cache/ledger.jsonl`) and in `out/probes.json`.

**Qubit counts.** 6 layers x 6 rays is exactly the 21-qubit limit: the engine accepts 6 rays and rejects 7 at
6 layers, and each ray is one qubit (one mode per qubit in the collision model, arXiv:2606.29989). The
engine does not report a count for smaller runs; `q = rays + layers - floor(layers/4) + 10` is our fit to its
messages (it reproduces all five probe outcomes) and gives the "~" values above.

**Derived numbers** (classical, from the tables): see `out/reflectance.json` (LUT means, normal-incidence and
uniform-sky shader values, head-on and all-direction averages on the mesh) and `out/view_sweep.json`
(the page's GPU meter at tilts 0-85 deg for every run).
