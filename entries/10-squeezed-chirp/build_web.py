"""Assemble web/index.html (LIGO Night Shift): inline the brand CSS, the six real grids (original + 5 engine
outputs), the measured widths, the game's target (the chirp peak measured in the ORIGINAL grid), the shared
sprite helper (common/inksprite.js), this piece's realistic pixel art (web/sprites.json, written by
make_sprites.py: GW150914's black holes against a lensed star field) and the shared piece-to-piece nav
(common/nav.py), copy the Griffin-Lim WAVs, export the mascot PNG with common/mascot.py, and write
web/files.json. The engraved plates (site, optics, quadruple pendulum) are SVG in web/template.html; Plate I's
oblique view is projected in the page from the published layout.

The page replays cached, real blur-core-v1 outputs; it never calls the Atlas API.
"""
import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
OUT = HERE / "out"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = BRAND.parent / "inksprite.js"
MASCOT = BRAND.parent / "mascot.py"
sys.path.insert(0, str(BRAND.parent))
sys.path.insert(0, str(HERE))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared prev / hub / next links for the whole set)

import chirp  # noqa: E402
import make_sprites  # noqa: E402

VERSIONS = ["original", "r0p25", "r0p5", "r1", "r2", "r4"]
REL = "entries/10-squeezed-chirp/web/"


def b64_u16(A):
    q = np.clip(np.rint(np.asarray(A, dtype=np.float64) * 10), 0, 65535).astype("<u2")
    return base64.b64encode(q.tobytes()).decode("ascii")


PEAK_WIN = {"t": (-0.16, 0.06), "f": (20.0, 340.0), "thr": 0.95, "fthr": 0.8}


def peak_of(A, tt, ff, win=PEAK_WIN):
    """The game's target, the chirp's loudest moment in the ORIGINAL grid. Time: the power-weighted centre of the
    time columns whose broadband power (summed over the window's frequencies) is at least thr x the loudest
    column's. Pitch: the power-weighted centre frequency of the cells in those columns at or above fthr x their
    column's maximum. Same rule as peakOf() on the page (tests/test_page.js checks they agree)."""
    it = (tt >= win["t"][0]) & (tt <= win["t"][1])
    jf = (ff >= win["f"][0]) & (ff <= win["f"][1])
    sub = np.asarray(A, dtype=np.float64)[np.ix_(it, jf)]
    col = sub.sum(1)
    L = col >= win["thr"] * col.max()
    t = float((col[L] @ tt[it][L]) / col[L].sum())
    S = sub[L]
    W = np.where(S >= win["fthr"] * S.max(1, keepdims=True), S, 0.0)
    return {"t": t, "f": float((W.sum(0) @ ff[jf]) / W.sum())}


def audio_loudest(wav, t0, t1):
    """Source time (s) of the loudest 30 ms of a WAV (RMS envelope), to check the target against what you hear."""
    from scipy.io import wavfile
    fs, x = wavfile.read(wav)
    x = x.astype(np.float64)
    w = int(0.03 * fs)
    env = np.convolve(x * x, np.ones(w) / w, mode="same")
    return t0 + int(env.argmax()) / len(x) * (t1 - t0)


def main():
    (WEB / "audio").mkdir(parents=True, exist_ok=True)
    make_sprites.main()                                         # web/sprites.json from the measured widths
    subprocess.run([sys.executable, str(MASCOT), str(WEB / "sprites.json"), "bh_pair", str(WEB / "img" / "mascot.png"),
                    "--scale", "2"], check=True)
    G = np.load(OUT / "grid_input.npy").astype(np.float64)
    ax = json.loads((OUT / "axes.json").read_text(encoding="utf-8"))
    tt, ff = np.asarray(ax["t_s"]), np.asarray(ax["f_hz"])
    jobs = {j["name"]: j for j in json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))}
    widths = json.loads((OUT / "widths.json").read_text(encoding="utf-8"))
    audio = json.loads((OUT / "audio" / "audio.json").read_text(encoding="utf-8"))
    status = json.loads((OUT / "job_status.json").read_text(encoding="utf-8"))
    track = chirp.ridge_track(G, tt, ff)

    grids, versions, files = {}, [], {}
    for v in VERSIONS:
        A = G if v == "original" else np.load(OUT / f"{v}.npy")
        grids[v] = b64_u16(A)
        j = jobs.get(v, {})
        w = widths["versions"][v]
        shutil.copyfile(OUT / "audio" / f"{v}.wav", WEB / "audio" / f"{v}.wav")
        files[f"audio/{v}.wav"] = REL + f"audio/{v}.wav"
        versions.append({"key": v, "ratio": j.get("ratio"), "strength": j.get("strength"),
                         "job_id": j.get("job_id"), "engine_says": status.get(v, {}).get("progress", {}).get("detail"),
                         "tw": w["time_width_ms"], "fw": w["freq_width_hz"],
                         "ctw": widths["classical"].get(f"{j['ratio']:g}", {}).get("time_width_ms") if j else None,
                         "cfw": widths["classical"].get(f"{j['ratio']:g}", {}).get("freq_width_hz") if j else None,
                         "audio": f"audio/{v}.wav", "seconds": audio["files"][v]["seconds"], "run_s": j.get("seconds")})
    iso = jobs["iso_control"]
    peak = peak_of(G, tt, ff)
    print(f"chirp peak in the original grid: t = {peak['t'] * 1000:.2f} ms, f = {peak['f']:.2f} Hz")
    heard = audio_loudest(OUT / "audio" / "original.wav", audio["t0_s"], audio["t1_s"])
    print(f"loudest moment of the original audio: t = {heard * 1000:.2f} ms")
    assert abs(heard - peak["t"]) < 0.004, "the timing target must match what you hear"
    meta = {
        "nt": len(tt), "nf": len(ff), "t0": float(tt[0]), "dt": float(tt[1] - tt[0]),
        "f0": float(ff[0]), "df": float(ff[1] - ff[0]), "scale": 10,
        "half_t": int(round(0.03 / (tt[1] - tt[0]))), "half_f": int(round(40.0 / (ff[1] - ff[0]))),
        "audio": {"t0": audio["t0_s"], "t1": audio["t1_s"], "slow": audio["slow"], "pitch": audio["pitch"],
                  "gate": audio["gate_percentile"]},
        "iso": {"job_id": iso["job_id"], "strength": iso["strength"], "run_s": iso.get("seconds"),
                "tw": widths["versions"]["iso_control"]["time_width_ms"],
                "fw": widths["versions"]["iso_control"]["freq_width_hz"],
                "maxdiff": float(np.abs(np.load(OUT / "iso_control.npy") - np.load(OUT / "r1.npy")).max())},
        "t_merger_gps": chirp.T_MERGER,
        "peak": peak, "peak_win": PEAK_WIN,
        "track_t": [[int(c), int(r)] for r, c in zip(track["rows"], track["t_idx"])],
        "track_f": [[int(c), int(r)] for c, r in zip(track["cols"], track["f_idx"])],
        "versions": versions,
        # the two paid 20-qubit jobs that failed on Atlas's result-payload limit (listed on the page's Jobs and credits)
        "failed": [{"job_id": f["job_id"], "grid": f["grid"], "qubits": f["qubits"], "strength": f["strength"],
                    "error": f["error"]["message"]}
                   for f in json.loads((OUT / "failed_jobs.json").read_text(encoding="utf-8"))],
    }
    if (WEB / "notebook.html").exists():                      # static view written by export_notebook.py
        files["notebook.html"] = REL + "notebook.html"
    files["img/mascot.png"] = REL + "img/mascot.png"           # the hub's mascot (the page draws the same sprite inline)
    html = (WEB / "template.html").read_text(encoding="utf-8")
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    html = html.replace("/*META*/{}", json.dumps(meta, separators=(",", ":")))
    html = html.replace("/*GRIDS*/{}", json.dumps(grids, separators=(",", ":")))
    # the helper's header comment mentions a script tag; reword it so naive '<script>' splitters still work
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))
    html = html.replace("/*SPRITES*/{}", (WEB / "sprites.json").read_text(encoding="utf-8"))
    html = html.replace("<!--NAV-->", nav_html("10-squeezed-chirp"))   # before to_ascii
    (WEB / "index.html").write_text(to_ascii(html), encoding="ascii")
    (WEB / "files.json").write_text(json.dumps(files, indent=1), encoding="utf-8")
    size = (WEB / "index.html").stat().st_size + sum((WEB / p).stat().st_size for p in files)
    print(f"web/index.html written; {len(files)} media files; total {size/1e6:.2f} MB")


if __name__ == "__main__":
    main()
