"""Pixel-art cast for the Magic Angle page -> web/sprites.json. CLASSICAL, art only.

Shared ink palette (common/inksprite.js): K ink outline, B ink-2, L ink-3, T tint, W paper. No warm accent:
nothing in this scene is light, fire or heat.

The cast:
  sheet_a, sheet_b   Ay and Bee, the two graphene layers: a flat-top hexagon of honeycomb with arms and feet.
                     Bodies carry no face; a face_* sprite of the same size is drawn on top, so one body
                     can show every expression and both rotate together about the same centre.
  face_happy         open eyes + smile, with a blink frame (the morph's period tracks the twist)
  face_calm          closed ^ ^ eyes (layers aligned, 0 deg)
  face_look          eyes searching left / right (pattern bigger than the frame: unresolved)
  face_puzzled       one brow up, wobbly mouth (register echo, incl. the magic angle zone)
  face_strain        > < eyes, gritted teeth (while you drag the turntable)
  lec                the electron mascot: a smiling hexagon with an orbit ring; the orbiting dot moves (4 frames)
  lec_dizzy          spiral eyes (on an echo frame Lec cannot find the period)
  lec_sleep          closed eyes (unresolved: nothing to hop on)
  echo               the register's echo as a little hexagon ghost (appears only on frames flagged null)
  knob               hex-nut grip on the turntable rim
  zz, qmark, spark   tiny props
Usage: python make_sprites.py   (then python ../../common/mascot.py web/sprites.json lec web/img/mascot.png --scale 6)
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def grid(w, h):
    return [['.'] * w for _ in range(h)]


def rows(g):
    return [''.join(r) for r in g]


def put(g, x, y, c):
    if 0 <= y < len(g) and 0 <= x < len(g[0]):
        g[y][x] = c


def stamp(g, x0, y0, art):
    """Paste a small string-art block; '.' is transparent."""
    for j, r in enumerate(art):
        for i, c in enumerate(r):
            if c != '.':
                put(g, x0 + i, y0 + j, c)


def outline(g, mask, ink='K'):
    """Every mask pixel that touches a non-mask pixel (4-neighbour) becomes ink."""
    h, w = len(g), len(g[0])
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < w and 0 <= yy < h) or not mask[yy][xx]:
                    g[y][x] = ink
                    break


def flat_hex_mask(w, h, cx, cy, rx):
    """Flat-top hexagon: |dx| + |dy|/sqrt3 <= rx and |dy| <= rx*sqrt3/2 (pixel centres)."""
    hh = rx * math.sqrt(3) / 2
    return [[(abs(x + .5 - cx) + abs(y + .5 - cy) / math.sqrt(3) <= rx and abs(y + .5 - cy) <= hh)
             for x in range(w)] for y in range(h)]


def pointy_hex_mask(w, h, cx, cy, ry):
    """Pointy-top hexagon."""
    hw = ry * math.sqrt(3) / 2
    return [[(abs(y + .5 - cy) + abs(x + .5 - cx) / math.sqrt(3) <= ry and abs(x + .5 - cx) <= hw)
             for x in range(w)] for y in range(h)]


# ---------------------------------------------------------------- Ay and Bee (26 x 27)
SW, SH = 30, 26
HCX, HCY, HRX = 15.0, 11.6, 12.6


HEX_R = 2.7


def honey_edge(x, y, r=HEX_R):
    """True on the bonds of a pointy-top honeycomb whose cells have circumradius r (origin = a cell centre)."""
    w = math.sqrt(3) * r
    best = 9.0
    j0 = round(y / (1.5 * r))
    for j in (j0 - 1, j0, j0 + 1):
        cy = 1.5 * r * j
        off = (w / 2) * (j % 2)
        i0 = round((x - off) / w)
        for i in (i0 - 1, i0, i0 + 1):
            dx, dy = abs(x - (off + w * i)), abs(y - cy)
            best = min(best, max(dx / (w / 2), (dy + dx / math.sqrt(3)) / r))
    return best > 0.74


def sheet(fill, cell, atom):
    g = grid(SW, SH)
    m = flat_hex_mask(SW, SH, HCX, HCY, HRX)
    for y in range(SH):
        for x in range(SW):
            if m[y][x]:
                g[y][x] = fill
    # graphene texture: a real little honeycomb (pointy-top cells, circumradius HEX_R) drawn as 1 px bonds,
    # with a clear patch for the face
    for y in range(SH):
        for x in range(SW):
            if not m[y][x] or (9 <= x <= 20 and 7 <= y <= 15):
                continue
            if honey_edge(x + .5 - HCX, y + .5 - HCY):
                g[y][x] = cell
    outline(g, m)
    # arms (mittens at the side vertices) and two feet
    stamp(g, 0, 9, ["KK.", "KKK", "KK."])
    stamp(g, 27, 9, [".KK", "KKK", ".KK"])
    for fx in (9, 17):
        stamp(g, fx, 22, ["K" + fill + fill + "K", "KKKK"])
    return rows(g)


def face(kind, frame=0):
    g = grid(SW, SH)
    ex = (10, 18)         # eye columns (left pixel of each 2-wide eye)
    ey = 8
    if kind == 'happy':
        if frame == 1:    # blink
            for x in ex:
                stamp(g, x, ey + 2, ["KK"])
        else:
            for x in ex:
                stamp(g, x, ey, ["KW", "KK", "KK"])
        stamp(g, 12, 13, ["K....K", ".KKKK."])
        stamp(g, 8, 12, ["B"]); stamp(g, 21, 12, ["B"])            # cheeks
    elif kind == 'calm':
        for x in ex:
            stamp(g, x - 1, ey + 1, [".KK.", "K..K"])
        stamp(g, 13, 13, ["K..K", ".KK."])
    elif kind == 'look':  # searching: pupils left, then right
        for x in ex:
            stamp(g, x - 1, ey - 1, ["KKKK"])
            stamp(g, x - 1, ey, ["KWWW", "KWWW"] if frame % 2 == 0 else ["WWWK", "WWWK"])
        stamp(g, 13, 14, ["KKKK"])
    elif kind == 'puzzled':
        stamp(g, 9, ey - 2, [".KKK"])          # raised brow over the left eye
        stamp(g, 18, ey - 1, ["KKK"])           # flat brow
        for x in ex:
            stamp(g, x, ey, ["KW", "KK"])
        stamp(g, 12, 13, [".K.K..", "K.K.KK"] if frame == 0 else ["K.K.K.", ".K.K.K"])
    elif kind == 'strain':
        stamp(g, 9, ey, ["KK..", "..KK", "KK.."])
        stamp(g, 17, ey, ["..KK", "KK..", "..KK"])
        stamp(g, 11, 13, ["KKKKKKKK"[:7], "KWWWWWK", "KKKKKKK"])
        if frame == 1:
            stamp(g, 5, 3, ["B", "B"]); stamp(g, 24, 3, ["B", "B"])     # sweat flicks
    return rows(g)


# ---------------------------------------------------------------- Lec, the electron (30 x 24)
LW, LH = 30, 24


def lec(kind, frame=0):
    """A pointy-top hexagon with gem shading (so the hexagon reads at 2x), a face, a minus-sign
    charge, and a tilted orbit ring with a little ball going round it."""
    g = grid(LW, LH)
    cx, cy, ry = 15.0, 12.0, 10.4
    m = pointy_hex_mask(LW, LH, cx, cy, ry)
    for y in range(LH):
        for x in range(LW):
            if not m[y][x]:
                continue
            dx, dy = x + .5 - cx, y + .5 - cy
            c = 'W'
            if dy > 0 and dy > -dx / math.sqrt(3) + 4.6:      # lower-right facet
                c = 'L'
            elif dy > 0 and dy > dx / math.sqrt(3) + 4.6:     # lower-left facet
                c = 'T'
            elif dx > 5.2:                                   # right facet
                c = 'T'
            g[y][x] = c
    outline(g, m)
    stamp(g, 9, 4, ["W"]); stamp(g, 8, 5, ["W"])          # glint on the upper-left facet edge
    # orbit ring: a tilted ellipse passing behind the body (drawn off the body only)
    ring = []
    for k in range(260):
        a = 2 * math.pi * k / 260
        t = -0.38
        x = cx + 14.2 * math.cos(a) * math.cos(t) - 3.6 * math.sin(a) * math.sin(t)
        y = cy + 1.0 + 14.2 * math.cos(a) * math.sin(t) + 3.6 * math.sin(a) * math.cos(t)
        xi, yi = int(math.floor(x)), int(math.floor(y))
        ring.append((xi, yi))
        if 0 <= xi < LW and 0 <= yi < LH and not m[yi][xi]:
            g[yi][xi] = 'B'
    stamp(g, 13, 6, ["KKKK"])                     # the minus sign: a negative charge on the forehead
    if kind == 'idle':
        if frame == 3:
            stamp(g, 10, 11, ["KK"]); stamp(g, 18, 11, ["KK"])
        else:
            stamp(g, 10, 9, ["KW", "KK", "KK"]); stamp(g, 18, 9, ["KW", "KK", "KK"])
        stamp(g, 12, 14, ["K....K", ".KKKK."])
        stamp(g, 8, 13, ["B"]); stamp(g, 21, 13, ["B"])
    elif kind == 'dizzy':
        sp = ["KKK", "K.K", "K.."] if frame == 0 else ["..K", "K.K", "KKK"]
        stamp(g, 9, 9, sp); stamp(g, 18, 9, sp)
        stamp(g, 13, 15, [".KK.", "K..K"])
    elif kind == 'sleep':
        stamp(g, 9, 11, ["KKK"]); stamp(g, 18, 11, ["KKK"])
        stamp(g, 14, 14, [".K.", "K.K", ".K."] if frame == 0 else [".KK", ".KK"])
    # the orbiting ball, at points of the ring that lie off the body
    off = [p for p in ring if not (0 <= p[1] < LH and 0 <= p[0] < LW and m[p[1]][p[0]])]
    if kind in ('idle', 'dizzy'):
        n = len(off)
        dx, dy = off[(n * (frame if kind == 'idle' else 2 * frame + 1) // 4 + n // 8) % n]
        dx = min(max(dx, 2), LW - 3); dy = min(max(dy, 2), LH - 3)
        stamp(g, dx - 2, dy - 2, [".KK.", "KWWK", "KWBK", ".KK."])
    return rows(g)


# ---------------------------------------------------------------- the register's echo (18 x 18)
def echo(frame=0):
    w = h = 18
    g = grid(w, h)
    m = pointy_hex_mask(w, h, 9.0, 8.0, 7.6)
    # wavy ghost hem
    for x in range(w):
        for y in range(12, h):
            m[y][x] = False
        top = 12 + ((x + frame) // 2) % 2
        for y in range(9, top + 2):
            if abs(x + .5 - 9) <= 6.6:
                m[y][x] = True
    for y in range(h):
        for x in range(w):
            if m[y][x]:
                g[y][x] = 'T'
    outline(g, m, 'B')
    stamp(g, 5, 6, ["KK", "K.", "KK"]); stamp(g, 11, 6, ["KK", ".K", "KK"])   # hollow eyes
    stamp(g, 8, 10, ["LL"])
    return rows(g)


def knob():
    g = grid(11, 11)
    m = flat_hex_mask(11, 11, 5.5, 5.5, 5.4)
    for y in range(11):
        for x in range(11):
            if m[y][x]:
                g[y][x] = 'B'
    outline(g, m)
    stamp(g, 4, 4, ["WWW", "W.W", "WWW"])
    stamp(g, 5, 5, ["K"])
    stamp(g, 3, 2, ["LL"])
    return rows(g)


ZZ = ["KKKK....", "..K.....", ".K......", "KKKK.KKK", "......K.", ".....K..", ".....KKK"]
QMARK = [".KKK.", "K...K", "....K", "..KK.", "..K..", ".....", "..K.."]
SPARK = [["...K...", "...K...", "..BKB..", "KKKWKKK", "..BKB..", "...K...", "...K..."],
         [".......", "...K...", "..LBL..", ".KBWBK.", "..LBL..", "...K...", "......."]]


def even(frames):
    """Pad every frame to even width and height, so integer scaling always centres on whole pixels."""
    w = max(len(r) for f in frames for r in f)
    h = max(len(f) for f in frames)
    w2, h2 = w + (w % 2), h + (h % 2)
    return [[r.ljust(w2, '.') for r in f] + ['.' * w2] * (h2 - len(f)) for f in frames]


def main():
    sp = {
        "sheet_a": {"frames": [sheet('T', 'L', 'B')], "fps": 1},
        "sheet_b": {"frames": [sheet('L', 'B', 'K')], "fps": 1},
        "face_happy": {"frames": [face('happy', 0)] * 5 + [face('happy', 1)], "fps": 3},
        "face_calm": {"frames": [face('calm')], "fps": 1},
        "face_look": {"frames": [face('look', 0), face('look', 1)], "fps": 1.2},
        "face_puzzled": {"frames": [face('puzzled', 0), face('puzzled', 1)], "fps": 2},
        "face_strain": {"frames": [face('strain', 0), face('strain', 1)], "fps": 6},
        "lec": {"frames": [lec('idle', f) for f in range(4)], "fps": 5},
        "lec_dizzy": {"frames": [lec('dizzy', 0), lec('dizzy', 1)], "fps": 4},
        "lec_sleep": {"frames": [lec('sleep', 0), lec('sleep', 1)], "fps": 1},
        "echo": {"frames": [echo(0), echo(1)], "fps": 3},
        "knob": {"frames": [knob()], "fps": 1},
        "zz": {"frames": [ZZ], "fps": 1},
        "qmark": {"frames": [QMARK], "fps": 1},
        "spark": {"frames": SPARK, "fps": 8},
    }
    for v in sp.values():
        v["frames"] = even(v["frames"])
    out = HERE / "web" / "sprites.json"
    lines = ['{']
    names = list(sp)
    for n in names:
        lines.append(' ' + json.dumps(n) + ': ' + json.dumps(sp[n], separators=(',', ':')) + (',' if n != names[-1] else ''))
    lines.append('}')
    out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f"{out}: {len(sp)} sprites")


if __name__ == "__main__":
    main()
