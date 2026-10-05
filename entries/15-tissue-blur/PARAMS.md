# Parameters: blur-v1 jobs (20 qubits each)

Engine: **blur-v1 v1.1.9** (Moth Quantum Atlas), run on Atlas's classical statevector simulator (blur-v1 has no QPU mode).
Fixed for all jobs: `strength` = 1.0, `style` = rx, and defaults `size` = 1024, `downscale` = true, `mask_bin_size` = 4, `mask_min_region` = 16.

Inputs (`image`): 1024 × 1024 RGB PNGs from `make_maps.py`, one gene per colour channel.
- **A, "Three territories"**: `maps/composite_A.png`, R = Satb2, G = Gpr88, B = Gabra6
- **B, "Folds and tracts"**: `maps/composite_B.png`, R = Fezf2, G = C1ql2, B = Mog

Masks (`mask`, white = blurred), from `make_maps.py`:
- `lens_282`, `lens_512`, `lens_742`: white disks, r = 270 px, centres (282, 512), (512, 512), (742, 512). Bounding box 541 × 541 px.
- `section`: the tissue silhouette (classical, from cell density). Bounding box 1012 × 575 px.

Qubits per region follow the engine's documented rule, ⌈log₂ w⌉ + ⌈log₂ h⌉: 10 + 10 = **20** for every mask (the engine's maximum). The engine does not report a qubit count.

| # | set | mask | reach | qubits | job_id | seconds | status |
|---|---|---|---|---|---|---|---|
| 1 | A | lens_512 | 0.5 | 20 | `8c8d7053-f998-4c2d-978f-04da7bbefbae` | 14.6 | completed |
| 2 | A | lens_512 | 0.0 | 20 | `5ca1cb97-104d-48bb-8c2f-6b15c45b1e8f` | 7.2 | completed |
| 3 | A | lens_282 | 0.0 | 20 | `13e5e885-80ec-4a4e-a70a-2fc398c3f754` | 6.6 | completed |
| 4 | A | lens_742 | 0.0 | 20 | `48faa7e1-1a2e-4001-907f-cc9d766a1b04` | 7.3 | completed |
| 5 | B | lens_512 | 0.0 | 20 | `331c8bd0-784b-446e-899c-76a997eb517a` | 7.5 | completed |
| 6 | B | lens_282 | 0.0 | 20 | `b1f1a376-280a-4f81-9089-908bb99ef9b9` | 6.6 | completed |
| 7 | B | lens_742 | 0.0 | 20 | `09dc9a66-9811-467e-bcee-9483d2681fb6` | 6.6 | completed |
| 8 | A | section | 0.0 | 20 | `0d64fa53-2f42-47e6-83df-5d3294a8e5f9` | 6.5 | completed |

Job 1 was submitted first as a probe of reach 0.5. It turned the lens into a plaid of blocks with no
remaining structure, so jobs 2–8 use reach 0, which keeps the layout recognisable. Job 1 stays in the page as
the one "wider reach" view. Ledgered spend: 8 of 8 credits (1 credit per job). No job failed.

**Hero** (`hero.png`): measured map A, job 8 (whole section, reach 0), job 1 (centre lens, reach 0.5).
All per-job outputs: `out/` (PNG) and `jobs.png` (contact sheet); job list in `out/jobs.csv`.

Per-gene statistics inside each mask (Pearson r, ghost signal) are in `web/data.json`, computed by `build_web.py`.
