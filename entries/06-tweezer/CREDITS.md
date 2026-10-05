# Credits

## Data

No third-party data. Every input in this piece was generated here or came out of an Atlas engine:

- The loading patterns are 148-qubit measurement records of comet-qrng-v1 on IBM hardware (this piece's own jobs): the 05:30
  card shows the ibm_fez run (job 7a6587bb-9185-4038-a7d2-fab4c5a87193); the later stages read the recorded ibm_marrakesh
  run of the same circuit (job f7749ef9-75fe-47d2-8120-74cd86d36478), which is kept beside it as a labelled comparison.
- Images (fluorescence renders, frames) are drawn by `lib.py` / `stages.py` from those bits.
- The score (MIDI) is built from graph-v1's measured patterns; its audio is synthesised by `lib.synth`.

## Engines

Moth Quantum Atlas engines: coin-toss-v1, comet-qrng-v1, qrc-image-v1, entanglement-shader-v1, blur-v1, deep-fryer-v1,
tessa-image-v1, qpixl-v1, labyrinth-v1, telablur-v1, graph-v1 (built on QuantumGraph,
https://github.com/moth-quantum/QuantumGraph), tamagotchi-v1, blur-midi-v1, retrocausal-echo-v1, otoc-echo-v1,
qdrive-api-v1, tomography-api-v2, blur-core-v1. blur-v1 wraps the QuantumBlur library
(https://github.com/qiskit-community/QuantumBlur). IBM Quantum hardware was reached through Atlas (and, for the echo engines, Moth's execution service): IBM's ibm_fez
(Heron r2, 156 qubits) is the hardware target of every hardware-capable stage and the primary result wherever its job
completed (5 October 2026); ibm_marrakesh ran the recorded day's coin and comet jobs, kept as labelled comparisons.
Every ibm_fez attempt, completed or not, is listed with its job ID in ENGINES.md.

The 21-qubit configuration limit of entanglement-shader-v1 ((6 layers, 6 rays) accepted, (6, 7) rejected) comes from
probe jobs run by entry 03 of this project (`entries/03-moth-eye/out/probes.json`); this piece did not repeat them.

## Papers (cited for context; verified)

- S. Ebadi et al., "Quantum optimization of maximum independent set using Rydberg atom arrays",
  *Science* 376, 1209 (2022). https://www.science.org/doi/10.1126/science.abo6587 (arXiv:2202.09372).
  Source of the unit-disk-graph framing of the Rydberg blockade on a partially filled square lattice.
- D. Barredo, S. de Léséleuc, V. Lienhard, T. Lahaye, A. Browaeys, "An atom-by-atom assembler of defect-free arbitrary
  two-dimensional atomic arrays", *Science* 354, 1021 (2016). https://www.science.org/doi/10.1126/science.aah3778
- M. Endres et al., "Atom-by-atom assembly of defect-free one-dimensional cold atom arrays", *Science* 354, 1024 (2016).
  https://www.science.org/doi/10.1126/science.aah3752

These two are the context for "load at random, image, rearrange into a defect-free zone".

## Libraries

numpy, pillow, mido (MIDI), imageio-ffmpeg (audio resampling for the page), requests. Page: plain JavaScript,
Web Audio, Google Fonts (Geist and IBM Plex Mono, both under the SIL Open Font License, loaded by `common/brand.css`).
Page tests: jsdom (MIT licence), which is not shipped in this folder. To run `test_page.cjs`, install it in a temporary
directory and point Node at it:

```bash
npm i --prefix "$TMP/jsdom-test" jsdom
NODE_PATH="$TMP/jsdom-test/node_modules" node test_page.cjs
```

The page QA (`common/qa/qa_page.cjs`) uses the project's shared Playwright install.
