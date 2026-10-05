# Parameters: comet-qrng-v1 jobs (4 completed, 20 credits)

Engine **comet-qrng-v1 v1.0.0** (Atlas), 5 credits per run, piece cap 45. Script: `run_comet.py`.
Shared params on every job: `shots` = 10000 (the maximum), `output_bytes` = 1000000 (you receive min(requested, extractable)),
`include_raw_counts` = true. `epsilon_log2` = 64 and `public_seed` = "toeplitz-v1" are left at their defaults, with no `derive`.

| Run | mode | backend_name | num_qubits | bell_witness | Qubits used (reported) | Backend reported | Bytes | S ± σ | Atlas job_id | Provider job |
|---|---|---|---|---|---|---|---|---|---|---|
| emu_12p8 | emu | - | 12 | true | 12 + 8 = **20** | aer | 0 | 2.8366 ± 0.0141 | `14c90fa7-56a4-43de-a975-96aa8322ba6a` | 3a0499075d164cdfaead27ac6c097d60 |
| emu_20p0 | emu | - | 20 | false | 20 + 0 = **20** | aer | 8,581 | - | `8650be46-e961-4ebe-bea1-56502b041342` | bf40c60464594143b5b199c91be4569f |
| fez_148p8 | qpu | ibm_fez | 148 | true | 148 + 8 = **156** | **ibm_fez** | 91,345 | 2.5428 ± 0.0154 | `ea258824-af68-40a1-8758-a5a37c74e899` | db1iukqvog1s73fi6kog |
| mar_148p8 | qpu | ibm_marrakesh | 148 | true | 148 + 8 = **156** | **ibm_marrakesh** | 70,444 | 2.7278 ± 0.0146 | `6a60b547-a73d-4957-8c5e-3f643aa41022` | db1iupmegvvc73bhmjrg |

Qubit counts are the engine's own `provenance.circuit.n_rand` / `n_total`. On both QPU runs `initial_layout`
uses physical qubits 0–155, all 156 qubits of the chip. Emu is capped at 20 qubits for the whole circuit,
so both emu runs sit at the cap.

Entropy accounting (engine `entropy_report`):

| Run | raw bits | h per bit (SP 800-90B, 99 %) | shot-order penalty | budget (modelled) | assumption-free | grade | health |
|---|---|---|---|---|---|---|---|
| emu_12p8 | 120,000 | 0.9379 | 118,458 | 0 | 0 | simulator-baseline | passed |
| emu_20p0 | 200,000 | 0.9362 | 118,458 | 68,779 | 0 | simulator-baseline | passed |
| fez_148p8 | 1,480,000 | 0.5739 | 118,458 | 730,889 | 0 | hardware-accounted | passed (8 qubits biased at p < 1e-6) |
| mar_148p8 | 1,480,000 | 0.4609 | 118,458 | 563,684 | 0 | hardware-accounted | passed (10 qubits biased at p < 1e-6) |

Game constants (classical, `web/core.js` `R`): in-train gap 70 ms + slot × 12 ms, 3 bits per click,
n-gram order 3, 12 symbols, add-½ smoothing, back-off below 4 examples, jam hold 160 ms, click cost 3 of 100 breath,
regen 9/s after 250 ms of silence, strike radius 16 px, capture radius 24 px, abort below 20 % fix, 3 passes.
PRNG: mulberry32, page default seed 0x5EED2009, top 3 bits per draw.
