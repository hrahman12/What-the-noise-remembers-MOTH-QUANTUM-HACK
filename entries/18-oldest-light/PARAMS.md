# Oldest Light: every Atlas job

Engine `blur-core-v1` (credits_per_run 1), Atlas classical statevector simulator (the engine has no
QPU mode, so there is no hardware backend). Common params: `style = "x"`, `reach = 0`,
`max_qubits = 24`, no `shots` (exact probabilities). Input values are integers 0–999
(0.5806 µK per unit, offset −285 µK). Qubits = ⌈log₂ rows⌉ + ⌈log₂ cols⌉, and each job's status also
reports "Recovered N-qubit grid from measurement" (`out/job_status.json`).

| # | Name | Grid | Strength | Qubits | Status | Seconds | job_id |
|---|---|---|---|---|---|---|---|
| 1 | wide_s0.5 | 257 × 513 | 0.5 | 19 | **failed** (`TMPRL1103`: result payload over the platform limit, after "Recovered 19-qubit grid from measurement") | – | 89f0fcee-3faf-458a-82cf-af8f174ec435 |
| 2 | sq_s0.5 | 257 × 257 | 0.5 | 18 | completed | 17.6 | a59bf7d4-258b-43ad-9982-0125c9ae6872 |
| 3 | sq_s0.25 | 257 × 257 | 0.25 | 18 | completed | 16.9 | ff75e0b7-bab6-4cc3-b791-ac4f9d24572d |
| 4 | sq_s1 | 257 × 257 | 1.0 | 18 | completed | 13.8 | af742a15-9f88-4498-855c-6e80129d53ca |
| 5 | sq_s0.1 | 257 × 257 | 0.1 | 18 | completed | 18.5 | 22c0d516-8879-4f61-ae09-dd09eb7bc07b |
| 6 | sq_s0.375 | 257 × 257 | 0.375 | 18 | completed | 17.6 | 6e16e69e-0a69-4344-ac82-fb1f3e9068e2 |
| 7 | sq_s0.75 | 257 × 257 | 0.75 | 18 | completed | 16.3 | 06bc5198-da3c-4722-93c1-e0642b39693e |

Jobs run in the order listed. Strengths 0.1, 0.375 and 0.75 were added after inspecting the first
three outputs, to fill the gentle and heavy ends. Credits: 7 ledgered of the 8-credit cap
(`a.spent()` = 7.0); 1 credit left unspent.

## Free probes (no job created, no credit)

All-zero grid with an invalid `style = "z"` (`probe_limits.py`, `out/probes.json`).

| Qubits | Grid | Body bytes | HTTP |
|---|---|---|---|
| 24 | 2049 × 2049 | 8,400,951 | 413 (over 1,048,576-byte limit) |
| 22 | 1025 × 1025 | 2,103,351 | 413 |
| 21 | 1025 × 513 | 1,053,751 | 413 |
| 20 | 513 × 513 | 527,415 | 422 (schema only: size accepted) |
| 19 | 257 × 513 | 264,247 | 422 (schema only: size accepted) |

## Classical measurements of the outputs (`analysis.py`)

| Strength | Mean shift removed (µK) | Best Gaussian σ (px) | Extra FWHM (′) | Equivalent beam (°) | Fit residual (µK) | Spot pattern kept, quantum / Gaussian | Contrast kept, quantum / Gaussian |
|---|---|---|---|---|---|---|---|
| 0.1 | +1.41 | 0.45 | 11.9 | 1.02 | 1.7 | 1.000 / 1.000 | 0.998 / 0.996 |
| 0.25 | +5.80 | 1.05 | 27.8 | 1.10 | 8.7 | 0.993 / 0.997 | 0.986 / 0.969 |
| 0.375 | +10.34 | 1.60 | 42.4 | 1.22 | 15.4 | 0.966 / 0.985 | 0.978 / 0.938 |
| 0.5 | +14.41 | 2.15 | 57.0 | 1.38 | 20.1 | 0.900 / 0.960 | 0.969 / 0.905 |
| 0.75 | +22.00 | 3.10 | 82.1 | 1.70 | 24.1 | 0.646 / 0.884 | 0.949 / 0.852 |
| 1.0 | +31.91 | 4.05 | 107.3 | 2.05 | 29.6 | 0.308 / 0.777 | 0.954 / 0.810 |

Pixel = 11.25′. COBE-like reference (classical only): σ = 15.69 px (7° total FWHM), spot pattern
kept 0.109, contrast kept 0.588.
