"""Render an InkSprite (string rows) to a transparent PNG, using the same palette as common/inksprite.js.

Usage: python common/mascot.py <sprites.json> <sprite-name> <out.png> [--scale 4] [--frame 0]
sprites.json: {"name": {"frames": [["..K..", ...], ...], "palette": {"X": "#hex"}}, ...}
              (a bare list of rows, or {"rows": [...]}, also works)
"""
import argparse
import json
from pathlib import Path

from PIL import Image

PALETTE = {"K": "#19238E", "B": "#545BA9", "L": "#A1A4CE", "T": "#D3D3E6", "W": "#FBFAF9", "O": "#B4541A", "G": "#1F7A4D"}


def render(sprite, frame=0, scale=4):
    if isinstance(sprite, list):
        sprite = {"rows": sprite}
    frames = sprite.get("frames") or [sprite["rows"]]
    rows = frames[frame % len(frames)]
    pal = {**PALETTE, **(sprite.get("palette") or {})}
    w, h = max(len(r) for r in rows), len(rows)
    img = Image.new("RGBA", (w * scale, h * scale), (0, 0, 0, 0))
    px = img.load()
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            col = pal.get(ch)
            if ch in ". " or not col:
                continue
            rgb = tuple(int(col[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
            for dy in range(scale):
                for dx in range(scale):
                    px[i * scale + dx, j * scale + dy] = rgb
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sprites")
    ap.add_argument("name")
    ap.add_argument("out")
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--frame", type=int, default=0)
    a = ap.parse_args()
    data = json.loads(Path(a.sprites).read_text(encoding="utf-8"))
    img = render(data[a.name], a.frame, a.scale)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out)
    print(f"{a.out}: {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
