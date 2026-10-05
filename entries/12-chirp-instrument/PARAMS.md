# Parameters: blur-midi-v1 on the GW150914 chirp

Engine: **Atlas blur-midi-v1** (Quantum Blur for MIDI), run on Atlas's simulator. Its docs list no
hardware mode. Each run costs 1 credit.

Input: `midi/GW150914_chirp.mid` (SMF 1, 480 ticks/beat, 120 bpm, tracks "H1 Hanford" and
"L1 Livingston", 21 notes each, MIDI 46–77). It was uploaded once as asset
`a3be319a-40c8-453a-b993-2dac3ac27234`. The GW170817 MIDI was uploaded as asset
`7f8335c8-c9b1-4fb3-879e-d98cf0db824a`, but it never received a completed job.

Fixed parameters: `qubits = 20` (the engine maximum), `resolution = 2` (ticks per roll step), plus
the defaults `threshold = 0.1` and `margin = 0.15`.

Qubits per pass, computed by us (the engine does not report its width): 42 pitch rows × 11,633 (H1)
or 11,281 (L1) steps gives ⌈log₂ 42⌉ + ⌈log₂ 11,633⌉ = 6 + 14 = **20**. The cached job records
(`cache/blur-midi-v1/914ca62ba1bb71fe.json`, `1fa65bba7acb3ecd.json`) show `qubits = 20` and
`resolution = 2` were sent, and the reach-0.5 output spans MIDI 41–82 (42 rows), which matches.

## Completed jobs (used in the piece)

| event | strength | reach | qubits | resolution | job_id | runtime | notes out |
|---|---|---|---|---|---|---|---|
| GW150914 | 0.5 | 0.0 | 20 | 2 | `3d69e83c-cc19-4a91-9d9f-d30170dd4b04` | 293.6 s | 251 |
| GW150914 | 0.5 | 0.5 | 20 | 2 | `9c28f32b-e560-4a0d-9e91-f97ee3e221ba` | 349.5 s | 9,444 |

Backend: Atlas simulator, for both.

## Submitted but not completed (all ledgered; none used)

Each of these failed with the engine status *"The engine did not respond in time — retry the job"*.
A read-only status check on 2026-10-04 (no credits) confirmed all nine are still `failed`.

| event | strength | reach | failed job_ids |
|---|---|---|---|
| GW150914 | 1.0 | 0.0 | `886a934a-8704-4031-9733-5a341d3f9bd1`, `2809ac99-25e6-4681-8211-5b204535df3f`, `7e0eb695-789f-4779-80fb-f6903cbaaf21` |
| GW150914 | 1.0 | 1.0 | `77d619a1-a610-406e-b216-66237d241789`, `77494cdb-e87a-4db9-9926-574f53451034`, `13785863-0ebf-4e5e-9742-028c570f4a84` |
| GW170817 | 0.5 | 0.5 | `ad99770a-29a3-45a1-916b-bb56d306b316`, `236b2a82-50fc-493b-a950-89207eedbf36`, `77e8688c-2289-4378-b836-9adf69dafad8` |

## Planned but never submitted (credit cap reached)

GW150914 s0.5/r1.0, s1.0/r0.5; GW170817 s0.5/r0.0, s0.5/r1.0.

**Ledgered spend: 11 credits against a cap of 10** (2 completed + 9 failed). The 1-credit overspend
came from a race between parallel workers that I launched by mistake. It cannot be undone, and it
needs the lead's explicit acceptance. No further job has been submitted for this piece. Completing
the brief's reach sweep at strength 0.5 (GW150914 s0.5/r1.0) needs 1 more credit, which only the
lead can approve by raising the cap. See README, "What is missing".
