from itertools import product

from loom import steane


def test_columns_are_binary_positions():
    for j in range(1, 8):
        assert [steane.H[r][j - 1] for r in range(3)] == [(j >> r) & 1 for r in range(3)]


def test_codeword_cosets():
    assert len(steane.EVEN) == 8 and len(steane.ODD) == 8
    assert steane.EVEN[0] == [0] * 7 and steane.ODD[0] == [1] * 7
    assert sorted(sum(w) for w in steane.EVEN) == [0] + [4] * 7
    assert sorted(sum(w) for w in steane.ODD) == [3] * 7 + [7]
    for w in steane.EVEN + steane.ODD:
        assert steane.syndrome(w) == 0
    assert all(steane.logical(w) == 0 for w in steane.EVEN)
    assert all(steane.logical(w) == 1 for w in steane.ODD)
    # the 16 coset words are exactly the [7,4] Hamming code
    ham = [list(b) for b in product((0, 1), repeat=7) if steane.syndrome(b) == 0]
    assert len(ham) == 16


def test_single_flips_are_located_and_corrected():
    for bit in (0, 1):
        for k in range(8):
            w = steane.codeword(bit, k)
            for pos in range(1, 8):
                r = steane.flip(w, pos)
                assert steane.syndrome(r) == pos
                c, s = steane.correct(r)
                assert c == w and s == pos and steane.logical(c) == bit


def test_double_flip_miscorrects_to_wrong_coset():
    w = steane.codeword(0)
    r = steane.flip(steane.flip(w, 1), 2)
    c, _ = steane.correct(r)
    assert steane.syndrome(c) == 0 and steane.logical(c) == 1
