"""Replay ALPHA-g's whole release campaign with the real dice banks. CLASSICAL replay of QUANTUM dice.

For each of the 11 nominal biases (ascending, -3 g to +3 g) this draws as many atoms as Table 1 counted
there (rounded), each atom reading the next 16-bit word of a comet-qrng-v1 bank:
    down  if  word < round(P_dn * 65536),  P_dn = max(0, N_dn) / (max(0, N_up) + max(0, N_dn))
That is exactly what the web page does when you press "Run the whole campaign" on a fresh page, so
test_core.js checks that its JavaScript gives the same tallies.

No new Atlas jobs: this reads data/bank_*.hex written by run_qrng.py.
Outputs: out/replay.json (tallies, logistic fits) and out/escape_curve.png (the static deliverable figure).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
TABLE = json.loads((HERE / "data" / "alphag_table1.json").read_text(encoding="utf-8"))
ROWS = [dict(zip(TABLE["columns"], r)) for r in TABLE["rows"]]
MAIN = sorted([r for r in ROWS if abs(r["bias_g"]) <= 3], key=lambda r: r["bias_g"])
JOBS = {r["name"]: r for r in json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))}


def p_down(n_up, n_dn):
    u, d = max(0.0, n_up), max(0.0, n_dn)
    return d / (u + d) if u + d > 0 else 0.5


def threshold(p):
    # JS Math.round rounds .5 up; p * 65536 never lands on .5 exactly for these rows, checked below
    return max(0, min(65536, math.floor(p * 65536 + 0.5)))


def series_size(r):
    return int(math.floor(max(0.0, r["n_up"]) + max(0.0, r["n_dn"]) + 0.5))


def logistic(b, b0, w):
    return 1 / (1 + math.exp(-(b - b0) / w))


def fit_logistic(points):
    """Same grid search and profile-likelihood interval as web/core.js fitLogistic."""
    pts = [q for q in points if q["dn"] + q["up"] > 0]
    tot = sum(q["dn"] + q["up"] for q in pts)
    dn = sum(q["dn"] for q in pts)
    if len({q["b"] for q in pts}) < 2 or tot < 10 or dn <= 0 or dn >= tot:
        return None
    B0 = [round(-4 + 0.02 * i, 2) for i in range(401)]
    W = [round(0.1 + 0.025 * i, 3) for i in range(117)]

    def ll(b0, w):
        s = 0.0
        for q in pts:
            p = min(1 - 1e-12, max(1e-12, logistic(q["b"], b0, w)))
            s += max(0, q["dn"]) * math.log(p) + max(0, q["up"]) * math.log(1 - p)
        return s

    best, prof = {"ll": -math.inf}, []
    for b0 in B0:
        m, mw = -math.inf, W[0]
        for w in W:
            v = ll(b0, w)
            if v > m:
                m, mw = v, w
        prof.append((b0, m))
        if m > best["ll"]:
            best = {"ll": m, "b0": b0, "w": mw}
    inside = [b for b, m in prof if 2 * (best["ll"] - m) <= 1]
    return {"b0": best["b0"], "w": best["w"], "lo": min(inside), "hi": max(inside), "n": tot}


def wilson(k, n, z=1.0):
    p, z2 = k / n, z * z
    den = 1 + z2 / n
    c = (p + z2 / (2 * n)) / den
    h = z / den * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))
    return max(0, c - h), min(1, c + h)


def replay(name):
    hexstr = (HERE / "data" / f"bank_{name}.hex").read_text(encoding="ascii").strip()
    bank = bytes.fromhex(hexstr)
    off, tallies = 0, []
    for r in MAIN:
        p = p_down(r["n_up"], r["n_dn"])
        assert abs(p * 65536 - math.floor(p * 65536) - 0.5) > 1e-9
        t, up, dn = threshold(p), 0, 0
        for _ in range(series_size(r)):
            if off + 2 > len(bank):
                raise SystemExit(f"{name}: bank exhausted")
            w = (bank[off] << 8) | bank[off + 1]
            off += 2
            if w < t:
                dn += 1
            else:
                up += 1
        tallies.append({"b": r["bias_g"], "p_paper": p, "threshold": t, "up": up, "dn": dn})
    fit = fit_logistic([{"b": x["b"], "up": x["up"], "dn": x["dn"]} for x in tallies])
    return {"job_id": JOBS[name]["job_id"], "backend": JOBS[name]["backend"], "words_used": off // 2,
            "tallies": tallies, "fit": fit}


def main():
    paper_fit = fit_logistic([{"b": r["bias_g"], "up": max(0, r["n_up"]), "dn": max(0, r["n_dn"])} for r in MAIN])
    res = {"paper_table1_fit": paper_fit, "fez_148p8": replay("fez_148p8"), "emu_20p0": replay("emu_20p0"),
           "note": "Classical replay: atoms' up/down drawn with Table 1 odds using comet-qrng-v1 banks as dice. "
                   "Fits are our logistic cartoon, not the paper's 3-D simulation analysis."}
    (HERE / "out" / "replay.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    for k in ("fez_148p8", "emu_20p0"):
        f = res[k]["fit"]
        print(f"{k}: {res[k]['words_used']} dice, balance b0 = {f['b0']:+.2f} g [{f['lo']:+.2f}, {f['hi']:+.2f}]")
    print(f"Table 1 raw counts: balance b0 = {paper_fit['b0']:+.2f} g [{paper_fit['lo']:+.2f}, {paper_fit['hi']:+.2f}]")
    plot(res)


def plot(res):
    # paper/ink palette of the page (common/brand.css); this chart is classical, so it wears the brand colours
    paper, panel, rule, ink, ink2, ink3 = "#FBFAF9", "#FFFFFF", "#D3D3E6", "#19238E", "#545BA9", "#A1A4CE"
    plt.rcParams["font.family"] = ["DejaVu Sans"]
    fig, ax = plt.subplots(figsize=(10, 6.2), dpi=150)
    fig.patch.set_facecolor(paper)
    ax.set_facecolor(panel)
    for s in ax.spines.values():
        s.set_color(rule)
    ax.tick_params(colors=ink2)
    ax.axhline(0.5, color=ink, ls="--", lw=1, alpha=.5)
    xs = [i / 20 for i in range(-68, 69)]
    pf, ff, ef = res["paper_table1_fit"], res["fez_148p8"]["fit"], res["emu_20p0"]["fit"]
    ax.plot(xs, [logistic(x, pf["b0"], pf["w"]) for x in xs], color=ink2, ls=":", lw=1.6, alpha=.9,
            label=f"logistic fit to Table 1 counts (balance {pf['b0']:+.2f} g)")
    ax.plot(xs, [logistic(x, ff["b0"], ff["w"]) for x in xs], color=ink, lw=2.2,
            label=f"fit to ibm_fez-dice replay (balance {ff['b0']:+.2f} g)")
    ax.scatter([r["bias_g"] for r in MAIN], [p_down(r["n_up"], r["n_dn"]) for r in MAIN], s=110, facecolors="none",
               edgecolors=ink3, linewidths=1.8, zorder=3, label="paper, Table 1 raw fraction down")
    for key, col, dx, mk, lab in (("fez_148p8", ink, 0.0, "o", f"replay, {res['fez_148p8']['backend']} dice"),
                                  ("emu_20p0", ink2, 0.12, "s", "replay, Aer emulator dice")):
        T = res[key]["tallies"]
        x = [t["b"] + dx for t in T]
        y = [t["dn"] / (t["up"] + t["dn"]) for t in T]
        lo = [y[i] - wilson(t["dn"], t["up"] + t["dn"])[0] for i, t in enumerate(T)]
        hi = [wilson(t["dn"], t["up"] + t["dn"])[1] - y[i] for i, t in enumerate(T)]
        ax.errorbar(x, y, yerr=[lo, hi], fmt=mk, color=col, ms=6, capsize=0, lw=1.6, zorder=4, label=lab,
                    mfc=col if key == "fez_148p8" else panel, mec=col, mew=1.4)
    ax.set_xlim(-3.5, 3.5)
    ax.set_ylim(-0.02, 1.02)
    ax.set_xlabel("nominal bias (g)  ·  + pushes atoms down", color=ink2)
    ax.set_ylabel("P(escape down)", color=ink2)
    ax.grid(color=rule, lw=.6)
    leg = ax.legend(loc="upper left", fontsize=8.5, facecolor=paper, edgecolor=rule, labelcolor=ink, fancybox=False)
    leg.get_frame().set_alpha(1)
    fig.suptitle("Antimatter Drop: ALPHA-g's escape odds, replayed with quantum dice", color=ink, fontsize=14,
                 x=.02, ha="left", y=.98)
    fig.text(.02, .015, "Physics: Table 1 of E. K. Anderson et al., Nature 621, 716-722 (2023), CC BY 4.0 (background-"
             "corrected counts, no efficiency correction). Paper's result: a = (0.75 ± 0.13 ± 0.16) g.\n"
             f"Dice: comet-qrng-v1 job {res['fez_148p8']['job_id']} on {res['fez_148p8']['backend']} (156 qubits) and "
             f"emu job {res['emu_20p0']['job_id']}.\n"
             "Classical replay: each atom's up/down is one 16-bit word compared with round(P_dn x 65536). "
             "Fits are a logistic cartoon, not the paper's analysis. Bars: Wilson 68%.", color=ink2, fontsize=7)
    fig.tight_layout(rect=(0, .065, 1, .95))
    fig.savefig(HERE / "out" / "escape_curve.png", facecolor=paper)
    print("out/escape_curve.png written")


if __name__ == "__main__":
    main()
