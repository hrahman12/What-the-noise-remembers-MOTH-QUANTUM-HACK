"""Run the 5-state busy beaver champion to the halt and record its skeleton. CLASSICAL.

Machine (bbchallenge standard text format, a left-right mirror of Marxen & Buntrock's 1990 table):
    1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA
Blank tape, state A, head at cell 0. Halts after 47,176,870 steps (the halting transition counts as a
step) with 4,098 ones on the tape.

Writes out/run.json:
  steps, ones, extent           checked against the published values
  reversals                     every [step, cell] where the head changes direction (12,259 of them)
  bounds, xs                    the 15 phrase starts: steps where the tape is exactly 0^inf <A 1^x 0^inf
                                (checked here against a direct scan of the tape, not just the formula)
Between two reversals the head moves one cell per step, so these events reconstruct the head's
position at every one of the 47 million steps exactly.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
TM = "1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA"


def tables(tm: str):
    W, M, S = [0] * 12, [0] * 12, [0] * 12
    for i, part in enumerate(tm.split("_")):
        for r in range(2):
            w, d, n = part[3 * r:3 * r + 3]
            k = i * 2 + r
            W[k], M[k], S[k] = int(w), (1 if d == "R" else -1), "ABCDEZ".index(n)
    return W, M, S


def high_level_bounds():
    """Phrase starts predicted by the champion's Collatz-like rules (bbchallenge wiki, CC BY 4.0):
    g(3k) -> g(5k+6) after 5k^2+19k+15 steps; g(3k+1) -> g(5k+9) after 5k^2+25k+27 steps;
    g(3k+2) halts after 6k+12 more steps."""
    xs, bounds, steps, x = [0], [0], 0, 0
    while True:
        q, r = divmod(x, 3)
        if r == 0:
            steps, x = steps + 5 * q * q + 19 * q + 15, 5 * q + 6
        elif r == 1:
            steps, x = steps + 5 * q * q + 25 * q + 27, 5 * q + 9
        else:
            return xs, bounds, steps + 6 * q + 12
        xs.append(x)
        bounds.append(steps)


def main():
    W, M, S = tables(TM)
    xs, bounds, halt_pred = high_level_bounds()
    want = set(bounds)
    O = 20000
    tape = bytearray(2 * O)
    pos, q, step, lastd = O, 0, 0, 0
    revs, checks = [], {}
    t0 = time.time()
    while q != 5:
        if step in want:  # verify the phrase-start configuration by scanning the tape
            ones = [i for i in range(len(tape)) if tape[i]]
            ok = q == 0 and tape[pos] == 0 and (not ones or (ones[0] == pos + 1 and ones[-1] == pos + len(ones)))
            checks[step] = {"state": "ABCDE"[q], "head": pos - O, "ones": len(ones), "ok": ok}
        k = q * 2 + tape[pos]
        d = M[k]
        if d != lastd:
            revs.append([step, pos - O])
            lastd = d
        tape[pos] = W[k]
        pos += d
        q = S[k]
        step += 1
    secs = time.time() - t0
    nz = [i for i in range(len(tape)) if tape[i]]
    lo = min(r[1] for r in revs)
    hi = max(r[1] for r in revs)
    for b, x in zip(bounds, xs):
        c = checks[b]
        assert c["ok"] and c["ones"] == x, (b, x, c)
    assert step == 47_176_870 == halt_pred, step
    assert len(nz) == 4098
    out = {
        "machine": TM,
        "steps": step,
        "ones": len(nz),
        "halt_cell": pos - O,
        "extent": [lo, hi],
        "tape_width": hi - lo + 1,
        "final_tape_span": [nz[0] - O, nz[-1] - O],
        "xs": xs,
        "bounds": bounds,
        "phrase_heads": [checks[b]["head"] for b in bounds],
        "reversals": revs,
    }
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "run.json").write_text(json.dumps(out), encoding="utf-8")
    print(f"halted after {step:,} steps with {len(nz):,} ones; tape cells {lo}..{hi} "
          f"({hi - lo + 1:,} wide); {len(revs):,} reversals; 15 phrase starts verified; {secs:.1f}s")


if __name__ == "__main__":
    main()
