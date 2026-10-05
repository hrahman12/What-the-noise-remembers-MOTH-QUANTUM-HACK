"""Author the Tweezer cast as ink pixel art and write web/sprites.json (common/SPRITES.md house style).

Every sprite is a list of frames; each frame is a list of equal-length strings, one char per pixel, in the shared
ink palette: K ink (outline), B ink-2, L ink-3, T tint, W paper, O warm accent (light / glow / fire only),
G good (success only), '.' transparent. All sprites have even width and height so integer scaling stays crisp.

Cast
  tweezy_*      the mascot: an atom held in an optical-tweezer beam (moods: idle, happy, meh, dizzy, sad, walk)
  atom, hot, ghost, beam, beam_hot, dot, pip     the array cast (a loaded tweezer, a Rydberg-excited atom, a site the
                camera wrongly called loaded, an empty tweezer, the moving tweezer, mini atoms)
  st_*          one illustrated station per stage of the day (16 x 16)
  chip, barrier, spark, check, cross, flame, pet_*, sun, moon, zz   props and reactions

Usage: python make_sprites.py [--preview out.png]
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"
PAL = {"K": "#19238E", "B": "#545BA9", "L": "#A1A4CE", "T": "#D3D3E6", "W": "#FBFAF9", "O": "#B4541A", "G": "#1F7A4D"}


class G:
    """A tiny pixel grid with drawing helpers (coordinates are pixel indices; circles use pixel centres)."""

    def __init__(self, w, h, rows=None):
        self.w, self.h = w, h
        self.a = [list(r) for r in rows] if rows else [["."] * w for _ in range(h)]

    def copy(self):
        return G(self.w, self.h, ["".join(r) for r in self.a])

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y][x] = c

    def get(self, x, y):
        return self.a[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.p(i, j, c)

    def box(self, x, y, w, h, c):
        for i in range(x, x + w):
            self.p(i, y, c)
            self.p(i, y + h - 1, c)
        for j in range(y, y + h):
            self.p(x, j, c)
            self.p(x + w - 1, j, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.p(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ell(self, cx, cy, rx, ry, c, where=None):
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (where is None or where(x, y)):
                    self.p(x, y, c)

    def disc(self, cx, cy, r, c, where=None):
        self.ell(cx, cy, r, r, c, where)

    def outline(self, c="K", inside=None):
        """Ink every transparent pixel that touches (4-neighbour) a filled pixel."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.a[y][x] == "." and any(self.get(x + dx, y + dy) not in "." for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add:
            self.p(x, y, c)

    def put(self, rows, x=0, y=0, keep="."):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in keep:
                    self.p(x + i, y + j, ch)

    def flipx(self):
        return G(self.w, self.h, ["".join(reversed(r)) for r in self.a])

    def rows(self):
        return ["".join(r) for r in self.a]


def check(name, frames):
    w, h = len(frames[0][0]), len(frames[0])
    assert w % 2 == 0 and h % 2 == 0, f"{name}: {w}x{h} is not even"
    for f in frames:
        assert len(f) == h and all(len(r) == w for r in f), f"{name}: ragged frame"
        assert all(ch in "KBLTWOG." for r in f for ch in r), f"{name}: bad char"


# ===================================================================== the mascot: Tweezy, an atom in a tweezer beam
BEAM_TOP = [".LTTTTTTTTTTTTL.", "..LTTTTTTTTTTL..", "...LTTTTTTTTL...", "....LTTTTTTL...."]
BEAM_BOT = ["....LTTTTTTL....", "...LTTTTTTTTL...", "..LTTTTTTTTTTL..", ".LTTTTTTTTTTTTL."]
ATOM = [".....KKKKKK.....",
        "....KWWLLLLK....",
        "...KWLLLLLLBK...",
        "...KLLLLLLLBK...",
        "...KLLLLLLLBK...",
        "...KLLLLLLLBK...",
        "...KLLLLLLLBK...",
        "...KBLLLLLLBK...",
        "....KBBBBBBK....",
        ".....KKKKKK....."]
# faces: pixel lists in atom-local coordinates (x = column of the 16-wide sprite, y = atom row 0..9)
FACE = {
    "idle": [(5, 3, "K"), (5, 4, "K"), (10, 3, "K"), (10, 4, "K"), (6, 6, "K"), (9, 6, "K"), (7, 7, "K"), (8, 7, "K")],
    "blink": [(5, 4, "K"), (6, 4, "K"), (9, 4, "K"), (10, 4, "K"), (6, 6, "K"), (9, 6, "K"), (7, 7, "K"), (8, 7, "K")],
    "happy": [(5, 3, "K"), (4, 4, "K"), (6, 4, "K"), (10, 3, "K"), (9, 4, "K"), (11, 4, "K"),
              (6, 6, "K"), (7, 6, "K"), (8, 6, "K"), (9, 6, "K"), (7, 7, "K"), (8, 7, "K"), (7, 6, "B"), (8, 6, "B")],
    "meh": [(5, 3, "K"), (5, 4, "K"), (10, 3, "K"), (10, 4, "K"), (7, 7, "K"), (8, 7, "K"), (6, 7, "K"), (9, 7, "K")],
    "dizzy": [(5, 3, "K"), (4, 4, "K"), (6, 4, "K"), (5, 5, "K"), (10, 3, "K"), (9, 4, "K"), (11, 4, "K"), (10, 5, "K"),
              (6, 7, "K"), (7, 6, "K"), (8, 7, "K"), (9, 6, "K")],
    "sad": [(6, 2, "K"), (9, 2, "K"), (5, 4, "K"), (10, 4, "K"), (7, 6, "K"), (8, 6, "K"), (6, 7, "K"), (9, 7, "K")],
    "sleep": [(4, 4, "K"), (5, 4, "K"), (10, 4, "K"), (11, 4, "K"), (7, 7, "K"), (8, 7, "K")],
}


def tweezy(face="idle", dy=0, dx=0, extra=()):
    g = G(16, 20)
    g.put(BEAM_TOP, 0, 0)
    g.put(BEAM_BOT, 0, 14)
    g.put(["....TLLLLLLT...."], 0, 19)         # the spot of light on the floor
    a = G(16, 10, ATOM)
    for x, y, c in FACE[face]:
        a.p(x, y, c)
    g.put([("." * max(0, dx)) + r[:16 - max(0, dx)] if dx >= 0 else r[-dx:] + "." * (-dx) for r in a.rows()], 0, 4 + dy)
    for x, y, c in extra:
        g.p(x, y, c)
    return g.rows()


SPARK_A = [(1, 5, "O"), (0, 6, "O"), (2, 6, "O"), (1, 7, "O"), (14, 10, "O"), (13, 11, "O"), (15, 11, "O"), (14, 12, "O")]
SPARK_B = [(14, 4, "O"), (13, 5, "O"), (15, 5, "O"), (14, 6, "O"), (1, 11, "O"), (0, 12, "O"), (2, 12, "O"), (1, 13, "O")]
SWEAT = [(13, 5, "L"), (13, 6, "L"), (14, 6, "L")]
ZZ_A = [(11, 0, "K"), (12, 0, "K"), (13, 0, "K"), (14, 0, "K"), (13, 1, "K"), (12, 2, "K"), (11, 3, "K"), (12, 3, "K"),
        (13, 3, "K"), (14, 3, "K")]
ZZ_B = [(12, 1, "K"), (13, 1, "K"), (14, 1, "K"), (15, 1, "K"), (14, 2, "K"), (13, 3, "K"), (12, 4, "K"), (13, 4, "K"),
        (14, 4, "K"), (15, 4, "K")]

S = {}
S["tweezy"] = {"frames": [tweezy("idle"), tweezy("idle", 1), tweezy("idle"), tweezy("blink")], "fps": 3}
S["tweezy_happy"] = {"frames": [tweezy("happy", 0, 0, SPARK_A), tweezy("happy", -1, 0, SPARK_B)], "fps": 4}
S["tweezy_meh"] = {"frames": [tweezy("meh"), tweezy("meh", 1), tweezy("meh"), tweezy("blink")], "fps": 3}
S["tweezy_dizzy"] = {"frames": [tweezy("dizzy", 0, -1), tweezy("dizzy", 0, 1)], "fps": 4}
S["tweezy_sad"] = {"frames": [tweezy("sad", 1, 0, SWEAT), tweezy("sad", 1, 0, [(13, 6, "L"), (13, 7, "L"), (14, 7, "L")])], "fps": 2}
S["tweezy_sleep"] = {"frames": [tweezy("sleep", 1, 0, ZZ_A), tweezy("sleep", 1, 0, ZZ_B)], "fps": 2}
S["tweezy_walk"] = {"frames": [tweezy("idle", -1), tweezy("idle", 1)], "fps": 8}

# ===================================================================== the array cast
S["atom"] = {"frames": [["..KKKK..",
                         ".KWLLLK.",
                         "KWLLLLBK",
                         "KLKLLKBK",
                         "KLLLLLBK",
                         "KLKLLKBK",
                         ".KBKKBK.",
                         "..KKKK.."]], "fps": 1}


def hot(frame):
    g = G(12, 12)
    if frame == 0:
        g.disc(5.5, 5.5, 5.9, "O")
        g.disc(5.5, 5.5, 4.9, ".")
    else:
        for x, y in ((5, 0), (6, 0), (0, 5), (0, 6), (11, 5), (11, 6), (5, 11), (6, 11), (1, 1), (10, 1), (1, 10), (10, 10),
                     (2, 2), (9, 2), (2, 9), (9, 9)):
            g.p(x, y, "O")
    g.put(["..KKKK..", ".KWWLLK.", "KWLLLLBK", "KLKLLKBK", "KLKLLKBK", "KLLKKLBK", ".KBKKBK.", "..KKKK.."], 2, 2)
    return g.rows()


S["hot"] = {"frames": [hot(0), hot(1)], "fps": 4}
S["ghost"] = {"frames": [["..LLLL..",
                          ".LWWWWL.",
                          "LWWWWWWL",
                          "LWKWWKWL",
                          "LWKWWKWL",
                          "LWWWWWWL",
                          "LWWKKWWL",
                          "LWWWWWWL",
                          "LL.LL.LL",
                          "........"],
                         ["........",
                          "..LLLL..",
                          ".LWWWWL.",
                          "LWWWWWWL",
                          "LWKWWKWL",
                          "LWKWWKWL",
                          "LWWWWWWL",
                          "LWWKKWWL",
                          "LWWWWWWL",
                          ".LL.LL.L"]], "fps": 3}
S["beam"] = {"frames": [["........", "..TTTT..", "...TT...", "...LL...", "...LL...",
                         "...LL...", "...LL...", "...TT...", "..TTTT..", "........"]], "fps": 1}
S["beam_hot"] = {"frames": [[".LTTTTL.", "..LTTL..", "...LL...", "...OO...", "...OO...",
                             "...OO...", "...OO...", "...LL...", "..LTTL..", ".LTTTTL."]], "fps": 1}
S["dot"] = {"frames": [[".KK.", "KWLK", "KLBK", ".KK."]], "fps": 1}
S["dot_hot"] = {"frames": [[".OO.", "OKKO", "OKKO", ".OO."]], "fps": 1}
S["pip"] = {"frames": [[".LL.", "L..L", "L..L", ".LL."]], "fps": 1}

# ===================================================================== stations (16 x 16), one per stage of the day


def coin(face):
    g = G(16, 16)
    if face in ("heads", "tails"):
        g.disc(7.5, 7.5, 7.6, "K")
        g.disc(7.5, 7.5, 6.6, "L")
        g.disc(7.5, 7.5, 6.6, "B", where=lambda x, y: x + y >= 18)
        g.disc(7.5, 7.5, 6.6, "W", where=lambda x, y: x + y <= 6)
        g.disc(7.5, 7.5, 4.7, "B")
        g.disc(7.5, 7.5, 3.8, "L")
        if face == "heads":            # an atom face in the middle: a loaded tweezer
            g.disc(7.5, 7.5, 3.2, "K")
            g.disc(7.5, 7.5, 2.2, "W")
            g.p(6, 7, "K")
            g.p(9, 7, "K")
            g.rect(7, 9, 2, 1, "K")
        else:                          # tails: an empty ring, an empty tweezer
            g.disc(7.5, 7.5, 2.6, "T")
            g.disc(7.5, 7.5, 1.6, "L")
    elif face == "tilt":
        g.ell(7.5, 8.5, 7.6, 4.2, "K")
        g.ell(7.5, 7.5, 6.6, 3.0, "L")
        g.ell(7.5, 7.5, 4.0, 1.6, "B")
        g.rect(1, 9, 14, 1, "B")
    else:                              # edge on
        g.rect(0, 6, 16, 4, "K")
        g.rect(1, 7, 14, 2, "B")
        g.rect(2, 7, 4, 1, "L")
    return g.rows()


S["st_coin"] = {"frames": [coin("heads"), coin("tilt"), coin("edge"), coin("tilt"), coin("tails"), coin("tilt"), coin("edge"), coin("tilt")], "fps": 10}


def hopper(k):
    g = G(16, 16)
    g.put(["KKKKKKKKKKKKKKKK",
           "KLBLLLBLLBLLLBLK",
           ".KLLBLLLLLLBLLK.",
           "..KLLLLBLLLLLK..",
           "...KLLLLLLLLK...",
           "....KLLLLLLK....",
           ".....KLLLLK.....",
           "......K..K......"], 0, 0)
    g.put(["KKKKKKKKKKKKKKKK",
           "K....K....K....K",
           "K....K....K....K",
           "K....K....K....K",
           "KKKKKKKKKKKKKKKK"], 0, 11)
    for x in (2, 12):
        g.rect(x, 12, 2, 2, "B")
    if k == 0:
        g.rect(7, 8, 2, 2, "B")
    elif k == 1:
        g.rect(7, 10, 2, 1, "B")
        g.rect(7, 11, 2, 1, "B")
    else:
        g.rect(7, 12, 2, 2, "B")
    return g.rows()


S["st_load"] = {"frames": [hopper(0), hopper(1), hopper(2)], "fps": 4}


def film(k):
    g = G(16, 16)
    g.rect(2, 0, 12, 16, "K")
    for y in range(1, 16, 3):
        g.p(3, y, "W")
        g.p(12, y, "W")
    for y0 in (1, 9):
        g.rect(5, y0, 6, 6, "T")
    pats = [[(5, 1), (8, 1), (6, 4), (9, 4)], [(6, 1), (9, 1), (5, 4), (8, 4)]]
    for y0, pat in ((1, pats[k]), (9, pats[1 - k])):
        for x, y in pat:
            g.rect(x, y0 + y, 2, 1, "B")
            g.rect(x, y0 + y - 0, 1, 1, "K")
    return g.rows()


S["st_film"] = {"frames": [film(0), film(1)], "fps": 4}


def glass():
    g = G(16, 16)
    g.box(5, 1, 10, 10, "L")
    g.rect(1, 5, 10, 10, "T")
    g.line(1, 5, 5, 1, "L")
    g.line(10, 5, 14, 1, "L")
    g.line(10, 14, 14, 10, "L")
    g.box(1, 5, 10, 10, "K")
    g.line(3, 12, 8, 7, "W")
    g.line(4, 13, 9, 8, "W")
    for x, y in ((0, 10), (1, 10), (2, 10), (3, 9), (4, 9), (5, 9), (6, 8), (7, 8), (8, 8), (9, 7), (10, 7), (11, 6),
                 (12, 6), (13, 5), (14, 5), (15, 4)):
        g.p(x, y, "O")
    return g.rows()


S["st_glass"] = {"frames": [glass()], "fps": 1}


def camera(flash):
    g = G(16, 16)
    g.rect(0, 5, 16, 10, "K")
    g.rect(1, 6, 14, 8, "B")
    g.rect(1, 6, 14, 1, "L")
    g.rect(2, 3, 5, 2, "K")
    g.rect(3, 4, 3, 1, "B")
    g.rect(11, 3, 4, 2, "K")
    g.rect(12, 3, 2, 1, "O" if flash else "W")
    g.disc(8.5, 10, 4.3, "K")
    g.disc(8.5, 10, 3.3, "L")
    g.disc(8.5, 10, 2.3, "B")
    g.disc(8.5, 10, 1.2, "K")
    g.p(7, 8, "W")
    g.p(6, 9, "W")
    if flash:
        for x, y in ((12, 0), (13, 0), (10, 1), (15, 1), (9, 2)):
            g.p(x, y, "O")
    return g.rows()


S["st_camera"] = {"frames": [camera(False), camera(True)], "fps": 2}


def fryer(k):
    g = G(16, 16)
    fl = [["...O.....O..", "..OO....OO..", "..OOO..OOO..", ".OOOO..OOOO.", ".OOWOOOOOWO.", "OOOWOOOOWOOO", ".OOOOOOOOOO."],
          ["....O...O...", "...OO...OO..", "..OOO..OOO..", "..OOOO.OOOO.", ".OOOWOOOOWO.", ".OOWOOOOWOOO", ".OOOOOOOOOO."]][k]
    g.put(fl, 1, 2)
    g.ell(6.5, 10, 6.6, 2.4, "K")
    g.ell(6.5, 9.7, 5.4, 1.3, "B")
    g.p(4, 9, "W")
    g.p(8, 10, "L")
    g.rect(1, 11, 12, 2, "K")
    g.rect(2, 13, 10, 1, "K")
    g.rect(2, 11, 10, 1, "B")
    g.rect(12, 10, 4, 2, "K")
    return g.rows()


S["st_fryer"] = {"frames": [fryer(0), fryer(1)], "fps": 4}


def scanner():
    g = G(16, 16)
    g.rect(0, 1, 16, 11, "K")
    g.rect(1, 2, 14, 9, "T")
    for j in range(3):
        for i in range(4):
            if (i + j) % 2 == 0:
                g.rect(2 + 3 * i, 3 + 3 * j, 3, 2, "B")
    g.rect(6, 12, 4, 2, "K")
    g.rect(3, 14, 10, 2, "K")
    g.rect(4, 14, 8, 1, "B")
    return g.rows()


S["st_scan"] = {"frames": [scanner()], "fps": 1}


def clipboard(k):
    g = G(16, 16)
    g.rect(1, 2, 14, 14, "K")
    g.rect(2, 3, 12, 12, "B")
    g.rect(3, 4, 10, 11, "W")
    g.rect(5, 0, 6, 4, "K")
    g.rect(6, 1, 4, 2, "L")
    marks = ["ok", "ok", "no", "ok"] if k == 0 else ["ok", "no", "ok", "ok"]
    for j, m in enumerate(marks):
        y = 5 + 2 * j + (j > 1)
        if m == "ok":
            g.p(4, y, "K"); g.p(5, y + 1, "K"); g.p(6, y, "K"); g.p(7, y - 1, "K")
        else:
            g.p(4, y - 1, "K"); g.p(6, y - 1, "K"); g.p(5, y, "K"); g.p(4, y + 1, "K"); g.p(6, y + 1, "K")
        g.rect(9, y, 3, 1, "L")
    for x, y in ((14, 0), (15, 1), (13, 1)):
        g.p(x, y, "O")
    return g.rows()


S["st_counter"] = {"frames": [clipboard(0), clipboard(1)], "fps": 2}
S["st_maze"] = {"frames": [["KKKKKKKKKKKKKKKK",
                            "K...........K..K",
                            "K.KKKKKKKKK.K..K",
                            "K.K.........K..K",
                            "K.K.KKKKKKKKK..K",
                            "K.K.K..........K",
                            "K...K.KKKKKKKK.K",
                            "KKKKK.K......K.K",
                            "K.....K.KKKK.K.K",
                            "K.KKKKK.K..K.K.K",
                            "K.K.....K..K...K",
                            "K.K.KKKKK..KKKKK",
                            "K.K.K..........K",
                            "K...K.KKKKKKKK.K",
                            "KBB.K........K.K",
                            "KKKKKKKKKKKKKKKK"]], "fps": 1}


def conveyor(k):
    g = G(16, 16)
    g.put(["....LTTTTTL.....", ".....LTTTL......", "......LTL......."], 1, 0)
    g.disc(7.5, 6.5, 3.4, "K")
    g.disc(7.5, 6.5, 2.4, "L")
    g.p(6, 5, "W")
    g.p(6, 6, "K")
    g.p(9, 6, "K")
    g.rect(0, 10, 16, 5, "K")
    g.rect(1, 11, 14, 3, "B")
    g.rect(1, 11, 14, 1, "L")
    for x in (2 + k, 7 + k, 12 + k):
        g.rect(x, 12, 2, 2, "L")
        g.p(x, 13, "K")
    for x in (0, 1, 2):
        g.p(x, 6 + (x % 2), "B")
    g.p(14, 6, "K")
    g.p(15, 7, "K")
    g.p(14, 8, "K")
    return g.rows()


S["st_conveyor"] = {"frames": [conveyor(0), conveyor(1)], "fps": 4}


def rydberg(k):
    g = G(16, 16)
    if k == 0:
        g.disc(7.5, 7.5, 7.6, "O")
        g.disc(7.5, 7.5, 6.6, ".")
        g.disc(7.5, 7.5, 6.6, ".")
    else:
        for x, y in ((7, 0), (8, 0), (7, 15), (8, 15), (0, 7), (0, 8), (15, 7), (15, 8), (2, 2), (13, 2), (2, 13), (13, 13),
                     (3, 3), (12, 3), (3, 12), (12, 12), (7, 2), (8, 2), (2, 7), (2, 8), (13, 7), (13, 8), (7, 13), (8, 13)):
            g.p(x, y, "O")
    g.disc(7.5, 7.5, 4.6, "K")
    g.disc(7.5, 7.5, 3.6, "L")
    g.disc(7.5, 7.5, 3.6, "W", where=lambda x, y: x + y <= 11)
    g.disc(7.5, 7.5, 3.6, "B", where=lambda x, y: x + y >= 19)
    g.p(6, 7, "K")
    g.p(9, 7, "K")
    g.rect(7, 9, 2, 1, "K")
    return g.rows()


S["st_rydberg"] = {"frames": [rydberg(0), rydberg(1)], "fps": 3}


def tama(k):
    g = G(16, 16)
    g.ell(7.5, 8, 6.9, 7.9, "K")
    g.ell(7.5, 8, 5.9, 6.9, "L")
    g.ell(7.5, 8, 5.9, 6.9, "B", where=lambda x, y: x >= 11 and y >= 9)
    g.rect(3, 4, 10, 7, "K")
    g.rect(4, 5, 8, 5, "T")
    px = [(6, 6), (7, 6), (8, 6), (9, 6), (6, 7), (9, 7), (6, 8), (7, 8), (8, 8), (9, 8), (6, 9), (9, 9)]
    for x, y in px:
        g.p(x + (1 if k else 0), y - (1 if k else 0) + 0, "B")
    g.p(7 + k, 7 - k, "K")
    g.p(8 + k, 7 - k, "W")
    for x in (5, 7, 10):
        g.p(x, 13, "K")
    return g.rows()


S["st_tama"] = {"frames": [tama(0), tama(1)], "fps": 2}


def score(k):
    g = G(16, 16)
    for y in (3, 6, 9, 12, 15):
        g.rect(0, y, 16, 1, "T")
    g.ell(3.5, 12 - k, 2.1, 1.4, "K")
    g.ell(11.5, 10 - k, 2.1, 1.4, "K")
    g.rect(5, 2 - k, 1, 10, "K")
    g.rect(13, 1 - k, 1, 9, "K")
    g.line(5, 2 - k, 13, 1 - k, "K")
    g.line(5, 3 - k, 13, 2 - k, "K")
    return g.rows()


S["st_score"] = {"frames": [score(0), score(1)], "fps": 3}


def echo(k):
    g = G(16, 16)
    g.rect(0, 6, 3, 4, "K")
    g.rect(1, 7, 1, 2, "B")
    for i, x in enumerate(range(3, 7)):
        g.rect(x, 5 - i, 1, 6 + 2 * i, "K")
    g.rect(4, 5, 1, 6, "B")
    g.rect(5, 4, 1, 8, "L")
    for r, on in ((4.6, k == 0), (7.0, True), (9.4, k == 1)):
        for y in range(16):
            for x in range(8, 16):
                d = math.hypot(x - 6, y - 7.5)
                if abs(d - r) < 0.55 and abs(y - 7.5) < r * 0.8:
                    g.p(x, y, "K" if on else "L")
    return g.rows()


S["st_echo"] = {"frames": [echo(0), echo(1)], "fps": 3}


def calib(k):
    g = G(16, 16)
    g.rect(0, 3, 16, 11, "K")
    g.rect(1, 4, 14, 8, "B")
    for x in range(1, 15):
        y = int(round(7.5 + 2.6 * math.sin((x + 2 * k) / 14 * 2 * math.pi * 1.5)))
        g.p(x, y, "W")
        g.p(x, y + 1, "T")
    g.rect(2, 13, 3, 2, "L")
    g.rect(11, 13, 3, 2, "L")
    g.rect(6, 13, 4, 1, "K")
    g.rect(6, 14, 4, 2, "B")
    return g.rows()


S["st_calib"] = {"frames": [calib(0), calib(1)], "fps": 3}
S["st_disk"] = {"frames": [["KKKKKKKKKKKKKK..",
                            "KBBKLLLLLLLKBKK.",
                            "KBBKLLLLBBLKBBKK",
                            "KBBKLLLLBBLKBBBK",
                            "KBBKLLLLBBLKBBBK",
                            "KBBKLLLLLLLKBBBK",
                            "KBBBKKKKKKKBBBBK",
                            "KBBBBBBBBBBBBBBK",
                            "KBWWWWWWWWWWWWBK",
                            "KBWTTTTTTTTTTWBK",
                            "KBWWWWWWWWWWWWBK",
                            "KBWTTTTTTTTWWWBK",
                            "KBWWWWWWWWWWWWBK",
                            "KBWWWWWWWWWWWWBK",
                            "KBWWWWWWWWWWWWBK",
                            "KKKKKKKKKKKKKKKK"]], "fps": 1}


def lens():
    g = G(16, 16)
    g.disc(6, 6, 5.7, "K")
    g.disc(6, 6, 4.4, "T")
    g.disc(6, 6, 4.4, "W", where=lambda x, y: x + y <= 8)
    for i in range(5):
        g.rect(10 + i, 10 + i, 2, 2, "K")
    g.rect(12, 12, 1, 1, "B")
    g.rect(13, 13, 1, 1, "B")
    return g.rows()


S["st_lens"] = {"frames": [lens()], "fps": 1}


def reels(k):
    g = G(16, 16)
    for cx in (3.5, 11.5):
        g.disc(cx, 5, 3.6, "K")
        g.disc(cx, 5, 2.6, "L")
        g.disc(cx, 5, 1.0, "K")
        sp = [(0, -2), (2, 1), (-2, 1)] if k == 0 else [(0, 2), (2, -1), (-2, -1)]
        for dx, dy in sp:
            g.p(int(cx + 0.5) + dx - (1 if dx > 0 else 0), 5 + dy, "B")
    g.rect(3, 9, 9, 1, "B")
    g.rect(0, 11, 16, 5, "K")
    g.rect(1, 12, 14, 3, "B")
    g.rect(3, 13, 2, 1, "W")
    g.rect(7, 13, 2, 1, "L")
    g.rect(11, 13, 2, 1, "L")
    return g.rows()


S["st_reel"] = {"frames": [reels(0), reels(1)], "fps": 3}

# ===================================================================== props and reactions
S["chip"] = {"frames": [[".K.K.K..",
                         "KKKKKKK.",
                         ".KBBBK..",
                         "KKBWBKK.",
                         ".KBBBK..",
                         "KKKKKKK.",
                         ".K.K.K..",
                         "........"]], "fps": 1}
S["barrier"] = {"frames": [["KKKKKKKKKKKKKKKK",
                            "KWWKKWWKKWWKKWWK",
                            "KWKKWWKKWWKKWWKK",
                            "KKKKKKKKKKKKKKKK",
                            ".K............K.",
                            ".K............K."]], "fps": 1}
S["spark"] = {"frames": [["..OO..", "..OO..", "OOWWOO", "OOWWOO", "..OO..", "..OO.."],
                         ["......", "..OO..", ".OWWO.", ".OWWO.", "..OO..", "......"]], "fps": 6}
S["check"] = {"frames": [[".....G", "....GG", "G..GG.", "GGGG..", ".GG...", "......"]], "fps": 1}
S["cross"] = {"frames": [["KK..KK", "KKKKKK", ".KKKK.", ".KKKK.", "KKKKKK", "KK..KK"]], "fps": 1}
S["flame"] = {"frames": [["..O...", "..OO..", ".OOO..", ".OOOO.", "OOWOOO", "OOWWOO", ".OOOO.", "..OO.."],
                         ["...O..", "..OO..", "..OOO.", ".OOOO.", "OOOWOO", "OOWWOO", ".OOOO.", "..OO.."]], "fps": 6}


def pet(mood, bob=0):
    g = G(10, 10)
    body = ["..KKKKKK..", ".KLLLLLLK.", "KLLLLLLLLK", "KLLLLLLLLK", "KLLLLLLLLK", "KLLLLLLLBK", "KBLLLLLBBK", ".KBBBBBBK."]
    g.put(body, 0, 1 - bob)
    y = 1 - bob
    if mood == "happy":
        for x, yy in ((2, 3), (3, 2), (4, 3), (5, 3), (6, 2), (7, 3)):
            pass
        g.p(3, y + 2, "K"); g.p(2, y + 3, "K"); g.p(4, y + 3, "K")
        g.p(6, y + 2, "K"); g.p(5, y + 3, "K"); g.p(7, y + 3, "K")
        g.rect(3, y + 5, 4, 1, "K"); g.rect(4, y + 6, 2, 1, "K")
    elif mood == "ok":
        g.rect(3, y + 2, 1, 2, "K"); g.rect(6, y + 2, 1, 2, "K")
        g.rect(4, y + 5, 2, 1, "K")
    else:
        g.p(3, y + 3, "K"); g.p(6, y + 3, "K")
        g.p(2, y + 2, "K"); g.p(7, y + 2, "K")
        g.rect(4, y + 5, 2, 1, "K"); g.p(3, y + 6, "K"); g.p(6, y + 6, "K")
        g.p(1, y + 4, "T")
    g.rect(2, 9, 2, 1, "K")
    g.rect(6, 9, 2, 1, "K")
    return g.rows()


S["pet_happy"] = {"frames": [pet("happy", 0), pet("happy", 1)], "fps": 3}
S["pet_ok"] = {"frames": [pet("ok", 0), pet("ok", 0), pet("ok", 1)], "fps": 2}
S["pet_sad"] = {"frames": [pet("sad", 0)], "fps": 1}


def sun():
    g = G(10, 10)
    g.disc(4.5, 4.5, 2.8, "O")
    for x, y in ((4, 0), (5, 0), (4, 9), (5, 9), (0, 4), (0, 5), (9, 4), (9, 5), (1, 1), (8, 1), (1, 8), (8, 8)):
        g.p(x, y, "O")
    g.p(3, 3, "W")
    return g.rows()


def moon():
    g = G(10, 10)
    g.disc(4.5, 4.5, 4.4, "L")
    g.disc(6.5, 3.2, 3.9, ".")
    g.outline("K")
    return g.rows()


S["sun"] = {"frames": [sun()], "fps": 1}
S["moon"] = {"frames": [moon()], "fps": 1}

for name, d in S.items():
    check(name, d["frames"])


def preview(path, scale=6):
    from PIL import Image, ImageDraw
    pad, x, y, rowh = 10, 10, 10, 0
    width = 1400
    items = [(n, f, fr) for n, d in S.items() for f, fr in enumerate(d["frames"])]
    pos = []
    for n, f, fr in items:
        w, h = len(fr[0]) * scale, len(fr) * scale
        if x + w > width - pad:
            x, y = pad, y + rowh + 22
            rowh = 0
        pos.append((x, y, n, f, fr))
        x += w + 14
        rowh = max(rowh, h)
    img = Image.new("RGB", (width, y + rowh + 30), (251, 250, 249))
    dr = ImageDraw.Draw(img)
    for x, y, n, f, fr in pos:
        for j, r in enumerate(fr):
            for i, ch in enumerate(r):
                if ch in PAL:
                    dr.rectangle([x + i * scale, y + j * scale, x + (i + 1) * scale - 1, y + (j + 1) * scale - 1], fill=PAL[ch])
        dr.text((x, y + len(fr) * scale + 2), f"{n}:{f}", fill=(84, 91, 169))
    img.save(path)
    print("preview", path, img.size)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    a = ap.parse_args()
    OUT.write_text(json.dumps(S, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT}: {len(S)} sprites, {sum(len(d['frames']) for d in S.values())} frames")
    if a.preview:
        preview(a.preview)
