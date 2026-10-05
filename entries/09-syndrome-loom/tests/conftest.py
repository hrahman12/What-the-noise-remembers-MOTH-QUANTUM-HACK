import sys
from pathlib import Path

import pytest

PIECE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PIECE))


@pytest.fixture
def toy_cal():
    """A hand-made calibration for testing the classical code paths only (not engine data)."""
    def lv(p, L, s):
        return {"p": p, "n_logical": 4, "shots": 10,
                "se": {"job_id": "test", "logical_error_rate": L, "ler_bit0": L, "ler_bit1": L,
                       "syndrome_rate": s},
                "bare": {"job_id": "test", "logical_error_rate": L / 2}}
    return {"engine": "tamagotchi-v1", "code": "steane", "simulator": "test",
            "profiles": {"loom": {"title": "t", "noise": "n",
                                  "levels": [lv(1e-3, 0.0, 0.0), lv(5e-3, 0.0, 1.0), lv(1e-2, 1.0, 0.5)]}}}
