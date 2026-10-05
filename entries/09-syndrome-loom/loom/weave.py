"""Turn a bit image into a Steane-coded cloth. CLASSICAL sampling from QUANTUM-measured rates.

Every pixel is one Steane block = 7 warp threads. Each image row becomes a band of 7 picks:
6 picks that show the block's 7 threads as read out (or as corrected), then 1 red syndrome pick
whose red float sits under the thread the syndrome points at.

Per block, four uniform draws from mulberry32 (always four, so the stream never drifts):
  u_fail  < L[bit]  -> the block lands in the wrong coset (a logical flip the engine measured)
  u_synd  < s       -> a bit-flip syndrome (half the engine's syndromes_detected per block; see calibration.rates)
  u_pos             -> which of the 7 threads the event flips (uniform; the engine does not report it)
  u_word            -> which of the 8 coset codewords a Z readout returns (used in 'measured' mode)
The two events are drawn independently because the engine reports marginal counts, not per-shot records.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from . import steane
from .prng import Mulberry32

CODE_PICKS = 6
BAND = CODE_PICKS + 1  # picks per image row
GROUND, RED = 2, 3      # weft colour indices (WIF colour table)


@dataclass
class Block:
    bit: int          # the pixel (logical bit stored)
    failed: bool      # logical flip after correction
    flagged: bool     # syndrome event
    pos: int          # flipped thread 1..7, 0 if not flagged
    sent: list        # codeword actually held (wrong coset if failed)
    received: list    # what the threads read before correction
    syn: int          # syndrome of `received` (== pos)
    corrected: list   # after Hamming correction
    decoded: int      # parity of corrected word


@dataclass
class Weave:
    bits: list
    blocks: list
    seed: int
    rates: dict
    codewords: str = "plain"
    meta: dict = field(default_factory=dict)

    @property
    def rows(self):
        return len(self.bits)

    @property
    def cols(self):
        return len(self.bits[0]) if self.bits else 0

    def counts(self) -> dict:
        flat = [b for row in self.blocks for b in row]
        n = len(flat)
        return {"blocks": n,
                "flagged": sum(b.flagged for b in flat),
                "failed": sum(b.failed for b in flat),
                "pixels_wrong": sum(b.decoded != b.bit for b in flat),
                "threads": n * steane.N,
                "threads_flipped_as_read": sum(b.flagged for b in flat)}


def sample(bits, rates: dict, seed: int = 1, codewords: str = "plain") -> Weave:
    if codewords not in ("plain", "measured"):
        raise ValueError("codewords must be 'plain' or 'measured'")
    rng = Mulberry32(seed)
    L = (rates["L0"], rates["L1"])
    s = rates["s"]
    blocks = []
    for row in bits:
        out = []
        for bit in row:
            u_fail, u_synd, u_pos, u_word = rng.random(), rng.random(), rng.random(), rng.random()
            failed = u_fail < L[bit]
            flagged = u_synd < s
            pos = min(6, int(u_pos * 7)) + 1 if flagged else 0
            k = min(7, int(u_word * 8)) if codewords == "measured" else 0
            sent = steane.codeword(bit ^ int(failed), k)
            received = steane.flip(sent, pos)
            corrected, syn = steane.correct(received)
            out.append(Block(bit, failed, flagged, pos, sent, received, syn, corrected, steane.logical(corrected)))
        blocks.append(out)
    return Weave(bits=[list(r) for r in bits], blocks=blocks, seed=seed, rates=dict(rates), codewords=codewords)


def drawdown(w: Weave, view: str = "received"):
    """Return (cells, weft) for the cloth.
    cells[pick][end] = 1 where the warp is lifted over the weft (the ink-blue warp shows),
                       0 where the weft shows (unbleached ground weft, or red on a syndrome pick).
    A light pixel bit 1 is weft-faced (cell 0); a dark pixel bit 0 is warp-faced (cell 1).
    weft[pick] = GROUND or RED."""
    if view not in ("received", "corrected"):
        raise ValueError("view must be 'received' or 'corrected'")
    cells, weft = [], []
    for brow in w.blocks:
        word_row = []
        red_row = []
        for b in brow:
            word = b.received if view == "received" else b.corrected
            word_row.extend(1 - x for x in word)
            red_row.extend(0 if (b.syn and i + 1 == b.syn) else 1 for i in range(steane.N))
        for _ in range(CODE_PICKS):
            cells.append(list(word_row))
            weft.append(GROUND)
        cells.append(red_row)
        weft.append(RED)
    return cells, weft
