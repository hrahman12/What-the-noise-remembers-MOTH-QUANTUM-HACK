"""Thin helper around Atlas blur-core-v1 for this piece. QUANTUM step (Atlas classical statevector simulator).

- Every job goes through atlas.client.Atlas.run(), so it is cached, ledgered and capped at 8 credits.
- The Atlas API rejects request bodies over 1 MiB (HTTP 413, measured with free invalid-param probes).
  requests serialises JSON with ", " separators, which costs one extra byte per grid value, so this
  process switches requests' encoder to compact separators. The params themselves (and therefore the
  cache key) are unchanged; atlas/ is not modified.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import requests.models

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
from atlas.client import Atlas, AtlasError  # noqa: E402

PIECE, CAP = "17-quantum-lenia", 8
BODY_LIMIT = 1_048_576


class _CompactJSON:
    @staticmethod
    def dumps(obj, **kw):
        kw.setdefault("separators", (",", ":"))
        return json.dumps(obj, **kw)

    loads = staticmethod(json.loads)
    JSONDecodeError = json.JSONDecodeError


requests.models.complexjson = _CompactJSON

_atlas = None


def atlas() -> Atlas:
    global _atlas
    if _atlas is None:
        _atlas = Atlas(piece=PIECE, credit_cap=CAP)
    return _atlas


def body_bytes(params: dict) -> int:
    return len(json.dumps({"params": params}, separators=(",", ":")).encode())


def qubits_for(shape) -> int:
    """Documented rule: product of the grid dims, each padded up to a power of two."""
    return int(sum(int(np.ceil(np.log2(max(d, 1)))) if d > 1 else 0 for d in shape))


def blur(values: list, **params):
    """Run blur-core-v1 (or replay it from cache). Returns (np.ndarray, record)."""
    p = {"values": values, **params}
    size = body_bytes(p)
    if size >= BODY_LIMIT:
        raise AtlasError(f"payload {size} bytes is over the 1 MiB API limit")
    rec = atlas().run("blur-core-v1", p, timeout=1800)
    res = rec["response"]["result"]
    if isinstance(res, dict) and "output" in res:   # engine returns {"output": nested list}
        res = res["output"]
    return res, rec
