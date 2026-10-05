import pytest

from loom import steane, weave

BITS = [[0, 1, 1, 0], [1, 0, 0, 1], [1, 1, 0, 0]]


def rates(L=0.0, s=0.0):
    return {"L0": L, "L1": L, "s": s}


def test_quiet_loom_keeps_the_image():
    w = weave.sample(BITS, rates(0, 0), seed=3)
    for brow, row in zip(w.blocks, BITS):
        for b, bit in zip(brow, row):
            assert not b.failed and not b.flagged and b.syn == 0
            assert b.received == b.corrected == steane.codeword(bit)
            assert b.decoded == bit
    assert w.counts()["pixels_wrong"] == 0


def test_every_syndrome_points_at_the_flipped_thread():
    w = weave.sample(BITS, rates(0, 1.0), seed=5)
    for brow in w.blocks:
        for b in brow:
            assert b.flagged and 1 <= b.pos <= 7 and b.syn == b.pos
            diff = [i + 1 for i in range(7) if b.received[i] != b.sent[i]]
            assert diff == [b.pos]
            assert b.corrected == b.sent and b.decoded == b.bit


def test_logical_failures_invert_pixels():
    w = weave.sample(BITS, rates(1.0, 0), seed=5)
    assert w.counts()["failed"] == 12
    assert all(b.decoded == 1 - b.bit for r in w.blocks for b in r)


def test_turning_up_the_dial_only_adds_events():
    lo = weave.sample(BITS * 20, rates(0.05, 0.1), seed=9)
    hi = weave.sample(BITS * 20, rates(0.2, 0.6), seed=9)
    for rl, rh in zip(lo.blocks, hi.blocks):
        for a, b in zip(rl, rh):
            assert (not a.flagged) or b.flagged
            assert (not a.failed) or b.failed
            if a.flagged:
                assert a.pos == b.pos


def test_measured_codewords_hide_the_pixel_but_keep_parity():
    w = weave.sample(BITS * 10, rates(0, 0.3), seed=2, codewords="measured")
    seen = set()
    for r in w.blocks:
        for b in r:
            assert steane.syndrome(b.corrected) == 0
            assert steane.logical(b.corrected) == b.bit
            seen.add(tuple(b.corrected))
    assert len(seen) > 4


def test_drawdown_geometry_and_red_picks():
    w = weave.sample(BITS, rates(0, 0.5), seed=4)
    cells, weft = weave.drawdown(w, "received")
    assert len(cells) == 3 * weave.BAND and all(len(r) == 4 * 7 for r in cells)
    assert weft == ([weave.GROUND] * 6 + [weave.RED]) * 3
    for y, brow in enumerate(w.blocks):
        red = cells[y * 7 + 6]
        for x, b in enumerate(brow):
            seg = red[x * 7:(x + 1) * 7]
            assert seg.count(0) == (1 if b.syn else 0)
            if b.syn:
                assert seg[b.syn - 1] == 0
            code = cells[y * 7][x * 7:(x + 1) * 7]
            assert code == [1 - v for v in b.received]
    cc, _ = weave.drawdown(w, "corrected")
    for y, brow in enumerate(w.blocks):
        for x, b in enumerate(brow):
            assert cc[y * 7 + 2][x * 7:(x + 1) * 7] == [1 - v for v in b.corrected]


def test_bad_arguments():
    with pytest.raises(ValueError):
        weave.sample(BITS, rates(), codewords="nope")
    with pytest.raises(ValueError):
        weave.drawdown(weave.sample(BITS, rates()), "sideways")
