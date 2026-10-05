"""Assemble web/index.html: inline the shared brand CSS, the track/job data, the synthetic click, and the cast
(web/sprites.json plus the shared common/inksprite.js helper). Also exports the mascot PNG from the same sprites.

The page replays cached, real qrc-gen-v2 outputs (out/events.json); it never calls Atlas.
Run after tokenise.py, run_reservoir.py, build_events.py and compose_audio.py.
"""
import base64
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
ROOT = HERE.parent.parent
BRAND = ROOT / "common" / "brand.css"
INKSPRITE = ROOT / "common" / "inksprite.js"
SPRITES = WEB / "sprites.json"
sys.path.insert(0, str(BRAND.parent))
from ascii_html import to_ascii  # noqa: E402
from mascot import render as render_sprite  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set)

import synth  # noqa: E402


def b64_int16(x, scale=1.0):
    pcm = np.clip(np.asarray(x) * scale, -1, 1)
    return base64.b64encode((pcm * 32767).astype("<i2").tobytes()).decode("ascii")


def main():
    D = json.loads((HERE / "out" / "events.json").read_text(encoding="utf-8"))
    train = json.loads((HERE / "out" / "jobs.json").read_text(encoding="utf-8"))["train"]
    wav = json.loads((HERE / "out" / "wav_info.json").read_text(encoding="utf-8"))
    loss = json.loads((HERE / "out" / "train_loss.json").read_text(encoding="utf-8"))
    D["loss"] = (f"Training job {train['job_id']} took {train['seconds']:.0f} s from submission to result. "
                 f"The engine reported its training loss falling from {loss[0]:.2f} to {loss[-1]:.2f} over "
                 f"{len(loss)} epochs. That is the engine's own loss on its training windows, not a held-out "
                 "accuracy, so we read nothing more into it.")
    first = D["tracks"]["handoff"]["ev"][0][0]          # the first real coda's start time in the WAV
    D["wav"] = (f"{wav['seconds']:.1f} s, 44.1 kHz, 16-bit stereo. {first:.1f} to {wav['handoff_at_s'] - 1.5:.1f} s: "
                f"{wav['real_codas']} real codas from one recording, callers labelled {', '.join(wav['whales_in_real_part'])}. "
                f"From {wav['handoff_at_s']:.1f} s: {wav['reservoir_codas']} codas from qrc-gen-v2 job "
                f"{D['jobs']['handoff']['job_id']}, warmed up on those real codas.")
    D["wavSeconds"] = wav["seconds"]
    p = train["params"]                                  # the training job's own submitted parameters (out/jobs.json)
    D["jobs"]["train"] = {"engine": "qrc-train-v2", "job_id": train["job_id"],
                          "params": (f"num_qubits {p['num_qubits']} (engine max) · sequence {train['sequence_len']:,} tokens"
                                     f" · epochs {p['epochs']} · shots {p['shots']:,} · mixing {p['mixing']}"
                                     f" · num_random_gates {p['num_random_gates']} · sample_length {p['sample_length']}"
                                     f" · washout {p['washout']} · seed {p['seed']}")}
    piece = json.loads((HERE / "piece.json").read_text(encoding="utf-8"))
    assert piece["jobs"] == len(D["jobs"]), (piece["jobs"], len(D["jobs"]))
    D["spend"] = f"{piece['jobs']} jobs, {piece['credits_spent']:g} credits spent."

    click = synth.click()
    ir = synth.reverb_ir()
    k = 0.95 / float(np.max(np.abs(ir)))           # store the IR at full int16 scale, undo it in the wet gain
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    html = html.replace("/*DATA*/{}", json.dumps(D, separators=(",", ":")))
    html = html.replace('/*CLICK*/""', json.dumps(b64_int16(click)))
    html = html.replace('/*IR*/""', json.dumps(b64_int16(ir, k)))
    html = html.replace("/*IRGAIN*/0.22", f"{0.22 / k:.6g}")
    sprites = json.loads(SPRITES.read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    # (its header comment mentions a script tag; spell it out so the page keeps exactly one "<script>" opener)
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
    assert "<!--NAV-->" in html, "template.html lost its <!--NAV--> marker"
    html = html.replace("<!--NAV-->", nav_html("02-coda-reservoir"))
    assert "/*SPRITES*/" not in html and "/*INKSPRITE*/" not in html
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

    # the hub mascot: the same whale sprite, as common/mascot.py renders it (scale 4, transparent)
    (WEB / "img").mkdir(exist_ok=True)
    render_sprite(sprites["mascot"], 0, 4).save(WEB / "img" / "mascot.png")

    files = {"audio/coda_reservoir.mp3": "entries/02-coda-reservoir/web/audio/coda_reservoir.mp3",
             "img/mascot.png": "entries/02-coda-reservoir/web/img/mascot.png"}
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    size = (WEB / "index.html").stat().st_size + sum((ROOT / v).stat().st_size for v in files.values())
    print(f"web/index.html written ({(WEB / 'index.html').stat().st_size / 1e3:.0f} kB; page + media {size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
