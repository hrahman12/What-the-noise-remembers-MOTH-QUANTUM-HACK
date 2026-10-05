"""WIF 1.1 writer and a minimal reader (for tests). CLASSICAL.

The draft is a jacquard-style liftplan: one shaft per warp end (straight draw), and for every pick
the list of shafts lifted. Warp is one ink-blue colour; the weft is unbleached except the red syndrome picks,
which are listed in [WEFT COLORS] (all other picks take the [WEFT] default colour).
Pick 1 is the top row of the image; end 1 is its left edge.

web/template.html carries a line-for-line JavaScript twin of to_wif(); keep them in step.
"""
from __future__ import annotations

import re

PALETTE = {1: (25, 35, 142),   # warp: ultramarine ink thread
           2: (236, 230, 216), # ground weft: unbleached
           3: (198, 45, 45)}   # syndrome weft: red
EOL = "\r\n"


def _ascii(s) -> str:
    """One line of pure ASCII (non-ASCII characters become '?'), as the JavaScript twin does."""
    return re.sub(r"[\r\n]+", " ", str(s)).encode("ascii", "replace").decode("ascii")


def to_wif(cells, weft, title="Syndrome Loom", notes=()):
    ends = len(cells[0]) if cells else 0
    picks = len(cells)
    L = ["[WIF]", "Version=1.1", "Date=April 20, 1997", "Developers=wif@mhsoft.com",
         "Source Program=syndrome-loom", "Source Version=0.1.0", "",
         "[CONTENTS]", "COLOR PALETTE=true", "TEXT=true", "WEAVING=true", "WARP=true", "WEFT=true",
         "NOTES=true", "COLOR TABLE=true", "THREADING=true", "LIFTPLAN=true", "WEFT COLORS=true", "",
         "[TEXT]", f"Title={_ascii(title)}", "Author=syndrome-loom", "",
         "[NOTES]"]
    L += [f"{i}={_ascii(n)}" for i, n in enumerate(notes, 1)]
    L += ["", "[COLOR PALETTE]", f"Entries={len(PALETTE)}", "Form=RGB", "Range=0,255", "",
          "[COLOR TABLE]"]
    L += [f"{k}={r},{g},{b}" for k, (r, g, b) in PALETTE.items()]
    L += ["", "[WEAVING]", f"Shafts={ends}", "Treadles=0", "Rising Shed=true", "",
          "[WARP]", f"Threads={ends}", "Color=1", "",
          "[WEFT]", f"Threads={picks}", "Color=2", "",
          "[THREADING]"]
    L += [f"{e}={e}" for e in range(1, ends + 1)]
    L += ["", "[LIFTPLAN]"]
    for p, row in enumerate(cells, 1):
        lifted = [str(e) for e, c in enumerate(row, 1) if c]
        if lifted:
            L.append(f"{p}={','.join(lifted)}")
    L += ["", "[WEFT COLORS]"]
    L += [f"{p}={c}" for p, c in enumerate(weft, 1) if c != 2]
    return EOL.join(L) + EOL


def parse(text: str) -> dict:
    """Parse a WIF into {section: {key: value}} (keys upper-cased sections, raw keys)."""
    out, sec = {}, None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            sec = line[1:-1].upper()
            out.setdefault(sec, {})
        elif "=" in line and sec:
            k, v = line.split("=", 1)
            out[sec][k.strip()] = v.strip()
    return out


def drawdown_from(wif: dict):
    """Rebuild cells (1 = warp lifted) and weft colour indices from a parsed WIF."""
    ends = int(wif["WEAVING"]["Shafts"])
    picks = int(wif["WEFT"]["Threads"])
    thread = {int(k): int(v) for k, v in wif["THREADING"].items()}
    default = int(wif["WEFT"]["Color"])
    cells, weft = [], []
    for p in range(1, picks + 1):
        raw = wif["LIFTPLAN"].get(str(p), "")
        lifted = {int(x) for x in raw.split(",") if x}
        cells.append([1 if thread[e] in lifted else 0 for e in range(1, ends + 1)])
        weft.append(int(wif.get("WEFT COLORS", {}).get(str(p), default)))
    return cells, weft
