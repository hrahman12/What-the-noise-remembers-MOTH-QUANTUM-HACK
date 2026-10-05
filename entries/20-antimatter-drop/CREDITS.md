# Credits

## Physics data (the source of every probability on the page)

- **E. K. Anderson et al. (ALPHA Collaboration), "Observation of the effect of gravity on the motion of antimatter",
  *Nature* 621, 716–722 (2023).** doi:10.1038/s41586-023-06527-1 · PMID 37758891 · PMCID PMC10533407.
  Open access under the **Creative Commons Attribution 4.0 International licence**
  (https://creativecommons.org/licenses/by/4.0/). The licence statement was verified in the article's own
  full-text record:
  https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10533407/fullTextXML.
  We transcribed Table 1 ("Results of the release trials") into `data/alphag_table1.json`, unchanged except for
  re-ordering. We quote numbers from the main text, Methods, and Tables 2 and 3. **Changes we made:** we turn the
  background-corrected counts into probabilities P_dn = N_dn / (N_up + N_dn), clamping one negative count
  (−0.1) to 0. No figures or images from the paper are reproduced; the trap drawing is our own schematic.

## Historical facts in the "What antimatter is" drawer

Taken from the same paper's introduction, which cites:
- P. A. M. Dirac, "The quantum theory of the electron", *Proc. R. Soc. A* 117, 610–624 (1928).
- C. D. Anderson, "The positive electron", *Phys. Rev.* 43, 491–494 (1933) (observation made in 1932).

## Quantum engine

- **Moth Quantum Atlas, comet-qrng-v1 v1.0.0** (Comet Quantum RNG Engine), run on **IBM Quantum ibm_fez** through
  Moth's shared credentials, and on an Aer simulator. Job IDs are in [PARAMS.md](PARAMS.md).
- NIST SP 800-90B min-entropy estimators and a Toeplitz extractor are applied inside the engine, per its
  documentation.

## Libraries and fonts

- Python: numpy, requests, matplotlib (figure). Node: none at runtime. Testing only: Playwright (the project's shared
  copy in `common/qa/node_modules`, headless Chromium) for `verify_render.js`, `qa/e2e.cjs` and the shared QA;
  optionally jsdom 24.1.3 for `test_page.js` (not shipped).
- Fonts: Geist and IBM Plex Mono from Google Fonts (SIL Open Font License), imported by the shared brand kit
  `common/brand.css`.

All page code, drawings, the pixel-art cast (`web/sprites.json`, drawn by the shared `common/inksprite.js` helper; the hub mascot is rendered with `common/mascot.py` and Pillow) and the figure were made for this piece. No third-party images are used.
