# Credits

## Quantum engine
- **Moth Quantum Atlas, `qdrive-api-v1` (QDrive)**: builds a circuit from target expectation values. Every
  completed qdrive job in this piece ran on its `aer` machine, the Aer simulator (Qiskit Aer); its `ibm_fez` machine
  is "not wired up yet". Job IDs are in [PARAMS.md](PARAMS.md).
- **Moth Quantum Atlas, `graph-v1`** (built on QuantumGraph, https://github.com/moth-quantum/QuantumGraph): the
  real-hardware counterpart, run on **IBM Quantum's `ibm_fez`** (Heron, 156 qubits) at 20 qubits, job
  `6f175600-338d-4814-946d-b1da067312af` (IBM job `db1q0d9b694s73dslgv0`), plus one run on its Aer emulator as the
  noiseless baseline.
- Design aid only: `tests/design_graph_order.py` uses `entries/08-pbit-or-qubit/qg_replica.py` (another piece in this
  set, read only), a small classical re-implementation of QuantumGraph's rules, to choose the edge order and rotation
  fraction before spending credits. Its numbers are never shown as engine output.

## Papers (each checked on PubMed before citing)
- I. Aihara, "Modeling synchronized calling behavior of Japanese tree frogs", *Physical Review E* **80**,
  011918 (2009). https://doi.org/10.1103/PhysRevE.80.011918. Pairs of males call almost in antiphase or
  in phase, with a shift from transient in-phase to stable antiphase.
- I. Aihara, R. Takeda, T. Mizumoto, T. Otsuka, T. Takahashi, H. G. Okuno, K. Aihara, "Complex and transitive
  synchronization in a frustrated system of calling frogs", *Physical Review E* **83**, 031913 (2011).
  https://doi.org/10.1103/PhysRevE.83.031913. Three frogs are frustrated, with triphase synchronisation
  and 1:2 antiphase synchronisation.
- I. Aihara, T. Mizumoto, T. Otsuka, H. Awano, K. Nagira, H. G. Okuno, K. Aihara, "Spatio-temporal dynamics
  in collective frog choruses examined by mathematical modeling and field observations", *Scientific
  Reports* **4**, 3891 (2014). https://doi.org/10.1038/srep03891. Choruses show two-cluster
  antisynchronisation.
- I. Aihara, D. Kominami, Y. Hirano, M. Murata, "Mathematical modelling and application of frog choruses as
  an autonomous distributed communication system", *Royal Society Open Science* **6**, 181117 (2019).
  https://doi.org/10.1098/rsos.181117. Neighbours avoid call overlaps, and the chorus switches
  collectively between calling and silence. Cited for context only.
- Y. Kuramoto, *Chemical Oscillations, Waves, and Turbulence* (Springer, 1984). This is the phase-oscillator
  model used for the chorus.

## Libraries and assets
- numpy, scipy (`butter`, `sosfilt` for the WAV croaks), imageio-ffmpeg (MP3 copies for the page).
- qiskit, only in `tests/check_pauli_order.py`, to confirm the engine's qubit ordering from its own returned circuit.
- Web Audio API, Canvas 2D. Fonts: Geist and IBM Plex Mono via Google Fonts. Shared brand kit `common/brand.css`.
- Pixel art (frogs, lily pads, log, reeds, moon in `web/sprites.json`) drawn for this piece in the shared ink
  palette; drawn on the page by the shared helper `common/inksprite.js`, mascot PNG by `common/mascot.py` (Pillow).

## Data
No third-party data. Pond geometry, requested phases and the chorus model are our own code. Every engine
number comes from the Atlas jobs listed in PARAMS.md. All audio is synthesised by `render_wav.py` and the page.
