"""Rebuild the erased disk from the substitution rule alone. CLASSICAL geometry, no Atlas.

Re-run the same deflation, keep only the half-rhombs that touch the hole, paint them over the
blurred image, and measure the pixel diff against intact.png inside the mask.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import tiling  # noqa: E402
from mask import CENTRE, RADIUS  # noqa: E402

HERO = "blur_s1.0_rx_r1.0.png"


def touches_hole(pts):
    cx, cy = CENTRE
    if any((x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2 for x, y in pts):
        return True
    # triangle centroid / edge midpoints catch the few tiles that straddle the rim
    mids = [((pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2) for i, j in ((0, 1), (1, 2), (0, 2))]
    return any((x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2 for x, y in mids)


def main():
    tris = tiling.generate()
    idx = {i for i, (_, pts) in enumerate(tris) if touches_hole(pts)}
    patch = tiling.render(tris, only=idx)
    blurred = Image.open(HERE / "out" / HERO).convert("RGB")
    mask = np.array(Image.open(HERE / "mask.png")) > 127

    rebuilt = blurred.copy()
    rebuilt.paste(patch.convert("RGB"), mask=Image.fromarray((mask * 255).astype(np.uint8)))
    rebuilt.save(HERE / "rebuilt.png")

    a = np.asarray(rebuilt, dtype=int)
    b = np.asarray(Image.open(HERE / "intact.png").convert("RGB"), dtype=int)
    bad = (np.abs(a - b).max(axis=2) > 24) & mask
    frac = bad.sum() / mask.sum()
    heat = np.zeros((*mask.shape, 3), np.uint8)
    heat[mask] = (40, 40, 40)
    heat[bad] = (255, 60, 60)
    Image.fromarray(heat).save(HERE / "out" / "rebuild_diff.png")
    (HERE / "out" / "rebuild_diff.txt").write_text(
        f"tiles repainted: {len(idx)} half-rhombs\npixels differing (>24/255) inside mask: {bad.sum()} / {mask.sum()} = {frac:.4%}\n",
        encoding="utf-8")
    print(f"rebuilt.png: {len(idx)} half-rhombs repainted; diff inside mask {frac:.4%}")


if __name__ == "__main__":
    main()
