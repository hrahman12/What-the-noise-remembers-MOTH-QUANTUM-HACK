# Parameters: every completed Atlas job

All jobs ran on Atlas's server-side Qiskit Aer simulator (these engines have no QPU mode).
Ledgered spend for `02-coda-reservoir`: **18 credits** of a 20-credit cap (qrc-train-v2 = 5 credits/run, qrc-gen-v2 = 1 credit/run).

## Training (qrc-train-v2)

| key | value |
|---|---|
| job_id | `ca93fb54-f7d5-4b58-b540-de8137d57536` |
| num_qubits | **12** (engine maximum; `num_qubits: 13` returned HTTP 422 "maximum: got 13, want 12", see `out/probe_13_qubits.txt`) |
| sequence | 3840 tokens (every coda, corpus order) |
| vocabulary | 30 tokens: 1, 2, 3, 4, 5A, 5B, 6, 7A, 7B, 8A, 8B, 9A, 9B, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 29 |
| sample_length | 16 |
| washout | 4 |
| mode | order |
| sample_fraction | 0.125 |
| periodic | True |
| epochs | 100 |
| shots | 3000 |
| mixing | 0.7 |
| num_random_gates | 10 |
| seed | 3617 |
| wall time (submit to result) | 2133 s |

## Generation (qrc-gen-v2)

Every job takes `input_files.state = 5db1c6ed-8be1-4696-8f88-2c2e0f2ff084`: the asset ID of the training job's own `state`
output (the pristine trained model, passed by reference, never chained from another generation). The
`job:<id>/state` form is rejected on this endpoint with a free HTTP 422 ("must be an asset UUID").
`shots` is left at the model's own 3000. Every job returned exactly 160 tokens.

| key | variation | random_seed | length | warm-up (initial_events) | job_id |
|---|---|---|---|---|---|
| var_0.25 | 0.25 | 1 | 160 | default (whole vocabulary) | `846fdc41-fc8a-4ca8-9a3b-83468b7d38fc` |
| var_0.25_s2 | 0.25 | 2 | 160 | default (whole vocabulary) | `46a0d00e-6fcc-4adc-973e-fce98fcfad94` |
| var_0.5 | 0.5 | 1 | 160 | default (whole vocabulary) | `4821d6a8-cca9-42ba-8e2b-1b8c0db8d5c7` |
| var_0.5_s2 | 0.5 | 2 | 160 | default (whole vocabulary) | `b9887734-28cf-4035-a8f5-1236cdb4ad78` |
| var_1.0 | 1.0 | 1 | 160 | default (whole vocabulary) | `769be960-3778-4fbd-b6b8-6796b0ace191` |
| var_1.0_s2 | 1.0 | 2 | 160 | default (whole vocabulary) | `d986b3df-2b06-44c8-80a3-9a0a357c8376` |
| var_2.0 | 2.0 | 1 | 160 | default (whole vocabulary) | `512268a6-b73e-4727-ad36-138664689103` |
| var_2.0_s2 | 2.0 | 2 | 160 | default (whole vocabulary) | `ae686b6d-4014-4a35-883a-0b8dc8f3dee2` |
| var_4.0 | 4.0 | 1 | 160 | default (whole vocabulary) | `a12e224b-d7e0-412a-8047-6d975fd37723` |
| var_4.0_s2 | 4.0 | 2 | 160 | default (whole vocabulary) | `66303d54-07ba-45fb-9ab5-7f8d24f7c0db` |
| var_16.0 | 16.0 | 1 | 160 | default (whole vocabulary) | `b119f921-4e37-4ad3-8946-fc9e7f809963` |
| var_64.0 | 64.0 | 1 | 160 | default (whole vocabulary) | `375a902e-d0f0-467e-9f86-227d4f0858b6` |
| handoff | 1.0 | 1 | 160 | 31 real codas (the WAV's opening stretch) | `d94c4495-fd40-4e98-81c9-8f3736edf66b` |

## Comparison metrics (classical, computed by build_events.py)

| sequence | tokens | distance to real token mix (TVD) | same-type repeats | pairs unseen in real data | distinct tokens |
|---|---|---|---|---|---|
| Real corpus (3,840 codas) | 3840 | 0.000 | 61% | 0.0% | 30 |
| Classical: independent draws at real frequencies (mean of 200) | 160 | 0.094 | 35% | 3.4% | 15 |
| Classical: Markov chain fitted to the corpus (mean of 200) | 160 | 0.130 | 61% | 0.0% | 15 |
| Reservoir, variation 0.25, take 1 | 160 | 0.269 | 53% | 5.0% | 18 |
| Reservoir, variation 0.25, take 2 | 160 | 0.145 | 62% | 3.1% | 17 |
| Reservoir, variation 0.5, take 1 | 160 | 0.269 | 53% | 5.0% | 18 |
| Reservoir, variation 0.5, take 2 | 160 | 0.145 | 62% | 3.1% | 17 |
| Reservoir, variation 1, take 1 | 160 | 0.300 | 53% | 5.0% | 17 |
| Reservoir, variation 1, take 2 | 160 | 0.151 | 73% | 2.5% | 13 |
| Reservoir, variation 2, take 1 | 160 | 0.281 | 47% | 1.3% | 10 |
| Reservoir, variation 2, take 2 | 160 | 0.221 | 65% | 5.0% | 16 |
| Reservoir, variation 4, take 1 | 160 | 0.265 | 64% | 3.1% | 17 |
| Reservoir, variation 4, take 2 | 160 | 0.221 | 65% | 5.0% | 16 |
| Reservoir, variation 16, take 1 | 160 | 0.332 | 33% | 11.9% | 21 |
| Reservoir, variation 64, take 1 | 160 | 0.584 | 11% | 43.4% | 30 |
| Reservoir after the real stretch (handoff, variation 1), all 160 tokens | 160 | 0.337 | 30% | 13.2% | 21 |

## The WAV

`coda_reservoir.wav`: 83.96 s, 44100 Hz, 16-bit, 2 channels, 316 clicks, peak -1.01 dBFS. 31 real codas, then 14 reservoir codas from job `d94c4495-fd40-4e98-81c9-8f3736edf66b` starting at 38.771 s.
