# p-bit or qubit?

**Moth Hack 2026 · Challenge 08: Make a web app**

> **Short description.** A web app that calls the Atlas API. One 20-node Ising problem is sampled two ways: by Extropic's
> THRML p-bits (block Gibbs, thermal noise) and by Atlas's graph-v1 engine at its 20-qubit maximum (Born-rule noise).
> The page stages it as an arcade showdown, **SAUNA vs FRIDGE**, drawn as the real hardware: a hardware p-bit is a
> stochastic magnetic tunnel junction whose free layer flips on room-temperature heat; superconducting qubits live on
> the bottom plate of a gold-plated dilution refrigerator at roughly 10 to 20 mK. Each envelope of 16 real samples flips
> past on a magnet board of 20 spins; you call sauna or fridge against a 15-second clock, build streaks, and drop down the
> fridge plate by plate to a boss round whose fridge envelopes are the two real ibm_fez hardware batches. An honest
> chance meter (an exact binomial test) says whether you are really beating a coin, and on most problems the game says
> you can't, because the two samplers share their pair statistics by construction. No advantage is claimed.

Two front ends share one instrument:

| | What it is | Where |
|---|---|---|
| **Web app** (the brief's deliverable) | Node server with `/api/graph`, which builds the graph-v1 request and calls Atlas server-side with `MOTH_API_KEY`. The key never reaches the browser. Static front end with a live panel. Vercel-ready (`vercel.json`, `api/`), **not deployed**. | `app/` |
| **Interactive page** (published artifact) | The same game, replaying the cached real batches. An artifact can't call any API. | `web/index.html` |

## Run the web app

```bash
cd app
node server.js            # Node 18+; no npm install, no dependencies
# open http://localhost:8008
```

The server reads `MOTH_API_KEY` from the environment, or from the nearest `.env` above `app/` (the project-root `.env`
here). Settings, all optional:

| Variable | Default | Effect |
|---|---|---|
| `PORT` | 8008 | port |
| `ALLOW_QPU` | off | `1` lets the live panel send `mode: "qpu"` jobs to ibm_fez |
| `MAX_LIVE_JOBS` | 3 | live submissions allowed per server process |
| `CREDIT_CAP` | 60 | inside this repo, every live job is appended to `cache/ledger.jsonl` under this piece and refused past the cap |
| `ALLOW_LIVE` | on locally, **off on Vercel** | `0` switches live runs off; on Vercel it must be `1` |

Inside this repo the piece's 60-credit cap is already spent, so the live panel says so and refuses to submit. Raising
`CREDIT_CAP` is a deliberate decision for the budget holder. Outside the repo (no ledger) the cap check doesn't apply,
and only `MAX_LIVE_JOBS` limits spending.

Endpoints: `GET /api/health`, `POST /api/graph {graph, J, mode}` → `{job_id}` (each costs 5 credits), and
`GET /api/graph?job_id=…` → status, then the 20 shots and the engine's tomography. A live result becomes a new problem
on the board. Its p-bits come from a JavaScript port of the same block-Gibbs update, run in the browser and labelled as
such (classical, and not THRML).

To deploy later (not done here): `vercel --prod` from `app/`, with `MOTH_API_KEY` and `ALLOW_LIVE=1` set as Vercel
environment variables. `vercel.json` serves `public/` and gives each function a 30 s limit. The browser polls, so
hardware queues never hold a function open.

## Play it

The page opens on a versus card: **Fighter 1, the sauna** (an engraving of a stochastic magnetic tunnel junction with
labelled layers) against **Fighter 2, the fridge** (a dilution refrigerator with its cans off, its plates labelled
300 K, 50 K, 4 K, still, cold plate and mixing chamber). Nothing moves or sounds until you press start.

1. **Press start.** You begin on the fridge's 50 K plate. Each plate is one stage: 5 envelopes, call 3 right to drop to
   the next plate (or retry it, or drop anyway without the bonus). The fridge drawing is the level map: a marker walks
   down the plates as you clear them. Plates 1 to 4 use fixed problems (cold ladder, cold ring, cold spin glass, warm
   ring) whose fridge envelopes come from the Atlas emulator, and say so on screen.
2. **Watch** the magnet board: 20 magnets, one per Ising spin, laid out on the problem's graph. The envelope's 16 real
   samples flip past, one every third of a second, and every magnet that flips clicks. Up (filled) = spin +1 = bit 0;
   down (hollow) = spin -1 = bit 1. A dashed bond is broken (its two magnets disagree with the coupling). Step through
   the samples with the arrows, or tap a column of the tape below the board.
3. **Call it** before the 15-second clock runs out: Sauna (p-bits; S, P or left arrow) or Fridge (qubits; F, Q or
   right arrow), then N for the next envelope. A right call scores 100 plus a time bonus, multiplied by your streak
   (x2 from 2 in a row, x3 from 4, x4 from 6) with combo callouts; the screen shakes, and the reveal throws steam (a
   sizzle) for the sauna or frost (a crystalline chime) for the fridge. "No clock" turns the timer off; Esc or Pause
   pauses it. Between envelopes you can turn the J dial or pick a graph on plates 1 to 4.
4. **Fight the boss** in the mixing chamber. Its title card says who it is (ibm_fez, an IBM Heron r2), and that every
   fridge envelope in this round is 16 of the 20 real shots of one of our two hardware jobs. It picks the problem
   (only ring J 0.4 and ladder J 1.0 have hardware shots), locks the dial, and has 4 HP: call 4 of 6 right. The final
   card gives your score, best streak, and the exact binomial p-value of all your calls and of the boss calls alone,
   problem by problem.
5. **Read the chance meter** under the board: the needle is the one-sided exact binomial p-value of your calls against
   a fair coin (time-outs are left out), on a log scale with 0.05 and 0.01 marked. When the two sources are statistically
   indistinguishable on the current problem, the text says so. That is the physics, not you.
6. **Collect lab cards** (10 short, sourced facts: the free layer, the p-bit circuit, the pulse tube's chirp, HEMTs and
   attenuators, the still, why the plates are gold, the mixing chamber, ibm_fez, why the emulator is hard to catch, and
   why you should not stop when you are ahead). They unlock as you play and stay unlocked in this browser.
7. **Scroll to The data** (always visible below the arcade) for the fingerprints: ⟨Z<sub>i</sub>Z<sub>j</sub>⟩ on every
   edge, the magnetisation histogram and the pairwise mutual-information maps, with bootstrap error bars, p-bits filled,
   qubits hollow, the exact Boltzmann answer pale; pick the graph and J there too, switch the fridge batches between the
   Atlas emulator and ibm_fez, and the p-bit sample count between 20 and all 4,096. Point at or tap any chart (or focus
   it and use the arrow keys) to read the numbers under it: an edge's three correlations, a magnetisation bar's share
   and counts, or how many bits two spins tell you about each other on either map.
8. **Play the classic board**: the earlier quieter game, 16 real samples as tiles (graph or bits), guess p-bits or
   qubits with P and Q, and keep score against a coin. Click a tile (or press Enter on it) to pin its bits and broken
   bonds under the board while you hover the others. It shares its problem with the arcade and The data.
9. **Share** your view: "Copy link to this view" stores the graph, J, source and tile style in `#token`; opening that
   link restores them. Where the clipboard is blocked, the link appears selected next to the button to copy by hand.
   **Jobs and credits** lists all 12 graph-v1 submissions; "Show" puts a job on the boards and in The data.
10. **Move on**: under the last section, the shared navigation links the previous piece (07), the hub of all 22
    pieces and the next piece (09), and lists every piece.

## The art (what is real data, and what is decoration)

The two fighters are drawn as the real objects, as original SVG ink engravings in the shared palette (hatching,
hairline leader lines, labelled parts), written in code in `web/template.html`. Parts and proportions were checked
against published descriptions (sources in [CREDITS.md](CREDITS.md)); no photo was traced or embedded.

- **The sauna: a stochastic magnetic tunnel junction (sMTJ) p-bit.** An elliptical nanopillar tens of nanometres
  across, between a top and a bottom electrode. Top down: the Ta/Ru/Ta cap, the CoFeB free layer (about 2 nm), the
  MgO tunnel barrier (about 1 nm), the CoFeB reference layer, a 0.9 nm Ru spacer, the Co pinned layer and the PtMn
  antiferromagnet that pins it, and the Ta seed: the in-plane stack of the p-bit devices of Borders et al. (Nature
  2019). Every layer is magnetised in its own plane, so the arrows point sideways: the reference and pinned layers
  point opposite ways (a synthetic antiferromagnet), and the free layer flips between parallel (low resistance) and
  antiparallel (high). Below the pillar: its resistance trace, and the one-transistor, one-junction p-bit circuit
  with a comparator (Camsari et al. 2017). Layer thicknesses are exaggerated.
- **The fridge: a dilution refrigerator "chandelier".** Gold-plated copper plates on support rods, top to bottom:
  the room-temperature flange with the pulse-tube cold head, the 50 K and 4 K plates (cooled by the pulse tube's two
  stages), the still (~0.8 K), the cold plate (~0.1 K) and the mixing chamber (about 10 to 20 mK with qubits running).
  Coax lines run down through attenuators on the plates, HEMT amplifiers hang under the 4 K plate, the still pot and
  heat exchanger sit below the still, and the processor sits in a shielded can under the mixing chamber.
- **The boss: the chip.** A small engraving of a qubit die wire-bonded into its sample holder, with the shield lifted.

| Element | What it shows | Driven by |
|---|---|---|
| Magnet board and tape | the 16 samples in the envelope, one at a time; flips click | **real data**: THRML samples or graph-v1 shots |
| The junction's free-layer arrow and resistance trace | a p-bit never sits still | **real data**: spin 0 of THRML chain 0, replayed sample by sample (THRML on a CPU, drawn as a junction would show it) |
| The fridge's level marker and plates | where you are in the game | your progress |
| Score, streak, combo, boss HP, stamps | your calls | your guesses |
| Chance meter | exact one-sided binomial p-value of your calls | your guesses |
| Stage and final cards | how different the two sources really are on that problem (mean bond correlation, in bootstrap standard errors) | **real data** |
| Steam, frost, sparks, screen shake, callouts, sounds, heat shimmer, frost glints, the can's glint in the boss round | mood | decoration only |

The sauna and fridge temperatures on the page are approximate general figures for these machines, not readings from our
jobs. The p-bits here are THRML software on a laptop CPU, not an MTJ chip, and the fridge drawing is the level map, not
a picture of the machine that ran the emulator. Sound effects are synthesised in the browser with Web Audio (no audio
files), start only after you press something, and the Sound button switches them off.

The small button icons and the hub mascot (`web/img/mascot.png`: the junction shimmering with heat beside the fridge)
are pixel-art versions of the same two objects, drawn in code by `make_sprites.py` into `web/sprites.json` and rendered
by `common/mascot.py`.

## What runs where

| Step | Kind | Where |
|---|---|---|
| Ising problems, exact Boltzmann statistics (enumerating all 2<sup>20</sup> states) | classical | `problems.py` (Python) and `app/lib/ising.js` (Node), checked to agree to 5e-12 |
| p-bit samples: THRML 0.1.4 block Gibbs, 64 chains × 64 samples | classical (THRML on a laptop CPU through JAX, not Extropic hardware) | `run_pbits.py` |
| Qubit samples: graph-v1, 20 qubits, 20 shots, `mode: "emu"` | quantum circuit **on Atlas's Aer emulator, a classical simulation** | `run_graph.py` |
| Qubit samples: the same jobs with `mode: "qpu"`, `backend_name: "ibm_fez"` | **real IBM hardware (Heron, 156 qubits)**: 2 problems came back; 4 submissions were cancelled on IBM's side (see below) | `run_graph.py` |
| graph-v1 build-time "tomography" | classical, computed by the engine | returned with every job |
| Fingerprints, scoring, the in-browser Gibbs port for live J | classical | page / web app |
| The engravings, pixel icons, mascot and game animation | classical drawing | `web/template.html`, `make_sprites.py` |
| `qg_replica.py`: our numpy port of QuantumGraph's rules | classical design aid and cross-check, never shown as engine output | |

## The recipe: how the same energy function reaches both samplers

Energy E(s) = −Σ J<sub>ij</sub> s<sub>i</sub>s<sub>j</sub> on the edges, with zero field and β = 1.

- **p-bits** get it directly: `IsingEBM(nodes, edges, biases=0, weights=J_ij, beta=1)`.
- **graph-v1 can't take an energy function.** It takes targets: `bloch` (single-qubit Pauli expectations) and
  `relationship` (two-qubit Pauli expectations on a coupled pair), applied in order. Our translation, identical for every
  job:
  - 20 `bloch` targets `{X: 1}`, which put each qubit in |+⟩, so no bit is favoured (zero field);
  - one `relationship` target per edge, `{ZZ: t_ij}` with `fraction = (2/π)·asin|t_ij|`, where t<sub>ij</sub> is the
    **exact Boltzmann edge correlation** for that J. Reading QuantumGraph's source shows why the fraction is needed. Its
    relationship step rotates the pair into the eigenspace the target favours, and a rotation can't turn a pure state
    into a mixed one, so at fraction 1 the edge ends up perfectly correlated whatever t is. A partial rotation from |++⟩ gives ZZ = sin(π·fraction/2) on an isolated
    edge, so this fraction lands on the target.
  - Edges go in breadth-first build order (`problems.json`). Loops close, and frustrated bonds meet, only at the end.

So the qubits are handed the answer's pair statistics and asked to build a state that has them. That is the honest
sense in which both samplers get "the same problem".

## Qubits

`num_qubits = 20`, graph-v1's documented maximum (schema: 2–20), one qubit per Ising node. Every job reports
`num_qubits: 20` back. `shots = 20` because graph-v1 returns only its **top 20 bitstrings**: at 20 qubits almost every
shot is distinct, so with more shots the list would be a biased slice (ties appear to be broken by bitstring order). With 20
shots the list provably holds every shot. The cost is statistical power, and every qubit number carries a bootstrap
error bar for it.

## Results (all from cached real jobs; full list in [PARAMS.md](PARAMS.md))

Mean edge correlation, signed by J (1 = every bond satisfied in every sample):

| problem | exact | THRML p-bits (4,096) | emulator, 20 shots | ibm_fez, 20 shots | graph-v1's own tomography |
|---|---|---|---|---|---|
| ring, J 0.4 | 0.380 | 0.373 | 0.39 ± 0.04 | **0.29 ± 0.04** | 0.23 |
| ring, J 1.0 | 0.764 | 0.763 | 0.76 ± 0.03 | cancelled | 0.43 |
| ladder, J 0.4 | 0.449 | 0.448 | 0.46 ± 0.05 | not sent | 0.39 |
| ladder, J 1.0 | 0.947 | 0.947 | **0.64 ± 0.04** | **0.46 ± 0.04** | 0.48 |
| spin glass, J 0.4 | 0.371 | 0.372 | 0.37 ± 0.03 | not sent | 0.10 |
| spin glass, J 1.0 | 0.642 | 0.642 | 0.59 ± 0.03 | cancelled | 0.12 |

± is a bootstrap standard error over the 20 shots. The hardware and emulator jobs share identical parameters, and so
the same engine tomography.

What the data says:

1. **On 5 of 6 problems the emulated qubits look like p-bits (within 2 standard errors), and that is expected.** The qubits were tuned to the
   Boltzmann pair correlations, and a Z-basis measurement keeps only probabilities. The phases that make the state
   quantum never reach the bitstrings. Read this way a quantum state is just another probability distribution, and this
   one shares its pairwise statistics with the p-bits by construction. Telling them apart takes higher-order structure
   that 20 shots can't resolve. On these problems your game score should hover near a coin's.
2. **On the cold ladder the circuit misses**: 0.64 against 0.95 asked, with rungs often broken in the shots. Our exact
   re-computation of QuantumGraph's rules (`qg_replica.py`) reproduces the engine's per-qubit ⟨Z⟩ to within 0.015 on the
   other five problems, and the shots are as likely under it as its own entropy predicts. On this one problem the shots
   are wildly unlikely under it (log-likelihood −19.7 per shot against −2.0 expected). Our reading, which we haven't
   verified: graph-v1 steers each new edge from a running *approximate* estimate of the state (QuantumGraph's
   `ExpectationValue` tracker follows short Pauli paths), and on this dense, nearly frozen ladder that estimate drifts.
   It's a limit of the recipe, not quantum noise.
3. **graph-v1's reported "tomography" disagrees with its own shots.** It is described as the exact prepared state, but
   on the J = 1 ring it reads 0.00–0.01 on 8 of the 20 edges (0–19, 19–18, … , 13–12), while the shots average 0.71 on those same edges.
   The page trusts the shots and shows the tomography only behind a checkbox.
4. **The hardware is where noise starts to show, and only on the cold problem.** On the cold ladder, ibm_fez's
   correlations fall from the emulator's 0.64 ± 0.04 to 0.46 ± 0.04, a drop of about 3 standard errors. That is the
   chip's own noise: decoherence, gate and readout errors wash correlations toward zero. On the warm ring the drop
   (0.39 → 0.29) is under 2 standard errors, so 20 shots can't tell the chip apart from the emulator there. Neither
   hardware batch shows a clear bias in ⟨Z⟩ (ring −0.12 ± 0.05, ladder +0.09 ± 0.11; the ideal is 0).
5. **Four hardware submissions returned nothing.** The first four ibm_fez jobs (ring 1.0, ladder 1.0, spin glass 1.0,
   ring 0.4) were accepted, transpiled and queued, then came back about 15 minutes later as `ibm_collection_failed: QPU
   job ended as cancelled`. A graph-v1 hardware job from another piece in this set ended the same way that hour. Our
   runner retries a failed job once. It resubmitted two of them (ladder 1.0 and ring 0.4), and both completed in about
   340 s (IBM jobs `db1jb0avog1s73fi74h0` and `db1jb1pb694s73dsc0tg`). A bug in the runner's stop condition (it matched
   "402" anywhere in the error text) kept the other two from being retried. It is now fixed. That spent the piece's whole 60-credit cap, so ring 1.0
   and spin glass 1.0 have no hardware batch. The page greys out their ibm_fez switch and says why.

## What this claims, and what it doesn't

- **Claims:** every bitstring on the page is a real THRML sample or a real graph-v1 shot, with job IDs in the readout
  and in PARAMS.md. The THRML samples match exact enumeration (largest edge error 0.04). The comparisons above are
  computed from those samples.
- **Doesn't claim:** any advantage, in either direction. The qubits didn't solve the Ising problem: they were told its
  pair correlations. Emulated qubits are a classical simulation. Hardware data exists for 2 of the 6 problems, at 20 shots each.
  THRML is software on a CPU here, not an Extropic chip. The cause of the ladder miss and of the tomography mismatch is
  our inference.

## Reproduce

```bash
pip install --quiet networkx        # already present here (2.8.5); everything else is in the base setup
python problems.py                  # graphs + exact statistics (writes problems.json once)
python run_pbits.py                 # THRML samples -> out/pbits.json (seeded, about 30 s)
python run_graph.py                 # graph-v1 jobs -> out/jobs.json (cached: re-runs are free and offline)
python record_failures.py           # status of ledgered jobs that never completed -> out/failed.json
python make_docs.py                 # out/summary.json, PARAMS.md, piece.json
python make_sprites.py              # pixel icons + mascot art -> web/sprites.json (add --sheet sheet.png for a contact sheet)
python ../../common/mascot.py web/sprites.json duo web/img/mascot.png --scale 2   # hub mascot, 196 x 192
python build_web.py                 # web/index.html (artifact) + app/public/index.html (web app)
node tests/test_parity.js           # JS and Python recipes / exact stats agree
node tests/test_page.js             # page logic unit tests
node tests/test_ui.cjs              # plays a whole game in headless Chromium (Playwright from common/qa); screenshots in qa/
node qa/e2e.cjs                     # the end-to-end journey (23 steps: game, sound, charts, share link, nav, data vs PARAMS.md and the cache, the app's front end); writes qa/e2e.json
node tests/test_app.js              # server tests; spends no credits (one read-only GET of a finished job)
node tests/probe_post.js            # free POST check: a schema-invalid request gets 422, so no job is created
```

`MOTH_FREEZE=1` makes every Atlas call refuse new jobs, and the whole pipeline still rebuilds from the cache.
`tests/ui_harness.html` drives the built page in a 375 px frame. Run it with
`chrome --headless=new --allow-file-access-from-files --dump-dom tests/ui_harness.html`.

## Files

- `app/`: the web app (`server.js`, `api/graph.js`, `api/health.js`, `lib/atlas.js`, `lib/ising.js`, `public/index.html`, `vercel.json`; `public/index.html` is built from the same template as the artifact, so it is the same page, nav included, plus the live panel)
- `web/`: `template.html` (source), `index.html` (built artifact, self-contained, about 380 KB), `sprites.json` (the
  pixel icons and mascot art, inlined at build time), `img/mascot.png` (hub mascot), `files.json` (lists only the mascot: the page
  itself needs no external files)
- `problems.py`, `problems.json`, `run_pbits.py`, `run_graph.py`, `record_failures.py`, `make_docs.py`, `make_sprites.py`, `build_web.py`, `qg_replica.py`
- `out/`: `jobs.json`, `pbits.json`, `failed.json`, `summary.json`, the hardware run logs, and `graph-v1_engine_description.md` (the engine's own description, fetched from Atlas)
- `PARAMS.md`, `CREDITS.md`, `piece.json`
- `tests/` (parity, page logic, UI and app tests) and `qa/e2e.cjs` (the end-to-end journey); `history/` (earlier page versions and the restore report)
