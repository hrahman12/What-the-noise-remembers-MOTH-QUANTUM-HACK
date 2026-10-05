"""Assemble web/index.html (the interactive page) and render/render.html (the offline-film page).

Pipeline order: analyze.py -> build_web.py -> node render/measure_views.cjs -> plot.py -> build_web.py.
(The first build only needs render.html for measure_views; the second adds the tilt data to the page.)

Inlines common/brand.css, web/src/core.js, common/inksprite.js (the shared pixel-sprite helper), the engraved
plates (web/data/plates.json, drawn by make_plates.py: the hawkmoth head, facet mosaic, bat, lamp, bat-face meter
and the two labelled plates), the layer-stack pixel props (web/sprites.json, make_sprites.py), the LUTs
(web/data/luts.json, written by analyze.py) and a summary of out/reflectance.json, then writes pure ASCII. The page loads three.js r134 from cdnjs plus two
relative media files (web/video/moth_eye.mp4, the film re-encoded small, and web/img/film-poster.webp,
both made by make_web_media.py after render/render.cjs), listed in web/files.json for publishing.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
BRAND = HERE.parent.parent / "common" / "brand.css"
INKSPRITE = HERE.parent.parent / "common" / "inksprite.js"
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "common"))
from ascii_html import to_ascii  # noqa: E402
from nav import nav_html  # noqa: E402  (shared piece-to-piece navigation: prev / hub / next + jump list)


def meta():
    rep = json.loads((HERE / "out" / "reflectance.json").read_text(encoding="utf-8"))
    res = rep["results"]
    keep = ("tag", "series", "layers", "rays", "interaction", "job_id", "lut_shape", "lut_mean_R", "lut_mean_T",
            "lut_max_R", "lut_R_above_1_frac", "normal_R", "hemi_R", "head_on", "gpu_head_on", "view_avg",
            "slab_overtakes_eye_at_deg")
    rows = [{k: r[k] for k in keep if k in r} for r in res]   # gpu_* / view_* appear after plot.py
    for r in rows:
        r["eye"] = r.get("gpu_head_on", r["head_on"])["eye"]
    sw = sorted([r for r in rows if r["series"] == "sweep"], key=lambda r: r["layers"])
    ctl = {r["layers"]: r for r in rows if r["series"] == "control"}
    a, b = sw[0], sw[-1]
    rises = b["lut_mean_R"] > a["lut_mean_R"]
    verdict = (
        f"{'No' if rises else 'Yes'}. Going from 1 to 6 layers moves the mean of the R table from {a['lut_mean_R']:.3f} "
        f"to {b['lut_mean_R']:.3f}, and it stops changing after about four layers. What dies is transmission "
        f"({a['lut_mean_T']:.3f} to {b['lut_mean_T']:.3f}), so the stack becomes an opaque, slightly shinier mirror. "
    )
    if 1 in ctl and 6 in ctl:
        verdict += (f"With the nonlinear interaction switched off, R is higher still ({ctl[1]['lut_mean_R']:.3f} at 1 layer, "
                    f"{ctl[6]['lut_mean_R']:.3f} at 6), so in this engine the interaction terms hold reflectance down, not "
                    f"the layer count. ")
    g, va = b.get("gpu_head_on"), b.get("view_avg")
    verdict += "" if not va else (f"The nanopillars change where the shine goes, not how much the stack reflects. Head-on at 6 layers the "
                f"pillared facet returns {g['eye']:.3f} against {g['slab']:.3f} for a flat slab, because you see the pillar "
                f"walls near grazing, where the table climbs towards 1. Tilt past about {b['slab_overtakes_eye_at_deg']} degrees "
                f"and the slab turns into a mirror while the pillars stay dimmer. Averaged over every viewing direction, the "
                f"pillared facet returns {va['eye']:.3f} against {va['slab']:.3f} for the slab.")
    verdict_long = ("Adding layers does not kill the shine in this model, and we show that as measured. The geometry helps "
                    "only from the side. Real moth eyes cut reflection at every angle because their bumps are smaller than "
                    "the wavelength, so light never sees the pillar walls as separate mirrors. A shader applied facet by "
                    "facet cannot represent that, so the tilt result is a geometric-optics effect, not a moth-eye mechanism.")
    vpath = HERE / "out" / "view_sweep.json"
    vs = json.loads(vpath.read_text(encoding="utf-8")) if vpath.exists() else {"elevations": [], "runs": {}}
    tilt = {"elevations": vs["elevations"], "runs": {t: [[x["eye"], x["dome"], x["slab"]] for x in r["rows"]] for t, r in vs["runs"].items()}}
    return {"results": rows, "probes": rep["probes"], "verdict": verdict, "verdict_long": verdict_long,
            "params_fixed": rep["params_fixed"], "geometry": rep["geometry"], "tilt": tilt}


def build(template, out_path, extra=None, nav=False):
    html = template.read_text(encoding="utf-8")
    if nav:   # the page only (the offline-film template has no footer)
        assert "<!--NAV-->" in html, "template.html lost its <!--NAV--> marker"
        html = html.replace("<!--NAV-->", nav_html("03-moth-eye"))
    html = html.replace("/*BRAND*/", BRAND.read_text(encoding="utf-8"))
    html = html.replace("/*CORE*/", (WEB / "src" / "core.js").read_text(encoding="utf-8"))
    html = html.replace("/*INKSPRITE*/", INKSPRITE.read_text(encoding="utf-8"))
    if "/*SPRITES*/{}" in html:
        sprites = json.loads((WEB / "sprites.json").read_text(encoding="utf-8"))
        html = html.replace("/*SPRITES*/{}", json.dumps(sprites, separators=(",", ":")))
    if "/*PLATES*/{}" in html:   # the engraved plates (make_plates.py): SVG fragments + anchors
        html = html.replace("/*PLATES*/{}", (WEB / "data" / "plates.json").read_text(encoding="utf-8"))
    html = html.replace("/*LUTS*/{}", (WEB / "data" / "luts.json").read_text(encoding="utf-8"))
    html = html.replace("/*META*/{}", json.dumps(META))
    for k, v in (extra or {}).items():
        html = html.replace(k, v)
    out_path.write_text(to_ascii(html), encoding="ascii")
    print(f"{out_path.relative_to(HERE)} written ({out_path.stat().st_size / 1024:.0f} KB)")


META = meta()

if __name__ == "__main__":
    build(WEB / "template.html", WEB / "index.html", nav=True)
    # files.json: every relative file the page references (published path -> path from the project root)
    media = sorted(f for d in ("video", "img") if (WEB / d).exists() for f in (WEB / d).iterdir() if f.is_file())
    files = {f.relative_to(WEB).as_posix(): f"entries/{HERE.name}/web/{f.relative_to(WEB).as_posix()}" for f in media}
    (WEB / "files.json").write_text(json.dumps(files, indent=1) + "\n", encoding="utf-8")
    total = (WEB / "index.html").stat().st_size + sum(f.stat().st_size for f in media)
    print(f"files.json: {len(files)} files (media + mascot); page total {total / 1e6:.2f} MB")
    rt = HERE / "render" / "render_template.html"
    if rt.exists():
        build(rt, HERE / "render" / "render.html")
