"""Submit (or resume) one stage's ibm_fez job without waiting, so several IBM queues run in parallel.

    python qpu_submit.py comet coin        # submits P_COMET / P_COIN on stages.HW (ibm_fez) and returns at once
    python run.py                          # later: resumes and collects every pending job, then builds the chain

Only the two stages whose parameters do not depend on earlier stages are listed here; every other hardware stage is
submitted by run.py itself (TWEEZER_QPU_WAIT=5 python run.py submits them all and leaves them pending).
"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent)); sys.path.insert(0, str(HERE))
from atlas.client import Atlas, AtlasError  # noqa: E402
import stages  # noqa: E402
from run import CAP, PIECE  # noqa: E402

a = Atlas(piece=PIECE, credit_cap=CAP)
for which in sys.argv[1:]:
    eng, p = {"coin": ("coin-toss-v1", stages.P_COIN), "comet": ("comet-qrng-v1", stages.P_COMET)}[which]
    try:
        rec = a.run(eng, p, timeout=5)
        print(which, "completed", rec["job_id"])
    except AtlasError as e:
        print(which, str(e)[:300])
