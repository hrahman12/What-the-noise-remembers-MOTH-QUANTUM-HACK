# Credits

## Data

- **Zhang, M., Pan, X., Jung, W., Halpern, A. R., Eichhorn, S. W., Lei, Z., Cohen, L., Smith, K. A., Tasic, B.,
  Yao, Z., Zeng, H. & Zhuang, X.** "Molecularly defined and spatially resolved cell atlas of the whole mouse brain."
  *Nature* (2023). https://doi.org/10.1038/s41586-023-06808-9
- Dataset **"WB_MERFISH_animal4_sagittal"** (dataset id `30a2789f-7b76-4414-9c63-1deb3eacdde1`, 215,278 cells,
  1,120 genes, adult male C57BL/6J mouse), in the collection "A molecularly defined and spatially resolved cell atlas
  of the whole mouse brain", curated and distributed by CZ CELLxGENE Discover:
  https://cellxgene.cziscience.com/collections/0cca8620-8dee-45d0-aef5-23f032a5cf09
  File: https://datasets.cellxgene.cziscience.com/4b5c682f-4b5d-4dcb-81c1-606fef2b601e.h5ad
  (133,343,067 bytes, sha256 `e3a1ce828708a8565765f9e819e7757dcf4526cd527426fcb96ba5393906f1ee`).
  Plain HTTPS download: no account, no form.
- **Licence: CC BY 4.0.** Verified on 4 Oct 2026 on two source pages:
  - CZ CELLxGENE Discover, "Contribute and Publish Data": published data is accessible "subject to a CC-BY 4.0
    license". https://cellxgene.cziscience.com/docs/032__Contribute%20and%20Publish%20Data
  - Allen Brain Cell Atlas description of the same data (Zhuang-ABCA-4: 3 sagittal sections, 1122-gene MERFISH
    panel), which states it is shared under the CC BY 4.0 licence.
    https://alleninstitute.github.io/abc_atlas_access/descriptions/Zhuang-ABCA-4.html
- Only section `C57BL6J-4.003` (95,104 cells) and six genes are used. Every map in this folder is derived from it by
  the code here (`make_maps.py`). Changes: genes splatted to a 1024 px grid, Gaussian-smoothed, percentile-scaled,
  section flipped vertically.

We did not use the 10x Genomics Visium demo datasets (their download page may ask for a form).

## Engine

- **Moth Quantum Atlas, blur-v1 v1.1.9 (Quantum Blur)**, which wraps the QuantumBlur library by James Wootton:
  https://github.com/qiskit-community/QuantumBlur

## Libraries

numpy, scipy, h5py, Pillow, matplotlib (outline tracing) and requests in Python. Plain JavaScript and canvas in the page.
Fonts: Geist and IBM Plex Mono (Google Fonts, loaded by the shared `common/brand.css`). `hero.png` and `jobs.png`
are lettered in the system fonts Segoe UI and Consolas (DejaVu fallbacks elsewhere).
