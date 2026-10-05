"""Write web/sprites.json: the pixel-art cast of Quantum Lenia, in the shared ink palette (common/SPRITES.md).

The cast:
  orbi*        the mascot, an Orbium with a face (idle loop + one sprite per measured fate / reaction)
  eyes         the eyes drawn on every live Orbium-sized blob in the dish (9 gaze directions + a blink)
  pipette      drops an Orbium (frame 1 = bulb squeezed); drop = the falling droplet
  brush        sprays soup;  eraser = erases
  lens         the magnifier frame that each kernel is shown through
  ghost        rises when a blob stops counting as Orbium-sized;  sparkle = a new one starts counting
  mini         a tiny Orbium, used to count creatures (regrow results)
  bit          a fragment, for the "breaks up" fate;  wave = the "floods the world" fate
Some shapes are rasterised from circles and capsules (so curves stay even), faces and small props are hand-drawn
rows. Palette letters: K ink, B ink-2, L ink-3, T tint, W paper (no warm accent: nothing here is light or heat).
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [["."] * w for _ in range(h)]

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else "."

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def paste(self, rows, ox, oy):   # '.' is transparent
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c not in ". ":
                    self.set(ox + i, oy + j, c)

    def rows(self):
        return ["".join(r) for r in self.px]


def mask_from(w, h, inside):
    return [[bool(inside(x + 0.5, y + 0.5)) for x in range(w)] for y in range(h)]


def fill_outlined(g, m, fill, outline="K"):
    """Fill mask m with `fill`; mask pixels with a 4-neighbour outside the mask become the outline."""
    for y in range(g.h):
        for x in range(g.w):
            if not m[y][x]:
                continue
            edge = any(not (0 <= x + dx < g.w and 0 <= y + dy < g.h and m[y + dy][x + dx])
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            g.set(x, y, outline if edge else fill)


def capsule(ax, ay, bx, by, r):
    def f(x, y):
        vx, vy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy or 1)))
        return math.hypot(x - ax - t * vx, y - ay - t * vy) <= r
    return f


def union(*fs):
    return lambda x, y: any(f(x, y) for f in fs)


# ---------------------------------------------------------------- the mascot: Orbi, an Orbium with a face
FACES = {   # 12 x 8 stamps at the face anchor; Orbi glides right, so its face sits a little forward
    "open": ["............",
             ".KKK...KKK..",
             "KWKKK.KWKKK.",
             "KKKKK.KKKKK.",
             ".KKK...KKK..",
             "............",
             "..K.....K...",
             "...KKKKK....",
             ],
    "blink": ["............",
              "............",
              "............",
              "KKKKK.KKKKK.",
              ".KKK...KKK..",
              "............",
              "..K.....K...",
              "...KKKKK....",
              ],
    "happy": ["............",
              ".KKK...KKK..",
              "K...K.K...K.",
              "............",
              "............",
              "..KKKKKKK...",
              "..KWWWWWK...",
              "...KKKKK....",
              ],
    "sleepy": ["............",
               "............",
               "KKKKK.KKKKK.",
               "KWKKK.KWKKK.",
               ".KKK...KKK..",
               "............",
               "............",
               "....KKK.....",
               ],
    "dizzy": [".KKK...KKK..",
              "K...K.K...K.",
              "K.K.K.K.K.K.",
              "K.KKK.K.KKK.",
              "K.....K.....",
              ".KKKK..KKKK.",
              "............",
              "....KKK.....",
              ],
    "xx": ["............",
           "K...K.K...K.",
           ".K.K...K.K..",
           "..K.....K...",
           ".K.K...K.K..",
           "K...K.K...K.",
           "............",
           "...KKKKK....",
           ],
    "gasp": [".KKK...KKK..",
             "KWKKK.KWKKK.",
             "KKKKK.KKKKK.",
             "KKKKK.KKKKK.",
             ".KKK...KKK..",
             "............",
             "....KKK.....",
             "...KWWWK....",
             ],
}


def orbi(face="open", squash=0.0, tail=1, sweat=False):
    w, h = 32, 26
    g = Grid(w, h)
    cx, cy = 18.5, 13.4 + squash * 0.9
    rx, ry = 11.2 + squash * 0.9, 10.8 - squash * 0.9
    off = (2.6, 3.4, 4.2)[tail]   # the crescent wake behind Orbium (its one "tail"), flicking
    wake = mask_from(w, h, lambda x, y: ((x - cx + off) / (rx + 0.2)) ** 2 + ((y - cy - 0.4) / (ry - 1.0)) ** 2 <= 1
                     and ((x - cx) / (rx - 0.6)) ** 2 + ((y - cy) / (ry - 0.6)) ** 2 > 1)
    fill_outlined(g, wake, "L")
    body = mask_from(w, h, lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
    fill_outlined(g, body, "B")
    for y in range(h):          # membrane (ink-2), the Lenia ring (ink-3) and a pale core where the face sits
        for x in range(w):
            if body[y][x] and g.get(x, y) == "B":
                rho = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
                g.set(x, y, "B" if rho > 0.80 else "L" if rho > 0.62 else "T")
    for x, y in ((11, 5), (12, 4), (13, 4), (10, 6)):   # glossy highlight on the membrane, top-left
        if body[y][x] and g.get(x, y) != "K":
            g.set(x, y, "W")
    fy = int(round(cy)) - 5
    g.paste(FACES[face], 14, fy)
    if face in ("open", "gasp", "happy", "blink"):   # cheeks
        for x in (13, 14, 24, 25):
            if g.get(x, fy + 5) in "TL":
                g.set(x, fy + 5, "L" if g.get(x, fy + 5) == "T" else "B")
    if sweat:
        g.paste(["..K.", ".KWK", "KWTK", ".KK."], 26, 0)
    return g.rows()


# ---------------------------------------------------------------- eyes for live blobs in the dish
def eyes():
    frames = []
    dirs = [(0, 0), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]   # C, E, SE, S, SW, W, NW, N, NE
    for dx, dy in dirs:
        g = Grid(13, 7)
        for ox in (0, 7):
            g.paste([".LLLL.", "LWWWWL", "LWWWWL", "LWWWWL", "LWWWWL", "LWWWWL", ".LLLL."], ox, 0)
            px, py = ox + 2 + dx, 2 + dy
            for a in range(2):
                for b in range(3):
                    g.set(px + a, py + b, "K")
        frames.append(g.rows())
    g = Grid(13, 7)
    for ox in (0, 7):
        g.paste([".LLLL.", "LBBBBL", "LBBBBL", "LKKKKL", "LWWWWL", "LWWWWL", ".LLLL."], ox, 0)   # lids down
    frames.append(g.rows())
    return frames


# ---------------------------------------------------------------- tools (tip / hotspot noted in HOT)
def pipette(squeezed=False):
    g = Grid(16, 16)
    tube = capsule(2.6, 13.4, 9.0, 7.0, 1.6)
    tip = capsule(0.9, 15.1, 2.8, 13.2, 0.75)
    collar = capsule(8.6, 7.4, 10.0, 6.0, 2.1)
    bulb = (lambda x, y: math.hypot(x - 12.2, y - 3.8) <= (2.6 if squeezed else 3.4)) if True else None
    m = mask_from(16, 16, union(tube, tip, collar, bulb))
    fill_outlined(g, m, "T")
    for y in range(16):
        for x in range(16):
            if g.get(x, y) == "T":
                if bulb(x + 0.5, y + 0.5):
                    g.set(x, y, "B")
                elif collar(x + 0.5, y + 0.5):
                    g.set(x, y, "L")
    for x, y in ((4, 11), (5, 10), (6, 9)):   # ink inside the glass
        if g.get(x, y) == "T":
            g.set(x, y, "B")
    if g.get(11, 2) == "B":
        g.set(11, 2, "L")
    return g.rows()


def brush(splay=False):
    n = 18
    g = Grid(n, n)
    handle = capsule(8.8, 8.8, 16.6, 1.4, 1.15)
    ferrule = capsule(6.6, 11.0, 8.8, 8.8, 2.0)
    r = 3.3 if splay else 2.9
    tuft = union(lambda x, y: math.hypot(x - 4.5, y - 13.5) <= r, capsule(4.5, 13.5, 0.9, 17.1, 1.0 if not splay else 1.5))
    m = mask_from(n, n, union(handle, ferrule, tuft))
    fill_outlined(g, m, "B")
    for y in range(n):
        for x in range(n):
            if g.get(x, y) == "B":
                if ferrule(x + 0.5, y + 0.5) and not tuft(x + 0.5, y + 0.5):
                    g.set(x, y, "T")
                elif tuft(x + 0.5, y + 0.5):
                    g.set(x, y, "K" if x + (n - y) < 6 else "L" if (x - y) % 3 == 0 else "B")
    for x, y in ((14, 3), (13, 4), (15, 2)):
        if g.get(x, y) == "B":
            g.set(x, y, "L")
    return g.rows()


def eraser():
    g = Grid(16, 16)
    body = capsule(4.6, 11.4, 11.4, 4.6, 3.4)
    m = mask_from(16, 16, body)
    fill_outlined(g, m, "W")
    for y in range(16):
        for x in range(16):
            if g.get(x, y) == "W" and (x + 0.5) + (16 - (y + 0.5)) > 18.5:   # the sleeve, upper-right
                g.set(x, y, "B")
            elif g.get(x, y) == "W" and abs((x + 0.5) + (16 - (y + 0.5)) - 18.0) < 0.75:
                g.set(x, y, "K")
    for x, y in ((4, 9), (5, 8)):
        if g.get(x, y) == "W":
            g.set(x, y, "T")
    return g.rows()


DROP = [".K.", "KTK", "KBK", ".K."]


# ---------------------------------------------------------------- the lens (kernel viewer)
def lens():
    w = h = 34
    g = Grid(w, h)
    c, r_in, r_out = 14.5, 11.8, 14.9
    ring = mask_from(w, h, lambda x, y: r_in < math.hypot(x - c, y - c) <= r_out)
    handle = mask_from(w, h, capsule(24.0, 24.0, 31.6, 31.6, 2.0))
    hm = [[handle[y][x] and math.hypot(x + 0.5 - c, y + 0.5 - c) > r_out - 0.3 for x in range(w)] for y in range(h)]
    fill_outlined(g, hm, "B")
    for y in range(h):
        for x in range(w):
            if ring[y][x]:
                d = math.hypot(x + 0.5 - c, y + 0.5 - c)
                ang = math.degrees(math.atan2(-(y + 0.5 - c), x + 0.5 - c)) % 360
                if d <= r_in + 0.9 or d > r_out - 0.9:
                    g.set(x, y, "K")
                else:
                    g.set(x, y, "L" if 100 <= ang <= 200 else "B")
    for a in range(150, 176, 4):   # glare on the glass, outside the kernel's square
        x, y = c + 10.3 * math.cos(math.radians(a)), c - 10.3 * math.sin(math.radians(a))
        g.set(int(x), int(y), "W")
    for x, y in ((30, 30), (29, 29)):
        g.set(x, y, "L")
    return g.rows()


# ---------------------------------------------------------------- props
GHOST = [
    ["..KKKKKK..",
     ".KWWWWWWK.",
     "KWWWWWWWWK",
     "KWKKWWKKWK",
     "KWKKWWKKWK",
     "KWWWWWWWWK",
     "KWWWKKWWWK",
     "KWWWKKWWWK",
     "KWWWWWWWWK",
     "KWKWWWKWWK",
     "K.KK.KK.KK"[:10],
     ],
    ["..KKKKKK..",
     ".KWWWWWWK.",
     "KWWWWWWWWK",
     "KWKKWWKKWK",
     "KWKKWWKKWK",
     "KWWWWWWWWK",
     "KWWWKKWWWK",
     "KWWWKKWWWK",
     "KWWWWWWWWK",
     "KWWKWWWKWK",
     "KK.KK.KK.K",
     ],
]
SPARKLE = [
    ["...K...", "...K...", "..KWK..", "KKWWWKK", "..KWK..", "...K...", "...K..."],
    [".......", ".K...K.", "...K...", "..KWK..", "...K...", ".K...K.", "......."],
]


def mini():
    g = Grid(13, 11)
    cx, cy, rx, ry = 7.4, 5.6, 5.3, 4.9
    m = mask_from(13, 11, lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
    fill_outlined(g, m, "B")
    for y in range(11):
        for x in range(13):
            if g.get(x, y) == "B" and math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) < 0.62:
                g.set(x, y, "T")
    g.paste(["K.K", "K.K"], 7, 4)
    g.paste(["L.", "LK", ".L"][:3], 0, 4)
    return g.rows()


BIT = [[".KK.", "KBLK", "KBBK", ".KK."], ["..K.", ".KBK", "KBLK", ".KK."], [".KK..", "KBBK.", "KLBBK", ".KKK."]]
WAVE = [["..KK....", ".KLLK..K", "KLLLLKKL", "LLLLLLLL"], ["......KK", "K....KLL", "LKKKKLLL", "LLLLLLLL"]]


def main():
    sp = {
        "orbi": {"frames": [orbi("open", 0, 1), orbi("open", 0.5, 0), orbi("open", 1.0, 0), orbi("open", 0.5, 1),
                            orbi("open", 0, 2), orbi("open", -0.5, 2), orbi("open", 0, 1), orbi("blink", 0, 1)], "fps": 5},
        "orbiHappy": {"frames": [orbi("happy", 0, 0), orbi("happy", 1.0, 2)], "fps": 4},
        "orbiSleepy": {"frames": [orbi("sleepy", 0.6, 1, True), orbi("sleepy", 0.9, 2, True)], "fps": 2},
        "orbiDizzy": {"frames": [orbi("dizzy", 0.4, 1), orbi("dizzy", -0.4, 2)], "fps": 4},
        "orbiXX": {"frames": [orbi("xx", 0.8, 2)], "fps": 1},
        "orbiGasp": {"frames": [orbi("gasp", -0.6, 0)], "fps": 1},
        "eyes": {"frames": eyes(), "fps": 1},
        "pipette": {"frames": [pipette(False), pipette(True)], "fps": 1, "hot": [0.5, 15.5]},
        "brush": {"frames": [brush(False), brush(True)], "fps": 8, "hot": [0.5, 17.5]},
        "eraser": {"frames": [eraser()], "fps": 1, "hot": [8, 8]},
        "drop": {"frames": [DROP], "fps": 1},
        "lens": {"frames": [lens()], "fps": 1, "glass": [14.5, 14.5, 11.8]},
        "ghost": {"frames": GHOST, "fps": 3},
        "sparkle": {"frames": SPARKLE, "fps": 6},
        "mini": {"frames": [mini()], "fps": 1},
        "bit": {"frames": BIT, "fps": 1},
        "wave": {"frames": WAVE, "fps": 2},
    }
    for k, v in sp.items():
        for f in v["frames"]:
            assert len(set(map(len, f))) == 1, (k, [len(r) for r in f])
            assert set("".join(f)) <= set(".KBLTW"), (k, set("".join(f)))
    OUT.write_text(json.dumps(sp, indent=None, separators=(",", ":")).replace('],"', '],\n"'), encoding="utf-8")
    print(f"{OUT}: {len(sp)} sprites")


if __name__ == "__main__":
    main()
