"""Train a 12-qubit quantum reservoir on the coda token sequence, then generate from it.
QUANTUM: qrc-train-v2 and qrc-gen-v2 on Atlas (Qiskit Aer simulator, server side; no QPU mode).

Stages (each job is cached in ../../cache/<engine>/, so re-runs are free and work offline):
  0. probe   qrc-train-v2 with num_qubits=13, expecting a free 422 (documents the 12-qubit ceiling)
  1. train   qrc-train-v2, num_qubits=12, on all 3,840 codas in corpus order        (5 credits)
  2. sweep   qrc-gen-v2 at 7 variation levels from the pristine trained state        (7 x 1 credit)
             (16 and 64 were added after 0.25-4 turned out to change the output very little)
  3. handoff qrc-gen-v2 warmed up on the real stretch that opens the WAV             (1 credit)
  4. takes   a second, independent take at each variation level (random_seed 2)      (5 x 1 credit)
The trained model reaches qrc-gen-v2 by reference: input_files.state = the asset ID of qrc-train-v2's own
`state` output (no download or re-upload). This endpoint rejects the "job:<id>/state" form with a free 422
("must be an asset UUID"); that form belongs to the multipart /v1/generation endpoint.
Every gen call uses that pristine training state, so takes are independent (no chaining).

Writes out/jobs.json (every completed job, with its inline result) and out/train_loss.json.
Failed jobs are retried once and never replaced by anything synthetic.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

from codas import OUT, load_tokens, pick_stretch  # noqa: E402

PIECE, CAP = "02-coda-reservoir", 20
VARIATIONS = [0.25, 0.5, 1.0, 2.0, 4.0, 16.0, 64.0]
TAKE2_VARIATIONS = [0.25, 0.5, 1.0, 2.0, 4.0]   # second takes were run for these levels only
GEN_LENGTH = 160
GEN_SEED = 1
TRAIN = {
    "num_qubits": 12,          # engine maximum (13 is rejected by the schema)
    "sample_length": 16,
    "washout": 4,
    "mode": "order",
    "sample_fraction": 0.125,
    "periodic": True,
    "epochs": 100,
    "shots": 3000,
    "mixing": 0.7,
    "num_random_gates": 10,
    "seed": 3617,
}


def run_once(a, engine, params, files=None, timeout=3600):
    for attempt in (1, 2):
        try:
            return a.run(engine, params, files=files, timeout=timeout)
        except AtlasError as e:
            msg = str(e)
            print(f"  {engine} attempt {attempt} failed: {msg[:300]}")
            if "credit cap" in msg or "MOTH_FREEZE" in msg or " 402" in msg or "quota" in msg.lower():
                raise
    return None


def status_of(a, key, job_id):
    """The inline result (loss curve / generated tokens) arrives on GET /jobs/{id}/status, not in the
    /result body. Cache that response in out/status/<key>.json so replays stay offline."""
    path = OUT / "status" / f"{key}.json"
    if path.exists():
        st = json.loads(path.read_text(encoding="utf-8"))
        if st.get("job_id") == job_id:
            return st
    st = a.get(f"/jobs/{job_id}/status")
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(st, indent=1), encoding="utf-8")
    return st


def main(stages):
    a = Atlas(piece=PIECE, credit_cap=CAP)
    d = load_tokens()
    seq = [c["token"] for c in d["codas"]]
    vocab = [v["token"] for v in d["vocab"]]
    jobs_path = OUT / "jobs.json"
    jobs = json.loads(jobs_path.read_text(encoding="utf-8")) if jobs_path.exists() else {}

    if "probe" in stages:
        probe = OUT / "probe_13_qubits.txt"
        if not probe.exists() and os.environ.get("MOTH_FREEZE") != "1":
            r = a._req("POST", "/engines/qrc-train-v2/process",
                       json={"params": {"num_qubits": 13, "sequence": [1, 2, 1, 2]}}, ok=(422,))
            probe.write_text(f"HTTP {r.status_code}\n{r.text[:2000]}\n", encoding="utf-8")
            if r.status_code != 422:   # accepted after all: ledger it honestly
                from atlas.client import CACHE
                with open(CACHE / "ledger.jsonl", "a", encoding="utf-8") as f:
                    f.write(json.dumps({"piece": PIECE, "engine": "qrc-train-v2", "job_id": r.json().get("job_id"),
                                        "credits": a.credits_per_run("qrc-train-v2"), "key": "probe13"}) + "\n")
        print(probe.read_text(encoding="utf-8")[:300] if probe.exists() else "probe skipped")

    train = None
    if "train" in stages or any(s in stages for s in ("sweep", "handoff", "takes")):
        params = {**TRAIN, "sequence": seq, "vocabulary": vocab}
        train = run_once(a, "qrc-train-v2", params)
        if train is None:
            raise SystemExit("training failed twice; stopping (nothing fabricated)")
        st = status_of(a, "train", train["job_id"])
        (OUT / "train_loss.json").write_text(json.dumps(st.get("result"), indent=1), encoding="utf-8")
        jobs["train"] = {"engine": "qrc-train-v2", "job_id": train["job_id"],
                         "params": {k: v for k, v in params.items() if k not in ("sequence",)},
                         "sequence_len": len(seq), "seconds": train["seconds"]}
        print(f"train {train['job_id']}  ({train['seconds']} s)")
    state = None
    if train:
        out = {o["slot"]: o for o in train["response"].get("outputs") or []}
        state = {"state": out["state"]["output_asset_id"]}
        jobs["train"]["state_asset_id"] = out["state"]["output_asset_id"]

    def gen(key, params):
        rec = run_once(a, "qrc-gen-v2", params, files=state)
        if rec is None:
            jobs[key] = {"engine": "qrc-gen-v2", "status": "failed", "params": params}
            return
        st = status_of(a, key, rec["job_id"])
        jobs[key] = {"engine": "qrc-gen-v2", "job_id": rec["job_id"], "params": params,
                     "seconds": rec["seconds"], "result": rec["response"].get("result") or st.get("result"),
                     "outputs": [o.get("slot") for o in (rec["response"].get("outputs") or [])]}
        print(f"{key}: {rec['job_id']}  ({rec['seconds']} s)")

    if "sweep" in stages:
        for v in VARIATIONS:
            gen(f"var_{v}", {"length": GEN_LENGTH, "variation": v, "random_seed": GEN_SEED})
    if "handoff" in stages:
        i, j = pick_stretch(d["codas"])
        gen("handoff", {"length": GEN_LENGTH, "variation": 1.0, "random_seed": GEN_SEED,
                        "initial_events": seq[i:j]})
    if "takes" in stages:
        for v in TAKE2_VARIATIONS:
            gen(f"var_{v}_s2", {"length": GEN_LENGTH, "variation": v, "random_seed": 2})

    jobs_path.write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    print(f"ledgered spend for {PIECE}: {a.spent():g} / {CAP}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["train", "sweep", "handoff", "takes"])
