"""Measured Steane-code statistics from Atlas tamagotchi-v1 (the only quantum input to the loom).

loom/data/calibration.json is written by engine/run_calibration.py from completed, cached Atlas jobs.
Nothing in this module computes or invents a rate: it only looks numbers up.
"""
from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

PROFILES = ("loom", "thread")


def load(path=None) -> dict:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    return json.loads(resources.files("loom").joinpath("data/calibration.json").read_text(encoding="utf-8"))


def levels(cal: dict, profile: str = "loom") -> list:
    """All calibrated noise levels for a profile, sorted by p."""
    if profile not in cal["profiles"]:
        raise KeyError(f"profile {profile!r} not calibrated (have {sorted(cal['profiles'])})")
    return sorted(cal["profiles"][profile]["levels"], key=lambda lv: lv["p"])


def level(cal: dict, p: float, profile: str = "loom") -> dict:
    """The calibrated level whose p matches (relative tolerance 1 %). Raises if p was never run."""
    for lv in levels(cal, profile):
        if abs(lv["p"] - p) <= 0.01 * max(lv["p"], 1e-12):
            return lv
    have = ", ".join(f"{lv['p']:g}" for lv in levels(cal, profile))
    raise ValueError(f"p={p:g} has no tamagotchi-v1 job in profile {profile!r} (calibrated: {have}). "
                     "Run engine/run_calibration.py with that p to add it.")


def rates(lv: dict) -> dict:
    """The three numbers the weave samples from, for one calibrated level:
    L0, L1 = the engine's logical error rate after one syndrome round for a stored 0 and a stored 1;
    s      = the chance that a block shows a bit-flip syndrome.

    The engine's syndromes_detected counts a nonzero bit-flip (Z-type) syndrome and a nonzero phase-flip
    (X-type) syndrome as separate events, up to 2 per block per round (probe measonly_se_p0.5_n1: 1.757 per
    block at p_meas = 0.5, against 2 x (1 - 0.5^3) = 1.75). Only bit flips change the threads, so the loom
    uses half the measured event rate. That halving assumes the depolarizing noise hits both types equally;
    it is an assumption, not an engine output."""
    se = lv["se"]
    return {"L0": se["ler_bit0"], "L1": se["ler_bit1"], "s": min(1.0, se["syndrome_rate"] / 2.0)}
