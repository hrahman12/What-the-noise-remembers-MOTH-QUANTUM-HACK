# Parameters: comet-qrng-v1 jobs (2 completed, 10 credits)

Engine **comet-qrng-v1 v1.0.0** (Atlas), 5 credits per run, piece cap 12 (`Atlas(piece="20-antimatter-drop", credit_cap=12)`).
Script: `run_qrng.py`. Ledgered spend from `a.spent()`: **10** credits. No failed or abandoned jobs.

Shared parameters on both jobs: `shots` = 10000 (maximum), `output_bytes` = 1000000 (you receive
min(requested, extractable)), `include_raw_counts` = true, `epsilon_log2` = 128 (maximum; output 2⁻¹²⁸-close to
uniform under the engine's entropy model), `public_seed` = "toeplitz-v1" (default shipped seed, information-theoretic
mode), no `derive`, no beacon chaining.

| Run | mode | backend_name | num_qubits | bell_witness | Qubits used (reported) | Backend reported | Bytes (dice) | CHSH S ± σ | Atlas job_id | Provider job |
|---|---|---|---|---|---|---|---|---|---|---|
| fez_148p8 | qpu | ibm_fez | 148 | true | 148 + 8 = **156** | **ibm_fez** | 110,710 (55,355) | 2.5476 ± 0.0154 | `f0a73985-b15e-42ef-870f-40a6e2b2360a` | `db1jigpb694s73dscbr0` |
| emu_20p0 | emu | – | 20 | false | 20 + 0 = **20** | aer | 8,423 (4,211) | – | `c07b1b4e-ec07-4def-8f51-dfb16765626f` | `202ee22da03a4553ae18a86dc008ebed` |

Qubit counts are the engine's own `provenance.circuit.n_rand` / `n_total`. On the QPU run `initial_layout` uses
physical qubits 0–155, all 156 qubits of ibm_fez. That is the most the chip allows: the guide's documented ceiling
for comet-qrng-v1 on ibm_fez is 148 register + 8 Bell = 156. The emulator caps the whole circuit at 20 qubits. A
12 + 8 witness emu run returns 0 extractable bytes (measured by entry 05), so the emu bank uses 20 register
qubits.

Entropy accounting (engine `entropy_report`):

| Run | raw bits | h per raw bit (SP 800-90B, 99 %) | modelled budget (bits) | assumption-free budget | output bits | grade | health |
|---|---|---|---|---|---|---|---|
| fez_148p8 | 1,480,000 | 0.6786 | 885,938 | 0 | 885,680 | hardware-accounted | passed (10 qubits biased at p < 10⁻⁶; 0/512 sub-registers failed the collision test) |
| emu_20p0 | 200,000 | 0.9305 | 67,642 | 0 | 67,384 | simulator-baseline | passed |

QPU run timing: submitted 2026-10-05 05:44 UTC, collected 05:54:48 UTC (647 s wall, 5 s of QPU time).

## How the page and the replay use the bytes (classical)

- Bank = `random.hex` exactly as returned (`data/bank_<run>.hex`). Each atom consumes the next 2 bytes as a
  big-endian 16-bit word k. It goes down iff `k < round(P_dn × 65536)`. The odd last byte of the emu bank is never
  used.
- `P_dn(bias) = max(0, N_dn) / (max(0, N_up) + max(0, N_dn))` from Table 1 of Anderson et al. (2023):

| bias (g) | trials | N_up | N_dn | P_dn used | threshold /65536 | atoms per trial (page) | atoms per series (page) |
|---|---|---|---|---|---|---|---|
| −3 | 7 | 151.7 | 16.5 | 0.0981 | 6,429 | 24 | 168 |
| −2 | 7 | 128.7 | 33.5 | 0.2065 | 13,535 | 23 | 162 |
| −1.5 | 6 | 128.9 | 57.7 | 0.3092 | 20,265 | 31 | 187 |
| −1 | 7 | 69.7 | 62.5 | 0.4728 | 30,983 | 19 | 132 |
| −0.5 | 7 | 55.7 | 67.5 | 0.5479 | 35,906 | 18 | 123 |
| 0 | 7 | 36.7 | 94.5 | 0.7203 | 47,204 | 19 | 131 |
| +0.5 | 7 | 36.7 | 124.5 | 0.7723 | 50,616 | 23 | 161 |
| +1 | 7 | 17.7 | 119.5 | 0.8710 | 57,081 | 20 | 137 |
| +1.5 | 6 | 13.9 | 180.7 | 0.9286 | 60,855 | 32 | 195 |
| +2 | 7 | 6.7 | 163.5 | 0.9606 | 62,956 | 24 | 170 |
| +3 | 7 | 7.7 | 147.5 | 0.9504 | 62,285 | 22 | 155 |
| −10 (calibration) | 6 | 142.9 | 0.7 | 0.0049 | 319 | 24 | 144 |
| +10 (calibration) | 6 | −0.1 → 0 | 185.7 | 1.0000 | 65,536 | 31 | 186 |

- Whole-campaign replay (`replay.py`, identical to the page's "Run the whole campaign" on a fresh page): 1,721 atoms
  per bank. Logistic balance points (MLE grid, profile 68 % interval): ibm_fez dice −0.82 g [−0.86, −0.76]; emulator
  dice −0.72 g [−0.78, −0.68]; the same fit on the Table 1 counts −0.78 g [−0.84, −0.74].
- Cosmetic PRNG (classical, never decides an outcome): mulberry32 seeded with `0x5EED0000 + 7919·bias_index + 104729·trial_no`.
- Ramp: 20 s; the drawn mirror current falls linearly to 3 %. Escape times are illustrative, uniform in 10–20 s.
