# Credits

## Data

- **WMAP 9-year Internal Linear Combination (ILC) map**, `wmap_ilc_9yr_v5.fits` (HEALPix nested,
  Nside 512, galactic coordinates, 1° resolution, mK thermodynamic), NASA WMAP Science Team, via
  LAMBDA.
  - Product page: https://lambda.gsfc.nasa.gov/product/wmap/dr5/ilc_map_info.html
  - File: https://lambda.gsfc.nasa.gov/data/map/dr5/dfp/ilc/wmap_ilc_9yr_v5.fits (25,174,080 bytes,
    sha256 prefix 4501090f824f9140, downloaded 2026-10-04 by `fetch_data.py`)
  - **Usage terms, verified 2026-10-04** on LAMBDA's "Mission and Use Acknowledgement Statement",
    https://lambda.gsfc.nasa.gov/contact/: "There is no cost involved in the use of LAMBDA"; if research
    benefits, LAMBDA requests this acknowledgement, which we include here and on the page:
    "We acknowledge the use of the Legacy Archive for Microwave Background Data Analysis (LAMBDA), part
    of the High Energy Astrophysics Science Archive Center (HEASARC). HEASARC/LAMBDA is a service of the
    Astrophysics Science Division at the NASA Goddard Space Flight Center." The same page gives the image
    credit "NASA / LAMBDA Science Team"; we credit the WMAP map as "NASA / WMAP Science Team".
  - Caveat from the product page: the WMAP team trusts the ILC map on scales above about 10°; smaller
    scales carry an uncertain bias correction. We use it only to show the sky.
- The page's full-sky map and patch are our own renderings of that file (classical projection and
  colour map). No other data are used.

## Papers (verified via Crossref DOIs on 2026-10-04)

- C. L. Bennett et al., "Nine-year WMAP observations: final maps and results", ApJS 208, 20 (2013). doi:10.1088/0067-0049/208/2/20
- G. Hinshaw et al., "Nine-year WMAP observations: cosmological parameter results", ApJS 208, 19 (2013). doi:10.1088/0067-0049/208/2/19
- A. H. Guth and S.-Y. Pi, "Fluctuations in the New Inflationary Universe", Phys. Rev. Lett. 49, 1110 (1982). doi:10.1103/PhysRevLett.49.1110
- G. F. Smoot et al., "Structure in the COBE differential microwave radiometer first-year maps", ApJ 396, L1 (1992). doi:10.1086/186504
- P. Vielva, E. Martínez-González, R. B. Barreiro, J. L. Sanz, L. Cayón, "Detection of non-Gaussianity in the WMAP first-year data using spherical wavelets", ApJ 609, 22 (2004). doi:10.1086/421007 (the Cold Spot, at l = 209°, b = −57°)
- M. Cruz, E. Martínez-González, P. Vielva, L. Cayón, "Detection of a non-Gaussian spot in WMAP", MNRAS 356, 29 (2005). doi:10.1111/j.1365-2966.2004.08419.x
- C. L. Bennett et al., "Seven-year WMAP observations: are there cosmic microwave background anomalies?", ApJS 192, 17 (2011). doi:10.1088/0067-0049/192/2/17
- J. R. Wootton, "Procedural generation using quantum computation", Foundations of Digital Games (FDG 2020). doi:10.1145/3402942.3409600 (the quantum blur idea behind blur-core-v1)

Beam sizes quoted on the page (COBE DMR 7°, WMAP 0.2–0.9°, Planck about 5′) are the missions'
standard published resolutions, given as round numbers.

## Engine and software

- Atlas `blur-core-v1` (Moth Quantum), run on Atlas's classical statevector simulator.
- Python: numpy, scipy, astropy, astropy-healpix (both pip-installed for this piece), pillow,
  matplotlib, requests. Node: jsdom (tests only).
- Fonts: Geist and IBM Plex Mono via Google Fonts (SIL Open Font License), imported by the shared
  brand kit `common/brand.css`.
