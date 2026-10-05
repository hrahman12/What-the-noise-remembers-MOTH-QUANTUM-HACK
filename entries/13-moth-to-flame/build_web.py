"""Assemble web/index.html from the cached labyrinth-v1 outputs. CLASSICAL post-processing only.

For every completed job in out/jobs.csv (-> out/<id>.json, raw engine output): the three levels (role "level",
all IBM ibm_fez) and the two labelled comparison runs of the same towns (role "comparison": L1 on the Aer
emulator, L2 on ibm_miami), which the page shows only in Figure 4, the level notes and the jobs table:
  * per-street <ZZ> is computed HERE from the engine's measured shots (top_n=-1 keeps every
    distinct bitstring, so the counts are complete). The engine's own `zz_couplings` field is
    its classical tomography estimate (it reproduces `sz_tomo`, not `sz_samp`), so it is NOT used
    for the layout; it is kept only as a comparison number.
  * hedge where measured <ZZ> < 0, open street where >= 0 (the engine's convention:
    ZZ=+1 corridor, ZZ=-1 wall).
  * start / home: room 0 and the last room if the measured layout joins them; otherwise the
    largest connected region, from its most top-left square to the square furthest from it.
  * lamp patterns: the 40 most frequent measured bitstrings (bit '1' = lamp lit).
Comparison runs get the same treatment plus `of` (the level they repeat) and `diff` (edges where the two
runs disagree on hedge vs street). Also inlines common/inksprite.js and web/sprites.json (the pixel-art cast: moth, lamps, hedges, cottage,
backend chips), fills the page's "Jobs and credits" table and list (spend read from cache/ledger.jsonl), and writes
out/levels.png (static map of every level; the page draws the same figure live as Figure 3), out/compare.png
(each comparison run beside its ibm_fez level; the page draws it live as Figure 4) and web/files.json.
"""
from __future__ import annotations

import collections
import csv
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared piece-to-piece navigation)
sys.path.insert(0, str(HERE))
from run_levels import CAP, COMPARE  # noqa: E402

SPEED = 1.15          # must match Sim.DEFAULTS.speed
N_SHOTS = 40
RAN_ON = {"emu": "Aer emulator (noiseless simulator, run by Atlas)", "qpu": "IBM Quantum hardware"}
CHIP_NAME = {"ibm_fez": "Heron", "ibm_miami": "Nighthawk", "ibm_marrakesh": "Heron"}


def where(lv):
    """Short backend label used on every card, chip and caption: "IBM ibm_fez" or "Aer emulator"."""
    return f"IBM {lv['backend']}" if lv["mode"] == "qpu" else "Aer emulator"


def bfs(n, adj, s):
    dist = {s: 0}
    q = collections.deque([s])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in dist:
                dist[v] = dist[u] + 1
                q.append(v)
    return dist


def level_from(lid, row):
    d = json.loads((HERE / "out" / f"{lid}.json").read_text(encoding="utf-8"))
    o = d["result"]["output"]
    m = o["metrics"]
    rows, cols = o["grid_size"]["rows"], o["grid_size"]["cols"]
    n = o["num_qubits"]
    assert n == rows * cols
    meas = o["results"]["measurements"]
    shots = int(m.get("num_shots") or m["shots"])
    probs = np.array([x["probability"] for x in meas], dtype=float)
    assert abs(probs.sum() - 1) < 1e-6, f"{lid}: measurements are not complete (top_n?)"
    spins = np.array([[1 - 2 * int(ch) for ch in x["bitstring"]] for x in meas], dtype=np.int8)
    tomo = {tuple(e["qubits"]): e["value"] for e in o["results"]["zz_couplings"]}
    edges, match = [], 0
    for e in o["target"]["edge_signs"]:
        a, b = e["qubits"]
        zz = float((probs * spins[:, a] * spins[:, b]).sum())
        edges.append([a, b, e["sign"], round(zz, 4)])
        match += (zz >= 0) == (e["sign"] > 0)
    sz_meas = float(np.mean([s * z for _, _, s, z in edges]))
    adj = collections.defaultdict(list)
    for a, b, _, zz in edges:
        if zz >= 0:
            adj[a].append(b)
            adj[b].append(a)
    d0 = bfs(n, adj, 0)
    if n - 1 in d0:
        start, home, rule = 0, n - 1, "corner to corner"
    else:
        seen, comps = set(), []
        for i in range(n):
            if i not in seen:
                c = set(bfs(n, adj, i))
                seen |= c
                comps.append(c)
        big = max(comps, key=len)
        start = min(big, key=lambda i: (i // cols + i % cols, i))
        dd = bfs(n, adj, start)
        home = max(dd, key=lambda i: (dd[i], i))
        rule = f"largest connected region ({len(big)} of {n} squares)"
    path = bfs(n, adj, start)[home]
    order = np.argsort(-probs, kind="stable")[:N_SHOTS]
    shot_list = [[meas[i]["bitstring"], int(round(probs[i] * shots))] for i in order]
    backend = m.get("backend") or row.get("backend")
    lv = {
        "id": lid, "role": row.get("role") or "level", "name": row["name"], "mode": m["mode"], "backend": backend,
        "ranOn": RAN_ON[m["mode"]] + (f" ({backend})" if m["mode"] == "qpu" else ""),
        "job": d["job_id"], "ibmJob": m.get("ibm_job_id"), "qubits": n, "rows": rows, "cols": cols,
        "shots": shots, "distinct": len(meas), "steps": m["steps"], "fraction": round(m["fraction"], 4), "k": m["k"],
        "szSamp": round(m["sz_samp"], 4), "szTomo": round(m["sz_tomo"], 4), "szMeas": round(sz_meas, 4),
        "depth": m.get("depth"), "depth2q": m.get("depth_2q"), "qpuSeconds": m.get("qpu_seconds"),
        "edges": edges, "match": int(match), "nEdges": len(edges),
        "planStreets": sum(1 for e in edges if e[2] > 0),
        "start": start, "home": home, "startRule": rule, "path": path,
        "drain": round(100 / (40 + 3.5 * path / SPEED), 3),
        "shotList": shot_list,
        "tomoMatch": int(sum((tomo[(a, b)] >= 0) == (s > 0) for a, b, s, _ in edges)),
    }
    return lv


def draw_maps(levels, fname="levels.png", grid=None):
    """Static schematic of each town. `grid` = rows of panels (default: one row with every level).
    A comparison run is not a level, so it gets no START / HOME squares: every square shows its lamp."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    # brief-page palette (common/brand.css): paper ground, one ultramarine ink, warn accent for changed edges
    paper, panel, ink, ink2, ink3, tint, warn = "#FBFAF9", "#FFFFFF", "#19238E", "#545BA9", "#A1A4CE", "#E8E9F3", "#B4541A"
    grid = grid or [levels]
    nr, nc = len(grid), max(len(r) for r in grid)
    # each row as tall as its tallest town (plus room for the two-line titles), so short towns leave no gap
    hs = [max(6.0 * (lv["rows"] + .4) / (lv["cols"] + .4) for lv in r) + .8 for r in grid]
    fig, axs = plt.subplots(nr, nc, figsize=(6.6 * nc, 6.8 if nr == 1 else sum(hs)), facecolor=paper, squeeze=False,
                            gridspec_kw={"height_ratios": hs})
    for ax, lv in zip(axs.flat, [lv for r in grid for lv in r]):
        R, C = lv["rows"], lv["cols"]
        cmp_run = lv["role"] == "comparison"
        ends = () if cmp_run else (lv["start"], lv["home"])
        ax.set_facecolor(panel)
        ax.set_xlim(-0.2, C + 0.2)
        ax.set_ylim(R + 0.2, -0.2)
        ax.set_aspect("equal")
        ax.axis("off")
        bits = lv["shotList"][0][0]
        for i in range(R * C):
            r, c = divmod(i, C)
            if i in ends:
                continue
            if bits[i] == "1":
                ax.add_patch(plt.Circle((c + .5, r + .5), .42, color=tint, lw=0))
                ax.plot(c + .5, r + .5, "o", ms=5, color=ink)
            else:
                ax.plot(c + .5, r + .5, "o", ms=3, mfc=panel, mec=ink3, mew=1)
        for a, b, s, zz in lv["edges"]:
            ra, ca = divmod(a, C)
            rb, cb = divmod(b, C)
            if ra == rb:
                xs, ys = [max(ca, cb)] * 2, [ra, ra + 1]
            else:
                xs, ys = [ca, ca + 1], [max(ra, rb)] * 2
            flipped = (zz >= 0) != (s > 0)
            if zz < 0:
                ax.plot(xs, ys, color=warn if flipped else ink, lw=1.5 + 6 * min(1, abs(zz)),
                        solid_capstyle="round", alpha=1)
            elif flipped:
                ax.plot(xs, ys, color=warn, lw=1.2, ls=(0, (2, 2)))
        ax.plot([0, C, C, 0, 0], [0, 0, R, R, 0], color=ink, lw=5)
        for idx, lab in zip(ends, ("start", "home")):
            r, c = divmod(idx, C)
            ax.text(c + .5, r + .5, lab.upper(), color=ink, ha="center", va="center", fontsize=9, family="monospace")
        tag = f"{lv['name']}, comparison run (not a level)" if cmp_run else f"{lv['id']} {lv['name']}"
        ax.set_title(f"{tag}: {lv['qubits']} qubits, {where(lv)}\n"
                     f"job {lv['job'][:8]}  hedges vs plan {lv['match']}/{lv['nEdges']}"
                     + (f"  differs from {lv['of']} on {lv['diff']} edges" if cmp_run else ""),
                     color=ink, fontsize=10, family="monospace")
    fig.text(0.5, 0.0, "Schematic. Hedges: measured <ZZ> < 0 from each job's shots (thickness = |<ZZ>|). "
             "Lamps: shot 1 of the page's list (most frequent; the first measured when every shot differs), bit 1 = lit.\n"
             "Orange: edges where the measured state differs from the street plan (solid = planned street closed, dashed = planned hedge opened).",
             color=ink2, ha="center", fontsize=9, family="monospace")
    fig.savefig(HERE / "out" / fname, dpi=110, facecolor=paper, bbox_inches="tight")
    plt.close(fig)


def chips(levels, comps):
    hw = [lv for lv in levels if lv["mode"] == "qpu"]
    backs = sorted({lv["backend"] for lv in hw})
    out = []
    if len(backs) == 1 and len(hw) == len(levels):
        top = max(hw, key=lambda lv: lv["qubits"])
        out.append(f'<span class="hot"><b>{top["qubits"]}</b> qubits on IBM {top["backend"]}</span>')
        out.append(f'<span><b>{len(levels)}</b> real Atlas jobs on IBM {backs[0]}, one per level</span>')
    else:   # mixed backends (not the case today): one chip per level
        for i, lv in enumerate(sorted(levels, key=lambda lv: -lv["qubits"])):
            out.append(f'<span{" class=\"hot\"" if i == 0 else ""}><b>{lv["qubits"]}</b> qubits on {where(lv)}</span>')
        out.append(f'<span><b>{len(levels)}</b> real Atlas jobs, one per level</span>')
    out.append(f'<span><b>{levels[0]["shots"]}</b> shots per job</span>')
    if comps:
        out.append(f'<span><b>{len(comps)}</b> comparison runs: ' + ", ".join(where(c) for c in comps) + '</span>')
    out.append('<span>flight model: <b>classical</b></span>')
    return "\n        ".join(out)


def pct(lv):
    return f"{100 * lv['match'] / lv['nEdges']:.0f}%"


def level_notes(levels, comps):
    parts = []
    for lv in levels:
        at = (f"on IBM <b>{lv['backend']}</b> hardware (IBM job {lv['ibmJob']}), real noise and all"
              if lv["mode"] == "qpu" else "on Atlas's noiseless Aer emulator, whose ceiling is 20 qubits")
        parts.append(f"<b>{lv['name']}</b> is {lv['rows']} × {lv['cols']} = {lv['qubits']} qubits, run {at}. "
                     f"Its measured hedges match the plan on {lv['match']} of {lv['nEdges']} edges ({pct(lv)}).")
    if comps:
        cs = []
        for c in comps:
            at = ("Atlas's noiseless Aer emulator (its ceiling is 20 qubits)" if c["mode"] == "emu"
                  else f"IBM <b>{c['backend']}</b> (IBM job {c['ibmJob']})")
            base = next(lv for lv in levels if lv["id"] == c["of"])
            cs.append(f"{c['name']} on {at} matches the plan on {c['match']} of {c['nEdges']} edges ({pct(c)}) and "
                      f"disagrees with the {where(base).replace('IBM ', '')} run on {c['diff']} of them")
        parts.append(f"Two earlier runs of the same towns are kept as comparisons, not levels (Figure 4): " + "; ".join(cs) + ".")
    emu = [c for c in comps if c["mode"] == "emu"]
    hw = [lv for lv in levels + comps if lv["mode"] == "qpu"]
    if emu and hw:
        parts.append(f"The mean of plan sign × measured ⟨ZZ⟩ is {emu[0]['szMeas']:.2f} on the emulator, and on hardware it falls to "
                     + ", ".join(f"{lv['szMeas']:.3f} ({lv['name']}, {lv['backend']})" for lv in hw)
                     + ". Noise washes out most of the correlation, yet ")
        ps = sorted(100 * lv["match"] / lv["nEdges"] for lv in hw)
        parts[-1] += (f"about {ps[0]:.0f}% of edges" if round(ps[0]) == round(ps[-1]) else f"{ps[0]:.0f}% to {ps[-1]:.0f}% of edges")
        parts[-1] += " still match the plan, where coin flips would match about half. That faint trace is what the noise remembers."
    fez = sorted((lv for lv in levels if lv["mode"] == "qpu"), key=lambda lv: lv["qubits"])
    if len(fez) > 1 and fez[0]["szMeas"] > 2 * fez[-1]["szMeas"]:
        parts.append(f"On {fez[0]['backend']} the smallest town kept the most: {fez[0]['szMeas']:.3f} at {fez[0]['qubits']} qubits, against "
                     + " and ".join(f"{lv['szMeas']:.3f} at {lv['qubits']}" for lv in fez[1:])
                     + ". The engine reports no layout or circuit depth, so we can't say which part of the circuit made the difference.")
    return " ".join(parts)


def chip_note(levels, comps):
    """The two-chip paragraph: the same 10 x 12 town on ibm_fez (heavy-hex) and on ibm_miami (square lattice)."""
    sq = [c for c in comps if c["mode"] == "qpu" and "miami" in c["backend"]]
    head = ("A town grid needs four neighbours per square. Heron chips such as ibm_fez give each qubit at most three (IBM's heavy-hex "
            "layout), so a grid with every neighbour coupled cannot sit on that chip without routing (extra swap gates). Nighthawk "
            "(ibm_miami) has 120 qubits on a square lattice with 218 couplers, the same shape as the 10 × 12 town, so the grid could map "
            "onto it one-to-one. The engine does not report the layout or circuit depth it used, so we can't confirm that.")
    if not sq:
        return head
    c = sq[0]
    base = next(lv for lv in levels if lv["id"] == c["of"])
    qs = {"ibm_fez": base.get("qpuSeconds"), "ibm_miami": c.get("qpuSeconds")}
    p1, p2 = base["match"] / base["nEdges"], c["match"] / c["nEdges"]
    expect = c["nEdges"] * (1 - (p1 * p2 + (1 - p1) * (1 - p2)))   # two independent samplings with these match rates
    tail = (f" {base['name']} ran on both chips: the same {base['rows']} × {base['cols']} town on {base['backend']} (the level) and on "
            f"{c['backend']} (a comparison run, Figure 4). "
            f"On {base['backend']} its measured hedges match the plan on {base['match']} of {base['nEdges']} edges ({pct(base)}, "
            f"mean {base['szMeas']:.3f}); on {c['backend']}, {c['match']} of {c['nEdges']} ({pct(c)}, mean {c['szMeas']:.3f}). "
            f"The two runs disagree on {c['diff']} of {c['nEdges']} edges, about what two independent samplings with those match "
            f"rates would give (about {expect:.0f}).")
    if all(qs.values()):
        tail += f" Reported QPU time: {qs['ibm_fez']} s on ibm_fez and {qs['ibm_miami']} s on ibm_miami."
    tail += " One run per chip is not a benchmark of either chip."
    return head + tail


def job_rows(levels, comps):
    """Rows of the "Jobs and credits" table: one per level, then the labelled comparison runs, straight from the job records."""
    out = []

    def cells(lv, first, ran):
        ibm = f"<code>{lv['ibmJob']}</code>" if lv["ibmJob"] else "none (emulator)"
        return (f'<tr><td>{first}</td>'
                f'<td>{lv["rows"]} × {lv["cols"]}</td><td>{lv["qubits"]}</td><td>{ran}</td>'
                f'<td><code>{lv["job"]}</code></td><td>{ibm}</td>'
                f'<td>{lv["shots"]} ({lv["distinct"]} distinct)</td>'
                f'<td>{lv["match"]} of {lv["nEdges"]} ({pct(lv)})</td>'
                f'<td>{lv["szMeas"]:.4f} (engine sz_samp {lv["szSamp"]:.4f})</td>'
                f'<td>{lv["szTomo"]:.4f} (its signs match the plan on {lv["tomoMatch"]} of {lv["nEdges"]})</td></tr>')
    for i, lv in enumerate(levels):
        out.append(cells(lv, f'<button type="button" class="btn ghost sm" data-fly="{i}" aria-label="Fly {lv["id"]} {lv["name"]} in the game above">'
                              f'{lv["id"]} {lv["name"]}</button>', lv["ranOn"]))
    for c in comps:
        out.append(cells(c, f'<span class="label">Comparison</span><br>{c["name"]} (same town as {c["of"]}; not a level)',
                         c["ranOn"] + f". Shown in Figure 4 only; disagrees with the ibm_fez run on {c['diff']} of {c['nEdges']} edges"))
    return "\n          ".join(out)


def credits_html(levels, comps):
    """The credits list. Spend is read from the local ledger (cache/ledger.jsonl): no network."""
    led = ROOT / "cache" / "ledger.jsonl"
    mine = [json.loads(x) for x in led.read_text(encoding="utf-8").splitlines() if x.strip()] if led.exists() else []
    mine = [e for e in mine if e.get("piece") == "13-moth-to-flame"]
    spent = sum(float(e.get("credits") or 0) for e in mine)
    each = sorted({float(e.get("credits") or 0) for e in mine})
    per = f"{len(mine)} jobs × {each[0]:g} credits" if len(each) == 1 else f"{len(mine)} jobs"
    lv = levels[0]
    backs = sorted({x["backend"] for x in levels if x["mode"] == "qpu"})
    items = [
        f"<b>Engine:</b> Moth Atlas <code>labyrinth-v1</code> (Quantum Labyrinth Engine), the only engine used: one qubit per town square. "
        f"Parameters <code>shots={lv['shots']}, steps={lv['steps']}, fraction=1/3, k={lv['k']}</code> (engine defaults) and "
        f"<code>top_n=-1</code>, which keeps every distinct measured bitstring so ⟨ZZ⟩ can be computed from the complete counts.",
        f"<b>Credits:</b> {spent:g} of the {CAP:g}-credit cap ({per}: the {len(levels)} levels on IBM {', '.join(backs)} and the "
        f"{len(comps)} earlier comparison runs), from the local job ledger.",
        "<b>Science:</b> Fabian, S. T., Sondhi, Y., Allen, P. E., Theobald, J. C. &amp; Lin, H.-T. (2024). "
        "<i>Why flying insects gather at artificial light.</i> Nature Communications 15, 689. doi:10.1038/s41467-024-44785-3. "
        "The steering rule is a simplified 2D cartoon inspired by this finding; it uses none of the paper's data.",
        "<b>Hardware facts:</b> IBM Quantum Nighthawk (ibm_miami) has 120 qubits joined by 218 tunable couplers to their four nearest "
        "neighbours in a square lattice (IBM newsroom, 12 Nov 2025). IBM Heron (ibm_fez) uses IBM's heavy-hex layout, where no qubit has "
        "more than three neighbours.",
        "<b>Data:</b> no external datasets. Street plans come from <code>town.py</code> (a seeded random maze plus loops, classical); "
        "hedges and lit lamps come from the measured shots of the jobs above.",
        "<b>Made with:</b> Canvas 2D and the Web Audio API only, and every sound is synthesised in the page. The pixel art "
        "(<code>web/sprites.json</code>) was drawn for this piece in the shared ink palette. Fonts: Geist and IBM Plex Mono "
        "(SIL Open Font License).",
    ]
    return "\n        ".join(f"<li>{t}</li>" for t in items)


def load_all():
    """(levels, comparison runs) from out/jobs.csv. Levels in L1..L3 order; comparison runs in run_levels.COMPARE order."""
    rows = [r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    lv_rows = [r for r in rows if (r.get("role") or "level") == "level"]
    levels = [level_from(r["level"], r) for r in sorted(lv_rows, key=lambda r: r["level"])]
    comps = []
    for cid in COMPARE:
        r = next((r for r in rows if r["level"] == cid and r.get("role") == "comparison"), None)
        if r is None:
            continue
        c = level_from(cid, r)
        base = next(lv for lv in levels if lv["id"] == COMPARE[cid]["of"])
        assert [e[:3] for e in c["edges"]] == [e[:3] for e in base["edges"]], f"{cid}: not the same town as {base['id']}"
        c["of"] = base["id"]
        c["diff"] = int(sum((a[3] >= 0) != (b[3] >= 0) for a, b in zip(c["edges"], base["edges"])))
        # not a level: no start / home, no flight; the page shows shot 1 only (Figure 4)
        c.update(start=None, home=None, startRule="comparison run (not a level)", path=None, drain=None, shotList=c["shotList"][:1])
        comps.append(c)
    return levels, comps


def main():
    levels, comps = load_all()
    (WEB / "levels.json").write_text(json.dumps(levels, indent=1), encoding="utf-8")
    (WEB / "compare.json").write_text(json.dumps(comps, indent=1), encoding="utf-8")
    draw_maps(levels)
    if comps:
        draw_maps(None, "compare.png", [[next(lv for lv in levels if lv["id"] == c["of"]), c] for c in comps])
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", (ROOT / "common" / "brand.css").read_text(encoding="utf-8"))
    html = html.replace("/*SIM*/", (WEB / "sim.js").read_text(encoding="utf-8"))
    # pixel-art cast: the shared helper + this piece's sprites (web/sprites.json is the one place the pixels live)
    # (its header comment mentions a literal "<script>" tag: harmless to a browser, but it breaks the
    #  BUILD_GUIDE's split-on-<script> parse check, so it is spelled "&lt;script&gt;" in the inlined copy)
    ink = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "&lt;script&gt;")
    html = html.replace("/*INKSPRITE*/", ink)
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*LEVELS*/[]", json.dumps(levels, separators=(",", ":")))
    html = html.replace("/*COMPARE*/[]", json.dumps(comps, separators=(",", ":")))
    html = html.replace("%%CHIPS%%", chips(levels, comps)).replace("%%LEVELNOTES%%", level_notes(levels, comps))
    html = html.replace("%%CHIPNOTE%%", chip_note(levels, comps))
    html = html.replace("%%JOBROWS%%", job_rows(levels, comps)).replace("%%CREDITS%%", credits_html(levels, comps))
    assert "%%" not in html.split("<script>")[0], "a %%PLACEHOLDER%% was left unfilled"
    assert "/*COMPARE*/" not in html, "template.html lost its /*COMPARE*/[] placeholder"
    assert "<!--NAV-->" in html, "template.html lost its <!--NAV--> marker"
    html = html.replace("<!--NAV-->", nav_html("13-moth-to-flame"))   # prev / hub / next + jump list
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    files = {}
    if (WEB / "img" / "mascot.png").exists():   # hub mascot, from common/mascot.py (see README)
        files["img/mascot.png"] = "entries/13-moth-to-flame/web/img/mascot.png"
    (WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8")
    for lv in levels:
        print(f"{lv['id']} {lv['name']}: {lv['qubits']}q {lv['mode']} {lv['backend']} job {lv['job']} "
              f"hedges vs plan {lv['match']}/{lv['nEdges']} (tomography {lv['tomoMatch']}) sz meas {lv['szMeas']} "
              f"start {lv['start']} home {lv['home']} ({lv['startRule']}, {lv['path']} steps), {lv['distinct']} distinct shots")
    for c in comps:
        print(f"  comparison {c['id']} ({c['name']}, of {c['of']}): {c['qubits']}q {c['mode']} {c['backend']} job {c['job']} "
              f"hedges vs plan {c['match']}/{c['nEdges']} sz meas {c['szMeas']}, differs from {c['of']} on {c['diff']} edges")
    print(f"web/index.html written ({len(levels)} levels + {len(comps)} comparison runs, {len(html)//1024} KB)")


if __name__ == "__main__":
    main()
