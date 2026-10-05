"""Find the largest n_logical tamagotchi-v1 accepts (0 credits per job). QUANTUM (Aer stabilizer simulator on Atlas).

Each probe: alternating logical pattern (X on odd logicals), one SE round on every logical, uniform noise p=5e-3,
1024 shots. Stops at the first size that fails. Results -> engine/size_probe.json.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

SIZES = [int(s) for s in sys.argv[1:]] or [64, 128, 256, 512, 1024]
P = 5e-3


def params(n):
    acts = [["X", i] for i in range(1, n, 2)] + [["SE", list(range(n))]]
    return {"n_logical": n, "shots": 1024, "seed": 11, "actions": acts,
            "noise": {"p_1q": P, "p_gate": P, "p_idle": P, "p_meas": P}}


def main():
    a = Atlas(piece="09-syndrome-loom", credit_cap=5)
    path = HERE / "size_probe.json"
    log = json.loads(path.read_text()) if path.exists() else {}
    for n in SIZES:
        t0 = time.time()
        try:
            rec = a.run("tamagotchi-v1", params(n), timeout=1200)
        except AtlasError as e:
            print(n, "FAILED", str(e)[:800])
            log[str(n)] = {"status": "failed", "error": str(e)[:800]}
            path.write_text(json.dumps(log, indent=1))
            break
        out = rec["response"]["result"]["output"]
        pl = out["per_logical"]
        mean_le = sum(x["logical_error_rate"] for x in pl) / len(pl)
        print(n, rec["job_id"], f"{time.time()-t0:.1f}s", "n_out", out["n_logical"], "mean LER", round(mean_le, 5),
              "synd/blk", round(out["syndromes_detected"] / (out["shots"] * n), 5))
        log[str(n)] = {"status": "completed", "job_id": rec["job_id"], "seconds": rec["seconds"],
                       "n_logical": out["n_logical"], "mean_logical_error_rate": mean_le,
                       "syndromes_detected": out["syndromes_detected"], "shots": out["shots"]}
        path.write_text(json.dumps(log, indent=1))


if __name__ == "__main__":
    main()
