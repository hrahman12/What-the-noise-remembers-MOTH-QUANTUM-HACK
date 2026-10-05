# Parameters: blur-midi-v1 sweep (qubits = 20)

Engine: **blur-midi-v1** ("Blur Jazz"), Atlas, run on Atlas's **classical statevector simulator** (the
engine has no hardware mode). 1 credit per job; 6 jobs, 6 credits ledgered for `16-busy-beaver-score`
(cap 6).

Input: `midi` = `score_raw.mid` (SMF type 1, 480 PPQ, 548,880 ticks, tracks "Head" and "Rule";
uploaded once as asset `bb2ba5fb-c4fc-4dd5-869b-f43241b73d1a`). Raw score: 5,149 notes.
Fixed at engine defaults on every job: `margin` = 0.15, `threshold` = 0.1, `mask` = none (both tracks
blurred in full). `qubits` = 20 on every job, the engine maximum.

| strength | reach | resolution | time steps | qubits (param) | qubits per pass (computed) | notes out | job_id | status |
|---|---|---|---|---|---|---|---|---|
| 0.5 | 0 | auto (120 ticks) | 4,574 | 20 | 13 + 6 = 19 | 9,056 | `b381e140-9a0a-47fe-91e3-dbaf1bf23bf1` | completed |
| 0.5 | 1 | auto (120 ticks) | 4,574 | 20 | 13 + 6 = 19 | 122,594 | `d2b903cb-d19b-40f8-b563-5bad3358ab33` | completed |
| 0.2 | 0 | auto (120 ticks) | 4,574 | 20 | 13 + 6 = 19 | 2,969 | `12937e69-9f44-4b27-bae3-76ade15470d9` | completed |
| 0.2 | 1 | auto (120 ticks) | 4,574 | 20 | 13 + 6 = 19 | 8,610 | `f5421e0a-8dc2-4f29-b601-6fcfb490931d` | completed |
| 0.2 | 0 | 60 ticks | 9,148 | 20 | 14 + 6 = **20** | 5,189 | `18061f8a-2b45-4838-8ab5-090e006031f2` | completed |
| 0.2 | 1 | 60 ticks | 9,148 | 20 | 14 + 6 = **20** | 10,625 | `2a3766bd-8ee3-4ec0-ac6b-9aabcfb8a01c` | completed |

**How the qubits are known.** The engine reports no qubit count; its result is just the MIDI file.
We computed it from QuantumBlur's grid rule, qubits = ⌈log₂ Lx⌉ + ⌈log₂ Ly⌉ (`make_grid` in the
QuantumBlur source), for the melody track's roll:
- time steps = 548,880 ticks ÷ resolution. "Auto" is the 5th-percentile note duration, 120 ticks;
  every output onset lands on that grid.
- pitch rows: the raw melody spans MIDI 45–93 (49 pitches). The outputs span 38–93: 7 rows of
  margin below (15 % of the 48-semitone span) and none above. That is 56 rows, or 63 if the margin is
  also padded above with nothing landing there. Either way, 6 qubits.

The bass ("Rule") roll is smaller: the raw score's bass spans MIDI 34–45 (12 pitches) and only the blurred
outputs reach down to 32 (the margin again), so at most 14 rows = 4 qubits. It needs fewer.

**Why these settings.** Strength 0.5 (the engine default) at reach 0 and 1 came first. At reach 1 it
gave a near-uniform cloud with no trace of the score, so strength 0.2 was added to hear a recognisable
global echo. The two resolution-60 jobs halve the time step so the melody roll needs the full 20-qubit
budget by the rule above.

**Headline jobs** (the WAVs and the page's default blur): strength 0.2, resolution 60, reach 0
(`18061f8a-…`) and reach 1 (`2a3766bd-…`).

All outputs: `out/blur_s<strength>_r<reach>[_res60].mid`, listed in `out/jobs.csv`.
