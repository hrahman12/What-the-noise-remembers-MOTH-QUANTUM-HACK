"""Assemble web/index.html: inline the brand CSS, the tracked chirps and every completed blur job.

Note lists come from parsing the real MIDI files (our chirp MIDI and the downloaded blur-midi-v1
outputs) with the same parser, so the page plays exactly what is in those files. CLASSICAL.
Every WAV render in wav/ is also encoded to a compact MP3 in web/audio/ (bundled ffmpeg, libmp3lame
VBR q4) so the page can play each deliverable from a visible Play/Stop control.
The scene's cast (web/sprites.json, written by make_sprites.py) and the shared common/inksprite.js helper are
inlined too, and the hub mascot (web/img/mascot.png) is rendered from the same sprites by common/mascot.py.
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image

from notes_of import notes_of
from track_chirp import IMG_PITCH, roll_qubits

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = BRAND.parent / "inksprite.js"
SPRITES = WEB / "sprites.json"
sys.path.insert(0, str(BRAND.parent))
from ascii_html import to_ascii  # noqa: E402
from mascot import render as render_sprite  # noqa: E402
from nav import nav_html  # noqa: E402

# paper/ink palette (common/brand.css): the scalogram is a light ink wash on paper, so the notes
# (solid ink on the page) stay readable on top of it
PAPER = np.array([251, 250, 249], float)
INK = np.array([25, 35, 142], float)
WASH = 0.34          # strongest ink coverage of the scalogram

RENDER_INFO = {      # wav stem -> (title, description, event index, reach index on the page, strength)
    "GW150914_chirp": ("GW150914, unblurred chirp",
                       "The measured track: one note per half-wave of the real H1 and L1 strain, "
                       "stretched x100 and pitched up two octaves. Hanford left, Livingston right.", 0, 0, None),
    "GW150914_s0.5_r0.0": ("GW150914, blur at reach 0",
                           "blur-midi-v1 output, strength 0.5, reach 0 (fully local): each half-wave "
                           "becomes a two-note cluster, with 2-6 ms pre-echoes.", 0, 1, 0.5),
    "GW150914_s0.5_r0.5": ("GW150914, blur at reach 0.5",
                           "blur-midi-v1 output, strength 0.5, reach 0.5: the merger's notes scatter "
                           "into a granular cloud across the whole take, before and after the event.", 0, 2, 0.5),
    "GW150914_s0.5_r1.0": ("GW150914, blur at reach 1",
                           "blur-midi-v1 output, strength 0.5, reach 1 (fully non-local).", 0, 3, 0.5),
    "GW170817_chirp": ("GW170817, model-guided chirp",
                       "Pitch from the leading-order chirp law with the catalogue chirp mass; loudness "
                       "from the real detector power along the track. No blur exists for this event.", 1, 0, None),
}
ORDER = ["GW150914_chirp", "GW150914_s0.5_r0.0", "GW150914_s0.5_r0.5", "GW150914_s0.5_r1.0", "GW170817_chirp"]


def compact(path):
    """[[start_s, dur_s, pitch, vel, voice]] with voice 0 = H1 (MIDI track 1), 1 = L1 (track 2)."""
    return [[round(s, 4), round(d, 4), int(p), int(v), int(tr) - 1] for s, d, p, v, tr in notes_of(path)]


def bg_webp(ev):
    g = np.asarray(Image.open(HERE / "out" / f"{ev}_scalogram.png"), float) / 255
    a = (g ** 1.4)[..., None] * WASH
    rgb = PAPER * (1 - a) + INK * a
    dest = WEB / "img" / f"{ev}_bg.webp"
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(dest, "WEBP", lossless=True, method=6)
    return f"img/{ev}_bg.webp"


def sounded(path, cap=16):
    """Notes render_wav.py actually sounds: at most `cap` (the loudest) per onset, as on the page."""
    by = {}
    for n in notes_of(path):
        by.setdefault(round(n[0], 3), []).append(n)
    return sum(min(len(g), cap) for g in by.values())


def renders(jobs):
    """Encode wav/*.wav -> web/audio/*.mp3 (only when missing or stale) and describe each render."""
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    (WEB / "audio").mkdir(parents=True, exist_ok=True)
    job_of = {Path(r["file"]).stem: r for r in jobs if r["status"] == "completed"}
    out = []
    stems = [p.stem for p in sorted((HERE / "wav").glob("*.wav"))]
    for stem in sorted(stems, key=lambda x: ORDER.index(x) if x in ORDER else 99):
        wav_p, mp3 = HERE / "wav" / f"{stem}.wav", WEB / "audio" / f"{stem}.mp3"
        if not mp3.exists() or mp3.stat().st_mtime < wav_p.stat().st_mtime:
            subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_p),
                            "-codec:a", "libmp3lame", "-q:a", "4", str(mp3)], check=True)
        with wave.open(str(wav_p)) as w:
            secs = w.getnframes() / w.getframerate()
        midi = (f"midi/blurred/{stem}.mid" if (HERE / "midi" / "blurred" / f"{stem}.mid").exists()
                else f"midi/{stem}.mid")
        title, desc, ev, ri, strength = RENDER_INFO[stem]
        j = job_of.get(stem)
        out.append({"src": f"audio/{stem}.mp3", "title": title, "desc": desc, "midi": midi,
                    "wav": f"wav/{stem}.wav", "seconds": round(secs, 1),
                    "notes_total": len(notes_of(HERE / midi)), "notes_played": sounded(HERE / midi),
                    "job": j["job_id"] if j else None, "ev": ev, "ri": ri, "strength": strength,
                    "kb": round(mp3.stat().st_size / 1024)})
    return out


def main():
    (WEB / "img").mkdir(parents=True, exist_ok=True)
    jobs = [r for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8"))]
    events = []
    files = {}
    for ev in ("GW150914", "GW170817"):
        info = json.loads((HERE / "out" / f"{ev}.json").read_text(encoding="utf-8"))
        orig = compact(HERE / "midi" / f"{ev}_chirp.mid")
        sets = [{"key": "orig", "strength": None, "reach": None, "job": None, "notes": orig}]
        plan = []
        for r in jobs:
            if r["event"] != ev:
                continue
            s, rc = float(r["strength"]), float(r["reach"])
            plan.append({"strength": s, "reach": rc, "status": r["status"],
                         "failed": [j for j in r["failed_job_ids"].split() if j]})
            if r["status"] == "completed":
                sets.append({"key": f"s{s}_r{rc}", "strength": s, "reach": rc, "job": r["job_id"],
                             "seconds": float(r["seconds"]), "notes": compact(HERE / r["file"])})
        allp = [n[2] for st in sets for n in st["notes"]]
        roll = roll_qubits(HERE / "midi" / f"{ev}_chirp.mid")
        e = {"id": ev, "kind": info["kind"], "t_total": info["t_total"], "lead_in": info["lead_in"],
             "transpose": info["transpose"], "pmin": min(allp), "pmax": max(allp), "img_pitch": list(IMG_PITCH),
             "bg": bg_webp(ev), "sets": sets, "plan": plan, "roll": roll}
        files[e["bg"]] = f"entries/12-chirp-instrument/web/{e['bg']}"
        if ev == "GW150914":
            T0, S = info["t0_real"], info["stretch"]
            e.update(stretch=S, t0_real=T0, lag_ms=info["lag_ms"], t_peak=info["t_peak"],
                     mc_fit=info["mc_det_newtonian"], strain=info["strain"],
                     # music time -> (real time on the H1 clock, ridge frequency)
                     map=[[round(info["lead_in"] + (t - T0) * S, 3), t, f] for t, f, _ in info["ridge"]
                          if T0 - 0.02 <= t <= info["t1_real"] + 0.01],
                     notes_meta=[[n["t_music_H1"], n["t_music_L1"], n["t_real"], n["f_hz"]] for n in info["notes"]])
            first_merger = min(n["t_music_L1"] for n in info["notes"] if n["t_real"] >= -0.03)
            e["presets"] = {"inspiral": [0.0, round(first_merger - 0.05, 2)],
                            "merger": [round(first_merger - 0.25, 2), info["t_total"]]}
        else:
            e.update(cycles_per_note=info["cycles_per_note"], note_s=info["note_s"], mc_det=info["mc_det"],
                     mc_source=info["mc_source"], redshift=info["redshift"], tc_fit=info["tc_fit"],
                     ratio_on=info["mean_ratio_on"], ratio_ctrl=info["mean_ratio_control"], gate=info["gate_L1"],
                     map=[[n["t_music"], n["t_real"], n["f_hz"]] for n in info["notes"]],
                     bars=[[n["t_music"], n["ratio_H1"], n["ratio_L1"]] for n in info["notes"]])
            m0 = min(n["t_music"] for n in info["notes"] if n["f_hz"] >= 150)
            e["presets"] = {"inspiral": [0.0, round(m0 - 0.05, 2)], "merger": [round(m0 - 0.3, 2), info["t_total"]]}
        events.append(e)
    data = json.dumps(events, separators=(",", ":"))
    rend = renders(jobs)
    for r in rend:
        files[r["src"]] = f"entries/12-chirp-instrument/web/{r['src']}"
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    html = html.replace("/*EVENTS*/[]", data)
    html = html.replace("/*RENDERS*/[]", json.dumps(rend, separators=(",", ":")))
    sprites = json.loads(SPRITES.read_text(encoding="utf-8"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
    # the shared prev / hub / next links to the other pieces (common/nav.py), just before the footer
    html = html.replace("<!--NAV-->", nav_html("12-chirp-instrument"))
    assert "/*SPRITES*/" not in html and "/*INKSPRITE*/" not in html and "<!--NAV-->" not in html
    # the hub mascot: GW150914's pair as the page draws it (76 px at scale 2 = 152 px, transparent), via common/mascot.py
    render_sprite(sprites["mascot"], 0, 2).save(WEB / "img" / "mascot.png")
    files["img/mascot.png"] = "entries/12-chirp-instrument/web/img/mascot.png"
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    n_sets = sum(len(e["sets"]) - 1 for e in events)
    total = (WEB / "index.html").stat().st_size + sum((HERE.parent.parent / v).stat().st_size for v in files.values())
    print(f"web/index.html written: {len(data) / 1e3:.0f} kB of data, {n_sets} blurred sets, "
          f"{len(rend)} renders ({sum(r['kb'] for r in rend)} kB mp3), files.json {len(files)} files, "
          f"page total {total / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
