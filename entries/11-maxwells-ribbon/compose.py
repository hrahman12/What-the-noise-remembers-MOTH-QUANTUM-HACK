"""ribbon_rebuilt.png: Maxwell's ribbon and the 112 test colours, as sent and as rebuilt by every completed
qpixl-v1 job (rows = machine, columns = shots). CLASSICAL layout of the rebuilt images written by
extract.py; pixels are only enlarged (nearest neighbour). Missing cells say "failed" / "not sent".
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
CELL, GAP, LEFT = 230, 16, 250
# the set's brief-page look (common/brand.css): paper ground, one ultramarine ink, hairline rules. Image pixels are data.
BG, INK, DIM, ONINK, LINE = (251, 250, 249), (25, 35, 142), (84, 91, 169), (251, 250, 249), (211, 211, 230)
SHOTS = [16, 128, 1024]
ROWS = [("aer", "Perfect simulator", "aer"), ("fake_fez", "Fez noise model", "fake_fez"),
        ("fake_brisbane", "Brisbane noise model", "fake_brisbane"), ("ibm_fez", "Real IBM chip", "ibm_fez")]


def font(size):
    for f in ("C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def big(img, w, h):
    return img.resize((w, h), Image.NEAREST)


def paste(im, d, img, xy):   # data image with a 1 px ink hairline round it
    im.paste(img, xy)
    d.rectangle([xy[0] - 1, xy[1] - 1, xy[0] + img.width, xy[1] + img.height], outline=INK, width=1)


def name_label(d, xy, name, hw, f):   # the hardware row gets a solid-ink pill, like the page's hardware badge
    if hw:
        x0, y0, x1, y1 = d.textbbox(xy, name, font=f)
        d.rounded_rectangle([x0 - 8, y0 - 5, x1 + 8, y1 + 5], radius=(y1 - y0 + 10) // 2, fill=INK)
        d.text(xy, name, fill=ONINK, font=f)
    else:
        d.text(xy, name, fill=INK, font=f)


def sent_colours(sw):
    strip = Image.new("RGB", (64, 28), BG)
    for i, s in enumerate(sw):
        strip.paste(tuple(s["rgb"]), ((i % 16) * 4, (i // 16) * 4, (i % 16) * 4 + 4, (i // 16) * 4 + 4))
    return strip


def main():
    sw = json.loads((HERE / "swatches.json").read_text(encoding="utf-8"))["swatches"]
    jobs = {(j["machine"], j["shots"]): j for j in json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))}
    att = [json.loads(x) for x in (OUT / "attempts.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    failed = {(a["machine"], a["shots"]) for a in att if a.get("engine") == "qpixl-v1"}
    miss = lambda m, s: "failed" if (m, s) in failed else "not run"  # noqa: E731
    f1, f2, f3 = font(28), font(17), font(13)
    rib_rows = [r for r in ROWS if r[0] != "fake_brisbane"]
    SH = int(CELL * 28 / 64)
    W = LEFT + 4 * (CELL + GAP) + GAP
    H = 90 + len(rib_rows) * (CELL + GAP + 22) + 60 + (len(ROWS) + 1) * (SH + GAP + 22) + 60
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((GAP, 18), "Maxwell's Ribbon (1861), rebuilt through qpixl-v1", fill=INK, font=f1)
    d.text((GAP, 56), "Each colour sent as its arrow's X, Y, Z numbers, stored on qubits, measured back with shots.", fill=DIM, font=f3)
    d.line([GAP, 80, W - GAP, 80], fill=INK, width=1)
    y = 90
    for c, s in enumerate(["sent in"] + [f"{s} shots" for s in SHOTS]):
        d.text((LEFT + c * (CELL + GAP), y - 2), s, fill=DIM, font=f2)
    y += 22
    for mid, name, _ in rib_rows:
        name_label(d, (GAP + 8 * mid.startswith("ibm_"), y + 8), name, mid.startswith("ibm_"), f2)
        n = 35 if mid == "aer" else 6
        paste(im, d, big(Image.open(HERE / "data" / f"ribbon_crop{n}.png").convert("RGB"), CELL, CELL), (LEFT, y))
        d.text((GAP, y + 32), f"{n}x{n} ribbon", fill=DIM, font=f3)
        for c, s in enumerate(SHOTS):
            x = LEFT + (c + 1) * (CELL + GAP)
            j = jobs.get((mid, s))
            if j:
                paste(im, d, big(Image.open(OUT / f"rebuilt_ribbon_{mid}_{s}.png").convert("RGB"), CELL, CELL), (x, y))
                d.text((x, y + CELL + 3), j["job_id"][:8] + (f"  IBM {j['ibm_job_id']}" if j.get("ibm_job_id") else ""), fill=DIM, font=f3)
            elif not mid.startswith("ibm_"):
                d.rectangle([x, y, x + CELL, y + CELL], outline=LINE, width=2)
                d.text((x + 12, y + 12), miss(mid, s), fill=DIM, font=f2)
        y += CELL + GAP + 22
    y += 20
    d.text((GAP, y), "112 test colours", fill=INK, font=f1)
    y += 44
    d.text((GAP, y + 4), "sent in", fill=INK, font=f2)
    paste(im, d, big(sent_colours(sw), CELL, SH), (LEFT, y))
    y += SH + GAP + 22
    for mid, name, _ in ROWS:
        name_label(d, (GAP + 8 * mid.startswith("ibm_"), y + 4), name, mid.startswith("ibm_"), f2)
        for c, s in enumerate(SHOTS):
            x = LEFT + (c + 1) * (CELL + GAP)
            j = jobs.get((mid, s))
            if j:
                paste(im, d, big(Image.open(OUT / f"rebuilt_colours_{mid}_{s}.png").convert("RGB"), CELL, SH), (x, y))
                d.text((x, y + SH + 3), f"{s} shots  {j['job_id'][:8]}", fill=DIM, font=f3)
            elif not mid.startswith("ibm_"):
                d.rectangle([x, y, x + CELL, y + SH], outline=LINE, width=2)
                d.text((x + 10, y + 10), miss(mid, s), fill=DIM, font=f2)
        y += SH + GAP + 22
    d.text((GAP, H - 34), "Engine outputs, rebuilt by extract.py and enlarged nearest-neighbour. Job IDs in PARAMS.md. "
           "Photo: Wikimedia Commons, public domain.", fill=DIM, font=f3)
    im.save(HERE / "ribbon_rebuilt.png")
    print(f"ribbon_rebuilt.png {W}x{H}, {len(jobs)} jobs")


if __name__ == "__main__":
    main()
