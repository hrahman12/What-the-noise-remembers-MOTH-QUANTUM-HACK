"""Assemble web/index.html: inline the shared brand CSS, the score mapping and every MIDI's notes.

The page replays real outputs only: the raw score (classical) and each completed blur-midi-v1 job
listed in out/jobs.csv. Every MIDI is synthesised live in the page with Web Audio, and the three WAV
deliverables are re-encoded to compact mono MP3 in web/audio/ (bundled ffmpeg) so they play on the page too.
The default view is an illustrated scene (a beaver in a hard hat is the machine's head, the river its tape): its
pixel-art sprites live only in web/sprites.json and are inlined with the shared common/inksprite.js helper; the
mascot PNG for the hub is rendered from the same file by common/mascot.py.
Writes web/index.html (pure ASCII), web/audio/*.mp3, web/img/mascot.png and web/files.json.
"""
import csv
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = BRAND.parent / "inksprite.js"
MASCOT_PY = BRAND.parent / "mascot.py"
sys.path.insert(0, str(BRAND.parent))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links, common/nav.py)
from render_wav import notes_from_midi  # noqa: E402

TRACKS = {"Head": 0, "Rule": 1}
# WAV deliverables played on the page: stem -> mono MP3 at 80 kb/s (about 3 MB for 5:09)
WAVS = ["score_raw", "blur_s0.2_r0_res60", "blur_s0.2_r1_res60"]
SLUG = HERE.name


def encode_audio():
    """web/audio/<stem>.mp3 from <stem>.wav (re-encoded only when the WAV is newer). Returns {stem: seconds}."""
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out = WEB / "audio"
    out.mkdir(exist_ok=True)
    secs = {}
    for stem in WAVS:
        src, dst = HERE / f"{stem}.wav", out / f"{stem}.mp3"
        with wave.open(str(src)) as w:
            secs[stem] = w.getnframes() / w.getframerate()
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-c:a", "libmp3lame",
                            "-b:a", "80k", "-map_metadata", "-1", str(dst)], check=True)
        print(f"  audio/{dst.name}: {secs[stem]:.1f} s, {dst.stat().st_size / 1e6:.2f} MB")
    return secs


def pack(notes):
    """Flat ints: [d_start*4, dur*4, pitch, vel, track] per note, starts delta-coded (sorted)."""
    flat, prev = [], 0
    for s, d, p, v, name in sorted(notes, key=lambda n: (n[0], n[2])):
        s4 = round(s * 4)
        flat += [s4 - prev, max(1, round(d * 4)), p, v, TRACKS.get(name, 0)]
        prev = s4
    return flat


def main():
    score = json.loads((HERE / "out" / "score.json").read_text(encoding="utf-8"))
    keep = ["total_cols", "notes_per_sec", "scale", "low_d", "col_step", "col_cell", "machine", "steps", "ones",
            "tape_width", "extent", "bounds", "xs", "phrase_heads"]
    page_score = {k: score[k] for k in keep}
    page_score["phrases"] = [{k: p[k] for k in ("k", "x", "branch", "start_step", "end_step", "steps", "sweeps",
                                                "cols", "mode", "lo", "hi", "degrees", "deg_lo", "col0")}
                             for p in score["phrases"]]
    raw = notes_from_midi(HERE / "score_raw.mid")
    modes = [{"id": "raw", "strength": None, "reach": None, "job": None, "n": len(raw), "notes": pack(raw)}]
    jobs = [r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")) if r["status"] == "completed"]
    for r in jobs:
        ns = notes_from_midi(HERE / "out" / r["file"])
        s, re_, res = float(r["strength"]), float(r["reach"]), int(r.get("resolution") or 0)
        steps = -(-score["total_cols"] * score["col_ticks"] // (res or score["col_ticks"]))
        tq = math.ceil(math.log2(steps))
        # pitch rows: melody 45..93 plus the 7-row margin observed below (38..93) = 56 rows, or 63 if the
        # margin is also padded above -> 6 qubits either way. Computed, not reported by the engine.
        qnote = f"computed {tq}+6 = {tq + 6} per pass"
        modes.append({"id": f"s{s:g}r{re_:g}" + (f"x{res}" if res else ""), "strength": s, "reach": re_,
                      "res": res, "job": r["job_id"], "qubits": int(r["qubits"]), "qnote": qnote,
                      "time_steps": steps, "n": len(ns), "notes": pack(ns)})
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    assert html.count("/*INKSPRITE*/") == 1 and html.count("/*SPRITES*/{}") == 1
    # the helper's header comment mentions the script tag; reword it so naive '<script>' splitting stays exact
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*SCORE*/{}", json.dumps(page_score, separators=(",", ":")))
    html = html.replace("/*MODES*/[]", json.dumps(modes, separators=(",", ":")))
    html = html.replace("/*NJOBS*/0", str(len(jobs)))
    secs = encode_audio()
    for stem, sec in secs.items():
        html = html.replace(f"/*DUR:{stem}*/0", f"{sec:.1f}")
    assert "/*" + "DUR:" not in html, "a track duration placeholder was not filled"
    assert html.count("<!--NAV-->") == 1, "the template needs exactly one <!--NAV--> marker before the footer"
    html = html.replace("<!--NAV-->", nav_html(SLUG))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    files = {f"audio/{stem}.mp3": f"entries/{SLUG}/web/audio/{stem}.mp3" for stem in WAVS}
    for rel in files:
        assert f'src="{rel}"' in html, f"{rel} is not referenced by the page"
    # the hub's mascot: the beaver in its hard hat, rendered from web/sprites.json
    subprocess.run([sys.executable, str(MASCOT_PY), str(WEB / "sprites.json"), "mascot", str(WEB / "img" / "mascot.png"),
                    "--scale", "4"], check=True)
    files["img/mascot.png"] = f"entries/{SLUG}/web/img/mascot.png"
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum((WEB / r).stat().st_size for r in files)
    kb = (WEB / "index.html").stat().st_size / 1024
    print(f"web/index.html written ({len(jobs)} blur jobs, {kb:.0f} KB); {len(files)} files listed; page total {total / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
