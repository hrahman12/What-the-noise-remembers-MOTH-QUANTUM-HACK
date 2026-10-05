# Parameters: blur-v1 damage ladder (20 qubits per job)

Engine: **blur-v1 v1.1.9** (Atlas, "Quantum Blur"), Atlas's classical statevector simulator. blur-v1 has no QPU mode.
Inputs, identical for every job:

- `image` = `ink_clean.png`: the ink layer alone (1024 × 1024, 8-bit grey, white ink on black), in scan coordinates
- `mask` = `mask.png`: white disk, r = 500 px, centre (512, 512). Bounding box 1001 × 1001 px →
  ⌈log₂ 1001⌉ + ⌈log₂ 1001⌉ = 10 + 10 = **20 qubits** per job (the engine's ceiling; `size` 1024 gives a budget of
  ⌈log₂ 1024⌉ × 2 = 20, so the region is neither downscaled nor tiled). Computed from the documented rule; the engine
  does not report a qubit count.

Fixed for every job: `style` = rx, `size` = 1024, `downscale` = true, `mask_bin_size` = 4, `mask_min_region` = 16 (defaults).
Credits: 1 per job, 9 spent of a 10-credit cap (ledger: `cache/ledger.jsonl`, piece `22-scroll-unroll`).

Rows are in damage order, which is the order of the page's damage slider. "Line kept" r is the Pearson correlation
between the blurred and clean ink over the hidden line, on the flattened sheet. "Ink moved" is the share of the
output's brightness inside the roll that lands more than 2 px from any true ink. Both are computed by `unwrap.py`
(classical) from the downloaded outputs and stored to five decimals in `out/metrics.json`; this table and
the page round them once, the same way (r to two decimals, ink moved to a whole percent).

| # | strength | reach | job_id | line kept r | ink moved | output |
|---|---|---|---|---|---|---|
| 1 | 0.25 | 0 | `4a8c15c6-cea0-4133-b8eb-2c2845e657ff` | 0.98 | 1 % | `out/ink_s0.25_r0.0.png` |
| 2 | 0.5 | 0 | `e3de765a-0d60-459e-8d60-88b87589bff2` | 0.86 | 5 % | `out/ink_s0.50_r0.0.png` |
| 3 | 0.75 | 0 | `f019131c-62b4-4638-ae64-2b177c9430b9` | 0.72 | 11 % | `out/ink_s0.75_r0.0.png` |
| 4 | 1.0 | 0 | `90ccfce7-74ea-44d9-898d-1cd2661bccc0` | 0.59 | 16 % | `out/ink_s1.00_r0.0.png` |
| 5 | 0.1 | 1 | `81c74d15-0fd3-4a8a-93bf-b3b06c34b72e` | 0.86 | 31 % | `out/ink_s0.10_r1.0.png` |
| 6 | 0.25 | 1 | `dffc66de-5587-4110-99b8-c07fd38a282b` | 0.03 | 79 % | `out/ink_s0.25_r1.0.png` |
| 7 | 0.5 | 0.5 | `fae87570-6918-4b57-898d-bae1ea107953` | 0.00 | 80 % | `out/ink_s0.50_r0.5.png` |
| 8 | 0.5 | 1 | `b5894864-e463-44df-9292-95aafd25080f` | 0.01 | 92 % | `out/ink_s0.50_r1.0.png` |
| 9 | 1.0 | 1 | `a257d715-991d-41e7-853f-6594e70c811d` | 0.00 | 95 % | `out/ink_s1.00_r1.0.png` |

Order of submission: job 2 first (a probe), then 1, 3, 4, 6, 8, 9 (the planned 2 × 4 grid minus reach-1 strength 0.75).
Jobs 5 and 7 were added after seeing those seven: the reach-0 ladder kept the text and every reach-1 job lost it, so
one job was spent below the break (strength 0.1, reach 1) and one at half reach. One credit is left unspent.

Every output is RGB with three identical channels (checked in `build_web.py`); the page stores one channel as lossless
WebP. Outside the mask every output pixel equals the input (0 everywhere outside the roll).
