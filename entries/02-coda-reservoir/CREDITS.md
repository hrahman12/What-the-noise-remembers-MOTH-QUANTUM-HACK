# Credits

## Data

- **Sperm-whale coda dialogues**: `data/sperm-whale-dialogues.csv`, from the Zenodo archive
  *pratyushasharma/sw-combinatoriality*, Pratyusha Sharma, DOI
  [10.5281/zenodo.10817697](https://doi.org/10.5281/zenodo.10817697), published 2024-03-14.
  - **Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)**, verified on 2026-10-05 on the
    record page itself, https://zenodo.org/records/10817697 (sidebar "Rights → License"), and in the
    record's API metadata (`license.id = cc-by-4.0`). Saved copies: `data/zenodo_record.html`,
    `data/zenodo_record_api.json`.
  - Downloaded from the Zenodo file
    `pratyushasharma/sw-combinatoriality-sw-combinatoriality.zip` (MD5 `ea057337237598b7118fec5713ed3edf`,
    matches the record); only the CSV and the repository README (`data/upstream_README.md`) were extracted.
  - The recordings come from **The Dominica Sperm Whale Project** (Eastern Caribbean 1 clan, animal-borne
    DTag recordings), as described in the paper's Methods.
  - We changed nothing in the CSV. Our tokens (`out/tokens.json`) are derived data.

## Paper

- Pratyusha Sharma, Shane Gero, Roger Payne, David F. Gruber, Daniela Rus, Antonio Torralba,
  Jacob Andreas. *Contextual and combinatorial structure in sperm whale vocalisations.*
  Nature Communications **15**, 3617 (2024). https://doi.org/10.1038/s41467-024-47221-8
  (verified via Crossref and the article page). Our rhythm tokens are a simplified stand-in inspired by the
  paper's rhythm/tempo decomposition; they are not the paper's rhythm types.

## Engines

- **Moth Quantum Atlas**: `qrc-train-v2` (QRC Train) and `qrc-gen-v2` (QRC Generate), quantum reservoir
  computing on a server-side Qiskit Aer simulator.

## Software

- Python 3.12: numpy, scipy (click filters, reverb convolution), matplotlib (README figure), requests,
  imageio-ffmpeg (bundled ffmpeg with libmp3lame for the web MP3). No extra packages were installed.
- Node 24 for the page's unit tests (`web/test_page.js`).
- Testing only, not part of the build: puppeteer-core 23.11.1 (npm, installed in a scratch folder outside
  the project) drove the local headless Chrome to check playback, pausing, seeking and share links.
- Fonts on the page: Gloock, IBM Plex Sans, IBM Plex Mono (Google Fonts).

## Sound

- No recordings are used. Every click is synthesised by `synth.py` (our own code).
