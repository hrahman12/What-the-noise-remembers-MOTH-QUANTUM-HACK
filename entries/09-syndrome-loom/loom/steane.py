"""The classical side of the Steane code: the [7,4] Hamming parity checks it is built from.

CLASSICAL. Nothing here is quantum. The Steane code's Z-type stabilizers are the rows of the
Hamming parity-check matrix H, so a computational-basis (Z) readout of a Steane block is a 7-bit
word that can be checked and corrected with ordinary Hamming decoding:

  * column j of H (1-indexed) is j written in binary, so a single flip on thread j gives syndrome j;
  * measuring logical |0> in Z returns one of the 8 even-weight Hamming codewords (uniformly),
    and logical |1> returns one of their 8 complements (the odd-weight codewords);
  * the logical bit is the parity of the 7 bits.

Bit order everywhere: position 1..7 = list index 0..6 = warp threads left to right inside a block.
"""
from __future__ import annotations

from itertools import product

N = 7

# H[r][j-1] = bit r of j  (r = 0 is the least significant bit)
H = [[(j >> r) & 1 for j in range(1, N + 1)] for r in range(3)]


def syndrome(word) -> int:
    """3-bit syndrome of a 7-bit word as an integer 0..7 (0 = no detected flip, else the flipped position)."""
    s = 0
    for r in range(3):
        if sum(H[r][i] & word[i] for i in range(N)) % 2:
            s |= 1 << r
    return s


def flip(word, pos):
    """Return a copy of word with thread `pos` (1..7) inverted; pos 0 is a no-op."""
    w = list(word)
    if pos:
        w[pos - 1] ^= 1
    return w


def correct(word):
    """Hamming decode: flip the thread the syndrome points at. Returns (corrected word, syndrome)."""
    s = syndrome(word)
    return flip(word, s), s


def logical(word) -> int:
    """Logical Z value of a (corrected) Steane readout = parity of the 7 bits."""
    return sum(word) % 2


def _codewords():
    words = [list(bits) for bits in product((0, 1), repeat=N) if syndrome(bits) == 0]
    words.sort(key=lambda w: sum(b << i for i, b in enumerate(w)))
    even = [w for w in words if sum(w) % 2 == 0]
    return even


EVEN = _codewords()                     # 8 words: Z-readouts of logical |0>; EVEN[0] = 0000000
ODD = [[1 - b for b in w] for w in EVEN]  # 8 words: Z-readouts of logical |1>; ODD[0] = 1111111


def codeword(bit: int, k: int = 0):
    """The k-th (0..7) codeword of the coset for logical `bit`. k = 0 is the plain word 0000000 / 1111111."""
    return list((ODD if bit else EVEN)[k])
