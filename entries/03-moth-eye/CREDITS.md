# Credits

## Engine and papers
- **Moth Quantum Atlas, `entanglement-shader-v1`.** Its shader source (GLSL) and R/T lookup tables are
  used unchanged in `out/jobs/`. The GLSL is ported to WebGL2 in `web/src/core.js`.
- **J. S. Ferreira, S. S. Topel, P. Fromholz & J. R. Wootton**, "Rendering Coherent Scattering via Quantum
  Collision Models", arXiv:2606.29989 (2026). This is the model behind the engine.
- **P. B. Clapham & M. C. Hutley**, "Reduction of lens reflexion by the 'moth eye' principle",
  *Nature* 244, 281–282 (1973). https://www.nature.com/articles/244281a0
- **C. G. Bernhard, W. H. Miller & A. R. Møller**, "The insect corneal nipple array",
  *Acta Physiologica Scandinavica* 63, Suppl. 243 (1965). This paper first described moth-eye
  nipples as an antireflection structure.

## References for the engraved plates (consulted for anatomy and dimensions; no images used)
All illustrations are our own drawings, generated as SVG geometry by `make_plates.py`. No photograph or
published figure was traced, embedded or copied; these sources were read for descriptions and numbers only.
- **R. H. White, H. Xu, T. A. Münch, R. R. Bennett & E. A. Grable**, "The retina of *Manduca sexta*:
  rhodopsin expression, the mosaic of green-, blue- and UV-sensitive photoreceptors, and regional
  specialization", *Journal of Experimental Biology* 206(19), 3337–3348 (2003).
  https://journals.biologists.com/jeb/article/206/19/3337/14017/ — about 27,000 facets per eye, facet
  diameter 30.3 ± 1.8 µm (the eye size and facet scale of the head plate and inset).
- **M. Wakakuwa, D. G. Stavenga & K. Arikawa**, "Spectral organization of ommatidia in flower-visiting
  insects", *Photochemistry and Photobiology* 83, 27–34 (2007). https://onlinelibrary.wiley.com/doi/10.1562/2006-03-03-IR-831
  — nine photoreceptors per ommatidium; in *Manduca* R1–4 form the distal rhabdom, R5–8 the proximal, and a
  basal R9 (Plate I label and caption).
- **X. Yang, H. Ran, Y. Jiang, Z. Lu, G. Wei & J. Li**, "Fine structure of the compound eyes of the crepuscular
  moth *Grapholita molesta*", *Frontiers in Physiology* (2024). https://pmc.ncbi.nlm.nih.gov/articles/PMC10883378/
  — refracting superposition eye; corneal nipples ~256 nm tall; crystalline cone, primary and secondary
  pigment cells, rhabdom and tracheoles (structure of Plate I).
- **D. G. Stavenga, S. Foletti, G. Palasantzas & K. Arikawa**, "Light on the moth-eye corneal nipple array
  of butterflies", *Proceedings of the Royal Society B* 273, 661–667 (2006).
  https://pmc.ncbi.nlm.nih.gov/articles/PMC1560070/ — nipple spacing 180–240 nm, heights 0–230 nm,
  hexagonal domains (Plate II and the loupe label).
- **J. Haxaire, "The family Sphingidae"** (https://sphingidae-haxaire.com/index.php/general-information/the-family-sphingidae/)
  — hawkmoth head morphology: a well-developed proboscis; antennae thickened and sometimes dilated toward
  the tip with a small apical hook; large labial palps pressed against the head.
- **Big brown bat** (Wikipedia, https://en.wikipedia.org/wiki/Big_brown_bat, read only) — wingspan
  32.5–35 cm, ears 12–13 mm and relatively short with rounded tips, tragi with rounded tips, a black,
  hairless, rounded and somewhat flattened snout (the flying bat and the meter's head).
- **Animal Diversity Web, Vespertilionidae** (https://animaldiversity.org/accounts/Vespertilionidae/) —
  a simple face without a noseleaf, sometimes with swollen glands; ears with a simple tragus.
- **A. Surlykke, K. Ghose & C. F. Moss**, "Acoustic scanning of natural scenes by echolocation in the big
  brown bat, *Eptesicus fuscus*", *Journal of Experimental Biology* 212(7), 1011–1020 (2009).
  https://journals.biologists.com/jeb/article/212/7/1011/19092/ — "*Eptesicus fuscus* is an oral emitter"
  (why both bats are drawn calling with the mouth open).

## Data
- No third-party data. The moth-eye facet, bare dome and flat slab are procedural meshes generated
  by `geometry.py` and `web/src/core.js`. Their dimensions are illustrative: we shrank the facet to 24
  pillar pitches so the pillars stay visible.

## Libraries
- three.js r134 (MIT). The page loads it from cdnjs; the film uses the npm build `three@0.134.0`.
- puppeteer-core 24 (Apache-2.0), driving the locally installed Google Chrome, for the offline film and headless checks.
- ffmpeg with libx264 and libwebp via imageio-ffmpeg (GPL ffmpeg build), for MP4 encoding, the smaller web copy of the film and its WebP poster.
- NumPy, Matplotlib and OpenEXR 3.x for Python (BSD-3-Clause). OpenEXR was pip-installed for this piece to read the EXR tables.
- Fonts: Geist and IBM Plex Mono (SIL Open Font License), via Google Fonts (imported by the shared `common/brand.css`).
