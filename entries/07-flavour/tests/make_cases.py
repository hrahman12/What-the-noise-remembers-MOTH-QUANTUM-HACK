"""Reference cases from the Python replica (synth.py) for tests/test_logic.js (browser parity test).

    python tests/make_cases.py && node tests/test_logic.js
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import synth  # noqa: E402

d = synth.Data()
ids = list(d.machines)
cases = []
for chip in ids:
    for mix in (0, 0.5, 1):
        for model in (3, 2):
            for f, fl in enumerate(synth.FLAVOURS):
                for u in (1.0, 1.5, 2.7, 3.3, 4.6, 5.0):
                    X = synth.cycle_spectrum(d, chip, mix, model, fl, u)
                    tab = synth.table_from(X, 63)
                    cases.append({"chip": ids.index(chip), "mix": mix, "model": model, "f": f, "u": u,
                                  "level": synth.level(d, chip, mix, model, fl, u), "tab": tab[::8].tolist()})
(HERE / "py_cases.json").write_text(json.dumps(cases), encoding="utf-8")
print(len(cases), "cases")
