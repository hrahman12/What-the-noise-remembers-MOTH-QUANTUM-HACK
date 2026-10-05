"""Disk mask for the 'erased' region. White = blur (erase), black = keep. CLASSICAL."""
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
W = H = 1024
CENTRE = (580, 440)   # off-centre so the wheel's 5-fold centre is not the subject
RADIUS = 270  # bbox 541 px -> ceil(log2 541) * 2 = 20 qubits, blur-v1's maximum


def main():
    m = Image.new("L", (W, H), 0)
    cx, cy = CENTRE
    ImageDraw.Draw(m).ellipse([cx - RADIUS, cy - RADIUS, cx + RADIUS, cy + RADIUS], fill=255)
    m.save(HERE / "mask.png")
    print(f"mask.png: disk r={RADIUS} at {CENTRE}")


if __name__ == "__main__":
    main()
