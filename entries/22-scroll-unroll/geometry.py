"""Spiral geometry shared by gen_scroll.py and unwrap.py. CLASSICAL.

The scroll is an Archimedean spiral with a small wobble (carbonised scrolls are crushed and uneven).
Screen coordinates: x right, y down, 1024 x 1024 px. phi is the unwinding angle measured from the inner
end of the sheet; the screen angle of a sheet point is alpha = ALPHA0 - phi, so the sheet runs
counter-clockwise on screen from the core to the outer edge, and the outer edge ends at the bottom of the
roll heading right (that makes the unroll animation start from the scan's own orientation).

A sheet point is addressed by (s, t): s = arc length of the centre curve from the inner end (px), and
t = radial offset from the centre curve (px, positive outward). Because the wobble depends only on the
screen angle, turns stay exactly PITCH apart along every ray, so t in [-PITCH/2, PITCH/2) tiles the
annulus without gaps or overlaps. The flattened strip is H = PITCH rows tall; row y has t = y - (H-1)/2.
"""
from __future__ import annotations

import math

import numpy as np

N = 1024
CX, CY = 512.0, 512.0
R0 = 58.0            # radius of the centre curve at the inner end (px)
PITCH = 52.0         # distance between successive turns (px); also the strip height
TURNS = 7.75
PHI_MAX = 2 * math.pi * TURNS
ALPHA0 = math.pi / 2 + PHI_MAX   # outer end at alpha = pi/2 (bottom of the roll)
WOB = [(5.0, 2, 0.7), (3.0, 3, 2.1)]   # (amplitude px, harmonic, phase)
H = int(PITCH)
DPHI = 1e-4          # integration step for the arc-length table

PARAMS = {"N": N, "CX": CX, "CY": CY, "R0": R0, "PITCH": PITCH, "TURNS": TURNS, "WOB": WOB, "DPHI": DPHI}


def wobble(alpha):
    return sum(a * np.sin(k * alpha + ph) for a, k, ph in WOB)


def radius(phi):
    """Centre-curve radius at unwinding angle phi."""
    return R0 + PITCH * phi / (2 * math.pi) + wobble(ALPHA0 - phi)


def arc_table():
    """(phi, s) samples of the centre curve; s is cumulative chord length at step DPHI."""
    phi = np.arange(0.0, PHI_MAX + DPHI / 2, DPHI)
    a = ALPHA0 - phi
    r = radius(phi)
    x, y = CX + r * np.cos(a), CY + r * np.sin(a)
    s = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(x), np.diff(y)))])
    return phi, s


PHI_T, S_T = arc_table()
L = int(math.floor(S_T[-1]))   # strip width in px (1 px per px of arc)


def phi_of_s(s):
    return np.interp(s, S_T, PHI_T)


def s_of_phi(phi):
    return np.interp(phi, PHI_T, S_T)


def sheet_to_image(s, t):
    """Image coordinates (x, y) of sheet point (s, t)."""
    phi = phi_of_s(s)
    a = ALPHA0 - phi
    rho = radius(phi) + t
    return CX + rho * np.cos(a), CY + rho * np.sin(a)


def image_to_sheet(x, y):
    """Inverse map: (s, t, valid) for image points. valid is False off the sheet."""
    dx, dy = np.asarray(x, float) - CX, np.asarray(y, float) - CY
    rho, beta = np.hypot(dx, dy), np.arctan2(dy, dx)
    phi_c = (rho - R0 - wobble(beta)) * 2 * math.pi / PITCH
    base = ALPHA0 - beta
    k = np.round((phi_c - base) / (2 * math.pi))
    phi = base + 2 * math.pi * k
    valid = (phi >= 0) & (phi <= PHI_MAX)
    t = rho - radius(phi)
    return s_of_phi(np.clip(phi, 0, PHI_MAX)), t, valid


def strip_coords():
    """Image coordinates for every strip pixel: arrays (ys, xs) of shape (H, L) for map_coordinates."""
    s = np.arange(L, dtype=float)
    t = np.arange(H, dtype=float) - (H - 1) / 2
    S, T = np.meshgrid(s, t)
    x, y = sheet_to_image(S, T)
    return y, x


def turn_of_s(s):
    """Turn number counted from the core (0 = innermost)."""
    return phi_of_s(s) / (2 * math.pi)
