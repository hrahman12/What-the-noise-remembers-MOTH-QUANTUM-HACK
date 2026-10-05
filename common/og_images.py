"""Link-preview cards (Open Graph, 1200x630) for the static site: python common/og_images.py [docs_dir]

Writes <docs>/og/hub.png and <docs>/og/<slug>.png in the paper-and-ink look, from each piece's hero image
(submission/<slug>/HERO_*.png, else entries/<slug>/hero.png). export_static.py points og:image at these.
"""
import glob
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs"
OUT = DOCS / "og"
PAPER, INK, INK2, ACCENT, RULE = (251, 250, 249), (25, 35, 142), (84, 91, 169), (180, 84, 26), (211, 211, 230)
F = "C:/Windows/Fonts/"


def font(name, size):
    try:
        return ImageFont.truetype(F + name, size)
    except OSError:
        return ImageFont.load_default()


def hero(slug):
    c = sorted(glob.glob(str(ROOT / "submission" / slug / "HERO_*"))) or [str(ROOT / "entries" / slug / "hero.png")]
    return Image.open(c[0]).convert("RGB")


def fit(im, w, h):
    im = im.copy()
    im.thumbnail((w, h), Image.LANCZOS)
    box = Image.new("RGB", (w, h), PAPER)
    box.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return box


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if draw.textlength(t, font=fnt) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


def piece_card(slug, p):
    img = Image.new("RGB", (1200, 630), PAPER)
    img.paste(cover(hero(slug), 560, 630), (640, 0))
    d = ImageDraw.Draw(img)
    d.line([(640, 0), (640, 630)], fill=RULE, width=2)
    ch = str(p.get("challenge", ""))
    d.text((56, 56), f"MOTH HACK 2026 · CHALLENGE {ch[:2]}", font=font("consola.ttf", 22), fill=ACCENT)
    y = 104
    for ln in wrap(d, p["title"], font("segoeuib.ttf", 60), 540)[:2]:
        d.text((56, y), ln, font=font("segoeuib.ttf", 60), fill=INK)
        y += 72
    y += 14
    for ln in wrap(d, p.get("hook", ""), font("segoeui.ttf", 30), 540)[:4]:
        d.text((56, y), ln, font=font("segoeui.ttf", 30), fill=INK2)
        y += 40
    d.line([(56, 530), (584, 530)], fill=RULE, width=2)
    d.text((56, 548), "What the Noise Remembers", font=font("segoeuib.ttf", 26), fill=INK)
    d.text((56, 584), "22 playable quantum pieces · Moth Quantum Atlas", font=font("consola.ttf", 19), fill=INK2)
    return img


def hub_card(pieces):
    img = Image.new("RGB", (1200, 630), PAPER)
    picks = ["05-jam-the-bat", "17-quantum-lenia", "03-moth-eye", "01-penrose-hole", "13-moth-to-flame", "15-tissue-blur"]
    for k, s in enumerate(picks):
        x, y = 600 + (k % 2) * 300, (k // 2) * 210
        img.paste(cover(hero(s), 298, 208), (x + 1, y + 1))
    d = ImageDraw.Draw(img)
    d.text((56, 64), "MOTH HACK 2026 · 22 ENTRIES · 11 CHALLENGES", font=font("consola.ttf", 22), fill=ACCENT)
    y = 112
    for ln in ["What the Noise", "Remembers"]:
        d.text((56, y), ln, font=font("segoeuib.ttf", 72), fill=INK)
        y += 86
    y += 16
    for ln in wrap(d, "22 playable quantum pieces: a signal hides, gets lost in noise, and is rebuilt. Real Atlas jobs, on simulators and IBM ibm_fez up to 156 qubits.", font("segoeui.ttf", 28), 500):
        d.text((56, y), ln, font=font("segoeui.ttf", 28), fill=INK2)
        y += 38
    d.text((56, 572), "Play in your browser · no login", font=font("consola.ttf", 20), fill=INK)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pieces = {}
    for pj in sorted((ROOT / "entries").glob("*/piece.json")):
        pieces[pj.parent.name] = json.loads(pj.read_text(encoding="utf-8"))
    hub_card(pieces).save(OUT / "hub.png", optimize=True)
    for s, p in pieces.items():
        piece_card(s, p).save(OUT / f"{s}.png", optimize=True)
    print(f"wrote {len(pieces) + 1} cards to {OUT}")


if __name__ == "__main__":
    main()
