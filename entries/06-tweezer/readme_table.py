"""Rewrite README.md's "The day" table and its totals line from out/chain.json, piece.json and out/meta.json, so the
README never drifts from the page (no hand-copied numbers). Run after make_docs.py."""
from __future__ import annotations

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SHORT = {"Atlas simulator (quantum reservoir)": "Atlas simulator (quantum reservoir)", "Atlas simulator": "Atlas simulator",
         "Atlas statevector simulator": "statevector simulator", "Atlas stabilizer simulator (Aer)": "stabilizer simulator (Aer)",
         "Atlas simulator (Aer, exact)": "Aer, exact", "Atlas simulator (Aer)": "Aer",
         "Atlas emulator (Aer, noiseless)": "Aer emulator (noiseless)",
         "Atlas emulator (fake_fez noise model)": "emulator, fake_fez noise model"}
QUB = {"qrcimage": "not reported", "shader": "21 (budget)", "fryer": "16 per tile", "tamagotchi": "210 data (30 logical × 7)"}
FROM = {"coin": "design odds 0.5"}
PARENT = {"maze": "labyrinth", "blurmidi": "blur-midi", "retro": "retrocausal-echo"}
SIDE = {"fryer", "tamagotchi"}          # side branches: nothing downstream reads them


def f3(x):
    return "–" if x is None else f"{x:.3f}"


def main():
    chain = sorted(json.loads((HERE / "out" / "chain.json").read_text(encoding="utf-8")), key=lambda r: r["clock"])
    piece = json.loads((HERE / "piece.json").read_text(encoding="utf-8"))
    rows = ["| Time | Stage | Engine | Where it ran | Qubits | F | Chance | From |", "|---|---|---|---|---|---|---|---|"]
    for r in chain:
        if not r.get("completed"):
            why = "engine timeout on fake_fez and twice on ibm_fez" if r["id"] == "tessa" else "server timeout"
            rows.append(f"| {r['clock']} | {r['title']} | {r['engine']} | – | – | **failed** ({why}) | | |")
            continue
        w = r.get("where") or ""
        hw = "IBM hardware" in w
        where = f"**{w}**" if hw else SHORT.get(w, w)
        e = r.get("earlier")
        if e:
            where += f"; recorded run beside it: {SHORT.get(e['where'], e['where'])}, F {f3((e.get('hop') or {}).get('F'))}"
        elif (r.get("fez") or {}).get("status") == "pending":
            where += "; ibm_fez retry still queued at IBM (not counted)"
        elif (r.get("fez") or {}).get("attempts"):
            n = len(r["fez"]["attempts"])
            where += f"; ibm_fez: did not complete ({n} {'try' if n == 1 else 'tries'})"
        q = QUB.get(r["id"]) or (f"**{r['qubits']}**" if hw and (r.get("qubits") or 0) >= 100 else str(r.get("qubits") or "not reported"))
        h = r.get("hop") or {}
        par = FROM.get(r["id"]) or PARENT.get(h.get("parent"), h.get("parent") or "")
        title = r["title"] + (" (side branch)" if r["id"] in SIDE else "")
        rows.append(f"| {r['clock']} | {title} | {r['engine']} | {where} | {q} | {f3(h.get('F'))} | {f3(h.get('null'))} | {par} |")
    done = [r for r in chain if r.get("completed")]
    fez = [r for r in done if "IBM hardware (ibm_fez)" in (r.get("where") or "")]
    tama = next((r for r in done if r["id"] == "tamagotchi"), None)
    total = (f"**{len(piece['engines'])} engines completed, {piece['jobs']} completed jobs counted"
             + (f" (tamagotchi ran {len(tama.get('jobs') or [1])} settings; {sum(1 for r in done if r.get('earlier'))} stages "
                "also keep their recorded run as a labelled comparison)" if tama else "")
             + f", {len(fez)} hops on IBM ibm_fez with {piece['hardware_qubits']} qubits on IBM {piece['hardware']} at most, "
               "and 210 data qubits in the stabilizer simulation.**")
    s = (HERE / "README.md").read_text(encoding="utf-8")
    start = s.index("| Time | Stage | Engine | Where it ran |")
    end = s.index("\n\n", start)
    s = s[:start] + "\n".join(rows) + s[end:]
    s = re.sub(r"\*\*\d+ engines completed, \d+ completed jobs counted[^\n]*?stabilizer simulation\.\*\*", total, s, count=1)
    # the budget sentence, from the credit ledger and the job cache
    import sys
    sys.path.insert(0, str(HERE.parent.parent))
    sys.path.insert(0, str(HERE))
    from atlas.client import Atlas
    from lib import ledger_tally, tally_sentence
    from run import CAP
    spent = Atlas(piece="06-tweezer", credit_cap=CAP).spent()
    t = ledger_tally(chain)
    budget = (f"Credit cap {CAP:g} (50 for the recorded day, 24 for the first ibm_fez pass, 22 for one retry of each failed "
              f"ibm_fez job);\nledgered {spent:g}. From the ledger and the job cache: "
              + tally_sentence(t, "in ENGINES.md") + "\n")
    s = re.sub(r"Credit cap \d+ \(50 for the recorded day[\s\S]*?\n(?=Spent in the recorded day)", lambda m: budget, s, count=1)
    (HERE / "README.md").write_text(s, encoding="utf-8")
    print("README.md: day table and totals rewritten;", total)


if __name__ == "__main__":
    main()
