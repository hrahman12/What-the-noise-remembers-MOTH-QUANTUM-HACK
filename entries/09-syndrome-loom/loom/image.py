"""Binarise an image into a grid of bits (1 = light pixel). CLASSICAL."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


def otsu(values: np.ndarray) -> float:
    """Otsu threshold of 0..255 grey values."""
    hist = np.bincount(values.astype(np.uint8).ravel(), minlength=256).astype(float)
    total = hist.sum()
    if total == 0:
        return 128.0
    levels = np.arange(256)
    w0 = np.cumsum(hist)
    m0 = np.cumsum(hist * levels)
    mt = m0[-1]
    w1 = total - w0
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mt * w0 / total - m0) ** 2 / (w0 * w1)
    between[~np.isfinite(between)] = -1
    return float(np.argmax(between)) + 0.5


def binarise(path, width: int = 32, threshold=None, invert: bool = False):
    """Load `path`, resize to `width` columns (height keeps the aspect ratio: blocks are square),
    threshold (Otsu by default) and return a list of rows of 0/1 ints."""
    im = Image.open(Path(path))
    if im.mode in ("RGBA", "LA") or "transparency" in im.info:
        bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(bg, im.convert("RGBA"))
    im = im.convert("L")
    w, h = im.size
    height = max(1, round(width * h / w))
    small = np.asarray(im.resize((width, height), Image.Resampling.BOX), dtype=float)
    t = otsu(small) if threshold is None else float(threshold)
    bits = (small >= t).astype(int)
    if invert:
        bits = 1 - bits
    return bits.tolist()
