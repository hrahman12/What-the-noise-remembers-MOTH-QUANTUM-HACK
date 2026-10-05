"""The pond on real IBM hardware: Atlas graph-v1 on ibm_fez. QUANTUM (IBM hardware; the emu job is a baseline).

qdrive-api-v1, which builds the chorus data, runs only on Atlas's Aer simulator: asked for `ibm_fez` it fails
with "not wired up yet" (three ledgered attempts, see PARAMS.md). graph-v1 is the Atlas engine here that can
send a prepared state to an IBM chip (`mode = "qpu"`, `backend_name`), so this script gives the same pond a
real-hardware counterpart, encoded the only way graph-v1 can measure it:

  * 20 qubits, one per lily pad of the 20-pad pond (graph-v1's ceiling is 20 qubits), and the same 27 hearing
    edges as `coupling_map`.
  * Every frog starts undecided: a Bloch target X = 1 (|+>), so on its own it is equally likely to be heard
    calling (1) or silent (0).
  * "Take turns" on every hearing edge: a relationship target ZZ = -0.7 (the same -0.7 the qdrive build asks of
    XX and of YY), so when one frog of a pair calls the other tends to be silent. graph-v1 measures only in the
    Z basis, so it cannot see the XX + YY phase locks the qdrive build targets; this is a different observable
    of the same "neighbours take turns" request, and the page says so.
  * Rotation fraction (2/pi) asin(0.7) = 0.4936 per edge, the rule that lands an isolated edge exactly on its
    target from |++>; edges go in breadth-first build order from pad 0 (tree edges first, loop-closing edges as
    the loops close). Chosen with a classical re-implementation of QuantumGraph's rules (design aid only, never
    shown as engine output).
  * shots = 20, because graph-v1 returns only its 20 most frequent bitstrings: at 20 qubits almost every shot is
    distinct, so with more shots the list would be a biased slice. With 20 shots it holds every shot.

Each returned bitstring is one night heard on the chip: index k = pad k (graph-v1 already puts qubit 0 leftmost).
The emu job (identical parameters, Atlas Aer emulator) is the deliberate noiseless baseline.

    python run_graph_fez.py                  # every job in DEFAULT (only uncached ones are submitted)
    python run_graph_fez.py turns20_emu      # just these
"""
from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

import pond  # noqa: E402
from run_qdrive import CAP, PIECE  # noqa: E402  (one cap for the whole piece)

OUT = HERE / "out"
ENGINE = "graph-v1"
N = 20            # graph-v1's documented maximum (num_qubits 2-20)
SHOTS = 20        # graph-v1 returns its top 20 bitstrings; 20 shots means every shot comes back
TURNS = -pond.LOCK  # ZZ target on every hearing edge: -0.7
FRACTION = round(2 / math.pi * math.asin(abs(TURNS)), 4)


def bfs_order(es, n=N):
    """Edges in the order the pond 'grows' by breadth-first search from pad 0: each new pad is attached, then any
    edge back to pads already present (these close loops). Deterministic, classical."""
    adj = {i: [] for i in range(n)}
    for a, b in es:
        adj[a].append(b)
        adj[b].append(a)
    order, seen, q = [], {0}, [0]
    while q:
        u = q.pop(0)
        order.append(u)
        for v in sorted(adj[u]):
            if v not in seen:
                seen.add(v)
                q.append(v)
    idx = {u: k for k, u in enumerate(order)}
    return sorted(es, key=lambda e: (max(idx[e[0]], idx[e[1]]), min(idx[e[0]], idx[e[1]])))


def graph_params(mode="qpu", n=N):
    es = pond.edges(n)
    ops = [{"type": "bloch", "qubit": k, "paulis": {"X": 1.0}} for k in range(n)]
    ops += [{"type": "relationship", "qubits": [i, j], "paulis": {"ZZ": TURNS}, "fraction": FRACTION}
            for i, j in bfs_order(es, n)]
    p = {"num_qubits": n, "coupling_map": [list(e) for e in es], "operations": ops, "shots": SHOTS, "mode": mode}
    if mode == "qpu":
        p["backend_name"] = pond.HARDWARE  # IBM ibm_fez is this piece's hardware target
    return p


PLAN = {f"turns{N}_{pond.HARDWARE}": lambda: graph_params("qpu"),   # the real-hardware run
        f"turns{N}_emu": lambda: graph_params("emu")}                # deliberate noiseless baseline, same params
DEFAULT = list(PLAN)


def main(names):
    OUT.mkdir(exist_ok=True)
    a = Atlas(piece=PIECE, credit_cap=CAP)
    failed_path = OUT / "failed.json"
    failed = json.loads(failed_path.read_text(encoding="utf-8")) if failed_path.exists() else []
    for name in names:
        params = PLAN[name]()
        rec = None
        for attempt in (1, 2):  # retry once, then fall back honestly (the page keeps the Aer data either way)
            try:
                rec = a.run(ENGINE, params, timeout=3600)
                break
            except AtlasError as e:
                msg = str(e)
                print(f"  {name} attempt {attempt} failed: {msg[:600]}")
                if "MOTH_FREEZE" in msg or "credit cap" in msg or " -> 422" in msg or "(re-run to resume)" in msg:
                    break  # not submitted, or still queued (re-run to resume): nothing new ledgered
                if os.environ.get("MOTH_FREEZE") != "1":
                    failed = [f for f in failed if not (f["name"] == name and f["attempt"] == attempt)]
                    failed.append({"name": name, "attempt": attempt, "engine": ENGINE, "error": msg[:1500]})
        if rec is None:
            continue
        out = rec["response"]["result"]["output"]
        if params["mode"] == "qpu" and out.get("backend") != pond.HARDWARE:
            raise SystemExit(f"{name}: engine reports backend {out.get('backend')!r}, expected {pond.HARDWARE}")
        (OUT / f"graph_{name}.json").write_text(json.dumps({"name": name, "engine": ENGINE, "job_id": rec["job_id"],
                                                            "params": params, "seconds": rec["seconds"],
                                                            "response": rec["response"]}, indent=1),
                                                encoding="utf-8")
        print(f"  {name}: {rec['job_id']}  backend {out.get('backend')}  ibm job {out.get('ibm_job_id')}  "
              f"({rec['seconds']} s)")
    if os.environ.get("MOTH_FREEZE") != "1":
        failed_path.write_text(json.dumps(failed, indent=1), encoding="utf-8")
    print(f"ledgered spend for {PIECE}: {a.spent():g} of {CAP} credits")


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT)
