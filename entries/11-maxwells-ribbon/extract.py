"""Rebuild colours from the qpixl-v1 outputs and write the page data. CLASSICAL post-processing.

For each completed job: output values -> components c = 2v - 1 for the X, Y, Z plates -> one arrow
per pixel -> clipped to the unit ball (an arrow can't be longer than 1) -> colour (our ball formula).
Nothing else is done to the measured numbers.

Writes web/data.json (page data), out/metrics.csv, out/rebuilt_<machine>_<shots>.png (the rebuilt
test colours and ribbon as images) and PARAMS-ready rows in out/jobs.json.
"""
import csv
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT, WEB = HERE / "out", HERE / "web"
import sys  # noqa: E402
sys.path.insert(0, str(HERE))
from payload import rgb_to_vec  # noqa: E402
from plate import ball_to_rgb  # noqa: E402

MACHINES = [
    {"id": "aer", "label": "Perfect", "short": "aer simulator", "kind": "sim"},
    {"id": "fake_fez", "label": "Fez noise", "short": "fake_fez model", "kind": "noise"},
    {"id": "fake_brisbane", "label": "Brisbane noise", "short": "fake_brisbane model", "kind": "noise"},
    {"id": "ibm_fez", "label": "Real chip", "short": "ibm_fez hardware", "kind": "hw"},
]
SHOTS = [16, 128, 1024]


def vec_to_rgb(v):
    r = float(np.linalg.norm(v))
    if r < 1e-9:
        return [128, 128, 128]
    r1 = min(1.0, r)
    th = math.acos(max(-1.0, min(1.0, v[2] / r)))
    return list(ball_to_rgb(r1, th, math.atan2(v[1], v[0])))


def hexs(rgbs):
    return "".join("%02x%02x%02x" % tuple(int(c) for c in p) for p in rgbs)


def qubits_text(machine, topo):
    if machine == "aer":
        return ("not reported: aer simulates each data-qubit group (at most 4 qubits) as its own small circuit, "
                "on a lattice the engine sizes to the 4,096 values")
    t = topo[machine]
    where = "one joint circuit on the chip" if machine.startswith("ibm_") else "each group simulated on its own physical qubits"
    return (f"{t['qubits_used_at_capacity']} ({t['data_qubits']} data + {t['address_qubits']} address), {where}; "
            f"counted from the chip's coupling map")


def main():
    pay = json.loads((HERE / "data" / "payloads.json").read_text(encoding="utf-8"))
    sw = json.loads((HERE / "swatches.json").read_text(encoding="utf-8"))["swatches"]
    topo = json.loads((HERE / "data" / "topology.json").read_text(encoding="utf-8"))
    kinds = {m["id"]: m for m in MACHINES}
    jobs, rows, page = [], [], []
    for m in MACHINES:
        for s in SHOTS:
            f = OUT / f"qpixl_{m['id']}_{s}.json"
            if not f.exists():
                continue
            r = json.loads(f.read_text(encoding="utf-8"))
            p = pay[m["id"]]
            n, ns, rn = p["n_pixels"], p["n_swatches"], p["ribbon"]
            sent = np.array(p["values"])
            got = np.array(r["output"], dtype=float)
            assert len(got) == len(sent), (f, len(got), len(sent))
            comp = 2 * got[:3 * n].reshape(3, n).T - 1          # rows = pixels, cols = X, Y, Z
            comp0 = 2 * sent[:3 * n].reshape(3, n).T - 1
            rgb = [vec_to_rgb(v) for v in comp]
            miss = np.linalg.norm(np.clip(comp[:ns], -1, 1) - comp0[:ns], axis=1)
            surf = np.linalg.norm(comp0[:ns], axis=1) > 0.99
            shrink = np.linalg.norm(comp[:ns][surf], axis=1) / np.linalg.norm(comp0[:ns][surf], axis=1)
            val_err = float(np.abs(got - sent)[:3 * n].mean())
            extremes = float(np.mean((got[:3 * n] == 0) | (got[:3 * n] == 1)))   # numbers that came back as exactly 0 or 1
            # images: test colours as a strip of 2x2 blocks in the same order, plus the ribbon
            strip = Image.new("RGB", (16 * 4, 7 * 4), (13, 15, 23))
            for i, c in enumerate(rgb[:ns]):
                strip.paste(tuple(c), ((i % 16) * 4, (i // 16) * 4, (i % 16) * 4 + 4, (i // 16) * 4 + 4))
            strip.save(OUT / f"rebuilt_colours_{m['id']}_{s}.png")
            if rn:
                rib = Image.new("RGB", (rn, rn))
                rib.putdata([tuple(c) for c in rgb[ns:ns + rn * rn]])
                rib.save(OUT / f"rebuilt_ribbon_{m['id']}_{s}.png")
            kind = m["kind"]
            page.append({
                "machine": m["id"], "shots": s, "kind": kind, "job_id": r["job_id"], "backend": r["backend"],
                "ibm_job_id": r.get("ibm_job_id") or "", "qpu_seconds": r.get("qpu_seconds") or 0,
                "label": f"{m['short']}, {s} shots", "qubits_text": qubits_text(m["id"], topo),
                "sw": hexs(rgb[:ns]), "swv": [[round(float(x), 3) for x in v] for v in comp[:ns]],
                "rib_n": rn, "rib": hexs(rgb[ns:ns + rn * rn]),
                "err": round(float(miss.mean()), 4), "shrink": round(float(shrink.mean()), 4), "val_err": round(val_err, 4),
                "extremes": round(extremes, 4),
                "n_values": len(sent), "seconds": r["seconds"],
            })
            rows.append({"machine": m["id"], "shots": s, "job_id": r["job_id"], "backend": r["backend"],
                         "ibm_job_id": r.get("ibm_job_id") or "", "n_values": len(sent), "mean_value_error": round(val_err, 4),
                         "mean_colour_miss": round(float(miss.mean()), 4), "surface_shrink": round(float(shrink.mean()), 4),
                         "frac_exactly_0_or_1": round(extremes, 4),
                         "seconds": r["seconds"]})
            jobs.append({k: r[k] for k in ("engine", "machine", "shots", "job_id", "backend", "ibm_job_id", "qpu_seconds", "seconds", "params", "n_values")})
    with open(OUT / "metrics.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"  {r['machine']:14s} {r['shots']:5d}  miss {r['mean_colour_miss']:.3f}  shrink {r['surface_shrink']:.3f}  "
              f"value err {r['mean_value_error']:.3f}  {r['job_id']}")
    (OUT / "jobs.json").write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    rib0 = {str(p["ribbon"]): hexs(p["ribbon_rgb"]) for p in pay.values() if p["ribbon"]}
    data = {"swatches": [{"i": s["i"], "rgb": s["rgb"]} for s in sw], "jobs": page, "rib0": rib0,
            "meta": {"crop_box": json.loads((HERE / "swatches.json").read_text(encoding="utf-8"))["ribbon"]["crop_box"],
                     "machines": MACHINES, "topology": topo}}
    (WEB / "data.json").write_text(json.dumps(data), encoding="utf-8")
    print(f"web/data.json: {len(page)} jobs")
    write_params(page, topo)


def write_params(page, topo):
    """PARAMS.md, generated from the job records so it can't drift from them."""
    att = [json.loads(x) for x in (OUT / "attempts.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    tess = [a for a in att if a.get("engine", "tessa-image-v1") == "tessa-image-v1"]
    qfail = [a for a in att if a.get("engine") == "qpixl-v1"]
    where = {"sim": "Atlas simulator, noiseless", "noise": "Atlas emulator + IBM noise model", "hw": "IBM quantum hardware"}
    L = ["# Parameters and jobs", "",
         "Generated by `extract.py` from `out/qpixl_*.json` and `out/attempts.jsonl`. Every row is a completed job used on the page.", "",
         "## qpixl-v1 (the engine this piece uses)", "",
         "Common: `values` = the colour plates from `payload.py` (X plate, Y plate, Z plate, each component c sent as (c+1)/2, then "
         "0.5 padding to the machine's capacity); `dynamic_range` = `none` (default); `discretize` = 0 (default).", "",
         "| machine | mode | shots | values | qubits | ran on | job_id | IBM job | miss | shrink |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for j in page:
        m = j["machine"]
        q = "not reported"
        if m in topo:
            t = topo[m]
            how = "layout only, groups simulated separately" if j["kind"] == "noise" else "one joint circuit"
            q = f"{t['qubits_used_at_capacity']} ({t['data_qubits']} data + {t['address_qubits']} address; {how})"
        mode = "qpu" if j["kind"] == "hw" else "emu"
        L.append(f"| {m} | {mode} | {j['shots']} | {j['n_values']} | {q} | {where[j['kind']]} | `{j['job_id']}` | "
                 f"{('`' + j['ibm_job_id'] + '`') if j['ibm_job_id'] else '-'} | {j['err']:.3f} | {j['shrink']:.3f} |")
    L += ["", "*miss* = mean distance between each of the 112 test colours' arrows and its rebuilt arrow (ball radius 1). "
          "*shrink* = mean rebuilt arrow length / sent length, for the 80 surface colours (1 = no greying).", "",
          "Qubits: qpixl-v1 does not report a qubit count. For the IBM layouts it is computed by `topology.py` from the chip's "
          "coupling map with the engine's documented checkerboard rule (data qubits on one colour class of the heavy-hex graph, "
          "2^degree values each). That rule reproduces the capacities measured on the live engine (fake_fez 448, fake_brisbane 360, "
          "fake_torino 378), and every payload here fills its machine's full capacity. On aer the engine sizes its own lattice "
          "and does not report it. Per the engine's description, the fake_* noise models rebuild one data-qubit group "
          "(a data qubit plus its address neighbours, at most 4 qubits) at a time, each pinned to its own physical qubits, so the "
          "full layout never runs as one circuit there (aer also runs group by group); on ibm_fez the whole circuit runs as one "
          "joint hardware job.", ""]
    if qfail:
        L += ["### qpixl-v1 attempts that failed", "", "| machine | shots | attempt | error |", "|---|---|---|---|"]
        for a in qfail:
            L.append(f"| {a['machine']} | {a['shots']} | {a['attempt']} | {a['error'][:160].replace('|', '/')} |")
        L.append("")
    L += ["## tessa-image-v1 (planned engine; every attempt failed)", "",
          "Params `{machine, shots}` on `plate.png` (built by `plate.py`). All failed server-side with `engine_timeout` "
          "(\"The engine did not respond in time\"), including the platform's own automatic retry, so no output exists.", "",
          "| # | plate | machine | shots | job_id |", "|---|---|---|---|---|"]
    for i, a in enumerate(tess, 1):
        jid = a.get("job_id") or a["error"].split()[1]
        L.append(f"| {i} | {a.get('plate', '32x32 (ribbon 24x24 + 112 swatches of 2x2)')} | {a['machine']} | {a['shots']} | `{jid}` |")
    L += ["", "Every attempt above is ledgered at 1 credit in `cache/ledger.jsonl` (whether Atlas billed failed jobs is not visible to us)."]
    (HERE / "PARAMS.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("PARAMS.md written")


if __name__ == "__main__":
    main()
