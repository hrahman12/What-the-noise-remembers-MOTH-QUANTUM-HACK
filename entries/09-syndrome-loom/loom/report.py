"""report.md: logical vs physical flip rates per p (from the engine) and what this particular weave drew."""
from __future__ import annotations

from . import calibration


def per_thread(events: float) -> float:
    """Per-thread bit-flip rate that would give the bit-flip half of the engine's syndrome events per block
    if each of the 7 threads flipped independently. Inferred, not measured."""
    s = min(events / 2.0, 0.999999)
    return 1.0 - (1.0 - s) ** (1.0 / 7.0)


def _pct(x: float) -> str:
    return f"{100 * x:.3f} %" if x < 0.01 else f"{100 * x:.2f} %"


def rate_table(cal: dict, profile: str) -> list:
    pr = cal["profiles"][profile]
    L = [f"**Profile `{profile}`: {pr['title']}.** Noise mapping: `{pr['noise']}`.", "",
         "| physical p (per operation) | n_logical | data qubits (7 x n) | shots | block samples "
         "| logical flip rate, 1 SE round | logical flip rate, no SE round | syndrome events per block (X+Z) "
         "| per-thread flip rate (inferred) | logical vs physical | SE job | no-SE job |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for lv in calibration.levels(cal, profile):
        se, bare = lv["se"], lv["bare"]
        verdict = "logical < p: the code helps" if se["logical_error_rate"] < lv["p"] else \
            "logical > p: the code hurts here"
        L.append(f"| {lv['p']:g} | {lv['n_logical']} | {7 * lv['n_logical']} | {lv['shots']} | "
                 f"{lv['n_logical'] * lv['shots']:,} | {_pct(se['logical_error_rate'])} | "
                 f"{_pct(bare['logical_error_rate'])} | {se['syndrome_rate']:.4f} | "
                 f"{_pct(per_thread(se['syndrome_rate']))} | {verdict} | `{se['job_id']}` | `{bare['job_id']}` |")
    return L


def make(w, cal: dict, lv: dict, profile: str, info: dict) -> str:
    c = w.counts()
    r = w.rates
    exp_fail = sum(r["L1"] if b else r["L0"] for row in w.bits for b in row)
    L = ["# Syndrome Loom report", "",
         f"- Input: `{info['input']}` binarised to {w.cols} x {w.rows} pixels (Otsu threshold"
         f"{', inverted' if info.get('invert') else ''})",
         f"- Cloth: {w.cols * 7} warp ends x {w.rows * 7} picks ({w.rows} bands of 6 code picks + 1 red syndrome pick)",
         f"- Noise: p = {lv['p']:g}, profile `{profile}` ({cal['profiles'][profile]['title']})",
         f"- View: `{info['view']}`, codewords: `{w.codewords}`, seed: {w.seed}",
         f"- Engine: `{cal['engine']}` (code `{cal['code']}`), {cal['simulator']}",
         "",
         "## Logical vs physical flip rates per p (measured by the engine)", "",
         "Physical p is the per-operation fault probability fed to the engine's noise model. "
         "The logical flip rate is the engine's `logical_error_rate` averaged over all logical qubits "
         "(one Steane block each). Syndrome events per block = `syndromes_detected / (shots x n_logical)`. "
         "The engine counts a nonzero bit-flip syndrome and a nonzero phase-flip syndrome as separate events "
         "(up to 2 per block), so the loom draws bit-flip syndromes at half that rate, assuming the two types "
         "are equally likely. The per-thread rate is inferred, not measured: `1 - (1 - events/2)^(1/7)`.", ""]
    for prof in cal["profiles"]:
        L += rate_table(cal, prof) + [""]
    L += ["## This weave", "",
          "Each pixel's events are sampled with mulberry32 from the three measured numbers for this p "
          "(classical sampling; the engine reports aggregate counts, not per-shot records, so the two "
          "events are drawn independently).", "",
          "| quantity | engine rate used | expected in this cloth | drawn in this cloth |",
          "|---|---|---|---|",
          f"| bit-flip syndromes (red stitches) | s = {r['s']:.4f} per block (half the engine's X+Z count) | {r['s'] * c['blocks']:.1f} | {c['flagged']} of {c['blocks']} blocks |",
          f"| logical flips (pixels inverted after correction) | L0 = {_pct(r['L0'])}, L1 = {_pct(r['L1'])} | {exp_fail:.1f} | {c['failed']} of {c['blocks']} pixels |",
          f"| threads read flipped before correction | from s | {r['s'] * c['blocks']:.1f} | {c['threads_flipped_as_read']} of {c['threads']} threads ({_pct(c['threads_flipped_as_read'] / max(1, c['threads']))}) |",
          "",
          "## What ran where", "",
          "| step | where | kind |", "|---|---|---|",
          f"| Steane encoding, transversal gates, one syndrome-extraction round with in-circuit correction, readout, under noise p | Atlas `{cal['engine']}`, Aer stabilizer simulator | quantum circuit, simulated |",
          "| Binarise the image, pick codewords, sample flips and syndromes from the measured rates, Hamming decode, WIF, render | this package (`loom`) | classical |",
          "",
          "No quantum hardware was used. The loom does not run a circuit per pixel: it reuses the engine's "
          "measured rates. See README.md for the full honesty notes.", ""]
    return "\n".join(L)
