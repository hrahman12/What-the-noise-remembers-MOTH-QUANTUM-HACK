"""Compare the C++ engine's sweep render (out/cpp_sweep.f32 from tests/cpp/engine_test) with synth.py.

    python tests/compare_cpp.py
"""
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import synth  # noqa: E402

cpp = np.fromfile(HERE.parent / "out" / "cpp_sweep.f32", dtype="<f4").astype(float)
data = synth.Data()
u0, u1 = math.log10(20), math.log10(50000)
chip0 = list(data.machines)[0]
py = synth.render(data, [(57, 0.0, 24.0)], 26.0, 44100, chip=chip0, mix=1.0, model=3, attack=0.4, release=1.5,
                  le=20, autom=lambda t: {"le": 10 ** (u0 + (u1 - u0) * min(1.0, t / 24.0))})
n = min(len(cpp), len(py))
cpp, py = cpp[:n], py[:n]
err = np.abs(cpp - py)
win = 2205   # 50 ms RMS envelopes
env = lambda x: np.sqrt(np.convolve(x * x, np.ones(win) / win, mode="valid"))[::win]
corr = np.corrcoef(env(cpp), env(py))[0, 1]
print(f"samples {n}: max |cpp - py| = {err.max():.2e} (peak {np.abs(py).max():.3f}), "
      f"rms diff {np.sqrt(np.mean(err ** 2)):.2e}, 50 ms envelope correlation {corr:.6f}")
ok = err.max() < 0.01 * np.abs(py).max() and corr > 0.999
print("C++ ENGINE MATCHES PYTHON REPLICA" if ok else "MISMATCH")
sys.exit(0 if ok else 1)
