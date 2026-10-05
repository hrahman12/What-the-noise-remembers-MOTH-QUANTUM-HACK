"""Lay every track on a playback timeline and compute the comparison metrics. CLASSICAL.

Reads out/tokens.json (tokenise.py) and out/jobs.json (run_reservoir.py: real qrc-gen-v2 outputs).
Writes out/events.json, used verbatim by both compose_audio.py (the WAV) and build_web.py (the page),
so what you hear on the page is what is in the WAV.

Track event format: [start_s, token_index, lane, coda_index]
  lane: 1-4 = whales 1-4, 5 = any other whale, 0 = the reservoir (no whale identity)
  coda_index >= 0: a real coda, played from its recorded ICIs (stored as integer units of 0.1 ms)
  coda_index = -1: a reservoir token, played from the token prototype (mean normalised rhythm x median length)
Generated codas are spaced by silences drawn (seeded, classical) from the real end-to-start silences,
clipped to [GAP_MIN, SILENCE_CAP].
"""
from __future__ import annotations

import json
import zlib

import numpy as np

from codas import LEAD_IN, OUT, SILENCE_CAP, WHALES, load_tokens, pick_stretch, real_silences, timeline

GAP_MIN = 0.3
HANDOFF_PAUSE = 1.5          # silence between the last real coda and the first reservoir coda
WAV_MAX = 84.0               # the handoff track (= the WAV) stops before this many seconds
BASELINE_DRAWS = 200
LANE = {w: int(w) for w in WHALES}


def gen_tokens(result):
    """Pull the generated token list out of a qrc-gen-v2 inline result."""
    r = result
    if isinstance(r, dict):
        for k in ("output", "sequence", "generated", "tokens", "result"):
            if k in r:
                return gen_tokens(r[k])
    if isinstance(r, list):
        return [str(x) for x in r]
    raise ValueError(f"cannot find generated tokens in result: {str(result)[:300]}")


def stats(seq, nv, pairs, corpus_share):
    c = np.bincount(seq, minlength=nv)
    share = c / max(len(seq), 1)
    rep = sum(a == b for a, b in zip(seq, seq[1:]))
    unseen = sum((a, b) not in pairs for a, b in zip(seq, seq[1:]))
    n1 = max(len(seq) - 1, 1)
    return {"n": len(seq), "tvd": float(0.5 * np.abs(share - corpus_share).sum()), "repeat": rep / n1,
            "unseen": unseen / n1, "distinct": int((c > 0).sum())}


def main():
    d = load_tokens()
    vocab = d["vocab"]
    idx = {v["token"]: i for i, v in enumerate(vocab)}
    codas = d["codas"]
    jobs = json.loads((OUT / "jobs.json").read_text(encoding="utf-8"))
    seq = [idx[c["token"]] for c in codas]
    nv = len(vocab)
    corpus_share = np.bincount(seq, minlength=nv) / len(seq)
    pairs = set(zip(seq, seq[1:]))
    sil = np.clip(np.array(real_silences(codas)), GAP_MIN, SILENCE_CAP)
    proto_len = [sum(v["rhythm"]) * v["dur_median"] if v["rhythm"] else 0.0 for v in vocab]

    def real_track(sub_idx, label):
        sub = [codas[i] for i in sub_idx]
        tl = timeline(sub, lead=LEAD_IN)
        ev = [[t, idx[c["token"]], LANE.get(c["whale"], 5), ci] for (t, c), ci in zip(tl, sub_idx)]
        end = tl[-1][0] + sub[-1]["dur"]
        return {"label": label, "kind": "real", "ev": ev, "dur": round(end + 0.5, 3)}

    def gen_events(toks, start, seed, limit=None):
        rng = np.random.default_rng(seed)
        ev, t = [], start
        for tok in toks:
            if limit is not None and t + proto_len[idx[tok]] > limit:
                break
            ev.append([round(t, 5), idx[tok], 0, -1])
            t += proto_len[idx[tok]] + float(rng.choice(sil))
        return ev

    tracks = {"real_all": real_track(range(len(codas)), "Real dialogue, all whales, in recording order")}
    for w in WHALES:
        tracks[f"real_w{w}"] = real_track([i for i, c in enumerate(codas) if c["whale"] == w], f"Real codas, caller label {w} only (labels are per recording)")

    metrics = [{"label": "Real corpus (3,840 codas)", "quantum": False,
                **stats(seq, nv, pairs, corpus_share)}]
    rng = np.random.default_rng(3617)
    # classical baselines, averaged over many draws of the same length as the reservoir samples
    L = 160
    uni = [stats(list(rng.choice(nv, size=L, p=corpus_share)), nv, pairs, corpus_share) for _ in range(BASELINE_DRAWS)]
    T = np.zeros((nv, nv))
    for a, b in zip(seq, seq[1:]):
        T[a, b] += 1
    T = T / np.maximum(T.sum(1, keepdims=True), 1)
    big = []
    for _ in range(BASELINE_DRAWS):
        s = [int(rng.choice(nv, p=corpus_share))]
        for _ in range(L - 1):
            row = T[s[-1]]
            s.append(int(rng.choice(nv, p=row)) if row.sum() > 0 else int(rng.choice(nv, p=corpus_share)))
        big.append(stats(s, nv, pairs, corpus_share))
    avg = lambda rows, label: {"label": label, "quantum": False, "n": L,
                               **{k: float(np.mean([r[k] for r in rows])) for k in ("tvd", "repeat", "unseen", "distinct")}}
    metrics.append(avg(uni, f"Classical: independent draws at real frequencies (mean of {BASELINE_DRAWS})"))
    metrics.append(avg(big, f"Classical: Markov chain fitted to the corpus (mean of {BASELINE_DRAWS})"))

    variations = []
    gen_seqs = {}
    for key, j in jobs.items():
        if j.get("engine") != "qrc-gen-v2" or "job_id" not in j:
            continue
        toks = gen_tokens(j["result"])
        p = j["params"]
        warm = "the 31 real codas before it" if key == "handoff" else "whole vocabulary (engine default)"
        pstr = f"variation {p['variation']} · length {p['length']} · random_seed {p['random_seed']} · warm-up: {warm}"
        s = stats([idx[t] for t in toks], nv, pairs, corpus_share)
        seed = zlib.crc32(key.encode())          # gap draws: fixed per track, independent of job order
        if key.startswith("var_"):
            v, take = p["variation"], (2 if key.endswith("_s2") else 1)
            if take == 1:
                variations.append(v)
            tkey = f"var_{v:g}" + ("_s2" if take == 2 else "")      # matches the page's String(number)
            tracks[tkey] = {"label": f"Reservoir, variation {v:g}, take {take}", "kind": "gen", "job": key,
                            "params": pstr, "ev": gen_events(toks, LEAD_IN, seed)}
            metrics.append({"label": f"Reservoir, variation {v:g}, take {take}", "quantum": True, "sort": (v, take), **s})
            gen_seqs[tkey] = (v, take, toks)
        elif key == "handoff":
            i, j2 = pick_stretch(codas)
            real = real_track(list(range(i, j2)), "")
            split = real["ev"][-1][0] + codas[j2 - 1]["dur"] + HANDOFF_PAUSE
            gev = gen_events(toks, split, seed, limit=WAV_MAX - 0.6)
            last = gev[-1]
            dur = last[0] + proto_len[last[1]] + 1.2
            tracks["handoff"] = {"label": f"Real → reservoir: {j2 - i} real codas ({codas[i]['rec']}), then the reservoir",
                                 "kind": "mix", "job": key, "params": pstr, "ev": real["ev"] + gev,
                                 "split": round(split, 3), "dur": round(dur, 3), "real_n": j2 - i, "gen_n": len(gev)}
            metrics.append({"label": "Reservoir after the real stretch (handoff, variation 1), all 160 tokens",
                            "quantum": True, "sort": (1e9, 0), **s})
    head, q = metrics[:3], metrics[3:]
    metrics = head + sorted(q, key=lambda m: m.pop("sort"))
    # how each take relates to the other variation levels run with the same random_seed
    for key, (v, take, toks) in gen_seqs.items():
        same, best = [], (0, None)
        for k2, (v2, t2, toks2) in gen_seqs.items():
            if k2 == key or t2 != take:
                continue
            pre = next((i for i, (a, b) in enumerate(zip(toks, toks2)) if a != b), len(toks))
            if pre == len(toks):
                same.append(v2)
            elif pre > best[0]:
                best = (pre, v2)
        fmt = lambda x: f"{x:g}"
        if same:
            note = (f"Identical, coda for coda, to variation {' and '.join(fmt(x) for x in sorted(same))} run with "
                    f"the same seed: between these levels the setting changed nothing.")
        else:
            n = best[0]
            note = (f"Matches variation {fmt(best[1])} (same seed) for its first {n} coda{'s' if n != 1 else ''}, "
                    f"then departs.")
        tracks[key]["note"] = note
        tracks[key]["same_as"] = sorted(same)
    for k, t in tracks.items():
        if "dur" not in t:
            last = t["ev"][-1]
            t["dur"] = round(last[0] + proto_len[last[1]] + 1.0, 3)
    for t in tracks.values():
        for e in t["ev"]:
            e[0] = round(e[0], 4)

    out = {
        "vocab": [{"t": v["token"], "n": v["n"], "r": v["rhythm"], "d": v["dur_median"], "c": v["count"]} for v in vocab],
        "total": len(codas),
        "icis": [[int(round(x * 10000)) for x in c["icis"]] for c in codas],
        "pairs": sorted([list(p) for p in pairs]),
        "tracks": tracks,
        "variations": sorted(variations),
        "metrics": metrics,
        "realStats": {"repeat": metrics[0]["repeat"]},
        "jobs": {k: {"engine": j["engine"], "job_id": j["job_id"]} for k, j in jobs.items() if "job_id" in j},
    }
    (OUT / "events.json").write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"events.json: {len(tracks)} tracks, {len(variations)} variation levels")
    for m in metrics:
        print(f"  {m['label'][:60]:60s} n={m['n']:5}  tvd={m['tvd']:.3f}  rep={m['repeat']:.2f}  unseen={m['unseen']:.3f}  distinct={m['distinct']}")
    if "handoff" in tracks:
        h = tracks["handoff"]
        print(f"  handoff: {h['real_n']} real + {h['gen_n']} reservoir codas, split {h['split']} s, length {h['dur']} s")


if __name__ == "__main__":
    main()
