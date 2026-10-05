# Parameters: blur-core-v1 jobs (18 qubits)

Engine: **Atlas `blur-core-v1`** (Quantum Blur Core), classical statevector simulator, 1 credit per run.
Backend: none. The engine has no QPU mode.

Input `values`: the 257 × 257 GW150914 spectrogram grid, integers 0–999 (`out/grid_input.npy`;
axis 0 = time, −300 to +100 ms around merger; axis 1 = frequency, 20–500 Hz).

Qubits: 9 + 9 = **18** per job. Each axis is padded to 512. This follows from the documented rule and is
confirmed by the engine's status message on every completed job ("Recovered 18-qubit grid from measurement").

Fixed for every job: `reach = 0`, `style = "x"`, `max_qubits = 24`, `axes = null`, `shots = null`.

## Completed jobs (all six are used)

| name | squeeze ratio r = s_time / s_freq | strength | qubits | backend | job_id | ridge time-width | ridge freq-width |
|---|---|---|---|---|---|---|---|
| r0p25 | 1/4 | `[0.25, 1.0]` | 18 | Atlas simulator | `6f52a515-c8e0-4ec9-8765-ecf2733b7144` | 9.00 ms | 13.17 Hz |
| r0p5 | 1/2 | `[0.3536, 0.7071]` | 18 | Atlas simulator | `e02daa4b-5158-4d3d-9dfe-84987c63e716` | 9.12 ms | 12.62 Hz |
| r1 | 1 | `[0.5, 0.5]` | 18 | Atlas simulator | `6fdf4b45-f942-4fda-a98f-c8a16d596dc0` | 9.36 ms | 12.24 Hz |
| r2 | 2 | `[0.7071, 0.3536]` | 18 | Atlas simulator | `179bb106-df50-43ea-8f0c-8e3f0eabf1f0` | 9.71 ms | 12.01 Hz |
| r4 | 4 | `[1.0, 0.25]` | 18 | Atlas simulator | `c6ebc23e-e8b0-4cd6-8903-f78c61e7023d` | 10.23 ms | 11.85 Hz |
| iso_control | isotropic (scalar) | `0.5` | 18 | Atlas simulator | `7c8255b6-77d1-45a6-ad27-9ee4dd40c8f5` | 9.36 ms | 12.24 Hz |

Original (not an engine output): 8.70 ms, 11.52 Hz. The isotropic control is identical to r1 (max
absolute difference 0). Strengths are rounded to 4 decimals, so the product is 0.25 ± 0.0001.

## Failed jobs (ledgered, produced nothing)

| grid | qubits | strength | job_id | error |
|---|---|---|---|---|
| 640 × 640 (values 0–255) | 20 | `0.5` | `43503eaa-594b-493c-a914-8491c9f116db` | `TMPRL1103` result payload over Atlas's internal size limit |
| 640 × 640 (values 0–255) | 20 | `0.5` | `02b057fb-6aae-4279-b456-d2801753f44d` | same (the client's single retry) |

Free requests that created no job: one 4096 × 4096 probe (HTTP 413, 1 MiB body limit) and two
640 × 640 attempts with non-compact JSON (HTTP 413).

**Ledgered spend: 8 credits of the 12-credit cap.**
