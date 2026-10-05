# Credits

## Engine
- **Moth Quantum Atlas, comet-qrng-v1** (Comet Quantum RNG Engine v1.0.0): Born-rule sampling on IBM Quantum
  hardware (ibm_fez, ibm_marrakesh) or the Qiskit Aer simulator, NIST SP 800-90B min-entropy estimate,
  Toeplitz extractor, CHSH witness. All four job outputs used here are listed in PARAMS.md.

## Papers (each verified against PubMed or Crossref)
- A. J. Corcoran, J. R. Barber & W. E. Conner, "Tiger moth jams bat sonar", *Science* 325(5938):325–327 (2009).
  doi:10.1126/science.1174096 (PubMed 19608920).
- A. J. Corcoran & W. E. Conner, "Sonar jamming in the field: effectiveness and behavior of a unique prey defense",
  *Journal of Experimental Biology* 215(24):4278–4287 (2012). doi:10.1242/jeb.076943 (PubMed 23175526).
- D. R. Griffin, F. A. Webster & C. R. Michael, "The echolocation of flying insects by bats",
  *Animal Behaviour* 8:141–154 (1960). doi:10.1016/0003-3472(60)90022-1. Cited for the search / approach / terminal phases.
- J. F. Clauser, M. A. Horne, A. Shimony & R. A. Holt, "Proposed experiment to test local hidden-variable theories",
  *Physical Review Letters* 23:880–884 (1969). doi:10.1103/PhysRevLett.23.880. Cited for the CHSH inequality.
- S. Pironio et al., "Random numbers certified by Bell's theorem", *Nature* 464:1021–1024 (2010). doi:10.1038/nature09008.
  Cited only to say what this piece is *not*: device-independent certification.
- M. S. Turan, E. Barker, J. Kelsey, K. McKay, M. Baish & M. Boyle, *Recommendation for the Entropy Sources Used for
  Random Bit Generation*, NIST SP 800-90B (2018). doi:10.6028/NIST.SP.800-90B. These are the estimators the engine reports using.

## Code and assets
- All game code (`web/core.js`, `web/template.html`), simulation (`sim.js`), tests and scripts were written for this piece.
- mulberry32, a small, widely shared 32-bit PRNG algorithm, is re-implemented here from its published description.
- The cast is original ink pixel art drawn for this piece (`web/sprites.json`): the striped tiger moth, the bat (flight,
  swoop and dizzy poses), sonar arcs, zap and sparkle, moon, stars, pines, oaks and bushes, and the four noise-makers
  (metronome, leaky and sealed seed packets, emulator box, IBM chip). It is drawn with the shared helper
  `common/inksprite.js`, and `common/mascot.py` renders the hub mascot (`web/img/mascot.png`) from the same file.
  Sounds are synthesised in the page (Web Audio). No third-party images or audio.
- Fonts: Geist and IBM Plex Mono via Google Fonts (SIL Open Font License), from the shared brand kit.
- No external data sets are used. The only data are the four Atlas job outputs.
