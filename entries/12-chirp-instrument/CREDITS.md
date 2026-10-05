# Credits

## Data

- **Gravitational Wave Open Science Center (GWOSC)**: strain for GW150914 (H1, L1; files
  `H-H1_LOSC_4_V1-1126256640-4096.hdf5`, `L-L1_LOSC_4_V1-1126256640-4096.hdf5`, O1 bulk release) and
  GW170817 (H1, L1; `H-H1_GWOSC_4KHZ_R1-1187008867-32.hdf5`, `L-L1_GWOSC_4KHZ_R1-1187008867-32.hdf5`,
  GWTC-1), plus catalogue parameters from the GWOSC event API (GWTC-2.1-confident for GW150914,
  GWTC-1-confident for GW170817). The exact URLs are recorded in `data/events.json`.
  **Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)**, verified on
  https://gwosc.org/acknowledgement/ ("Data from this web site are licensed under a Creative Commons
  Attribution 4.0 International License").
  Acknowledgement as requested by GWOSC: "This research has made use of data or software obtained from
  the Gravitational Wave Open Science Center (gwosc.org), a service of the LIGO Scientific
  Collaboration, the Virgo Collaboration, and KAGRA. This material is based upon work supported by
  NSF's LIGO Laboratory which is a major facility fully funded by the National Science Foundation, as
  well as the Science and Technology Facilities Council (STFC) of the United Kingdom, the
  Max-Planck-Society (MPS), and the State of Niedersachsen/Germany for support of the construction of
  Advanced LIGO and construction and operation of the GEO600 detector. Additional support for Advanced
  LIGO was provided by the Australian Research Council. Virgo is funded, through the European
  Gravitational Observatory (EGO), by the French Centre National de Recherche Scientifique (CNRS), the
  Italian Istituto Nazionale di Fisica Nucleare (INFN) and the Dutch Nikhef, with contributions by
  institutions from Belgium, Germany, Greece, Hungary, Ireland, Japan, Monaco, Poland, Portugal, Spain.
  KAGRA is supported by Ministry of Education, Culture, Sports, Science and Technology (MEXT), Japan
  Society for the Promotion of Science (JSPS) in Japan; National Research Foundation (NRF) and Ministry
  of Science and ICT (MSIT) in Korea; Academia Sinica (AS) and National Science and Technology Council
  (NSTC) in Taiwan."

## Papers (verified against arXiv metadata)

- R. Abbott et al. (LIGO Scientific Collaboration and Virgo Collaboration), "Open data from the first
  and second observing runs of Advanced LIGO and Advanced Virgo", *SoftwareX* 13, 100658 (2021),
  arXiv:1912.11716 (the GWOSC data reference).
- B. P. Abbott et al. (LIGO Scientific Collaboration and Virgo Collaboration), "Observation of
  Gravitational Waves from a Binary Black Hole Merger", *Phys. Rev. Lett.* 116, 061102 (2016), arXiv:1602.03837.
- B. P. Abbott et al., "GW170817: Observation of Gravitational Waves from a Binary Neutron Star
  Inspiral", *Phys. Rev. Lett.* 119, 161101 (2017), arXiv:1710.05832.
- B. P. Abbott et al. (LIGO Scientific and Virgo Collaborations), "The basic physics of the binary
  black hole merger GW150914", *Annalen der Physik* 529, 1600209 (2017), arXiv:1608.01940. It shows
  that the leading-order chirp-mass estimate can be read off the waveform's frequency evolution, the
  same idea as our crude ridge fit.

## Engines and libraries

- **Moth Quantum Atlas, blur-midi-v1** (Quantum Blur for MIDI). Quantum Blur originates in the
  QuantumBlur library (https://github.com/qiskit-community/QuantumBlur).
- Python: numpy, scipy (Welch PSD, Butterworth filters, `lfilter`), h5py, gwosc, mido, pillow,
  matplotlib, imageio-ffmpeg (bundled FFmpeg with libmp3lame, used to encode the WAV renders to MP3 for
  the page). Browser: Web Audio API, HTML audio and Canvas 2D, with no external scripts. Fonts are Geist
  and IBM Plex Mono via Google Fonts (imported by the shared `common/brand.css`).

All the code, the MIDI files, the WAV renders and the figures in this folder were made here from the
data above. No third-party audio or images are included, and no photograph was traced or embedded. The scene's pixel
art (LIGO Hanford and LIGO Livingston as oblique aerial engravings, the lensed black-hole pair and its remnant, the
neutron-star icon, the flash, the tap pad and the hub mascot) was drawn for this piece in `make_sprites.py`, in the
shared ink palette: the observatories are rendered by projecting each site's published geometry through a pinhole
camera, and the black holes by the same thin-lens ray shooting (two point masses) that the page runs live on the sky.
Everything is animated with the shared `common/inksprite.js` helper. Sources for the drawn geometry and numbers:
- Masses 36 and 29 M☉ merging into 62 M☉ (3 M☉ radiated), peak strain 1.0×10⁻²¹, z = 0.09, 410 Mpc:
  Abbott et al., PRL 116, 061102 (2016), above.
- Ringdown of the remnant, l=m=2 mode 251 Hz, damping time 4.0 ms: B. P. Abbott et al., "Tests of General
  Relativity with GW150914", *Phys. Rev. Lett.* 116, 221101 (2016).
- GW170817 masses 1.46 and 1.27 M☉ (low-spin prior), 40 Mpc: B. P. Abbott et al., "GWTC-1: A Gravitational-Wave
  Transient Catalog of Compact Binary Mergers Observed by LIGO and Virgo during the First and Second Observing
  Runs", *Phys. Rev. X* 9, 031040 (2019).
- Site vertices (H1 46.45514 N, 119.40766 W; L1 30.56290 N, 90.77424 W), the arm bearings (the x-arm azimuth
  clockwise from north: Hanford 324.0°, NW; Livingston 252.3°, WSW) and the 4 km arms: B. Abbott et al., "Detector
  description and performance for the first coincidence observations between LIGO and GEO", *Nucl. Instrum. Meth. A*
  517, 154 (2004), arXiv:gr-qc/0308043, site table. Each y-arm points 90° anticlockwise of its x-arm seen from above
  (234.0° and 162.3°, as in the LALSuite detector constants).
- The arm cavity length (3994.5 m), the test masses (fused silica, 34 cm across, 20 cm thick, 40 kg) and the
  1064 nm Nd:YAG laser: LIGO Scientific Collaboration (J. Aasi et al.), "Advanced LIGO", *Class. Quantum Grav.* 32,
  074001 (2015), arXiv:1411.4547, Table 1 (read 5 Oct 2026).
- The 1.2 m diameter, 4 km stainless-steel beam tubes, "covered by the arched, concrete enclosures", running at right
  angles from "the large corner building", and the lasers and optics housed in "the white and blue buildings":
  B. P. Abbott et al., "LIGO: the Laser Interferometer Gravitational-Wave Observatory", *Rep. Prog. Phys.* 72, 076901
  (2009), arXiv:0711.3041, Section 4 and the caption of its Figure 2 (read 5 Oct 2026).
- The station layout: the LVEA "where the beam tubes meet", Hanford's mid stations (which "housed the end mirrors"
  of its former 2 km interferometer, H2) and the end stations EX and EY: the I2U2 LIGO e-Lab glossary,
  https://www.i2u2.org/elab/ligo/references/showAll.jsp?t=glossary (read 5 Oct 2026). Hanford's mid station at 2 km
  on each arm: W. E. Althouse et al., "Precision alignment of the LIGO 4 km arms using dual-frequency differential
  GPS", LIGO-P000006, https://dcc.ligo.org/public/0072/P000006/000/P000006-00.pdf, caption of its Figure 2.
  Livingston's buildings at the corner and the two ends only, and Hanford's corner, mid and end stations: E. J. Daw et
  al., "Long term study of the seismic environment at LIGO", *Class. Quantum Grav.* 21, 2255 (2004),
  arXiv:gr-qc/0403046, Figure 1. Livingston's loblolly pine forest and the end station's two-storey nitrogen tank:
  "The great detector: a visit to LIGO Livingston", *Physics World*,
  https://physicsworld.com/a/the-great-detector-a-visit-to-ligo-livingston/ (read 5 Oct 2026). The building
  footprints themselves are approximate, and the page says so.
- Rattlesnake Mountain (46.41556 N, 119.63028 W, 1,076 m) and Lookout Summit (46.44763 N, 119.84004 W, 1,106 m), and
  the Rattlesnake Hills running east-west from Benton City towards Yakima:
  https://en.wikipedia.org/wiki/Rattlesnake_Mountain_(Benton_County,_Washington),
  https://en.wikipedia.org/wiki/Lookout_Summit and https://en.wikipedia.org/wiki/Rattlesnake_Hills (read 5 Oct 2026).
  The other crest points of the ridge are sketched between and beyond the two summits.
