"""Orbium unicaudatus, the seed creature. CLASSICAL data.

Pattern from Bert Chan's Lenia repository, Python/animals.json (code "O2u"), MIT License,
Copyright (c) 2018 Bert Chan: https://github.com/Chakazul/Lenia. Decoded from Lenia's RLE format
(values / 255). `python orbium.py` re-checks that it glides under lenia.py's rule and writes orbium.npy.
"""
import re
import numpy as np

RLE = ("7.MD6.qL$6.pKqEqFURpApBRAqQ$5.VqTrSsBrOpXpWpTpWpUpCrQ$4.CQrQsTsWsApITNPpGqGvL$3.IpIpWrOsGsBqXpJ4.LsFrL$"
       "A.DpKpSpJpDqOqUqSqE5.ExD$qL.pBpTT2.qCrGrVrWqM5.sTpP$.pGpWpD3.qUsMtItQtJ6.tL$.uFqGH3.pXtOuR2vFsK5.sM$"
       ".tUqL4.GuNwAwVxBwNpC4.qXpA$2.uH5.vBxGyEyMyHtW4.qIpL$2.wV5.tIyG3yOxQqW2.FqHpJ$2.tUS4.rM2yOyJyOyHtVpPMpFqNV$"
       "2.HsR4.pUxAyOxLxDxEuVrMqBqGqKJ$3.sLpE3.pEuNxHwRwGvUuLsHrCqTpR$3.TrMS2.pFsLvDvPvEuPtNsGrGqIP$"
       "4.pRqRpNpFpTrNtGtVtStGsMrNqNpF$5.pMqKqLqRrIsCsLsIrTrFqJpHE$6.RpSqJqPqVqWqRqKpRXE$8.OpBpIpJpFTK!")


def ch2val(c):
    if c in ".b":
        return 0
    if c == "o":
        return 255
    if len(c) == 1:
        return ord(c) - ord("A") + 1
    return (ord(c[0]) - ord("p")) * 24 + (ord(c[1]) - ord("A") + 25)


def decode(rle=RLE):
    rows = []
    for line in rle.rstrip("!").split("$"):
        row = []
        for n, tok in re.findall(r"(\d*)([p-y]?[A-X.bo])", line):
            row += [ch2val(tok)] * (int(n) if n else 1)
        rows.append(row)
    w = max(len(r) for r in rows)
    return np.array([r + [0] * (w - len(r)) for r in rows], dtype=float) / 255


if __name__ == "__main__":
    from scipy import ndimage
    import lenia as L
    C = decode()
    print("cells", C.shape, "max", C.max().round(3), "mass", C.sum().round(2))
    N = 128
    A = np.zeros((N, N)); A[54:54 + C.shape[0], 54:54 + C.shape[1]] = C
    Kf = L.kernel_fft(L.kernel_world(N, "ring"))
    c0 = np.array(ndimage.center_of_mass(A))
    for t in range(1, 3001):
        A = L.step(A, Kf)
        if t % 500 == 0:
            print(t, "mass", A.sum().round(2), "centre", np.round(ndimage.center_of_mass(A), 1))
    np.save("orbium.npy", C.astype(np.float32))
