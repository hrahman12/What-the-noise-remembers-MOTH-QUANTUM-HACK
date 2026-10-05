"""The stages of the day, in clock order. Each takes ctx (earlier stages' signals) and returns a record.

A record says: which engine ran, where (IBM hardware / emulator / simulator), how many qubits and
how we know, the job id, what went in, what came out, and the hop score F against its parent stage.
"""
from __future__ import annotations

import io
import json
import math
import os
import re
import shutil
import zipfile

import numpy as np
from PIL import Image

from atlas.client import AtlasError
from lib import (COLS, N_SITES, OUT, SR, WEB, ZONE_H, ZONE_W, band_energy, bern_fid, bigrams, dump, fid, fid_null, grey,
                 load, read_wav, render_array, site_sums, synth, to_png, write_wav, zone_sites)

MEDIA = WEB / "media"
QPU = int(os.environ.get("TWEEZER_QPU_WAIT", "3600"))   # hardware queues can take many minutes

# ------------------------------------------------------------------ hardware target
# Every hardware-capable stage targets IBM's ibm_fez (Heron r2, 156 qubits) first. Each one re-runs on ibm_fez with the
# SAME input it had in the recorded day, so the ibm_fez result can be set beside the recorded one stage by stage. The
# later stages keep reading the recorded run (that is the run they were fed; re-feeding the whole day from ibm_fez would
# need new jobs for every downstream stage). When an ibm_fez job fails, the stage keeps its recorded run, labelled with
# what happened on ibm_fez. Every attempt is logged in out/fez_failed.json and none is counted.
HW = "ibm_fez"
FEZ_LOG = OUT / "fez_failed.json"
FEZ_TRIES = 2                 # an ibm_fez job is tried at most twice; the credit cap can refuse the second try

# ------------------------------------------------------------------ parameters (cache keys: do not edit)
P_COIN = {"mode": "qpu", "backend_name": HW, "shots": 144}
P_COIN_REC = {"mode": "qpu", "shots": 144}       # the recorded run: platform's least-busy pick (ibm_marrakesh)
P_COMET = {"num_qubits": 148, "shots": 10000, "mode": "qpu", "backend_name": HW, "bell_witness": True,
           "output_bytes": 2048, "derive": {"integers": {"min": 0, "max": 9999, "count": 16}}}
P_COMET_REC = {**P_COMET, "backend_name": "ibm_marrakesh"}   # the recorded run, which fed the rest of the day
P_SHADER = {"reflectance": 0.15, "absorption": 0.5, "layers": 6, "incoming_rays": 6, "interaction": 1.0,
            "style": "frustrated", "resolution": 60}


def media(name):
    MEDIA.mkdir(parents=True, exist_ok=True)
    return MEDIA / name


def rel(p):
    return p.relative_to(WEB).as_posix()


def hop(F, null=None, metric="", parent=None, outcomes=""):
    return {"F": round(F, 4), "null": None if null is None else round(null, 4), "metric": metric,
            "parent": parent, "outcomes": outcomes}


# ------------------------------------------------------------------ ibm_fez runs: try, log, fall back honestly
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def server_msg(msg):
    m = re.search(r'"message": "([^"]+)', msg)
    s = m.group(1) if m else msg[:240]
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda x: chr(int(x.group(1), 16)), s)


def fez_run(ctx, stage, engine, params, files=None, timeout=None):
    """This stage's ibm_fez job. Returns {"rec": the completed record or None, "status": ok | failed | pending | not retried,
    "attempts": every failed ibm_fez attempt (job ID, error), "why": the reason a retry was not sent}.
    A failed attempt is logged in out/fez_failed.json, and a stage is tried at most FEZ_TRIES times. A retry that the
    piece's credit cap (or MOTH_FREEZE) refuses is reported as not retried; nothing is ever counted that did not complete."""
    a = ctx["atlas"]
    log = load(FEZ_LOG) if FEZ_LOG.exists() else {}
    tried = log.get(stage, [])
    if len(tried) >= FEZ_TRIES:
        return {"rec": None, "status": "failed", "attempts": tried, "why": f"tried {len(tried)} times"}
    try:
        return {"rec": a.run(engine, params, files=files, timeout=timeout or QPU), "status": "ok", "attempts": tried}
    except AtlasError as e:
        msg = str(e)
        if "re-run to resume" in msg:
            m = UUID.search(msg)
            return {"rec": None, "status": "pending", "attempts": tried, "job_id": m.group(0) if m else None}
        if "MOTH_FREEZE" in msg or "credit cap" in msg:
            cap = ctx.get("cap")
            cost = max([t.get("credits") or 0 for t in tried] or [0])
            why = (f"no second try: it would pass this piece's credit cap ({cap:g} credits)"
                   if cap is not None and a.spent() + cost > cap else "not retried in this pass")
            return {"rec": None, "status": "not retried" if tried else "not run", "attempts": tried, "why": why}
        m = UUID.search(msg)
        try:
            credits = a.credits_per_run(engine)
        except AtlasError:
            credits = None
        tried = tried + [{"engine": engine, "job_id": m.group(0) if m else None, "backend": HW, "attempt": len(tried) + 1,
                          "error": server_msg(msg), "credits": credits}]
        log = load(FEZ_LOG) if FEZ_LOG.exists() else {}
        log[stage] = tried
        dump(log, FEZ_LOG)
        return {"rec": None, "status": "failed", "attempts": tried}


RUN_KEYS = ("where", "backend", "qubits", "qubits_how", "job_id", "ibm_job_id", "params", "input", "output", "data", "hop",
            "analogy", "media", "result_meta")


def assemble(base, rec_run, fez, fz, fed):
    """One stage record. `rec_run` is the recorded run (it fed the later stages); `fez` the ibm_fez run on the same input,
    or None. With an ibm_fez result, that result is the stage's primary data and the recorded run is kept as a labelled
    comparison (`earlier`). Without one, the recorded run stays primary and `fez` says what happened on ibm_fez."""
    if fez:
        out = {**base, **fez, "completed": True, "jobs": [fez["job_id"], rec_run["job_id"]],
               "earlier": {**{k: rec_run[k] for k in RUN_KEYS if k in rec_run}, "fed": fed}}
        if fz["attempts"]:
            out["fez"] = {"status": "ok", "attempts": fz["attempts"]}
        return out
    return {**base, **rec_run, "completed": True, "fed": fed,
            "fez": {"status": fz["status"], "attempts": fz["attempts"], "why": fz.get("why"), "job_id": fz.get("job_id"),
                    "params": fz.get("params")}}


# ================================================================== 05:00 coin-toss-v1 (IBM hardware)
def coin_run(rec, params):
    r = rec["response"]["result"]
    f = r["heads"] / r["shots"]
    return {
        "analogy": f"Atlas ran a 1-qubit Hadamard coin, 144 times (one toss per tweezer), on IBM hardware ({r['backend']}). "
                   "No atoms.",
        "where": f"IBM hardware ({r['backend']})", "backend": r["backend"], "qubits": 1,
        "qubits_how": "one qubit by construction (engine description)", "job_id": rec["job_id"],
        "ibm_job_id": r.get("ibm_job_id"), "params": params,
        "input": "144 shots of H then measure", "output": f"{r['heads']} heads / {r['tails']} tails",
        "data": {"heads": r["heads"], "tails": r["tails"], "shots": r["shots"], "fill": f},
        "hop": hop(bern_fid(0.5, f), metric="Bernoulli fidelity between the design odds (0.5) and the measured heads fraction",
                   parent="design", outcomes="loaded / empty"),
    }


def stage_coin(ctx):
    a = ctx["atlas"]
    rec_run = coin_run(a.run("coin-toss-v1", P_COIN_REC, timeout=QPU), P_COIN_REC)
    fz = fez_run(ctx, "coin", "coin-toss-v1", P_COIN)
    fz["params"] = P_COIN
    fez = coin_run(fz["rec"], P_COIN) if fz["rec"] else None
    ctx["coin"] = {"fill": (fez or rec_run)["data"]["fill"], "fill_rec": rec_run["data"]["fill"]}
    base = {"id": "coin", "clock": "05:00", "engine": "coin-toss-v1", "title": "Will a tweezer catch an atom?",
            "role": "Per-site loading odds. In a real array, light-assisted collisions leave each tweezer with "
                    "0 or 1 atom, roughly half the time each."}
    return assemble(base, rec_run, fez, fz, fed="its heads fraction is the design odds the 05:30 load is scored against")


# ================================================================== 05:30 comet-qrng-v1 (IBM hardware, 156 qubits)
def comet_shots(out):
    """Expand comet's counts dict into one row per shot, IN THE DICT'S KEY ORDER.
    comet returns counts only (raw.memory_available is False), so there is no per-shot time order. Its keys arrive
    sorted lexicographically, so row i here is 'bitstring #i of the sorted counts', not 'shot #i of the run'."""
    counts = out["raw"]["counts"]
    shots = []
    for b, n in counts.items():
        shots.extend([b] * int(n))
    return shots


def comet_run(rec, params, f_coin):
    """-> (run part of the record, the signal the later stages read)."""
    out = rec["response"]["result"]["output"]
    shots = comet_shots(out)
    reg = np.array([[c == "1" for c in s[:148]] for s in shots], dtype=np.uint8)   # shots x 148
    fill = float(reg.mean())
    site_bias = reg[:, :N_SITES].mean(axis=0)
    picks = out["random"]["derived"]["integers"]["values"]
    frames = [reg[i % len(shots), :N_SITES] for i in picks]
    prov = out.get("provenance", {})
    ent = out.get("entropy") or {}
    bw = out.get("bell_witness", {})
    sig = {"reg": reg, "frames": frames, "snap": frames[0], "picks": picks, "fill": fill, "bell": bw,
           "backend": prov.get("backend"), "job_id": rec["job_id"]}
    run = {
        "analogy": f"Atlas put 148 qubits of IBM's {prov.get('backend')} in |+> and measured them 10,000 times, plus 8 "
                   "qubits of Bell pairs as a fidelity witness. A qubit reading 1 stands in for a loaded tweezer.",
        "where": f"IBM hardware ({prov.get('backend')})", "backend": prov.get("backend"),
        "qubits": 156, "qubits_how": "148 register + 8 Bell-witness qubits (params; engine description)",
        "job_id": rec["job_id"], "ibm_job_id": prov.get("provider_job_id"), "params": params,
        "input": "148-qubit |+> register, 10,000 shots, CHSH witness on", "output":
            f"counts over {len(shots)} shots ({len(out['raw']['counts'])} distinct bitstrings, no per-shot order); "
            f"fill {fill:.3f}; CHSH S = {bw.get('S')}",
        "data": {"fill": fill, "site_bias": site_bias.round(4).tolist(), "picks": picks,
                 "distinct": len(out["raw"]["counts"]),
                 "keys_sorted": list(out["raw"]["counts"]) == sorted(out["raw"]["counts"]),
                 "memory": bool(out["raw"].get("memory_available")),
                 "frames": ["".join(map(str, f.tolist())) for f in frames],
                 "S": bw.get("S"), "sigma_S": bw.get("sigma_S"),
                 "violates": bw.get("violates_classical_3sigma"),
                 "h_bit": ent.get("h_bit"), "budget_bits": ent.get("budget_bits"),
                 "correlators": [{"E": c.get("E"), "setting": c.get("setting")} for c in bw.get("correlators", [])],
                 "qpu_seconds": prov.get("qpu_seconds"), "hex": out["random"]["hex"][:64]},
        "hop": hop(bern_fid(f_coin, fill), metric="Bernoulli fidelity: the 1-qubit coin's odds vs the 148-qubit register's mean fill",
                   parent="coin", outcomes="loaded / empty"),
    }
    return run, sig


def stage_comet(ctx):
    a = ctx["atlas"]
    rec_run, sig = comet_run(a.run("comet-qrng-v1", P_COMET_REC, timeout=QPU), P_COMET_REC, ctx["coin"]["fill_rec"])
    np.save(OUT / "comet_register.npy", sig["reg"])
    ctx["comet"] = sig                     # the recorded load is the one every later stage was fed
    fz = fez_run(ctx, "comet", "comet-qrng-v1", P_COMET)
    fz["params"] = P_COMET
    fez = comet_run(fz["rec"], P_COMET, ctx["coin"]["fill"])[0] if fz["rec"] else None
    base = {"id": "comet", "clock": "05:30", "engine": "comet-qrng-v1", "title": "Load the whole array at once",
            "role": "Stochastic loading of all 144 tweezers. Each shot of the chip is one loading attempt. The engine "
                    "returns counts per bitstring, with no record of which shot came when, so the day picks its attempts "
                    "with comet's own conditioned random integers (indices into the sorted counts)."}
    return assemble(base, rec_run, fez, fz, fed="its attempt 1 is the array the day continues with; its first eight "
                    "attempts teach the 06:00 reservoir, its CHSH value sets the 11:00 and 20:00 noise, and its sorted "
                    "counts are the 23:00 record")


# ================================================================== 07:00 entanglement-shader-v1 (the vacuum-cell glass)
LAMBDA_NM, SPACING_NM, THETA_MAX = 780.0, 500.0, math.radians(30)


def read_hdr(data: bytes):
    """Flat (non-RLE) Radiance RGBE -> float array (rows, cols). The engine writes grey, so R=G=B."""
    _, _, body = data.partition(b"\n\n")
    dims, _, px = body.partition(b"\n")
    h, w = int(dims.split()[1]), int(dims.split()[3])
    a = np.frombuffer(px[:h * w * 4], np.uint8).reshape(h, w, 4).astype(np.float64)
    e = a[..., 3]
    return np.where(e > 0, a[..., 0] * np.ldexp(1.0, (e - 136).astype(int)), 0.0)


def lut_sample(lut, theta, s):
    """Bilinear sample: rows = incidence angle 0..pi/2, cols = periodic phase 0..1 (engine GLSL layout)."""
    h, w = lut.shape
    t = theta / (math.pi / 2) * (h - 1)
    x = (s % 1.0) * w
    r0, c0 = int(math.floor(t)), int(math.floor(x)) % w
    r1, c1 = min(r0 + 1, h - 1), (c0 + 1) % w
    fr, fc = t - math.floor(t), x - math.floor(x)
    return (1 - fr) * ((1 - fc) * lut[r0, c0] + fc * lut[r0, c1]) + fr * ((1 - fc) * lut[r1, c0] + fc * lut[r1, c1])


def site_angles():
    cx = cy = (COLS - 1) / 2
    rmax = math.hypot(cx, cy)
    return [THETA_MAX * math.hypot(c - cx, r - cy) / rmax for r, c in (divmod(i, COLS) for i in range(N_SITES))]


def site_transmission(T):
    """Each tweezer's distance from the optical axis -> incidence angle on the glass (corners = 30 deg);
    phase from the shader's own GLSL formula with 780 nm fluorescence and 500 nm spacing. CLASSICAL mapping."""
    out = []
    for th in site_angles():
        D = -2.0 * 2 * math.pi * SPACING_NM * math.cos(th)
        s = (D / LAMBDA_NM) % (2 * math.pi) / (2 * math.pi)
        out.append(lut_sample(T, th, s))
    return np.array(out)


def stage_shader(ctx):
    a = ctx["atlas"]
    rec = a.run("entanglement-shader-v1", P_SHADER, timeout=3600)
    z = zipfile.ZipFile(a.outputs(rec)["result"])
    name = lambda suf: [n for n in z.namelist() if n.endswith(suf)][0]  # noqa: E731
    R, T = read_hdr(z.read(name("R_lut.hdr"))), read_hdr(z.read(name("T_lut.hdr")))
    t_site = site_transmission(T)
    snap = ctx["comet"]["snap"].astype(float)
    flux = snap * t_site / t_site.max()
    ctx["shader"] = {"T": T, "t_site": t_site, "flux": flux}
    return {
        "id": "shader", "clock": "07:00", "engine": "entanglement-shader-v1", "completed": True,
        "title": "Light leaves through the glass",
        "role": "Fluorescence from each atom exits the vacuum cell through coated glass. How much gets through depends "
                "on the angle, so some tweezers look dimmer than others.",
        "analogy": "Atlas computed transmission and reflection lookup tables for a 6-layer, 6-ray stack on a simulator, "
                   "at the engine's 21-qubit budget. We read each tweezer's transmission off the T table. "
                   "The mapping from tweezer position to angle (corners = 30 deg) is our assumption.",
        "where": "Atlas simulator", "backend": "simulator", "qubits": 21,
        "qubits_how": "the engine's 21-qubit budget: (6 layers, 6 rays) is the largest configuration with rays >= layers "
                      "that its validator accepts; (6, 7) is rejected as over 21 qubits (entry 03's probe jobs). "
                      "The engine does not report an exact count.",
        "job_id": rec["job_id"], "params": P_SHADER,
        "input": "comet snapshot (which tweezers hold atoms): attempt 1 of the recorded load "
                 f"({ctx['comet'].get('backend', 'ibm_marrakesh')})", "output": "60 x 60 R and T lookup tables",
        "data": {"T": np.round(T, 4).tolist(), "R": np.round(R, 4).tolist(), "t_site": np.round(t_site, 4).tolist(),
                 "lambda_nm": LAMBDA_NM, "spacing_nm": SPACING_NM, "theta_max_deg": 30,
                 "occ": "".join(str(int(x)) for x in ctx["comet"]["snap"])},
        "hop": hop(fid(snap, flux), fid_null(snap, flux), "F between where the atoms are and where the transmitted light is",
                   parent="comet", outcomes="144 tweezer sites"),
    }


# ================================================================== 07:30 blur-v1 (camera point-spread)
P_BLUR = {"strength": 0.5, "style": "rx", "reach": 0.0}


def stage_blur(ctx):
    a = ctx["atlas"]
    flux = ctx["shader"]["flux"]
    src = to_png(render_array(flux), OUT / "fluor_ideal.png")
    rec = a.run("blur-v1", P_BLUR, files={"image": src})
    dst = OUT / "fluor_camera.png"
    shutil.copyfile(a.outputs(rec)["result"], dst)
    sites = site_sums(grey(dst))
    ctx["blur"] = {"img": dst, "sites": sites}
    return {
        "id": "blur", "clock": "07:30", "engine": "blur-v1", "completed": True,
        "title": "The camera sees spots, not atoms",
        "role": "A fluorescence camera smears each atom into a point-spread blob. A quantum blur plays that part here.",
        "analogy": "Atlas encoded the 1024 x 1024 ideal fluorescence image into a 20-qubit statevector, applied one Rx "
                   "rotation per qubit and read it back, on a classical statevector simulator.",
        "where": "Atlas statevector simulator", "backend": "simulator", "qubits": 20,
        "qubits_how": "1024 x 1024 region: ceil(log2 1024) x 2 = 20 (engine rule)",
        "job_id": rec["job_id"], "params": P_BLUR,
        "input": "ideal fluorescence render (atoms x glass transmission)", "output": "blurred camera frame",
        "media": {"before": "fluor_ideal.png", "after": "fluor_camera.png"},
        "data": {"sites": np.round(sites / sites.max(), 4).tolist()},
        "hop": hop(fid(flux, sites), fid_null(flux, sites), "F between transmitted light per tweezer and camera counts per tweezer",
                   parent="shader", outcomes="144 tweezer sites"),
    }


# ================================================================== 08:00 deep-fryer-v1 (overexposed frame)
P_FRY = {"gates": [["rx", 0.5], ["cz", 0.5]], "tile_size": 4}
FRY_WAIT = 20   # known server timeouts: do not block the chain; a re-run resumes the same job


def stage_fryer(ctx):
    a = ctx["atlas"]
    src = OUT / "fryer_in.png"
    Image.open(ctx["blur"]["img"]).convert("L").resize((256, 256), Image.LANCZOS).save(src)
    prev = site_sums(grey(src))
    rec = a.run("deep-fryer-v1", P_FRY, files={"image": src}, timeout=FRY_WAIT)
    dst = OUT / "fryer_out.png"
    shutil.copyfile(a.outputs(rec)["result"], dst)
    sites = site_sums(grey(dst))
    ctx["fryer"] = {"img": dst, "sites": sites}
    return {
        "id": "fryer", "clock": "08:00", "engine": "deep-fryer-v1", "completed": True,
        "title": "Crank the gain too far",
        "role": "A side branch: the same camera frame taken with the gain pushed too far. Bright spots saturate and the "
                "background lifts. This frame is not used downstream.",
        "analogy": "Atlas treated each 4 x 4 tile of the frame as a 16-qubit lattice (one pixel per qubit), applied Rx and a "
                   "half-CZ between neighbours, and read the Bloch vectors back, on a statevector simulator.",
        "where": "Atlas statevector simulator", "backend": "simulator", "qubits": 16,
        "qubits_how": "tile_size 4 -> 4 x 4 = 16 qubits per tile (engine description; the maximum tile_size)",
        "job_id": rec["job_id"], "params": P_FRY,
        "input": "camera frame (256 x 256)", "output": "deep-fried frame",
        "media": {"before": "fryer_in.png", "after": "fryer_out.png"},
        "data": {"sites": np.round(sites / max(sites.max(), 1e-9), 4).tolist()},
        "hop": hop(fid(prev, sites), fid_null(prev, sites), "F between camera counts per tweezer before and after frying",
                   parent="blur", outcomes="144 tweezer sites"),
    }


# ================================================================== 08:15 tessa-image-v1 (digitise the frame)
P_TESSA = {"machine": HW, "shots": 4096}
TESSA_FIRST = {"engine": "tessa-image-v1", "job_id": "ca5e2709-ead8-49d7-b8fd-425422677d3d", "backend": "fake_fez",
               "attempt": 0, "error": "The engine did not respond in time (engine_timeout)", "type": "engine_timeout",
               "size": "64x64", "shots": 4096, "submitted_at": "2026-10-05T05:24:26Z",
               "note": "the recorded day's attempt, on the fake_fez noise model"}
# 5 Oct: the same camera frame scaled down with Pillow and sent with fewer shots, to fit the engine's time limit.
# run_tessa_small.py submits (emulator first, ibm_fez only if the emulator completes) and logs every try here.
TESSA_SMALL = OUT / "tessa_small.json"
TESSA_WHY = ("tessa-image-v1 is a synchronous engine: one call has to encode, run and decode the whole frame. Every "
             "attempt timed out on Atlas's side 60 to 90 seconds after it was submitted, before the engine reported any "
             "progress, even a 16 x 16 copy of the frame at 1024 shots, so a smaller job did not help.")


def small_attempts():
    """The downscaled-frame tries from out/tessa_small.json, in the same shape as the other attempts."""
    log = load(TESSA_SMALL) if TESSA_SMALL.exists() else []
    return [{"engine": e["engine"], "job_id": e["job_id"], "backend": e["machine"], "size": e["size"], "shots": e["shots"],
             "params": e["params"], "status": e["status"], "type": e.get("type"), "error": e.get("error"),
             "submitted_at": e.get("submitted_at"), "updated_at": e.get("updated_at"), "credits": e.get("credits"),
             "downscaled": True,
             "note": f"the 07:30 camera frame scaled down to {e['size'].replace('x', ' x ')} with Pillow (Lanczos)"}
            for e in log]


def stage_tessa(ctx):
    """A side branch now: the day was recorded while this engine timed out, so 08:30 reads the camera frame directly.
    The stage is retried on ibm_fez (real hardware), on the same 64 x 64 camera frame, and then on a downscaled copy of
    that frame (run_tessa_small.py); no try has completed, so the station stays closed with every attempt listed."""
    parent = "blur"
    src = OUT / "tessa_in.png"
    Image.open(ctx[parent]["img"]).convert("L").resize((64, 64), Image.LANCZOS).save(src)
    prev = site_sums(grey(src))
    fz = fez_run(ctx, "tessa", "tessa-image-v1", P_TESSA, files={"image": src}, timeout=QPU)
    base = {"id": "tessa", "clock": "08:15", "engine": "tessa-image-v1", "title": "Digitise the frame"}
    small = small_attempts()
    if any(t["status"] == "completed" for t in small):   # none has: wire a completed one in as the stage's result
        raise RuntimeError("a downscaled 08:15 tessa run completed; stages.stage_tessa does not show it yet")
    if not fz["rec"]:
        fez64 = [{**t, "size": "64x64", "shots": P_TESSA["shots"]} for t in fz["attempts"]]
        tries = [TESSA_FIRST] + fez64 + [t for t in small if t["status"] != "completed"]
        last = tries[-1]
        return {**base, **INFO["tessa"], "completed": False, "job_id": last.get("job_id"), "error": last.get("error"),
                "attempts": tries, "why": TESSA_WHY,
                "params": last.get("params") or {"machine": last.get("backend"), "shots": last.get("shots")},   # the shown job's
                "small": {"attempts": [t for t in small if t["status"] != "completed"]},
                "fez": {"status": fz["status"], "attempts": fz["attempts"], "why": fz.get("why"), "params": P_TESSA}}
    a = ctx["atlas"]
    rec = fz["rec"]
    dst = OUT / "tessa_out.png"
    shutil.copyfile(a.outputs(rec)["result"], dst)
    sites = site_sums(grey(dst))
    r = rec["response"].get("result") or {}
    return {
        **base, "completed": True,
        "role": "A side branch: the camera frame becomes numbers. Every conversion is another place for the signal to "
                "fray. The day was recorded while this engine was timing out, so 08:30 reads the camera frame directly.",
        "analogy": "Atlas encoded the 64 x 64 frame onto qubits (each pixel a point on the colour sphere), measured it on "
                   f"IBM hardware ({r.get('backend') or HW}) in one joint job, and decoded it back.",
        "where": f"IBM hardware ({r.get('backend') or HW})", "backend": r.get("backend") or HW,
        "qubits": r.get("num_qubits") or r.get("qubits"),
        "qubits_how": "as reported by the engine" if (r.get("num_qubits") or r.get("qubits")) else
                      "data cells packed across the chip (engine description); total not reported",
        "job_id": rec["job_id"], "ibm_job_id": r.get("ibm_job_id"), "params": P_TESSA,
        "result_meta": {k: v for k, v in r.items() if k != "output"},
        "attempts": [TESSA_FIRST] + fz["attempts"],
        "input": f"{parent} frame (64 x 64)", "output": "frame after the quantum round trip",
        "media": {"before": "tessa_in.png", "after": "tessa_out.png"},
        "data": {"sites": np.round(sites / max(sites.max(), 1e-9), 4).tolist()},
        "hop": hop(fid(prev, sites), fid_null(prev, sites), "F between counts per tweezer before and after the round trip",
                   parent=parent, outcomes="144 tweezer sites"),
    }


# ================================================================== 08:30 qpixl-v1 (count photons, call each site)
P_QPIXL_BASE = {"mode": "qpu", "backend_name": HW, "shots": 8192, "dynamic_range": "min_max"}
P_QPIXL_REC = {"mode": "emu", "machine": "fake_fez", "shots": 8192, "dynamic_range": "min_max"}   # the recorded run


def qpixl_run(rec, base, vals, truth, parent):
    """-> (run part, signal). The threshold (an Otsu split of the decoded counts) is a CLASSICAL decision."""
    res = rec["response"]["result"]
    got = np.array(res["output"], dtype=float)[:N_SITES]
    # classical decision: Otsu split of the decoded counts; ties across an empty gap -> take the gap's middle
    ts = np.linspace(0.02, 0.98, 97)
    scores = []
    for t in ts:
        lo, hi = got[got < t], got[got >= t]
        scores.append(len(lo) * len(hi) * (hi.mean() - lo.mean()) ** 2 if len(lo) and len(hi) else -1.0)
    scores = np.array(scores)
    thr = float(np.median(ts[scores >= scores.max() - 1e-9]))
    det = (got >= thr).astype(int)
    acc = float((det == truth).mean())
    hw = base.get("mode") == "qpu"
    be = res.get("backend") or (base.get("backend_name") if hw else base.get("machine"))
    run = {
        "analogy": "Atlas encoded the 144 per-tweezer counts as rotation angles (Interwoven QPIXL), sampled them 8192 times "
                   + (f"in one joint job on IBM hardware ({be})" if hw else
                      "per group on fake_fez (a simulator with IBM Fez's noise)") + " and decoded them. The threshold is classical.",
        "where": f"IBM hardware ({be})" if hw else "Atlas emulator (fake_fez noise model)", "backend": be,
        "qubits": res.get("num_qubits"),
        "qubits_how": f"address qubits ceil(log2 144) = {math.ceil(math.log2(N_SITES))} plus data qubits on the engine's "
                      "lattice; total not reported",
        "job_id": rec["job_id"], "ibm_job_id": res.get("ibm_job_id") or None, "params": {**base, "values": f"{len(vals)} floats"},
        "input": f"{len(vals)} per-tweezer counts from {parent}", "output": f"decoded counts; threshold {thr:.2f}",
        "data": {"in": vals, "out": np.round(got, 4).tolist(), "det": det.tolist(), "thr": round(thr, 3),
                 "truth": truth.tolist(), "accuracy": acc},
        "hop": hop(fid(vals, got), fid_null(vals, got), "F between the counts sent in and the counts decoded",
                   parent=parent, outcomes="144 tweezer sites"),
    }
    return run, {"vals": np.array(vals), "got": got, "det": det, "thr": thr}


def stage_qpixl(ctx):
    a = ctx["atlas"]
    parent = "blur"            # the recorded day read the camera frame (08:15 was down), and the ibm_fez run reads the same
    v = ctx[parent]["sites"]
    vals = [round(float(x), 4) for x in (v - v.min()) / (v.max() - v.min())]
    truth = ctx["comet"]["snap"].astype(int)
    rec_run, sig = qpixl_run(a.run("qpixl-v1", {**P_QPIXL_REC, "values": vals}, timeout=QPU), P_QPIXL_REC, vals, truth, parent)
    ctx["qpixl"] = sig                     # the recorded calls fed the 09:00 lane plan
    fz = fez_run(ctx, "qpixl", "qpixl-v1", {**P_QPIXL_BASE, "values": vals})
    fz["params"] = {**P_QPIXL_BASE, "values": f"{len(vals)} floats (the same counts)"}
    fez = qpixl_run(fz["rec"], P_QPIXL_BASE, vals, truth, parent)[0] if fz["rec"] else None
    base = {"id": "qpixl", "clock": "08:30", "engine": "qpixl-v1", "title": "Count the photons, call each site",
            "role": "Photon counts per tweezer are compared with a threshold: above it, an atom; below it, empty."}
    return assemble(base, rec_run, fez, fz, fed="its loaded/empty calls are the occupancy the 09:00 lane plan starts from")


# ================================================================== 09:00 labyrinth-v1 (move corridors in the target zone)
def zone_edges():
    """Grid-adjacent pairs inside the 4 x 5 zone, zone indices (row-major)."""
    e = []
    for r in range(ZONE_H):
        for c in range(ZONE_W):
            k = r * ZONE_W + c
            if c + 1 < ZONE_W:
                e.append([k, k + 1])
            if r + 1 < ZONE_H:
                e.append([k, k + ZONE_W])
    return e


def edge_zz(meas, edges):
    """<Z_a Z_b> per edge from sampled bitstrings (qubit 0 leftmost), weighted by probability."""
    tot = sum(m["probability"] for m in meas)
    out = []
    for a_, b_ in edges:
        s = sum(m["probability"] * (1 if m["bitstring"][a_] == m["bitstring"][b_] else -1) for m in meas)
        out.append(s / tot)
    return out


def fill_zone(zocc, open_edges):
    """CLASSICAL toy rearrangement: a hole in the zone can be filled from the reservoir if it is on the zone's rim,
    or joined to the rim through open corridors. Returns the zone occupancy after the moves."""
    rim = {r * ZONE_W + c for r in range(ZONE_H) for c in range(ZONE_W) if r in (0, ZONE_H - 1) or c in (0, ZONE_W - 1)}
    adj = {k: set() for k in range(ZONE_H * ZONE_W)}
    for a_, b_ in open_edges:
        adj[a_].add(b_)
        adj[b_].add(a_)
    reach, stack = set(rim), list(rim)
    while stack:
        k = stack.pop()
        for n in adj[k]:
            if n not in reach:
                reach.add(n)
                stack.append(n)
    return [1 if (o or k in reach) else 0 for k, o in enumerate(zocc)]


def maze_run(rec, params, zocc, corridors, edges):
    """-> (run part, signal). The move rule through the sampled maze is CLASSICAL."""
    out = rec["response"]["result"]["output"]
    meas = out["results"]["measurements"]
    signs = {tuple(x["qubits"]): x["sign"] for x in out["target"]["edge_signs"]}
    zz = edge_zz(meas, edges)
    per_edge = [(1 + signs.get(tuple(e), -1) * z) / 2 for e, z in zip(edges, zz)]   # P(edge came out as asked)
    best = max(meas, key=lambda m: m["probability"])["bitstring"]
    opened = [e for e in edges if best[e[0]] == best[e[1]]]
    after = fill_zone(zocc, opened)
    met = out["metrics"]
    hw = params.get("mode") == "qpu"
    be = met.get("backend")
    run = {
        "analogy": "Atlas turned each wanted lane into a ZZ = +1 correlation and each forbidden one into ZZ = -1 on a "
                   f"20-qubit grid, prepared that state and sampled it 4096 times on "
                   + (f"IBM hardware ({be})" if hw else "an Aer simulator") + ". One sampled maze sets the lanes; the "
                   "moves through them are classical.",
        "where": f"IBM hardware ({be})" if hw else "Atlas emulator (Aer, noiseless)", "backend": be, "qubits": 20,
        "qubits_how": "one qubit per room: 4 x 5 grid = 20 (level_data.num_qubits; the target zone"
                      + (", the same level as the recorded Aer run)" if hw else "; emu ceiling)"),
        "job_id": rec["job_id"], "ibm_job_id": met.get("ibm_job_id"),
        "params": {**params, "level_data": f"4x5 grid, {len(corridors)} corridors"},
        "input": f"detected zone occupancy ({sum(zocc)}/20 loaded) -> {len(corridors)} wanted lanes",
        "output": f"most likely maze opens {len(opened)} lanes; zone after moves {sum(after)}/20",
        "data": {"zocc": zocc, "after": after, "edges": edges, "signs": [signs.get(tuple(e), -1) for e in edges],
                 "zz": np.round(zz, 4).tolist(), "per_edge": np.round(per_edge, 4).tolist(), "opened": opened,
                 "best": best, "sz_samp": met.get("sz_samp"), "sz_tomo": met.get("sz_tomo"),
                 "n_meas": len(meas), "qpu_seconds": met.get("qpu_seconds")},
        "hop": hop(float(np.mean(per_edge)), 0.5, "mean per-lane fidelity: how often each lane came out as asked (open or wall)",
                   parent="qpixl", outcomes=f"{len(edges)} lanes"),
    }
    return run, {"zocc": zocc, "after": after, "opened": opened, "corridors": corridors}


def stage_maze(ctx):
    a = ctx["atlas"]
    det = ctx["qpixl"]["det"]
    zs = zone_sites()
    zocc = [int(det[i]) for i in zs]
    edges = zone_edges()
    corridors = [e for e in edges if not (zocc[e[0]] and zocc[e[1]])]   # a move is useful/safe where a site is empty
    level = {"name": "Tweezer target zone", "grid_size": {"rows": ZONE_H, "cols": ZONE_W}, "num_qubits": ZONE_H * ZONE_W,
             "coupling_map": corridors, "initial_states": {}}
    params = {"level_data": level, "shots": 4096, "mode": "emu", "top_n": -1}            # the recorded run (Aer)
    params_hw = {**params, "mode": "qpu", "backend_name": HW}                           # same level on ibm_fez
    rec_run, sig = maze_run(a.run("labyrinth-v1", params, timeout=1800), params, zocc, corridors, edges)
    ctx["maze"] = sig                      # the recorded maze set the lanes the 09:30 moves used
    fz = fez_run(ctx, "maze", "labyrinth-v1", params_hw)
    fz["params"] = {**params_hw, "level_data": f"4x5 grid, {len(corridors)} corridors (the same level)"}
    fez = maze_run(fz["rec"], params_hw, zocc, corridors, edges)[0] if fz["rec"] else None
    base = {"id": "maze", "clock": "09:00", "engine": "labyrinth-v1", "title": "Plan the moves",
            "role": "Before rearranging, the control system decides which lanes the moving tweezer may use. A lane is wanted "
                    "where a site is empty; a lane between two loaded sites would knock an atom out."}
    return assemble(base, rec_run, fez, fz, fed="its most likely maze sets the lanes the 09:30 moves use")


# ================================================================== 09:30 telablur-v1 (before / after rearrangement)
P_TELA = {"strength": 0.5, "direction": "full", "size": 1024}


def plan_moves(det, truth, zone_after):
    """CLASSICAL bookkeeping of the rearrangement. The controller only knows what it DETECTED: it fills each planned
    hole with the nearest detected reservoir atom outside the zone. Reality follows TRUTH: a move from a site that
    only looked loaded carries nothing, and a site that only looked loaded stays empty.
    Returns (believed array, actual array, moves [(from, to)])."""
    det, truth = np.array(det, dtype=int), np.array(truth, dtype=int)
    zs = zone_sites()
    holes = [i for k, i in enumerate(zs) if zone_after[k] and not det[i]]
    pool = [i for i in range(N_SITES) if i not in zs and det[i]]
    believed, actual, moves = det.copy(), truth.copy(), []
    for h in holes:
        hr, hc = divmod(h, COLS)
        src = min(pool, key=lambda i: math.hypot(i // COLS - hr, i % COLS - hc))
        pool.remove(src)
        moves.append([int(src), int(h)])
        believed[src], believed[h] = 0, 1
        actual[h], actual[src] = actual[src], 0
    return believed, actual, moves


def stage_telablur(ctx):
    a = ctx["atlas"]
    before = np.array(ctx["qpixl"]["det"], dtype=float)
    believed, actual, moves = plan_moves(ctx["qpixl"]["det"], ctx["comet"]["snap"], ctx["maze"]["after"])
    after = believed.astype(float)
    p1 = to_png(render_array(before, sigma=9), OUT / "rearr_before.png")
    p2 = to_png(render_array(after, sigma=9), OUT / "rearr_after.png")
    rec = a.run("telablur-v1", P_TELA, files={"image1": p1, "image2": p2}, timeout=1800)
    dst = OUT / "rearr_mid.png"
    shutil.copyfile(a.outputs(rec)["result"], dst)
    s_mid = site_sums(grey(dst))
    mix = 0.5 * site_sums(grey(p1)) + 0.5 * site_sums(grey(p2))
    zs = zone_sites()
    ctx["telablur"] = {"after": after, "actual_zone": [int(actual[i]) for i in zs],
                       "believed_zone": [int(believed[i]) for i in zs]}
    return {
        "id": "telablur", "clock": "09:30", "engine": "telablur-v1", "completed": True,
        "title": "Drag atoms into place",
        "role": "Moving tweezers pull spare atoms from the reservoir into the holes of the target zone, frame by frame.",
        "analogy": "Atlas put the before and after frames into one quantum state (20 pixel qubits plus 1 selector qubit) "
                   "and rotated the selector halfway, on a statevector simulator. The middle frame is an "
                   "amplitude-level blend, not a physical trajectory.",
        "where": "Atlas statevector simulator", "backend": "simulator", "qubits": 21,
        "qubits_how": "1024 x 1024: 20 pixel qubits + 1 selector (engine description: n + 1)",
        "job_id": rec["job_id"], "params": P_TELA,
        "input": f"before ({int(before.sum())} atoms) and after ({int(after.sum())} atoms) frames",
        "output": "the halfway frame",
        "media": {"before": "rearr_before.png", "mid": "rearr_mid.png", "after": "rearr_after.png"},
        "data": {"before": before.astype(int).tolist(), "after": after.astype(int).tolist(),
                 "actual": actual.astype(int).tolist(), "truth": ctx["comet"]["snap"].astype(int).tolist(),
                 "moves": moves, "mid": np.round(s_mid / s_mid.max(), 4).tolist()},
        "hop": hop(fid(mix, s_mid), fid_null(mix, s_mid), "F between a plain 50/50 mix of before and after and the engine's halfway frame",
                   parent="maze", outcomes="144 tweezer sites"),
    }


# ================================================================== 10:00 graph-v1 (Rydberg blockade on a unit-disk graph)
def king_edges(zocc):
    """Unit-disk graph: loaded zone sites within sqrt(2) lattice spacings (King's-graph neighbourhood)."""
    e = []
    n = ZONE_H * ZONE_W
    for i in range(n):
        for j in range(i + 1, n):
            ri, ci, rj, cj = i // ZONE_W, i % ZONE_W, j // ZONE_W, j % ZONE_W
            if zocc[i] and zocc[j] and max(abs(ri - rj), abs(ci - cj)) == 1:
                e.append([i, j])
    return e


def mis_size(n, edges):
    best = 0
    nb = [0] * n
    for a_, b_ in edges:
        nb[a_] |= 1 << b_
        nb[b_] |= 1 << a_
    for m in range(1 << n):
        if bin(m).count("1") <= best:
            continue
        ok = all(not (m >> i & 1) or not (m & nb[i]) for i in range(n))
        if ok:
            best = bin(m).count("1")
    return best


def graph_run(rec, params, ops, edges, zocc, believed):
    """-> (run part, signal). The engine's tomography is exact and computed classically at build time, so it is the same
    on Aer and on hardware; only the measured patterns carry the hardware's noise. So a hardware run is scored from its
    measured patterns (the 20 most frequent the engine returns), and the recorded Aer run keeps its tomography score."""
    out = rec["response"]["result"]["output"]
    rel = out["tomography"]["relationships"]
    zz = [rel.get(f"{i},{j}", rel.get(f"{j},{i}", {})).get("ZZ", 0.0) for i, j in edges]
    p_anti = [(1 - z) / 2 for z in zz]
    meas = out["measurements"]["top"] if isinstance(out["measurements"], dict) and "top" in out["measurements"] else out["measurements"]
    meas = meas if isinstance(meas, list) else meas.get("measurements", [])
    blockade_ok = [all(not (m["bitstring"][i] == "1" and m["bitstring"][j] == "1") for i, j in edges) for m in meas]
    dom = out.get("dominant_bitstring") or (meas[0]["bitstring"] if meas else "")
    bloch = out["tomography"]["bloch"]
    zexp = [bloch[str(i)]["Z"] for i in range(20)]
    w = np.array([m["probability"] for m in meas], float)
    p_meas = [float(sum(wk for wk, m in zip(w, meas) if m["bitstring"][i] != m["bitstring"][j]) / max(w.sum(), 1e-12))
              for i, j in edges]                                  # P(the two ends read differently), top patterns only
    hw = params.get("mode") == "qpu"
    be = out.get("backend")
    F = float(np.mean(p_meas)) if hw else float(np.mean(p_anti))
    metric = ("mean per-edge fidelity with the anti-aligned (blockade-like) target, estimated from the patterns measured "
              f"on {be} (the 20 most frequent, {100 * w.sum():.1f}% of the shots)") if hw else \
             "mean per-edge fidelity of the prepared state with the anti-aligned (blockade-like) target, from the engine's exact tomography"
    run = {
        "analogy": "Atlas prepared a 20-qubit graph state with a ZZ = -1 target on every unit-disk edge (a stand-in "
                   "for the blockade penalty), then sampled it 4096 times on " + (f"IBM hardware ({be})" if hw else
                   "an Aer simulator") + ". Empty sites get a Z = +1 target (no atom, never excited).",
        "where": f"IBM hardware ({be})" if hw else "Atlas emulator (Aer, noiseless)", "backend": be, "qubits": 20,
        "qubits_how": "num_qubits = 20 (one per zone site; engine ceiling)",
        "job_id": rec["job_id"], "ibm_job_id": out.get("ibm_job_id"),
        "params": {**params, "operations": f"{len(ops)} ZZ=-1 targets", "coupling_map": f"{len(edges)} edges"},
        "input": f"{sum(zocc)} atoms in the zone -> {len(edges)} blockade edges",
        "output": f"dominant pattern {dom}; edge agreement {out.get('edge_agreement_score')}",
        "data": {"zocc": zocc, "believed": believed, "edges": edges, "zz": np.round(zz, 4).tolist(),
                 "p_anti": np.round(p_anti, 4).tolist(), "p_meas": np.round(p_meas, 4).tolist(),
                 "top_mass": round(float(w.sum()), 4),
                 "dominant": dom, "edge_agreement": out.get("edge_agreement_score"), "zexp": np.round(zexp, 4).tolist(),
                 "top": [{"b": m["bitstring"], "p": m["probability"], "ok": ok} for m, ok in zip(meas, blockade_ok)],
                 "mis": mis_size(20, edges)},
        "hop": hop(F, 0.5, metric, parent="telablur", outcomes=f"{len(edges)} blockade edges"),
    }
    return run, {"edges": edges, "dom": dom, "zexp": zexp, "meas": meas, "zocc": zocc}


def stage_graph(ctx):
    a = ctx["atlas"]
    zocc = ctx["telablur"]["actual_zone"]       # the blockade acts on atoms that are really there
    believed = ctx["telablur"]["believed_zone"]
    edges = king_edges(zocc)
    lattice = king_edges([1] * 20)              # every site must appear in coupling_map (engine rule)
    ops = [{"type": "bloch", "qubit": k, "paulis": {"Z": 1.0}} for k in range(20) if not zocc[k]]   # no atom: never excited
    ops += [{"type": "relationship", "qubits": e, "paulis": {"ZZ": -1.0}} for e in edges]
    params = {"num_qubits": 20, "coupling_map": lattice, "operations": ops, "shots": 4096, "mode": "emu", "seed": 6}
    params_hw = {**params, "mode": "qpu", "backend_name": HW}                           # same state on ibm_fez
    rec_run, sig = graph_run(a.run("graph-v1", params, timeout=1800), params, ops, edges, zocc, believed)
    ctx["graph"] = sig                     # the recorded patterns fed 11:00, 16:00 and 21:00
    fz = fez_run(ctx, "graph", "graph-v1", params_hw)
    fz["params"] = {**params_hw, "operations": f"{len(ops)} ZZ=-1 targets (the same state)", "coupling_map": f"{len(edges)} edges"}
    fez = graph_run(fz["rec"], params_hw, ops, edges, zocc, believed)[0] if fz["rec"] else None
    base = {"id": "graph", "clock": "10:00", "engine": "graph-v1", "title": "Switch on the Rydberg blockade",
            "role": "Atoms closer than the blockade radius cannot both be excited. On a square array whose radius reaches "
                    "the diagonal neighbours, that draws a unit-disk graph, as in Ebadi et al. (Science, 2022)."}
    return assemble(base, rec_run, fez, fz, fed="its measured patterns become the 11:00 answer and the 16:00 score, and "
                    "its per-qubit <Z> the 21:00 targets")


# ================================================================== 11:00 tamagotchi-v1 (keep the answer alive)
TAMA_N = 30            # logical qubits: the largest size that completed (60, 90 and 40 timed out; free probes)
TAMA_ROUNDS = [1, 4]


def tama_noise(S, scale=1.0):
    lam = max(0.0, 1 - S / (2 * math.sqrt(2)))     # depolarising strength implied by the morning's CHSH value
    lam *= scale
    return {"p_gate": round(lam, 5), "p_1q": round(lam / 10, 5), "p_meas": round(lam / 10, 5), "p_idle": round(lam / 10, 5)}


def stage_tamagotchi(ctx):
    a = ctx["atlas"]
    bits = [int(c) for c in ctx["graph"]["dom"]]
    n = TAMA_N                                  # logical i stores answer bit i mod 20 (10 bits get a second copy)
    S = ctx["comet"]["bell"]["S"]
    runs = []
    for label, scale in (("this morning's chip", 1.0), ("ten times better", 0.1)):
        for R in TAMA_ROUNDS:
            acts = [["X", i] for i in range(n) if bits[i % len(bits)]]
            acts += [["SE", list(range(n))] for _ in range(R)]
            params = {"code": "steane", "n_logical": n, "shots": 1024, "seed": 6, "actions": acts,
                      "noise": tama_noise(S, scale)}
            try:
                rec = a.run("tamagotchi-v1", params, timeout=1800)
            except AtlasError as e:   # free engine that was down during the build: retry on a later pass
                raise AtlasError(f"tamagotchi-v1 unavailable ({str(e)[:160]}); free engine, re-run to resume") from e
            o = rec["response"]["result"]["output"]
            succ = [p["success_rate"] for p in sorted(o["per_logical"], key=lambda p: p["logical_qubit"])]
            maj = [float(np.mean([succ[i] for i in range(n) if i % len(bits) == b])) for b in range(len(bits))]
            runs.append({"label": label, "rounds": R, "job_id": rec["job_id"], "noise": params["noise"],
                         "success": np.round(succ, 4).tolist(), "per_bit": np.round(maj, 4).tolist(),
                         "mean_success": float(np.mean(succ)), "logical_error_count": o.get("logical_error_count")})
    main = runs[0]
    ctx["tamagotchi"] = {"per_bit": main["per_bit"], "bits": bits}
    return {
        "id": "tamagotchi", "clock": "11:00", "engine": "tamagotchi-v1", "completed": True,
        "title": "Keep the answer alive",
        "role": "Physical qubits forget. Error correction spreads each bit of the answer over several atoms and keeps "
                "checking it. Here each bit of the Rydberg answer goes into a 7-qubit Steane logical qubit "
                "(ten bits get a second copy, to fill 30 logical qubits).",
        "analogy": f"Atlas wrote the 20-bit Rydberg answer into {n} Steane logical qubits and ran rounds of syndrome "
                   "extraction and correction on Aer's stabilizer simulator. The noise level comes from the CHSH value of "
                   f"this morning's recorded hardware load ({ctx['comet'].get('backend')}, S = {S}), read as a two-qubit depolarising strength 1 - S/2sqrt2 = "
                   f"{1 - S / (2 * math.sqrt(2)):.3f} (a rough proxy: S also absorbs readout error); the other noise terms "
                   "are a tenth of that. A second set uses noise ten times lower.",
        "where": "Atlas stabilizer simulator (Aer)", "backend": "aer stabilizer", "qubits": n * 7,
        "qubits_how": f"{n} logical x 7 data qubits (Steane code), plus syndrome ancillas the engine adds",
        "job_id": main["job_id"], "jobs": [r["job_id"] for r in runs], "params": {"code": "steane", "n_logical": n, "shots": 1024,
                                                                                  "rounds": TAMA_ROUNDS, "noise": main["noise"]},
        "input": f"answer {''.join(map(str, bits))} (the dominant pattern of the recorded 10:00 run) into {n} logical qubits", "output":
            f"mean logical success {main['mean_success']:.3f} after {main['rounds']} round(s)",
        "data": {"bits": bits, "runs": runs, "S": S},
        "hop": hop(main["mean_success"], 0.5, "mean per-logical fidelity: probability each logical qubit reads back the bit it was given",
                   parent="graph", outcomes=f"{n} logical qubits"),
    }


# ================================================================== 06:00 qrc-image-v1 (the morning flicker)
def frame_png(bits, path, size=192):
    """One loading attempt as a small frame: wing-ochre spots on night blue. CLASSICAL render.
    These are the engine's INPUT vocabulary and the cached qrc-image job is keyed on these exact images, so their
    (pre-rebrand) colours are kept; the page labels them as this piece's renders, as sent to the engine."""
    a = render_array(np.array(bits, dtype=float), sigma=7, size=size)
    bg, fg = np.array([13, 15, 23], float), np.array([237, 185, 92], float)
    rgb = (bg[None, None, :] * (1 - a[..., None]) + fg[None, None, :] * a[..., None]).round().astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(path)
    return path


def gif_tokens(gif_path, vocab):
    """Match each GIF frame to the nearest vocabulary frame (the GIF is built from those exact images)."""
    ref = {k: np.asarray(Image.open(p).convert("L").resize((48, 48)), float) for k, p in vocab.items()}
    im, toks = Image.open(gif_path), []
    try:
        while True:
            f = np.asarray(im.convert("L").resize((48, 48)), float)
            toks.append(min(ref, key=lambda k: ((ref[k] - f) ** 2).sum()))
            im.seek(im.tell() + 1)
    except EOFError:
        pass
    return toks


def stage_qrcimage(ctx):
    a = ctx["atlas"]
    frames = ctx["comet"]["frames"][:8]
    fdir = OUT / "qrc_frames"
    fdir.mkdir(exist_ok=True)
    vocab = {f"shot{k}.png": frame_png(f, fdir / f"shot{k}.png") for k, f in enumerate(frames)}
    zpath = OUT / "qrc_vocab.zip"
    if not zpath.exists():
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for k, p in vocab.items():
                z.write(p, k)
    train = list(vocab) * 3
    params = {"training_sequence": train, "length": 32, "fps": 4, "quality": "moderate", "seed": 6, "periodic": True}
    rec = a.run("qrc-image-v1", params, files={"vocabulary": zpath}, timeout=3600)
    outs = a.outputs(rec)
    gif = OUT / "qrc_flicker.gif"
    shutil.copyfile(outs["result"], gif)
    gen = gif_tokens(gif, vocab)
    voc = list(vocab)
    bt, bg = bigrams(train + train[:1], voc), bigrams(gen, voc)
    rng = np.random.default_rng(6)
    null = float(np.mean([fid(bt, bigrams(list(rng.permutation(gen)), voc)) for _ in range(200)]))
    return {
        "id": "qrcimage", "clock": "06:00", "engine": "qrc-image-v1", "completed": True,
        "title": "The morning flicker",
        "role": "Before a run, the machine loads, images and dumps the array again and again. Each attempt fills a "
                "different half of the tweezers.",
        "analogy": "Atlas trained a quantum reservoir (simulated) on a sequence of eight real loading attempts from the "
                   f"recorded IBM load ({ctx['comet'].get('backend', 'ibm_marrakesh')}), in the order picked by comet's "
                   "conditioned random integers, then let it generate 32 frames of its own. Any repeated order it plays "
                   "back is what it learned.",
        "where": "Atlas simulator (quantum reservoir)", "backend": "simulator", "qubits": None,
        "qubits_how": "reservoir size is set inside the engine and not reported",
        "job_id": rec["job_id"], "params": {**params, "training_sequence": f"8 frames x 3 = {len(train)} tokens"},
        "input": "8 loading attempts from comet, in the order picked by comet's conditioned random integers, rendered "
                 "as frames by this piece (classical)", "output": f"{len(gen)}-frame GIF",
        "media": {"frames": [f"qrc_frames/{k}" for k in vocab]},
        "data": {"train": [voc.index(t) for t in train], "gen": [voc.index(t) for t in gen], "fps": 4,
                 "frames": ["".join(str(int(x)) for x in f) for f in frames]},
        "hop": hop(fid(bt, bg), null, "F between the frame-to-frame transitions it was taught and the ones it played",
                   parent="comet", outcomes="64 frame-to-frame transitions"),
    }


# ================================================================== 16:00 blur-midi-v1 (the readout as a score)
PENTA = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93]
STEP_S, TPB = 0.5, 480          # one measured pattern per half-second beat (120 bpm)
P_BMIDI = {"qubits": 20, "strength": 0.4, "reach": 0.0, "threshold": 0.1}


def midi_notes(path):
    """-> [(start_s, dur_s, pitch, velocity)] from any SMF, honouring the first tempo."""
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
                s = mido.tick2second(t0, mf.ticks_per_beat, tempo)
                out.append((s, mido.tick2second(t - t0, mf.ticks_per_beat, tempo), m.note, v))
    return sorted(out)


def roll(notes, pitches, steps):
    """Velocity in every beat a note sounds (pitch x beat): sustained notes count in each beat they cover."""
    r = np.zeros((len(pitches), steps))
    for st, du, p, v in notes:
        k0, k1 = int(round(st / STEP_S)), max(int(round(st / STEP_S)) + 1, int(round((st + du) / STEP_S)))
        if p in pitches:
            for k in range(max(0, k0), min(steps, k1)):
                r[pitches.index(p), k] += v
    return r


def stage_blurmidi(ctx):
    import mido
    a = ctx["atlas"]
    top = sorted(ctx["graph"]["meas"], key=lambda m: -m["probability"])[:16]
    pmax = top[0]["probability"]
    mf = mido.MidiFile(ticks_per_beat=TPB, type=1)
    t0 = mido.MidiTrack()
    t0.append(mido.MetaMessage("set_tempo", tempo=500000, time=0))
    mf.tracks.append(t0)
    tr = mido.MidiTrack()
    events = []
    notes_in = []
    for k, m in enumerate(top):
        for i, b in enumerate(m["bitstring"][:20]):
            if b == "1":
                v = int(50 + 70 * m["probability"] / pmax)
                events += [(k * TPB, "on", PENTA[i], v), ((k + 1) * TPB - 20, "off", PENTA[i], 0)]
                notes_in.append((k * STEP_S, STEP_S, PENTA[i], v))
    events.sort(key=lambda e: (e[0], e[1] == "on"))
    last = 0
    for t, kind, p, v in events:
        tr.append(mido.Message("note_on" if kind == "on" else "note_off", note=p, velocity=v, time=t - last))
        last = t
    mf.tracks.append(tr)
    src = OUT / "readout_score.mid"
    mf.save(src)
    rec = a.run("blur-midi-v1", P_BMIDI, files={"midi": src}, timeout=1800)
    dst = OUT / "readout_blurred.mid"
    shutil.copyfile(a.outputs(rec)["result"], dst)
    notes_out = midi_notes(dst)
    steps = max(16, int(max([n[0] for n in notes_out] + [0]) / STEP_S) + 1)
    pitches = sorted(set(PENTA) | {n[2] for n in notes_out})
    r_in, r_out = roll(notes_in, pitches, steps), roll(notes_out, pitches, steps)
    ctx["blurmidi"] = {"notes_out": notes_out}
    fmt = lambda ns: [[round(s, 3), round(d, 3), p, v] for s, d, p, v in ns]  # noqa: E731
    return {
        "id": "blurmidi", "clock": "16:00", "engine": "blur-midi-v1", "completed": True,
        "title": "Read the answer as a score",
        "role": "Each atom is a pitch; each measured pattern of the Rydberg run is one beat, louder when that pattern "
                "came up more often. Then the score gets a quantum blur.",
        "analogy": "Atlas treated the piano roll (pitch x time) as a height map and blurred it with up to 20 qubits per "
                   "pass on a statevector simulator, then turned it back into MIDI notes.",
        "where": "Atlas statevector simulator", "backend": "simulator", "qubits": 20,
        "qubits_how": "qubits = 20 per blur pass (param; engine maximum)",
        "job_id": rec["job_id"], "params": P_BMIDI,
        "input": f"{len(notes_in)} notes from the 16 most likely patterns of the recorded 10:00 run", "output": f"{len(notes_out)} notes",
        "data": {"notes_in": fmt(notes_in), "notes_out": fmt(notes_out), "step_s": STEP_S},
        "hop": hop(fid(r_in, r_out), fid_null(r_in, r_out), "F between the piano rolls before and after (velocity in every beat a note sounds, pitch x beat)",
                   parent="graph", outcomes=f"{len(pitches)} pitches x {steps} beats"),
    }


# ================================================================== 18:00 retrocausal-echo-v1 (an echo of the day)
P_RETRO = {"n_sites": 24, "depth": 8, "machine": "aer", "exact": True, "mix": 0.6, "feedback": 0.3, "emit": "audio"}
# On hardware the echo is sampled (no exact mode) through Moth's execution service (Moth's own IBM credentials; the engine's
# `direct` route would need our own IBM token). Same 24-site chain and settings as the exact Aer run, so the two can be
# compared site by site; fractional gates are not available on that route.
ECHO_HW = {"machine": HW, "via": "mothbackend", "exact": False, "shots": 4096, "fractional_gates": False}
P_RETRO_HW = {**P_RETRO, **ECHO_HW}


def retro_run(a, rec, params, src, suffix):
    """-> (run part, the echo's impulse response). Files: out/echo_out{suffix}.wav, echo_ir{suffix}.json, echo_taps{suffix}.json."""
    outs = a.outputs(rec)
    dst = OUT / f"echo_out{suffix}.wav"
    shutil.copyfile(outs["result"], dst)
    shutil.copyfile(outs["ir"], OUT / f"echo_ir{suffix}.json")
    shutil.copyfile(outs["taps"], OUT / f"echo_taps{suffix}.json")
    y, sry = read_wav(dst)
    dry, _ = read_wav(src)
    if sry != SR:
        y = np.interp(np.linspace(0, len(y) - 1, int(len(y) * SR / sry)), np.arange(len(y)), y)
    L = min(len(dry), len(y))
    e_dry, e_wet = band_energy(dry[:L], SR), band_energy(y[:L], SR)
    taps = json.loads((OUT / f"echo_taps{suffix}.json").read_text(encoding="utf-8"))
    hw = params.get("machine") != "aer"
    run = {
        "analogy": "Atlas computed the out-of-time-order echo of a 24-qubit chain "
                   + (f"on IBM hardware ({params['machine']}, sampled)" if hw else "exactly on Aer")
                   + ", then used it as a multi-tap delay on the blurred score (synthesised classically). Each tap is one "
                   "(site, depth) of the echo.",
        "where": f"IBM hardware ({params['machine']})" if hw else "Atlas simulator (Aer, exact)",
        "backend": params["machine"], "qubits": 24,
        "qubits_how": "n_sites = 24 (" + ("the same chain as the exact Aer run" if hw else "the engine's Aer ceiling") + ")",
        "job_id": rec["job_id"], "params": params,
        "input": "the blurred score, synthesised (8 s)", "output": f"echoed audio, {len(y) / SR:.1f} s",
        "media": {"before": "echo_in.wav", "after": f"echo_out{suffix}.wav"},
        "data": {"taps": taps.get("taps") if isinstance(taps, dict) else None, "taps_file": f"echo_taps{suffix}.json"},
        "hop": hop(fid(e_dry, e_wet), fid_null(e_dry, e_wet), "F between the dry and echoed sound (24 log bands x 93 ms frames)",
                   parent="blurmidi", outcomes="bands x frames"),
    }
    return run, json.loads((OUT / f"echo_ir{suffix}.json").read_text(encoding="utf-8"))


def stage_retro(ctx):
    a = ctx["atlas"]
    x = synth(ctx["blurmidi"]["notes_out"], 8.0)          # CLASSICAL synthesis of the blurred score
    src = write_wav(OUT / "echo_in.wav", x)
    rec_run, ir = retro_run(a, a.run("retrocausal-echo-v1", P_RETRO, files={"audio": src}, timeout=3600), P_RETRO, src, "")
    fz = fez_run(ctx, "retro", "retrocausal-echo-v1", P_RETRO_HW, files={"audio": src})
    fz["params"] = P_RETRO_HW
    fez, ir_fez = retro_run(a, fz["rec"], P_RETRO_HW, src, "_fez") if fz["rec"] else (None, None)
    ctx["retro"] = {"ir": ir, "ir_fez": ir_fez}
    base = {"id": "retro", "clock": "18:00", "engine": "retrocausal-echo-v1", "title": "Hear how a kick spreads and returns",
            "role": "An echo test: scramble a chain of spins forward, kick one, run it backwards. Whatever comes back, "
                    "and where, says how far information spread. Here that response becomes a delay effect on the day's score."}
    return assemble(base, rec_run, fez, fz, fed="its exact echo map is the clean reference the recorded 20:00 calibration is "
                    "scored against (a 20:00 ibm_fez run is scored against this stage's ibm_fez echo, same chip)")


# ================================================================== 23:00 blur-core-v1 (a slice of the day's record)
P_BCORE = {"axes": [0, 1, 2, 3], "strength": 0.5, "reach": 0.0, "max_qubits": 19}
BC_SHAPE = (5, 5, 5, 3, 144)   # 375 bitstrings as a nested 5x5x5x3 hierarchy x 144 tweezers: 3+3+3+2+8 = 19 qubits
# NOTE: comet returns counts with no per-shot order (memory_available False) and its keys arrive sorted, so these 375 rows
# are the 375 lexicographically smallest bitstrings, NOT the first 375 shots in time. The page and docs say so.
# Limits found the hard way: a 22-qubit request body was refused (HTTP 413, 1 MB limit); a 21-qubit grid ran but its
# ~6 MB dense result could not be returned (platform payload limit). Dense results of ~1 MB are known to return.


def stage_blurcore(ctx):
    a = ctx["atlas"]
    nt = BC_SHAPE[-1]
    nshot = int(np.prod(BC_SHAPE[:-1]))
    reg = ctx["comet"]["reg"][:nshot, :nt].astype(int)
    grid = reg.reshape(BC_SHAPE)
    params = {**P_BCORE, "values": grid.tolist()}
    body = len(json.dumps({"params": params}))          # what the client will send (default separators)
    if body > 1_048_576:
        raise RuntimeError(f"blur-core payload {body} bytes is over the 1 MB limit")
    rec = a.run("blur-core-v1", params, timeout=3600)
    out = np.array(rec["response"]["result"]["output"], dtype=float).reshape(nshot, nt)
    nq = sum(math.ceil(math.log2(d)) for d in BC_SHAPE)
    raw_site, blur_site = reg.mean(axis=0), out.mean(axis=0)
    full_site = ctx["comet"]["reg"][:, :nt].mean(axis=0)
    zero_lead = int(next((k for k in range(nt) if reg[:, k].any()), nt))      # leading tweezers that read 0 in every row
    for name, g in (("blurcore_raw.png", reg.astype(float)), ("blurcore_blur.png", np.clip(out / max(np.percentile(out, 99), 1e-12), 0, 1))):  # display: contrast to the 99th percentile
        heat = np.repeat(np.repeat(g.T, 3, axis=0), 2, axis=1)            # 144 tweezers x 375 shots, CLASSICAL render
        bg, fg = np.array([251, 250, 249], float), np.array([25, 35, 142], float)     # brand paper -> ink
        rgb = (bg[None, None] * (1 - heat[..., None]) + fg[None, None] * heat[..., None]).round().astype(np.uint8)
        Image.fromarray(rgb, "RGB").save(OUT / name)
    return {
        "id": "blurcore", "clock": "23:00", "engine": "blur-core-v1", "completed": True,
        "title": "Blur a slice of the day's record",
        "role": "A real machine smooths its loading log along time to separate slow changes from shot noise. comet "
                "returns counts per bitstring with no record of which shot came when, so this grid is not a time log: "
                f"it is the first {nshot} bitstrings in the sorted (lexicographic) order of the counts, tweezer by "
                "tweezer, and the blur runs along that sorted axis only.",
        "analogy": f"Atlas amplitude-encoded {nshot} bitstrings x 144 qubits from the recorded IBM load's counts "
                   f"({ctx['comet'].get('backend')}; the first {nshot} keys "
                   "in sorted order), nested as 5 x 5 x 5 x 3 blocks of bitstrings x 144 tweezers, on a Gray-coded "
                   "register, and rotated only the qubits that index the bitstring axis, on a statevector simulator. "
                   f"Because the bitstrings are sorted, the first {zero_lead} tweezers read 0 in all {nshot} of them and "
                   "the next few fill in as a staircase: that comes from the sort, not from drift.",
        "where": "Atlas statevector simulator", "backend": "simulator", "qubits": nq,
        "qubits_how": f"sum of ceil(log2 d) over the grid 5 x 5 x 5 x 3 x 144 = 3+3+3+2+8 = {nq} (engine rule). A 22-qubit "
                      "request was refused (HTTP 413, 1 MB body limit) and a 21-qubit run could not return its ~6 MB result, "
                      "so 19 is the largest grid this record fits.",
        "job_id": rec["job_id"], "params": {**P_BCORE, "values": f"5x5x5x3x144 bits from comet ({body:,} bytes)"},
        "input": f"{nshot} bitstrings x 144 qubits from comet's counts (the first {nshot} in sorted order; no time order)",
        "output": "same grid, blurred along the bitstring (sorted-order) axes only",
        "media": {"before": "blurcore_raw.png", "after": "blurcore_blur.png"},
        "data": {"raw_site": np.round(raw_site, 4).tolist(), "blur_site": np.round(blur_site / max(blur_site.max(), 1e-12), 4).tolist(),
                 "shots": nshot, "zero_lead": zero_lead,
                 "lead_rates": np.round(reg[:, :8].mean(axis=0), 3).tolist(),
                 "full_rates": np.round(full_site[:8], 3).tolist()},
        "hop": hop(fid(reg, out), fid_null(reg, out, n=20), "F between the raw and the blurred grid (every bitstring x every tweezer)",
                   parent="comet", outcomes=f"{nshot * nt:,} bits"),
    }


# ================================================================== 20:00 otoc-echo-v1 (night calibration: echo with the morning's noise)
def echo_series(obj):
    """Find the trajectory's F_re / F_im series (sites x depths) in an otoc-echo envelope, however it is wrapped."""
    stack = [obj]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            if "series" in o and isinstance(o["series"], dict) and "F_re" in o["series"]:
                return np.array(o["series"]["F_re"], float), np.array(o["series"].get("F_im", o["series"]["F_re"]), float) * (
                    1 if "F_im" in o["series"] else 0)
            stack.extend(o.values())
        elif isinstance(o, list):
            stack.extend(o)
    return None, None


def deviation(fre):
    """How much the kick changed each (site, depth): (1 - Re F)/2, zero outside the light cone."""
    return np.clip((1 - fre) / 2, 0, 1)


def otoc_run(rec, params, ir_clean, clean_label, backend):
    res = rec["response"]["result"]
    fre_n, _ = echo_series(res)
    fre_c, _ = echo_series(ir_clean) if ir_clean is not None else (None, None)
    g_noisy = np.nan_to_num(deviation(fre_n))          # a cell the hardware could not normalise (null F) counts as unmoved
    g_clean = np.nan_to_num(deviation(fre_c)) if fre_c is not None else np.zeros_like(g_noisy)
    parent = "retro" if fre_c is not None else None
    F = fid(g_clean, g_noisy) if parent else None
    taps = int((g_noisy > 0.01).sum())
    hw = params.get("machine") != "aer"
    return {
        "analogy": "Atlas computed the out-of-time-order echo of a 24-qubit chain "
                   + (f"on IBM hardware ({params['machine']}, sampled)" if hw else "exactly on Aer")
                   + f", with per-gate angle disorder {params['disorder']} rad (= 1 - S/2sqrt2 from the comet CHSH value).",
        "where": f"IBM hardware ({params['machine']})" if hw else "Atlas simulator (Aer, exact)", "backend": backend, "qubits": 24,
        "qubits_how": "n_sites = 24 (" + ("the same chain as the exact Aer run" if hw else "the engine's Aer ceiling") + ")",
        "job_id": rec["job_id"], "params": params,
        "input": "the 18:00 echo settings + the morning's noise as disorder", "output": f"{taps} (site, depth) cells moved by the kick",
        "data": {"clean": np.round(g_clean, 4).tolist(), "noisy": np.round(g_noisy, 4).tolist(), "disorder": params["disorder"],
                 "clean_label": clean_label},
        "hop": hop(F if F is not None else 0.0, fid_null(g_clean, g_noisy) if parent else None,
                   "F between where the kick spread in the clean echo (" + clean_label + ") and in the disordered one, "
                   "(1 - Re F)/2 per site and depth", parent=parent or "retro", outcomes="24 sites x 8 depths"),
    }


def stage_otoc(ctx):
    a = ctx["atlas"]
    lam = max(0.0, 1 - ctx["comet"]["bell"]["S"] / (2 * math.sqrt(2)))
    params = {"n_sites": 24, "depth": 8, "machine": "aer", "exact": True, "disorder": round(lam, 4), "seed": 6,
              "include_taps": True, "min_tap_level": 0.0}
    params_hw = {**params, **ECHO_HW}
    retro = ctx.get("retro") or {}
    rec_run = otoc_run(a.run("otoc-echo-v1", params, timeout=3600), params, retro.get("ir"), "18:00", "aer")
    fz = fez_run(ctx, "otoc", "otoc-echo-v1", params_hw)
    fz["params"] = params_hw
    fez = None
    if fz["rec"]:          # compare like with like: the 18:00 echo from the same chip when it ran there, else the exact one
        same = retro.get("ir_fez") is not None
        fez = otoc_run(fz["rec"], params_hw, retro.get("ir_fez") if same else retro.get("ir"),
                       f"18:00 on {HW}" if same else "18:00, exact on Aer", HW)
    base = {"id": "otoc", "clock": "20:00", "engine": "otoc-echo-v1",
            "title": "Night calibration: replay the echo with the morning's noise",
            "role": "At night the machine re-runs a known test. Same 24-site echo as at 18:00, but every gate now jitters "
                    f"by an angle set from this morning's hardware Bell test (the recorded load on {ctx['comet'].get('backend')}). "
                    "How much of the echo pattern survives?"}
    return assemble(base, rec_run, fez, fz, fed="the night's last echo; nothing reads it")


# ================================================================== 21:00 qdrive-api-v1 (write tomorrow's target state)
def stage_qdrive(ctx):
    a = ctx["atlas"]
    z = ctx["graph"]["zexp"]
    targets = [{"qubits": [i], "expvals": {"Z": round(float(zi), 3)}} for i, zi in enumerate(z)]
    params = {"n_qubits": 20, "targets": targets, "tomography": 1, "machine": "aer", "seed": 6, "shots": 1024}
    rec = a.run("qdrive-api-v1", params, timeout=600)
    res = rec["response"].get("result") or {}
    outs = a.outputs(rec)
    circ = OUT / "qdrive_circuit.qasm"
    shutil.copyfile(outs["circuit"], circ)
    (OUT / "qdrive_result.json").write_text(json.dumps(res, indent=1)[:2_000_000], encoding="utf-8")
    bloch = circuit_bloch(circ.read_text(encoding="utf-8"), 20)
    got = [float(v[2]) for v in bloch]
    pt = [(1 - zi) / 2 for zi in z]
    pg = [(1 - zi) / 2 for zi in got]
    ctx["qdrive"] = {"circ": circ, "z_target": z, "z_got": got, "bloch": bloch}
    return {
        "id": "qdrive", "clock": "21:00", "engine": "qdrive-api-v1", "completed": True,
        "title": "Write tomorrow's starting state",
        "role": "The control system compiles a circuit that should reproduce today's per-atom excitation odds, so "
                "tomorrow's run can start from them.",
        "analogy": "Atlas's QDrive fitted a 20-qubit circuit to the per-qubit <Z> values from the 10:00 graph state on "
                   "Aer. It returns the circuit; we read its <Z> values off the circuit exactly (classical). The planned "
                   "22:00 tomography check of this circuit timed out, so nothing measured it.",
        "where": "Atlas simulator (Aer)", "backend": "aer", "qubits": 20,
        "qubits_how": "n_qubits = 20 (param)",
        "job_id": rec["job_id"], "params": {**params, "targets": "20 single-qubit <Z> targets"},
        "input": "graph-v1 per-qubit <Z>", "output": f"a 20-qubit QASM3 circuit, {sum(1 for l in circ.read_text(encoding='utf-8').splitlines() if l.startswith('r'))} single-qubit rotations",
        "data": {"z_target": np.round(z, 4).tolist(), "z_got": np.round(got, 4).tolist()},
        "hop": hop(float(np.mean([bern_fid(x, y) for x, y in zip(pt, pg)])), 0.5,
                   "mean per-qubit fidelity between the target and achieved excitation odds", parent="graph", outcomes="20 qubits"),
    }


def circuit_bloch(qasm, n):
    """Exact Bloch vectors of a circuit made only of single-qubit rz/ry/rx gates (QDrive's output here).
    CLASSICAL evaluation of the engine's circuit; refuses anything with multi-qubit gates."""
    import re
    vec = [np.array([0.0, 0.0, 1.0]) for _ in range(n)]
    for line in qasm.splitlines():
        m = re.match(r"\s*(r[xyz])\(([-0-9.eE+]+)\)\s+q\[(\d+)\];", line)
        if not m:
            if re.match(r"\s*(OPENQASM|include|qubit|qreg|bit|creg|//|$)", line):
                continue
            raise ValueError(f"unsupported QASM line: {line}")
        g, t, q = m.group(1), float(m.group(2)), int(m.group(3))
        c, s_ = math.cos(t), math.sin(t)
        x, y, z = vec[q]
        if g == "rz":
            vec[q] = np.array([c * x - s_ * y, s_ * x + c * y, z])
        elif g == "ry":
            vec[q] = np.array([c * x + s_ * z, y, -s_ * x + c * z])
        else:
            vec[q] = np.array([x, c * y - s_ * z, s_ * y + c * z])
    return vec


def qasm3_to_2(qasm):
    out = ["OPENQASM 2.0;", 'include "qelib1.inc";']
    for line in qasm.splitlines():
        if line.startswith(("OPENQASM", "include")):
            continue
        if line.startswith("qubit["):
            out.append(f"qreg q[{line[6:line.index(']')]}];")
            continue
        out.append(line)
    return "\n".join(out) + "\n"


# ================================================================== 22:00 tomography-api-v2 (check tomorrow's state)
def stage_tomo(ctx):
    a = ctx["atlas"]
    qasm2 = qasm3_to_2(ctx["qdrive"]["circ"].read_text(encoding="utf-8"))
    (OUT / "tomo_circuit.qasm").write_text(qasm2, encoding="utf-8")
    pairs = [e for e in ctx["graph"]["edges"]][:8]
    params = {"circuit_qasm": qasm2, "qubit_list": list(range(20)), "qubit_pair_list": pairs, "shots": 2048,
              "provider_name": "aer", "backend_name": "automatic", "single_tomography": True, "double_tomography": True,
              "mutual_information": True, "classical_mutual_information": False}
    rec = a.run("tomography-api-v2", params, timeout=3600)
    res = rec["response"].get("result") or {}
    (OUT / "tomo_result.json").write_text(json.dumps(res, indent=1)[:3_000_000], encoding="utf-8")
    zt = tomo_z(res, 20)
    zq = [float(v[2]) for v in ctx["qdrive"]["bloch"]]
    F = float(np.mean([bern_fid((1 - x) / 2, (1 - y) / 2) for x, y in zip(zq, zt)])) if zt else 0.0
    return {
        "id": "tomo", "clock": "22:00", "engine": "tomography-api-v2", "completed": True,
        "title": "Check tomorrow's state",
        "role": "Before the machine trusts tomorrow's starting state, it measures it: every qubit in X, Y and Z, and a few "
                "neighbouring pairs, to see whether the state is what the compiler promised.",
        "analogy": "Atlas ran single- and two-qubit state tomography of QDrive's 20-qubit circuit on an Aer simulator, "
                   f"{params['shots']} shots per measurement setting.",
        "where": "Atlas simulator (Aer)", "backend": "aer", "qubits": 20,
        "qubits_how": "the circuit's own register: qreg q[20]",
        "job_id": rec["job_id"], "params": {**params, "circuit_qasm": "QDrive's circuit as OpenQASM 2 (out/tomo_circuit.qasm)"},
        "input": "QDrive's 20-qubit circuit", "output": "Bloch vectors per qubit, mutual information on 8 pairs",
        "data": {"z_promised": np.round(zq, 4).tolist(), "z_measured": np.round(zt, 4).tolist() if zt else None,
                 "pairs": pairs, "mi": tomo_mi(res, pairs)},
        "hop": hop(F, 0.5, "mean per-qubit fidelity between the <Z> the circuit promises and the <Z> tomography measured",
                   parent="qdrive", outcomes="20 qubits"),
    }


def tomo_z(res, n):
    """Per-qubit <Z> from the tomography result, whatever its nesting (keys like '0' or 0 with X/Y/Z inside)."""
    found = {}
    stack = [res]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(v, dict) and "Z" in v and isinstance(v["Z"], (int, float)):
                    try:
                        found.setdefault(int(str(k)), float(v["Z"]))
                    except ValueError:
                        pass
                elif isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(o, list):
            stack.extend(o)
    return [found[i] for i in range(n)] if all(i in found for i in range(n)) else None


def tomo_mi(res, pairs):
    out = []
    stack = [res]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            for k, v in o.items():
                if "mutual" in str(k).lower() and isinstance(v, (dict, list)):
                    out.append(v)
                elif isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(o, list):
            stack.extend(o)
    return out[0] if out else None


STAGES = [stage_coin, stage_comet, stage_qrcimage, stage_shader, stage_blur, stage_fryer, stage_tessa, stage_qpixl,
          stage_maze, stage_telablur, stage_graph, stage_tamagotchi, stage_blurmidi, stage_retro,
          stage_otoc, stage_qdrive, stage_tomo, stage_blurcore]

# Labels for stages whose job did not complete (so the page can still place them on the day).
INFO = {
    "fryer": {"clock": "08:00", "engine": "deep-fryer-v1", "title": "Crank the gain too far",
              "role": "A side branch: the camera frame taken with the gain pushed too far.",
              "where": "Atlas statevector simulator", "qubits_how": "would be 16 per 4 x 4 tile"},
    "tessa": {"clock": "08:15", "engine": "tessa-image-v1", "title": "Digitise the frame",
              "analogy": "Planned: Atlas would encode the 64 x 64 camera frame onto qubits and decode it, first on fake_fez "
                         "(IBM Fez's noise model, in the recorded day), then on the real ibm_fez chip (tried twice on "
                         "5 October 2026). On 5 October the same frame, scaled down to 16 x 16 with Pillow, was also sent "
                         "to fake_fez with 1024 shots instead of 4096 (tried twice), to fit the engine's time limit. "
                         "No job completed: the engine did not respond in time, every time.",
              "role": "The camera frame becomes numbers: a quantum encode/measure/decode round trip. A side branch: "
                      "08:30 reads the camera frame directly.",
              "where": "fake_fez, then ibm_fez twice (64 x 64), then fake_fez twice (16 x 16): every attempt failed"},
    "tamagotchi": {"clock": "11:00", "engine": "tamagotchi-v1", "title": "Keep the answer alive", "down": True,
                   "analogy": "Planned: Atlas would write the 20-bit Rydberg answer into 30 Steane logical qubits (210 data "
                              "qubits) and run syndrome rounds on Aer's stabilizer simulator. The engine did not respond.",
                   "role": "Error correction would store each bit of the Rydberg answer in a 7-qubit Steane logical qubit "
                           "and keep checking it, with noise set from this morning's Bell test.",
                   "where": "Atlas stabilizer simulator (Aer)"},
    "otoc": {"clock": "20:00", "engine": "otoc-echo-v1", "title": "Night calibration: replay the echo"},
    "qdrive": {"clock": "21:00", "engine": "qdrive-api-v1", "title": "Write tomorrow's starting state"},
    "tomo": {"clock": "22:00", "engine": "tomography-api-v2", "title": "Check tomorrow's state",
             "role": "Before the machine trusts tomorrow's starting state, it should measure it qubit by qubit. "
                     "This check was planned here, but its job timed out, so nothing was measured.",
             "analogy": "Planned: Atlas would run single- and two-qubit tomography of QDrive's 20-qubit circuit on Aer. "
                        "The job timed out.", "where": "Atlas simulator (Aer)"},
    "blurcore": {"clock": "23:00", "engine": "blur-core-v1", "title": "Blur a slice of the day's record"},
    "retro": {"clock": "18:00", "engine": "retrocausal-echo-v1", "title": "Hear how a kick spreads and returns"},
}
