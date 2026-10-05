"""Shared helpers: load tokens, lay real codas on a playback timeline, pick the real stretch for the WAV.
CLASSICAL. Imported by run_reservoir.py, build_events.py and compose_audio.py.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"

SILENCE_CAP = 2.5      # real silences between codas longer than this are shortened to this (seconds)
REC_BREAK = 2.5        # silence inserted between two recordings
STRETCH_MIN, STRETCH_MAX = 30.0, 38.0   # length of the real stretch that opens the WAV
WHALES = ["1", "2", "3", "4"]           # whales with >= 150 codas in the corpus


def load_tokens():
    return json.loads((OUT / "tokens.json").read_text(encoding="utf-8"))


LEAD_IN = 0.5          # silence before the first coda of a track


def timeline(codas, lead=0.0):
    """Real codas in corpus order -> list of (start_s, coda). Overlaps are kept as recorded;
    only long silences are capped. Consecutive codas from different recordings get REC_BREAK."""
    out, t = [], lead
    prev = None
    for c in codas:
        if prev is not None:
            if c["rec"] == prev["rec"]:
                start_gap = c["t"] - prev["t"]                 # start-to-start in the recording
                silence = start_gap - prev["dur"]
                if silence > SILENCE_CAP:
                    start_gap = prev["dur"] + SILENCE_CAP
                t += max(start_gap, 0.0)
            else:
                t += prev["dur"] + REC_BREAK
        out.append((round(t, 5), c))
        prev = c
    return out


def real_silences(codas):
    """End-to-start silences between consecutive codas in the same recording (seconds, > 0)."""
    s = []
    for a, b in zip(codas, codas[1:]):
        if a["rec"] == b["rec"]:
            g = b["t"] - (a["t"] + a["dur"])
            if g > 0:
                s.append(g)
    return s


def pick_stretch(codas):
    """Choose the contiguous run of real codas (one recording) that opens the WAV: 30-38 s of
    playback, an exchange between >= 2 whales (each >= 4 codas). Score favours dense exchanges with
    several distinct tokens and penalises silence we had to cap."""
    best = None
    n = len(codas)
    for i in range(n):
        rec = codas[i]["rec"]
        j = i
        while j + 1 < n and codas[j + 1]["rec"] == rec:
            j += 1
            seg = codas[i:j + 1]
            tl = timeline(seg)
            length = tl[-1][0] + seg[-1]["dur"]
            if length > STRETCH_MAX:
                break
            if length < STRETCH_MIN:
                continue
            real_len = seg[-1]["t"] + seg[-1]["dur"] - seg[0]["t"]
            removed = max(real_len - length, 0.0)
            per_whale = {}
            for c in seg:
                per_whale[c["whale"]] = per_whale.get(c["whale"], 0) + 1
            if sum(v >= 4 for v in per_whale.values()) < 2:
                continue
            score = len(seg) + 3 * len({c["token"] for c in seg}) - removed / 2
            if best is None or score > best[0]:
                best = (score, i, j + 1)
    return best[1], best[2]
