"""loom weave input.png --p 5e-3  ->  out/draft.wif, out/render.png, out/report.md"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__, calibration, image, render, report, weave, wif


def weave_cmd(a) -> int:
    cal = calibration.load(a.calibration)
    try:
        lv = calibration.level(cal, a.p, a.profile)
    except (ValueError, KeyError) as e:
        print(f"loom: {e}", file=sys.stderr)
        return 2
    bits = image.binarise(a.input, width=a.width, threshold=a.threshold, invert=a.invert)
    w = weave.sample(bits, calibration.rates(lv), seed=a.seed, codewords=a.codewords)
    cells, weft = weave.drawdown(w, a.view)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    c = w.counts()
    notes = [f"Syndrome Loom {__version__}: {Path(a.input).name} at p={lv['p']:g} ({a.profile} profile), seed {a.seed}, view {a.view}, codewords {a.codewords}.",
             "Each pixel is a Steane block of 7 warp ends; each image row is 6 code picks + 1 red syndrome pick.",
             f"Rates measured by Atlas {cal['engine']} job {lv['se']['job_id']} ({cal['simulator']}).",
             f"This cloth: {c['flagged']} syndrome stitches, {c['failed']} logical flips in {c['blocks']} blocks.",
             "Pick 1 is the top of the image; end 1 is its left edge. Rising shed; one shaft per end."]
    title = f"Syndrome Loom: {Path(a.input).stem}, p={lv['p']:g}"
    (out / "draft.wif").write_bytes(wif.to_wif(cells, weft, title=title, notes=notes).encode("ascii"))
    render.render(cells, weft, cell=a.cell).save(out / "render.png", optimize=True)
    info = {"input": str(a.input), "view": a.view, "invert": a.invert}
    (out / "report.md").write_text(report.make(w, cal, lv, a.profile, info), encoding="utf-8")
    if a.json:
        (out / "weave.json").write_text(json.dumps({"bits": w.bits, "seed": a.seed, "p": lv["p"], "profile": a.profile,
                                                    "counts": c}), encoding="utf-8")
    print(f"wove {w.cols}x{w.rows} px -> {w.cols * 7} ends x {len(cells)} picks; "
          f"{c['flagged']} red stitches, {c['failed']} logical flips -> {out}/draft.wif, render.png, report.md")
    return 0


def rates_cmd(a) -> int:
    cal = calibration.load(a.calibration)
    for prof in cal["profiles"]:
        print("\n".join(report.rate_table(cal, prof)))
        print()
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="loom", description="Weave an image through measured Steane-code noise.")
    ap.add_argument("--version", action="version", version=f"syndrome-loom {__version__}")
    sub = ap.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("weave", help="weave an image into a WIF draft, a rendered preview and a report")
    w.add_argument("input", help="image file (png, jpg, ...)")
    w.add_argument("--p", type=float, default=5e-3, help="physical noise p; must be a calibrated level (default 5e-3)")
    w.add_argument("--profile", choices=calibration.PROFILES, default="loom",
                   help="loom = noise on every gate, idle and readout; thread = idle + readout only")
    w.add_argument("--width", type=int, default=32, help="pixels across = Steane blocks per row (default 32)")
    w.add_argument("--seed", type=int, default=1)
    w.add_argument("--view", choices=("received", "corrected"), default="received",
                   help="threads as read out (flips visible) or after Hamming correction")
    w.add_argument("--codewords", choices=("plain", "measured"), default="plain",
                   help="plain = 0000000/1111111; measured = a random coset codeword, as a Z readout returns")
    w.add_argument("--threshold", type=float, default=None, help="grey threshold 0-255 (default Otsu)")
    w.add_argument("--invert", action="store_true", help="swap light and dark pixels")
    w.add_argument("--cell", type=int, default=8, help="pixels per cell in render.png (default 8)")
    w.add_argument("--out", default="out")
    w.add_argument("--json", action="store_true", help="also write weave.json (bits and counts)")
    w.add_argument("--calibration", default=None, help="alternative calibration.json")
    w.set_defaults(fn=weave_cmd)
    r = sub.add_parser("rates", help="print the engine-measured rates table")
    r.add_argument("--calibration", default=None)
    r.set_defaults(fn=rates_cmd)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    raise SystemExit(main())
