"""Assemble web/index.html: inline the brand CSS, the molecule data and every chord as note lists.

Note lists come from MIDI files only: midi/nose_input.mid (the classical input score) and the
blurred files downloaded from completed blur-midi-v1 jobs (out/jobs.csv). Nothing is synthesised
here except loudness gains (synth.loudness_gain), which equalise RMS between tracks so loudness
never gives away the deuterated sample in the blind test.
Media: every WAV deliverable (render_wav.py) is encoded with the bundled ffmpeg and played on the page:
wav/quantum_nose_demo.wav -> web/audio/quantum_nose_demo.mp3 (the tour player) and the 60 chord renders
wav/<setting>/<molecule>_<H|D>.wav -> web/audio/chords/<setting>/<molecule>_<H|D>.mp3 (the instrument's
"WAV file" button). All are listed in web/files.json.
Sprites: the pixel-art cast (odorant atoms, sniff bottles, the tunnelling electron, the mascot) lives in ONE place,
web/sprites.json; it is inlined with the shared helper common/inksprite.js, and the mascot is exported to
web/img/mascot.png with common/mascot.py (art direction: common/SPRITES.md).
"""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

from spectra import BIN_CM, HZ_PER_CM, MOLECULES, ORDER, lines
from synth import loudness_gain, read_tracks

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
WEB = HERE / "web"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = HERE.parent.parent / "common" / "inksprite.js"
MASCOT = HERE.parent.parent / "common" / "mascot.py"
sys.path.insert(0, str(BRAND.parent))
from ascii_html import to_ascii  # noqa: E402

SHORT = {"acetophenone": "Acetophenone", "exaltone": "Exaltone", "muscone": "Muscone"}


def mol_data():
    out = {}
    for k in ORDER:
        m = MOLECULES[k]
        ls = {}
        for iso in ("H", "D"):
            raw = lines(k, iso)
            # band index (position in MOLECULES[k]["bands"]) to pair H and D lines
            for d in raw:
                d["idx"] = next(i for i, b in enumerate(m["bands"]) if b[0] == d["nu_h"])
            ls[iso] = raw
        out[k] = {"name": m["name"], "short": SHORT[k], "d_name": m["d_name"],
                  "d_name_cap": m["d_name"][0].upper() + m["d_name"][1:],
                  "formula_h": m["formula_h"], "formula_d": m["formula_d"], "n_h": m["n_h"], "lines": ls}
    return out


def clean_notes(tracks, mols):
    """Input-score notes with: counterpart bin (for the H<->D glide), moved flag, label, wavenumber."""
    res = {}
    for k in ORDER:
        for iso in ("H", "D"):
            other = "D" if iso == "H" else "H"
            own = mols[k]["lines"][iso]
            opp = {d["idx"]: d for d in mols[k]["lines"][other]}
            notes = []
            for t0, t1, b, v in tracks[f"{k} {iso}"]:
                bands = [d for d in own if d["bin"] == b]
                first = bands[0]
                label = " + ".join(d["label"] for d in bands)
                notes.append([t0, t1, b, v, opp[first["idx"]]["bin"], int(any(d["h"] for d in bands)),
                              label, round(first["nu"])])
            res[f"{k}_{iso}"] = notes
    return res


def main():
    mols = mol_data()
    inp = read_tracks(HERE / "midi" / "nose_input.mid")
    meta_tracks = json.loads((HERE / "out" / "input_tracks.json").read_text(encoding="utf-8"))
    sets = [{"key": "clean"}]
    notes = {"clean": {}}
    for key, ns in clean_notes(inp, mols).items():
        notes["clean"][key] = {"g": round(loudness_gain([n[:4] for n in ns]), 4), "n": ns}
    jobs = 0
    dur = max(n[1] for ns in inp.values() for n in ns)
    for r in csv.DictReader(open(HERE / "out" / "jobs.csv", encoding="utf-8")):
        if r["status"] != "completed":
            continue
        s, rc = float(r["strength"]), float(r["reach"])
        key = f"s{s:g}_r{rc:g}"
        tr = read_tracks(HERE / r["file"])
        notes[key] = {}
        for k in ORDER:
            for iso in ("H", "D"):
                ns = tr.get(f"{k} {iso}", [])
                dur = max([dur] + [n[1] for n in ns])
                notes[key][f"{k}_{iso}"] = {"g": round(loudness_gain(ns), 4) if ns else 1.0, "n": ns}
        sets.append({"key": key, "strength": s if s != int(s) else int(s), "reach": rc if rc != int(rc) else int(rc),
                     "job_id": r["job_id"], "seconds": float(r["seconds"] or 0)})
        jobs += 1
    meta = {"dur": round(dur + 0.2, 2), "hz_per_bin": BIN_CM * HZ_PER_CM, "cm_per_bin": BIN_CM,
            "tracks": meta_tracks, "jobs": jobs}
    # audio: every WAV deliverable -> a compact mp3 the page plays (nothing sounds before a click)
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()

    def enc(src: Path, dst: Path, kbps: int):
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            return
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "22050",
                        "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", str(dst)], check=True)

    files = {}
    enc(HERE / "wav" / "quantum_nose_demo.wav", WEB / "audio" / "quantum_nose_demo.mp3", 96)
    files["audio/quantum_nose_demo.mp3"] = "entries/21-quantum-nose/web/audio/quantum_nose_demo.mp3"
    wavs = {}
    for s in sets:
        for k in ORDER:
            for iso in ("H", "D"):
                src = HERE / "wav" / s["key"] / f"{k}_{iso}.wav"
                if not src.exists():
                    continue
                rel = f"audio/chords/{s['key']}/{k}_{iso}.mp3"
                enc(src, WEB / rel, 48)
                files[rel] = f"entries/21-quantum-nose/web/{rel}"
                wavs[f"{s['key']}/{k}_{iso}"] = {"src": rel, "wav": f"wav/{s['key']}/{k}_{iso}.wav",
                                                 "kb": round((WEB / rel).stat().st_size / 1024)}
    # the mascot for the hub, from the same sprite data the page uses
    subprocess.run([sys.executable, str(MASCOT), str(WEB / "sprites.json"), "mascot", str(WEB / "img" / "mascot.png"),
                    "--scale", "4"], check=True)
    files["img/mascot.png"] = "entries/21-quantum-nose/web/img/mascot.png"
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    data = json.dumps(notes, separators=(",", ":"))
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    # (its header comment mentions a script tag literally; reword it so tag-splitting checks see one script)
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script tag"))
    html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    html = html.replace("/*MOLS*/{}", json.dumps(mols, separators=(",", ":")))
    html = html.replace("/*SETS*/[]", json.dumps(sets, separators=(",", ":")))
    html = html.replace("/*NOTES*/{}", data)
    html = html.replace("/*META*/{}", json.dumps(meta, separators=(",", ":")))
    html = html.replace("/*WAVS*/{}", json.dumps(wavs, separators=(",", ":")))
    # shared piece-to-piece navigation (prev / hub / next + jump list), from common/nav.py
    sys.path.insert(0, str(ROOT / "common"))
    from nav import nav_html  # noqa: E402
    assert "<!--NAV-->" in html, "template is missing the <!--NAV--> marker"
    html = html.replace("<!--NAV-->", nav_html("21-quantum-nose"))
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum((WEB / k).stat().st_size for k in files)
    print(f"media: {len(files)} files listed in files.json; page total {total / 1e6:.2f} MB")
    n_notes = {k: sum(len(v["n"]) for v in d.values()) for k, d in notes.items()}
    print(f"web/index.html written: {jobs} jobs, {len(html) / 1e6:.2f} MB, notes per setting {n_notes}")


if __name__ == "__main__":
    main()
