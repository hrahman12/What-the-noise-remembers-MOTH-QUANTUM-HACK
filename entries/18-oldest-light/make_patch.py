"""Turn the WMAP 9-year ILC map into the temperature grids that blur-core-v1 receives.
CLASSICAL step (no quantum): HEALPix read + oblique equirectangular projection + bilinear interpolation.

- Sky window: an oblique plate-carree projection whose own equator and prime meridian cross at
  galactic (l, b) = (209, -57), the position of the so-called CMB Cold Spot. DEG_PER_PX = 11.25
  arcmin. East (increasing l) is to the left and galactic north is up, as on the usual sky maps.
- "sq"   grid: 257 x 257 (48 x 48 deg). 257 = 256 + 1 is deliberate: blur-core-v1 pads each axis to
  the next power of two (512), so the register is 9 + 9 = 18 qubits.
- "wide" grid: 257 x 513 (48 x 96 deg), the same window widened: 9 + 10 = 19 qubits. Its central
  257 columns are exactly the "sq" grid. (Used for the 19-qubit attempt; see README.)
- The engine only accepts non-negative numbers, so temperatures are mapped linearly onto integers
  0..999 (QMAX) over [T_LO, T_HI] (the range of the wide window); the inverse map is stored so the
  page can show microkelvin.

Outputs: out/grid_input.npy (sq, int16), out/grid_wide.npy (int16), out/patch_uK.npy,
out/wide_uK.npy, out/patch_meta.json, out/sky_moll.npy (full-sky Mollweide, float32 mK, NaN
outside the ellipse).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from astropy.coordinates import Galactic
from astropy.io import fits
from astropy_healpix import HEALPix
import astropy.units as u

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
FITS = HERE / "data" / "wmap_ilc_9yr_v5.fits"
N = 257
W_WIDE = 513
DEG_PER_PX = 48.0 / 256          # 11.25 arcmin
FIELD_DEG = DEG_PER_PX * (N - 1)
L0, B0 = 209.0, -57.0            # Cold Spot (Vielva et al. 2004)
QMAX = 999


def load_map():
    with fits.open(FITS) as h:
        hdr = h[1].header
        assert hdr["ORDERING"] == "NESTED" and int(hdr["NSIDE"]) == 512
        T = np.asarray(h[1].data["TEMPERATURE"], dtype=np.float64).ravel()  # mK, thermodynamic
    hp = HEALPix(nside=512, order="nested", frame=Galactic())
    return hp, T


def oblique_lonlat(rows=N, cols=N, dpp=DEG_PER_PX, l0=L0, b0=B0):
    """Oblique plate carree. Returns galactic (l, b) in degrees for a rows x cols grid, row 0 on top.
    Local frame: x axis -> (l0, b0), y axis -> east (increasing l), z axis -> galactic north."""
    lam = np.radians((np.arange(cols) - (cols - 1) / 2) * -dpp)[None, :]   # east (positive) on the left
    phi = np.radians(((rows - 1) / 2 - np.arange(rows)) * dpp)[:, None]    # north (positive) on top
    v = np.stack(np.broadcast_arrays(np.cos(phi) * np.cos(lam), np.cos(phi) * np.sin(lam), np.sin(phi)), -1)
    l0r, b0r = np.radians(l0), np.radians(b0)
    ex = np.array([np.cos(b0r) * np.cos(l0r), np.cos(b0r) * np.sin(l0r), np.sin(b0r)])
    ey = np.array([-np.sin(l0r), np.cos(l0r), 0.0])
    ez = np.cross(ex, ey)
    g = v[..., :1] * ex + v[..., 1:2] * ey + v[..., 2:] * ez
    return np.degrees(np.arctan2(g[..., 1], g[..., 0])) % 360, np.degrees(np.arcsin(np.clip(g[..., 2], -1, 1)))


def mollweide(hp, T, w=1024, l_c=L0):
    """Full-sky Mollweide image centred on l = l_c (the patch), l increasing to the left. NaN outside the ellipse."""
    h = w // 2
    x = (np.arange(w) + 0.5) / w * 4 * np.sqrt(2) - 2 * np.sqrt(2)
    y = np.sqrt(2) - (np.arange(h) + 0.5) / h * 2 * np.sqrt(2)
    X, Y = np.meshgrid(x, y)
    inside = (X / (2 * np.sqrt(2))) ** 2 + (Y / np.sqrt(2)) ** 2 <= 1
    th = np.arcsin(np.clip(Y / np.sqrt(2), -1, 1))
    lat = np.arcsin(np.clip((2 * th + np.sin(2 * th)) / np.pi, -1, 1))
    lon = -np.pi * X / (2 * np.sqrt(2) * np.cos(th))
    img = np.full(X.shape, np.nan)
    vals = hp.interpolate_bilinear_lonlat(((l_c + np.degrees(lon[inside])) % 360) * u.deg, np.degrees(lat[inside]) * u.deg, T)
    img[inside] = vals
    return img.astype(np.float32)


def outline(lon, lat, step=8):
    r, c = lon.shape
    idx = np.concatenate([np.c_[np.zeros(c), np.arange(c)], np.c_[np.arange(r), np.full(r, c - 1)],
                          np.c_[np.full(c, r - 1), np.arange(c)[::-1]], np.c_[np.arange(r)[::-1], np.zeros(r)]]).astype(int)[::step]
    return [[round(float(lon[i, j]), 3), round(float(lat[i, j]), 3)] for i, j in idx]


def main():
    OUT.mkdir(exist_ok=True)
    hp, T = load_map()
    lon, lat = oblique_lonlat(N, W_WIDE)
    Pw = hp.interpolate_bilinear_lonlat(lon * u.deg, lat * u.deg, T) * 1000.0     # microkelvin
    lo, hi = float(np.floor(Pw.min())), float(np.ceil(Pw.max()))
    Gw = np.rint((Pw - lo) / (hi - lo) * QMAX).astype(np.int16)
    c0 = (W_WIDE - N) // 2
    G, P = Gw[:, c0:c0 + N], Pw[:, c0:c0 + N]
    np.save(OUT / "grid_input.npy", G)
    np.save(OUT / "grid_wide.npy", Gw)
    np.save(OUT / "patch_uK.npy", P.astype(np.float32))
    np.save(OUT / "wide_uK.npy", Pw.astype(np.float32))
    meta = {"source": "WMAP 9-year ILC (wmap_ilc_9yr_v5.fits), NASA LAMBDA", "projection": "oblique plate carree",
            "centre_lb": [L0, B0], "deg_per_px": DEG_PER_PX, "sq_shape": [N, N], "wide_shape": [N, W_WIDE],
            "sq_col0_in_wide": c0, "field_deg": [FIELD_DEG, FIELD_DEG], "wide_field_deg": [FIELD_DEG, DEG_PER_PX * (W_WIDE - 1)],
            "t_lo_uK": lo, "t_hi_uK": hi, "qmax": QMAX, "uK_per_unit": (hi - lo) / QMAX,
            "patch_rms_uK": float(P.std()), "patch_mean_uK": float(P.mean()), "sky_rms_uK": float(T.std() * 1000),
            "outline_lb": outline(lon[:, c0:c0 + N], lat[:, c0:c0 + N]), "outline_wide_lb": outline(lon, lat),
            "map_resolution_deg": 1.0, "moll_centre_l": L0}
    (OUT / "patch_meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    np.save(OUT / "sky_moll.npy", mollweide(hp, T))
    print(f"sq {G.shape} / wide {Gw.shape}, {DEG_PER_PX * 60:.2f} arcmin/px, T in [{lo:.0f}, {hi:.0f}] uK, "
          f"sq rms {P.std():.1f} uK; ints 0..{Gw.max()}, sq mean {G.mean():.1f}")


if __name__ == "__main__":
    main()
