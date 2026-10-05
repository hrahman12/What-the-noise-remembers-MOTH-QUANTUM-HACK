"""Brand colour map for temperature (classical display step). Same stops as web/template.html."""
import numpy as np

# monotonic in lightness: cold = deep night blue, warm = moth-wing ochre, hottest = cream
STOPS = [(-1.0, (6, 9, 26)), (-0.55, (30, 52, 124)), (-0.15, (86, 92, 156)), (0.2, (170, 112, 72)),
         (0.6, (237, 185, 92)), (1.0, (255, 246, 222))]


def colorize(t, scale):
    """t in microkelvin, scale = the |t| that hits the end stops. Returns uint8 RGB."""
    x = np.clip(np.asarray(t, dtype=np.float64) / scale, -1, 1)
    xs = np.array([s[0] for s in STOPS])
    rgb = np.stack([np.interp(x, xs, [s[1][k] for s in STOPS]) for k in range(3)], axis=-1)
    bad = np.isnan(rgb).any(axis=-1)
    rgb[bad] = (13, 15, 23)
    return np.rint(rgb).astype(np.uint8)
