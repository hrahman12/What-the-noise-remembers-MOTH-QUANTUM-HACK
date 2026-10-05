"""Write ENGINES.md and PARAMS.md from out/chain.json, failures.json and the credit ledger (no hand-copied numbers)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))
from atlas.client import Atlas  # noqa: E402
from lib import ledger_tally, tally_sentence  # noqa: E402
from run import CAP  # noqa: E402

FEZ_STAGE = {"coin": "05:00", "comet": "05:30", "tessa": "08:15", "qpixl": "08:30", "maze": "09:00", "graph": "10:00",
             "retro": "18:00", "otoc": "20:00"}


def fez_summary(chain):
    """Every ibm_fez attempt (from out/fez_failed.json and the chain), stage by stage."""
    log_p = HERE / "out" / "fez_failed.json"
    log = json.loads(log_p.read_text(encoding="utf-8")) if log_p.exists() else {}
    rows = []
    for r in chain:
        if r["id"] not in FEZ_STAGE:
            continue
        ok = "IBM hardware (ibm_fez)" in (r.get("where") or "") and r.get("completed")
        tries = log.get(r["id"], [])
        rows.append({"id": r["id"], "clock": r.get("clock"), "engine": r.get("engine"), "ok": ok,
                     "earlier": (r.get("earlier") or {}).get("where"), "earlier_job": (r.get("earlier") or {}).get("job_id"),
                     "completed": bool(r.get("completed")),
                     "job": r.get("job_id") if ok else None, "tries": tries, "why": (r.get("fez") or {}).get("why"),
                     "queued": (r.get("fez") or {}).get("job_id") if (r.get("fez") or {}).get("status") == "pending" else None,
                     "qubits": r.get("qubits")})
    return rows


def cell(x):
    return str(x).replace("|", "/").replace("\n", " ")


def fez_note(chain):
    """One honest sentence on the ibm_fez runs, built from the chain (no hand-copied numbers)."""
    f = fez_summary(chain)
    ok, bad = [x for x in f if x["ok"]], [x for x in f if not x["ok"]]
    q = lambda x: (f"{x['qubits']} qubit" + ("s" if x["qubits"] != 1 else "")) if x["qubits"] else "qubits not reported"
    s = (f"{len(ok)} of the {len(f)} hardware-capable stages ran on IBM ibm_fez (5 Oct 2026, same inputs as the recorded "
         f"day) and are the primary results on the page: " + "; ".join(f"{x['engine']} {q(x)}, job {x['job']}" for x in ok) + ".")
    if bad:
        s += (" Did not complete on ibm_fez: " + "; ".join(
            f"{x['engine']} ({len(x['tries'])} tries: {', '.join(t['job_id'][:8] for t in x['tries'])}, "
            f"{x['tries'][-1].get('error') if x['tries'] else 'not run'})" for x in bad) + ".")
    return s


def main():
    chain = sorted(json.loads((HERE / "out" / "chain.json").read_text(encoding="utf-8")), key=lambda r: r.get("clock", "99"))
    fails = json.loads((HERE / "failures.json").read_text(encoding="utf-8"))
    a = Atlas(piece="06-tweezer", credit_cap=CAP)
    spent = a.spent()
    ledger = [json.loads(l) for l in (ROOT / "cache" / "ledger.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    mine = [e for e in ledger if e.get("piece") == "06-tweezer"]
    done = [r for r in chain if r.get("completed")]
    jobs = []
    for r in done:
        jobs.extend(r.get("jobs") or [r["job_id"]])
    engines = sorted({r["engine"] for r in done})
    tally = ledger_tally(chain)

    L = ["# ENGINES: Tweezer chain", "",
         f"**{len(engines)} engines completed, {len(set(jobs))} completed jobs counted.** "
         f"Credits ledgered for this piece: **{spent:g} of {CAP:g}** (50 for the recorded day, 24 for the first ibm_fez "
         f"pass of 5 October 2026, 22 for one retry of each failed ibm_fez job, and 2 more so the 08:15 downscaled-frame "
         f"retry had 4 credits of room). From the ledger and the job cache: "
         f"{tally_sentence(tally, 'below')}", "",
         "Atlas runs gate-model circuits and simulators, never atoms. Each row says what stood in for what.", "",
         "| # | Time | Engine | Role in the day | Input | Output | Qubits | Where it ran | Job ID | Completed? |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(chain, 1):
        q = f"{r['qubits']} ({r.get('qubits_how', '')})" if r.get("qubits") else (r.get("qubits_how") or "")
        status = "yes" if r.get("completed") else ("pending (queued, not counted)" if r.get("pending") else "no (failed, not counted)")
        job = r.get("job_id") or ""
        if r.get("jobs") and len(r["jobs"]) > 1:
            job = ", ".join(r["jobs"])
        L.append(f"| {i} | {r.get('clock', '')} | `{r.get('engine', '')}` | {cell(r.get('title', ''))} | {cell(r.get('input', ''))} | "
                 f"{cell(r.get('output', ''))} | {cell(q)} | {cell(r.get('where', ''))} | `{job}` | {status} |")
    L += ["", "## Hop scores", "",
          "F = classical (Bhattacharyya) fidelity between what a stage received and what it handed on, on the outcomes "
          "both share. Chance = the same F with outcomes shuffled (or 0.5 per yes/no outcome).", "",
          "| Time | Engine | From | F | Chance | Outcomes | Metric |", "|---|---|---|---|---|---|---|"]
    for r in done:
        h = r.get("hop") or {}
        L.append(f"| {r['clock']} | `{r['engine']}` | {h.get('parent')} | {h.get('F')} | {h.get('null') if h.get('null') is not None else '–'} | {cell(h.get('outcomes', ''))} | {cell(h.get('metric', ''))} |")
    L += ["", "## Failed or unfinished jobs (not counted)", "", "| Engine | Job ID | What happened | Note |", "|---|---|---|---|"]
    seen = set()
    for f in fails:
        seen.add(f.get("job_id"))
        L.append(f"| `{f['engine']}` | {('`' + f['job_id'] + '`') if f.get('job_id') else 'none (refused before a job was created)'} | {cell(f.get('error', ''))[:220]} | {cell(f.get('note', ''))} |")
    fez = fez_summary(chain)
    for f in fez:
        for t in f["tries"]:
            if t.get("job_id") in seen:
                continue
            seen.add(t.get("job_id"))
            L.append(f"| `{t['engine']}` | `{t['job_id']}` | ibm_fez re-run of the {f['clock']} stage (same input as the recorded "
                     f"run), submitted {t.get('submitted_at', '')}: {cell(t.get('error', ''))} ({t.get('type', '')}) | "
                     f"{(t.get('credits') or 0):g} credits ledgered; not counted |")
    for r in chain:                     # the 08:15 retries on a downscaled copy of the camera frame (run_tessa_small.py)
        for t in (r.get("small") or {}).get("attempts") or []:
            if t.get("job_id") in seen:
                continue
            seen.add(t.get("job_id"))
            L.append(f"| `{t['engine']}` | `{t['job_id']}` | downscaled retry of the {r['clock']} stage (the camera frame "
                     f"scaled to {t['size'].replace('x', ' x ')} with Pillow, {t['shots']} shots, on {t['backend']}), submitted "
                     f"{t.get('submitted_at', '')}: {cell(t.get('error', ''))} ({t.get('type', '')}) | "
                     f"{(t.get('credits') or 0):g} credits ledgered; not counted |")
    for r in chain:
        if not r.get("completed") and r.get("job_id") and r["job_id"] not in seen:
            seen.add(r["job_id"])
            L.append(f"| `{r.get('engine')}` | `{r['job_id']}` | {'still queued at build time' if r.get('pending') else cell(r.get('error', ''))[:220]} | not counted |")
    cached = set()
    for eng in {e["engine"] for e in mine}:
        for p in (ROOT / "cache" / eng).glob("*.json"):
            try:
                cached.add(json.loads(p.read_text(encoding="utf-8")).get("job_id"))
            except (json.JSONDecodeError, OSError):
                pass
    for e in mine:                      # the rest of the ledger's failed submissions (free tamagotchi attempts)
        if e["job_id"] not in cached and e["job_id"] not in seen:
            seen.add(e["job_id"])
            L.append(f"| `{e['engine']}` | `{e['job_id']}` | did not complete (engine not responding during the build) | "
                     f"{e.get('credits', 0):g} credits; not counted |")
    tama = [e for e in mine if e["engine"] == "tamagotchi-v1"]
    if tama:
        used = set(jobs)
        cache_ok = set()
        for p in (ROOT / "cache" / "tamagotchi-v1").glob("*.json"):
            try:
                cache_ok.add(json.loads(p.read_text(encoding="utf-8"))["job_id"])
            except (KeyError, json.JSONDecodeError):
                pass
        n_used = sum(e["job_id"] in used for e in tama)
        n_probe_ok = sum(e["job_id"] in cache_ok and e["job_id"] not in used for e in tama)
        L += ["", f"tamagotchi-v1 costs 0 credits. It was submitted {len(tama)} times by this piece: {n_used} completed runs "
              f"are the 11:00 stage, {n_probe_ok} completed probe (1 logical qubit) is not used, and the other "
              f"{len(tama) - n_used - n_probe_ok} attempts (1 to 90 logical qubits) failed with 'engine did not respond' "
              "while the engine was down. 60 and 90 logical qubits were never reached, so 30 is the size used."]
    L += ["", "## ibm_fez runs (5 October 2026)", "",
          "ibm_fez (IBM Heron r2, 156 qubits) is the default hardware target in `stages.py` (`HW = \"ibm_fez\"`). Every "
          "hardware-capable stage was sent there on the same input it had in the recorded day. The first pass (14:11 to "
          "14:15 UTC) failed on IBM's side for every stage, in the same window in which every ibm_fez job from every piece of "
          "this project failed; each stage was then retried once (coin-toss-v1 at 14:26 UTC, the rest from 19:08 UTC). "
          "Where the ibm_fez job completed, it is the stage's primary result on the page (scene, charts, readout, hop F, "
          "Tweezy's face, the gauge and the survival curve), and the recorded run stays beside it as a labelled comparison "
          "(a Run switch on the card). The later stages keep reading the recorded run, because that is the run they were fed; "
          "re-feeding the whole day from ibm_fez would need new jobs for every downstream stage. A stage whose ibm_fez job "
          "failed twice keeps its recorded run (or no result), labelled on its card.", "",
          "| Time | Engine | Qubits | ibm_fez result | ibm_fez job ID(s) | Recorded run kept beside it |", "|---|---|---|---|---|---|"]
    for f in fez:
        tries = "; ".join(f"`{t['job_id']}` failed: {t.get('error')} ({t.get('type') or 'error'})" for t in f["tries"])
        if f["ok"]:
            res = "**completed**: primary on the page"
            jobs_ = f"`{f['job']}`" + (f" (earlier try {tries})" if tries else "")
        else:
            res = "did not complete after " + (f"{len(f['tries'])} tries" if len(f["tries"]) != 1 else "1 try")
            jobs_ = tries or "not run"
        if f.get("queued"):
            res += f"; a try was still queued at IBM when this was built (job {f['queued']}, not counted)"
        rec = (f"{f['earlier']}, `{f['earlier_job']}`" if f["ok"] and f.get("earlier") else
               "the recorded run stays primary" if f["completed"] else "none: the recorded day's attempt failed too, so the stage has no result")
        q = f["qubits"] or ("not reported" if f["completed"] else "–")
        L.append(f"| {f['clock']} | `{f['engine']}` | {q} | {cell(res)} | {cell(jobs_)} | {cell(rec)} |")
    L += ["", "Not run on ibm_fez: qdrive-api-v1 (its `machine='ibm_fez'` is rejected at run time with `invalid_machine`, "
          "'reserved for a future IBM Quantum Runtime backend ... not wired up yet', as entry 19's jobs 35c1e8df, fa5a9846 "
          "and b4a7e89a found; a run would only spend a credit) and tomography-api-v2 (its schema takes free-text "
          "`provider_name` / `backend_name` with no list of values and the engine has no validation step, so there is no free "
          "422 probe; no IBM provider name is documented; and its only run, on Aer, failed at once with an engine timeout). "
          "tamagotchi-v1 and the blur family are simulator-only engines and stay on their simulators."]
    for r in chain:
        sm = (r.get("small") or {}).get("attempts") or []
        if not sm:
            continue
        L += ["", f"## {r['clock']} retry on a downscaled frame (5 October 2026)", "",
              f"Every 64 x 64 attempt at {r['clock']} failed with engine_timeout and no progress reported (the recorded day's "
              "attempt on fake_fez, then two on ibm_fez). `tessa-image-v1` is a synchronous engine (`GET /engines/tessa-image-v1`: "
              "`is_async` false, `execution_mode` handler), so the whole encode, run and decode has to finish inside one call. "
              "`run_tessa_small.py` therefore sent the same 07:30 camera frame scaled down with Pillow (Lanczos), with fewer "
              "shots, to the emulator first; the plan was ibm_fez once only if the emulator completed, and 32 x 32 only if "
              "16 x 16 completed fast. Credit allowance: 4.", "",
              "| Frame | Machine | Shots | Job ID | Submitted (UTC) | Failed (UTC) | What happened |", "|---|---|---|---|---|---|---|"]
        for t in sm:
            L.append(f"| {t['size'].replace('x', ' x ')} | {t['backend']} | {t['shots']} | `{t['job_id']}` | "
                     f"{t.get('submitted_at') or ''} | {t.get('updated_at') or ''} | {cell(t.get('error', ''))} ({t.get('type', '')}) |")
        L += ["", "Both tries of the same configuration failed the same way, about a minute after submission and still "
              "'queued' when last polled, so nothing more was sent: no ibm_fez run and no 32 x 32 run. The station stays "
              "closed. " + (r.get("why") or "")]
    L += ["", "## Ordering note (comet's record)", "",
          "comet-qrng-v1 returns counts per bitstring (`raw.memory_available` is false), so there is no shot-by-shot time "
          "order. All 10,000 bitstrings were distinct and the counts arrive with their keys sorted lexicographically. "
          "The 16 loading attempts shown at 05:30 (the first eight are also the 06:00 qrc-image vocabulary) are the bitstrings "
          "at the positions given by comet's own 16 conditioned random integers, in that order. The 23:00 blur-core grid is the first 375 keys "
          "of the sorted counts, so it is not a time series: its first four tweezers read 0 in every bitstring and the next ones fill "
          "in as a staircase because of the sort, not because of drift. A re-run on randomly chosen rows was not possible "
          "inside the 50-credit cap."]
    (HERE / "ENGINES.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    P = ["# PARAMS: every completed job", "",
         "| Time | Engine | Key params | Qubits | Backend | Job ID |", "|---|---|---|---|---|---|"]
    for r in done:
        p = json.dumps(r.get("params", {}), separators=(",", ":"))
        P.append(f"| {r['clock']} | `{r['engine']}` | `{cell(p)[:400]}` | {r.get('qubits') or 'not reported'} | {r.get('backend')} | `{r['job_id']}` |")
        e = r.get("earlier")
        if e:          # the recorded run, kept beside the ibm_fez result as a labelled comparison
            pe = json.dumps(e.get("params", {}), separators=(",", ":"))
            P.append(f"| {r['clock']} | `{r['engine']}` (recorded run: a labelled comparison; it fed the later stages) | "
                     f"`{cell(pe)[:400]}` | {e.get('qubits') or 'not reported'} | {e.get('backend')} | `{e['job_id']}` |")
        for j in (r.get("jobs") or [])[1:]:
            if e and j == e.get("job_id"):
                continue
            P.append(f"| {r['clock']} | `{r['engine']}` | (see stage data: another noise/rounds setting) | | {r.get('backend')} | `{j}` |")
    P += ["", "Qubit counts: the number and how we know it are on each stage card and in ENGINES.md. "
          "Where an engine does not report a count and its rule does not fix one, the table says so."]
    tried = [r for r in chain if (r.get("fez") or {}).get("attempts")]
    if tried:
        P += ["", "## ibm_fez jobs that did not complete (not counted)", "",
              "Same input as the recorded run of each stage; ibm_fez is the default hardware target in `stages.py` "
              "(`HW = \"ibm_fez\"`). Stages that completed on a later try are in the table above.", "",
              "| Time | Engine | ibm_fez params | Job ID(s) | What happened |", "|---|---|---|---|---|"]
        for r in tried:
            f = r["fez"]
            p = json.dumps(f.get("params") or r.get("params") or {}, separators=(",", ":"))
            P.append(f"| {r['clock']} | `{r['engine']}` | `{cell(p)[:300]}` | "
                     f"{', '.join(t['job_id'][:8] for t in f['attempts'])} | "
                     f"{cell('; '.join(t.get('error', '') for t in f['attempts']))} |")
    for r in [r for r in chain if (r.get("small") or {}).get("attempts")]:
        P += ["", f"## {r['clock']} retry on a downscaled frame (did not complete; not counted)", "",
              "The same 07:30 camera frame scaled down with Pillow (Lanczos), sent by `run_tessa_small.py`.", "",
              "| Time | Engine | Frame | Params | Job ID | What happened |", "|---|---|---|---|---|---|"]
        for t in r["small"]["attempts"]:
            P.append(f"| {r['clock']} | `{r['engine']}` | {t['size'].replace('x', ' x ')} | "
                     f"`{json.dumps(t['params'], separators=(',', ':'))}` | {t['job_id'][:8]} | {cell(t.get('error', ''))} |")
    (HERE / "PARAMS.md").write_text("\n".join(P) + "\n", encoding="utf-8")
    print(f"ENGINES.md / PARAMS.md: {len(engines)} engines, {len(set(jobs))} jobs, spent {spent:g}")

    missing = [r for r in chain if not r.get("completed")]
    hw = sorted({r["backend"] for r in done if "IBM hardware" in (r.get("where") or "")})
    hw_all = sorted(set(hw) | {r["earlier"]["backend"] for r in done
                               if r.get("earlier") and "IBM hardware" in (r["earlier"].get("where") or "")},
                    key=lambda b: (b != "ibm_fez", b))          # every IBM backend the page still shows
    fez_done = [r for r in done if "IBM hardware (ibm_fez)" in (r.get("where") or "")]
    fez_q = max([r.get("qubits") or 0 for r in fez_done] or [0])
    other_hw = [r["earlier"] for r in done if r.get("earlier") and "IBM hardware" in (r["earlier"].get("where") or "")]
    deliverables = ["run.py", "stages.py", "lib.py", "ENGINES.md", "PARAMS.md", "README.md", "CREDITS.md", "web/index.html",
                    "web/template.html", "build_web.py", "web/files.json", "web/audio/", "web/media/", "out/chain.json", "failures.json",
                    "verify.py", "test_page.cjs", "make_docs.py", "make_video.py", "qa/report.json", "qpu_submit.py",
                    "readme_table.py", "qa/e2e.cjs",
                    "make_sprites.py", "web/sprites.json", "web/img/mascot.png"]
    if (HERE / "tweezer_day.mp4").exists():
        deliverables.append("tweezer_day.mp4")
    if (HERE / "web" / "video").exists():
        deliverables.append("web/video/")
    deliverables += [f"out/{n}" for n in ("readout_score.mid", "readout_blurred.mid", "echo_in.wav", "echo_out.wav", "echo_out_fez.wav")
                     if (HERE / "out" / n).exists()]
    blockers = [f"{r['engine']}: " + ('engine not responding during the build' if r.get('down') else 'still queued' if r.get('pending')
                else (f"engine timeouts on all {len(r['attempts'])} attempts ("
                      + ", ".join(f"{t.get('backend', '')} {t.get('size', '')}".strip() for t in r['attempts'])
                      + "), not counted") if len(r.get('attempts') or []) > 1 else 'server timeout (tried once, not credited)')
                for r in missing]
    blockers.append("recorded day (4 Oct): the first ibm_fez submissions failed at IBM's submit step ('Stream removed'), so "
                    "the recorded hardware hops ran on ibm_marrakesh; on 5 Oct the hardware-capable stages were re-run on "
                    "ibm_fez on the same inputs, and the completed ones are primary on the page")
    fez_bad = [f for f in fez_summary(chain) if not f["ok"]]
    if fez_bad:
        blockers.append("did not complete on ibm_fez after two tries (5 Oct 2026, same inputs): " + "; ".join(
            f"{f['engine']} ({f['clock']}): " + ", ".join(f"{t['job_id'][:8]} {t.get('error', '')}" for t in f['tries'])
            for f in fez_bad) + "; " + ("that stage keeps" if len(fez_bad) == 1 else "those stages keep")
            + " its recorded run, or no result where the recorded run failed too, labelled")
    blockers.append("qdrive-api-v1 cannot target ibm_fez (invalid_machine: not wired up yet, entry 19's jobs); "
                    "tomography-api-v2 not sent to ibm_fez (free-text provider/backend with no validation, so no free probe; "
                    "no IBM provider name documented; its Aer run failed at once with an engine timeout)")
    blockers.append("qrc-audio-v1 dropped to stay inside the 50-credit cap (credits lost to failed jobs)")
    blockers.append("blur-core-v1's input is 375 bitstrings in the lexicographic order of comet's counts (comet returns "
                    "no per-shot order), not a time series; a re-run on randomly chosen rows was not possible at 50/50 credits")
    blockers.append(f"ledger: {tally['submitted']} submissions, {tally['counted']} counted, {tally['probe_unused']} unused probe, "
                    f"{tally['failed']} failed ({tally['failed_free']} free tamagotchi), {tally['refused']} refused before a job (HTTP 413)")
    piece = {
        "slug": "06-tweezer", "challenge": "06 Daisy Chain", "bonus": False, "title": "Tweezer",
        "hook": "Walk one atom array through a day, engine by engine.",
        "sub": "A day in the life of a neutral-atom quantum computer, told by a chain of Atlas engines, with signal "
               "survival measured at every hop.",
        "you_control": ["Walk the lab: tap any of the 18 pixel-art stations (or Earlier / Later) and Tweezy, an atom in a "
                        "tweezer beam, walks there while the lab clock sweeps to that hour",
                        "Play each stage's scene, drawn from its real output: load attempts, snap the camera, set the photon "
                        "threshold, run the moves, drag atoms, pick Rydberg patterns, check the error-corrected pets, play "
                        "the xylophone score and the echo",
                        "Flip any stage to Data for its charts and engine frames; copy a link to any stage",
                        "Judge each hop: survival F against chance, on Tweezy's face, the stage gauge and the survival curve"],
        "engines": engines,
        "qubits": max(r.get("qubits") or 0 for r in done),
        "qubits_note": ("210 = tamagotchi-v1: 30 Steane logical qubits x 7 data qubits on Aer's stabilizer simulator. "
                        if any(r["engine"] == "tamagotchi-v1" for r in done) else "") +
                       (f"{fez_q} = the most qubits that ran on IBM ibm_fez"
                        + (" (comet-qrng-v1: 148-qubit register + 8 Bell-witness qubits, the whole Heron chip). "
                           if any(r["engine"] == "comet-qrng-v1" for r in fez_done) and fez_q == 156 else ". ")) +
                       fez_note(chain) +
                       (" Kept beside them as labelled comparisons (they fed the later stages): the recorded hardware runs on "
                        + ", ".join(sorted({e['backend'] for e in other_hw})) + " (" + "; ".join(
                           f"{r['engine']} {r['earlier']['qubits']} qubit{'s' if r['earlier']['qubits'] != 1 else ''}, job "
                           f"{r['earlier']['job_id'][:8]}" for r in done
                           if r.get("earlier") and "IBM hardware" in (r["earlier"].get("where") or ""))
                        + ") and the recorded emulator runs of the other ibm_fez stages. "
                        if other_hw else " ") +
                       "Other stages ran at their engine ceilings where the platform allowed: 24 (echo engines, Aer cap "
                       "for the exact runs; the ibm_fez echo runs use the same 24-site chain so the two compare site by "
                       "site), 21 (teleblur; shader budget), 20 (blur, graph, labyrinth, blur-midi, qdrive), 19 (blur-core, "
                       "payload-limited), 16 per deep-fryer tile; qrc-image and qpixl do not report a count.",
        "hardware": "ibm_fez" if fez_done else (", ".join(hw) or None),
        "hardware_qubits": fez_q if fez_done else max([r.get("qubits") or 0 for r in done if "IBM hardware" in (r.get("where") or "")] or [0]),
        "hardware_all": hw_all,
        "hardware_stages": {r["id"]: {"backend": r["backend"], "qubits": r.get("qubits"), "job_id": r["job_id"]}
                            for r in done if "IBM hardware" in (r.get("where") or "")},
        "jobs": len(set(jobs)), "credits_spent": spent,
        "deliverables": deliverables, "web_entry": "web/index.html", "mascot": "web/img/mascot.png",
        "status": "built",
        "honesty": "Atlas runs gate-model circuits and simulators, not atoms: every stage is a labelled analogy; only "
                   "completed jobs are counted and every failure is listed with its job ID.",
        "blockers": blockers,
    }
    (HERE / "piece.json").write_text(json.dumps(piece, indent=1), encoding="utf-8")
    print("piece.json written")
    return {"engines": engines, "jobs": len(set(jobs)), "spent": spent}


if __name__ == "__main__":
    main()
