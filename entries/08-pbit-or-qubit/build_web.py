"""Assemble the two front ends from web/template.html:

  web/index.html         the published artifact: replays the cached real batches (it cannot call Atlas)
  app/public/index.html  the web app's page: the same instrument plus a live panel that calls /api/graph

Inlines common/brand.css, app/lib/ising.js, common/inksprite.js, the shared prev / hub / next nav (common/nav.py),
the pixel-art cast (web/sprites.json, drawn by make_sprites.py) and the job data, then makes both pages pure ASCII. Also copies problems.json into app/lib/ for
the server, and lists the hub mascot (web/img/mascot.png) in web/files.json. Reads only cached results: no network.
"""
import json
import math
import re
import shutil
import sys
from pathlib import Path

import networkx as nx
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB = HERE / "web"
APP = HERE / "app"
sys.path.insert(0, str(ROOT / "common"))
sys.path.insert(0, str(HERE))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402
import problems as P  # noqa: E402

LABEL = {"ring": "Ring", "ladder": "Ladder", "random": "Spin glass"}


def layout(name, edges):
    if name == "ring":
        return [[0.5 + 0.4 * math.sin(2 * math.pi * i / P.N), 0.5 - 0.4 * math.cos(2 * math.pi * i / P.N)] for i in range(P.N)]
    if name == "ladder":
        return [[0.07 + 0.86 * (i % 10) / 9, 0.32 if i < 10 else 0.68] for i in range(P.N)]
    G = nx.Graph()
    G.add_nodes_from(range(P.N))
    G.add_edges_from(edges)
    pos = nx.kamada_kawai_layout(G)
    xy = np.array([pos[i] for i in range(P.N)])
    xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))
    return [[round(0.08 + 0.84 * x, 4), round(0.08 + 0.84 * y, 4)] for x, y in xy]


def job_view(j):
    if not j:
        return None
    return {"job_id": j["job_id"], "backend": j["backend"], "ibm_job_id": j.get("ibm_job_id"), "shots": j["shots"],
            "bitstrings": j["bitstrings"], "tomo_edge_zz": [round(v, 4) for v in j["tomo_edge_zz"]],
            "seconds": j.get("seconds")}


def main():
    defs = P.graph_defs()
    jobs = json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))
    pbits = json.loads((HERE / "out" / "pbits.json").read_text(encoding="utf-8"))
    graphs = {k: {"label": LABEL[k], "edges": [list(e) for e in v["edges"]], "signs": v["signs"],
                  "layout": layout(k, v["edges"])} for k, v in defs.items()}
    configs = []
    for name in ["ring", "ladder", "random"]:
        for J in P.JS:
            st = P.exact_stats(defs[name]["edges"], P.couplings(name, J, defs))
            pb = next(p for p in pbits if p["graph"] == name and p["J"] == J)
            find = lambda mode: next((j for j in jobs if j["graph"] == name and j["J"] == J and j["mode"] == mode), None)  # noqa: E731
            configs.append({
                "graph": name, "J": J,
                "exact": {"edge_zz": [round(v, 4) for v in st["edge_zz"]], "mag_hist": [round(float(v), 5) for v in st["mag_hist"]]},
                "pbit": {k: pb[k] for k in ("colours", "chains", "warmup", "samples_per_chain", "steps_per_sample", "seed",
                                            "max_abs_edge_err_vs_exact", "states")},
                "emu": job_view(find("emu")), "qpu": job_view(find("qpu"))})
    done = [j for j in jobs]
    fp = HERE / "out" / "failed.json"
    failed = [{k: f[k] for k in ("graph", "J", "mode", "job_id", "error")} for f in json.loads(fp.read_text(encoding="utf-8"))] if fp.exists() else []
    data = {"graphs": graphs, "Js": P.JS, "configs": configs, "jobs": len(done), "failed": failed,
            "qpu_jobs": sum(j["mode"] == "qpu" for j in done), "backends": sorted({j["backend"] for j in done})}
    blob = json.dumps(data, separators=(",", ":"))
    brand = (ROOT / "common" / "brand.css").read_text(encoding="utf-8")
    ising = (APP / "lib" / "ising.js").read_text(encoding="utf-8")
    # its header comment mentions a literal <script> tag, which trips split('<script>') checks: reword it in the copy
    inksprite = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "script element")
    sprites = json.dumps(json.loads((WEB / "sprites.json").read_text(encoding="utf-8")), separators=(",", ":"))
    tpl = (WEB / "template.html").read_text(encoding="utf-8")
    for live, dest in ((False, WEB / "index.html"), (True, APP / "public" / "index.html")):
        html = tpl.replace("/*BRAND*/", brand).replace("/*ISING*/", ising).replace("/*INKSPRITE*/", inksprite)
        html = html.replace("/*SPRITES*/{}", sprites).replace("/*DATA*/{}", blob)
        html = html.replace("/*LIVE*/false", "true" if live else "false")
        html = html.replace("<!--NAV-->", nav_html("08-pbit-or-qubit"))   # shared prev / hub / next links, before to_ascii
        if not live:  # the artifact can't call any API: drop the live panel and its fetch code entirely
            html = re.sub(r"<!--LIVE-START-->.*?<!--LIVE-END-->", "", html, flags=re.S)
            html = re.sub(r"/\*LIVE-START\*/.*?/\*LIVE-END\*/", "", html, flags=re.S)
        else:
            html = html.replace("<!--LIVE-START-->", "").replace("<!--LIVE-END-->", "").replace("/*LIVE-START*/", "").replace("/*LIVE-END*/", "")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(to_ascii(html), encoding="ascii")
    shutil.copyfile(HERE / "problems.json", APP / "lib" / "problems.json")
    # the page itself is self-contained; the only extra published file is the hub mascot
    files = {"img/mascot.png": "entries/08-pbit-or-qubit/web/img/mascot.png"}
    for k, v in files.items():
        assert (ROOT / v).exists(), f"missing {v}: run common/mascot.py first"
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    print(f"web/index.html and app/public/index.html written: {len(configs)} problems, {len(done)} graph-v1 jobs "
          f"({data['qpu_jobs']} on hardware), {(WEB / 'index.html').stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
