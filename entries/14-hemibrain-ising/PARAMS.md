# Parameters: Atlas graph-v1 jobs (20 qubits)

Engine: **graph-v1** (Quantum Graph Engine, built on QuantumGraph), 5 credits per run, piece cap 40 (25 for the first round,
15 more for the ibm_fez round on 5 Oct 2026). Hardware target: **IBM ibm_fez** (Heron, 156 qubits), the default `QPU_BACKEND` in
`run_graph.py` (`backend_name="ibm_fez"`, `mode="qpu"`, `timeout=3600`).
Qubits: `num_qubits = 20`, the engine maximum (schema `maximum: 20`), so 20 of ibm_fez's 156 qubits. Completed runs echo `num_qubits: 20` in their output.
Common parameters: `coupling_map` = all 190 pairs of 20 qubits; `operations` = 20 × `{type: bloch, paulis: {X: 1.0}}`
then 30 × `{type: relationship, qubits: [i, j], paulis: {ZZ: 1.0}, fraction: f_ij}` (strongest bond first, `update` left at its default true);
f_ij = inverse of the isolated-pair curve at tanh(β J_ij), β = 0.7. Full parameter dicts are in `cache/graph-v1/<cache_key>.json`.

| # | circuit | mode | backend | shots | job_id | status | cache key | ledgered credits |
|---|---|---|---|---|---|---|---|---|
| 1 | compass (16384-shot params) | emu | – (never reached the simulator) | 16384 | `1aca7037-b58d-4708-a219-1eebd2a8df24` | failed at `submit`: failed to connect to all addresses; last error: FAILED_PRECONDITION: ipv4:172.20.173.190:8 | `204aa522cf700f8b` | 5 |
| 2 | compass (16384-shot params) | emu | – (never reached the simulator) | 16384 | `9246106d-1486-4c94-979e-af37ccf240cc` | failed at `submit`: failed to connect to all addresses; last error: UNKNOWN: ipv4:172.20.173.190:8788: Failed  | `204aa522cf700f8b` | 5 |
| 3 | compass | emu | aer | 4096 | `8494a1ad-c8cc-4e1c-a19e-02e6b352cc82` | completed | `aadd859e8b9a786a` | 5 |
| 4 | compass | qpu | ibm_fez | 4096 | `8642a642-295f-461e-8d03-7f2c3c8478df` | failed at `collect`: QPU job ended as cancelled | `1a3a8c9168a959d3` | 5 |
| 5 | memory | emu | aer | 4096 | `ef983b89-a123-43cf-9bf0-d7d32f285c1f` | completed | `e577a14181b7bbfa` | 5 |
| 6 | compass (resubmission of #4, identical parameters) | qpu | ibm_fez | 4096 | `9b97ee9a-2328-4a50-bd4b-819e71794df1` | failed at `collect`: QPU job ended as failed (sent 14:12 UTC) | `1a3a8c9168a959d3` | 5 |
| 7 | memory | qpu | ibm_fez | 4096 | `787c9fa8-7dae-4dcb-9f43-742c189cf85e` | failed at `collect`: QPU job ended as cancelled (sent 14:54 UTC, cancelled 15:10) | `00c44abbf2922e08` | 5 |
| 8 | memory (second try, identical parameters) | qpu | **ibm_fez** (IBM job `db1rsijid5ic73erj1k0`) | 4096 | `6469b158-8538-4230-9a6d-ed535173b37c` | **completed** (sent 15:11 UTC, 516 s) | `00c44abbf2922e08` | 5 |

The two failed emu submissions used the same recipe at 16,384 shots. The retry used 4,096 shots, closer to the 1,024-shot
configuration already known to work for 20 qubits. The ibm_fez job was accepted by IBM (submit step completed) and later
reported cancelled. Atlas exposes no IBM job ID for it. All eight jobs are in the shared credit ledger (`cache/ledger.jsonl`, same cache keys); only the three completed runs have a response file in `cache/graph-v1/` (`aadd859e8b9a786a.json`, `e577a14181b7bbfa.json`, `00c44abbf2922e08.json`), because failed jobs return nothing to cache. `out/atlas_jobs.json` is rebuilt from the ledger by `run_graph.refresh_jobs_table` (free status reads).

**The ibm_fez round (rows 6-8, 15 credits).** Every hardware step was sent to ibm_fez at the engine maximum of 20 qubits, compass
first. Row 6 resubmitted the cancelled compass job with identical parameters (same cache key); it ended "QPU job ended as failed"
about two minutes later. In the same minutes every other ibm_fez job in the shared ledger also failed (other pieces' comet-qrng,
labyrinth, coin-toss, graph-v1, otoc-echo and retrocausal-echo jobs, and a qpixl submission), so we read it as an IBM-side
outage, not a fault of this circuit. With two failures on ibm_fez the compass network was not retried and keeps its emulator run
as its quantum result. Memory then went to ibm_fez: row 7 waited about 16 minutes at IBM and was cancelled, as row 4 had been.
(Both cancellations came about 16 minutes after submission. The engine's run policy is a 300 s timeout with 3 retries, so we think
Atlas stops waiting after about 15 minutes. That is our inference, not a documented rule.) Row 8, the second try, completed in 516 s
and returned real counts: `backend: ibm_fez`, `num_qubits: 20`, `mode: qpu`. That spent the 15-credit allowance (40 of 40 ledgered),
so the smell network was never sent to hardware.

## Fractions per bond (β = 0.7)

**Compass** (w_ref = 100 synapses): (1,16) J=1.84 f=0.6549, (3,15) J=1.46 f=0.5589, (2,16) J=1.41 f=0.5447, (4,9) J=1.33 f=0.5212, (4,19) J=1.28 f=0.5061, (6,15) J=1.21 f=0.4842, (3,9) J=1.16 f=0.4681, (3,4) J=1.11 f=0.4516, (8,15) J=1.10 f=0.4483, (8,19) J=1.05 f=0.4314, (4,15) J=1.04 f=0.4279, (5,9) J=1.04 f=0.4279, (3,19) J=1.02 f=0.421, (7,15) J=1.01 f=0.4176, (6,8) J=1.00 f=0.4141, (7,11) J=1.00 f=0.4141, (8,10) J=1.00 f=0.4141, (4,17) J=0.99 f=0.4106, (3,8) J=0.96 f=0.3999, (4,18) J=0.96 f=0.3999, (1,9) J=0.94 f=0.3928, (2,9) J=0.94 f=0.3928, (4,5) J=0.94 f=0.3928, (6,19) J=0.94 f=0.3928, (6,10) J=0.92 f=0.3856, (3,13) J=0.90 f=0.3783, (6,7) J=0.89 f=0.3747, (3,12) J=0.86 f=0.3636, (5,14) J=0.78 f=0.3335, (0,10) J=0.66 f=0.2867

**Memory** (w_ref = 481.5 synapses): (0,1) J=12.54 f=0.9999, (1,4) J=2.32 f=0.7491, (7,14) J=2.20 f=0.7272, (7,15) J=2.14 f=0.7176, (0,18) J=2.12 f=0.7133, (0,17) J=1.82 f=0.6511, (1,6) J=1.47 f=0.5624, (0,4) J=1.39 f=0.5381, (1,19) J=1.38 f=0.5351, (1,18) J=1.19 f=0.4785, (0,7) J=1.17 f=0.4718, (1,17) J=1.17 f=0.4704, (0,3) J=1.11 f=0.4527, (1,5) J=1.10 f=0.4478, (4,10) J=1.09 f=0.445, (12,18) J=0.91 f=0.3818, (1,7) J=0.91 f=0.3803, (12,17) J=0.84 f=0.3566, (0,15) J=0.76 f=0.3259, (0,19) J=0.75 f=0.3219, (3,4) J=0.71 f=0.3049, (13,18) J=0.68 f=0.2959, (0,14) J=0.66 f=0.2852, (0,2) J=0.64 f=0.2786, (0,5) J=0.62 f=0.2702, (11,17) J=0.60 f=0.2618, (14,15) J=0.58 f=0.2542, (8,18) J=0.56 f=0.2474, (9,17) J=0.56 f=0.2465, (15,16) J=0.48 f=0.2111

**Smell** (w_ref = 175 synapses; parameters built but never submitted, because the budget ran out, first in round 1 and again in the ibm_fez round): (10,17) J=3.09 f=0.851, (8,10) J=2.38 f=0.7586, (4,15) J=2.06 f=0.7021, (3,7) J=1.72 f=0.6268, (0,7) J=1.63 f=0.604, (3,15) J=1.62 f=0.6025, (10,11) J=1.59 f=0.5937, (8,12) J=1.51 f=0.5739, (6,7) J=1.30 f=0.5113, (7,12) J=1.26 f=0.5008, (7,10) J=1.22 f=0.4864, (15,19) J=1.11 f=0.4511, (1,15) J=1.10 f=0.4473, (15,17) J=1.09 f=0.4435, (4,16) J=1.06 f=0.4338, (0,8) J=0.94 f=0.3938, (1,17) J=0.87 f=0.3668, (9,10) J=0.85 f=0.3583, (3,17) J=0.83 f=0.3541, (2,17) J=0.83 f=0.3519, (10,18) J=0.81 f=0.3433, (2,15) J=0.77 f=0.3302, (0,15) J=0.77 f=0.3281, (17,19) J=0.71 f=0.3081, (4,14) J=0.71 f=0.3059, (0,17) J=0.65 f=0.2833, (3,16) J=0.61 f=0.2649, (5,10) J=0.57 f=0.2486, (4,13) J=0.54 f=0.2391, (6,18) J=0.52 f=0.2297

## Cross-checks against the exact statevector replica (`out/replica.json`)

| run | TVD on returned 20 | chi² (20 strings) | top-20 share of shots | bond ⟨ZZ⟩ exact | bond ⟨ZZ⟩ engine tomography |
|---|---|---|---|---|---|
| compass/emu `8494a1ad` | 0.0115 | 30.59 | 0.133 | 0.6019 | 0.214 |
| memory/emu `ef983b89` | 0.0109 | 24.45 | 0.133 | 0.6601 | 0.2989 |
| **memory/qpu ibm_fez `6469b158`** | 0.0317 | 644.39 | 0.043 (exact gives the same 20 strings 0.099) | 0.6601 | 0.2989 |

On the hardware run the most frequent pattern is all spins down (all lamps dark), which is also the exact state's likeliest
outcome. 12 of its 20 most frequent patterns are among the exact state's 20 likeliest (the emulator's: 17). The two all-aligned
patterns took 0.8% of shots against 2.6% exact. Noise spreads the shots over many more patterns, so the returned top 20 hold
4.3% of shots instead of about 10% to 13%, and chi-square on the 20 is far above shot noise. The counts are shown as returned, with no error mitigation.

## Classical runs

THRML 0.1.4 block Gibbs: 3 circuits × β ∈ {0.1, 0.2, …, 1.5}; 64 chains, 300 warm-up sweeps, 250 samples 4 sweeps apart (16,000 samples
per setting), greedy colouring (compass 3 colours, memory 4, smell 3), JAX key 14. Exact enumeration of all 2^20 states for every setting.
