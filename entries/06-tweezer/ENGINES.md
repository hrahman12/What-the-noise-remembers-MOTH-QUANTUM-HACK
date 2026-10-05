# ENGINES: Tweezer chain

**16 engines completed, 26 completed jobs counted.** Credits ledgered for this piece: **94 of 96** (50 for the recorded day, 24 for the first ibm_fez pass of 5 October 2026, 22 for one retry of each failed ibm_fez job). From the ledger and the job cache: 55 submissions for this piece: 26 completed and counted, 1 completed probe not used, 28 failed (11 of them free tamagotchi attempts; 40 credits went to the failed ones), plus 1 request refused before a job was created (HTTP 413, no credit). Every failure is listed below with its job ID and error, and none is counted.

Atlas runs gate-model circuits and simulators, never atoms. Each row says what stood in for what.

| # | Time | Engine | Role in the day | Input | Output | Qubits | Where it ran | Job ID | Completed? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 05:00 | `coin-toss-v1` | Will a tweezer catch an atom? | 144 shots of H then measure | 74 heads / 70 tails | 1 (one qubit by construction (engine description)) | IBM hardware (ibm_fez) | `d27e51b3-464d-48d6-97ca-97b2bb49072a, 83ad70dc-cb9c-4acf-9def-fbc0a15034d6` | yes |
| 2 | 05:30 | `comet-qrng-v1` | Load the whole array at once | 148-qubit /+> register, 10,000 shots, CHSH witness on | counts over 10000 shots (10000 distinct bitstrings, no per-shot order); fill 0.502; CHSH S = 2.6118 | 156 (148 register + 8 Bell-witness qubits (params; engine description)) | IBM hardware (ibm_fez) | `7a6587bb-9185-4038-a7d2-fab4c5a87193, f7749ef9-75fe-47d2-8120-74cd86d36478` | yes |
| 3 | 06:00 | `qrc-image-v1` | The morning flicker | 8 loading attempts from comet, in the order picked by comet's conditioned random integers, rendered as frames by this piece (classical) | 32-frame GIF | reservoir size is set inside the engine and not reported | Atlas simulator (quantum reservoir) | `da0814bc-0e38-4f37-9883-21c6dba6a40a` | yes |
| 4 | 07:00 | `entanglement-shader-v1` | Light leaves through the glass | comet snapshot (which tweezers hold atoms): attempt 1 of the recorded load (ibm_marrakesh) | 60 x 60 R and T lookup tables | 21 (the engine's 21-qubit budget: (6 layers, 6 rays) is the largest configuration with rays >= layers that its validator accepts; (6, 7) is rejected as over 21 qubits (entry 03's probe jobs). The engine does not report an exact count.) | Atlas simulator | `743d08b4-4f6b-4bd5-9ce6-9bd135c362b6` | yes |
| 5 | 07:30 | `blur-v1` | The camera sees spots, not atoms | ideal fluorescence render (atoms x glass transmission) | blurred camera frame | 20 (1024 x 1024 region: ceil(log2 1024) x 2 = 20 (engine rule)) | Atlas statevector simulator | `d612dc36-4f02-4d6c-820e-42f9b3a8ab24` | yes |
| 6 | 08:00 | `deep-fryer-v1` | Crank the gain too far | camera frame (256 x 256) | deep-fried frame | 16 (tile_size 4 -> 4 x 4 = 16 qubits per tile (engine description; the maximum tile_size)) | Atlas statevector simulator | `c60ddf89-7ce6-4b7a-9285-9c2ffbd262b8` | yes |
| 7 | 08:15 | `tessa-image-v1` | Digitise the frame |  |  |  | fake_fez, then ibm_fez twice: every attempt failed | `56cdf27d-aae9-40ca-8ab6-d6fb20d99871` | no (failed, not counted) |
| 8 | 08:30 | `qpixl-v1` | Count the photons, call each site | 144 per-tweezer counts from blur | decoded counts; threshold 0.35 | address qubits ceil(log2 144) = 8 plus data qubits on the engine's lattice; total not reported | IBM hardware (ibm_fez) | `e3b9dbd1-8919-4667-a048-a5e112f7f6be, c9f5292e-37f6-4cdf-84c9-9a955ce79eca` | yes |
| 9 | 09:00 | `labyrinth-v1` | Plan the moves | detected zone occupancy (11/20 loaded) -> 22 wanted lanes | most likely maze opens 12 lanes; zone after moves 19/20 | 20 (one qubit per room: 4 x 5 grid = 20 (level_data.num_qubits; the target zone, the same level as the recorded Aer run)) | IBM hardware (ibm_fez) | `a8fdcac4-4a50-4168-a3b7-2c11826c6f09, 900b2088-fc88-4502-bb8b-37dd188faac2` | yes |
| 10 | 09:30 | `telablur-v1` | Drag atoms into place | before (79 atoms) and after (79 atoms) frames | the halfway frame | 21 (1024 x 1024: 20 pixel qubits + 1 selector (engine description: n + 1)) | Atlas statevector simulator | `a906c79c-ae77-43df-8d66-09bb56d52366` | yes |
| 11 | 10:00 | `graph-v1` | Switch on the Rydberg blockade | 18 atoms in the zone -> 47 blockade edges | dominant pattern 10000001111000000101; edge agreement 0.4 | 20 (num_qubits = 20 (one per zone site; engine ceiling)) | IBM hardware (ibm_fez) | `216de0ea-ca8a-4b01-8a89-6b071eaa6048, e51a6ab6-b5b9-4a55-b500-adc5381f4424` | yes |
| 12 | 11:00 | `tamagotchi-v1` | Keep the answer alive | answer 11111100110110001101 (the dominant pattern of the recorded 10:00 run) into 30 logical qubits | mean logical success 0.719 after 1 round(s) | 210 (30 logical x 7 data qubits (Steane code), plus syndrome ancillas the engine adds) | Atlas stabilizer simulator (Aer) | `443780f1-4638-473b-ab53-21166ec94834, 38c00b56-7dc4-4ad8-b39f-557c87ab80c5, 5fbfe718-5e2a-4e40-ab07-c96d390f6c64, 5ad5437e-070f-4aa0-9a9a-58b035c312b6` | yes |
| 13 | 16:00 | `blur-midi-v1` | Read the answer as a score | 141 notes from the 16 most likely patterns of the recorded 10:00 run | 85 notes | 20 (qubits = 20 per blur pass (param; engine maximum)) | Atlas statevector simulator | `d44e7ada-0857-4663-bc38-3e75e25a36d8` | yes |
| 14 | 18:00 | `retrocausal-echo-v1` | Hear how a kick spreads and returns | the blurred score, synthesised (8 s) | echoed audio, 11.0 s | 24 (n_sites = 24 (the same chain as the exact Aer run)) | IBM hardware (ibm_fez) | `4839781c-7d2b-4926-aa4b-23a62800f4c0, 8b41ba8e-014b-4d47-b98b-43bc91ba8e78` | yes |
| 15 | 20:00 | `otoc-echo-v1` | Night calibration: replay the echo with the morning's noise | the 18:00 echo settings + the morning's noise as disorder | 94 (site, depth) cells moved by the kick | 24 (n_sites = 24 (the same chain as the exact Aer run)) | IBM hardware (ibm_fez) | `18aa3832-83ff-46f1-b66a-d5c756895591, 5e851a8c-9469-47c6-9dde-e489f7a22f80` | yes |
| 16 | 21:00 | `qdrive-api-v1` | Write tomorrow's starting state | graph-v1 per-qubit <Z> | a 20-qubit QASM3 circuit, 60 single-qubit rotations | 20 (n_qubits = 20 (param)) | Atlas simulator (Aer) | `d36275c5-17d8-43b0-bdc3-4e3da66bf1fc` | yes |
| 17 | 22:00 | `tomography-api-v2` | Check tomorrow's state |  |  |  | Atlas simulator (Aer) | `a26d52ac-ba54-43c5-961e-69f4418da794` | no (failed, not counted) |
| 18 | 23:00 | `blur-core-v1` | Blur a slice of the day's record | 375 bitstrings x 144 qubits from comet's counts (the first 375 in sorted order; no time order) | same grid, blurred along the bitstring (sorted-order) axes only | 19 (sum of ceil(log2 d) over the grid 5 x 5 x 5 x 3 x 144 = 3+3+3+2+8 = 19 (engine rule). A 22-qubit request was refused (HTTP 413, 1 MB body limit) and a 21-qubit run could not return its ~6 MB result, so 19 is the largest grid this record fits.) | Atlas statevector simulator | `76083b0e-a4b7-46d3-ade5-fb729448d876` | yes |

## Hop scores

F = classical (Bhattacharyya) fidelity between what a stage received and what it handed on, on the outcomes both share. Chance = the same F with outcomes shuffled (or 0.5 per yes/no outcome).

| Time | Engine | From | F | Chance | Outcomes | Metric |
|---|---|---|---|---|---|---|
| 05:00 | `coin-toss-v1` | design | 0.9998 | – | loaded / empty | Bernoulli fidelity between the design odds (0.5) and the measured heads fraction |
| 05:30 | `comet-qrng-v1` | coin | 0.9999 | – | loaded / empty | Bernoulli fidelity: the 1-qubit coin's odds vs the 148-qubit register's mean fill |
| 06:00 | `qrc-image-v1` | comet | 0.998 | 0.0617 | 64 frame-to-frame transitions | F between the frame-to-frame transitions it was taught and the ones it played |
| 07:00 | `entanglement-shader-v1` | comet | 0.9904 | 0.2491 | 144 tweezer sites | F between where the atoms are and where the transmitted light is |
| 07:30 | `blur-v1` | shader | 1.0 | 0.2465 | 144 tweezer sites | F between transmitted light per tweezer and camera counts per tweezer |
| 08:00 | `deep-fryer-v1` | blur | 0.4985 | 0.4948 | 144 tweezer sites | F between camera counts per tweezer before and after frying |
| 08:30 | `qpixl-v1` | blur | 0.7429 | 0.4301 | 144 tweezer sites | F between the counts sent in and the counts decoded |
| 09:00 | `labyrinth-v1` | qpixl | 0.5467 | 0.5 | 31 lanes | mean per-lane fidelity: how often each lane came out as asked (open or wall) |
| 09:30 | `telablur-v1` | maze | 0.5299 | 0.4735 | 144 tweezer sites | F between a plain 50/50 mix of before and after and the engine's halfway frame |
| 10:00 | `graph-v1` | telablur | 0.5421 | 0.5 | 47 blockade edges | mean per-edge fidelity with the anti-aligned (blockade-like) target, estimated from the patterns measured on ibm_fez (the 20 most frequent, 2.8% of the shots) |
| 11:00 | `tamagotchi-v1` | graph | 0.7187 | 0.5 | 30 logical qubits | mean per-logical fidelity: probability each logical qubit reads back the bit it was given |
| 16:00 | `blur-midi-v1` | graph | 0.2847 | 0.1401 | 38 pitches x 16 beats | F between the piano rolls before and after (velocity in every beat a note sounds, pitch x beat) |
| 18:00 | `retrocausal-echo-v1` | blurmidi | 0.3744 | 0.0331 | bands x frames | F between the dry and echoed sound (24 log bands x 93 ms frames) |
| 20:00 | `otoc-echo-v1` | retro | 0.552 | 0.1734 | 24 sites x 8 depths | F between where the kick spread in the clean echo (18:00 on ibm_fez) and in the disordered one, (1 - Re F)/2 per site and depth |
| 21:00 | `qdrive-api-v1` | graph | 0.9997 | 0.5 | 20 qubits | mean per-qubit fidelity between the target and achieved excitation odds |
| 23:00 | `blur-core-v1` | comet | 0.422 | 0.3779 | 54,000 bits | F between the raw and the blurred grid (every bitstring x every tweezer) |

## Failed or unfinished jobs (not counted)

| Engine | Job ID | What happened | Note |
|---|---|---|---|
| `entanglement-shader-v0` | `0a3403b4-dadb-4868-83e4-610102a079ea` | engine_timeout | budget probe; accepted at submission instead of rejected, then timed out. Not used. |
| `entanglement-shader-v0` | `c6758568-bf8e-4868-b122-da6f95c8f82d` | engine_timeout | budget probe; not used. |
| `coin-toss-v1` | `78ab6835-0a3f-48c1-8f09-a491f6cf5c2b` | unavailable: Stream removed (Socket closed) at the IBM submit step | retried once with the platform's least-busy backend |
| `comet-qrng-v1` | `dc042700-e2a2-4386-b4de-db8d5cf6d86e` | unavailable at the IBM submit step (Resolving IBM backend) | retried once on ibm_marrakesh |
| `graph-v1` | `a9b7f426-b0c4-40c6-992a-6ababba6be30` | validation_error at build: every qubit must appear in coupling_map; missing [15, 18] (the two empty 'ghost' sites) | our bug; retried once with the full zone lattice in coupling_map |
| `tessa-image-v1` | `ca5e2709-ead8-49d7-b8fd-425422677d3d` | engine_timeout (The engine did not respond in time) | known server timeouts: tried once, not retried, not credited |
| `tamagotchi-v1` | `888ac6e7-fc77-43ef-b52d-72a3cbd280d9` | engine_timeout | free (0 credits); engine not responding during the build |
| `tomography-api-v2` | `a26d52ac-ba54-43c5-961e-69f4418da794` | engine_timeout (The engine did not respond in time) | known server timeouts: tried once, not retried, not credited |
| `blur-core-v1` | none (refused before a job was created) | HTTP 413: request body over the 1,048,576-byte limit | no job created, no credit; re-run at 21 qubits (17 x 129 x 144) |
| `blur-core-v1` | `be4f42aa-b492-4eff-8a42-f6908d7b1b32` | internal_error [TMPRL1103]: the engine finished ('Recovered 21-qubit grid from measurement') but its ~6 MB result exceeded the platform's payload limit | re-run once at 19 qubits (5 x 5 x 5 x 3 x 144), whose result fits |
| `coin-toss-v1` | `2c2263b1-ed55-4d65-a759-35bf84e17e7f` | ibm_fez re-run of the 05:00 stage (same input as the recorded run), submitted 2026-10-05T14:11:37Z: QPU job ended as failed (ibm_collection_failed) | 2 credits ledgered; not counted |
| `comet-qrng-v1` | `456b4798-c8b7-4c44-bdb8-918a17573e3c` | ibm_fez re-run of the 05:30 stage (same input as the recorded run), submitted 2026-10-05T14:11:09Z: QPU job ended as failed (collection_failed) | 5 credits ledgered; not counted |
| `tessa-image-v1` | `ed0a2239-725c-4bf3-9db9-3e6a6d725d28` | ibm_fez re-run of the 08:15 stage (same input as the recorded run), submitted 2026-10-05T14:11:56Z: The engine did not respond in time — retry the job (engine_timeout) | 1 credits ledgered; not counted |
| `tessa-image-v1` | `56cdf27d-aae9-40ca-8ab6-d6fb20d99871` | ibm_fez re-run of the 08:15 stage (same input as the recorded run), submitted 2026-10-05T19:08:53Z: The engine did not respond in time — retry the job (engine_timeout) | 1 credits ledgered; not counted |
| `qpixl-v1` | `af52a90e-b29e-41fc-b613-aa3824122ef2` | ibm_fez re-run of the 08:30 stage (same input as the recorded run), submitted 2026-10-05T14:11:45Z: [ibm_submission_failed] submitting the job to IBM failed (ibm_submission_failed) | 1 credits ledgered; not counted |
| `labyrinth-v1` | `0a04c9e1-18ec-430b-bb27-be2075d75c67` | ibm_fez re-run of the 09:00 stage (same input as the recorded run), submitted 2026-10-05T14:11:19Z: QPU job ended as failed (ibm_collection_failed) | 5 credits ledgered; not counted |
| `graph-v1` | `122de1c4-d04e-41cb-aba6-5633cc20d3a7` | ibm_fez re-run of the 10:00 stage (same input as the recorded run), submitted 2026-10-05T14:11:28Z: QPU job ended as failed (ibm_collection_failed) | 5 credits ledgered; not counted |
| `retrocausal-echo-v1` | `3d9695df-61ea-413b-9a4f-e16a223a047b` | ibm_fez re-run of the 18:00 stage (same input as the recorded run), submitted 2026-10-05T14:12:38Z: ibm_fez estimator failed: [job_failed] job ended as failed (execution_failed) | 2 credits ledgered; not counted |
| `otoc-echo-v1` | `2ef272dc-c355-4baa-b3af-7e8e56953101` | ibm_fez re-run of the 20:00 stage (same input as the recorded run), submitted 2026-10-05T14:12:48Z: ibm_fez estimator failed: [job_failed] job ended as failed (execution_failed) | 1 credits ledgered; not counted |
| `tamagotchi-v1` | `b5e06df9-0c7b-49b7-8b51-c9af66534c4c` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `bcdde688-30ff-4648-9857-977d6fc574a9` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `dbbb1f0d-f78d-40dc-ac79-c94953700682` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `4ec03495-4220-4356-a100-af2e32b3a6bd` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `fb8ddbc7-4dbd-43c3-988e-9f3effe8f5f0` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `c31f336f-4ef7-43e6-8c87-7cf009859f0c` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `d0b80509-f70d-4f5f-942d-12f9768acca7` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `ad56356d-8fed-4b8c-8836-83353466edd7` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `1bfa57e9-b288-466b-85f2-d180bb325d43` | did not complete (engine not responding during the build) | 0 credits; not counted |
| `tamagotchi-v1` | `526f0d31-62fa-4d16-92d2-e6e5059481a8` | did not complete (engine not responding during the build) | 0 credits; not counted |

tamagotchi-v1 costs 0 credits. It was submitted 16 times by this piece: 4 completed runs are the 11:00 stage, 1 completed probe (1 logical qubit) is not used, and the other 11 attempts (1 to 90 logical qubits) failed with 'engine did not respond' while the engine was down. 60 and 90 logical qubits were never reached, so 30 is the size used.

## ibm_fez runs (5 October 2026)

ibm_fez (IBM Heron r2, 156 qubits) is the default hardware target in `stages.py` (`HW = "ibm_fez"`). Every hardware-capable stage was sent there on the same input it had in the recorded day. The first pass (14:11 to 14:15 UTC) failed on IBM's side for every stage, in the same window in which every ibm_fez job from every piece of this project failed; each stage was then retried once (coin-toss-v1 at 14:26 UTC, the rest from 19:08 UTC). Where the ibm_fez job completed, it is the stage's primary result on the page (scene, charts, readout, hop F, Tweezy's face, the gauge and the survival curve), and the recorded run stays beside it as a labelled comparison (a Run switch on the card). The later stages keep reading the recorded run, because that is the run they were fed; re-feeding the whole day from ibm_fez would need new jobs for every downstream stage. A stage whose ibm_fez job failed twice keeps its recorded run (or no result), labelled on its card.

| Time | Engine | Qubits | ibm_fez result | ibm_fez job ID(s) | Recorded run kept beside it |
|---|---|---|---|---|---|
| 05:00 | `coin-toss-v1` | 1 | **completed**: primary on the page | `d27e51b3-464d-48d6-97ca-97b2bb49072a` (earlier try `2c2263b1-ed55-4d65-a759-35bf84e17e7f` failed: QPU job ended as failed (ibm_collection_failed)) | IBM hardware (ibm_marrakesh), `83ad70dc-cb9c-4acf-9def-fbc0a15034d6` |
| 05:30 | `comet-qrng-v1` | 156 | **completed**: primary on the page | `7a6587bb-9185-4038-a7d2-fab4c5a87193` (earlier try `456b4798-c8b7-4c44-bdb8-918a17573e3c` failed: QPU job ended as failed (collection_failed)) | IBM hardware (ibm_marrakesh), `f7749ef9-75fe-47d2-8120-74cd86d36478` |
| 08:15 | `tessa-image-v1` | – | did not complete after 2 tries | `ed0a2239-725c-4bf3-9db9-3e6a6d725d28` failed: The engine did not respond in time — retry the job (engine_timeout); `56cdf27d-aae9-40ca-8ab6-d6fb20d99871` failed: The engine did not respond in time — retry the job (engine_timeout) | none: the recorded day's attempt failed too, so the stage has no result |
| 08:30 | `qpixl-v1` | not reported | **completed**: primary on the page | `e3b9dbd1-8919-4667-a048-a5e112f7f6be` (earlier try `af52a90e-b29e-41fc-b613-aa3824122ef2` failed: [ibm_submission_failed] submitting the job to IBM failed (ibm_submission_failed)) | Atlas emulator (fake_fez noise model), `c9f5292e-37f6-4cdf-84c9-9a955ce79eca` |
| 09:00 | `labyrinth-v1` | 20 | **completed**: primary on the page | `a8fdcac4-4a50-4168-a3b7-2c11826c6f09` (earlier try `0a04c9e1-18ec-430b-bb27-be2075d75c67` failed: QPU job ended as failed (ibm_collection_failed)) | Atlas emulator (Aer, noiseless), `900b2088-fc88-4502-bb8b-37dd188faac2` |
| 10:00 | `graph-v1` | 20 | **completed**: primary on the page | `216de0ea-ca8a-4b01-8a89-6b071eaa6048` (earlier try `122de1c4-d04e-41cb-aba6-5633cc20d3a7` failed: QPU job ended as failed (ibm_collection_failed)) | Atlas emulator (Aer, noiseless), `e51a6ab6-b5b9-4a55-b500-adc5381f4424` |
| 18:00 | `retrocausal-echo-v1` | 24 | **completed**: primary on the page | `4839781c-7d2b-4926-aa4b-23a62800f4c0` (earlier try `3d9695df-61ea-413b-9a4f-e16a223a047b` failed: ibm_fez estimator failed: [job_failed] job ended as failed (execution_failed)) | Atlas simulator (Aer, exact), `8b41ba8e-014b-4d47-b98b-43bc91ba8e78` |
| 20:00 | `otoc-echo-v1` | 24 | **completed**: primary on the page | `18aa3832-83ff-46f1-b66a-d5c756895591` (earlier try `2ef272dc-c355-4baa-b3af-7e8e56953101` failed: ibm_fez estimator failed: [job_failed] job ended as failed (execution_failed)) | Atlas simulator (Aer, exact), `5e851a8c-9469-47c6-9dde-e489f7a22f80` |

Not run on ibm_fez: qdrive-api-v1 (its `machine='ibm_fez'` is rejected at run time with `invalid_machine`, 'reserved for a future IBM Quantum Runtime backend ... not wired up yet', as entry 19's jobs 35c1e8df, fa5a9846 and b4a7e89a found; a run would only spend a credit) and tomography-api-v2 (its schema takes free-text `provider_name` / `backend_name` with no list of values and the engine has no validation step, so there is no free 422 probe; no IBM provider name is documented; and its only run, on Aer, failed at once with an engine timeout). tamagotchi-v1 and the blur family are simulator-only engines and stay on their simulators.

## Ordering note (comet's record)

comet-qrng-v1 returns counts per bitstring (`raw.memory_available` is false), so there is no shot-by-shot time order. All 10,000 bitstrings were distinct and the counts arrive with their keys sorted lexicographically. The 16 loading attempts shown at 05:30 (the first eight are also the 06:00 qrc-image vocabulary) are the bitstrings at the positions given by comet's own 16 conditioned random integers, in that order. The 23:00 blur-core grid is the first 375 keys of the sorted counts, so it is not a time series: its first four tweezers read 0 in every bitstring and the next ones fill in as a staircase because of the sort, not because of drift. A re-run on randomly chosen rows was not possible inside the 50-credit cap.
