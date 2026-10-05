"""Author the pixel-art cast of Maxwell's Ribbon and write web/sprites.json (the one place the page and the
mascot read sprite pixels from). CLASSICAL (artwork only).

Palette (common/inksprite.js): K ink outline, B ink-2, L ink-3, T tint, W paper, O warm accent (light only:
the flash, the lamp, projected light), G success (unused). Two extra keys belong to the sitter only:
  C = the colour being photographed (the page fills it with the real picked / rebuilt colour at run time)
  c = a contrast ink on that colour (ink on pale colours, paper on dark ones), also set at run time.

Run: python make_sprites.py [--preview out.png]
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"


# ---------------------------------------------------------------- helpers
def mirror(left):
    """Left half rows -> symmetric rows (the left half, then its mirror)."""
    return [r + r[::-1] for r in left]


def pad(rows, l=0, r=0, t=0, b=0):
    w = len(rows[0]) + l + r
    out = ["." * w for _ in range(t)]
    out += ["." * l + row + "." * r for row in rows]
    out += ["." * w for _ in range(b)]
    return out


def patch(rows, x, y, p):
    """Overlay patch rows at (x, y). In the patch '?' keeps the pixel, '.' erases it, anything else sets it."""
    g = [list(r) for r in rows]
    for j, pr in enumerate(p):
        for i, ch in enumerate(pr):
            if ch == "?":
                continue
            yy, xx = y + j, x + i
            if 0 <= yy < len(g) and 0 <= xx < len(g[0]):
                g[yy][xx] = ch
    return ["".join(r) for r in g]


def blank(w, h):
    return ["." * w for _ in range(h)]


def crop(rows, x, y, w, h):
    return [r[x:x + w] for r in rows[y:y + h]]


def flipx(rows):
    return [r[::-1] for r in rows]


def even(rows):
    """Pad to even width and height so pixels stay on the grid when centred."""
    h, w = len(rows), len(rows[0])
    return pad(rows, r=w % 2, b=h % 2)


# ---------------------------------------------------------------- James Clerk Maxwell, 1861
# Chibi, facing us: dark parted hair, a full mid-ink beard, white high collar and black bow, light waistcoat, frock
# coat. The head and torso are drawn as a symmetric left half; arms are separate parts so poses stay clean.
MX_LEFT = [
    ".........KKKK",  # 0
    "......KKKKKKK",
    "....KKKBKKKKK",
    "...KKBKKKKBKK",
    "..KKKKKKKKKKK",
    "..KKBKKKKKKKK",  # 5
    ".KKKKKKKWWWWW",
    ".KKBKKWWWWWWW",
    ".KKKWWWWWWWWW",
    ".KKWWWKKKWWWW",  # 9 brow
    "KWKWWWWWWWWWW",  # 10 ear
    "KWKWWWWKKWWWW",  # 11 eye
    "KWKWWWWKKWWWW",
    ".KBWWTWWWWWWT",  # 13 cheek, nose
    ".KBBWWWWWWWTT",
    ".KBBBWWWWWWWW",  # 15
    ".KBBBBBBBBBBB",  # moustache
    ".KBBLBBBBBKKK",  # mouth
    ".KBBLBBBLBBBB",
    "..KBBBLBBLBBB",
    "..KBBBLBBBBBB",  # 20
    "...KBBBBBLBBB",
    "....KKBBBBLBB",
    "......KKKKKKK",  # 23 chin
    ".....KKKWWWKK",  # collar
    "....KBBKWWKKK",  # 25 bow tie
    "...KBBBBKWWWW",
    "...KBBBBBKLLW",  # lapel, waistcoat, shirt front
    "...KBBBBBBKLW",
    "...KBBBBBBKLW",
    "...KBBBBBBKLW",  # 30
    "...KBBBBBBBKL",
    "...KBBBBBBBBK",
    "...KBBBBBBBBB",
    "...KBBBBBBBBB",
    "....KBBBBBBBK",  # 35 coat tails
    ".....KBBBBBK.",
    "......KKKKK..",
    "......KKBK...",  # trousers
    "......KKBK...",
    ".....KKKKK...",  # 40 shoes
    "....KKKKKK...",
]
MXW, MXH, MX0X, MX0Y = 34, 44, 4, 2
MX = pad(mirror(MX_LEFT), l=MX0X, r=MX0X, t=MX0Y)   # 34 x 44
MX = patch(MX, MX0X + 15, MX0Y + 2, ["BB"])           # the parting
MX = patch(MX, MX0X + 6, MX0Y + 4, ["?B"])

EYE_L, EYE_R, EYE_Y = MX0X + 7, MX0X + 17, MX0Y + 11


def eyes(f, kind):
    if kind == "shut":
        for x in (EYE_L, EYE_R):
            f = patch(f, x, EYE_Y, ["WW", "KK"])
    elif kind == "happy":
        for x in (EYE_L, EYE_R):
            f = patch(f, x - 1, EYE_Y - 1, ["?KK?", "K??K", "WWWW"])
            f = patch(f, x, EYE_Y, ["WW", "WW"])
    return f


def mouth(f, kind):
    x, y = MX0X + 10, MX0Y + 17
    if kind == "smile":
        f = patch(f, x, y, ["K????K", "?KWWK?", "??KK??"])
    elif kind == "side":
        f = patch(f, x, y, ["BBBKKK"])
    elif kind == "o":
        f = patch(f, x + 1, y - 1, ["?KK?", "KWWK", "?KK?"])
        f = patch(f, x, y, ["B????B"])
    return f


def brows(f, kind):
    if kind == "raise":   # the right brow goes up
        f = patch(f, MX0X + 16, MX0Y + 9, ["WWW"])
        f = patch(f, MX0X + 16, MX0Y + 8, ["KKK"])
    elif kind == "worry":  # inner ends up
        f = patch(f, MX0X + 6, MX0Y + 9, ["KWW"])
        f = patch(f, MX0X + 8, MX0Y + 8, ["K"])
        f = patch(f, MX0X + 17, MX0Y + 9, ["WWK"])
        f = patch(f, MX0X + 17, MX0Y + 8, ["K"])
    return f


# arms: parts for the LEFT side of the picture (Maxwell's right arm); the right side uses the mirror image
ARM_DOWN = [".KKK", "KBBK", "KBBK", "KBBK", "KBBK", "KBBK", "KBBK", "KBBK", "KWWK", "KWWK", ".KK."]
BULB = ["KKKK", "KBBK", "KBLK", "KBBK", ".KK."]
ARM_UP = ["..KK.", ".KWWK", ".KWWK", ".KBBK", ".KBBK", "KBBK.", "KBBK.", "KBBK.", "KBBK.", "KBBK.", ".KBBK",
          "..KBK", "...KK"]
ARM_SQUEEZE = [".KKK....", "KBBK....", "KBBK....", "KBBK....", "KBBKKKK.", "KBBBBBBK", ".KBBBWWK", "..KKKWWK",
               ".....KK."]
ARM_CHIN = [".KKK.....", "KBBK.....", "KBBK.....", "KBBK.....", "KBBK...KK", "KBBK..KWWK", "KBBK.KBWWK",
            "KBBKKBBKK.", ".KBBBBK...", "..KKKK...."]
ARM_BROW = ["...KK", "..KWWK", ".KBWWK", ".KBBK.", "KBBK..", "KBBK..", "KBBK..", "KBBK..", "KBBK..", "KBBK..",
            "KBBK..", "KBBK..", "KBBK..", "KBBK..", "KBBK..", "KBBK..", ".KK..."]


def put(f, part, x, y, mirror_=False):
    w = max(len(q) for q in part)
    p = [r.ljust(w, ".") for r in part]
    if mirror_:
        p = flipx(p)
    return patch(f, x, y, [r.replace(".", "?") for r in p])


SH_Y = MX0Y + 26   # shoulder row
L_X, R_X = MX0X + 0, MX0X + 22


def arm(f, side, kind):
    m = side == "R"
    if kind == "down":
        return put(f, ARM_DOWN, R_X if m else L_X, SH_Y, m)
    if kind == "bulb":
        f = put(f, ARM_DOWN, L_X, SH_Y)
        return put(f, BULB, L_X, SH_Y + 11)
    if kind == "squeeze":   # forearm across the chest, the bulb in the fist
        f = put(f, ARM_SQUEEZE, L_X, SH_Y)
        return put(f, ["KKKK", "KBBK", "KBLK", ".KK."], L_X + 4, SH_Y + 2)
    if kind == "up":
        return put(f, ARM_UP, R_X - 1 if m else L_X - 1, SH_Y - 12, m)
    if kind == "chin":
        return put(f, ARM_CHIN, L_X, SH_Y)
    if kind == "brow":      # right arm up to the forehead
        return put(f, ARM_BROW, R_X - 3, SH_Y - 16, True)
    return f


def maxwell(eye="open", mth="flat", brow=None, left="bulb", right="down"):
    f = eyes(MX, eye)
    f = mouth(f, mth)
    f = brows(f, brow)
    f = arm(f, "L", left)
    f = arm(f, "R", right)
    return f


mxIdle = [maxwell(), maxwell(eye="shut")]
mxShoot = [maxwell(brow="raise", left="squeeze"), maxwell(eye="shut", brow="raise", left="squeeze")]
mxHappy = [maxwell(eye="happy", mth="smile", left="up", right="up"),
           maxwell(eye="happy", mth="smile", left="bulb", right="up")]
mxHmm = [maxwell(brow="raise", mth="side", left="chin"), maxwell(eye="shut", brow="raise", mth="side", left="chin")]
mxOops = [maxwell(brow="worry", mth="o", right="brow"), maxwell(eye="shut", brow="worry", mth="o", right="brow")]
# head crops for the speech line under the scene: neutral, happy, hmm, oops
mxFace = [crop(maxwell(**k), MX0X, MX0Y, 26, 24) for k in
          (dict(), dict(eye="happy", mth="smile"), dict(brow="raise", mth="side"), dict(brow="worry", mth="o"))]

# ---------------------------------------------------------------- his 1861 camera (faces left, towards the sitter)
CAMERA = [
    "..........KKKKKKKKKKKKKKKKK.",
    "..........KLLLLLLLLLLLLLLLLK",
    "....KKKKKKKBBBBBBBBBBBBBBBBK",
    "....KLLLLLKBBBBBBBBBBBBBBBBK",
    "KKKKKBBBBBKBBLBBBBBBBBLBBBBK",
    "KWLLKBBBBBKBBBBBBBBBBBBBBBBK",
    "KWTLKBBLBBKBBBBBBBBBBBBBBBBK",
    "KLKLKBBBBBKKKKKKKKKKKKKKKKBK",
    "KLKLKBBBBBKBBBBBBBBBBBBBBKBK",
    "KWTLKBBBBBKBBBBLBBBBBBBBBKBK",
    "KWLLKBBLBBKBBBBBBBBBBBBBBKBK",
    "KKKKKBBBBBKBBBBBBBBBBLBBBKBK",
    "....KLLLLLKBBBBBBBBBBBBBBKBK",
    "....KKKKKKKBBBBBBBBBBBBBBKKK",
    "..........KLLLLLLLLLLLLLLLLK",
    "..........KKKKKKKKKKKKKKKKKK",
]
CAMERA_OPEN = patch(CAMERA, 0, 5, ["KWW", "KWO", "?KO", "?KO", "KWO", "KWW"])
TRIPOD = [
    "......KKKKKK......",
    "......KBBBBK......",
    ".......KBBK.......",
    "......KBKKBK......",
    "......KBKKBK......",
    ".....KBK.KBK......",
    ".....KBK..KBK.....",
    "....KBK...KBK.....",
    "....KBK....KBK....",
    "...KBK.....KBK....",
    "...KBK......KBK...",
    "..KBK.......KBK...",
    "..KBK........KBK..",
    ".KBK.........KBK..",
    ".KBK..........KBK.",
    "KBK...........KBK.",
    "KKK............KKK",
]
camera = [CAMERA, CAMERA_OPEN]
tripod = [TRIPOD]

flash = [
    ["....O....", "....O....", ".O..W..O.", "..O.W.O..", "OOWWWWWOO", "..O.W.O..", ".O..W..O.", "....O....",
     "....O...."],
    [".........", "....O....", "....W....", "..O.W.O..", ".OWWWWWO.", "..O.W.O..", "....W....", "....O....",
     "........."],
]

# ---------------------------------------------------------------- the sitter: a Bloch-sphere character
# A glass ball (outline, equator, glint) whose body is the colour being photographed. The arrow inside it is drawn
# by the page from the real vector. Feet so it can perch on the stool.


def bloch_frame(eyes="open", mouth="smile"):
    import math
    n, c0 = 24, 11.5
    g = [["." for _ in range(n)] for _ in range(n + 4)]
    for y in range(n):
        for x in range(n):
            d = ((x - c0) ** 2 + (y - c0) ** 2) ** .5
            if d <= 10.6:
                g[y][x] = "C"
            elif d <= 11.7:
                g[y][x] = "K"
    # equator ellipse: solid along the front, dotted along the back
    for k in range(96):
        a = 2 * math.pi * k / 96
        x, y = round(c0 + 10.4 * math.cos(a)), round(13 + 3.6 * math.sin(a))
        if g[y][x] == "C" and (math.sin(a) > 0.05 or (k % 6 == 0 and abs(math.cos(a)) > .7)):
            g[y][x] = "c"
    for (x, y) in [(6, 4), (5, 5), (4, 6), (7, 3), (8, 3)]:   # glint
        g[y][x] = "W"
    rows = ["".join(r) for r in g]
    for x in (7, 14):
        if eyes == "open":
            rows = patch(rows, x, 7, ["WWW", "WKK", "WKK"])
        elif eyes == "shut":
            rows = patch(rows, x, 9, ["ccc"])
        elif eyes == "happy":
            rows = patch(rows, x, 8, ["?c?", "c?c"])
    if mouth == "smile":
        rows = patch(rows, 9, 11, ["c????c", "?cccc?"])
    elif mouth == "flat":
        rows = patch(rows, 10, 12, ["cccc"])
    elif mouth == "o":
        rows = patch(rows, 10, 11, ["?cc?", "c??c", "?cc?"])
    rows = patch(rows, 6, 22, ["?KK????????KK", "KBBK??????KBBK", "KKKK??????KKKK"])
    return rows


bloch = [bloch_frame("open", "smile"), bloch_frame("shut", "smile"), bloch_frame("shut", "flat"),
         bloch_frame("happy", "smile"), bloch_frame("open", "o")]   # idle, blink, flinch, happy, surprised

STOOL = [
    "..KKKKKKKKKKKKKK..",
    ".KLLLLLLLLLLLLLLK.",
    "KBBBBBBBBBBBBBBBBK",
    ".KKKKKKKKKKKKKKKK.",
    "..KBK........KBK..",
    "..KBK........KBK..",
    "..KBKKKKKKKKKKBK..",
    "..KBKLLLLLLLLKBK..",
    "..KBKKKKKKKKKKBK..",
    "..KBK........KBK..",
    "..KBK........KBK..",
    ".KBK..........KBK.",
    ".KBK..........KBK.",
    ".KKK..........KKK.",
]
stool = [STOOL]

# the tartan ribbon from the 1861 photograph, tied as a bow on the sitter (an ink tartan: crossing light/dark bands)
BOW = [
    ".KKK......KKK.",
    "KLBLK....KLBLK",
    "KBTBTKKKKTBTBK",
    "KLBLBKBBKBLBLK",
    "KBTBTKBBKTBTBK",
    "KLBLK.KK.KLBLK",
    ".KKK.KBBK.KKK.",
    ".....KB.BK....",
    "....KB...BK...",
    "....KK...KK...",
]
bow = [BOW]

# ---------------------------------------------------------------- filters: Maxwell's red, green and blue, and the
# three measurement directions X, Y and Z. Ink frames with a glass pane and the letter.
GLYPH = {
    "R": ["110", "101", "110", "101", "101"], "G": ["011", "100", "101", "101", "011"],
    "B": ["110", "101", "110", "101", "110"], "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
}


def filter_frame(letter, shade):
    rows = [
        "KKKKKKKKKK",
        "KBBBBBBBBK",
        "KB" + shade * 6 + "BK",
    ]
    rows += ["KB" + shade * 6 + "BK" for _ in range(7)]
    rows += ["KBBBBBBBBK", "KKKKKKKKKK"]
    g = GLYPH[letter]
    for j, gr in enumerate(g):
        for i, bit in enumerate(gr):
            if bit == "1":
                r = list(rows[3 + j])
                r[3 + i + 0] = "K"
                rows[3 + j] = "".join(r)
    rows = patch(rows, 6, 2, ["W", "W"])  # glass glint
    return rows


filters = {f"filter{L}": [filter_frame(L, "T")] for L in "RGBXYZ"}

# ---------------------------------------------------------------- the machines that store and measure the numbers
# a classical computer for the simulators (screen: a blinking cursor), the same with a fuzzy screen for the noise
# models, and IBM's chip hanging in its dilution refrigerator for the real hardware run
SIM = [
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    "KLLLLLLLLLLLLLLLLLLLLLLK",
    "KLKKKKKKKKKKKKKKKKKKKKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKWBBBBBWWWWWWWWWWWWKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKWBBBWBBBBWWWWWWWWWKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKWBBBBBBWBBWWWWWWWWKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKWBBWBBBBBBBWWWWWWWKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKWBKKWWWWWWWWWWWWWWKLK",
    "KLKWWWWWWWWWWWWWWWWWWKLK",
    "KLKKKKKKKKKKKKKKKKKKKKLK",
    "KLLLLLLLLLLLLLLLLLLLLLLK",
    "KKKKKKKKKKKKKKKKKKKKKKKK",
    ".........KBBBBK.........",
    ".........KBBBBK.........",
    "......KKKKKKKKKKKK......",
    "......KLLLLLLLLLLK......",
    "....KKKKKKKKKKKKKKKK....",
    "....KLTLTLTLTLTLTLTK....",
    "...KLTLTLTLTLTLTLTLTK...",
    "...KKKKKKKKKKKKKKKKKK...",
]
SIM_OFF = patch(SIM, 5, 12, ["WW"])
NOISE1 = ["WBWTWWBWTWLWBWWTW", "BWTWLWWBWTWWTWBWL", "WTWWBWLWWBWTWLWWB", "TWBWWTWBWLWTWBWTW",
          "WLWTWBWWTWBWWBWLW", "BWWBWLWTWWLWBWTWB", "WTWLWBWWBWTWWLWBW", "LWBWTWWLWBWBWTWWT",
          "WBWWBWTWBWWTWLWBW", "WWTWLWBWWTWBWWBWT"]
NOISE2 = [r[3:] + r[:3] for r in reversed(NOISE1)]
SIM_N1 = patch(SIM, 3, 3, [r[:18] + "W" for r in NOISE1] + ["W" * 19])
SIM_N2 = patch(SIM, 3, 3, [r[:18] + "W" for r in NOISE2] + ["W" * 19])
sim = [SIM, SIM_OFF]
simNoisy = [SIM_N1, SIM_N2]

FRIDGE = [   # IBM's dilution refrigerator with the can off: a chandelier of cold plates and coax cables
    "KKKKKKKKKKKKKKKKKKKKKKKKKK",
    "KLLLLLLLLLLLLLLLLLLLLLLLLK",
    ".KKKKKKKKKKKKKKKKKKKKKKKK.",
    "..KBK..KK..KBK..KK...KBK..",
    "..KBK.KBBK.KBK.KBBK..KBK..",
    "..KBK.KBBK.KBK.KBBK..KBK..",
    "..KBK..KK..KBK..KK...KBK..",
    ".KKKKKKKKKKKKKKKKKKKKKKKK.",
    ".KTTTTTTTTTTTTTTTTTTTTTTK.",
    "..KKKKKKKKKKKKKKKKKKKKKK..",
    "....KBK..B.KBK.B..KBK.....",
    "....KBK.B..KBK..B.KBK.....",
    "....KBK..B.KBK.B..KBK.....",
    "...KKKKKKKKKKKKKKKKKKKK...",
    "...KTTTTTTTTTTTTTTTTTTK...",
    "....KKKKKKKKKKKKKKKKKK....",
    "......KBK.B.KBK.B.KBK.....",
    "......KBK..BKBKB..KBK.....",
    "......KBK.B.KBK.B.KBK.....",
    ".....KKKKKKKKKKKKKKKKK....",
    ".....KTTTTTTTTTTTTTTTK....",
    "......KKKKKKKKKKKKKKK.....",
    "........KBK.KBK.KBK.......",
    "........KBK.KBK.KBK.......",
    ".......KKKKKKKKKKKKK......",
    ".......KTTTTTTTTTTTK......",
    "........KKKKKKKKKKK.......",
    "..........KBK.KBK.........",
    "..........KBK.KBK.........",
]
FRIDGE2 = patch(FRIDGE, 0, 0, ["?"] * 3 + ["?W??????????????????????W?"] + ["?"] * 10 + ["?W"])
fridge = [FRIDGE, FRIDGE2]

CHIP = [
    "..K.K.K.K.K.K...",
    "..K.K.K.K.K.K...",
    "KKKKKKKKKKKKKKKK",
    "..KBBBBBBBBBBK..",
    "KKKBLLLLLLLLBKKK",
    "..KBLWLWLWLLBK..",
    "KKKBLLLLLLLLBKKK",
    "..KBLWLWLWLLBK..",
    "KKKBLLLLLLLLBKKK",
    "..KBLWLWLWLLBK..",
    "KKKBLLLLLLLLBKKK",
    "..KBBBBBBBBBBK..",
    "KKKKKKKKKKKKKKKK",
    "..K.K.K.K.K.K...",
    "..K.K.K.K.K.K...",
    "................",
]
CHIP2 = patch(CHIP, 4, 5, ["?L?W?L", "??????", "?W?L?W", "??????", "?L?W?L"])
chip = [CHIP, CHIP2]

# ---------------------------------------------------------------- Maxwell's spinning colour top (set dressing)
TOP = [
    "......KK......",
    "......KK......",
    "....KKBBKK....",
    "..KKLLBBTTKK..",
    ".KWWLLBBTTBBK.",
    "KWWWLLBBTTBBBK",
    ".KWWLLBBTTBBK.",
    "..KKLLBBTTKK..",
    "....KKBBKK....",
    "......KK......",
    "......KK......",
    "..............",
]
TOP2 = ["".join({"W": "B", "B": "T", "T": "L", "L": "W"}.get(ch, ch) for ch in r) for r in TOP]
TABLE = [
    "KKKKKKKKKKKKKKKKKK",
    "KLLLLLLLLLLLLLLLLK",
    "KKKKKKKKKKKKKKKKKK",
    "......KBBBBK......",
    ".......KBBK.......",
    ".......KBBK.......",
    ".......KBBK.......",
    ".......KBBK.......",
    ".......KBBK.......",
    ".......KBBK.......",
    "......KBBBBK......",
    "....KKKKKKKKKK....",
    "....KBBBBBBBBK....",
    "....KKKKKKKKKK....",
]
colourTop = [TOP, TOP2]
table = [TABLE]

# ---------------------------------------------------------------- the velvet curtain for the hidden-arrow game
CURTAIN = ["K" * 32, "K" + "L" * 30 + "K", "K" + "LTLT" * 7 + "LT" + "K", "K" * 32]
for j in range(28):
    row = "K"
    for i in range(30):
        row += "BBKBBLBB"[(i + (1 if j > 20 and i < 15 else 0) - (1 if j > 20 and i >= 15 else 0)) % 8]
    CURTAIN.append(row + "K")
curtain = [CURTAIN]


# ---------------------------------------------------------------- the mascot: Maxwell beside his camera
def compose(w, h, parts):
    g = blank(w, h)
    for rows, x, y in parts:
        g = patch(g, x, y, [r.replace(".", "?") for r in rows])
    return g


mascot = compose(56, 48, [(TRIPOD, 5, 31), (CAMERA_OPEN, 0, 18), (flash[0], 0, 15),
                          (maxwell(eye="happy", mth="smile", left="squeeze"), 22, 4)])

SPRITES = {
    "mxIdle": {"frames": mxIdle, "fps": 6},
    "mxShoot": {"frames": mxShoot, "fps": 6},
    "mxHappy": {"frames": mxHappy, "fps": 3},
    "mxHmm": {"frames": mxHmm, "fps": 2},
    "mxOops": {"frames": mxOops, "fps": 2},
    "mxFace": {"frames": mxFace, "fps": 1},
    "camera": {"frames": camera, "fps": 1},
    "tripod": {"frames": tripod, "fps": 1},
    "flash": {"frames": flash, "fps": 12},
    "bloch": {"frames": bloch, "fps": 1},
    "stool": {"frames": stool, "fps": 1},
    "bow": {"frames": bow, "fps": 1},
    **{k: {"frames": v, "fps": 1} for k, v in filters.items()},
    "sim": {"frames": sim, "fps": 2},
    "simNoisy": {"frames": simNoisy, "fps": 6},
    "fridge": {"frames": fridge, "fps": 2},
    "chip": {"frames": chip, "fps": 2},
    "colourTop": {"frames": colourTop, "fps": 6},
    "table": {"frames": table, "fps": 1},
    "curtain": {"frames": curtain, "fps": 1},
    "mascot": {"frames": [mascot], "fps": 1},
}


def check(sprites):
    for name, sp in sprites.items():
        frames = sp["frames"]
        frames[:] = [even(f) for f in frames]
        h, w = len(frames[0]), len(frames[0][0])
        for f in frames:
            assert len(f) == h and all(len(r) == w for r in f), (name, [len(r) for r in f])
            assert all(set(r) <= set(".KBLTWOGCc") for r in f), name


def preview(sprites, path, scale=6):
    from PIL import Image, ImageDraw
    pal = {"K": "#19238E", "B": "#545BA9", "L": "#A1A4CE", "T": "#D3D3E6", "W": "#FBFAF9", "O": "#B4541A",
           "G": "#1F7A4D", "C": "#c0306a", "c": "#19238E"}
    tiles = []
    for name, sp in sprites.items():
        for k, f in enumerate(sp["frames"]):
            tiles.append((f"{name}[{k}]", f))
    cols, pad_ = 6, 14
    cw = max(len(f[0]) for _, f in tiles) * scale + pad_
    ch = max(len(f) for _, f in tiles) * scale + pad_ + 12
    rows_n = (len(tiles) + cols - 1) // cols
    img = Image.new("RGB", (cols * cw, rows_n * ch), "#E8E6F0")
    d = ImageDraw.Draw(img)
    for t, (name, f) in enumerate(tiles):
        ox, oy = (t % cols) * cw + 6, (t // cols) * ch + 4
        d.text((ox, oy), name, fill="#000")
        for j, r in enumerate(f):
            for i, c in enumerate(r):
                if c in pal:
                    d.rectangle([ox + i * scale, oy + 12 + j * scale, ox + (i + 1) * scale - 1,
                                 oy + 12 + (j + 1) * scale - 1], fill=pal[c])
    img.save(path)
    print("preview", path, img.size)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    a = ap.parse_args()
    check(SPRITES)
    OUT.write_text(json.dumps(SPRITES, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(HERE)}: {len(SPRITES)} sprites")
    if a.preview:
        preview(SPRITES, a.preview)
