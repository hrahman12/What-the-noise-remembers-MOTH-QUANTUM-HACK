"""hero.png = intact | blur-v1 output | classical rebuild, with a caption strip. Also sweep.png.

Drawn in the same Moth Hack brief palette as the interactive page (common/brand.css): warm paper #FBFAF9 and one
ultramarine ink #19238E for text, rules and label bars. The tiling images keep their own colours (engine output).
"""
import csv
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
HERO = "blur_s1.0_rx_r1.0.png"
INK, INK2, PAPER = (25, 35, 142), (84, 91, 169), (251, 250, 249)   # --ink, --ink-2, --paper in common/brand.css


def font(size):
    for name in ("DejaVuSans.ttf", "arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    jobs = {r["file"]: r for r in csv.DictReader(open(OUT / "jobs.csv", encoding="utf-8"))}
    j = jobs[HERO]
    panels = [("1  intact", Image.open(HERE / "intact.png")),
              ("2  erased by blur-v1", Image.open(OUT / HERO)),
              ("3  rebuilt from the substitution rule", Image.open(HERE / "rebuilt.png"))]
    W, G, TOP, CAP = 512, 16, 56, 92
    img = Image.new("RGB", (3 * W + 4 * G, TOP + W + CAP), PAPER)
    d = ImageDraw.Draw(img)
    d.text((G, 14), "The Hole in the Penrose", font=font(28), fill=INK)
    for i, (label, p) in enumerate(panels):
        x = G + i * (W + G)
        img.paste(p.convert("RGB").resize((W, W), Image.LANCZOS), (x, TOP))
        d.rectangle([x - 1, TOP - 1, x + W, TOP + W], outline=INK, width=1)   # 1 px hairline frame
        d.rectangle([x, TOP, x + 300, TOP + 24], fill=INK)                    # solid ink label bar
        d.text((x + 7, TOP + 4), label, font=font(15), fill=PAPER)
    f = font(15)
    y = TOP + W + 12
    d.text((G, y), f"Panel 2: Atlas blur-v1 v1.1.9, 1024 px image + disk mask (r=270 px, 20 qubits), strength={j['strength']}, "
                   f"style={j['style']}, reach={j['reach']}, size=1024 (default).  job_id {j['job_id']}", font=f, fill=INK)
    d.text((G, y + 24), "Ran on Atlas's classical statevector simulator (blur-v1 has no QPU mode). "
                        "Panel 3 is classical geometry: the same Robinson-triangle deflation, repainted inside the hole.",
           font=f, fill=INK)
    d.text((G, y + 48), "Penrose tilings form quantum error-correcting codes in which erasures of any finite region "
                        "can be recovered (Li & Boyle, arXiv:2311.13040). Atlas did not run that code.", font=f, fill=INK2)
    img.save(HERE / "hero.png")

    # sweep sheet: every completed job, labelled
    T = 256
    files = [r for r in jobs.values() if r["status"] == "completed"]
    sheet = Image.new("RGB", (4 * T + 5 * 8, 3 * (T + 24) + 8), PAPER)
    sd = ImageDraw.Draw(sheet)
    for i, r in enumerate(files):
        x, y = 8 + (i % 4) * (T + 8), 8 + (i // 4) * (T + 24)
        sheet.paste(Image.open(OUT / r["file"]).convert("RGB").resize((T, T), Image.LANCZOS), (x, y))
        sd.text((x, y + T + 3), f"strength {r['strength']}  {r['style']}  reach {r['reach']}  {r['job_id'][:8]}",
                font=font(12), fill=INK)
    sheet.save(HERE / "sweep.png")
    print("hero.png, sweep.png written")


if __name__ == "__main__":
    main()
