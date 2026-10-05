"""Render a drawdown as a woven preview with thread shading. CLASSICAL.

Each cell is drawn as the thread on top: a vertical warp segment or a horizontal weft segment,
shaded like a cylinder across its width and tapered where a float dives under at either end.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from .wif import PALETTE


def _tiles(c: int) -> np.ndarray:
    """8 shading tiles (c x c): index = orient*4 + start*2 + end; orient 0 = warp (vertical), 1 = weft."""
    x = (np.arange(c) + 0.5) / c
    across = 0.50 + 0.50 * np.sin(np.pi * x) ** 0.8       # cylinder shading across the thread
    sheen = 0.18 * np.exp(-((x - 0.38) / 0.12) ** 2)       # soft highlight a little off-centre
    prof = across + sheen
    taper = np.ones(c)
    k = max(1, c // 4)
    taper[:k] = np.linspace(0.55, 0.92, k)
    tiles = np.empty((8, c, c))
    for orient in (0, 1):
        for start in (0, 1):
            for end in (0, 1):
                along = np.ones(c)
                if start:
                    along = along * taper
                if end:
                    along = along * taper[::-1]
                t = np.outer(along, prof)  # rows = along the thread, cols = across
                tiles[orient * 4 + start * 2 + end] = t if orient == 0 else t.T
    return tiles


def render(cells, weft, cell: int = 8) -> Image.Image:
    a = np.asarray(cells, dtype=np.int8)
    rows, cols = a.shape
    up = a == 1
    # float ends: a warp float starts where the cell above is not warp-up, etc.
    above = np.vstack([np.zeros((1, cols), bool), up[:-1]])
    below = np.vstack([up[1:], np.zeros((1, cols), bool)])
    dn = ~up
    left = np.hstack([np.zeros((rows, 1), bool), dn[:, :-1]])
    right = np.hstack([dn[:, 1:], np.zeros((rows, 1), bool)])
    idx = np.where(up, (~above) * 2 + (~below) * 1, 4 + (~left) * 2 + (~right) * 1).astype(int)
    tiles = _tiles(cell)
    shade = tiles[idx]                                   # rows, cols, c, c
    shade = shade.transpose(0, 2, 1, 3).reshape(rows * cell, cols * cell)
    warp = np.array(PALETTE[1], float)
    wcol = np.array([PALETTE[w] for w in weft], float)   # rows, 3
    col = np.where(up[..., None], warp[None, None, :], wcol[:, None, :])  # rows, cols, 3
    col = np.repeat(np.repeat(col, cell, axis=0), cell, axis=1)
    img = np.clip(col * shade[..., None], 0, 255).astype(np.uint8)
    return Image.fromarray(img, "RGB")
