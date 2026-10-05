"""Turn the stored qdrive-api-v1 results into the instrument's pond data. CLASSICAL bookkeeping only.

Reads out/qdrive_<name>.json (job record + the engine's own result body) for every completed build and
writes out/pond.json, which build_web.py inlines into the page and render_wav.py uses for the WAVs.

Per frog (qubit k): the engine's measured <X>, <Y>, <Z>; its Bloch azimuth atan2(<Y>, <X>) (the frog's
starting phase in the instrument) and r = sqrt(<X>^2 + <Y>^2) (how much of its own phase it kept).
Per hearing edge (i, j): measured <XX>, <YY>, <ZZ> and L = <XX> + <YY>, the realised lock. In the
instrument L is the signed coupling weight: L > 0 pulls the pair into step, L < 0 pushes it apart.
Nights: the engine's 1024 measured shots, each a 0/1 string in qubit order (index k = frog k), used as
"which frogs are calling tonight". Qdrive returns Qiskit-ordered strings (qubit 0 rightmost); we reverse.

The real-hardware counterpart (run_graph_fez.py, graph-v1 on IBM ibm_fez, plus its Aer-emulator baseline) goes to
out/hardware.json: every returned shot (graph-v1 already puts qubit 0 leftmost, so index k = pad k), and for each
shot how many of the pond's hearing pairs "take turns" (one frog calling, the other silent), for each hearing edge the
fraction of shots in which that pair took turns, and two classical reference points: coin flips (half the edges) and
the most any night could reach on this pond (brute-force maximum cut over all 2^20 nights; the inlet triangles stop
it reaching every edge).

Nothing here alters an engine number; values are rounded to 4 decimals for the page.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pond

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
BUILDS = [("alt", -1), ("sync", +1)]


def pauli_key(n, ops):
    s = ["I"] * n
    for q, p in ops.items():
        s[n - 1 - q] = p
    return "".join(s)


def dataset(name, sign):
    rec = json.loads((OUT / f"qdrive_{name}.json").read_text(encoding="utf-8"))
    p, res = rec["params"], rec["result"]
    n, m = p["n_qubits"], res["measured"]
    es = pond.edges(n)
    lay = {e: li for li, l in enumerate(pond.layers(es)) for e in l}
    kinds = {**{tuple(sorted(e)): "inlet" for e in pond.inlets(n)}, **{tuple(sorted(e)): "across" for e in pond.across(n)}}
    req = pond.phases_deg(n)
    frogs = []
    for k, (x, y) in enumerate(pond.positions(n)):
        X, Y, Z = (m[pauli_key(n, {k: a})] for a in "XYZ")
        frogs.append({"k": k, "x": x, "y": y, "X": round(X, 4), "Y": round(Y, 4), "Z": round(Z, 4),
                      "az": round(math.degrees(math.atan2(Y, X)) % 360, 2), "r": round(math.hypot(X, Y), 4),
                      "req": req[k]})
    edges = []
    for (i, j) in es:
        XX, YY, ZZ = (m[pauli_key(n, {i: a, j: a})] for a in "XYZ")
        edges.append({"i": i, "j": j, "XX": round(XX, 4), "YY": round(YY, 4), "ZZ": round(ZZ, 4),
                      "L": round(XX + YY, 4), "layer": lay[(i, j)], "kind": kinds.get((i, j), "bank")})
    nights = []
    for bits, c in sorted(res["counts"].items(), key=lambda kv: (-kv[1], kv[0])):
        nights.extend([bits[::-1]] * c)
    L = [e["L"] for e in edges]
    last = [e["L"] for e in edges if e["layer"] == max(lay.values())]
    status = json.loads((OUT / "status" / f"{rec['job_id']}.json").read_text(encoding="utf-8"))
    return {"name": name, "mode": "alt" if sign < 0 else "sync", "sign": sign, "n": n,
            "job_id": rec["job_id"], "engine": "qdrive-api-v1", "machine": p["machine"],
            "where": "Atlas Aer simulator (noiseless statevector, 1024-shot estimates)",
            "shots": p["shots"], "seed": p["seed"], "tomography": p["tomography"],
            "lock_request": round(sign * 2 * pond.LOCK, 3), "targets": len(p["targets"]),
            "updates": sum(t is None for t in p["targets"]), "layers": max(lay.values()) + 1,
            "seconds": rec["seconds"], "submitted_at": status.get("submitted_at"),
            "stats": {"L_mean": round(sum(L) / len(L), 4), "L_last_layer_mean": round(sum(last) / len(last), 4),
                      "witness_edges": sum(abs(v) > 1 for v in L), "r_mean": round(sum(f["r"] for f in frogs) / n, 4),
                      "distinct_nights": len(res["counts"])},
            "frogs": frogs, "edges": edges, "nights": nights}


def max_turns(es, n):
    """CLASSICAL: the most hearing pairs any single night can have taking turns (maximum cut), by brute force."""
    import numpy as np
    idx = np.arange(2 ** n, dtype=np.int64)
    cut = np.zeros(2 ** n, dtype=np.int16)
    for i, j in es:
        cut += ((idx >> i) & 1) != ((idx >> j) & 1)
    return int(cut.max())


def graph_run(name):
    rec = json.loads((OUT / f"graph_{name}.json").read_text(encoding="utf-8"))
    o, p = rec["response"]["result"]["output"], rec["params"]
    n = o["num_qubits"]
    es = pond.edges(n)
    assert [sorted(e) for e in o["coupling_map"]] == [list(e) for e in es], "engine echoed a different graph"
    shots = []
    for m in o["measurements"]:  # the engine's ranked list; with shots = 20 it holds every shot
        shots.extend([m["bitstring"]] * m["count"])
    assert len(shots) == p["shots"] == o["shots"], "the returned list does not hold every shot"
    turns = [sum(b[i] != b[j] for i, j in es) for b in shots]
    mean = sum(turns) / len(turns)
    sd = math.sqrt(sum((t - mean) ** 2 for t in turns) / (len(turns) - 1))
    rel = o["tomography"]["relationships"]
    return {"name": name, "job_id": rec["job_id"], "engine": "graph-v1", "mode": o["mode"], "backend": o["backend"],
            "ibm_job_id": o.get("ibm_job_id"), "n": n, "shots": len(shots), "seconds": rec["seconds"],
            "zz_target": p["operations"][-1]["paulis"]["ZZ"], "fraction": p["operations"][-1]["fraction"],
            "nights": shots, "turns": turns, "turns_mean": round(mean, 4), "turns_se": round(sd / math.sqrt(len(turns)), 4),
            "edge_turns": [round(sum(b[i] != b[j] for b in shots) / len(shots), 4) for i, j in es],
            "p_call": [round(sum(b[k] == "1" for b in shots) / len(shots), 4) for k in range(n)],
            "tomo_zz": [round(rel[f"{i},{j}"]["ZZ"], 4) for i, j in es],
            "dominant": o["dominant_bitstring"], "edge_agreement_score": o["edge_agreement_score"]}


def hardware():
    if not (OUT / "graph_turns20_ibm_fez.json").exists():
        return None
    n = 20
    es = pond.edges(n)
    runs = {"fez": graph_run("turns20_ibm_fez")}
    if (OUT / "graph_turns20_emu.json").exists():
        runs["emu"] = graph_run("turns20_emu")
    out = {"n": n, "edges": [list(e) for e in es], "max_turns": max_turns(es, n), "random_turns": len(es) / 2,
           "runs": runs}
    if "emu" in runs:
        # graph-v1 rebuilds the circuit for every job: where do the two jobs' reported noiseless states differ?
        ta, tb = (json.loads((OUT / f"graph_{r['name']}.json").read_text(encoding="utf-8"))["response"]["result"]["output"]["tomography"]
                  for r in (runs["fez"], runs["emu"]))
        rel = lambda t, i, j: t["relationships"][f"{i},{j}"]  # noqa: E731
        out["tomo_diff"] = {
            "edges_any": [[i, j] for i, j in es if max(abs(rel(ta, i, j)[q] - rel(tb, i, j)[q]) for q in rel(ta, i, j)) > 0.05],
            "edges_zz": [[i, j] for i, j in es if abs(rel(ta, i, j)["ZZ"] - rel(tb, i, j)["ZZ"]) > 0.05],
            "qubits": [k for k in range(n) if max(abs(ta["bloch"][str(k)][q] - tb["bloch"][str(k)][q]) for q in "XYZ") > 0.05]}
    return out


def main():
    hw = hardware()
    (OUT / "hardware.json").write_text(json.dumps(hw), encoding="utf-8")
    if hw:
        for k, r in hw["runs"].items():
            print(f"{r['name']}: {r['n']} qubits on {r['backend']}, job {r['job_id']}, {r['shots']} shots, pairs taking turns "
                  f"{r['turns_mean']:.2f} +/- {r['turns_se']:.2f} of {len(hw['edges'])} (coin flips {hw['random_turns']}, "
                  f"best possible {hw['max_turns']})")
    data = []
    for n in (20, 22, 24):
        for mode, sign in BUILDS:
            name = f"{mode}{n}"
            if (OUT / f"qdrive_{name}.json").exists():
                data.append(dataset(name, sign))
    (OUT / "pond.json").write_text(json.dumps(data), encoding="utf-8")
    for d in data:
        print(f"{d['name']}: {d['n']} qubits, job {d['job_id']}, L mean {d['stats']['L_mean']:+.3f}, "
              f"last layer {d['stats']['L_last_layer_mean']:+.3f}, r mean {d['stats']['r_mean']:.3f}, "
              f"{d['stats']['distinct_nights']} distinct nights")


if __name__ == "__main__":
    main()
