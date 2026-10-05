"""A frontal-view drawing model of the adult fruit-fly brain, and where each station belongs (classical, offline).

Everything here is presentation, built from two real sources:
  * data/neuron_rois.json (roi_profile.py): for each of the 60 hemibrain neurons, its synapses per primary ROI
    (brain region) in the hemibrain v1.2 ROI table.
  * the hemibrain cell-type and instance names, which pin a position inside some regions:
      - protocerebral bridge glomerulus (EPG(PB08)_L3 -> glomerulus L3; 1 is medial, 9 lateral),
      - mushroom-body compartment (MBON09(y3B'1) -> gamma-3; gamma-1 sits at the heel, gamma-5 at the tip),
      - antennal-lobe glomerulus (DM1_lPN -> DM1; D dorsal, V ventral, M medial, L lateral, P posterior).

The neuropil shapes are our own schematic of a frontal (anterior) view, in micrometres, with the fly's
RIGHT side on the viewer's LEFT (x < 0) and dorsal up. Proportions are approximate (overall box about
630 x 290 um, like the JRC2018 template); depth is flattened, and the mushroom-body lobes are drawn slightly
oblique so the stacked medial lobes (gamma in front, beta' and beta behind) all show.

Each station's anchor is the region holding the most of its synapses (its "home" ROI), refined by the
name where the name gives a position inside that region. metro_layout.py then snaps stations to the
transit-map grid near their anchors. Writes data/brain_plate.json.
"""
import json
import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
COLS = ROWS = 8


# ---------------------------------------------------------------------------------------------------------
# geometry helpers (micrometres, y up)
def r1(v):
    return round(v, 1)


def ellipse(cx, cy, rx, ry, rot=0.0, n=44):
    c, s = math.cos(rot), math.sin(rot)
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append([r1(cx + x * c - y * s), r1(cy + x * s + y * c)])
    return out


def catmull(pts, closed=False, per=8):
    """Catmull-Rom spline through control points."""
    P = [tuple(p) for p in pts]
    n = len(P)
    out = []
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = P[(i - 1) % n] if closed else P[max(i - 1, 0)]
        p1, p2 = P[i], P[(i + 1) % n]
        p3 = P[(i + 2) % n] if closed else P[min(i + 2, n - 1)]
        for k in range(per):
            t = k / per
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append([x, y])
    if not closed:
        out.append(list(P[-1]))
    return out


def blob(pts, per=6):
    return [[r1(x), r1(y)] for x, y in catmull(pts, closed=True, per=per)]


def polyline(pts, per=8):
    return [[r1(x), r1(y)] for x, y in catmull(pts, closed=False, per=per)]


def arclen(P):
    L = [0.0]
    for a, b in zip(P, P[1:]):
        L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return L


def at(P, f):
    """Point and unit tangent at fraction f of the polyline's length."""
    L = arclen(P)
    d = f * L[-1]
    for k in range(len(P) - 1):
        if L[k + 1] >= d or k == len(P) - 2:
            seg = (L[k + 1] - L[k]) or 1
            u = (d - L[k]) / seg
            x = P[k][0] + (P[k + 1][0] - P[k][0]) * u
            y = P[k][1] + (P[k + 1][1] - P[k][1]) * u
            tx, ty = P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]
            m = math.hypot(tx, ty) or 1
            return (x, y), (tx / m, ty / m)


def band(ctrl, width, cap=True, taper=1.0):
    """Closed outline of a thick smooth stroke along control points (round caps). taper scales the far end."""
    C = catmull(ctrl, per=10)
    L = arclen(C)
    left, right = [], []
    for k, p in enumerate(C):
        a = C[max(k - 1, 0)]
        b = C[min(k + 1, len(C) - 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        m = math.hypot(tx, ty) or 1
        nx, ny = -ty / m, tx / m
        w = width / 2 * (1 + (taper - 1) * L[k] / L[-1])
        left.append([p[0] + nx * w, p[1] + ny * w])
        right.append([p[0] - nx * w, p[1] - ny * w])
    out = left[:]
    if cap:   # round cap at the end
        p, q = C[-1], C[-2]
        ang = math.atan2(p[1] - q[1], p[0] - q[0])
        w = width / 2 * taper
        for k in range(1, 8):
            a = ang + math.pi / 2 - math.pi * k / 8
            out.append([p[0] + w * math.cos(a), p[1] + w * math.sin(a)])
    out += right[::-1]
    if cap:
        p, q = C[0], C[1]
        ang = math.atan2(p[1] - q[1], p[0] - q[0])
        w = width / 2
        for k in range(1, 8):
            a = ang + math.pi / 2 - math.pi * k / 8
            out.append([p[0] + w * math.cos(a), p[1] + w * math.sin(a)])
    return [[r1(x), r1(y)] for x, y in out]


def cross_ticks(ctrl, width, fracs):
    """Short cross-lines across a band at the given fractions (compartment / glomerulus boundaries)."""
    C = catmull(ctrl, per=10)
    out = []
    for f in fracs:
        (x, y), (tx, ty) = at(C, f)
        nx, ny = -ty, tx
        w = width / 2
        out.append([[r1(x + nx * w), r1(y + ny * w)], [r1(x - nx * w), r1(y - ny * w)]])
    return out


def mirror(pts):
    return [[r1(-x), y] for x, y in pts]


def mirror_lines(lines):
    return [mirror(l) for l in lines]


# ---------------------------------------------------------------------------------------------------------
# the brain model (right side drawn at x < 0, mirrored for the left)
BRAIN_R = [(0, 121), (-28, 131), (-78, 137), (-124, 129), (-160, 111), (-183, 86), (-193, 50), (-195, 10), (-189, -30),
           (-171, -62), (-141, -84), (-104, -96), (-80, -101), (-68, -118), (-56, -137), (-30, -150)]
MB_GAMMA = [(-70, -6), (-40, -6), (-12, -5)]
MB_BETAP = [(-66, 5), (-38, 6), (-16, 7)]
MB_BETA = [(-63, 14), (-36, 15), (-11, 16)]
MB_ALPHA = [(-66, 6), (-66, 50), (-61, 96)]
MB_ALPHAP = [(-77, 4), (-82, 46), (-80, 84)]
MB_PED = [(-71, 0), (-90, 34), (-106, 52)]
PB_ARC = [(-54, 64), (-41, 76), (-21, 84), (0, 86), (21, 84), (41, 76), (54, 64)]
W = {"gamma": 16, "betap": 8, "beta": 9, "alpha": 13, "alphap": 9, "ped": 11, "pb": 9}
EB_C, EB_R, EB_HOLE = (0, 16), 20, 7
FB_PTS = [(-46, 34), (-24, 31), (0, 30), (24, 31), (46, 34), (43, 49), (24, 60), (0, 64), (-24, 60), (-43, 49)]
NO_C = (-23, -3)
AL_C, AL_R = (-46, -64), (34, 32)
CA_C, CA_R = (-112, 64), (26, 20)
LH_C = (-160, 48)
LH_PTS = [(-150, 78), (-174, 70), (-186, 46), (-180, 22), (-160, 16), (-140, 26), (-134, 50)]
OL = {
    "LA": [(-286, 117), (-306, 72), (-317, 10), (-306, -56), (-284, -103), (-279, -98), (-296, -54), (-305, 10), (-296, 70), (-280, 112)],
    "ME": [(-262, 112), (-286, 72), (-296, 10), (-288, -52), (-262, -96), (-236, -88), (-226, -40), (-223, 10), (-227, 62), (-240, 102)],
    "LOP": [(-226, 84), (-238, 36), (-238, -26), (-226, -70), (-214, -32), (-213, 30), (-216, 72)],
    "LO": [(-210, 70), (-223, 30), (-223, -22), (-210, -64), (-198, -40), (-196, 10), (-200, 52)],
}
SOFT = {   # superior protocerebrum and the crepine: regions without a hard outline (dotted)
    "SMP": [(-6, 125), (-40, 128), (-60, 112), (-58, 86), (-40, 74), (-10, 72)],
    "SIP": [(-62, 126), (-96, 124), (-104, 104), (-88, 90), (-68, 96)],
    "SLP": [(-104, 124), (-150, 112), (-176, 92), (-160, 80), (-128, 86), (-104, 96)],
    "CRE": [(-50, 30), (-30, 34), (-6, 28), (-4, -18), (-22, -26), (-46, -20), (-56, 4)],
    "LAL": [(-30, -6), (-44, 2), (-62, -6), (-66, -26), (-50, -40), (-32, -34), (-24, -18)],
}
GALL_C, BU_C = (-50, 22), (-31, 20)

FULL = {
    "EB": "ellipsoid body", "FB": "fan-shaped body", "PB": "protocerebral bridge", "NO": "noduli",
    "LAL": "lateral accessory lobe", "GA": "gall", "BU": "bulb", "AB": "asymmetrical body", "ATL": "antler",
    "gL": "gamma lobe", "bL": "beta lobe", "b'L": "beta-prime lobe", "aL": "alpha lobe", "a'L": "alpha-prime lobe",
    "PED": "peduncle", "CA": "calyx", "SMP": "superior medial protocerebrum", "SIP": "superior intermediate protocerebrum",
    "SLP": "superior lateral protocerebrum", "CRE": "crepine", "LH": "lateral horn", "AL": "antennal lobe",
    "PLP": "posterior lateral protocerebrum", "SCL": "superior clamp", "ME": "medulla", "LO": "lobula",
    "LOP": "lobula plate", "LA": "lamina", "GNG": "gnathal ganglia", "NotPrimary": "outside the primary regions",
}


def build_shapes():
    """Every drawable part: id, short label, full name, side, depth tone ('front', 'back' or 'soft'), outline."""
    S = []

    def add(id_, lab, pts, side, tone, details=None, group=None):
        S.append({"id": id_, "lab": lab, "pts": pts, "side": side, "tone": tone, "det": details or [], "group": group or lab})

    brain = BRAIN_R + [(-x, y) for x, y in reversed(BRAIN_R[1:])]
    add("brain", "", blob(brain, per=5), "M", "outline")
    for side, sg in (("R", 1), ("L", -1)):
        f = (lambda P: P) if sg == 1 else mirror
        fl = (lambda P: P) if sg == 1 else mirror_lines
        # optic lobe
        me_layers = []
        for k, s in enumerate((0.78, 0.6)):
            cxm, cym = -258, 8
            me_layers.append(polyline([(cxm + (x - cxm) * s, cym + (y - cym) * s) for x, y in OL["ME"][:6]], per=6))
        add("LA" + side, "LA", f(blob(OL["LA"])), side, "back")
        add("ME" + side, "ME", f(blob(OL["ME"])), side, "front", fl(me_layers))
        add("LOP" + side, "LOP", f(blob(OL["LOP"])), side, "back")
        add("LO" + side, "LO", f(blob(OL["LO"])), side, "front")
        # superior protocerebrum and other soft regions
        for k, P in SOFT.items():
            add(k + side, k, f(blob(P)), side, "soft")
        # lateral horn, antennal lobe
        add("LH" + side, "LH", f(blob(LH_PTS)), side, "back")
        al_det = []
        import random
        rng = random.Random(7 if sg == 1 else 8)
        for _ in range(60):   # glomerular texture: small circles packed in the lobe
            a, q = rng.random() * 2 * math.pi, math.sqrt(rng.random()) * 0.8
            x, y = AL_C[0] + AL_R[0] * q * math.cos(a), AL_C[1] + AL_R[1] * q * math.sin(a)
            if all(math.hypot(x - d[0], y - d[1]) > 9.5 for d in al_det):
                al_det.append((x, y))
        al_lines = [ellipse(x, y, 4.6, 4.2, n=10) for x, y in al_det]
        add("AL" + side, "AL", f(ellipse(*AL_C, *AL_R, n=48)), side, "front", fl(al_lines))
        # mushroom body: calyx and peduncle behind, lobes in front
        add("CA" + side, "CA", f(ellipse(*CA_C, *CA_R, rot=0.25)), side, "back", group="MB")
        add("PED" + side, "PED", f(band(MB_PED, W["ped"])), side, "back", group="MB")
        add("aL'" + side, "a'L", f(band(MB_ALPHAP, W["alphap"])), side, "back", fl(cross_ticks(MB_ALPHAP, W["alphap"], [1 / 3, 2 / 3])), group="MB")
        add("bL" + side, "bL", f(band(MB_BETA, W["beta"])), side, "back", fl(cross_ticks(MB_BETA, W["beta"], [0.5])), group="MB")
        add("b'L" + side, "b'L", f(band(MB_BETAP, W["betap"])), side, "back", fl(cross_ticks(MB_BETAP, W["betap"], [0.5])), group="MB")
        add("aL" + side, "aL", f(band(MB_ALPHA, W["alpha"])), side, "front", fl(cross_ticks(MB_ALPHA, W["alpha"], [1 / 3, 2 / 3])), group="MB")
        add("gL" + side, "gL", f(band(MB_GAMMA, W["gamma"])), side, "front", fl(cross_ticks(MB_GAMMA, W["gamma"], [.2, .4, .6, .8])), group="MB")
        # central-complex satellites
        add("NO" + side, "NO", f(ellipse(*NO_C, 7, 6)), side, "back", group="CX")
        add("BU" + side, "BU", f(ellipse(*BU_C, 6, 5)), side, "front", group="CX")
        add("GA" + side, "GA", f(ellipse(*GALL_C, 6, 4.5, rot=0.3)), side, "front", group="CX")
    # midline structures
    add("FORAMEN", "", ellipse(0, -66, 12, 17), "M", "hole")
    # protocerebral bridge: 18 glomeruli R9 (viewer's far left) .. R1 | L1 .. L9
    add("PB", "PB", band(PB_ARC, W["pb"]), "M", "back", cross_ticks(PB_ARC, W["pb"], [k / 18 for k in range(1, 18)]), group="CX")
    fb_det = []
    for s in (0.35, 0.58, 0.8):   # layers
        fb_det.append(polyline([(x * (0.55 + 0.45 * s), 30 + (y - 30) * s) for x, y in FB_PTS[4:] + FB_PTS[:1]], per=6))
    for ang in (-0.9, -0.55, -0.2, 0.2, 0.55, 0.9):   # columns, fanning from below
        fb_det.append([[r1(math.sin(ang) * 14), r1(30 + math.cos(ang) * 4)], [r1(math.sin(ang) * 52), r1(30 + math.cos(ang) * 30)]])
    add("FB", "FB", blob(FB_PTS), "M", "back", fb_det, group="CX")
    eb_det = [ellipse(*EB_C, EB_HOLE, EB_HOLE, n=24), ellipse(*EB_C, (EB_R + EB_HOLE) / 2 + 2, (EB_R + EB_HOLE) / 2 + 2, n=36)]
    for k in range(16):   # 16 wedges
        a = 2 * math.pi * k / 16
        eb_det.append([[r1(EB_C[0] + EB_HOLE * math.cos(a)), r1(EB_C[1] + EB_HOLE * math.sin(a))], [r1(EB_C[0] + EB_R * math.cos(a)), r1(EB_C[1] + EB_R * math.sin(a))]])
    add("EB", "EB", ellipse(*EB_C, EB_R, EB_R, n=48), "M", "front", eb_det, group="CX")
    return S


# ---------------------------------------------------------------------------------------------------------
# anchors: where a station belongs
ROI_XY = {   # representative point of each region on the fly's right (x < 0); mirrored for (L)
    "EB": (0, 16), "FB": (0, 48), "PB": (0, 87), "NO": NO_C, "LAL": (-44, -18), "GA": GALL_C, "BU": BU_C,
    "gL": (-41, -6), "bL": (-37, 15), "b'L": (-41, 6), "aL": (-60, 52), "a'L": (-78, 46), "PED": (-90, 32),
    "CA": CA_C, "SMP": (-30, 84), "SIP": (-82, 108), "SLP": (-132, 94), "CRE": (-24, -16), "LH": LH_C,
    "AL": AL_C, "PLP": (-170, 10), "SCL": (-110, 30), "ATL": (-14, 100),
}
ROI_TOL = {"EB": EB_R * .95, "NO": 7, "PB": 6, "gL": 9, "bL": 7, "b'L": 6, "aL": 8, "a'L": 7, "PED": 8, "CA": 18,
           "SMP": 16, "SIP": 14, "SLP": 18, "CRE": 10, "LH": 18, "AL": 22, "LAL": 12, "GA": 5, "BU": 5}
ROI_TOL.update({"gL": 24, "bL": 20, "b'L": 20, "aL": 22, "a'L": 20})   # whole lobe when no compartment is named
ZOOM = {   # each circuit's plate: left edge x0, top edge y1, cell size c (um) and size of its transit grid
    "compass": {"x0": -54.0, "y1": 92.0, "c": 13.5, "cols": 9, "rows": 9, "title": "central complex"},
    "memory": {"x0": -92.0, "y1": 80.0, "c": 11.0, "cols": 10, "rows": 10, "title": "right mushroom body"},
    "smell": {"x0": -180.0, "y1": 92.0, "c": 18.0, "cols": 10, "rows": 10, "title": "right olfactory pathway"},
}


def roi_key(roi):
    """'gL(R)' -> ('gL', 'R'); 'EB' -> ('EB', 'M')."""
    m = re.match(r"^(.*?)\((L|R)\)$", roi)
    return (m.group(1), m.group(2)) if m else (roi, "M")


def side_x(x, side):
    return -x if side == "L" else x


def pb_glomerulus_x(g):
    """Glomerulus 'R7' or 'L3' -> x on the bridge arc (R on the viewer's left, 1 medial, 9 lateral)."""
    side, k = g[0], int(g[1:])
    idx = 9 - k if side == "R" else 8 + k   # 0 = R9 ... 8 = R1, 9 = L1 ... 17 = L9
    C = catmull(PB_ARC, per=10)
    (x, y), _ = at(C, (idx + 0.5) / 18)
    return x, y


MB_PARTS = {"y": ("gL", MB_GAMMA, 5), "B'": ("b'L", MB_BETAP, 2), "B": ("bL", MB_BETA, 2), "a'": ("a'L", MB_ALPHAP, 3), "a": ("aL", MB_ALPHA, 3)}


def mb_compartments(name):
    """'MBON12(y2a'1)_R' -> [('y', 2), ("a'", 1)]  (hemibrain spells gamma 'y' and beta 'B')."""
    m = re.search(r"\((y[^)]*|B[^)]*|a[^)]*)\)", name)
    if not m:
        return []
    s = m.group(1).split(">")[0]
    return [(p, int(n)) for p, n in re.findall(r"(y|B'|B|a'|a)(\d)", s)]


def mb_point(part, num):
    roi, ctrl, n = MB_PARTS[part]
    C = catmull(ctrl, per=10)
    (x, y), _ = at(C, (num - 0.5) / n)
    return roi, (x, y)


def al_glomerulus_xy(g):
    """Approximate glomerulus position from its name letters (D dorsal, V ventral, M medial, L lateral)."""
    m = re.match(r"^(D|V|DA|DL|DM|DC|DP|VA|VC|VL|VM|VP)(\d+)([a-z]?)", g)
    pre, num, sub = m.group(1), int(m.group(2)), m.group(3)
    dx = (0.5 if "M" in pre[1:] else -0.5 if "L" in pre[1:] else 0) + (0.2 if sub == "m" else -0.2 if sub == "l" else 0)
    dy = (0.55 if pre.startswith("D") else -0.55 if pre.startswith("V") else 0) + (0.15 if sub == "d" else -0.15 if sub == "v" else 0)
    # medial is towards the midline (+x for the right lobe)
    return AL_C[0] + dx * AL_R[0], AL_C[1] + dy * AL_R[1]


def anchor_for(neuron, prof):
    tot = prof["total"]
    s = sum(v for k, v in tot.items() if k != "NotPrimary") or 1
    ranked = [(k, v / s) for k, v in tot.items() if k != "NotPrimary"]
    home, frac = ranked[0]
    base, side = roi_key(home)
    x, y = ROI_XY[base]
    x = side_x(x, side)
    tol = ROI_TOL.get(base, 12)
    ref, how = None, f"the region that holds the most of its synapses ({100 * frac:.0f}%)"
    inst = neuron["instance"]
    if base == "PB":
        m = re.search(r"_([LR]\d)([LR]\d)?(?:_|$)", inst)
        if m:
            gs = [g for g in m.groups() if g]
            pts = [pb_glomerulus_x(g) for g in gs]
            x, y = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
            ref = "+".join(gs)
            tol = 5 if len(gs) == 1 else 12
            how += "; glomerulus " + ("s " if len(gs) > 1 else " ") + " and ".join(gs) + " from the instance name"
    if base in ("gL", "bL", "b'L", "aL", "a'L"):
        comps = [c for c in mb_compartments(inst) if MB_PARTS[c[0]][0] == base]
        if comps:
            pts = [mb_point(p, n)[1] for p, n in comps]
            x, y = side_x(sum(p[0] for p in pts) / len(pts), side), sum(p[1] for p in pts) / len(pts)
            nm = {"y": "γ", "B'": "β'", "B": "β", "a'": "α'", "a": "α"}
            ref = "".join(nm[p] + str(n) for p, n in comps)
            tol = 5
            how += f"; compartment {ref} from the cell-type name"
    if base == "AL":
        g = neuron["type"].split("_")[0]
        try:
            x, y = al_glomerulus_xy(g)
            x = side_x(x, side)
            ref = g
            tol = 7
            how += f"; glomerulus {g} placed from its name (approximate)"
        except AttributeError:
            pass
    shape = base if base in ("EB", "FB", "PB") else base.replace("a'L", "aL'") + side
    return {"roi": home, "base": base, "side": side, "pct": round(100 * frac), "x": r1(x), "y": r1(y), "tol": tol,
            "ref": ref, "how": how, "shape": shape,
            "top": [[k, round(100 * v)] for k, v in ranked[:4]]}


def to_grid(z, x, y):
    return (x - z["x0"]) / z["c"], (z["y1"] - y) / z["c"]


def main():
    circ = json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))
    rois = json.loads((HERE / "data" / "neuron_rois.json").read_text(encoding="utf-8"))
    shapes = build_shapes()
    anchors = {}
    for c in circ["circuits"]:
        z = ZOOM[c["id"]]
        lst = []
        for n in c["neurons"]:
            a = anchor_for(n, rois["neurons"][str(n["bodyId"])])
            gx, gy = to_grid(z, a["x"], a["y"])
            # home region: any grid point inside its outline (or within 6 um of it); where the name pins a
            # glomerulus or compartment, a weaker pull towards that point as well (one compartment either way is fine)
            sh = next(t for t in shapes if t["id"] == a["shape"])
            a["gpoly"] = [[round(v, 3) for v in to_grid(z, *p)] for p in sh["pts"][::2]]
            a["gptol"] = round(6 / z["c"], 3)
            a["gx"], a["gy"] = round(gx, 3), round(gy, 3)
            a["gtol"] = round(max(a["tol"], 12) / z["c"], 3) if a["ref"] else None
            lst.append(a)
        anchors[c["id"]] = lst
        print(c["id"])
        for n, a in zip(c["neurons"], lst):
            print(f"   {n['instance']:32s} {a['roi']:7s} {a['pct']:3d}%  ref={a['ref']!s:8s} grid=({a['gx']:.2f},{a['gy']:.2f}) tol={a['gtol']}")
    bonds = {}
    for k, d in rois["bonds"].items():   # where the synapses of each modelled bond sit
        s = sum(v for r, v in d.items() if r != "NotPrimary") or 1
        bonds[k] = [[r, round(100 * v / s)] for r, v in d.items() if r != "NotPrimary"][:3]
    out = {"note": "Schematic frontal view of the adult Drosophila brain, micrometres, fly's right on the viewer's left, "
                   "dorsal up; our own drawing with approximate proportions (anatomy.py). Station anchors come from the "
                   "hemibrain v1.2 ROI table (roi_profile.py) and the cell-type names.",
           "bbox": [-318, -153, 318, 138], "cols": COLS, "rows": ROWS, "shapes": shapes, "zoom": ZOOM,
           "anchors": anchors, "bonds": bonds, "full": FULL,
           # approximate extent of the hemibrain volume: the right central brain, part of the right optic lobe and
           # the medial left brain (the export has ME(R), LO(R), the left MB lobes and AL(L), but no CA(L) or LH(L))
           "hemibrain": {"x0": -250, "x1": 86}}
    (HERE / "data" / "brain_plate.json").write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote data/brain_plate.json", len(shapes), "shapes")


if __name__ == "__main__":
    main()
