"""Lay each 20-neuron circuit out as an octilinear transit map (classical, deterministic, no Atlas).

Stations sit on a small square grid laid over a drawing of the brain region the circuit lives in; every
modelled bond becomes a metro line that runs at 0, 45 or 90 degrees, with at most one bend. A seeded
simulated annealing moves stations around to keep each station in or next to its home brain region (the
anchor from anatomy.py: the region holding most of its synapses in the hemibrain ROI table, refined by
glomerulus or compartment where the cell-type name gives one), to keep strong bonds short, and to avoid
lines running through other stations, lines sharing track, crossings and crowding. Like a city transit map
over real streets, positions are snapped and straightened. The layout is pure presentation: it changes no
number in the model.

Writes data/metro_layout.json, which build_web.py inlines into the page.
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment

HERE = Path(__file__).resolve().parent
COLS, ROWS = 8, 8
SEED = 2026
ITERS = 30000
ANCHOR_W = 5.0
HIT_W = 30.0     # cost of a line running through a station it does not serve (the repair pass raises it)   # cost per squared grid cell a station sits beyond its anchor's tolerance


def route(p, q, bend):
    """Octilinear polyline from p to q (grid points): straight if possible, else one bend."""
    (x1, y1), (x2, y2) = p, q
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 or dy == 0 or abs(dx) == abs(dy):
        return [p, q]
    sx, sy = (dx > 0) - (dx < 0), (dy > 0) - (dy < 0)
    m = min(abs(dx), abs(dy))
    if bend == 0:   # diagonal first
        mid = (x1 + sx * m, y1 + sy * m)
    else:           # straight first
        mid = (x2 - sx * m, y2 - sy * m)
    return [p, mid, q]


def orient(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dy == 0:
        return 0
    if dx == 0:
        return 1
    return 2 if (dx > 0) == (dy > 0) else 3


def half_points(poly):
    """Points every half cell along a polyline, with the orientation of their segment."""
    out = []
    for a, b in zip(poly, poly[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = max(abs(dx), abs(dy)) * 2
        sx, sy = dx / n, dy / n
        o = orient(a, b)
        for k in range(1, n):
            out.append((round(2 * (a[0] + k * sx)), round(2 * (a[1] + k * sy)), o))
        out.append((2 * b[0], 2 * b[1], o))
    return out[:-1]   # drop the far endpoint (a station)


def inside(pt, poly):
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def seg_dist(p, a, b):
    ax, ay = b[0] - a[0], b[1] - a[1]
    L = ax * ax + ay * ay or 1e-9
    t = max(0.0, min(1.0, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / L))
    return math.hypot(p[0] - a[0] - t * ax, p[1] - a[1] - t * ay)


def home_dist(p, a):
    """Grid distance from a station to its home region's outline (0 inside), less the 6 um allowance."""
    poly = a["gpoly"]
    if inside(p, poly):
        return 0.0
    return max(0.0, min(seg_dist(p, u, v) for u, v in zip(poly, poly[1:] + poly[:1])) - a["gptol"])


def anchor_cost(pos, anchors):
    c = 0.0
    for p, a in zip(pos, anchors):
        c += ANCHOR_W * home_dist(p, a) ** 2
        if a["gtol"] is not None:   # named glomerulus / compartment: a weaker pull
            d = math.hypot(p[0] - a["gx"], p[1] - a["gy"]) - a["gtol"]
            if d > 0:
                c += 0.4 * ANCHOR_W * d * d
    return c


def cost(pos, bends, edges, strength, anchors=None):
    occ = {tuple(p): i for i, p in enumerate(pos)}
    c = anchor_cost(pos, anchors) if anchors else 0.0
    seen = {}
    for k, e in enumerate(edges):
        i, j = e["i"], e["j"]
        poly = route(tuple(pos[i]), tuple(pos[j]), bends[k])
        L = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(poly, poly[1:]))
        c += L * (0.4 + 1.6 * strength[k])
        if len(poly) == 3:
            c += 0.9
        for (hx, hy, o) in half_points(poly):
            if hx % 2 == 0 and hy % 2 == 0:
                s = occ.get((hx // 2, hy // 2))
                if s is not None and s not in (i, j):
                    c += HIT_W   # line runs through another station
                    continue
                if s is not None:
                    continue    # at its own endpoint: junctions are fine
            seen.setdefault((hx, hy), []).append((k, o))
    for pts in seen.values():
        if len(pts) < 2:
            continue
        for a in range(len(pts)):
            for b in range(a + 1, len(pts)):
                if pts[a][0] == pts[b][0]:
                    continue
                c += 9.0 if pts[a][1] == pts[b][1] else 1.6   # shared track vs crossing
    n = len(pos)
    linked = {(e["i"], e["j"]) for e in edges} | {(e["j"], e["i"]) for e in edges}
    for i in range(n):
        for j in range(i + 1, n):
            d = max(abs(pos[i][0] - pos[j][0]), abs(pos[i][1] - pos[j][1]))
            if d == 1:
                c += 1.4 if (i, j) in linked else 4.0
    return c


def layout(circ, rng, anchors, start=None):
    nodes, edges = circ["neurons"], circ["edges"]
    wmax = max(e["w"] for e in edges)
    strength = [math.sqrt(e["w"] / wmax) for e in edges]
    cells = [(x, y) for y in range(ROWS) for x in range(COLS)]
    if start is None:
        # start: nearest free grid cells to each station's anatomical anchor
        M = np.array([[home_dist((cx, cy), a) ** 2 + 0.05 * math.hypot(cx - a["gx"], cy - a["gy"]) for (cx, cy) in cells] for a in anchors])
        r, cidx = linear_sum_assignment(M)
        pos = [list(cells[c]) for c in cidx]
        bends = [0] * len(edges)
        T0, T1, iters = 6.0, 0.03, ITERS
    else:
        # repair: a short, cool anneal from a finished layout, with lines through stations made prohibitive
        pos = [p[:] for p in start["pos"]]
        bends = [0 if len(r) < 3 or tuple(r[1]) == route(tuple(r[0]), tuple(r[-1]), 0)[1] else 1 for r in start["routes"]]
        T0, T1, iters = 0.4, 0.03, ITERS // 2
    cur = cost(pos, bends, edges, strength, anchors)
    best, best_pos, best_b = cur, [p[:] for p in pos], bends[:]
    for it in range(iters):
        T = T0 * (T1 / T0) ** (it / iters)
        npos, nb = [p[:] for p in pos], bends[:]
        u = rng.random()
        occupied = {tuple(p) for p in npos}
        if u < 0.4:
            i = rng.randrange(len(npos))
            free = [c for c in cells if c not in occupied]
            npos[i] = list(rng.choice(free))
        elif u < 0.65:
            i, j = rng.sample(range(len(npos)), 2)
            npos[i], npos[j] = npos[j], npos[i]
        elif u < 0.88:
            i = rng.randrange(len(npos))
            x, y = npos[i]
            opts = [(x + a, y + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b)
                    and 0 <= x + a < COLS and 0 <= y + b < ROWS and (x + a, y + b) not in occupied]
            if not opts:
                continue
            npos[i] = list(rng.choice(opts))
        else:
            k = rng.randrange(len(nb))
            nb[k] = 1 - nb[k]
        nc = cost(npos, nb, edges, strength, anchors)
        if nc <= cur or rng.random() < math.exp((cur - nc) / T):
            pos, bends, cur = npos, nb, nc
            if cur < best:
                best, best_pos, best_b = cur, [p[:] for p in pos], bends[:]
    # final greedy pass on bends
    for k in range(len(edges)):
        trial = best_b[:]
        trial[k] = 1 - trial[k]
        c2 = cost(best_pos, trial, edges, strength, anchors)
        if c2 < best:
            best, best_b = c2, trial
    return finish(circ, best_pos, best_b, best, strength, anchors)


def finish(circ, best_pos, best_b, best, strength, anchors):
    edges = circ["edges"]
    routes = [route(tuple(best_pos[e["i"]]), tuple(best_pos[e["j"]]), best_b[k]) for k, e in enumerate(edges)]
    # diagnostics
    hits = overlaps = crossings = 0
    occ = {tuple(p): i for i, p in enumerate(best_pos)}
    seen = {}
    for k, (e, poly) in enumerate(zip(edges, routes)):
        for (hx, hy, o) in half_points(poly):
            if hx % 2 == 0 and hy % 2 == 0 and (hx // 2, hy // 2) in occ:
                if occ[(hx // 2, hy // 2)] not in (e["i"], e["j"]):
                    hits += 1
                continue
            seen.setdefault((hx, hy), []).append((k, o))
    for pts in seen.values():
        for a in range(len(pts)):
            for b in range(a + 1, len(pts)):
                if pts[a][0] != pts[b][0]:
                    if pts[a][1] == pts[b][1]:
                        overlaps += 1
                    else:
                        crossings += 1
    off = [home_dist(p, a) for p, a in zip(best_pos, anchors)]
    return {"cols": COLS, "rows": ROWS, "pos": best_pos, "routes": [[list(p) for p in r] for r in routes],
            "stats": {"cost": round(best, 2), "through_station": hits, "shared_track_points": overlaps,
                      "crossings": crossings, "bent": sum(1 for r in routes if len(r) == 3),
                      "anchor_cost": round(anchor_cost(best_pos, anchors), 2),
                      "max_cells_beyond_home": round(max(off), 2),
                      "stations_in_home_region": sum(1 for o in off if o == 0),
                      "stations_within_1_cell_of_home": sum(1 for o in off if o <= 1.0)}}


def main():
    circ = json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))
    plate = json.loads((HERE / "data" / "brain_plate.json").read_text(encoding="utf-8"))
    out = {"note": "Presentation only: an octilinear grid layout of each circuit for the transit-map view, with each "
                   "station kept near its home brain region (anatomy.py anchors; seeded simulated annealing, "
                   "metro_layout.py). It changes no model number.",
           "seed": SEED, "circuits": {}}
    only = sys.argv[1:]   # optional: re-run only these circuits and keep the others from the existing file
    old = json.loads((HERE / "data" / "metro_layout.json").read_text(encoding="utf-8")) if only else None
    for c in circ["circuits"]:
        if only and c["id"] not in only:
            out["circuits"][c["id"]] = old["circuits"][c["id"]]
            print(c["id"], "(kept)", old["circuits"][c["id"]]["stats"])
            continue
        rng = random.Random(f"{SEED}-{c['id']}")
        best = None
        global COLS, ROWS
        COLS, ROWS = plate["zoom"][c["id"]]["cols"], plate["zoom"][c["id"]]["rows"]
        for restart in range(4):
            lay = layout(c, rng, plate["anchors"][c["id"]])
            if best is None or lay["stats"]["cost"] < best["stats"]["cost"]:
                best = lay
        if best["stats"]["through_station"]:          # never leave a line running through a station it does not serve
            global HIT_W, ANCHOR_W
            HIT_W, ANCHOR_W = 1000.0, 15.0   # lines through stations prohibitive; anatomy held three times as hard
            tries = [layout(c, random.Random(f"{SEED}-{c['id']}-repair-{k}"), plate["anchors"][c["id"]], start=best) for k in range(3)]
            HIT_W, ANCHOR_W = 30.0, 5.0
            best = min(tries, key=lambda L: (L["stats"]["through_station"] > 0, L["stats"]["max_cells_beyond_home"] > 2,
                                             -L["stats"]["stations_in_home_region"], L["stats"]["anchor_cost"]))
            best["stats"]["cost"] = round(cost(best["pos"], [0 if len(r) < 3 or tuple(r[1]) == route(tuple(r[0]), tuple(r[-1]), 0)[1] else 1 for r in best["routes"]],
                                             c["edges"], [math.sqrt(e["w"] / max(x["w"] for x in c["edges"])) for e in c["edges"]], plate["anchors"][c["id"]]), 2)
            best["stats"]["anchor_cost"] = round(anchor_cost(best["pos"], plate["anchors"][c["id"]]), 2)
        out["circuits"][c["id"]] = best
        print(c["id"], best["stats"])
    (HERE / "data" / "metro_layout.json").write_text(json.dumps(out, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
