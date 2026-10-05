# Frog Chorus

**Moth Hack 2026 · Challenge 07, Make a VST or AU**

*Seat the frogs, then hear them learn to take turns.*

A male Japanese tree frog calls almost periodically, and he listens to his neighbours. Two males settle
into calling half a cycle apart. Three cannot all alternate, so they are frustrated and fall into richer
patterns. Recordings of a paddy-field chorus most often show two alternating clusters (Aihara 2009; Aihara
et al. 2011, 2014). That makes a chorus a textbook system of coupled oscillators.

Frog Chorus is a browser instrument (Web Audio) for that system. It is wired by a quantum circuit, run on
Atlas's simulator. We asked
Atlas's `qdrive-api-v1` engine to build a 22-qubit state, one qubit per lily pad, in which every pair of
neighbours is locked to alternate (or, for the second pond, to call in step). The locks the engine actually
delivered, measured by two-qubit tomography, now decide who answers whom and how hard. You seat the frogs,
start the chorus and raise the coupling, then hear the pond organise itself.

qdrive cannot reach IBM hardware (asked for `ibm_fez` it answers "not wired up yet"), so the pond also has a
**real-hardware counterpart**: the same 20-pad pond's "take turns" request, re-encoded for Atlas's `graph-v1` engine
and run on **IBM's ibm_fez chip at 20 qubits** (job `6f175600-338d-4814-946d-b1da067312af`, IBM job
`db1q0d9b694s73dslgv0`). Its 20 measured nights can seat the frogs, and the page charts them against the same recipe
on Atlas's Aer emulator.

## Play it

Open `web/index.html` (it is published by the lead as a claude.ai artifact).

1. **Seat** frogs: tap lily pads, drag frogs between pads and the log of waiting frogs in the middle of the
   pond, or *Roll a measured night*. That picks one of the engine's 1,024 measured shots of the final state
   (1 = calling, 0 = silent). *Roll an ibm_fez night* (or a tap on a row of the ibm_fez chart) seats one of the
   20 nights measured on IBM's ibm_fez chip instead, in the 20-frog pond.
2. **Listen**: *Start the chorus* (or press `S`), then raise **Coupling**. **Tempo**, **Individuality**
   (how different the frogs' natural rates are) and **Volume** are yours too.
3. **Compare** *Engine delivered* with *We asked for*, and the *Alternating pond* with the *Sync pond*, and a 22-frog pond (the default) with a 20-frog one.

The page (paper-and-ink Moth Hack brief style, `common/brand.css`) opens on an illustrated **pond scene**: pixel-art
frogs (one lily pad per qubit) on a pond with reeds, a moon and a floating log of waiting frogs. Every hearing edge
is a thread between pads (ink pushes apart, rust pulls into step, thicker and denser = stronger lock). When the
model makes a frog call, its **vocal sac puffs** at that moment, ripples spread from its pad, and a dot runs along
each thread to the frogs that hear it (brighter when they listen harder: coupling × lock). Blinks, hops, ripples,
reeds and the moon are decoration; the sac puffs and threads are the model and the engine's numbers. The sprites
live in `web/sprites.json` (the shared ink palette, drawn by `common/inksprite.js` at integer scale; the pond turns
to portrait on phones so the frogs stay readable). Tap the frog by the headline and it croaks once.

Under the pond sit three live meters: *in step* (Kuramoto R), *taking turns* (mean (1 − cos Δθ)/2 over seated
neighbours) and *rhythm locked* (spread of the frogs' current call rates). The readout names the job, the request
and the delivered numbers, and the hardware run ("IBM ibm_fez, 20 qubits, job 6f175600-..."). *Copy link to this chorus* stores the exact pond, couplings, Coupling / Tempo / Individuality sliders, night and
seated frogs in the URL fragment (Volume stays with each listener). Nothing plays until you press Start. The page ends with the shared navigation for the whole set
(previous piece, *All 22 pieces* hub, next piece, and a jump list; `common/nav.py`, inlined by `build_web.py`).

Below the instrument the page is organised in titled sections (a row of jump buttons leads to each): **How to
play** (every control in one list); **The data**, four live charts wired to the same state as the scene, plus two
hardware charts: the
**pond map** (the original schematic pond: hearing edges by sign and strength, an own-phase ring per pad from the
engine's Bloch lengths, a phase hand per frog while the chorus runs; tap a pad to seat or lift a frog), the
**phase circle**, the **call raster** (tap a dot or a row to pick a frog) and the **asked-versus-delivered lock
chart** with the engine result for the pond you picked; then **On real hardware: 20 nights heard on IBM ibm_fez**
(one row per hardware shot, a filled square per frog heard calling, a bar of how many hearing pairs took turns that
night against coin flips, the Aer-emulator mean and the best any night can do; tap a row to seat that night) and
**Taking turns on every hearing edge: ibm_fez against the emulator**; **Hear the rendered choruses**; **How it was made**
(drawers: what the quantum engine did, how engine numbers become sound, the ibm_fez counterpart); **The science** (why frogs);
**What this does not claim**; and **Jobs and credits** (every ledgered job from `out/jobs.json`, failures
included, the spend against the cap, and the papers). The words and charts of the earlier, pre-sprite page are
all kept (see `history/inventory.md` and `history/restore_report.md`).

*Hear the rendered choruses*, right after *The data*, plays all four WAV deliverables on the page (128 kbps MP3
copies in `web/audio/`). Each clip has Play/Pause, Stop (rewind) and a scrubber, and a **chorus line**: the 22 frogs
in bank order, folded into two rows so ring neighbours sit side by side, each throat puffing on that frog's calls in
the render. The page replays `render_wav.py`'s exact run with its own copy of the model (same equations, phases,
rates and coupling ramp) and draws it in time with the audio, so alternation shows as every other frog puffing and
sync as the whole line puffing at once. Under each chorus line sits the chart of that render's own log (in step,
taking turns, coupling ramp) with a playhead that follows the audio. Audio loads only on click (`preload="none"`), one clip
plays at a time, and starting a clip stops the live chorus (and vice versa).

**WAV examples** (`out/wav/`, MP3 copies in `web/audio/`): 28-second renders of the same model and engine
data. The coupling is off for 4 s, then ramps up:

| file | what you hear |
|---|---|
| `alt22_engine.wav` | alternating pond, engine-delivered couplings (K 0 to 8): pairs lock first, then the pond settles into a fixed turn-taking rhythm (taking turns 0.73, rate spread under 0.01 calls/s) |
| `alt22_asked.wav` | alternating pond, the couplings we asked for (K 0 to 4): clean turn-taking round the bank (0.87), held back only at the frustrated inlets |
| `sync22_engine.wav` | sync pond, engine-delivered couplings (K 0 to 12): strong pairs, but mixed-sign bank edges stop the whole pond from falling into step (R 0.42) |
| `sync22_asked.wav` | sync pond, asked-for couplings (K 0 to 4): everyone falls into step (R 1.00) |

**Plugin:** no VST or AU is included (the brief makes it optional). The instrument is the browser page plus
the WAV renders.

## What the quantum engine did

`qdrive-api-v1` builds a circuit from **target expectation values** instead of gates. Its semantics fit
couplings well enough to use it. It is not a driven-qubit dynamics simulator: it has no Hamiltonian, drive
amplitude or time evolution. It prepares a static state that meets (or approaches) the targets you list. So
we use it for what it is good at: a phase per qubit and a lock per pair.

- **One qubit per pad.** A frog's phase is its qubit's Bloch azimuth in the X–Y plane. Each qubit gets a
  single-qubit target `<X> = cos φ, <Y> = sin φ` with a golden-angle spread φ_k = k · 137.5°, so no
  neighbours start in step.
- **One lock per hearing edge.** `<XX> = <YY> = −0.7` (alternating pond) or `+0.7` (sync pond). For two
  separately phased qubits, `<XX> + <YY> = cos(φ_i − φ_j)`, the quantity the Kuramoto model pulls on, and it can
  never exceed 1 in magnitude. Asking for 1.4 asks for more than any pair of independent phases can give.
- **Layers.** qdrive only re-measures the state at an `update()`. Our 3-qubit probe showed that targets
  applied without one are computed against a stale state. So the edges (27 for 20 pads) go in three layers of
  non-touching pairs, with an `update()` before each layer.
- **Readout.** `tomography = 2` (single-qubit and every hearing edge's two-qubit Pauli expectations, 1,024 shots
  each) and `sample = true` (1,024 shots of the final state).

**What came back (Atlas Aer simulator).**

| pond | qubits | job | mean `<XX>+<YY>`, all edges | last layer | mean X–Y Bloch length |
|---|---|---|---|---|---|
| alternating | 22 | `8ece2a2c-4035-4d0c-950c-5174a228b2d4` | −0.26 | −0.75 | 0.15 |
| sync | 22 | `85baf230-d490-48fe-9825-86ea5f1015b6` | +0.18 | +0.36 | 0.07 |
| alternating | 20 | `bdedb3ba-073f-49c8-ab9c-feccb3dea289` | −0.20 | −0.77 | 0.14 |
| sync | 20 | `4f7f0541-4d1d-4c36-ab8d-b8afc44570d6` | +0.10 | +0.55 | 0.09 |

The last layer of locks kept the sign we asked for. Earlier locks survived only where no later layer touched
the same qubits. Everywhere else they were largely overwritten when later layers entangled those qubits again
(consistent with monogamy of entanglement), leaving small mixed-sign residues. Most qubits kept little of their own
phase. The page's *The data* section charts asked against delivered for every edge (the *What the quantum engine
did* drawer links to it).

**One entangled lock per 22-qubit pond.** For any unentangled pair, |`<XX>+<YY>`| ≤ 1 (Cauchy–Schwarz on
the two Bloch vectors, then convexity), so a larger value witnesses entanglement of that pair. In both
22-qubit ponds the bank pair 0–21, which no later layer touches, came out at **−1.32** (alternating) and
**+1.34** (sync). That is about 7 shot-noise widths past 1. Replaying the engine's own returned circuits
exactly with qiskit (`tests/check_witness.py`, a classical check, not an engine output) gives −1.35 and +1.44.
No 20-qubit edge crosses 1 (there, qubit 19 is touched again by the inlet 17–19). This is a fact about the
simulated circuit, not about frogs. In the chorus it is simply that edge's coupling weight.

**qdrive on hardware: not possible.** qdrive accepted only `machine = "aer"`. Its schema leaves `machine` a free
string (so no free 422 probe exists), and every `ibm_fez` request became a ledgered job that failed at once with
"machine 'ibm_fez' is reserved for a future IBM Quantum Runtime backend ... not wired up yet" (`retryable: false`):
two 20-qubit readouts earlier, and on 5 October 2026 the full 22-qubit alternating build itself
(`alt22_build_ibm_fez`, job `b4a7e89a-2ffd-41c8-a7b2-79e8500b7924`). Asked for `fake_fez` it answered
"unknown machine 'fake_fez'; expected one of ('aer',)". So the chorus data stays on the Aer simulator, labelled as such.

## The ibm_fez counterpart (real hardware, graph-v1)

`run_graph_fez.py` sends the 20-pad pond to IBM's **ibm_fez** through Atlas `graph-v1` (`mode = "qpu"`,
`backend_name = "ibm_fez"`, 5 credits). The engine reports `backend: "ibm_fez"` and IBM job `db1q0d9b694s73dslgv0`.

- **20 qubits**, one per pad: graph-v1's documented ceiling (`num_qubits` 2–20), so the 22-pad pond cannot go.
  The same 27 hearing edges are the `coupling_map`.
- Every frog starts undecided: a Bloch target `X = 1`, so on its own it is equally likely to be heard calling or silent.
- "Take turns" on every hearing edge: a relationship target `ZZ = -0.7` (the same 0.7 the qdrive build asks of XX
  and YY), rotation fraction (2/π) asin 0.7 = 0.4936, edges in breadth-first order from pad 0. graph-v1 measures
  only in Z, so this is a different observable of the same request: who calls, not the phase locks. A classical
  re-implementation of QuantumGraph's rules (a design aid, never shown as engine output) predicted about 19.5 of 27
  pairs taking turns with breadth-first order against 17.1 with the qdrive build's layered order, and coin-flip level
  (13.6) for full-strength `ZZ = -1` rotations in layers, so we chose breadth-first order and partial rotations.
- **20 shots**, because graph-v1 returns only its 20 most frequent bitstrings; with 20 shots the list holds every shot.
- The same parameters on graph-v1's Aer emulator (`turns20_emu`, job `af1641e9-f45d-4359-bcc6-f176b60ae55f`) are
  the deliberate noiseless baseline.

| run | where | pairs taking turns per night (of 27) |
|---|---|---|
| `turns20_ibm_fez` | **IBM ibm_fez** (real hardware) | **17.80 ± 0.43** (lowest 15, highest 21) |
| `turns20_emu` | Atlas Aer emulator (noiseless) | 19.95 ± 0.30 |
| coin flips | classical reference | 13.5 |
| best any night can do | classical (brute-force maximum cut over all 2^20 nights) | 22 (each inlet triangle leaves a pair out of turn) |

The chip keeps most of the requested turn-taking (about 10 standard errors above coin flips) and loses about
2.1 ± 0.5 pairs a night against the emulator, which is what gate, readout and decoherence errors would do; we did
not separate those sources. Two cautions: graph-v1 rebuilds the circuit for every job, and the noiseless
tomography it reports for the two jobs differs on 9 of the 27 edges (ZZ itself on 5–6, 8–9, 5–7), so the
baseline is the same recipe, not a guaranteed copy of the hardware circuit. And that reported tomography disagrees
with the engine's own noiseless shots (for example ZZ = 0.00 on edge 14–15, where all 20 emulator nights took turns),
so the page compares shots with shots. The ibm_fez nights only seat frogs; no coupling, phase or WAV comes from them.

## Engine numbers to sound

| In the chorus | Comes from | Kind |
|---|---|---|
| who answers whom, and how hard (A_ij) | delivered lock `<XX>+<YY>` of each hearing edge (or, in *We asked for*, the requested ±1.4) | engine, Aer simulator |
| each frog's starting phase | its qubit's Bloch azimuth `atan2(<Y>, <X>)` | engine, Aer simulator |
| who is calling tonight | one measured shot of the final state | engine, Aer simulator |
| who is calling on an ibm_fez night (20-frog pond) | one of the 20 shots graph-v1 measured on ibm_fez | engine, **IBM ibm_fez hardware** |
| natural call rate | Tempo × (1 ± Individuality × fixed per-pad offset) | classical |
| pitch, croak, stereo | minor-pentatonic note per pad, three-pulse sawtooth croak, panned by position | classical |
| the dynamics | `dθ_i/dt = 2πf_i + K Σ_j A_ij sin(θ_j − θ_i)`, RK2 at 240 Hz; a call each completed cycle | classical |

## Quantum vs classical

| Step | Where it ran |
|---|---|
| pond geometry, hearing graph, requested phases, edge layering (`pond.py`) | classical |
| building the 22-qubit circuit from targets, two-qubit tomography, 1,024-shot sample (`run_qdrive.py`) | **quantum circuit on Atlas's Aer simulator** (a classical simulation; no QPU) |
| the ibm_fez counterpart: 20 qubits, `ZZ = -0.7` on 27 edges, 20 shots (`run_graph_fez.py`, `turns20_ibm_fez`) | **quantum circuit on IBM ibm_fez hardware** (graph-v1, `mode = "qpu"`) |
| the same recipe as a noiseless baseline (`turns20_emu`) | quantum circuit on Atlas's Aer emulator (a classical simulation) |
| reading results into pond data (`extract.py`), pairs-taking-turns counts, the brute-force best night | classical bookkeeping, no values changed |
| the chorus (Kuramoto model) and its audio (`chorus.py`, the page, `render_wav.py`) | classical |

## What this claims, and what it does not

**Claims:** every coupling, starting phase and seated-frog pattern in the instrument comes from a real,
ledgered qdrive-api-v1 job whose ID is on the page and in [PARAMS.md](PARAMS.md). The page's chorus model
mirrors `chorus.py` line for line. Node tests check that the two agree to 1e-9.

**Does not claim:** frogs are classical oscillators, and nothing here simulates a quantum frog or claims a
quantum advantage. The engine output is a static snapshot that parameterises a classical model. No coupling,
starting phase or WAV comes from quantum hardware: qdrive cannot reach it. The one hardware run (graph-v1 on
ibm_fez) is a labelled counterpart that only seats frogs, measured in Z, at 20 shots; it is not certified randomness.
The engine-delivered couplings are uneven because of how the circuit was built in layers,
and we present that as it came out rather than tidying it.

## Qubits

- **22 qubits** per pond in the default ponds (`alt22`, `sync22`), and 20 in the alternative pair. Known from
  `n_qubits`, confirmed by the engine's returned QASM (`qubit[22] q;`) and its 22-character Pauli keys.
- qdrive documents no qubit ceiling, so we probed upward. **24 qubits timed out twice** (`engine_timeout`,
  both after about 5 min 45 s: once in the final two-qubit tomography, once at target 39 of 59). We stepped down one notch,
  and **22 completed** (174 s and 100 s). 20-qubit builds take about 85 s.
- Each job: 22 single-qubit targets, 3 `update()`s, 29 pair targets (54 entries), tomography of 22 qubits and
  29 edges, and 1,024 sampled shots.
- **On IBM hardware: 20 qubits** on ibm_fez through graph-v1, its documented ceiling (`num_qubits` 2–20); the engine
  echoes `num_qubits: 20` and returns 20-character bitstrings. qdrive's 22-qubit build cannot run there (see above).

## Reproduce

```bash
python run_qdrive.py          # probe3 (3-qubit format probe) + the 4 pond jobs the page uses; cached, so free and offline
python run_graph_fez.py       # the ibm_fez counterpart (graph-v1, qpu, ibm_fez) + its Aer-emulator baseline; cached
python record_jobs.py         # ledger audit -> out/jobs.json (read-only status calls)
python extract.py             # -> out/pond.json, out/hardware.json
python render_wav.py          # -> out/wav/*.wav, web/audio/*.mp3
python build_web.py           # -> web/index.html, web/files.json
python make_docs.py           # -> PARAMS.md, piece.json
python tests/make_ref.py && node tests/test_core.js     # page core vs chorus.py
python tests/check_pauli_order.py                        # qubit-order convention from the probe's own circuit
python tests/design_graph_order.py                       # classical design aid behind the ibm_fez recipe (edge order, ZZ strength)
node tests/browser_check.js <dir>                         # headless Chrome: 375 px, start/stop, toggles, share link
node ../../common/qa/qa_page.cjs . 5400                   # shared page QA: errors, hosts, overflow, audio decode, sound on click
node qa/e2e.cjs 6570                                      # end-to-end journey (Playwright): seat, chorus, sound, pond map and charts, sections, drawers, clips, share link, nav
node ../../common/qa/deadcontrols.cjs . 6560              # does every control change something? (qa/deadcontrols.json)
```

The dead-control scan flags controls that are not dead: *Engine delivered* is already selected when
the page opens (it works once *We asked for* is picked), and some of the clip scrubbers, which the scan moves to the
end and then back to 0, where they started (moved anywhere else they jump the clip, its chorus line and readout).
`qa/e2e.cjs` exercises each kind: Engine delivered after We asked for, and scrubbing every clip (playing and
unplayed) to a new time.

`MOTH_FREEZE=1` replays everything from `../../cache/qdrive-api-v1/`, `../../cache/graph-v1/` and `out/status/` with
no network job submissions. qdrive puts its inline result on the job's status body, which the shared client does not cache,
so `run_qdrive.py` stores that body verbatim in `out/status/<job_id>.json`.

## Files

`pond.py` (pond and job recipes; `HARDWARE = "ibm_fez"`) · `run_qdrive.py` (qdrive jobs) · `run_graph_fez.py`
(the ibm_fez counterpart) · `record_jobs.py` · `extract.py` ·
`chorus.py` (model) · `render_wav.py` · `build_web.py` · `make_docs.py` · `web/template.html` → `web/index.html` ·
`web/sprites.json` (the pixel cast) → `web/img/mascot.png` (hub mascot, `common/mascot.py`) ·
`out/qdrive_*.json` (job records with the engine's result) · `out/graph_turns20_*.json` and `out/hardware.json`
(the ibm_fez run and its baseline) · `out/wav/` · `tests/` · `qa/e2e.cjs` · [PARAMS.md](PARAMS.md) ·
[CREDITS.md](CREDITS.md) · `piece.json`
