"""Run the quantum side of Frog Chorus on Atlas qdrive-api-v1. QUANTUM (see `machine` per job).

qdrive-api-v1 builds a circuit from *target expectation values* instead of gates. Each frog is one qubit.
A frog's call phase is the azimuth of its Bloch vector in the X-Y plane (<X> = cos phi, <Y> = sin phi).
Each "hearing" edge between two frogs gets a two-qubit target on <XX> and <YY>: +c asks the pair to lock
in step, -c asks it to alternate (half a cycle apart). For two frogs on the equator,
(<XX> + <YY>)/2 = cos(phi_i - phi_j), the same quantity the Kuramoto model pulls on.
Single-qubit and two-qubit tomography (tomography = 2) of the finished circuit is what the browser
instrument uses: realised phases, how much of each frog's own phase survives, and realised pair locks.

Hardware: the piece's hardware target is IBM ibm_fez (pond.HARDWARE). qdrive-api-v1 cannot reach it: the full
22-qubit build sent with machine = "ibm_fez" (`alt22_build_ibm_fez`, 5 Oct 2026) and two earlier ibm_fez readouts
all failed with "not wired up yet" (retryable: false). So the pond builds the page uses run on machine = "aer",
Atlas's Aer simulator, and the real-hardware counterpart is run_graph_fez.py (graph-v1 on ibm_fez).

Every completed job is cached in ../../cache/qdrive-api-v1/ (re-runs are free and offline) and copied
to out/qdrive_<name>.json. A failed job is retried once, then recorded in out/failed.json; nothing is
ever replaced by a made-up result.

    python run_qdrive.py            # every job in PLAN (only uncached ones are submitted)
    python run_qdrive.py probe3     # just these
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

import pond  # noqa: E402

OUT = HERE / "out"
PIECE = "19-frog-chorus"
# 12 credits for the first build, plus 12 for the ibm_fez redo (10 were ledgered before it): the cap is
# a.spent() at the start of the redo + its allowance.
CAP = 22


def probe3():
    """3-qubit format probe: one single-qubit target, two pair targets, one update()."""
    return ({"n_qubits": 3, "coupling_map": [[0, 1], [1, 2]], "machine": "aer", "seed": 7,
            "shots": 1024, "tomography": 2, "sample": True,
            "targets": [{"qubits": [0], "expvals": {"X": 1.0}},
                        {"qubits": [0, 1], "expvals": {"XX": -1.0, "YY": -1.0}},
                        {"qubits": [1, 2], "expvals": {"XX": 1.0, "YY": 1.0}},
                        None]}, {})


def engine_result(a, job_id):
    """qdrive-api-v1 puts its inline result (circuit, counts, measured Pauli expectations) on the job's
    /status body; /result only lists the circuit file, so atlas.client's cache does not hold it. Fetch it
    once (a read-only GET, no credits) and keep it in out/status/<job_id>.json so later runs and
    MOTH_FREEZE=1 replays read it from disk. The stored body is exactly what Atlas returned."""
    p = OUT / "status" / f"{job_id}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))["result"]
    if os.environ.get("MOTH_FREEZE") == "1":
        raise AtlasError(f"MOTH_FREEZE=1 and no stored status body for {job_id}")
    s = a.get(f"/jobs/{job_id}/status")
    p.parent.mkdir(exist_ok=True)
    p.write_text(json.dumps(s, indent=1), encoding="utf-8")
    return s["result"]


PLAN = {"probe3": probe3}
PLAN.update(pond.plan())   # the full-size pond jobs (added after the probe showed the format)
# The jobs this piece uses. Re-running with no arguments replays exactly these from the cache. The other
# PLAN entries (the ibm_fez build and readouts, the fake_fez readout, 24 qubits) failed on Atlas and are documented
# in PARAMS.md; they are kept so the record is reproducible, but they are only submitted when named explicitly.
DEFAULT = ["probe3", "alt20", "sync20", "alt22", "sync22"]


ONCE = False


def main(names):
    OUT.mkdir(exist_ok=True)
    a = Atlas(piece=PIECE, credit_cap=CAP)
    failed_path = OUT / "failed.json"
    failed = json.loads(failed_path.read_text(encoding="utf-8")) if failed_path.exists() else []
    for name in names:
        try:
            params, files_in = PLAN[name]()
        except KeyError as e:
            print(f"  {name}: skipped ({e})")
            continue
        rec = None
        for attempt in ((1,) if ONCE else (1, 2)):
            try:
                rec = a.run("qdrive-api-v1", params, files=files_in, timeout=3600)
                break
            except AtlasError as e:
                msg = str(e)
                print(f"  {name} attempt {attempt} failed: {msg[:600]}")
                if "MOTH_FREEZE" in msg or "credit cap" in msg or " -> 422" in msg:
                    break  # not submitted (422 = rejected before a job existed), nothing ledgered
                if os.environ.get("MOTH_FREEZE") != "1":
                    failed = [f for f in failed if not (f["name"] == name and f["attempt"] == attempt)]
                    failed.append({"name": name, "attempt": attempt, "error": msg[:1500]})
                if '"retryable": false' in msg:
                    break  # the engine said a retry cannot succeed
        if rec is None:
            continue
        result = engine_result(a, rec["job_id"])
        files = {}
        try:
            for slot, p in a.outputs(rec).items():
                dst = OUT / f"qdrive_{name}_{slot}.qasm"
                shutil.copyfile(p, dst)
                files[slot] = dst.name
        except Exception as e:  # output download is optional: the inline result is what we use
            print(f"  {name}: could not download output files ({str(e)[:200]})")
        (OUT / f"qdrive_{name}.json").write_text(json.dumps({"name": name, "job_id": rec["job_id"],
                                                            "params": params, "input_files": files_in,
                                                            "seconds": rec["seconds"],
                                                            "files": files, "result": result,
                                                            "response": rec["response"]}, indent=1),
                                                 encoding="utf-8")
        print(f"  {name}: {rec['job_id']}  ({rec['seconds']} s)")
    if os.environ.get("MOTH_FREEZE") != "1":
        failed_path.write_text(json.dumps(failed, indent=1), encoding="utf-8")
    print(f"ledgered spend for {PIECE}: {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--once" in args:  # no automatic retry (used for the 22-qubit step-down probe)
        ONCE = True
        args.remove("--once")
    main(args or DEFAULT)
