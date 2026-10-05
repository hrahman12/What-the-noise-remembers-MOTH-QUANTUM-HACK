# PARAMS: every completed job

| Time | Engine | Key params | Qubits | Backend | Job ID |
|---|---|---|---|---|---|
| 05:00 | `coin-toss-v1` | `{"mode":"qpu","backend_name":"ibm_fez","shots":144}` | 1 | ibm_fez | `d27e51b3-464d-48d6-97ca-97b2bb49072a` |
| 05:00 | `coin-toss-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"mode":"qpu","shots":144}` | 1 | ibm_marrakesh | `83ad70dc-cb9c-4acf-9def-fbc0a15034d6` |
| 05:30 | `comet-qrng-v1` | `{"num_qubits":148,"shots":10000,"mode":"qpu","backend_name":"ibm_fez","bell_witness":true,"output_bytes":2048,"derive":{"integers":{"min":0,"max":9999,"count":16}}}` | 156 | ibm_fez | `7a6587bb-9185-4038-a7d2-fab4c5a87193` |
| 05:30 | `comet-qrng-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"num_qubits":148,"shots":10000,"mode":"qpu","backend_name":"ibm_marrakesh","bell_witness":true,"output_bytes":2048,"derive":{"integers":{"min":0,"max":9999,"count":16}}}` | 156 | ibm_marrakesh | `f7749ef9-75fe-47d2-8120-74cd86d36478` |
| 06:00 | `qrc-image-v1` | `{"training_sequence":"8 frames x 3 = 24 tokens","length":32,"fps":4,"quality":"moderate","seed":6,"periodic":true}` | not reported | simulator | `da0814bc-0e38-4f37-9883-21c6dba6a40a` |
| 07:00 | `entanglement-shader-v1` | `{"reflectance":0.15,"absorption":0.5,"layers":6,"incoming_rays":6,"interaction":1.0,"style":"frustrated","resolution":60}` | 21 | simulator | `743d08b4-4f6b-4bd5-9ce6-9bd135c362b6` |
| 07:30 | `blur-v1` | `{"strength":0.5,"style":"rx","reach":0.0}` | 20 | simulator | `d612dc36-4f02-4d6c-820e-42f9b3a8ab24` |
| 08:00 | `deep-fryer-v1` | `{"gates":[["rx",0.5],["cz",0.5]],"tile_size":4}` | 16 | simulator | `c60ddf89-7ce6-4b7a-9285-9c2ffbd262b8` |
| 08:30 | `qpixl-v1` | `{"mode":"qpu","backend_name":"ibm_fez","shots":8192,"dynamic_range":"min_max","values":"144 floats"}` | not reported | ibm_fez | `e3b9dbd1-8919-4667-a048-a5e112f7f6be` |
| 08:30 | `qpixl-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"mode":"emu","machine":"fake_fez","shots":8192,"dynamic_range":"min_max","values":"144 floats"}` | not reported | fake_fez | `c9f5292e-37f6-4cdf-84c9-9a955ce79eca` |
| 09:00 | `labyrinth-v1` | `{"level_data":"4x5 grid, 22 corridors","shots":4096,"mode":"qpu","top_n":-1,"backend_name":"ibm_fez"}` | 20 | ibm_fez | `a8fdcac4-4a50-4168-a3b7-2c11826c6f09` |
| 09:00 | `labyrinth-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"level_data":"4x5 grid, 22 corridors","shots":4096,"mode":"emu","top_n":-1}` | 20 | aer | `900b2088-fc88-4502-bb8b-37dd188faac2` |
| 09:30 | `telablur-v1` | `{"strength":0.5,"direction":"full","size":1024}` | 21 | simulator | `a906c79c-ae77-43df-8d66-09bb56d52366` |
| 10:00 | `graph-v1` | `{"num_qubits":20,"coupling_map":"47 edges","operations":"49 ZZ=-1 targets","shots":4096,"mode":"qpu","seed":6,"backend_name":"ibm_fez"}` | 20 | ibm_fez | `216de0ea-ca8a-4b01-8a89-6b071eaa6048` |
| 10:00 | `graph-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"num_qubits":20,"coupling_map":"47 edges","operations":"49 ZZ=-1 targets","shots":4096,"mode":"emu","seed":6}` | 20 | aer | `e51a6ab6-b5b9-4a55-b500-adc5381f4424` |
| 11:00 | `tamagotchi-v1` | `{"code":"steane","n_logical":30,"shots":1024,"rounds":[1,4],"noise":{"p_gate":0.03996,"p_1q":0.004,"p_meas":0.004,"p_idle":0.004}}` | 210 | aer stabilizer | `443780f1-4638-473b-ab53-21166ec94834` |
| 11:00 | `tamagotchi-v1` | (see stage data: another noise/rounds setting) | | aer stabilizer | `38c00b56-7dc4-4ad8-b39f-557c87ab80c5` |
| 11:00 | `tamagotchi-v1` | (see stage data: another noise/rounds setting) | | aer stabilizer | `5fbfe718-5e2a-4e40-ab07-c96d390f6c64` |
| 11:00 | `tamagotchi-v1` | (see stage data: another noise/rounds setting) | | aer stabilizer | `5ad5437e-070f-4aa0-9a9a-58b035c312b6` |
| 16:00 | `blur-midi-v1` | `{"qubits":20,"strength":0.4,"reach":0.0,"threshold":0.1}` | 20 | simulator | `d44e7ada-0857-4663-bc38-3e75e25a36d8` |
| 18:00 | `retrocausal-echo-v1` | `{"n_sites":24,"depth":8,"machine":"ibm_fez","exact":false,"mix":0.6,"feedback":0.3,"emit":"audio","via":"mothbackend","shots":4096,"fractional_gates":false}` | 24 | ibm_fez | `4839781c-7d2b-4926-aa4b-23a62800f4c0` |
| 18:00 | `retrocausal-echo-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"n_sites":24,"depth":8,"machine":"aer","exact":true,"mix":0.6,"feedback":0.3,"emit":"audio"}` | 24 | aer | `8b41ba8e-014b-4d47-b98b-43bc91ba8e78` |
| 20:00 | `otoc-echo-v1` | `{"n_sites":24,"depth":8,"machine":"ibm_fez","exact":false,"disorder":0.04,"seed":6,"include_taps":true,"min_tap_level":0.0,"via":"mothbackend","shots":4096,"fractional_gates":false}` | 24 | ibm_fez | `18aa3832-83ff-46f1-b66a-d5c756895591` |
| 20:00 | `otoc-echo-v1` (recorded run: a labelled comparison; it fed the later stages) | `{"n_sites":24,"depth":8,"machine":"aer","exact":true,"disorder":0.04,"seed":6,"include_taps":true,"min_tap_level":0.0}` | 24 | aer | `5e851a8c-9469-47c6-9dde-e489f7a22f80` |
| 21:00 | `qdrive-api-v1` | `{"n_qubits":20,"targets":"20 single-qubit <Z> targets","tomography":1,"machine":"aer","seed":6,"shots":1024}` | 20 | aer | `d36275c5-17d8-43b0-bdc3-4e3da66bf1fc` |
| 23:00 | `blur-core-v1` | `{"axes":[0,1,2,3],"strength":0.5,"reach":0.0,"max_qubits":19,"values":"5x5x5x3x144 bits from comet (163,155 bytes)"}` | 19 | simulator | `76083b0e-a4b7-46d3-ade5-fb729448d876` |

Qubit counts: the number and how we know it are on each stage card and in ENGINES.md. Where an engine does not report a count and its rule does not fix one, the table says so.

## ibm_fez jobs that did not complete (not counted)

Same input as the recorded run of each stage; ibm_fez is the default hardware target in `stages.py` (`HW = "ibm_fez"`). Stages that completed on a later try are in the table above.

| Time | Engine | ibm_fez params | Job ID(s) | What happened |
|---|---|---|---|---|
| 05:00 | `coin-toss-v1` | `{"mode":"qpu","backend_name":"ibm_fez","shots":144}` | 2c2263b1 | QPU job ended as failed |
| 05:30 | `comet-qrng-v1` | `{"num_qubits":148,"shots":10000,"mode":"qpu","backend_name":"ibm_fez","bell_witness":true,"output_bytes":2048,"derive":{"integers":{"min":0,"max":9999,"count":16}}}` | 456b4798 | QPU job ended as failed |
| 08:15 | `tessa-image-v1` | `{"machine":"ibm_fez","shots":4096}` | ed0a2239, 56cdf27d | The engine did not respond in time — retry the job; The engine did not respond in time — retry the job |
| 08:30 | `qpixl-v1` | `{"mode":"qpu","backend_name":"ibm_fez","shots":8192,"dynamic_range":"min_max","values":"144 floats"}` | af52a90e | [ibm_submission_failed] submitting the job to IBM failed |
| 09:00 | `labyrinth-v1` | `{"level_data":"4x5 grid, 22 corridors","shots":4096,"mode":"qpu","top_n":-1,"backend_name":"ibm_fez"}` | 0a04c9e1 | QPU job ended as failed |
| 10:00 | `graph-v1` | `{"num_qubits":20,"coupling_map":"47 edges","operations":"49 ZZ=-1 targets","shots":4096,"mode":"qpu","seed":6,"backend_name":"ibm_fez"}` | 122de1c4 | QPU job ended as failed |
| 18:00 | `retrocausal-echo-v1` | `{"n_sites":24,"depth":8,"machine":"ibm_fez","exact":false,"mix":0.6,"feedback":0.3,"emit":"audio","via":"mothbackend","shots":4096,"fractional_gates":false}` | 3d9695df | ibm_fez estimator failed: [job_failed] job ended as failed |
| 20:00 | `otoc-echo-v1` | `{"n_sites":24,"depth":8,"machine":"ibm_fez","exact":false,"disorder":0.04,"seed":6,"include_taps":true,"min_tap_level":0.0,"via":"mothbackend","shots":4096,"fractional_gates":false}` | 2ef272dc | ibm_fez estimator failed: [job_failed] job ended as failed |

## 08:15 retry on a downscaled frame (did not complete; not counted)

The same 07:30 camera frame scaled down with Pillow (Lanczos), sent by `run_tessa_small.py`.

| Time | Engine | Frame | Params | Job ID | What happened |
|---|---|---|---|---|---|
| 08:15 | `tessa-image-v1` | 16 x 16 | `{"machine":"fake_fez","shots":1024}` | 1c5e4238 | The engine did not respond in time — retry the job |
| 08:15 | `tessa-image-v1` | 16 x 16 | `{"machine":"fake_fez","shots":1024}` | 3c9b053f | The engine did not respond in time — retry the job |
