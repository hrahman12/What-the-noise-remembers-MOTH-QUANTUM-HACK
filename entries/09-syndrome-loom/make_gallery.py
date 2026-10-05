"""Weave the demo moth at every calibrated p for both noise profiles and tile the renders into
out/gallery.png. CLASSICAL (uses the engine-measured rates bundled in loom/data/calibration.json)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from loom import calibration, cli

HERE = Path(__file__).resolve().parent
OUT = HERE / "out" / "gallery"


def font(size):
    for name in ("consola.ttf", "DejaVuSansMono.ttf", "cour.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    cal = calibration.load()
    tiles = []
    for prof in ("loom", "thread"):
        row = []
        for lv in calibration.levels(cal, prof):
            d = OUT / f"{prof}_p{lv['p']:g}"
            cli.main(["weave", str(HERE / "demo" / "moth.png"), "--p", str(lv["p"]), "--profile", prof,
                      "--seed", "1", "--out", str(d), "--cell", "3"])
            row.append((prof, lv, Image.open(d / "render.png").convert("RGB")))
        tiles.append(row)
    w, h = tiles[0][0][2].size
    pad, head = 24, 64
    sheet = Image.new("RGB", (3 * w + 4 * pad, 2 * (h + head) + 3 * pad), (251, 250, 249))
    dr = ImageDraw.Draw(sheet)
    f1, f2 = font(22), font(17)
    names = {"loom": "noise on the whole loom", "thread": "noise only in the thread"}
    for r, row in enumerate(tiles):
        for c, (prof, lv, im) in enumerate(row):
            x = pad + c * (w + pad)
            y = pad + r * (h + head + pad)
            L = lv["se"]["logical_error_rate"]
            dr.text((x, y), f"p = {lv['p']:g} · {names[prof]}", fill=(25, 35, 142), font=f1)
            dr.text((x, y + 30), f"logical flips {100 * L:.2f} % · job {lv['se']['job_id'][:8]}", fill=(84, 91, 169), font=f2)
            sheet.paste(im, (x, y + head))
    sheet.save(HERE / "out" / "gallery.png", optimize=True)
    print("out/gallery.png written")


if __name__ == "__main__":
    main()
