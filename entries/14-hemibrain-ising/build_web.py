"""Assemble the replay page (web/index.html) and the Node app's page (app/public/index.html).

Both come from web/template.html with the shared brand CSS and every job table inlined. The replay
page has LIVE=false and the live-proxy code stripped out (it makes no network calls). The app page
has LIVE=true and may POST to its own server's /api/sample. Both are written as pure ASCII.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB, APP = HERE / "web", HERE / "app" / "public"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = HERE.parent.parent / "common" / "inksprite.js"
MASCOT = HERE.parent.parent / "common" / "mascot.py"
sys.path.insert(0, str(BRAND.parent))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared piece-to-piece navigation)


def r3(v):
    return [round(x, 3) for x in v]


def station_labels(neurons):
    """Short metro-map station names from the real hemibrain cell types and instance names."""
    def base_of(t):
        b = re.sub(r"\(.*?\)", "", t)
        return b.replace("PEN_a", "PEN-a").replace("PEN_b", "PEN-b").replace("Delta7", "Δ" + "7").replace("_", " ")
    bases = [base_of(n["type"]) for n in neurons]
    toks = []
    for n in neurons:
        typ = re.sub(r"\(.*?\)", "", n["type"])
        rest = re.sub(r"\(.*?\)", "", n["instance"])
        rest = rest[len(typ):] if rest.startswith(typ) else rest
        toks.append([t for t in rest.split("_") if t])
    labels = list(bases)
    for b in set(bases):
        idx = [k for k, x in enumerate(bases) if x == b]
        if len(idx) == 1:
            continue
        group = [toks[k][:] for k in idx]
        while group and all(g and g[-1] == group[0][-1] for g in group) and all(len(g) for g in group):
            for g in group:
                g.pop()          # drop a side letter every member shares
        sfx = [" ".join(g) for g in group]
        for k, sf in zip(idx, sfx):
            labels[k] = b + (" " + sf if sf else "")
        for lab in set(labels[k] for k in idx):
            same = [k for k in idx if labels[k] == lab]
            if len(same) > 1:
                for m, k in enumerate(same, 1):
                    labels[k] = f"{lab}·{m}"
    assert len(set(labels)) == len(labels), labels
    return labels


def main():
    circ = json.loads((HERE / "data" / "circuits.json").read_text(encoding="utf-8"))
    thrml = json.loads((HERE / "out" / "thrml.json").read_text(encoding="utf-8"))
    runs = json.loads((HERE / "out" / "runs.json").read_text(encoding="utf-8"))
    replica = json.loads((HERE / "out" / "replica.json").read_text(encoding="utf-8"))

    for cid, c in thrml["circuits"].items():  # trim precision for the page
        for b in c["betas"].values():
            b["corr"], b["exact_corr"], b["m"] = r3(b["corr"]), r3(b["exact_corr"]), r3(b["m"])
    for rep in replica.values():
        rep["zz"], rep["z"] = r3(rep["zz"]), r3(rep["z"])
    page_runs = [{k: v for k, v in r.items() if k not in ("tomo_zz", "tomo_z")} for r in runs]

    done = [r for r in runs if r.get("status") == "completed"]
    errs = [b["err_mean"] for c in thrml["circuits"].values() for b in c["betas"].values()]
    emax = max(b["err_max"] for c in thrml["circuits"].values() for b in c["betas"].values())
    ncol = {cid: len(c["colours"]) for cid, c in thrml["circuits"].items()}
    def part(r):
        chk = replica.get(r["circuit"], {}).get("runs", {}).get(r["mode"], {})
        where = (f"IBM {r['backend']} hardware" + (f" (IBM job {r['ibm_job_id']})" if r.get("ibm_job_id") else "")
                 if r["mode"] == "qpu" else "the Atlas emulator (Aer)")
        txt = (f"{r['circuit']} on {where}, job {r['job_id']}: {r['num_qubits']} qubits, {r['shots']:,} shots; "
               f"its 20 returned patterns hold {100 * r['top20_mass']:.1f}% of shots, and their frequencies sit "
               f"{chk.get('tvd_top20', float('nan')):.3f} (total variation) from the exact state")
        if r["mode"] == "qpu" and chk:
            txt += (f", which would give those same 20 patterns {100 * chk['top20_mass_replica_same_strings']:.1f}% in total; "
                    f"the two all-aligned patterns took {100 * chk['p_aligned_engine']:.1f}% of hardware shots against "
                    f"{100 * replica[r['circuit']]['p_aligned']:.1f}% exact")
        return txt
    jobs = json.loads((HERE / "out" / "atlas_jobs.json").read_text(encoding="utf-8"))
    # which network and sampler each ledgered job belongs to, from its cache key (run_graph.params is the recipe)
    import run_graph as rg
    key_of = {}
    for c in circ["circuits"]:
        for mode in ("qpu", "emu"):
            key_of[rg._hash({"e": "graph-v1", "p": rg.params(c, mode), "f": {}})] = c["id"]
    key_of["204aa522cf700f8b"] = "compass"   # the two first-round 16,384-shot compass/emu submissions (failed inside Atlas)
    hw = [r for r in done if r["mode"] == "qpu"]
    emu = [r for r in done if r["mode"] == "emu"]
    qfail = [j for j in jobs if j["mode"] == "qpu" and j["status"] == "failed"]
    qwait = [j for j in jobs if j["mode"] == "qpu" and j["status"] not in ("completed", "failed")]
    quantum_text = ""
    if hw:
        quantum_text += "IBM hardware runs (the primary quantum results), all at beta = 0.7: " + "; ".join(part(r) for r in hw) + ". "
    quantum_text += ("Emulator runs, kept as the noiseless baseline with identical parameters, at beta = 0.7: " if hw else
                     "Completed runs, all at beta = 0.7, on the emulator (the noiseless baseline): ") + "; ".join(part(r) for r in emu) + ". "
    if qfail:
        quantum_text += ("Hardware attempts on IBM ibm_fez that returned no counts: "
                         + "; ".join(f"{key_of.get(j['cache_key'], '?')} job {j['job_id']} ended "
                                     f"'{(j.get('error') or {}).get('message', j['status'])}' ({j['submitted_at'][:16].replace('T', ' ')} UTC)"
                                     for j in qfail) + ". ")
    if qwait:
        quantum_text += ("Still waiting in the IBM queue when this page was built (no counts yet): "
                         + "; ".join(f"{key_of.get(j['cache_key'], '?')} job {j['job_id']} (sent {j['submitted_at'][:16].replace('T', ' ')} UTC)"
                                     for j in qwait) + ". ")
    quantum_text += ("Two earlier compass submissions (16,384 shots) failed inside Atlas because its simulator backend was "
                     "unreachable. Failed jobs still count against the budget (25 credits for the first round, 15 more for "
                     "the ibm_fez round), so a network without a run on this page ran out of credits or of working hardware, "
                     "and the Jobs and credits section says which.")
    thrml_text = (f"THRML {thrml.get('thrml', '0.1.4')} (Extropic's block-Gibbs library, on JAX {thrml['jax']}) samples "
                  f"p(s) proportional to exp(beta sum J s s). Spins are split into colour classes ({', '.join(f'{k}: {v}' for k, v in ncol.items())}) "
                  f"so no two coupled spins update at once. Each beta uses {thrml['n_chains']} chains, "
                  f"{thrml['schedule']['n_warmup']} warm-up sweeps and {thrml['schedule']['n_samples']} samples "
                  f"{thrml['schedule']['steps_per_sample']} sweeps apart. With 20 spins we can also enumerate all "
                  f"1,048,576 states exactly. Across all 45 circuit and beta settings, THRML's pair correlations sit "
                  f"within {emax:.3f} of the exact values (mean gap {sum(errs) / len(errs):.4f}). Everything in this "
                  f"sampler is classical.")
    layout = json.loads((HERE / "data" / "metro_layout.json").read_text(encoding="utf-8"))
    for c in circ["circuits"]:
        for n, lab in zip(c["neurons"], station_labels(c["neurons"])):
            n["label"] = lab
    page_layout = {cid: {k: v for k, v in L.items() if k != "stats"} for cid, L in layout["circuits"].items()}
    # the brain plate (anatomy.py): neuropil outlines in micrometres, each circuit's zoom, and every station's home
    # region from the hemibrain ROI table (roi_profile.py); the layout-only fields stay out of the page
    plate = json.loads((HERE / "data" / "brain_plate.json").read_text(encoding="utf-8"))
    keep = ("roi", "base", "side", "pct", "ref", "how", "shape", "top")
    page_plate = {"bbox": plate["bbox"], "hemibrain": plate["hemibrain"], "zoom": plate["zoom"], "bonds": plate["bonds"],
                  "shapes": [{k: s[k] for k in ("id", "lab", "pts", "side", "tone", "det")} for s in plate["shapes"]],
                  "anchors": {cid: [{k: a[k] for k in keep} for a in A] for cid, A in plate["anchors"].items()}}
    # Jobs and credits table: every ledgered Atlas job. The network comes from the job's cache key (above).
    page_jobs = []
    for j in jobs:
        err = j.get("error") or {}
        why = "the Atlas simulator backend was unreachable" if err.get("type") == "unavailable" else err.get("message", "")
        page_jobs.append({"job_id": j["job_id"], "circuit": key_of.get(j["cache_key"]),
                          "mode": j["mode"], "backend": j["backend_name"], "shots": j["shots"], "num_qubits": j["num_qubits"],
                          "credits": j["credits_ledgered"], "status": j["status"], "failed_step": j["failed_step"], "why": why,
                          "at": (j.get("submitted_at") or "")[:16].replace("T", " ")})
    data = {"circuits": circ["circuits"], "layout": page_layout, "plate": page_plate, "thrml": {"betas": thrml["betas"], "circuits": thrml["circuits"]},
            "runs": page_runs, "replica": replica, "jobs": page_jobs,
            "meta": {"quantum_text": quantum_text, "thrml_text": thrml_text, "source_url": circ["source_url"], "cap": rg.CAP}}

    tpl = (WEB / "template.html").read_text(encoding="utf-8")
    assert tpl.count("<!--NAV-->") == 1, "template.html lost its <!--NAV--> marker"
    tpl = tpl.replace("<!--NAV-->", nav_html("14-hemibrain-ising"))   # prev / hub / next + jump list (shared)
    tpl = tpl.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    tpl = tpl.replace("/*DATA*/{}", json.dumps(data, separators=(",", ":")))
    sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
    for v in sprites.values():
        v.pop("about", None)
    tpl = tpl.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    tpl = tpl.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8").replace("<script>", "script element"))  # keep the inline script free of tag text
    replay = re.sub(r"<!--LIVE-START-->.*?<!--LIVE-END-->", "", tpl, flags=re.S)
    replay = re.sub(r"/\*LIVE-START\*/.*?/\*LIVE-END\*/", "", replay, flags=re.S)
    replay = replay.replace("/*LIVE*/false", "false")
    live = tpl.replace("/*LIVE*/false", "true").replace("<!--LIVE-START-->", "").replace("<!--LIVE-END-->", "")
    live = live.replace("/*LIVE-START*/", "").replace("/*LIVE-END*/", "")
    (WEB / "index.html").write_text(to_ascii(replay), encoding="ascii", newline="\n")
    APP.mkdir(parents=True, exist_ok=True)
    (APP / "index.html").write_text(to_ascii(live), encoding="ascii", newline="\n")
    # the hub mascot: frame 0 of the realistic pixel fly (fly_sprite.py), exported with the shared renderer
    subprocess.run([sys.executable, str(MASCOT), str(WEB / "sprites.json"), "fly", str(WEB / "img" / "mascot.png"),
                    "--scale", "2"], check=True)
    files = {"img/mascot.png": "entries/14-hemibrain-ising/web/img/mascot.png"}
    (WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8")
    print(f"web/index.html {len(replay) / 1024:.0f} KB, app/public/index.html written; {len(done)} completed runs")


if __name__ == "__main__":
    main()
