"""README figures. CLASSICAL plotting of real data and real engine outputs.

hero.png:   GW150914 piano rolls (unblurred, blur reach 0, blur reach 0.5) over the real scalogram,
            plus the GW170817 model-guided track, all from the MIDI files on disk.
out/wav_check.png: spectrogram of wav/GW150914_chirp.wav, to check the render really chirps.
"""
from __future__ import annotations

import csv
import json
import wave
from pathlib import Path

import matplotlib
import numpy as np
from PIL import Image

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from notes_of import notes_of  # noqa: E402

HERE = Path(__file__).resolve().parent
# the page's paper/ink palette (common/brand.css), so hero.png matches Figure 3 on the page, which draws the same
# four takes live: H1 in dark ink, L1 in pale ink, the scalogram as a light ink wash, the unblurred chirp dashed
PAPER, INK, INK2, RULE = "#FBFAF9", "#19238E", "#545BA9", "#D3D3E6"
VOICE = {1: "#19238E", 2: "#7A80C8"}     # MIDI track 1 = H1 Hanford, track 2 = L1 Livingston
WASH = 0.34                              # strongest ink coverage of the scalogram, as in build_web.py


def panel(ax, ev, notes, title, ghost=None):
    info = json.loads((HERE / "out" / f"{ev}.json").read_text(encoding="utf-8"))
    g = np.asarray(Image.open(HERE / "out" / f"{ev}_scalogram.png"), float) / 255
    a = (g ** 1.4)[..., None] * WASH
    paper, ink = np.array([251, 250, 249], float), np.array([25, 35, 142], float)
    ax.imshow((paper * (1 - a) + ink * a).astype(np.uint8), extent=[0, info["t_total"], 36, 108], aspect="auto",
              interpolation="bilinear")
    if ghost:
        for s, d, p, v, tr in ghost:
            ax.add_patch(plt.Rectangle((s, p - 0.42), d, 0.84, fill=False, ec=INK, lw=0.6, alpha=0.55,
                                       linestyle=(0, (2, 1.5))))
    for s, d, p, v, tr in notes:
        ax.add_patch(plt.Rectangle((s, p - 0.42), max(d, 0.04), 0.84, color=VOICE.get(tr, INK),
                                   alpha=0.22 + 0.78 * v / 127, lw=0))
    ps = [n[2] for n in notes]
    ax.set_ylim(min(ps) - 3, max(ps) + 3)
    ax.set_xlim(0, info["t_total"])
    ax.set_facecolor(PAPER)
    ax.set_title(title, color=INK, fontsize=10, loc="left")
    ax.tick_params(colors=INK2, labelsize=7)
    for sp in ax.spines.values():
        sp.set_color(RULE)
    ax.set_ylabel("MIDI pitch", color=INK2, fontsize=7)


def main():
    jobs = {(r["event"], r["strength"], r["reach"]): r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8"))}
    orig = notes_of(HERE / "midi" / "GW150914_chirp.mid")
    fig, axs = plt.subplots(4, 1, figsize=(12, 13), facecolor=PAPER)
    panel(axs[0], "GW150914", orig, "GW150914, unblurred: one note per half-wave of the real strain (H1 dark ink, L1 pale ink), ×100 time, ×4 pitch. Classical.")
    for ax, rc in zip(axs[1:3], ("0.0", "0.5")):
        r = jobs[("GW150914", "0.5", rc)]
        panel(ax, "GW150914", notes_of(HERE / r["file"]),
              f"blur-midi-v1, strength 0.5, reach {rc}, qubits 20 (Atlas simulator), job {r['job_id']}", ghost=orig)
    panel(axs[3], "GW170817", notes_of(HERE / "midi" / "GW170817_chirp.mid"),
          "GW170817, unblurred: model-guided track (Newtonian chirp, catalogue chirp mass), loudness = real along-track power.\n"
          "No blur (jobs timed out or were never submitted).")
    axs[3].set_xlabel("music time (s)", color=INK2, fontsize=8)
    plt.tight_layout()
    plt.savefig(HERE / "hero.png", dpi=110, facecolor=PAPER)
    plt.close(fig)

    with wave.open(str(HERE / "wav" / "GW150914_chirp.wav")) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).mean(1)
    fig, ax = plt.subplots(figsize=(10, 3.5), facecolor=PAPER)
    ax.specgram(x, NFFT=4096, Fs=sr, noverlap=3072, cmap="Blues")
    ax.set_ylim(80, 1400)
    ax.set_title("wav/GW150914_chirp.wav spectrogram (render check)", color=INK, fontsize=9)
    ax.tick_params(colors=INK2, labelsize=7)
    plt.tight_layout()
    plt.savefig(HERE / "out" / "wav_check.png", dpi=80, facecolor=PAPER)
    print("hero.png, out/wav_check.png written")


if __name__ == "__main__":
    main()
