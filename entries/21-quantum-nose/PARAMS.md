# Parameters: blur-midi-v1 sweep (20 qubits per pass)

Engine: **blur-midi-v1** (Atlas, "Blur Jazz"), run on Atlas's classical statevector simulator (the engine has no QPU mode). 1 credit per job.
Input: `midi/nose_input.mid` (SMF type 1, 480 ticks/beat, 120 bpm), written by `make_midi.py`: track 0 = tempo, tracks 1-6 = one vibrational chord each.
Fixed in every job: `qubits` = 20 (the engine maximum), `resolution` = 1 tick per piano-roll step; `threshold` 0.1, `margin` 0.15 and `mask` (none) at their defaults.

## Qubits per track (computed, not reported by the engine)

Quantum Blur stores a w x h grid in ceil(log2 w) + ceil(log2 h) qubits. Pitch rows = the track's bin span plus the engine's 15 % margin above and below (our estimate of its rounding); time steps = 6,720 ticks at 1 tick per step. The engine's progress messages confirmed that it processes the six tracks one by one ("Track 2/6: 'acetophenone D' (ticks_per_step=1 ...)").

| track | chord | lines in | MIDI bins | pitch rows (est.) | time steps | qubits |
|---|---|---|---|---|---|---|
| 1 | acetophenone H | 10 | 25-109 | 111 (7 qubits) | 6720 (13 qubits) | **20** |
| 2 | acetophenone D | 10 | 20-80 | 79 (7 qubits) | 6720 (13 qubits) | **20** |
| 3 | exaltone H | 9 | 26-105 | 104 (7 qubits) | 6720 (13 qubits) | **20** |
| 4 | exaltone D | 9 | 19-77 | 77 (7 qubits) | 6720 (13 qubits) | **20** |
| 5 | muscone H | 9 | 26-106 | 105 (7 qubits) | 6720 (13 qubits) | **20** |
| 6 | muscone D | 8 | 19-77 | 77 (7 qubits) | 6720 (13 qubits) | **20** |

## Jobs

| strength | reach | qubits | resolution | job_id | status | seconds | notes out (6 tracks) |
|---|---|---|---|---|---|---|---|
| 0.5 | 0.0 | 20 | 1 | `3ec2fa86-1e65-4f4d-a6cb-753e3aa40927` | completed | 385.8 | 34 / 42 / 21 / 22 / 22 / 16 |
| 1.0 | 0.0 | 20 | 1 | `3262bd95-e38d-48eb-80aa-6a38df940d6d` | completed | 382.9 | 36 / 19 / 25 / 27 / 21 / 34 |
| 0.5 | 1.0 | 20 | 1 | `1c641dc5-07ea-4d31-8866-a1cbb17c1aaf` | completed | 394.2 | 3435 / 2670 / 3036 / 2323 / 2723 / 2197 |
| 1.0 | 1.0 | 20 | 1 | `60c0f670-9281-4f31-978b-eae73e541b99` | completed | 300.2 | 25 / 56 / 25 / 51 / 30 / 55 |
| 0.25 | 0.0 | 20 | 1 | `33527af0-db51-4800-ae9b-374f2b56e46e` | completed | 389.6 | 17 / 18 / 17 / 15 / 14 / 13 |
| 0.25 | 1.0 | 20 | 1 | `97554219-5053-45ea-a4f8-39d7e7de6070` | completed | 382.0 | 1123 / 774 / 617 / 775 / 419 / 592 |
| 0.5 | 0.5 | 20 | 1 | `ac3f10b1-a726-4bb7-b753-7dcef0ba4230` | completed | 404.2 | 998 / 964 / 872 / 517 / 748 / 868 |
| 1.0 | 0.5 | 20 | 1 | `75ea65fc-608c-41b1-a201-3024ee36cb89` | completed | 451.7 | 2841 / 1860 / 3731 / 2522 / 2102 / 3036 |
| 0.25 | 0.5 | 20 | 1 | `40b6c6c3-5042-4933-ab4f-b25bf44d3b59` | completed | 453.9 | 113 / 137 / 79 / 119 / 65 / 103 |

Notes in the input score, same track order: 10 / 10 / 9 / 9 / 9 / 8.

Ledgered spend for `21-quantum-nose`: **9 credits** (9 submissions, cap 10).
Every ledgered submission completed and is used above.
