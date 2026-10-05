"""Build the 32x32 input plate for tessa-image-v1. CLASSICAL.

(A 64x64 plate, the engine's documented ceiling, timed out twice on the server: jobs
d9f4bf33 and b12180f3, both "engine_timeout". We stepped down one notch to 32x32.)

Layout (one image, so every engine run rebuilds the ribbon AND a colour chart together):
  - top-left 24x24: Maxwell's 1861 tartan ribbon (Wikimedia Commons, public domain), square crop
    of the knot, source box x=250..820, y=330..900 of the 1100x900 scan, Lanczos-downsampled (data/ribbon_crop48.png keeps a 48 px copy for display).
  - the L-shaped rest: 112 colour swatches, each a 2x2 block of one colour, spread evenly through
    the colour ball (80 on the surface, 25 half-way in, 7 greys on the white-black axis).

Writes plate.png, data/ribbon_crop24.png, data/ribbon_crop48.png and swatches.json (block positions + colours + ball coords).
The colour-ball formula here is OUR OWN (same landmarks as the engine's documented rgb_to_sphere:
50% grey at the centre, white pole theta=0, black pole theta=pi, hue = azimuth phi). The engine
uses its own mapping internally; we only use ours to choose swatches and to draw them.
"""
import json
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
CROP = (250, 330, 820, 900)
SIZE = 32
RIB = 24
BLOCK = 2


def hsl_to_rgb(h, c, l):
    """hue (deg), chroma 0..1, lightness 0..1 -> RGB 0..255."""
    hp = (h % 360) / 60
    x = c * (1 - abs(hp % 2 - 1))
    r1, g1, b1 = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(hp) % 6]
    m = l - c / 2
    return tuple(int(round(255 * min(1, max(0, v + m)))) for v in (r1, g1, b1))


def ball_to_rgb(r, theta, phi):
    """Point in the unit colour ball -> RGB. Radial scale maps the HSL bicone onto the ball."""
    s, co = math.sin(theta), math.cos(theta)
    rb = r / (s + abs(co))           # bicone radius in this direction
    chroma, z = rb * s, rb * co
    return hsl_to_rgb(math.degrees(phi), chroma, (z + 1) / 2)


def fib(n):
    """n roughly uniform directions on the sphere (golden-angle spiral)."""
    ga = math.pi * (3 - math.sqrt(5))
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        out.append((math.acos(z), (i * ga) % (2 * math.pi)))
    return out


def swatch_points():
    pts = [(1.0, t, p) for t, p in fib(80)]
    pts += [(0.5, t, p) for t, p in fib(25)]
    pts += [(abs(z), 0.0 if z >= 0 else math.pi, 0.0) for z in (1, .7, .35, 0, -.35, -.7, -1)]
    return pts


def main():
    src = Image.open(HERE / "data" / "Tartan_Ribbon.jpg").convert("RGB")
    src.crop(CROP).resize((48, 48), Image.LANCZOS).save(HERE / "data" / "ribbon_crop48.png")
    rib = src.crop(CROP).resize((RIB, RIB), Image.LANCZOS)
    rib.save(HERE / "data" / "ribbon_crop24.png")
    plate = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    plate.paste(rib, (0, 0))

    pts = swatch_points()
    sw = []
    for r, t, p in pts:
        rgb = ball_to_rgb(r, t, p)
        sw.append({"rgb": rgb, "ball": [round(r, 4), round(t, 4), round(p, 4)]})
    # order like a printed colour chart: light to dark, then by hue
    sw.sort(key=lambda s: (-round(sum(s["rgb"]) / 3 / 32), s["ball"][2]))
    B = BLOCK
    slots = [(RIB + B * c, B * r) for r in range(16) for c in range(4)]      # right strip 4x16 blocks
    slots += [(B * c, RIB + B * r) for r in range(4) for c in range(12)]     # bottom strip 12x4 blocks
    assert len(slots) == len(sw) == 112
    for i, (s, (x, y)) in enumerate(zip(sw, slots)):
        s.update({"i": i, "x": x, "y": y})
        for dx in range(BLOCK):
            for dy in range(BLOCK):
                plate.putpixel((x + dx, y + dy), tuple(s["rgb"]))
    plate.save(HERE / "plate.png")
    (HERE / "swatches.json").write_text(json.dumps({"size": SIZE, "block": BLOCK, "ribbon": {"x": 0, "y": 0, "size": RIB, "crop_box": CROP},
                                                     "swatches": sw}, indent=1), encoding="utf-8")
    print(f"plate.png {SIZE}x{SIZE}: ribbon {RIB}x{RIB} + {len(sw)} swatches of {BLOCK}x{BLOCK}")


if __name__ == "__main__":
    main()
