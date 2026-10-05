"""Draw the demo image demo/moth.png: a synthetic moth silhouette (generated here, no third-party data). CLASSICAL."""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
W, H = 640, 480


def main():
    im = Image.new("L", (W, H), 18)
    d = ImageDraw.Draw(im)
    cx = W // 2
    light = 236
    for s in (-1, 1):
        # forewing: a swept triangle with a rounded tip
        fw = [(cx + s * 22, 215), (cx + s * 300, 70), (cx + s * 316, 140), (cx + s * 250, 270), (cx + s * 30, 282)]
        d.polygon(fw, fill=light)
        d.ellipse([cx + s * 300 - 24, 74, cx + s * 300 + 24, 150], fill=light)
        # hindwing: a rounded lobe
        d.ellipse([cx + (s * 30 if s > 0 else -240), 250, cx + (240 if s > 0 else -30), 452], fill=light)
        # eyespots: a dark ring in each hindwing, a dark bar across each forewing
        ex = cx + s * 132
        d.ellipse([ex - 50, 300, ex + 50, 400], fill=18)
        d.ellipse([ex - 20, 330, ex + 20, 370], fill=light)
        d.line([(cx + s * 100, 192), (cx + s * 250, 128)], fill=18, width=30)
        # antennae
        d.line([(cx + s * 8, 160), (cx + s * 60, 50), (cx + s * 120, 22)], fill=light, width=18)
    # body
    d.ellipse([cx - 28, 150, cx + 28, 430], fill=light)
    d.ellipse([cx - 34, 138, cx + 34, 200], fill=light)
    (HERE / "demo").mkdir(exist_ok=True)
    im.save(HERE / "demo" / "moth.png")
    print("demo/moth.png written")


if __name__ == "__main__":
    main()
