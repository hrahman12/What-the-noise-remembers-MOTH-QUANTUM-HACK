"""Build the qpixl-v1 payloads: Tessa's colour-sphere pipeline done by hand. CLASSICAL.

Why: tessa-image-v1 timed out 5 times in a row (see PARAMS.md), so we run its quantum middle step
with qpixl-v1 (the same iqpixl encoding family) and do the colour split and rebuild ourselves.

Each colour is a point (x, y, z) in our colour ball (web/ball.js: grey centre, white +z, black -z,
hue = angle around z). Those three numbers are exactly the three things qubit tomography measures,
<X>, <Y>, <Z>. We send each component as a value in [0, 1] (v = (c + 1) / 2), in three "plates":
[all X | all Y | all Z | padding], like Maxwell's three filtered plates.

Payload per machine (each fills that machine's measured data-qubit capacity):
  aer            4096 values: 112 test colours + ribbon 35x35  (4011) + 85 padding
  fake_fez,
  ibm_fez         448 values: 112 test colours + ribbon 6x6    (444)  + 4 padding
  fake_brisbane   360 values: 112 test colours                 (336)  + 24 padding
Padding values are 0.5 (component 0 = the grey centre) and are ignored on the way back.
Writes data/payloads.json, data/ribbon_crop35.png, data/ribbon_crop6.png.
"""
import json
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
CROP = (250, 330, 820, 900)
CAPACITY = {"aer": 4096, "fake_fez": 448, "ibm_fez": 448, "fake_brisbane": 360}
RIBBON = {"aer": 35, "fake_fez": 6, "ibm_fez": 6, "fake_brisbane": 0}


def rgb_to_vec(rgb):
    """Same formula as web/ball.js (rgbToBall + toVec)."""
    R, G, B = (v / 255 for v in rgb)
    mx, mn = max(R, G, B), min(R, G, B)
    c, l = mx - mn, (mx + mn) / 2
    h = 0.0
    if c > 1e-9:
        if mx == R:
            h = 60 * (((G - B) / c) % 6)
        elif mx == G:
            h = 60 * ((B - R) / c + 2)
        else:
            h = 60 * ((R - G) / c + 4)
    z = 2 * l - 1
    rb = math.hypot(c, z)
    if rb < 1e-9:
        return [0.0, 0.0, 0.0]
    th = math.atan2(c, z)
    r = min(1.0, rb * (math.sin(th) + abs(math.cos(th))))
    ph = math.radians(h)
    return [r * math.sin(th) * math.cos(ph), r * math.sin(th) * math.sin(ph), r * math.cos(th)]


def build(machine, swatches, src):
    n = RIBBON[machine]
    rib = []
    if n:
        im = src.crop(CROP).resize((n, n), Image.LANCZOS)
        im.save(HERE / "data" / f"ribbon_crop{n}.png")
        rib = [list(im.getpixel((x, y))) for y in range(n) for x in range(n)]
    pixels = [s["rgb"] for s in swatches] + rib
    vecs = [rgb_to_vec(p) for p in pixels]
    plates = [[round((v[k] + 1) / 2, 6) for v in vecs] for k in range(3)]   # X plate, Y plate, Z plate
    values = plates[0] + plates[1] + plates[2]
    pad = CAPACITY[machine] - len(values)
    assert pad >= 0, (machine, len(values))
    values += [0.5] * pad
    return {"machine": machine, "n_pixels": len(pixels), "n_swatches": len(swatches), "ribbon": n,
            "ribbon_rgb": rib, "pad": pad, "values": values}


def main():
    sw = json.loads((HERE / "swatches.json").read_text(encoding="utf-8"))["swatches"]
    src = Image.open(HERE / "data" / "Tartan_Ribbon.jpg").convert("RGB")
    out = {m: build(m, sw, src) for m in CAPACITY}
    (HERE / "data" / "payloads.json").write_text(json.dumps(out), encoding="utf-8")
    for m, p in out.items():
        print(f"{m:14s} {len(p['values'])} values = {p['n_swatches']} test colours + ribbon {p['ribbon']}x{p['ribbon']} "
              f"({3 * p['n_pixels']}) + {p['pad']} padding")


if __name__ == "__main__":
    main()
