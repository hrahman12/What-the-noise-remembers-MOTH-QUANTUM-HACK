# Credits

## Data

- **Janelia FlyEM hemibrain connectome, v1.2 exported traced adjacencies.**
  Licence: CC BY 4.0. Janelia's hemibrain page says "Hemibrain is licensed under CC-BY" and links
  https://creativecommons.org/licenses/by/4.0/ (checked 4 Oct 2026 at
  https://www.janelia.org/project-team/flyem/hemibrain).
  File: `exported-traced-adjacencies-v1.2.tar.gz` (45,872,577 bytes, MD5 `ec1e076d15442f368fa5978b00f4a61c`).
  The page links it as `storage.cloud.google.com/hemibrain/v1.2/...`. The same public object downloads
  without an account or token from
  https://storage.googleapis.com/hemibrain/v1.2/exported-traced-adjacencies-v1.2.tar.gz.
  Its README says it was exported from neuPrint dataset `hemibrain:v1.2` with neuprint-python v0.4.12.
  We use `traced-neurons.csv` (bodyId, type, instance) and `traced-total-connections.csv` (synapse counts),
  and, for the station placement on the brain plate, `traced-roi-connections.csv` (synapses per neuron pair per
  primary brain region; read from the tarball by `roi_profile.py`, summarised in `data/neuron_rois.json`).
  `data/hemibrain_subset.csv` and `data/circuits.json` are derived from it. Changes: we selected 60 neurons
  in three sets of 20 and summed synapse counts in both directions.
- The brief asked for v1.2.1. neuPrint serves v1.2.1 only to signed-in users with a token. The public
  bucket (`storage.googleapis.com/hemibrain`) has no v1.2.1 adjacency export, so this piece uses v1.2.
- Attribution: Scheffer, L. K., Xu, C. S., Januszewski, M., et al. "A connectome and analysis of the adult
  *Drosophila* central brain." *eLife* 9:e57443 (2020).

## Engines and libraries

- **Moth Quantum Atlas, graph-v1 (Quantum Graph Engine).** Built on QuantumGraph,
  https://github.com/moth-quantum/QuantumGraph (Apache-2.0, per the source headers; Copyright IBM Quantum
  2020, Moth Quantum 2025-2026). `qg_replica.py` adapts its `set_bloch` / `set_relationship` rule to an exact
  numpy statevector. The licence notice and the list of changes are in that file.
- **IBM Quantum, ibm_fez** (Heron, 156 qubits), reached through Atlas with Moth's IBM account. It ran the memory network's 20-qubit graph-v1 circuit (Atlas job `6469b158-8538-4230-9a6d-ed535173b37c`, IBM job `db1rsijid5ic73erj1k0`, 4,096 shots, 5 Oct 2026). Three other ibm_fez jobs (compass twice, memory once) ended cancelled or failed and returned nothing.
- **THRML** 0.1.4 by Extropic AI, https://github.com/extropic-ai/thrml (block Gibbs sampling). It runs on
  **JAX** 0.11.2 (Apache-2.0).
- numpy, scipy (eigendecompositions and fractional matrix powers in the replica), requests.
- Node.js 24 standard library only, for `app/server.js`.
- Fonts: Geist and IBM Plex Mono via Google Fonts (shared brand kit).
- `common/inksprite.js` and `common/mascot.py` (the project's shared sprite helper and mascot exporter);
  scipy's `linear_sum_assignment` seeds the transit-map layout in `metro_layout.py`.

## Artwork

All the artwork was drawn for this piece: the canvas ink engravings of FIG. 1A (the fly), FIG. 1B (the brain,
frontal view) and FIG. 1C (the neuropils behind the transit map); the neuropil geometry in `anatomy.py` /
`data/brain_plate.json`; the pixel sprites in `web/sprites.json` (the realistic fly, the status-line fly and
the semaphore from `fly_sprite.py`; the trains, lamps, puffs and sparks); and the mascot `web/img/mascot.png`.
No photograph, figure or mesh was traced, copied or embedded. Shapes, counts and proportions were checked
against these written sources (consulted 5 Oct 2026):

- Fly anatomy: "Drosophila melanogaster", Wikipedia (female about 2.5 mm, males smaller; sex comb a row of
  about 12 setae on the first tarsal segment of the male foreleg; striped abdomen, darker in males),
  https://en.wikipedia.org/wiki/Drosophila_melanogaster.
- "An anatomical atlas of Drosophila melanogaster: the wild-type", *Genetics* 228(2): iyae129 (2024)
  (about 700 ommatidia per eye in males and 750 in females; three ocelli in a triad; scape, pedicel and
  funiculus with a branched arista), https://academic.oup.com/genetics/article/228/2/iyae129/7750380.
- "Standardized terminology and visual atlas of the external morphology and terminalia for the genus
  Scaptomyza (Diptera: Drosophilidae)", *Fly* (2021), PMC8525988 (drosophilid chaetotaxy: postpronotal,
  notopleural, supra-alar, postalar, two pairs of dorsocentrals, basal and apical scutellars, three
  orbitals, vertical and postocellar setae; wing veins and crossveins, the humeral costal break),
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8525988/.
- Marcellini and Simpson, "Two or four bristles: functional evolution of an enhancer of scute in
  Drosophilidae", *PLoS Biology* 4(12): e386 (2006) (D. melanogaster has two dorsocentral bristles on each
  side, both on the posterior scutum), https://pmc.ncbi.nlm.nih.gov/articles/PMC1635746/.
- Hainaut et al., "The MYST-containing protein Chameau is required for proper sensory organ specification
  during Drosophila thorax morphogenesis", *PLoS ONE* (2012) ("Twenty-six large sensory bristles (or
  macrochaetes) are arranged in a stereotyped pattern on the dorsal thorax"),
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3295779/.
- Wing venation (six longitudinal veins L1-L6, the anterior and posterior crossveins between L3-L4 and
  L4-L5, the marginal vein): de Celis, "Positioning and differentiation of veins in the Drosophila wing",
  *Int. J. Dev. Biol.* 42 (1998), https://ijdb.ehu.eus/article/pdf/9654017, and "Cell recruitment and the
  origins of anterior-posterior asymmetries in the Drosophila wing", *PLoS ONE* (2024),
  https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0313067.
- Brain layout: The Interactive Fly (Society for Developmental Biology), "The Drosophila brain: central
  complex" (18 bridge glomeruli, 16 ellipsoid-body wedges, fan-shaped body layers, noduli) and "Brain"
  (mushroom-body calyx, pedunculus and the dorsal and medial lobes), https://www.sdbonline.org/sites/fly/aimorph/centralcomplex.htm
  and https://www.sdbonline.org/sites/fly/aimorph/brain2.htm.
- Ito et al., "A systematic nomenclature for the insect brain", *Neuron* 81 (2014) (region names).
- Bogovic et al., "An unbiased template of the Drosophila brain and ventral nerve cord", *PLoS ONE* 15:
  e0236495 (2020): the JRC2018 unisex brain is 1652 x 773 x 456 voxels at 0.38 um, about 628 x 294 um, which
  sets the plate's overall size, https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0236495.
- Scheffer et al. 2020 (above), via https://pmc.ncbi.nlm.nih.gov/articles/PMC7546738/: the hemibrain covers
  most of the right central brain, except the optic lobe, periesophageal neuropils and gnathal ganglia, plus
  part of the left; (R)/(L) in ROI names; mushroom-body compartments a1-3, a'1-3, B1-2, B'1-2, g1-5.
- Hulse et al., "A connectome of the Drosophila central complex reveals network motifs suitable for flexible
  navigation and context-dependent action selection", *eLife* 10: e66039 (2021) (EPG, PEN, PEG and Delta7
  cell types and the regions they join), https://elifesciences.org/articles/66039.

The neuropil outlines are a schematic with approximate proportions, not a rendering of any dataset's meshes.

No other third-party data, images or code are used. Every figure on the page is computed from the
files in this folder.
