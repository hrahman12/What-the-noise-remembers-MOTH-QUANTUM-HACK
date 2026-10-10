"""Render a piece's deck to PDF and pack its form zip: python common/piece_zip.py <slug> [<slug> ...]

For each slug: reads the deck files in <scratch>/decks/p<NN>/ (deck.json, slides, args.json), maps each /_blob/<id>
back to the local image in submission/<slug>/deck_img/ via args.json, renders <Title>.pdf with common/qa/deck_pdf.cjs,
and writes submission/<NN>_<Title>.zip with: HERO image, the 5 numbered images, the PDF, FORM_TEXT.md (if present)
and LINKS.txt.
"""
import glob
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCR = Path(os.environ["TEMP"]) / "claude" / "C--Users-Rahma-OneDrive-Desktop-MOTH-QUANTUM" / "abc1849e-0bb4-4519-a365-7fdd300b83b2" / "scratchpad"
SITE = "https://what-the-noise-remembers.vercel.app/"
REPO = "https://github.com/hrahman12/What-the-noise-remembers-MOTH-QUANTUM-HACK"


def pack(slug):
    n = slug[:2]
    deck = SCR / "decks" / f"p{n}"
    sub = ROOT / "submission" / slug
    pj = json.loads((ROOT / "entries" / slug / "piece.json").read_text(encoding="utf-8"))
    title = pj["title"]
    ch = str(pj.get("challenge", ""))[:2]
    safe = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-")
    args = json.loads((deck / "args.json").read_text(encoding="utf-8"))
    imgdir = sub / "deck_img"
    blobmap = {}
    for k, v in args.get("blobs", {}).items():
        fname = k.split(":")[0].strip()
        cands = [imgdir / fname] + [Path(p) for p in glob.glob(str(imgdir / (Path(fname).stem + ".*")))]
        hit = next((c for c in cands if c.exists()), None)
        if hit:
            blobmap[v] = str(hit)
        else:
            print(f"  ! {slug}: no local file for {fname}")
    mp = sub / "blobmap.json"
    mp.write_text(json.dumps(blobmap), encoding="utf-8")
    pdf = sub / f"{safe}.pdf"
    subprocess.run(["node", "deck_pdf.cjs", str(deck), str(mp), str(pdf)], cwd=ROOT / "common" / "qa", check=True)
    deck_url = args.get("deck_url", "")
    files = sorted(glob.glob(str(sub / "HERO_*"))) + sorted(f for f in glob.glob(str(sub / "[1-5]_*")))
    top = f"{n}_{safe}__Challenge-{ch}/"
    z = ROOT / "submission" / "zips" / f"{n}_{safe}__Challenge-{ch}.zip"
    z.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, top + os.path.basename(f))
        zf.write(pdf, top + pdf.name)
        if (sub / "FORM_TEXT.md").exists():
            zf.write(sub / "FORM_TEXT.md", top + "FORM_TEXT.md")
        zf.writestr(top + "LINKS.txt", f"Play it: {SITE}pieces/{slug}/\nCode: {REPO}\n" + (f"Presentation (editable): {deck_url}\n" if deck_url else ""))
    print(f"{slug}: {pdf.name} ({pdf.stat().st_size / 1e6:.1f} MB), zip {z.name} ({z.stat().st_size / 1e6:.1f} MB), {len(files)} images")
    return z


if __name__ == "__main__":
    for s in sys.argv[1:]:
        pack(s)
