"""Vibrational "chords" for three odorants and their deuterated isotopomers. CLASSICAL.

Band positions are approximate textbook IR group frequencies (cm^-1), rounded, for the normal
(all-hydrogen) molecules. They are NOT a measured spectrum of any particular sample, and the
intensity classes (s / m / w) are only rough, qualitative IR strengths.

Deuterated versions are ESTIMATED, not measured: every band that moves a hydrogen atom
(C-H stretches and bends, flagged `h=True`) is divided by the harmonic C-H -> C-D reduced-mass
factor sqrt(mu_CD / mu_CH) = 1.362. Bands that mainly move heavy atoms (C=O, ring C=C, C-C) are
kept where they are. Real deuterated spectra differ by a few percent from this idealised
local-mode estimate, and modes mix; the page says so.

Mapping into sound (one rule for everything, so musical intervals = vibrational ratios):
  audio_hz = wavenumber_cm^-1 * 0.25          (a slow-down of ~1.2e11: 1 cm^-1 = 29.98 GHz)
  MIDI note number = round(wavenumber / 28)   (each MIDI "key" is a 28 cm^-1 spectral bin, 7 Hz)
So MIDI notes here are spectral bins, not semitones: play them with render_wav.py or the page,
which map bin n back to n * 28 * 0.25 = 7 n Hz.
"""
from __future__ import annotations

import math

# atomic masses (u)
M_C, M_H, M_D = 12.000, 1.00783, 2.01410
MU_CH = M_C * M_H / (M_C + M_H)
MU_CD = M_C * M_D / (M_C + M_D)
HD_FACTOR = math.sqrt(MU_CD / MU_CH)          # 1.3624...

BIN_CM = 28.0          # cm^-1 per MIDI note number
HZ_PER_CM = 0.25       # audio Hz per cm^-1
VEL = {"s": 112, "m": 84, "w": 56}

# (wavenumber cm^-1, assignment, involves hydrogen?, IR strength class)
MOLECULES = {
    "acetophenone": {
        "name": "Acetophenone",
        "formula_h": "C8H8O", "formula_d": "C8D8O", "d_name": "acetophenone-d8",
        "n_h": 8,
        "bands": [
            (3060, "aromatic C-H stretch", True, "w"),
            (2925, "methyl C-H stretch", True, "w"),
            (1685, "C=O stretch", False, "s"),
            (1600, "ring C=C stretch", False, "m"),
            (1450, "ring C=C stretch", False, "m"),
            (1360, "CH3 umbrella bend", True, "m"),
            (1265, "C-C(=O) stretch", False, "s"),
            (1025, "aromatic C-H in-plane bend", True, "w"),
            (760, "aromatic C-H out-of-plane bend", True, "s"),
            (690, "ring out-of-plane bend", False, "s"),
        ],
    },
    "exaltone": {
        "name": "Cyclopentadecanone",
        "nick": "Exaltone",
        "formula_h": "C15H28O", "formula_d": "C15D28O", "d_name": "cyclopentadecanone-d28",
        "n_h": 28,
        "bands": [
            (2930, "CH2 asymmetric stretch", True, "s"),
            (2855, "CH2 symmetric stretch", True, "s"),
            (1712, "C=O stretch", False, "s"),
            (1460, "CH2 scissor bend", True, "m"),
            (1410, "CH2 scissor next to C=O", True, "w"),
            (1350, "CH2 wag", True, "w"),
            (1250, "CH2 twist", True, "w"),
            (1100, "C-C stretch", False, "w"),
            (720, "CH2 rock", True, "w"),
        ],
    },
    "muscone": {
        "name": "Muscone",
        "nick": "3-methylcyclopentadecanone",
        "formula_h": "C16H30O", "formula_d": "C16D30O", "d_name": "muscone-d30",
        "n_h": 30,
        "bands": [
            (2955, "CH3 asymmetric stretch", True, "m"),
            (2930, "CH2 asymmetric stretch", True, "s"),
            (2870, "CH3 symmetric stretch", True, "w"),
            (2855, "CH2 symmetric stretch", True, "s"),
            (1712, "C=O stretch", False, "s"),
            (1460, "CH2 scissor bend", True, "m"),
            (1410, "CH2 scissor next to C=O", True, "w"),
            (1378, "CH3 umbrella bend", True, "w"),
            (1250, "CH2 twist", True, "w"),
            (720, "CH2 rock", True, "w"),
        ],
    },
}
ORDER = ["acetophenone", "exaltone", "muscone"]
ISOTOPES = ["H", "D"]


def lines(mol_key: str, iso: str):
    """List of dicts: wavenumber (cm^-1), audio Hz, MIDI bin, velocity, label, moved-by-D flag."""
    out = []
    for nu, label, h, strength in MOLECULES[mol_key]["bands"]:
        nu_iso = nu / HD_FACTOR if (iso == "D" and h) else float(nu)
        out.append({
            "nu": round(nu_iso, 1), "nu_h": nu, "hz": round(nu_iso * HZ_PER_CM, 2),
            "bin": int(round(nu_iso / BIN_CM)), "vel": VEL[strength], "strength": strength,
            "label": (label.replace("C-H", "C-D").replace("CH3", "CD3").replace("CH2", "CD2")
                      if (iso == "D" and h) else label),
            "h": h,
        })
    return sorted(out, key=lambda d: d["nu"])


def bin_hz(n: float) -> float:
    return n * BIN_CM * HZ_PER_CM


if __name__ == "__main__":
    print(f"H->D factor sqrt(mu_CD/mu_CH) = {HD_FACTOR:.4f}  "
          f"({12 * math.log2(HD_FACTOR):.2f} semitones)")
    for k in ORDER:
        for iso in ISOTOPES:
            ls = lines(k, iso)
            bins = [d["bin"] for d in ls]
            span = max(bins) - min(bins)
            print(f"{k:13s} {iso}: bins {min(bins)}-{max(bins)} (span {span}) "
                  + " ".join(f"{d['nu']:.0f}" for d in ls))
