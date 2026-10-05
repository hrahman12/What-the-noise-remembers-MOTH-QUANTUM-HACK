"""Track the real chirps and write them as MIDI. CLASSICAL (numpy/scipy/mido), no quantum step here.

GW150914, measured track: whiten H1 and L1, build a Morlet scalogram, add the two detectors' power
(L1 shifted by the measured inter-site lag), and follow the ridge with a Viterbi path that only lets
the frequency rise (an inspiral chirps upward). Integrate the ridge frequency into a phase and cut it
into half-cycles: one note per half-wave of the real signal, pitch = ridge frequency x4 (two octaves),
loudness = that half-wave's peak whitened strain in each detector. Time is stretched x100.
L1 heard the wave 7.3 ms before H1, so the Livingston voice leads by 0.73 s: a canon set by light travel.

GW170817, model-guided track: the binary neutron star signal is too faint to follow cycle by cycle, so
pitch follows the leading-order (Newtonian) chirp law with GWOSC's catalogue chirp mass. Only the
coalescence time is fitted to the data (grid search maximising power along the track). One note per
16 wave cycles; loudness = the real detector power along that stretch of track, divided by the power
at nearby off-track frequencies. L1 has a known loud glitch ~1.1 s before merger: gated (zeroed with
an inverse Tukey window, -1.10 s to -0.95 s), as in the LIGO analyses.

Outputs: midi/GW150914_chirp.mid, midi/GW170817_chirp.mid, out/<event>.json (tracks, notes, fits),
out/<event>_scalogram.png (background for the page, x = music time, y = MIDI pitch 36..108).
"""
from __future__ import annotations

import json

import mido
import numpy as np
from PIL import Image
from scipy.signal import butter, filtfilt

from chirp_lib import (HERE, LEAD_IN, RESOLUTION, TEMPO_US, TICKS_PER_BEAT, TICKS_PER_S, TRANSPOSE, TSUN,
                       gate, load, meta, midi_of, scalogram, whiten)

OUT = HERE / "out"
MIDI_DIR = HERE / "midi"
IMG_PITCH = (36, 108)          # background image covers these MIDI pitches, 4 px per semitone
IMG_W = 1600


def velocity(a, amax, floor=24):
    return int(np.clip(round(floor + (127 - floor) * (a / amax) ** 0.8), 1, 127))


def velocity_log(r, rmax, floor=24):
    return int(np.clip(round(floor + (127 - floor) * np.log1p(max(r, 0)) / np.log1p(rmax)), 1, 127))


def write_midi(path, title, voices):
    """voices: list of (track name, channel, notes[(start_s, dur_s, pitch, vel)])."""
    mid = mido.MidiFile(type=1, ticks_per_beat=TICKS_PER_BEAT)
    cond = mido.MidiTrack()
    cond.append(mido.MetaMessage("track_name", name=title, time=0))
    cond.append(mido.MetaMessage("set_tempo", tempo=TEMPO_US, time=0))
    cond.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    cond.append(mido.MetaMessage("end_of_track", time=0))
    mid.tracks.append(cond)
    for name, ch, notes in voices:
        tr = mido.MidiTrack()
        tr.append(mido.MetaMessage("track_name", name=name, time=0))
        tr.append(mido.Message("program_change", program=88, channel=ch, time=0))  # GM "Pad 1 (new age)"
        ev = []
        for s, d, p, v in notes:
            a = int(round(s * TICKS_PER_S))
            b = max(a + RESOLUTION, int(round((s + d) * TICKS_PER_S)))
            ev.append((a, 1, p, v))
            ev.append((b, 0, p, 0))
        ev.sort(key=lambda e: (e[0], e[1]))     # note_offs before note_ons at the same tick
        now = 0
        for tick, on, p, v in ev:
            tr.append(mido.Message("note_on" if on else "note_off", note=int(p), velocity=int(v),
                                   channel=ch, time=tick - now))
            now = tick
        tr.append(mido.MetaMessage("end_of_track", time=TICKS_PER_BEAT))
        mid.tracks.append(tr)
    mid.save(path)
    return mid


def background(path, t_music, t_real_of_music, tgrid, freqs, power):
    """Resample a (freq x time) power map onto x = music time, y = MIDI pitch, and save 8-bit PNG."""
    lo, hi = IMG_PITCH
    h = (hi - lo) * 4
    pitches = hi - (np.arange(h) + 0.5) / 4                  # top row = highest pitch
    f_of_pitch = 440 * 2 ** ((pitches - 69) / 12) / TRANSPOSE
    xs = (np.arange(IMG_W) + 0.5) / IMG_W * t_music
    tr = t_real_of_music(xs)
    ti = np.clip(np.searchsorted(tgrid, tr), 0, len(tgrid) - 1)
    lf = np.log(freqs)
    fi = np.interp(np.log(f_of_pitch), lf, np.arange(len(freqs)), left=np.nan, right=np.nan)
    img = np.zeros((h, IMG_W))
    ok = ~np.isnan(fi)
    fi0 = np.clip(np.round(fi[ok]).astype(int), 0, len(freqs) - 1)
    img[ok] = power[fi0][:, ti]
    img[:, np.isnan(tr)] = 0
    v = np.log1p(np.clip(img, 0, None))
    v = np.clip(v / np.percentile(v[v > 0], 99.7), 0, 1) if (v > 0).any() else v
    Image.fromarray((v * 255).astype(np.uint8), "L").save(path)


# ------------------------------------------------------------------------------------- GW150914
def gw150914():
    T0, STRETCH = -0.20, 100.0
    W, BP, P = {}, {}, {}
    freqs = np.geomspace(24, 420, 100)
    for det in ("H1", "L1"):
        t, x, fs = load("GW150914", det, -16, 16)
        w = whiten(x, fs)
        b, a = butter(4, [35 / (fs / 2), 350 / (fs / 2)], btype="band")
        y = filtfilt(b, a, w)
        off = (np.abs(t) > 2) & (np.abs(t) < 12)
        y /= np.std(y[off])
        c = np.abs(scalogram(w, fs, freqs)) ** 2
        c /= np.median(c[:, off], axis=1, keepdims=True) / np.log(2)   # noise power -> mean 1
        W[det], BP[det], P[det] = w, y, c
    # inter-site lag (L1 leads; the sign flips because the two L-shaped detectors are rotated)
    m = (t > -0.1) & (t < 0.05)
    best = max(((float(np.sum(BP["H1"][m] * sg * np.roll(BP["L1"], s)[m])), s, sg)
                for s in range(-45, 46) for sg in (1, -1)))
    lag, sign = best[1], best[2]
    lag_s = lag / fs
    E = P["H1"] + np.roll(P["L1"], lag, axis=1)
    # Viterbi ridge, 1 ms steps, frequency may rise up to 3 bins/step or fall 1 bin
    sel = np.where((t > -0.25) & (t < 0.06))[0][::4]
    S = np.log1p(E[:, sel])
    nf, nt = S.shape
    D = np.full((nf, nt), -np.inf)
    B = np.zeros((nf, nt), int)
    D[:, 0] = S[:, 0]
    for j in range(1, nt):
        for k in range(nf):
            lo, hi = max(0, k - 3), min(nf, k + 2)
            p = lo + int(np.argmax(D[lo:hi, j - 1]))
            D[k, j] = D[p, j - 1] + S[k, j]
            B[k, j] = p
    k = int(np.argmax(D[:, -1]))
    path = [k]
    for j in range(nt - 1, 0, -1):
        k = B[k, j]
        path.append(k)
    path = np.array(path[::-1])
    tr_t, tr_f = t[sel], freqs[path]
    tr_e = E[path, sel]
    jpk = int(np.argmax(tr_e * (tr_t < 0.04)))
    t_peak = float(tr_t[jpk])
    T1 = t_peak + 0.005
    # half-cycles from the ridge phase
    tt = t[(t >= T0) & (t <= T1)]
    ff = np.interp(tt, tr_t, tr_f)
    cyc = np.concatenate([[0], np.cumsum((ff[1:] + ff[:-1]) / 2 * np.diff(tt))])
    nhalf = int(np.floor(cyc[-1] * 2))
    edges = np.interp(np.arange(nhalf + 1) / 2, cyc, tt)
    notes = []
    for i in range(nhalf):
        a_, b_ = edges[i], edges[i + 1]
        mh = (t >= a_) & (t < b_)
        ml = (t >= a_ - lag_s) & (t < b_ - lag_s)
        fmean = float(np.mean(np.interp(t[mh], tr_t, tr_f)))
        notes.append({"i": i, "t_real": round(float(a_), 5), "dur_real": round(float(b_ - a_), 5),
                      "f_hz": round(fmean, 2), "pitch_exact": round(float(midi_of(fmean)), 2),
                      "pitch": int(round(float(midi_of(fmean)))),
                      "amp_H1": round(float(np.max(np.abs(BP["H1"][mh]))), 3),
                      "amp_L1": round(float(np.max(np.abs(BP["L1"][ml]))), 3)})
    amax = max(max(n["amp_H1"], n["amp_L1"]) for n in notes)
    for n in notes:
        n["vel_H1"], n["vel_L1"] = velocity(n["amp_H1"], amax), velocity(n["amp_L1"], amax)
        n["t_music_H1"] = round(LEAD_IN + (n["t_real"] - T0) * STRETCH, 4)
        n["t_music_L1"] = round(n["t_music_H1"] - lag_s * STRETCH, 4)
        n["dur_music"] = round(n["dur_real"] * STRETCH * 0.96, 4)
    # Newtonian chirp-mass check from the ridge: f^(-8/3) falls linearly to zero at coalescence
    fit = (tr_e > 10) & (tr_t < t_peak - 0.004)     # rule fixed in advance: signal-dominated ridge only
    slope, icpt = np.polyfit(tr_t[fit], tr_f[fit] ** (-8 / 3), 1)
    mc_det = (5 / 256 * (-slope) * np.pi ** (-8 / 3)) ** (3 / 5) / TSUN if slope < 0 else None
    # voices; lead-in keeps L1's earlier start positive
    voices = [("H1 Hanford", 0, [(n["t_music_H1"], n["dur_music"], n["pitch"], n["vel_H1"]) for n in notes]),
              ("L1 Livingston", 1, [(n["t_music_L1"], n["dur_music"], n["pitch"], n["vel_L1"]) for n in notes])]
    write_midi(MIDI_DIR / "GW150914_chirp.mid", "GW150914 chirp (GWOSC, CC BY 4.0)", voices)
    t_music_end = max(n["t_music_H1"] + n["dur_music"] for n in notes)
    t_total = t_music_end + 1.0
    background(OUT / "GW150914_scalogram.png", t_total,
               lambda xm: np.where((xm >= 0), T0 + (xm - LEAD_IN) / STRETCH, np.nan), t, freqs, E)
    # strain for the page: H1 and L1 whitened + band-passed, real time window, 4096 Hz -> int8
    win = (t >= T0 - 0.05) & (t <= T1 + 0.03)
    strain = {det: np.clip(np.round(BP[det][win] / 8 * 127), -127, 127).astype(int).tolist() for det in ("H1", "L1")}
    info = {"event": "GW150914", "kind": "measured", "t0_real": T0, "t1_real": round(T1, 4), "stretch": STRETCH,
            "transpose": TRANSPOSE, "lead_in": LEAD_IN, "lag_ms": round(lag_s * 1e3, 2), "lag_sign": sign,
            "t_peak": round(t_peak, 4), "mc_det_newtonian": round(mc_det, 1) if mc_det else None,
            "ridge": [[round(float(a), 4), round(float(b), 1), round(float(c), 1)] for a, b, c in zip(tr_t, tr_f, tr_e)],
            "notes": notes, "t_total": round(t_total, 3),
            "strain": {"fs": int(fs), "t_start": round(float(t[win][0]), 5), "scale_sigma": 8, **strain}}
    (OUT / "GW150914.json").write_text(json.dumps(info), encoding="utf-8")
    print(f"GW150914: lag {lag_s * 1e3:.2f} ms (sign {sign}), peak t={t_peak:+.4f}, {len(notes)} half-cycle notes, "
          f"pitch {min(n['pitch'] for n in notes)}-{max(n['pitch'] for n in notes)}, music {t_total:.1f} s, "
          f"Newtonian Mc(det) ~ {mc_det:.1f} Msun")
    return info


# ------------------------------------------------------------------------------------- GW170817
def gw170817():
    K, NOTE_S, FMAX, T_START = 16, 0.3, 350.0, -15.0
    m = meta()["GW170817"]
    mc = m["chirp_mass_source"] * (1 + m["redshift"]) * TSUN

    def f_of_tau(tau):
        return (1 / (8 * np.pi)) * (5 / tau) ** (3 / 8) * mc ** (-5 / 8)

    def tau_of_f(f):
        return 5 / 256 * (np.pi * f) ** (-8 / 3) * mc ** (-5 / 3)

    def cycles(tau):
        return (8 / 5) * f_of_tau(tau) * tau

    W = {}
    for det in ("H1", "L1"):
        t, x, fs = load("GW170817", det)
        if det == "L1":   # high-pass first so the gate does not cut through the huge sub-15 Hz motion
            bh, ah = butter(8, 15 / (fs / 2), btype="high")
            x = gate(t, filtfilt(bh, ah, x), -1.10, -0.95)
        W[det] = whiten(x, fs)

    def note_powers(w, tc, scale=1.0):
        tau = tc - t
        ok = (tau > tau_of_f(FMAX)) & (t > T_START) & (t < 16)
        N = cycles(np.where(ok, tau, 1.0))
        z = w * np.exp(2j * np.pi * N * scale) * ok
        nid = np.floor(N / K).astype(int)
        out = {}
        for k in np.unique(nid[ok]):
            mm = ok & (nid == k)
            out[int(k)] = (float(np.abs(z[mm].sum()) ** 2 / mm.sum()), float(t[mm][0]), float(t[mm][-1]))
        return out

    grid = np.arange(-0.3, 0.3005, 0.001)
    score = [np.mean([v[0] for v in note_powers(W["H1"], tc).values()]) +
             np.mean([v[0] for v in note_powers(W["L1"], tc).values()]) for tc in grid]
    tc = float(grid[int(np.argmax(score))])
    on = {d: note_powers(W[d], tc) for d in ("H1", "L1")}
    offs = {d: [note_powers(W[d], tc, s) for s in (0.7, 0.8, 1.25, 1.4)] for d in ("H1", "L1")}
    ks = sorted(set(on["H1"]) & set(on["L1"]), reverse=True)   # high cycle count = early
    ks = [k for k in ks if all(k in o for d in ("H1", "L1") for o in offs[d])]
    notes = []
    for i, k in enumerate(ks):
        _, a_, b_ = on["H1"][k]
        tau_mid = tc - (a_ + b_) / 2
        f = float(f_of_tau(tau_mid))
        n = {"i": i, "cycles_left": k * K, "t_real": round(a_, 4), "dur_real": round(b_ - a_, 4), "f_hz": round(f, 2),
             "pitch_exact": round(float(midi_of(f)), 2), "pitch": int(round(float(midi_of(f))))}
        for d in ("H1", "L1"):
            noise = float(np.median([o[k][0] for o in offs[d]]))
            n[f"ratio_{d}"] = round(on[d][k][0] / noise, 3)
        notes.append(n)
    rmax = max(max(n["ratio_H1"], n["ratio_L1"]) for n in notes)
    for n in notes:
        n["vel_H1"] = velocity_log(n["ratio_H1"], rmax)
        n["vel_L1"] = velocity_log(n["ratio_L1"], rmax)
        n["t_music"] = round(LEAD_IN + n["i"] * NOTE_S, 4)
        n["dur_music"] = round(NOTE_S * 0.96, 4)
    voices = [("H1 Hanford", 0, [(n["t_music"], n["dur_music"], n["pitch"], n["vel_H1"]) for n in notes]),
              ("L1 Livingston", 1, [(n["t_music"], n["dur_music"], n["pitch"], n["vel_L1"]) for n in notes])]
    write_midi(MIDI_DIR / "GW170817_chirp.mid", "GW170817 chirp (GWOSC, CC BY 4.0)", voices)
    # control: same statistic on a wrong track (coalescence shifted by +/-2 s) to show the excess is real
    ctrl = []
    for d in ("H1", "L1"):
        for sh in (-2.0, 2.0):
            cp = note_powers(W[d], tc + sh)
            co = [note_powers(W[d], tc + sh, s) for s in (0.7, 1.4)]
            ctrl += [cp[k][0] / np.median([o[k][0] for o in co]) for k in cp if all(k in o for o in co)]
    t_total = notes[-1]["t_music"] + NOTE_S + 1.0
    xs_m = np.array([n["t_music"] for n in notes] + [notes[-1]["t_music"] + NOTE_S])
    xs_r = np.array([n["t_real"] for n in notes] + [notes[-1]["t_real"] + notes[-1]["dur_real"]])
    freqs = np.geomspace(24, 420, 100)
    E = 0
    for d in ("H1", "L1"):
        c = np.abs(scalogram(W[d], fs, freqs, q=12.0)) ** 2
        c /= np.median(c, axis=1, keepdims=True) / np.log(2)
        E = E + c
    background(OUT / "GW170817_scalogram.png", t_total,
               lambda xm: np.where((xm >= xs_m[0]) & (xm <= xs_m[-1]), np.interp(xm, xs_m, xs_r), np.nan), t, freqs, E)
    info = {"event": "GW170817", "kind": "model-guided", "cycles_per_note": K, "note_s": NOTE_S, "transpose": TRANSPOSE,
            "lead_in": LEAD_IN, "mc_det": round(mc / TSUN, 4), "mc_source": m["chirp_mass_source"], "redshift": m["redshift"],
            "tc_fit": round(tc, 4), "mc_fit_window": "ridge power > 10", "fmax": FMAX, "gate_L1": [-1.10, -0.95],
            "mean_ratio_on": round(float(np.mean([n[f"ratio_{d}"] for n in notes for d in ("H1", "L1")])), 2),
            "mean_ratio_control": round(float(np.mean(ctrl)), 2), "n_control": len(ctrl),
            "notes": notes, "t_total": round(t_total, 3)}
    (OUT / "GW170817.json").write_text(json.dumps(info), encoding="utf-8")
    print(f"GW170817: tc fit {tc:+.3f} s, {len(notes)} notes ({K} cycles each), f {notes[0]['f_hz']:.1f}-"
          f"{notes[-1]['f_hz']:.1f} Hz, pitch {notes[0]['pitch']}-{notes[-1]['pitch']}, along-track power "
          f"{info['mean_ratio_on']}x off-track vs control {info['mean_ratio_control']}x, music {t_total:.1f} s")
    return info


def roll_qubits(path):
    """Estimate blur-midi-v1's roll size per track: steps = last tick / RESOLUTION, rows = span padded by 15%."""
    mid = mido.MidiFile(path)
    res = []
    for tr in mid.tracks:
        now, ps, last = 0, [], 0
        for msg in tr:
            now += msg.time
            if msg.type == "note_on" and msg.velocity > 0:
                ps.append(msg.note)
            if msg.type in ("note_on", "note_off"):
                last = now
        if ps:
            span = max(ps) - min(ps) + 1
            rows = span + 2 * int(np.ceil(0.15 * span))
            steps = int(np.ceil(last / RESOLUTION))
            res.append({"track": tr.name, "span": span, "rows": rows, "steps": steps,
                        "qubits": int(np.ceil(np.log2(rows)) + np.ceil(np.log2(steps)))})
    return res


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    MIDI_DIR.mkdir(exist_ok=True)
    gw150914()
    gw170817()
    for ev in ("GW150914", "GW170817"):
        print(ev, roll_qubits(MIDI_DIR / f"{ev}_chirp.mid"))
