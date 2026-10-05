"""Probe tamagotchi-v1 semantics with small jobs (0 credits each). QUANTUM (Aer stabilizer simulator on Atlas).

Prints the raw result of each probe so the field meanings can be read off, and appends every job to
engine/probe_jobs.json. Re-runs are served from cache/tamagotchi-v1/.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

PROBES = {
    "x0_se_p1e-2_n2": {"n_logical": 2, "shots": 4000, "seed": 7,
                       "actions": [["X", 0], ["SE", [0, 1]]],
                       "noise": {"p_1q": 0.01, "p_gate": 0.01, "p_idle": 0.01, "p_meas": 0.01}},
    "x0_nose_p1e-2_n2": {"n_logical": 2, "shots": 4000, "seed": 7,
                         "actions": [["X", 0]],
                         "noise": {"p_1q": 0.01, "p_gate": 0.01, "p_idle": 0.01, "p_meas": 0.01}},
    "x0_se_p1e-2_n1": {"n_logical": 1, "shots": 4000, "seed": 7,
                       "actions": [["X", 0], ["SE", 0]],
                       "noise": {"p_1q": 0.01, "p_gate": 0.01, "p_idle": 0.01, "p_meas": 0.01}},
    "x0_se2_p1e-2_n1": {"n_logical": 1, "shots": 4000, "seed": 7,
                        "actions": [["X", 0], ["SE", 0], ["SE", 0]],
                        "noise": {"p_1q": 0.01, "p_gate": 0.01, "p_idle": 0.01, "p_meas": 0.01}},
    "measonly_nose_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                         "actions": [["I", 0]],
                         "noise": {"p_meas": 0.01}},
    "measonly_se_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                       "actions": [["SE", 0]],
                       "noise": {"p_meas": 0.01}},
    "idleonly_se_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                       "actions": [["SE", 0]],
                       "noise": {"p_idle": 0.01}},
    "gateonly_se_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                       "actions": [["SE", 0]],
                       "noise": {"p_gate": 0.01}},
    "1qonly_nose_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                       "actions": [["I", 0]],
                       "noise": {"p_1q": 0.01}},
    "storage_se_p1e-2_n2": {"n_logical": 2, "shots": 4000, "seed": 7,
                            "actions": [["X", 0], ["SE", [0, 1]]],
                            "noise": {"p_idle": 0.01, "p_meas": 0.01}},
    "storage_nose_p1e-2_n2": {"n_logical": 2, "shots": 4000, "seed": 7,
                              "actions": [["X", 0]],
                              "noise": {"p_idle": 0.01, "p_meas": 0.01}},
    "idleonly_nose_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                         "actions": [["I", 0]],
                         "noise": {"p_idle": 0.05}},
    "idleonly_nose3_n1": {"n_logical": 1, "shots": 8000, "seed": 7,
                          "actions": [["I", 0], ["I", 0], ["I", 0]],
                          "noise": {"p_idle": 0.05}},
    "measonly_se_p0.5_n1": {"n_logical": 1, "shots": 2000, "seed": 7,
                            "actions": [["SE", 0]],
                            "noise": {"p_meas": 0.5}},
}


def main(names=None):
    a = Atlas(piece="09-syndrome-loom", credit_cap=5)
    path = HERE / "probe_jobs.json"
    log = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    for name, params in PROBES.items():
        if names and name not in names:
            continue
        try:
            rec = a.run("tamagotchi-v1", params, timeout=600)
        except AtlasError as e:
            print(name, "FAILED", str(e)[:600])
            log[name] = {"params": params, "error": str(e)[:600]}
            continue
        out = rec["response"]["result"]["output"]
        short = {k: v for k, v in out.items() if k != "per_logical"}
        print(name, rec["job_id"], json.dumps(short))
        print("   per_logical:", json.dumps(out.get("per_logical"))[:400])
        log[name] = {"params": params, "job_id": rec["job_id"], "output": out}
    path.write_text(json.dumps(log, indent=1), encoding="utf-8")
    print("spent", a.spent())


if __name__ == "__main__":
    main(sys.argv[1:])
