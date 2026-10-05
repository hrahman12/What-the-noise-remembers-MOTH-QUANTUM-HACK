"""Bundle the measured qpixl curves into one JSON: the plugin's BinaryData, the Python replica's input
and the browser synth's data. CLASSICAL bookkeeping only: measured numbers are copied, not changed.

Reads out/qpixl_<machine>.json (written by run_qpixl.py from cached Atlas jobs) and physics.py.
Writes plugin/Resources/flavour_curves.json.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

import physics

HERE = Path(__file__).resolve().parent
ORDER = ["ibm_fez", "aer", "fake_fez", "fake_marrakesh", "fake_torino", "fake_brisbane", "fake_kyiv",
         "fake_sherbrooke", "fake_kyoto", "fake_osaka", "fake_quebec", "fake_cusco", "fake_strasbourg",
         "fake_brussels"]
KIND_LABEL = {"qpu": "IBM hardware", "sim": "noiseless simulator", "emu": "IBM noise model (emulator)"}
EAGLES = ["fake_brisbane", "fake_kyiv", "fake_sherbrooke", "fake_kyoto", "fake_osaka", "fake_quebec", "fake_cusco",
          "fake_strasbourg", "fake_brussels"]
# data-qubit groups ("gcells") shown in job progress for each lattice; None = not observed
GROUPS = {"aer": None, "fake_fez": 64, "fake_marrakesh": 64, "fake_torino": 56, "ibm_fez": None,
          **{m: 54 for m in EAGLES}}


def qubits(m, values):
    addr = int(math.ceil(math.log2(values)))
    g = GROUPS.get(m)
    if m == "aer":
        how = "run as data-qubit groups of 16 values (4 address qubits each, inferred from shot-noise scatter)"
    elif g:
        how = f"spread over {g} data-qubit groups on the chip lattice (from job progress)"
    else:
        how = "one joint circuit on the chip lattice; physical qubit count not reported by the engine"
    return {"rule": addr + 1, "address": addr, "groups": g, "how": how}


def main():
    le, P = physics.curves(1024)
    machines = []
    for m in ORDER:
        f = HERE / "out" / f"qpixl_{m}.json"
        if not f.exists():
            continue
        r = json.loads(f.read_text(encoding="utf-8"))
        meas, ex = np.array(r["measured"]), np.array(r["exact"])
        ibm = r.get("ibm_job_id") or []          # the engine returns a string for one IBM job, a list otherwise
        ibm = [ibm] if isinstance(ibm, str) else list(ibm)
        machines.append({
            "id": m, "label": m,
            "kind": r["kind"], "kind_label": KIND_LABEL[r["kind"]], "backend": r["backend"],
            "job_id": r["job_id"], "ibm_job_id": ibm, "qpu_seconds": r.get("qpu_seconds"),
            "n": r["n"], "values": r["values_sent"], "shots": r["shots"],
            "rms": [round(float(np.sqrt(np.mean((meas[i] - ex[i]) ** 2))), 5) for i in range(4)],
            "sum_dev": round(float(np.mean(np.abs(meas[1] + meas[2] + meas[3] - 1))), 5),
            "qubits": qubits(m, r["values_sent"]),
            "scale": r["scale"], "P": np.round(meas, 5).tolist(),
        })
    out = {"title": "FLAVOUR measured neutrino flavour curves", "le_min": physics.LE_MIN, "le_max": physics.LE_MAX,
           "sigma": physics.SIGMA, "source": physics.SOURCE, "params": physics.NUFIT, "curves": physics.CURVES,
           "engine": "qpixl-v1 (Moth Atlas)",
           "exact": {"n": 1024, "P": np.round(P, 5).tolist()}, "machines": machines}
    dst = HERE / "plugin" / "Resources" / "flavour_curves.json"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"bundled {len(machines)} machines -> {dst.relative_to(HERE)} ({dst.stat().st_size // 1024} KB)")
    for m in machines:
        print(f"  {m['id']:16s} {m['kind']:4s} n={m['n']:5d}  rms(e,mu,tau) "
              f"{m['rms'][1]:.4f} {m['rms'][2]:.4f} {m['rms'][3]:.4f}  |sum-1| {m['sum_dev']:.4f}")


if __name__ == "__main__":
    main()
