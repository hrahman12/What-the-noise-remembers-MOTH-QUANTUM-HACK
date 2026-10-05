# Parameters: qpixl-v1 jobs for FLAVOUR

Engine: **qpixl-v1** (Moth Atlas, Interwoven QPIXL), 1 credit per run.
Fixed parameters on every job: `shots` = 8192, `discretize` = 0, `dynamic_range` = "none", `allow_high_shots` = false. Emulator jobs: `mode` = "emu", `machine` = the name below. Hardware job: `mode` = "qpu", `backend_name` = "ibm_fez".

`values` = four curves on the same log-spaced L/E axis (20 to 50,000 km/GeV), concatenated [P2(mu->e) | P3(mu->e) | P3(mu->mu) | P3(mu->tau)], each divided by its own maximum (maxima on the 1024-point grid: 0.0479, 0.3262, 0.9961, 0.9364). Points per curve = floor(machine capacity / 4). Curves are computed classically by `physics.py`.

## Completed jobs (all used by the plugin, the page and the demos)

| machine | where it ran | values | pts/curve | qubits (how counted) | backend reported | Atlas job_id | IBM job | rms e / mu / tau |
|---|---|---|---|---|---|---|---|---|
| ibm_fez | IBM hardware | 448 | 112 | 9 address + 1 data = 10 (documented QPIXL rule for 448 values); one joint circuit on the chip lattice; physical qubit count not reported by the engine | ibm_fez | `df2a8d6a-3fec-4dc4-a825-28375b842090` | db1j26hb694s73dsbm90 (4 s QPU) | 0.087 / 0.109 / 0.093 |
| aer | noiseless simulator | 4096 | 1024 | 12 address + 1 data = 13 (documented QPIXL rule for 4096 values); run as data-qubit groups of 16 values (4 address qubits each, inferred from shot-noise scatter) | aer | `e7da5792-ab90-41b1-8f75-9e3938866666` | - | 0.004 / 0.014 / 0.013 |
| fake_fez | IBM noise model (emulator) | 448 | 112 | 9 address + 1 data = 10 (documented QPIXL rule for 448 values); spread over 64 data-qubit groups on the chip lattice (from job progress) | fake_fez | `1f2680c1-b6a6-481a-8907-03fa10dd1b4b` | - | 0.038 / 0.152 / 0.076 |
| fake_marrakesh | IBM noise model (emulator) | 448 | 112 | 9 address + 1 data = 10 (documented QPIXL rule for 448 values); spread over 64 data-qubit groups on the chip lattice (from job progress) | fake_marrakesh | `4596d47b-585a-4a52-9a42-fe143257f1f7` | - | 0.052 / 0.188 / 0.154 |
| fake_torino | IBM noise model (emulator) | 376 | 94 | 9 address + 1 data = 10 (documented QPIXL rule for 376 values); spread over 56 data-qubit groups on the chip lattice (from job progress) | fake_torino | `3d1fb8d2-9a4f-4cdc-a913-5363fc681927` | - | 0.057 / 0.107 / 0.091 |
| fake_brisbane | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_brisbane | `7d390948-a978-4346-a0e7-9e0fb35164e5` | - | 0.038 / 0.113 / 0.124 |
| fake_kyiv | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_kyiv | `341c48f5-b9bb-40dc-8463-f84cf84f985d` | - | 0.041 / 0.157 / 0.143 |
| fake_sherbrooke | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_sherbrooke | `c9400993-130e-48c9-abbd-f380cd0f4815` | - | 0.040 / 0.132 / 0.101 |
| fake_kyoto | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_kyoto | `84cd04df-052c-4dfd-9358-b5740203531f` | - | 0.130 / 0.303 / 0.288 |
| fake_osaka | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_osaka | `9bce4ff9-3f95-46b4-96ca-94d817fb0cfe` | - | 0.062 / 0.165 / 0.131 |
| fake_quebec | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_quebec | `e9886b88-c1c2-4807-9120-4811a4883dc8` | - | 0.043 / 0.156 / 0.114 |
| fake_cusco | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_cusco | `b2be95b8-13b5-4689-b66a-31189286be62` | - | 0.095 / 0.222 / 0.249 |
| fake_strasbourg | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_strasbourg | `463eca1f-a4b8-4694-9b5e-9a5338976957` | - | 0.058 / 0.145 / 0.163 |
| fake_brussels | IBM noise model (emulator) | 360 | 90 | 9 address + 1 data = 10 (documented QPIXL rule for 360 values); spread over 54 data-qubit groups on the chip lattice (from job progress) | fake_brussels | `4e283450-69af-4b38-b8a2-be459ec1d931` | - | 0.050 / 0.121 / 0.216 |

rms = root-mean-square difference between the decoded curve and the exact curve at the same points, in probability units.

## Ledgered jobs that did not produce data

Every submission is ledgered at 1 credit, including these. None of their outputs is used anywhere.

| Atlas job_id | what happened |
|---|---|
| `baf4dc7f-e679-4373-a80a-44c11e13c8ea` | fake_fez: 4096 values exceed capacity of 448 |
| `e929ca96-9866-4123-b1bb-152b5cd42b93` | fake_torino: 4096 values exceed capacity of 378 |
| `6dbeedd1-4d97-4133-ab7f-41669ea523cd` | fake_brisbane: 4096 values exceed capacity of 360 |
| `31b1db5d-c138-4818-af64-63bce59ee77b` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `e4965f27-ab60-4e0d-9fc3-c4a057b58a3d` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `f4a2801e-14c5-4cfc-85c5-b45cd98a3d7f` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `589a0bbb-9bcf-43cf-9710-e349d41666af` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `631cb2ba-a7a8-4013-9b79-393705d7caf1` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `91cd5ef3-1ab9-46ca-879e-9712302221ba` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `76577c7a-fffc-49c4-bb87-c1f1654c6634` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `9f23e11a-7242-4677-893f-fa50d7f6efeb` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `eb3fd735-f622-4734-b54f-fae70f14624c` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `556948b6-1638-41fd-8668-33d4e25306bf` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `c355c8c9-fe27-4710-8e64-f75e4ed15efe` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `357ae462-d30e-4196-8433-31d009874b70` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |
| `a046d621-7a71-476a-aa21-d630b5231240` | backend failure (engine_timeout or 'Stream removed'); resubmitted one at a time |

Ledgered credits for this piece: **30** of the 45-credit cap (14 completed jobs used, 16 ledgered without data).
