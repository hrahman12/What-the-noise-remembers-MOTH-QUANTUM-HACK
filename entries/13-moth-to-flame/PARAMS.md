# Parameters and jobs

Every completed `labyrinth-v1` job used by the page. One job = one level, and every level ran on **IBM ibm_fez** (`mode="qpu"`, `backend_name="ibm_fez"`, the default in `run_levels.py`). Two earlier runs of the same towns on other backends are kept only as labelled **comparison runs** (Figure 4 on the page): they are not levels and are never flown. Common parameters: `shots=4096, steps=3, fraction=1/3, k=3, top_n=-1` (engine defaults except `top_n`, which keeps every distinct bitstring so ⟨ZZ⟩ can be computed from the complete counts).

| Role | Run | Grid | Qubits | Mode | Backend (engine-reported) | Atlas job_id | IBM job | Planned streets / edges | Measured hedges match plan | mean(sign·⟨ZZ⟩) measured | engine sz_samp | engine sz_tomo (classical estimate, not used) | Distinct shots |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| level | L1 Lamp Lane | 4×5 | 20 | qpu | ibm_fez | `696ead63-7383-4e03-b2e4-13ef60a1b318` | `db1psfmegvvc73bi0fk0` | 23 / 31 | 24/31 | 0.0747 | 0.0747 | 0.4310 | 4080 |
| level | L2 Hedge Row | 10×12 | 120 | qpu | ibm_fez | `0b10df67-a232-4151-8cc3-ce7242fe045c` | `db1pvqbid5ic73ergopg` | 152 / 218 | 129/218 | 0.0076 | 0.0076 | 0.3136 | 4096 |
| level | L3 Night Town | 12×13 | 156 | qpu | ibm_fez | `8bbeb212-7196-4677-bd06-4fba1d71d510` | `db1j3feegvvc73bhmqc0` | 202 / 287 | 185/287 | 0.0131 | 0.0131 | 0.2976 | 4096 |
| comparison (same town as L1) | L1-emu Lamp Lane | 4×5 | 20 | emu | aer | `9d0fd5f8-691b-4913-adca-056bdfa01823` | – | 23 / 31 | 30/31 | 0.3095 | 0.3095 | 0.4310 | 3568 |
| comparison (same town as L2) | L2-miami Hedge Row | 10×12 | 120 | qpu | ibm_miami | `da6eaf6d-512c-492d-9ee4-655ac76d0e82` | `db1jh9ivog1s73fi7ejg` | 152 / 218 | 140/218 | 0.0180 | 0.0180 | 0.3218 | 4096 |

Qubit counts are the engine's reported `num_qubits` (one qubit per town square, rows × cols). On ibm_fez the limit is the chip: Night Town uses all 156 qubits. Lamp Lane (20) and Hedge Row (120) keep the sizes of their comparison runs, so each pair is the same street plan edge for edge: the emulator's documented ceiling is 20 qubits, and ibm_miami (Nighthawk) has 120.

Edges where a comparison run and its ibm_fez level disagree on hedge vs street: L1-emu vs L1: 6 of 31; L2-miami vs L2: 105 of 218.

Street-plan seeds (`town.py`, `extra=0.3`): L1 seed 13, L2 seed 1313, L3 seed 2024.

## Every ledgered submission for this piece

| Atlas job_id | Credits | Status |
|---|---|---|
| `9d0fd5f8-691b-4913-adca-056bdfa01823` | 5 | completed, used as comparison run L1-emu (aer) |
| `8bbeb212-7196-4677-bd06-4fba1d71d510` | 5 | completed, used as level L3 (ibm_fez) |
| `da6eaf6d-512c-492d-9ee4-655ac76d0e82` | 5 | completed, used as comparison run L2-miami (ibm_miami) |
| `696ead63-7383-4e03-b2e4-13ef60a1b318` | 5 | completed, used as level L1 (ibm_fez) |
| `0b10df67-a232-4151-8cc3-ce7242fe045c` | 5 | completed, used as level L2 (ibm_fez) |

Ledgered spend: **25 of 27 credits** (15 for the first three jobs, then 10 for the ibm_fez re-runs of Lamp Lane and Hedge Row; the cap was raised by a 12-credit allowance for that pass).
