"""Assemble web/index.html from out/chain.json: inline the brand CSS and the chain, convert media, write files.json.

Everything here is CLASSICAL post-processing of cached engine outputs (format conversion, a 20x difference image,
waveform peaks for drawing). No engine output is altered: images are converted losslessly, audio is converted to
22.05 kHz 128 kbps MP3 for the page (the untouched engine files stay in out/), the two MIDI files are read into note
lists for in-browser synthesis, and tweezer_day.mp4 is re-encoded (H.264, faststart) into web/video/ with a poster.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB, OUT, MEDIA, AUDIO = HERE / "web", HERE / "out", HERE / "web" / "media", HERE / "web" / "audio"
VIDEO = WEB / "video"
IMG_DIR = WEB / "img"
BRAND = ROOT / "common" / "brand.css"
sys.path.insert(0, str(BRAND.parent))
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from lib import ledger_tally, read_wav, tally_sentence  # noqa: E402
from mascot import render as render_sprite  # noqa: E402  (common/mascot.py)
from nav import nav_html  # noqa: E402  (common/nav.py: shared prev / hub / next links for every piece)


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def to_webp(src: Path, name: str) -> str:
    dst = MEDIA / (Path(name).stem + ".webp")
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        Image.open(src).save(dst, "WEBP", lossless=True, method=6)
    return "media/" + dst.name


def to_mp3(src: Path, name: str, channels=1) -> str:
    """Compact page audio in web/audio/ (128 kbps MP3, 22.05 kHz); the untouched engine WAVs stay in out/."""
    AUDIO.mkdir(parents=True, exist_ok=True)
    dst = AUDIO / (Path(name).stem + ".mp3")
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(src), "-ar", "22050", "-ac", str(channels),
                        "-c:a", "libmp3lame", "-b:a", "128k", str(dst)], check=True)
    return "audio/" + dst.name


def to_web_video(src: Path) -> tuple[str, str]:
    """Page copy of the MP4 deliverable in web/video/ (H.264 + AAC, faststart) and a poster frame (lossless WebP).
    A classical re-encode of make_video.py's file; the deliverable itself stays untouched at the piece root."""
    VIDEO.mkdir(parents=True, exist_ok=True)
    dst, poster = VIDEO / src.name, VIDEO / (src.stem + "_poster.webp")
    if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(src), "-c:v", "libx264", "-preset", "slow",
                        "-crf", "28", "-pix_fmt", "yuv420p", "-profile:v", "high", "-c:a", "aac", "-b:a", "96k",
                        "-movflags", "+faststart", str(dst)], check=True)
    if not poster.exists() or poster.stat().st_mtime < src.stat().st_mtime:
        tmp = VIDEO / "_poster.png"
        subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-ss", "40", "-i", str(src), "-frames:v", "1", str(tmp)],
                       check=True)
        Image.open(tmp).save(poster, "WEBP", lossless=True, method=6)
        tmp.unlink()
    return "video/" + dst.name, "video/" + poster.name


def midi_notes(path: Path):
    """-> [[start_s, dur_s, pitch, velocity]] read straight from a MIDI deliverable (same rule as stages.midi_notes)."""
    import mido
    mf = mido.MidiFile(path)
    out = []
    for tr in mf.tracks:
        t, tempo, on = 0, 500000, {}
        for m in tr:
            t += m.time
            if m.type == "set_tempo":
                tempo = m.tempo
            if m.type == "note_on" and m.velocity > 0:
                on[m.note] = (t, m.velocity)
            elif m.type in ("note_off", "note_on") and m.note in on:
                t0, v = on.pop(m.note)
                out.append([round(mido.tick2second(t0, mf.ticks_per_beat, tempo), 3),
                            round(mido.tick2second(t - t0, mf.ticks_per_beat, tempo), 3), m.note, v])
    return sorted(out)


def peaks(path: Path, n=320):
    x, _ = read_wav(path)
    if not len(x):
        return []
    b = np.array_split(np.abs(x), n)
    p = np.array([c.max() if len(c) else 0 for c in b])
    return np.round(p / max(p.max(), 1e-9), 3).tolist()


def source(v: str) -> Path:
    for base in (OUT, MEDIA):
        if (base / v).exists():
            return base / v
    raise FileNotFoundError(v)


def prep_media(r, rid):
    """Convert one run's media for the page (lossless WebP, MP3) and add the page-only chart data some stages need."""
    m = r.get("media")
    if not m:
        return
    src_after = m.get("after")
    new = {}
    for k, v in m.items():
        if isinstance(v, list):
            new[k] = [to_webp(source(x), x) for x in v]
        elif v.endswith(".png"):
            new[k] = to_webp(source(v), v)
        elif v.endswith(".wav"):
            new[k] = to_mp3(source(v), v, channels=2 if rid == "retro" and k == "after" else 1)
        else:
            new[k] = v
    r["media"] = new
    if rid == "blur":   # classical 20x difference image, to show where the blur moved light
        a = np.asarray(Image.open(OUT / "fluor_ideal.png").convert("L"), float)
        b = np.asarray(Image.open(OUT / "fluor_camera.png").convert("L"), float)
        d = np.clip(np.abs(b - a) * 20, 0, 255).astype(np.uint8)
        Image.fromarray(d, "L").save(MEDIA / "blur_diff.webp", "WEBP", lossless=True, method=6)
        r["media"]["diff"] = "media/blur_diff.webp"
    if rid == "retro":
        r["data"]["peaks_in"] = peaks(OUT / "echo_in.wav")
        r["data"]["peaks_out"] = peaks(OUT / src_after)
        r["data"].pop("taps", None)
        tj = json.loads((OUT / r["data"].get("taps_file", "echo_taps.json")).read_text(encoding="utf-8"))
        taps = ((tj.get("extras") or {}).get("tap_map") or {}).get("taps") or []
        g = np.zeros((8, 24))
        for t in taps:
            if isinstance(t, dict) and t.get("site") is not None and t.get("depth"):
                s_, dd = int(t["site"]), int(t["depth"])
                if 0 <= s_ < 24 and 1 <= dd <= 8:
                    g[dd - 1, s_] = max(g[dd - 1, s_], abs(float(t.get("level", 0) or 0)))
        if g.sum() > 0:
            r["data"]["tapgrid"] = np.round(g, 4).tolist()


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    chain = json.loads((OUT / "chain.json").read_text(encoding="utf-8"))
    chain.sort(key=lambda r: r.get("clock", "99:99"))
    for r in chain:
        if r.get("error"):            # keep only the server's plain message, not its raw JSON envelope
            mm = re.search(r'"message": "([^"]+)', r["error"])
            msg = mm.group(1) if mm else r["error"].split(":", 1)[-1][:200]
            r["error"] = re.sub(r"\\u([0-9a-fA-F]{4})", lambda x: chr(int(x.group(1), 16)), msg).strip()
        if not r.get("completed"):
            continue
        prep_media(r, r["id"])
        if r.get("earlier"):          # the recorded run kept beside an ibm_fez result: its media and charts too
            prep_media(r["earlier"], r["id"])

    done = [r for r in chain if r.get("completed")]
    jobs = []
    for r in done:
        jobs.extend(r.get("jobs") or [r["job_id"]])
    tally = ledger_tally(chain)        # from the credit ledger and the job cache, not hand-counted
    pend = [r for r in chain if r.get("pending")]
    # every IBM backend shown on the page: the primary runs, and the recorded runs kept beside an ibm_fez result
    hw = {}
    for r in done:
        for run, primary in ((r, True), (r.get("earlier"), False)):
            if run and "IBM hardware" in (run.get("where") or ""):
                e = hw.setdefault(run["backend"], {"backend": run["backend"], "qubits": 0, "stages": 0, "primary": False})
                e["qubits"] = max(e["qubits"], run.get("qubits") or 0)
                e["stages"] += 1
                e["primary"] = e["primary"] or primary
    hw_list = sorted(hw.values(), key=lambda e: (not e["primary"], e["backend"] != "ibm_fez", -e["qubits"]))
    meta = {
        "engines_completed": len({r["engine"] for r in done}),
        "jobs_completed": len(set(jobs)),
        "max_qubits": max(r.get("qubits") or 0 for r in done),
        "hw_qubits": max([r.get("qubits") or 0 for r in done if "IBM hardware" in (r.get("where") or "")] or [0]),
        "hardware": ", ".join(sorted({r["backend"] for r in done if "IBM hardware" in (r.get("where") or "")})) or "none",
        "hw": hw_list,                 # [{backend, qubits (max), stages, primary}], ibm_fez first
        "hw_stages": sum(1 for r in done if "IBM hardware" in (r.get("where") or "")),
        "fez_sent": sum(1 for r in chain if r.get("earlier") or (r.get("fez") or {}).get("attempts")
                        or "ibm_fez" in (r.get("where") or "")),
        "fez_done": sum(1 for r in done if "IBM hardware (ibm_fez)" in (r.get("where") or "")),
        "fez_jobs": sum(len((r.get("fez") or {}).get("attempts") or []) for r in chain)
                    + sum(1 for r in done if "IBM hardware (ibm_fez)" in (r.get("where") or "")),
        "failnote": tally_sentence(tally)
                    + (f" {len(pend)} still queued ({', '.join(r['engine'] for r in pend)}), not counted." if pend else ""),
        "tally": tally,
    }
    # every sound deliverable, for the page's "Every sound in the day" list: the two MIDI files are read here and
    # synthesised in the browser; the two WAVs are played from their MP3 conversions (already in the chain media)
    sounds = {}
    for key, name in (("score_in", "readout_score.mid"), ("score_out", "readout_blurred.mid")):
        if (OUT / name).exists():
            sounds[key] = midi_notes(OUT / name)
    retro = next((r for r in chain if r["id"] == "retro" and r.get("completed")), None)
    wet = ((retro or {}).get("media") or {}).get("after", "echo_out.wav").replace("audio/", "").replace(".mp3", ".wav")
    for key, name in (("dry_s", "echo_in.wav"), ("wet_s", wet if (OUT / wet).exists() else "echo_out.wav")):
        if (OUT / name).exists():
            x, sr = read_wav(OUT / name)
            sounds[key] = round(len(x) / sr, 1) if sr else None
    film = {}
    if (HERE / "tweezer_day.mp4").exists():
        film["src"], film["poster"] = to_web_video(HERE / "tweezer_day.mp4")
    # the cast: pixel sprites authored by make_sprites.py into web/sprites.json, drawn by common/inksprite.js
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    render_sprite(sprites["tweezy"], 0, 6).save(IMG_DIR / "mascot.png")      # hub mascot: Tweezy, 96 x 120 px
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    ink = (ROOT / "common" / "inksprite.js").read_text(encoding="utf-8").replace("<script>", "script element")  # comment text only
    html = html.replace("/*INKSPRITE*/", ink)
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*CHAIN*/[]", json.dumps(chain, separators=(",", ":")))
    html = html.replace("/*META*/{}", json.dumps(meta, separators=(",", ":")))
    html = html.replace("/*SOUNDS*/{}", json.dumps(sounds, separators=(",", ":")))
    html = html.replace("/*FILM_SRC*/", film.get("src", "")).replace("/*FILM_POSTER*/", film.get("poster", ""))
    if "<!--NAV-->" not in html:
        raise SystemExit("web/template.html has no <!--NAV--> marker before the footer")
    html = html.replace("<!--NAV-->", nav_html("06-tweezer"))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")

    files = {}
    blob = json.dumps(chain) + json.dumps(film)
    for d_ in (MEDIA, AUDIO, VIDEO):
        if not d_.exists():
            continue
        for p in sorted(d_.iterdir()):
            rel = f"{d_.name}/{p.name}"
            if p.suffix in (".webp", ".wav", ".mp3", ".mp4") and rel in blob:
                files[rel] = p.relative_to(ROOT).as_posix()
            else:
                p.unlink()          # stale conversions from earlier builds
    files["img/mascot.png"] = (IMG_DIR / "mascot.png").relative_to(ROOT).as_posix()
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum((ROOT / v).stat().st_size for v in files.values())
    print(f"web/index.html written: {len(chain)} stages, {meta['engines_completed']} engines completed, "
          f"{meta['jobs_completed']} jobs; {len(files)} media files; total {total / 1e6:.2f} MB")
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
