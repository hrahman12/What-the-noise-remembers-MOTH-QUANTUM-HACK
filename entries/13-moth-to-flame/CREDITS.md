# Credits

## Science

- Fabian, S. T., Sondhi, Y., Allen, P. E., Theobald, J. C. & Lin, H.-T. (2024).
  *Why flying insects gather at artificial light.* **Nature Communications** 15, 689.
  https://doi.org/10.1038/s41467-024-44785-3 (PubMed 38291028; authors, venue, volume and article
  number checked against the PubMed record).
  The game's steering rule is a simplified 2D cartoon *inspired by* this paper's dorsal-light-response
  finding. It is not the authors' 3D guidance model, and it uses none of their data.

## Data

- No external datasets. Every level is generated:
  - street plans: `town.py` (seeded random maze plus loops, classical, written for this piece);
  - hedges and lit lamps: measured shots from Moth Atlas `labyrinth-v1` jobs on IBM ibm_fez (IDs in `PARAMS.md`);
    the comparison runs' maps come from their own measured shots.

## Engines and hardware

- Moth Atlas **labyrinth-v1** (Quantum Labyrinth Engine), via `atlas/client.py`.
- Levels: IBM Quantum **ibm_fez** (IBM Heron, 156 qubits) for all three, reached through Atlas (job IDs in `PARAMS.md`).
- Comparison runs (shown only in Figure 4 and the jobs table, not levels): the engine's local Aer simulator (noiseless) for
  Lamp Lane, and IBM Quantum **ibm_miami** (IBM Nighthawk, 120 qubits) for Hedge Row, both reached through Atlas.

- Hardware facts used in the text: IBM Quantum Nighthawk has 120 qubits joined by 218 tunable couplers to their four
  nearest neighbours in a square lattice (IBM newsroom, 12 Nov 2025:
  https://newsroom.ibm.com/2025-11-12-ibm-delivers-new-quantum-processors,-software,-and-algorithm-breakthroughs-on-path-to-advantage-and-fault-tolerance ;
  https://www.ibm.com/quantum/hardware). IBM Heron (ibm_fez) uses IBM's heavy-hex layout, where no qubit has more than three
  neighbours.

## Software

- Python: numpy, matplotlib (static `out/levels.png` and `out/compare.png`).
- Browser: Canvas 2D and the Web Audio API only. No external scripts, and every sound is synthesised in the page.
- Fonts: Geist and IBM Plex Mono from Google Fonts (SIL Open Font License), via `common/brand.css`.
- Shared brand kit: `common/brand.css`; ASCII packing: `common/ascii_html.py`.
- Pixel art: every sprite in `web/sprites.json` (moth, lamps, hedges, houses, cottage, backend chips) was drawn for this
  piece, in the shared ink palette, and is drawn with `common/inksprite.js`. No third-party art.
- Testing only (not shipped): jsdom, for a headless DOM smoke test of the page.
