"""mulberry32: a tiny 32-bit PRNG with an exact JavaScript twin (web/template.html uses the same code),
so the page and the CLI weave the same cloth from the same seed. CLASSICAL pseudo-randomness."""

M32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & M32


class Mulberry32:
    def __init__(self, seed: int):
        self.a = int(seed) & M32

    def random(self) -> float:
        self.a = (self.a + 0x6D2B79F5) & M32
        t = self.a
        t = _imul(t ^ (t >> 15), t | 1)
        t ^= (t + _imul(t ^ (t >> 7), t | 61)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296.0
