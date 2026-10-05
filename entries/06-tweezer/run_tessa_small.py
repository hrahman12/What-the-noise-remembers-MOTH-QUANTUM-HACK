"""08:15 retry on a DOWNSCALED camera frame (5 Oct 2026).

Every 64 x 64 attempt at 08:15 (ca5e2709 on fake_fez, ed0a2239 and 56cdf27d on ibm_fez) failed with engine_timeout
about 60-90 s after submission. tessa-image-v1 is a synchronous engine (GET /engines/tessa-image-v1: is_async false,
execution_mode handler), so the whole encode -> run -> decode has to finish inside the handler's time limit. This
script tries the SAME camera frame scaled down with Pillow (LANCZOS) to WxH, with fewer shots, on the emulator first
and, only if that completes, once on ibm_fez. QUANTUM (emulator / IBM hardware, labelled per attempt).

    python run_tessa_small.py 16 fake_fez 1024     # size, machine, shots
    python run_tessa_small.py 16 ibm_fez 1024

Credit cap for this retry: 4 credits on top of what the piece had spent (94), so 98 in all; each tessa run is 1 credit.
A configuration is tried at most twice. Every attempt (completed or failed) is logged to out/tessa_small.json, which
stages.stage_tessa reads. Under MOTH_FREEZE=1 nothing is submitted.

What ran (5 Oct 2026, 21:36 and 21:37 UTC): 16 x 16 on fake_fez at 1024 shots, twice (1c5e4238, 3c9b053f). Both
failed with engine_timeout about a minute after submission, still 'queued' with no progress, so the ibm_fez run (only
sent if the emulator completes) and the 32 x 32 size (only tried if 16 x 16 completes fast) were not sent. 2 credits.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
sys.path.insert(0, str(HERE))
from atlas.client import Atlas, AtlasError  # noqa: E402
from lib import OUT, dump, load  # noqa: E402

ENGINE = "tessa-image-v1"
PIECE, CAP = "06-tweezer", 98
LOG = OUT / "tessa_small.json"


def small_frame(size: int) -> Path:
    """The 07:30 camera frame (blur-v1 output, 1024 x 1024) scaled down to size x size, grey, as the stage does."""
    dst = OUT / f"tessa_in_{size}.png"
    Image.open(OUT / "fluor_camera.png").convert("L").resize((size, size), Image.LANCZOS).save(dst)
    return dst


def main():
    size, machine, shots = int(sys.argv[1]), sys.argv[2], int(sys.argv[3])
    a = Atlas(piece=PIECE, credit_cap=CAP)
    src = small_frame(size)
    params = {"machine": machine, "shots": shots}
    log = load(LOG) if LOG.exists() else []
    same = [x for x in log if x["params"] == params and x["size"] == f"{size}x{size}" and x["status"] != "completed"]
    if len(same) >= 2:          # a configuration is tried at most twice
        print(f"not submitted: {size}x{size} on {machine} at {shots} shots already failed twice "
              f"({', '.join(x['job_id'][:8] for x in same)})")
        return
    t0 = time.time()
    entry = {"engine": ENGINE, "size": f"{size}x{size}", "machine": machine, "shots": shots, "params": params,
             "input": src.name}
    try:
        rec = a.run(ENGINE, params, files={"image": src}, timeout=900 if machine.startswith("ibm_") else 600)
        entry.update({"job_id": rec["job_id"], "status": "completed", "seconds": rec.get("seconds")})
        print(f"completed {rec['job_id']} in {rec.get('seconds')} s")
    except AtlasError as e:
        msg = str(e)
        if "MOTH_FREEZE" in msg or "credit cap" in msg:
            print("not submitted:", msg[:300])
            return
        m = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", msg)
        st = {}
        if m:
            try:
                st = a.get(f"/jobs/{m.group(0)}/status")
            except AtlasError:
                st = {}
        err = st.get("error") or {}
        entry.update({"job_id": m.group(0) if m else None, "status": st.get("status") or "failed",
                      "type": err.get("type"), "error": err.get("message") or msg[:300],
                      "submitted_at": st.get("submitted_at"), "updated_at": st.get("updated_at"),
                      "seconds": round(time.time() - t0, 1)})
        print("FAILED:", json.dumps(entry)[:600])
    entry["credits"] = a.credits_per_run(ENGINE)
    log = [x for x in log if x.get("job_id") != entry.get("job_id")] + [entry]
    dump(log, LOG)
    print(f"ledgered spend {a.spent():g} of {CAP}")


if __name__ == "__main__":
    main()
