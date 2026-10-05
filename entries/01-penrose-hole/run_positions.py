"""blur-v1 at a 3x3 grid of hole positions, two settings each, for the interactive viewer.

Masks: out/masks/hole_<x>_<y>.png (white disk r=270). Outputs: out/positions/pos_<x>_<y>_<setting>.png (the
downloaded engine images; build_web.py turns each into a lossless crop under web/img/ for the page).
Writes web/positions.json listing every completed job. QUANTUM (classical statevector simulator).
"""
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from atlas.client import Atlas, AtlasError  # noqa: E402

R = 270  # 541 px bounding box -> 20 qubits per region
XS = YS = [300, 512, 724]
SETTINGS = {"scrambled": {"strength": 1.0, "style": "rx", "reach": 1.0},
            "memory": {"strength": 0.3, "style": "rx", "reach": 0.0}}


def main():
    a = Atlas()
    masks, img = HERE / "out" / "masks", HERE / "out" / "positions"
    masks.mkdir(parents=True, exist_ok=True)
    img.mkdir(parents=True, exist_ok=True)
    jobs = []
    for y in YS:
        for x in XS:
            mp = masks / f"hole_{x}_{y}.png"
            m = Image.new("L", (1024, 1024), 0)
            ImageDraw.Draw(m).ellipse([x - R, y - R, x + R, y + R], fill=255)
            m.save(mp)
            for name, params in SETTINGS.items():
                try:
                    rec = a.run("blur-v1", params, files={"image": HERE / "intact.png", "mask": mp})
                except AtlasError as e:
                    print(f"  ({x},{y}) {name} failed: {str(e)[:200]}")
                    continue
                fn = f"pos_{x}_{y}_{name}.png"
                shutil.copyfile(a.outputs(rec)["result"], img / fn)
                jobs.append({"x": x, "y": y, "r": R, "setting": name, **params,
                             "job_id": rec["job_id"], "file": f"out/positions/{fn}"})
                print(f"  {fn}  {rec['job_id']}")
    (HERE / "web" / "positions.json").write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    print(f"{len(jobs)}/{len(XS) * len(YS) * len(SETTINGS)} completed")


if __name__ == "__main__":
    main()
