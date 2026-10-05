"""Paper/ink display palette for the classical moire-envelope maps. CLASSICAL, display only.

measure.py writes the envelope maps (out/maps/, out/maps_in/) with a fixed 4-stop colour ramp
(STOPS below, dark to cream). The page and the video now follow the brief-page look (warm paper,
one ultramarine ink), so the same scalar is re-shown on a paper -> ink ramp: each pixel is projected
back onto the old ramp to recover its 0..1 value, then mapped onto PAPER_INK. Same values, new
colours; the measurement files are not touched. Raw engine frames are never recoloured.
"""
import numpy as np
from PIL import Image

STOPS = np.array([[13, 15, 23], [52, 40, 28], [237, 185, 92], [250, 236, 205]], float)  # measure.py
PAPER_INK = np.array([[251, 250, 249], [211, 211, 230], [84, 91, 169], [25, 35, 142]], float)

PAPER = (251, 250, 249)
PANEL = (255, 255, 255)
RULE = (211, 211, 230)
INK = (25, 35, 142)
INK2 = (84, 91, 169)
INK3 = (161, 164, 206)
WARN = (180, 84, 26)


def ramp_value(rgb):
    """Invert the measure.py ramp: (..., 3) uint8 -> (...) float in 0..1 (nearest point on the ramp)."""
    p = np.asarray(rgb, float)
    best_d = np.full(p.shape[:-1], np.inf)
    best_v = np.zeros(p.shape[:-1])
    n = len(STOPS) - 1
    for i in range(n):
        a, b = STOPS[i], STOPS[i + 1]
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        d = ((p - (a + t[..., None] * ab)) ** 2).sum(-1)
        m = d < best_d
        best_d[m] = d[m]
        best_v[m] = (i + t[m]) / n
    return best_v


def apply_ramp(v, stops=PAPER_INK):
    t = np.clip(v, 0, 1) * (len(stops) - 1)
    i = np.clip(t.astype(int), 0, len(stops) - 2)
    f = (t - i)[..., None]
    return (stops[i] * (1 - f) + stops[i + 1] * f + 0.5).astype(np.uint8)


def recolour(im):
    """PIL image on the measure.py ramp -> PIL RGB image on the paper/ink ramp."""
    return Image.fromarray(apply_ramp(ramp_value(np.asarray(im.convert("RGB")))), "RGB")


if __name__ == "__main__":
    # round-trip check: the ramp inverts to within quantisation
    v = np.linspace(0, 1, 1001)
    back = ramp_value(apply_ramp(v, STOPS))
    print("max round-trip error", float(np.abs(back - v).max()))
