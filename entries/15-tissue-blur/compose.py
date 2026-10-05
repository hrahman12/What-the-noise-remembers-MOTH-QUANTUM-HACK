"""hero.png: measured map | blur-v1 whole section (reach 0) | blur-v1 centre lens (reach 0.5), with captions.
jobs.png: every completed job, labelled. CLASSICAL layout of downloaded engine outputs (shown unaltered:
raw RGB, one gene per channel, cropped to the band that holds the section).

The frame follows the page's look (common/brand.css): warm paper ground, one ultramarine ink for text, rules and
solid label bars, small uppercase mono labels, light headings, no glows or shadows. The engine outputs keep their
own colours (raw RGB on black), exactly as downloaded."""
import csv
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
Y0, BAND = 192, 640
PAPER, INK, INK2, RULE = (251, 250, 249), (25, 35, 142), (84, 91, 169), (211, 211, 230)   # brand.css tokens


def font(size, kind="body"):
    names = {"body": ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"],
             "light": ["segoeuil.ttf", "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"],
             "mono": ["consola.ttf", "DejaVuSansMono.ttf", "cour.ttf"]}[kind]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def band(p):
    return Image.open(p).convert("RGB").crop((0, Y0, 1024, Y0 + BAND))


def panel(img, d, x, y, w, h, label, im, f):
    """Solid ink label bar (paper mono caps) over an engine image with a 1 px ink frame."""
    d.rectangle([x, y, x + w - 1, y + 25], fill=INK)
    d.text((x + 9, y + 5), label.upper(), font=f, fill=PAPER)
    img.paste(im.resize((w, h), Image.LANCZOS), (x, y + 26))
    d.rectangle([x, y, x + w - 1, y + 26 + h], outline=INK, width=1)


def main():
    jobs = {(r["composite"], r["mask"], r["setting"]): r for r in csv.DictReader(open(OUT / "jobs.csv", encoding="utf-8"))
            if r["status"] == "completed"}
    meta = json.loads((HERE / "maps" / "maps.json").read_text(encoding="utf-8"))
    genes = " / ".join(f"{c['gene']} ({c['channel']})" for c in meta["composites"]["A"]["channels"])
    sec, lens = jobs[("A", "section", "echo")], jobs[("A", "lens_512", "plaid")]
    panels = [("1 · measured (MERFISH, classical map)", band(HERE / "maps" / "composite_A.png")),
              ("2 · blur-v1, whole-section mask, reach 0", band(OUT / sec["file"])),
              ("3 · blur-v1, centre lens, reach 0.5", band(OUT / lens["file"]))]
    PW, PH, G, TOP, CAP = 640, 400, 16, 96, 132
    img = Image.new("RGB", (3 * PW + 4 * G, TOP + 26 + PH + CAP), PAPER)
    d = ImageDraw.Draw(img)
    d.text((G, 14), "WHAT THE NOISE REMEMBERS  ·  CHALLENGE 01  ·  ONE IMAGE, ONE ENGINE", font=font(13, "mono"), fill=INK)
    d.text((G, 34), "Tissue Blur", font=font(34, "light"), fill=INK)
    d.text((G + 196, 48), "Slide a quantum lens across a mouse brain's genes.", font=font(17), fill=INK2)
    d.line([(G, TOP - 12), (img.width - G - 1, TOP - 12)], fill=INK, width=1)
    for i, (label, p) in enumerate(panels):
        panel(img, d, G + i * (PW + G), TOP, PW, PH, label, p, font(13, "mono"))
    f, y = font(14), TOP + 26 + PH + 14
    d.text((G, y), f"Mouse brain, sagittal section {meta['section']} (Zhang et al., Nature 2023; CC BY 4.0 via CZ CELLxGENE). "
                   f"{meta['cells']:,} cells. Channels: {genes}.", font=f, fill=INK)
    d.text((G, y + 22), f"Atlas blur-v1 v1.1.9, strength 1.0, rx, size 1024. Panel 2: mask box 1012 x 575 px -> 20 qubits, "
                        f"job {sec['job_id']}. Panel 3: disk box 541 x 541 px -> 20 qubits, job {lens['job_id']}.", font=f, fill=INK)
    d.text((G, y + 44), "Ran on Atlas's classical statevector simulator (blur-v1 has no QPU mode). Images are the engine's PNGs, "
                        "unaltered apart from cropping to the section and resizing.", font=f, fill=INK2)
    d.line([(G, y + 72), (img.width - G - 1, y + 72)], fill=RULE, width=1)
    d.text((G, y + 82), "THE BLUR IS A VISUAL EFFECT, NOT AN ANALYSIS METHOD: AT REACH 0.5 MOST OF THE BLURRED BRIGHTNESS "
                        "LANDS WHERE THE GENE WAS NOT DETECTED.", font=font(13, "mono"), fill=INK)
    img.save(HERE / "hero.png")

    # contact sheet of every completed job
    T, TH, M = 384, 240, 12
    rows = [r for r in csv.DictReader(open(OUT / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    cols = 4
    nrows = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (T + M) + M, 44 + nrows * (TH + 26 + 36) + M), PAPER)
    sd = ImageDraw.Draw(sheet)
    sd.text((M, 14), f"TISSUE BLUR  ·  ALL {len(rows)} BLUR-V1 JOBS (20 QUBITS EACH, ATLAS CLASSICAL STATEVECTOR SIMULATOR)",
            font=font(13, "mono"), fill=INK)
    for i, r in enumerate(rows):
        x, yy = M + (i % cols) * (T + M), 44 + (i // cols) * (TH + 26 + 36)
        name = meta["composites"][r["composite"]]["name"]
        panel(sheet, sd, x, yy, T, TH, f"{r['composite']} · {r['mask']} · reach {r['reach']}", band(OUT / r["file"]), font(12, "mono"))
        sd.text((x, yy + 26 + TH + 5), f"{name} · job {r['job_id'][:8]}", font=font(13), fill=INK2)
    sheet.save(HERE / "jobs.png")
    print("hero.png, jobs.png written")


if __name__ == "__main__":
    main()
