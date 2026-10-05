# Credits

## Physics data
- **NuFIT 6.0** global fit of three-flavour neutrino oscillations: I. Esteban, M. C. Gonzalez-Garcia,
  M. Maltoni, I. Martinez-Soler, J. P. Pinheiro, T. Schwetz, "NuFit-6.0: updated global analysis of
  three-flavor neutrino oscillations", JHEP 12 (2024) 216, arXiv:2410.05380
  (https://arxiv.org/abs/2410.05380). We use six published best-fit numbers from Table 1 (normal
  ordering, "IC19 without SK atmospheric data"), checked against the arXiv PDF on 2026-10-04.
  These are scientific results quoted with a citation. No dataset was downloaded or redistributed.
- Every curve in this folder is computed by our own code (`physics.py`) from those six numbers with the
  standard vacuum oscillation formula. No third-party data files are used.

## Quantum encoding
- **QPIXL**: M. G. Amankwah, D. Camps, E. W. Bethel, R. Van Beeumen, T. Perciano, "Quantum pixel
  representations and compression for N-dimensional images", Scientific Reports 12 (2022),
  doi:10.1038/s41598-022-11024-y (arXiv:2110.04405).
- **Moth Quantum Atlas, qpixl-v1** (Interwoven QPIXL engine). It ran on its noiseless aer simulator, on
  12 `fake_*` IBM noise models (emulators) and on real IBM hardware (ibm_fez).

## Software
- **JUCE 8** (https://juce.com, https://github.com/juce-framework/JUCE): plugin framework, fetched by
  CMake at build time and not vendored here. JUCE 8 is dual-licensed (AGPLv3 or a commercial JUCE
  licence). Anyone distributing binaries must comply with one of them.
- **pluginval** by Tracktion (https://github.com/Tracktion/pluginval): plugin validation in CI.
- numpy, matplotlib, imageio-ffmpeg (ffmpeg, for the MP3 previews), Python standard library `wave`.

## Media
All audio in `audio/` and `web/audio/` was rendered by `render_demos.py` from the measured curves.
No samples or third-party recordings are used.

## Drawings and sprites
The plate (`web/plate.js`: the reactor, the beamline, the air shower, the Sun, Super-Kamiokande, the event
display and the journey) and the pixel icons and mascot (`make_sprites.py` -> `web/sprites.json`,
`web/img/mascot.png`) were drawn for this piece in the project's shared ink palette. They are original
drawings made from published descriptions of the real objects; no photograph or third-party image was traced,
embedded or redistributed. Not to scale. Reference sources consulted for shapes, part names and numbers
(read 2026-10-05):

- Super-Kamiokande detector description (tank 39.3 m x 41.4 m, 50,000 t of water, 1,000 m underground,
  11,129 inner 50 cm PMTs, 1,885 outer 20 cm PMTs, black sheet, four electronics huts, sharp muon rings vs
  fuzzy electron rings): Super-Kamiokande collaboration, https://www-sk.icrr.u-tokyo.ac.jp/en/sk/about/detector/
- NuMI beamline (120 GeV Main Injector protons, 58 mrad / 3.34 deg downward, graphite target, two horns at
  ~200 kA, 675 m x 2 m helium-filled decay pipe, hadron absorber with an aluminium core, muon alcoves,
  ~240 m of dolomite, MINOS near detector 1.04 km downstream): P. Adamson et al., "The NuMI Neutrino Beam",
  Nucl. Instrum. Meth. A 806 (2016) 279, arXiv:1507.06690, https://arxiv.org/abs/1507.06690
- T2K beamline (30 GeV protons, three horns, ~100 m helium decay volume, 2.5 deg off-axis): T2K
  Collaboration, "The T2K Neutrino Flux Prediction", arXiv:1211.0469, https://arxiv.org/abs/1211.0469
- Pressurized-water reactors (containment: prestressed-concrete cylinder and dome lined with steel plate;
  reactor coolant system, pressurizer at 2,250 psia, U-tube steam generators, polar crane): US NRC
  training and licensing documents, https://www.nrc.gov/reactors/power/pwrs ,
  https://www.nrc.gov/docs/ML1122/ML11223A213.pdf , https://www.nrc.gov/docs/ml1328/ml13281a729.pdf
- Reactor antineutrino yield (about 6 per fission, about 2 x 10^20 per second per GW thermal): LLNL review
  "Particle Physics Using Reactor Antineutrinos", https://www.osti.gov/pages/servlets/purl/2473630
- The Sun's layers (core to ~20-25 % of the radius at ~15 million C, radiative zone to ~70 %, convective
  zone, photosphere): ESA, "Anatomy of our Sun", https://www.esa.int/ESA_Multimedia/Images/2019/10/Anatomy_of_our_Sun
- The Earth's interior radii in the air-shower figure (core 3,480 km, inner core 1,220 km, mean radius
  6,371 km) are standard textbook values.

Baselines marked on the journey (Daya Bay far hall 1.65 km, JUNO 52.5 km, KamLAND ~180 km, T2K 295 km,
MINOS 735 km, NOvA 810 km, DUNE 1,300 km; 1 AU = 149.6 million km) are rounded, widely published figures,
shown only as orientation marks. SNO's solar result quoted in a drawer: Q. R. Ahmad et al. (SNO),
Phys. Rev. Lett. 89 (2002) 011301. Super-K's tau appearance: K. Abe et al., Phys. Rev. Lett. 110 (2013) 181802.
