"""Write web/sprites.json, the ONE pixel-art file the page and the hub mascot read (common/SPRITES.md rule 5).

Realism pass (5 Oct 2026): the cartoon cast (big-eyed moth, cartoon bat, smiling bulb) is retired; the old script
and its output are kept for reference in qa/make_sprites.cartoon-cast.py and qa/sprites.cartoon-cast.json.
The page's scene is now an engraved SVG plate (make_plates.py). The one sprite left is the mascot:

  mothhead  96 x 96 px, five ink tones: the hawkmoth head of the plate (compound eye, labial palp, coiled
            proboscis, scape and antenna base, thorax scales) rasterised from the same geometry by
            make_plates.mascot_rows (PIL, 8x supersampled, snapped to the palette), framed as a loupe.

Usage: python make_sprites.py
       python ../../common/mascot.py web/sprites.json mothhead web/img/mascot.png --scale 2   (-> 192 x 192 px)
"""
import json
from pathlib import Path

import make_plates

HERE = Path(__file__).resolve().parent
OUT = HERE / "web" / "sprites.json"

if __name__ == "__main__":
    sp = {"mothhead": {"frames": [make_plates.mascot_rows(96)], "fps": 1}}
    OUT.write_text("{\n" + ",\n".join(f' "{k}": ' + json.dumps(v, separators=(",", ":")) for k, v in sp.items()) + "\n}\n", encoding="utf-8")
    print(f"{OUT.relative_to(HERE)}: {len(sp)} sprite, {OUT.stat().st_size / 1024:.1f} KB")
