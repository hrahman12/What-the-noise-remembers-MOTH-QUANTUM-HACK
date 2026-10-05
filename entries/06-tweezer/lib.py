"""Shared helpers for the Tweezer pipeline: array geometry, rendering, and the hop metric.

Everything in this file is CLASSICAL. The hop metric is the classical (Bhattacharyya) fidelity
F(p, q) = (sum_x sqrt(p(x) q(x)))^2 between two distributions over the same outcomes.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
WEB = HERE / "web"
ROWS = COLS = 12            # 144-site tweezer array (first 144 bits of comet's 148-qubit register)
N_SITES = ROWS * COLS
IMG = 1024                  # 1024 x 1024 renders -> blur-v1 uses its 20-qubit ceiling
PITCH = IMG / COLS
ZONE_R0, ZONE_C0, ZONE_H, ZONE_W = 4, 4, 4, 5   # 4 x 5 = 20-site target zone (graph-v1 / labyrinth-v1 ceiling)


def zone_sites():
    """Array indices (row-major in the 12x12 array) of the 20 target-zone sites, zone row-major."""
    return [(ZONE_R0 + r) * COLS + (ZONE_C0 + c) for r in range(ZONE_H) for c in range(ZONE_W)]


# ---------------------------------------------------------------- metric
def norm(v):
    v = np.clip(np.asarray(v, dtype=float).ravel(), 0, None)
    s = v.sum()
    return v / s if s > 0 else np.full(v.size, 1.0 / v.size)


def fid(p, q):
    """Classical fidelity of two non-negative vectors read as distributions over the same outcomes."""
    p, q = norm(p), norm(q)
    return float(np.sum(np.sqrt(p * q)) ** 2)


def fid_null(p, q, n=200, seed=6):
    """Chance baseline: the same F after shuffling which outcome each of q's values belongs to."""
    rng = np.random.default_rng(seed)
    q = np.asarray(q, dtype=float).ravel()
    return float(np.mean([fid(p, rng.permutation(q)) for _ in range(n)]))


def bern_fid(a, b):
    """Fidelity of two yes/no distributions (a, 1-a) and (b, 1-b)."""
    return float((math.sqrt(a * b) + math.sqrt((1 - a) * (1 - b))) ** 2)


def mean_bern_fid(targets, got):
    """Mean per-outcome fidelity for many independent yes/no outcomes (sites, edges, logical qubits)."""
    return float(np.mean([bern_fid(t, g) for t, g in zip(targets, got)]))


def bigrams(seq, vocab):
    idx = {t: i for i, t in enumerate(vocab)}
    m = np.zeros((len(vocab), len(vocab)))
    for a, b in zip(seq, seq[1:]):
        m[idx[a], idx[b]] += 1
    return m


# ---------------------------------------------------------------- rendering
def site_xy(i):
    r, c = divmod(i, COLS)
    return (c + 0.5) * PITCH, (r + 0.5) * PITCH


def render_array(weights, sigma=7.0, size=IMG):
    """Grey image with a Gaussian fluorescence spot at each site, brightness = weight (0..1)."""
    w = np.asarray(weights, dtype=float).ravel()
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    img = np.zeros((size, size), np.float32)
    s = size / IMG
    for i, wi in enumerate(w):
        if wi <= 0:
            continue
        x, y = site_xy(i)
        x, y = x * s, y * s
        x0, x1 = int(max(0, x - 5 * sigma * s)), int(min(size, x + 5 * sigma * s + 1))
        y0, y1 = int(max(0, y - 5 * sigma * s)), int(min(size, y + 5 * sigma * s + 1))
        img[y0:y1, x0:x1] += wi * np.exp(-((xx[y0:y1, x0:x1] - x) ** 2 + (yy[y0:y1, x0:x1] - y) ** 2) / (2 * (sigma * s) ** 2))
    return np.clip(img, 0, 1)


def to_png(arr01, path, mode="L"):
    a = (np.clip(arr01, 0, 1) * 255).round().astype(np.uint8)
    Image.fromarray(a, mode).save(path)
    return path


def grey(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        im = im.convert("RGB")
    return np.asarray(im.convert("L"), dtype=np.float64) / 255.0


def site_sums(img):
    """Integrate an image over each site's cell -> 144 values (row-major)."""
    h, w = img.shape
    out = np.zeros(N_SITES)
    for i in range(N_SITES):
        r, c = divmod(i, COLS)
        out[i] = img[int(r * h / ROWS):int((r + 1) * h / ROWS), int(c * w / COLS):int((c + 1) * w / COLS)].sum()
    return out


# ---------------------------------------------------------------- audio (CLASSICAL synthesis and analysis)
SR = 22050


def synth(notes, seconds, sr=SR):
    """notes: [(start_s, dur_s, midi_pitch, velocity 0..127)] -> float32 mono. Soft bell: sine + octave, exp decay."""
    n = int(seconds * sr)
    y = np.zeros(n, np.float32)
    for st, du, p, v in notes:
        i0 = int(st * sr)
        if i0 >= n:
            continue
        L = min(int((du + 0.25) * sr), n - i0)
        t = np.arange(L) / sr
        f = 440.0 * 2 ** ((p - 69) / 12)
        env = np.exp(-t * 4.0) * np.minimum(1, t * 200)
        y[i0:i0 + L] += (v / 127) * env * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t))
    peak = np.abs(y).max()
    return (y / peak * 0.8 if peak > 0 else y).astype(np.float32)


def write_wav(path, y, sr=SR):
    import wave
    y16 = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(y16.tobytes())
    return path


def read_wav(path):
    """-> (mono float array, sample rate). Handles 16/24/32-bit PCM and 32-bit float WAVs."""
    import struct
    data = Path(path).read_bytes()
    pos, fmt, raw = 12, None, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            fmt = struct.unpack("<HHIIHH", body[:16])
            if fmt[0] == 0xFFFE and len(body) >= 26:          # WAVE_FORMAT_EXTENSIBLE: real tag in the GUID
                fmt = (struct.unpack("<H", body[24:26])[0],) + fmt[1:]
        elif cid == b"data":
            raw = body
        pos += 8 + size + (size & 1)
    tag, ch, sr, _, _, bits = fmt
    if tag == 3:
        x = np.frombuffer(raw[: len(raw) // 4 * 4], "<f4").astype(np.float64)
    elif bits == 16:
        x = np.frombuffer(raw[: len(raw) // 2 * 2], "<i2").astype(np.float64) / 32768
    elif bits == 24:
        b = np.frombuffer(raw[: len(raw) // 3 * 3], np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        x = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / (1 << 23)
    else:
        x = np.frombuffer(raw[: len(raw) // 4 * 4], "<i4").astype(np.float64) / 2 ** 31
    x = x[: len(x) // ch * ch].reshape(-1, ch).mean(axis=1)
    return x, sr


def band_energy(x, sr, frame=2048, bands=24):
    """Log-spaced band energies per frame (frames x bands): the shared outcome space for audio hops."""
    nf = max(1, len(x) // frame)
    edges = np.geomspace(60, sr / 2, bands + 1)
    freqs = np.fft.rfftfreq(frame, 1 / sr)
    out = np.zeros((nf, bands))
    win = np.hanning(frame)
    for k in range(nf):
        s = np.abs(np.fft.rfft(x[k * frame:(k + 1) * frame] * win)) ** 2
        for b in range(bands):
            m = (freqs >= edges[b]) & (freqs < edges[b + 1])
            out[k, b] = s[m].sum()
    return out


def dump(obj, path):
    Path(path).write_text(json.dumps(obj, indent=1), encoding="utf-8")


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- ledger tally (read-only; for docs and the page)
def ledger_tally(chain, piece="06-tweezer"):
    """Count this piece's submissions from the shared credit ledger. A job counts as completed when the client cached
    it (it caches completed jobs only). Returns submitted / counted / unused completed probes / failed (and how many of
    the failed were free tamagotchi attempts) / refused before a job existed (from failures.json, job_id null)."""
    root = HERE.parent.parent
    mine = [json.loads(l) for l in (root / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    mine = [e for e in mine if e.get("piece") == piece]
    used = set()
    for r in chain:
        if r.get("completed"):
            used.update(r.get("jobs") or [r["job_id"]])
    cached = set()
    for eng in {e["engine"] for e in mine}:
        for p in (root / "cache" / eng).glob("*.json"):
            try:
                cached.add(json.loads(p.read_text(encoding="utf-8")).get("job_id"))
            except (json.JSONDecodeError, OSError):
                pass
    failed = [e for e in mine if e["job_id"] not in cached]
    fails_file = HERE / "failures.json"
    refused = [f for f in (json.loads(fails_file.read_text(encoding="utf-8")) if fails_file.exists() else [])
               if not f.get("job_id")]
    return {"submitted": len(mine), "counted": sum(e["job_id"] in used for e in mine),
            "probe_unused": sum(e["job_id"] in cached and e["job_id"] not in used for e in mine),
            "failed": len(failed), "failed_free": sum(e["engine"] == "tamagotchi-v1" for e in failed),
            "failed_credits": round(sum(float(e.get("credits") or 0) for e in failed), 3),
            "refused": len(refused)}


def tally_sentence(t, where="in ENGINES.md"):
    s = (f"{t['submitted']} submissions for this piece: {t['counted']} completed and counted"
         + (f", {t['probe_unused']} completed probe not used" if t["probe_unused"] else "")
         + f", {t['failed']} failed ({t['failed_free']} of them free tamagotchi attempts; "
           f"{t['failed_credits']:g} credits went to the failed ones)")
    if t["refused"]:
        s += f", plus {t['refused']} request refused before a job was created (HTTP 413, no credit)"
    return s + f". Every failure is listed {where} with its job ID and error, and none is counted."
