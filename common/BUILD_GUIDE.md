# Build guide: "What the Noise Remembers" (Moth Hack 2026)

Every piece in `entries/` follows this guide. Entry 01 (`entries/01-penrose-hole/`) is the finished
reference build. Read its `web/template.html`, `build_web.py`, `run_blur.py` and `README.md` before you start.

Project root: `C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM` (Git Bash path `/c/Users/Rahma/OneDrive/Desktop/MOTH QUANTUM`).
Hub page (links back from every piece): https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa
Deadline: virtual hack closes 5 Oct 2026 (PT). Ship a working piece over a perfect one.

## 1. Folder you own

Work ONLY inside your own `entries/NN-slug/` folder. Treat these as read-only: `atlas/`, `common/`, `site/`,
`reference/`, other entries. Never delete anything in `cache/`. Don't publish artifacts, deploy, commit,
push, create accounts or send messages: the lead does publishing.

Python 3.12 is installed with numpy, pillow, requests, scipy, matplotlib, imageio-ffmpeg (ffmpeg via
`imageio_ffmpeg.get_ffmpeg_exe()`), mido, nbformat/nbconvert/jupyter/ipywidgets, gwosc, h5py, jax and thrml.
Node 24 and npm are available. gwpy is NOT installed (it fails to build on Windows): use `gwosc` + `h5py`.
If you need another pip package, install it with `pip install --quiet <pkg>` and say so in your README.
Don't use the in-app browser pane: other builders share it. Verify with scripts instead (see section 7).

## 2. Talking to Atlas (the quantum engines)

```python
import sys; sys.path.insert(0, r"C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM")
from atlas.client import Atlas, AtlasError
a = Atlas(piece="NN-slug", credit_cap=<your cap>)   # every new job is ledgered and capped
schema = a.get("/engines/<engine-id>")               # ALWAYS read params_schema + input_files first
rec = a.run("<engine-id>", params, files={"slot": path})   # cached: re-runs are free and offline
paths = a.outputs(rec)                                # {slot: local Path} for file outputs
result = rec["response"]["result"]                    # inline JSON results
```

- Read `params_schema`, `input_files`, `output_files` and `description_md` for every engine you use.
  Never guess parameter names.
- `run()` caches each completed job in `cache/<engine>/<hash>.json`, keyed by (engine, params, inputs).
  Re-running a script costs nothing and works offline. A pending job resumes instead of resubmitting.
- **Credits are real and limited. Atlas exposes no balance.** Your `credit_cap` is a hard per-piece budget,
  and the client refuses new submissions past it. `a.spent()` shows your ledgered spend and
  `a.credits_per_run(engine)` the price. Design runs to fit the cap. If you get 402 or a quota error,
  stop submitting and finish with what you have.
- Test parameter validity cheaply. A 422 "params do not match the engine schema" costs nothing, so probe
  limits that way. A job that fails validation server-side may still be ledgered.
- Real IBM hardware: engines with `mode: "qpu"` (comet-qrng-v1, graph-v1, labyrinth-v1, coin-toss-v1,
  qpixl-v1 which needs `backend_name`) and tessa-image-v1 (`machine`). Confirmed backends: `ibm_fez` and
  `ibm_marrakesh` (Heron, 156 qubits), `ibm_miami` (Nighthawk, 120 qubits). Queues can take minutes, so pass
  `timeout=3600`. Record the backend each result reports (e.g. `result["backend"]`).
- If an engine times out or fails, retry once, then fall back honestly (a smaller size or another engine)
  and document it. **Never fabricate, edit or simulate an engine output and present it as an engine output.**

## 3. Use the most qubits the engine allows (standing user requirement)

Run each engine at its documented ceiling. If that fails (timeout, payload too large), step down one
notch and document why. Known ceilings:

| Engine | Ceiling | How qubits are counted |
|---|---|---|
| blur-v1 / telablur-v1 | 20 (+1 selector for telablur) | region bbox w×h → ceil(log2 w)+ceil(log2 h); needs a region > 512 px per side on a 1024 px image |
| blur-core-v1 | 24 (`max_qubits`) | product of padded grid dims; payload size may force 22 |
| qrc-train-v2 | 12 (`num_qubits`; 13 is rejected) | reservoir qubits |
| graph-v1 | 20 (`num_qubits`, emu and qpu) | graph nodes |
| comet-qrng-v1 | `num_qubits` ≤ 256; emu caps the whole circuit at 20; qpu is bounded by the chip | on ibm_fez: 148 register + 8 Bell-witness = 156 |
| entanglement-shader-v1 | 21-qubit budget shared by `layers` and `incoming_rays` | find the max valid combo by probing |
| tamagotchi-v1 | stabilizer simulator; 30 logical (210 physical) verified, can go higher; 0 credits | 7 physical per Steane logical |
| qpixl-v1 | address qubits = ceil(log2 #values) + data qubits | more values → more qubits |
| tessa-image-v1 | per-pixel groups; on hardware it packs groups across the chip | read its description_md |

State the qubit count each job used, and how you know it (reported by the engine, or computed from the
documented rule), in README, PARAMS.md and on the page.

## 4. The interactive page (every piece must have one)

The standing user requirement: **everything is interactive and dynamic, and the user is always in control.**
Nothing auto-plays. Every animation or sound starts from a user action and can be paused, scrubbed or reset.
The instrument is the hero, not a paragraph.

Build pattern, the same as 01:
- `web/template.html`: page source with a `/*BRAND*/` placeholder at the top of `<style>`, plus data
  placeholders such as `/*DATA*/[]`.
- `build_web.py`: inline `common/brand.css` for `/*BRAND*/` and your job data, then pass the HTML through
  `common/ascii_html.to_ascii()` and write `web/index.html` as ASCII. Convert display images to lossless
  WebP. Put media files under `web/` (e.g. `web/img/`, `web/audio/`) and reference them relatively.
- `web/files.json`: a map of published path → path relative to the project root, for every file the page
  references (the lead publishes with it), e.g. `{"img/a.webp": "entries/NN-slug/web/img/a.webp"}`.

Hard platform rules (the page is published as a claude.ai artifact, under a strict CSP):
- Write no `<!doctype>`, `<html>`, `<head>` or `<body>` tags: start with `<title>`, then the font `<link>`s, then `<style>`.
- External scripts are allowed ONLY from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, unpkg.com (pinned
  exact versions, UMD builds, placed before the inline script). Stylesheets ONLY from Google Fonts.
  **No fetch/XHR to any other host. The page cannot call the Atlas API.** It replays cached real job
  outputs (inline JSON or relative files). Relative `fetch('data.json')` of your own published files works.
- No `alert`/`confirm`/`prompt`, no `<a download>` or script downloads, no iframes, no `window.print`.
  Audio starts only from a click. Copy-to-clipboard needs a try/catch fallback. Shareable state goes in
  `#token` (letters, digits, `.` `_` `~` `-` only).
- Keep the page under ~15 MB in total, and each file under 15 MB.
- It must work at 375 px wide with no horizontal page scroll, be keyboard-usable with visible focus, and
  respect `prefers-reduced-motion`.

Design and marketing. The look follows the **Moth Hack 2026 brief pages**: warm paper `#FBFAF9`, ONE
ultramarine ink `#19238E` for text, rules, buttons and accents, small uppercase IBM Plex Mono labels,
light Geist headings (weight 400, tight tracking), 1 px hairline rules, square panels and pill buttons,
solid-ink section bars, and no glows, gradients or drop shadows. It is a single light theme. `common/brand.css`
implements all of this and imports its own fonts, so `/*BRAND*/` must be the very first thing inside
`<style>`. Use its tokens (`--paper --panel --panel-2 --rule --ink --ink-2 --ink-3 --link --on-ink --tint
--good --warn`, plus `--display --body --mono`) and classes (`.wtnr-bar`, `.ink-bar`, `.proof`, `.seg`, `.btn`,
`.btn.ghost`, `.label`, `details.drawer`, `.honesty`, `.wtnr-foot`). The old dark-kit names (`--night`,
`--wing` ...) still work as aliases, but **no hard-coded dark colours may remain** in page CSS or in
canvas/SVG/three.js drawing code: chrome, overlays, cursors, charts and backgrounds use the paper/ink palette.
Artwork that is an engine output keeps its own colours.
Do NOT use Moth's logo or wordmark, or imply the page is official. Every page ends with
`<p class="wtnr-foot">An independent entry to Moth Hack 2026, built on Moth Quantum's Atlas engines. Not an official Moth Quantum page.</p>`.
- Brand bar: "What the Noise Remembers" linking the hub URL, plus "NN / 11 · <movement>". For bonus
  pieces use "Bonus · Challenge NN".
- Kicker in mono with the challenge, then a **verb-led hook headline** that names what the user does
  ("Tear a hole in a pattern that never repeats."), then a one-sentence sub.
- Proof chips with real, verified numbers (qubits, real jobs, hardware backend). Never inflate them.
- A "You control" step list of 2–4 verbs, then the instrument (canvas, audio, 3D, game).
- Live readouts tied to real data: job ID, params, qubits, backend, simulator or hardware.
- Science in collapsible drawers: why this subject, what the quantum engine did, what this does not claim.
- One delightful, shareable moment, like a "copy link to this view" button.

**Audio must play ON THE PAGE (user requirement).** Every sound a piece produces (WAV deliverables, demos,
MIDI renders, synth output) must be audible in the page itself, from a visible play control the user
clicks. Use Web Audio or `<audio>` elements pointing at files in `web/audio/` (prefer compact
`.mp3`/`.ogg`/`.m4a` made with the bundled ffmpeg, or short `.wav`, all under the size budget). MIDI must be
synthesised in the page (Web Audio) or pre-rendered to audio; a browser can't play `.mid` directly.
Every play control has a matching stop/pause, and nothing sounds before the user clicks.

**Run the page QA** (headless Chromium):
`node common/qa/qa_page.cjs entries/NN-slug <port 5100-5999>`. It reports console errors, failed
requests, disallowed hosts, overflow at 375 px, audio files that fail to decode, autoplay, and whether
clicking the controls actually starts sound (`audio.sound_started`). It writes `qa/report.json` plus
screenshots (`qa/desktop.png`, `qa/mobile.png`, `qa/desktop-after-clicks.png`): LOOK at the screenshots.
`ok` must be true, and for any piece with sound, `sound_started` must be true.

## 5. Honesty (judges are quantum experts, and this is non-negotiable)

- Label every quantum step with where it ran: Atlas simulator, emulator/noise model, or IBM hardware (backend).
  Label every classical step as classical.
- No claims of quantum advantage, translation, "simulating X" when it's an analogy, or certified
  randomness from emulators.
- Data: use only data whose licence you verified from its source page, and record it in CREDITS.md with
  the URL. If you can't verify a licence, use synthetic or generated data and say so.
- Cite real papers only: authors, venue, year. If you can't verify a citation, leave it out.

## 6. Deliverables in your folder

- The brief's own deliverable (PNG + params / WAV / MP4 / notebook / repo / plugin / web app / game), as
  named in your task.
- `web/` interactive page (built `index.html`, `template.html`, `build_web.py`, `files.json`, media).
- `README.md`: pitch, how to use it, engines, parameters and qubits, a quantum-vs-classical table, what it
  claims and doesn't, and how to reproduce it.
- `PARAMS.md`: a table of every completed job (engine, key params, qubits, backend, job_id).
- `CREDITS.md`: data sources with licences and URLs, papers, libraries.
- `piece.json` with keys: slug, challenge, bonus (bool), title, hook, sub, you_control (list), engines (list),
  qubits (number, the max actually used), qubits_note, hardware (backend name or null), jobs (count of
  completed jobs used), credits_spent (from `a.spent()`), deliverables (list of paths), web_entry
  ("web/index.html"), status ("built" | "partial"), honesty (one line), blockers (list).

## 7. Verify before you finish

1. Re-run every script with `MOTH_FREEZE=1` set (the client then refuses any job that isn't cached). It must reproduce the outputs with no new jobs.
2. `python build_web.py`, then check `web/index.html` has zero non-ASCII bytes and that every inline script
   parses: `node -e "const h=require('fs').readFileSync('web/index.html','utf8');for(const s of h.split('<script>').slice(1))new Function(s.split('</script>')[0])"`
   (skip `<script src>` tags).
3. Check every file the page references exists and is listed in `files.json`, and the total size is < 15 MB.
4. Unit-test the page's pure logic with node where possible (state transitions, mapping functions).
5. Grep the page for `fetch(`/`XMLHttpRequest`/`http` to confirm it reaches no disallowed hosts.
6. Run the page QA (section 4) until `ok` is true, and look at the screenshots.
7. Re-read README and the page copy against section 5.
