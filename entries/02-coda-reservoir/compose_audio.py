"""Render the challenge deliverable: coda_reservoir.wav (and an MP3 copy for the page). CLASSICAL.

The WAV is the "handoff" track from out/events.json, exactly as the page plays it:
  real codas from one recording (recorded ICIs and times, whales panned apart), a short pause,
  then the qrc-gen-v2 continuation (job "handoff") played from token prototypes, centred.
Click synthesis is in synth.py. 44.1 kHz, 16-bit, stereo.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

import synth
from codas import OUT

HERE = Path(__file__).resolve().parent
WAV = HERE / "coda_reservoir.wav"
MP3 = HERE / "web" / "audio" / "coda_reservoir.mp3"
PAN_LANE = {1: synth.PAN["1"], 2: synth.PAN["2"], 3: synth.PAN["3"], 4: synth.PAN["4"], 5: 0.0, 0: 0.0}


def offsets(ev, D):
    if ev[3] >= 0:
        ici = [x / 10000 for x in D["icis"][ev[3]]]
    else:
        v = D["vocab"][ev[1]]
        ici = [x * v["d"] for x in v["r"]]
    return [0.0] + list(np.cumsum(ici))


def main():
    D = json.loads((OUT / "events.json").read_text(encoding="utf-8"))
    tr = D["tracks"]["handoff"]
    # whales 5 and 6 share lane 5 on the page; in the WAV they keep their own pan from the corpus
    whale_of = {}
    tok = json.loads((OUT / "tokens.json").read_text(encoding="utf-8"))["codas"]
    events = []
    for ev in tr["ev"]:
        pan = PAN_LANE[ev[2]]
        if ev[3] >= 0:
            w = tok[ev[3]]["whale"]
            pan = synth.PAN.get(w, 0.0)
            whale_of[ev[3]] = w
        for o in offsets(ev, D):
            events.append((ev[0] + o, pan))
    audio = synth.render(events, tr["dur"])
    n = int(round(tr["dur"] * synth.SR))
    audio = audio[:n]
    fade = int(0.05 * synth.SR)
    audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(WAV), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(synth.SR)
        w.writeframes(pcm.tobytes())
    MP3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-i", str(WAV),
                    "-codec:a", "libmp3lame", "-b:a", "192k", str(MP3)], check=True)
    peak = float(np.max(np.abs(audio)))
    info = {"wav": WAV.name, "seconds": round(n / synth.SR, 2), "sample_rate": synth.SR, "channels": 2,
            "bits": 16, "clicks": len(events), "peak_dbfs": round(20 * np.log10(peak), 2),
            "real_codas": tr["real_n"], "reservoir_codas": tr["gen_n"], "handoff_at_s": tr["split"],
            "whales_in_real_part": sorted(set(whale_of.values()))}
    (OUT / "wav_info.json").write_text(json.dumps(info, indent=1), encoding="utf-8")
    print(json.dumps(info))


if __name__ == "__main__":
    main()
