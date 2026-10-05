# Credits

## Engine

- **Moth Quantum Atlas, `tamagotchi-v1`** (Qiskit QEC engine: Steane code, Aer stabilizer simulator).
  All error statistics in this piece come from its completed jobs, listed in [PARAMS.md](PARAMS.md).

## Data

- **Demo image `demo/moth.png`:** a synthetic moth silhouette drawn by `make_demo.py` in this folder.
  No third-party images are used.
- **Your own image** on the interactive page stays in your browser and is never uploaded.

## Art

- **The loom cast** (Ada the weaver moth, Inspector Hamming the silkworm, the shuttle, heddles, flags,
  gauge, card cylinder, spools and sparks) is original pixel art made for this piece in the shared ink
  palette. The pixels live in `web/sprites.json`; `web/img/mascot.png` is rendered from them with
  `common/mascot.py`. They are drawn on the page by the shared `common/inksprite.js` helper.
- The names are homages: Ada Lovelace, who compared Babbage's Analytical Engine to a Jacquard loom, and
  Richard Hamming, whose [7,4] parity checks are the code's bit-flip checks.

## Papers and specifications

- A. M. Steane, "Error Correcting Codes in Quantum Theory", *Physical Review Letters* 77, 793 (1996).
  The 7-qubit code.
- R. W. Hamming, "Error Detecting and Error Correcting Codes", *Bell System Technical Journal* 29(2),
  147–160 (1950). The [7,4] code whose parity checks are the Steane code's bit-flip stabilizers.
- N. Otsu, "A Threshold Selection Method from Gray-Level Histograms", *IEEE Transactions on Systems,
  Man, and Cybernetics* 9(1), 62–66 (1979). Used to binarise images.
- **WIF, Weaving Information File, version 1.1** (dated April 20, 1997; developers' contact
  wif@mhsoft.com). The draft format written by `loom/wif.py`.

## Software

- Python 3.12, NumPy and Pillow (rendering and image I/O); pytest for the tests (installed with
  `pip install pytest`).
- `mulberry32`, a small public-domain 32-bit PRNG (Tommy Ettinger), ported to Python so the CLI and the
  page draw identical random numbers.
- Fonts on the page: Geist and IBM Plex Mono via Google Fonts, imported by the shared `common/brand.css` (both SIL Open Font License 1.1).
