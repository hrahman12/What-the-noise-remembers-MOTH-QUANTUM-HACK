# Tweezer

**Moth Hack 2026 · Challenge 06, Daisy Chain · What the Noise Remembers · Lose**

**Walk one atom array through a day, engine by engine.**

A day in the life of a neutral-atom quantum computer, told by a chain of Atlas engines. Each stage takes an earlier
stage's real output and hands on its own: IBM hardware loads the tweezers, a shader is the vacuum-cell glass, a quantum
blur is the camera, QPIXL reads the photon counts, a labyrinth plans the moves, a teleblur drags atoms into place, a
graph state stands in for the Rydberg blockade, a blurred score and a quantum echo carry it into the evening, and the
night ends with calibration and a blurred slice of the day's record. At every hop the piece measures how much of the signal
survived, and sets that against what chance alone would score.

Atlas runs gate-model circuits and simulators, **not atoms**. Every stage is labelled with what stood in for what.

## Use it

Open `web/index.html`. Nothing plays on its own.

**The pixel lab (the hero).** The day is a walkable path of 18 pixel-art stations, one per stage: a coin, a loading
hopper, a film strip, the vacuum-cell glass, a camera, a frying pan, a digitiser, a clipboard of site calls, a maze, a
conveyor, a glowing Rydberg atom, a tamagotchi, a score, a speaker, an oscilloscope, a floppy disk, a magnifier and a
tape deck. The mascot, **Tweezy** (an atom held in an optical-tweezer beam), walks to whichever station you tap (or
*Earlier / Later*, or the arrow keys), and a pixel lab clock sweeps to that stage's hour, with a day/night window.
Tweezy's face is the hop's real result, never set by hand: beaming where survival F beats chance by 0.25 or more, flat
where it beats chance by less, dizzy within 0.06 of chance, sweating at the two taped-off stations whose jobs failed. A
chip badge marks the stations that ran on IBM hardware (ibm_fez). Its speech bubble states the stage's real numbers.

**Each stage: Scene / Data.** The stage card opens on a pixel scene drawn from that stage's cached output, with a
toggle to *Data* for the original charts and engine frames. A stage that ran on IBM ibm_fez shows that run (labelled
*IBM ibm_fez, N qubits, job ...*) and has a *Run* switch to the recorded run of the same input, kept as a labelled
comparison:

| Stage | Scene (every placement from the real data) |
|---|---|
| 05:00 coin | Two jars fill with 74 caught atoms and 70 empty rings on ibm_fez (70 / 74 in the recorded ibm_marrakesh run); totals only, the replay order is not recorded, and says so |
| 05:30 comet | The 12 x 12 array of tweezer beams with an atom in every loaded site, for each of comet's 16 picked attempts; tap a tweezer for its 10,000-shot rate |
| 06:00 qrc-image | The array flickers through the attempts in the order the reservoir played them, with the played-token strip |
| 07:00 shader | Atoms dimmed by the transmission read off the engine's table at each tweezer's angle; tap for the value |
| 07:30 blur | A camera viewfinder with the real ideal and blurred frames; *Snap* flashes (decoration) |
| 08:00 fryer | The camera frame and the fried output in a pan on a burner (flames are decoration) |
| 08:15, 22:00 | Taped-off stations with a CLOSED sign and the server's message |
| 08:30 qpixl | Every site called at the threshold you set: atoms, ghosts (called loaded, really empty), faded atoms (missed) |
| 09:00 labyrinth | The target zone as rooms; the engine's maze as walls and bridges; *Run the moves* sends atoms in by the classical rule |
| 09:30 telablur | A bright tweezer drags each planned move; ghosts stay ghosts |
| 10:00 graph | Atoms that read 1 in the chosen measured pattern glow; sparks mark blockade clashes; the two ghost sites never glow |
| 11:00 tamagotchi | Thirty pets, one per logical qubit, whose mood is its real read-back rate (bands stated on the page) |
| 16:00 blur-midi | A xylophone with one bar per pitch; bars light as the real notes play |
| 18:00 echo | A speaker and a cliff; wave strength follows the real recording's loudness, the bounce is a picture |
| 20:00 otoc | A chain of 24 atoms whose glow and shake follow the engine's echo map at each depth |
| 21:00 qdrive | Twenty atoms with spin needles at arccos<Z> read off QDrive's circuit, against the dotted targets |
| 23:00 blur-core | The record as a tape between two reels, raw or blurred (sorted order, not time order, stated) |

Motion (falling atoms, flips, flames, reels, waves) is decoration on top of the data; the page's *Who's who in the
pixel lab* drawer says which is which. Sprites are authored in `make_sprites.py`, stored once in `web/sprites.json`,
drawn by the shared `common/inksprite.js` at integer scale with no smoothing, in the shared ink palette (orange only for
light, glow and fire). The hub mascot is `web/img/mascot.png` (Tweezy, exported with `common/mascot.py`).

- **Judge** each hop: the card shows survival F against the chance line, the survival curve (rail) shows every hop and
  navigates, and *What actually ran* (under *Jobs and credits*) gives the engine, where it ran, qubits and how we know,
  job ID, params, input and output. `#stage-id` links (e.g. `#graph`) open a stage directly; *Copy link to this stage*
  shares one.
- The 24-hour dial of the earlier build is back in the rail (*The day · tap an hour*): one marker per stage, tap one to
  open that stage; it sits beside the pixel lab clock, which does the same from the lab.

**Sections under the lab.** *How to play* (the three steps, and the *Who's who in the pixel lab* drawer); *The data*
(every stage's charts and engine frames at once, each titled, with its captions and its hop score, live and
interactive, with *Show in the lab* to walk Tweezy there; the stage open in the card is outlined); *The whole day as a
film*; *The science* (*Why a neutral-atom day?*, *How survival is scored*); *What this does not claim* (the honesty
note, always visible); *Jobs and credits* (*What actually ran*, *Every engine, every job* and the credits).

Every sound deliverable plays in the page, from visible controls only. The always-visible *Every sound in the day*
panel lists all five, each with a play/stop pill and a progress hairline: `out/readout_score.mid` and
`out/readout_blurred.mid` (the blur-midi-v1 output), read by `build_web.py` and synthesised in the browser with Web
Audio (a plain sine synth, classical), and `out/echo_in.wav` (the dry input), `out/echo_out_fez.wav` (the
retrocausal-echo-v1 output on IBM ibm_fez, the 18:00 stage's primary run) and `out/echo_out.wav` (the recorded exact Aer
run, kept as a comparison), played from `web/audio/*.mp3` (22.05 kHz, 128 kbps conversions; the engine WAVs stay untouched in `out/`). The 16:00
and 18:00 cards also have their own players. One sound at a time: starting any sound stops the others, and nothing
plays before a click.

`tweezer_day.mp4` is a 60 s walk through the completed stages, each drawn from its primary run (the ibm_fez run where it
completed; soundtrack: the 18:00 ibm_fez echo output, looped). It is on
the page as *The whole day as a film*: a `<video controls playsinline preload="metadata">` (no autoplay) playing
`web/video/tweezer_day.mp4`, an H.264/AAC faststart re-encode (1.9 MB) made by `build_web.py`, with a poster frame.
The video source is attached when the player nears the viewport, and playing it stops any other sound.

Page look: the Moth Hack 2026 brief-page style from `common/brand.css` (paper and one ultramarine ink, mono labels,
hairlines, square panels, pill buttons, single light theme). Charts, dials and overlays are drawn in that palette;
engine-output images (fluorescence frames, the telablur frames, the fried frame, the reservoir's input frames, the
shader table's colours) keep their own colours.

## The day

| Time | Stage | Engine | Where it ran | Qubits | F | Chance | From |
|---|---|---|---|---|---|---|---|
| 05:00 | Will a tweezer catch an atom? | coin-toss-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: IBM hardware (ibm_marrakesh), F 1.000 | 1 | 1.000 | – | design odds 0.5 |
| 05:30 | Load the whole array at once | comet-qrng-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: IBM hardware (ibm_marrakesh), F 1.000 | **156** | 1.000 | – | coin |
| 06:00 | The morning flicker | qrc-image-v1 | Atlas simulator (quantum reservoir) | not reported | 0.998 | 0.062 | comet |
| 07:00 | Light leaves through the glass | entanglement-shader-v1 | Atlas simulator | 21 (budget) | 0.990 | 0.249 | comet |
| 07:30 | The camera sees spots, not atoms | blur-v1 | statevector simulator | 20 | 1.000 | 0.246 | shader |
| 08:00 | Crank the gain too far (side branch) | deep-fryer-v1 | statevector simulator | 16 per tile | 0.498 | 0.495 | blur |
| 08:15 | Digitise the frame | tessa-image-v1 | – | – | **failed** (engine timeout on fake_fez and twice on ibm_fez) | | |
| 08:30 | Count the photons, call each site | qpixl-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: emulator, fake_fez noise model, F 0.843 | not reported | 0.743 | 0.430 | blur |
| 09:00 | Plan the moves | labyrinth-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: Aer emulator (noiseless), F 0.675 | 20 | 0.547 | 0.500 | qpixl |
| 09:30 | Drag atoms into place | telablur-v1 | statevector simulator | 21 | 0.530 | 0.473 | labyrinth |
| 10:00 | Switch on the Rydberg blockade | graph-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: Aer emulator (noiseless), F 0.510 | 20 | 0.542 | 0.500 | telablur |
| 11:00 | Keep the answer alive (side branch) | tamagotchi-v1 | stabilizer simulator (Aer) | 210 data (30 logical × 7) | 0.719 | 0.500 | graph |
| 16:00 | Read the answer as a score | blur-midi-v1 | statevector simulator | 20 | 0.285 | 0.140 | graph |
| 18:00 | Hear how a kick spreads and returns | retrocausal-echo-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: Aer, exact, F 0.974 | 24 | 0.374 | 0.033 | blur-midi |
| 20:00 | Night calibration: replay the echo with the morning's noise | otoc-echo-v1 | **IBM hardware (ibm_fez)**; recorded run beside it: Aer, exact, F 0.999 | 24 | 0.552 | 0.173 | retrocausal-echo |
| 21:00 | Write tomorrow's starting state | qdrive-api-v1 | Aer | 20 | 1.000 | 0.500 | graph |
| 22:00 | Check tomorrow's state | tomography-api-v2 | – | – | **failed** (server timeout) | | |
| 23:00 | Blur a slice of the day's record | blur-core-v1 | statevector simulator | 19 | 0.422 | 0.378 | comet |

**16 engines completed, 26 completed jobs counted (tamagotchi ran 4 settings; 7 stages also keep their recorded run as a labelled comparison), 7 hops on IBM ibm_fez with 156 qubits on IBM ibm_fez at most, and 210 data qubits in the stabilizer simulation.** The full table
with inputs, outputs, how each qubit count is known, and every job ID (completed and failed) is in
[ENGINES.md](ENGINES.md); the parameters of every completed job are in [PARAMS.md](PARAMS.md).

What the curve says, honestly: the loading and imaging hops keep their signal (F of 0.99 to 1.00, far above chance);
the photon readout loses some: on the real ibm_fez chip QPIXL's decoded counts score 0.74 against a chance line of 0.43,
with 130 of 144 sites still called right at the classical threshold (the recorded run on the fake_fez noise model scored
0.84 vs 0.39, 137 of 144); the planning, rearrangement and blockade hops sit close to chance (on ibm_fez the labyrinth
scores 0.55 and the blockade 0.54, against 0.50), because the labyrinth samples a noisy maze, the teleblur's halfway frame is an
interference pattern rather than a blend, and on a King's graph every triangle is frustrated so graph-v1's ZZ targets
cancel out (mean ⟨ZZ⟩ on the 47 edges is −0.02). Error correction keeps each bit of the Rydberg answer with probability 0.72 after one syndrome round at the noise level
implied by this morning's Bell test (0.56 after four rounds; 0.97 and 0.93 at ten times less noise). On ibm_fez the
echoes are where the real chip shows most: the exact Aer echo kept the dry sound's shape (F 0.97 vs chance 0.02) and the
night calibration kept the light cone almost perfectly (0.999 vs 0.14), while the sampled ibm_fez runs keep much less
(0.37 vs 0.03 for the sound; 0.55 vs 0.17 for the light cone between the two ibm_fez echoes). Both are still well above
chance, and the *Run* switch shows the two side by side. The 23:00 blur-core hop needs a caveat: comet returns counts with no
per-shot order, and its keys arrive sorted, so the blur-core grid is the 375 lexicographically smallest bitstrings, not
the first 375 shots in time. Its first four tweezers read 0 in all 375 bitstrings and the next ones fill in as a staircase
(rates 0.23 to 0.53 for tweezers 4 to 7, against about 0.50 over the full record). That pattern is the sort, not drift,
and the page says so. A re-run on randomly chosen rows would avoid it, but the cap was spent.

## How a hop is scored

Each hop compares what a stage received with what it handed on, on outcomes both share (tweezer sites, lanes, edges,
frame transitions, beats, sound bands, echo cells). Both are read as probability distributions and scored with the
classical (Bhattacharyya) fidelity F = (Σ √(p·q))²; F = 1 means nothing was lost. For many independent yes/no outcomes
(lanes, edges, logical qubits) F is averaged per outcome. Because F is generous to flat patterns, every hop also gets a
chance line: the same F after shuffling which outcome each value belongs to (200 shuffles), or 0.5 per yes/no outcome.
Hops measure different things, so they are not multiplied into an end-to-end number. Code: `lib.py` (`fid`, `fid_null`,
`bern_fid`).

## Where data flows

The day was recorded once, stage by stage, and every later stage reads the recorded run of the stages before it. On 5
October 2026 each hardware-capable stage was re-run on IBM ibm_fez on that same input; where it completed, the page shows
the ibm_fez run as the stage's result and keeps the recorded run beside it (the *Run* switch). Re-feeding the whole day
from the ibm_fez runs would need new jobs for every downstream stage, so the hops after an ibm_fez stage are scored
against the recorded run they actually read.

coin → comet: the coin's odds are the design; comet's 148 Born bits per shot are 144 tweezers (12 × 12) plus 4 spare,
and its conditioned random integers pick which bitstrings the day uses (comet returns counts per bitstring, with no
per-shot order, so they index the sorted counts). comet → qrc-image (8 attempts as frames) and →
shader (the chosen attempt, dimmed by the glass table at each tweezer's angle) → blur-v1 (1024² render) → qpixl (144
per-tweezer counts) → classical threshold → labyrinth (lanes wanted where a site is empty) → classical moves → teleblur
(before/after frames) → graph-v1 (the atoms that are really there: two "ghost" sites the camera wrongly called loaded
stay empty and become defects) → blur-midi (the 16 most frequent patterns as a score) → retrocausal-echo (the score,
synthesised) → otoc-echo (same echo with the morning's Bell infidelity as gate disorder). graph → qdrive (per-qubit ⟨Z⟩
targets). graph → tamagotchi (the dominant pattern written into 30 Steane logical qubits; noise from comet's CHSH value).
comet → blur-core (375 bitstrings in the sorted order of comet's counts, not a time series).

## Quantum vs classical

| Step | Kind |
|---|---|
| Loading odds (1 qubit) and loading patterns (148 + 8 qubits) | quantum, **IBM hardware ibm_fez** (the recorded ibm_marrakesh runs kept as comparisons) |
| Bell witness S = 2.6118 ± 0.0151 on 8 qubits of ibm_fez (2.7154 in the recorded ibm_marrakesh run) | quantum, IBM hardware (a fidelity check, not certification) |
| Reservoir flicker, glass table, camera blur, gain frying, teleblur, score blur, blur-core | quantum circuits on Atlas **simulators** |
| Echoes (retrocausal echo, night OTOC calibration), 24 qubits | quantum, **IBM hardware ibm_fez**, sampled (the recorded exact Aer runs kept as comparisons) |
| Photon readout (QPIXL) | quantum, **IBM hardware ibm_fez** (the recorded run on the fake_fez noise model kept as a comparison) |
| Maze, Rydberg graph state | quantum, **IBM hardware ibm_fez** (the recorded noiseless Aer runs kept as comparisons) |
| QDrive | quantum circuits on the **Aer** emulator (noiseless); its `machine='ibm_fez'` is not wired up yet |
| Logical-qubit survival (Steane code, syndrome rounds) | quantum circuits on Aer's **stabilizer simulator** with a noise model |
| Rendering images, the tweezer-to-angle map, threshold, move rules, MIDI and audio synthesis, F scores | **classical** |
| QDrive's ⟨Z⟩ values: read exactly off the circuit it returned (single-qubit rotations only) | classical evaluation of an engine output |

## What this claims, and what it does not

It claims that every number and picture on the page comes from a completed Atlas job listed in ENGINES.md, or from a
labelled classical step on such an output; that the hops labelled IBM ibm_fez ran on that chip (job IDs on each card); and
that F is computed as described.

It does not claim that anything here simulates atoms, optical tweezers, Rydberg physics or a real neutral-atom machine.
The stages are analogies, labelled on every card. No quantum advantage is claimed. The comet output is not presented as
certified randomness (its Bell test is a fidelity witness on the chip). The blockade stage is a ZZ-target stand-in on a
unit-disk graph (framing after Ebadi et al., Science 2022), not a Rydberg Hamiltonian.

## Failures and the budget (all listed in ENGINES.md)

Credit cap 96 (50 for the recorded day, 24 for the first ibm_fez pass, 22 for one retry of each failed ibm_fez job);
ledgered 94. From the ledger and the job cache: 55 submissions for this piece: 26 completed and counted, 1 completed probe not used, 28 failed (11 of them free tamagotchi attempts; 40 credits went to the failed ones), plus 1 request refused before a job was created (HTTP 413, no credit). Every failure is listed in ENGINES.md with its job ID and error, and none is counted.
Spent in the recorded day on jobs that did not complete: two shader-v0 budget probes (accepted, then timed
out), the first ibm_fez submissions of coin-toss and comet (IBM submit step failed: "Stream removed"), graph-v1's first
run (our coupling map left out the two ghost sites), blur-core at 21 qubits (computed, but its ~6 MB result exceeded
the platform's payload limit), and tessa-image-v1 and tomography-api-v2 (server timeouts; tried once, not credited).
qrc-audio-v1 was dropped from the plan to stay inside the cap. tamagotchi-v1 costs nothing but did not respond for
most of the build (attempts at 60, 90, 40, 30 and 1 logical qubits failed); once it recovered, the stage ran at 30. The
recorded day's hardware hops ran on ibm_marrakesh because those ibm_fez submissions failed at IBM's end; see *IBM
ibm_fez* below for the 5 October re-runs.

## IBM ibm_fez

ibm_fez (IBM Heron r2, 156 qubits) is the hardware target of every hardware-capable stage (`HW = "ibm_fez"` in
`stages.py`). The recorded day of 4 October ran its two hardware hops on ibm_marrakesh because the ibm_fez submissions
failed at IBM's submit step. On 5 October each hardware-capable stage was sent to ibm_fez on the same input it had in
the recorded day. The first pass (14:11 to 14:15 UTC) failed on IBM's side for every stage, in the same window in which
every ibm_fez job of this project failed; each stage was retried once (coin at 14:26 UTC, the rest from 19:08 UTC):

| Stage | ibm_fez job (primary on the page) | Qubits | F (chance) on ibm_fez | Recorded run kept beside it, F (chance) |
|---|---|---|---|---|
| 05:00 coin-toss-v1 | `d27e51b3-464d-48d6-97ca-97b2bb49072a`: 74 heads / 70 tails | 1 | 1.000 | ibm_marrakesh `83ad70dc`, 70 / 74, 1.000 |
| 05:30 comet-qrng-v1 | `7a6587bb-9185-4038-a7d2-fab4c5a87193`: fill 0.502, CHSH S = 2.612 ± 0.015 | 156 (148 + 8) | 1.000 | ibm_marrakesh `f7749ef9`, S = 2.715, 1.000 |
| 08:30 qpixl-v1 | `e3b9dbd1-8919-4667-a048-a5e112f7f6be`: 130 / 144 sites called right | not reported | 0.743 (0.430) | fake_fez emulator `c9f5292e`, 0.843 (0.394) |
| 09:00 labyrinth-v1 | `a8fdcac4-4a50-4168-a3b7-2c11826c6f09`: most likely maze opens 12 lanes | 20 | 0.547 (0.500) | Aer `900b2088`, 0.675 (0.500) |
| 10:00 graph-v1 | `216de0ea-ca8a-4b01-8a89-6b071eaa6048`: edge agreement 0.40 | 20 | 0.542 (0.500) | Aer `e51a6ab6`, 0.510 (0.500) |
| 18:00 retrocausal-echo-v1 | `4839781c-7d2b-4926-aa4b-23a62800f4c0`: sampled echo, 4096 shots per circuit | 24 | 0.374 (0.033) | Aer exact `8b41ba8e`, 0.974 (0.019) |
| 20:00 otoc-echo-v1 | `18aa3832-83ff-46f1-b66a-d5c756895591`: 94 cells moved by the kick | 24 | 0.552 (0.173) | Aer exact `5e851a8c`, 0.999 (0.142) |

tessa-image-v1 (08:15) did not complete on ibm_fez in two tries (`ed0a2239`, `56cdf27d`: "The engine did not respond in
time"), after its recorded-day attempt on the fake_fez noise model failed the same way, so that station stays closed.
Every failed try (the seven first-pass jobs and tessa's two) is listed with its job ID in ENGINES.md and on the page,
and none is counted. Each ibm_fez result is the stage's primary data and scene (labelled *IBM ibm_fez, N qubits, job
...*), and its hop F drives Tweezy's face, the stage gauge and the survival curve. The later stages still read the
recorded run they were fed (re-feeding the day from ibm_fez would need new jobs for every downstream stage), so their
hops are scored against that run. Not sent to ibm_fez: qdrive-api-v1 (its `machine='ibm_fez'` is rejected as not wired
up yet) and tomography-api-v2 (free-text provider and backend names with no validation, so no free probe; no IBM
provider name documented; its only run, on Aer, failed at once with an engine timeout). tamagotchi-v1 and the blur
family are simulator-only engines.

## Max qubits

Each stage ran at its engine's ceiling where the engine and the platform allowed: comet 156 qubits on IBM ibm_fez
(148 + 8, the whole Heron chip; the recorded ibm_marrakesh run used the same 156), tamagotchi 30 logical = 210 data
qubits on the stabilizer simulator (60 and 90 never completed), blur-v1 20, telablur 21, labyrinth 20 on ibm_fez (the
4 x 5 target zone; the emulator cap is 20 too), graph 20 on ibm_fez (graph-v1's ceiling), blur-midi 20, echoes 24 on
ibm_fez (the 24-site chain of the exact Aer runs, whose Aer cap is 24, kept so the two compare site by site; the engine
schema allows up to 156 on hardware), deep-fryer 16
per tile (max tile), shader at its 21-qubit budget ((6, 6) is the largest accepted configuration), QDrive 20,
blur-core 19 (22 was refused at 413 for request size; 21 ran but could not return its result). qrc-image and qpixl do
not report their qubit counts, so none is claimed.

## Reproduce

```bash
pip install numpy pillow requests mido imageio-ffmpeg
python run.py            # replays every stage from ../../cache (MOTH_FREEZE=1 refuses any new job)
# new hardware jobs target ibm_fez (stages.HW). To submit every hardware stage without waiting on each queue:
#   TWEEZER_QPU_WAIT=5 python run.py   (submits, leaves the jobs pending)  then  python run.py  (collects them)
#   python qpu_submit.py coin comet    (the two stages that depend on no earlier stage)
python make_video.py     # tweezer_day.mp4 (before build_web.py, which re-encodes it for the page)
python make_sprites.py   # web/sprites.json: the pixel cast (add --preview sheet.png for a contact sheet)
python build_web.py      # web/index.html (inlines brand.css, inksprite.js, sprites.json), web/img/mascot.png, media, files.json
python make_docs.py      # ENGINES.md, PARAMS.md, piece.json
python readme_table.py   # this README's day table, totals line and budget sentence, from the chain and the ledger
python verify.py         # section-7 checks: ASCII, scripts parse, files.json, size, hosts, no autoplay, footer, F unit tests
node ../../common/qa/qa_page.cjs . 5606   # headless page QA -> qa/report.json (ok: true, sound_started: true)
node qa/e2e.cjs 6330     # end-to-end journey in headless Chromium (lab, instruments, sounds, film, every chart drawn,
                         # share link + reload, nav, data vs cache / PARAMS.md, every control swept) -> qa/e2e.json
# jsdom test of every stage renderer and control (jsdom is installed outside the project):
npm i --prefix "$TMP/jsdom-test" jsdom
NODE_PATH="$TMP/jsdom-test/node_modules" node test_page.cjs
```

Files: `run.py` (pipeline), `stages.py` (one function per stage; `HW = "ibm_fez"` is the hardware target), `qpu_submit.py` (submit the coin and comet hardware jobs without waiting), `readme_table.py` (this README's day table, totals and budget sentence), `make_sprites.py` (the pixel cast -> `web/sprites.json`), `lib.py` (geometry, rendering, F), `out/` (every
engine output and intermediate), `failures.json` (every failed job), `fetch_schemas.py` + `schemas/` (engine schemas
read before use), `probe_shader.py` / `probe_tama.py` (the probes described above), `test_page.cjs` (jsdom test of every
stage renderer and control; jsdom is not in the project, see Reproduce), `verify.py`, `qa/` (page QA report and
screenshots, and `qa/e2e.cjs`, the end-to-end journey test). No pip packages were added.
