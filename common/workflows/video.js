export const meta = {
  name: 'challenge-video',
  description: 'Make a narrated demo video (max 3 min) for one challenge: script and voiceover, fresh screen recordings, title cards, assembly, review',
  phases: [
    { title: 'Prepare', detail: 'script + voiceover, and one long screen recording per piece, in parallel' },
    { title: 'Assemble', detail: 'cards, footage, captions, voiceover -> one MP4' },
    { title: 'Review', detail: 'independent check of facts, timing, sound and picture; fix' },
  ],
}
const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const C = args.challenge
const W = `${ROOT}\\submission\\challenge-${C.n}\\video_work`
const OUTMP4 = `${ROOT}\\submission\\challenge-${C.n}\\Challenge${C.n}_demo_video.mp4`
const SITE = 'https://hrahman12.github.io/What-the-noise-remembers-MOTH-QUANTUM-HACK/'
const REPO = 'https://github.com/hrahman12/What-the-noise-remembers-MOTH-QUANTUM-HACK'
const ASK = `CONTEXT: the user is submitting "What the Noise Remembers" (22 playable quantum pieces for Moth Hack 2026, built on Moth Quantum's Atlas engines; one idea: a signal hides, gets lost in noise, and is rebuilt) to the Moth Hack form, one submission per challenge. For Challenge ${C.n} · ${C.name} (pieces: ${C.pieces.join(', ')}) the form REQUIRES a demo video: "Give us a YouTube, Vimeo, or other link ... Even if your project is a single image, a good demo video contains your idea pitch, a description of the techniques used, and showcases the results. If we cannot watch the video, we cannot mark your work. (Maximum, 3 minutes.)" The user asked, verbatim, "wheres the stuff for challenge 1 based on all this?". We make the MP4; the user uploads it to YouTube themselves. Judging: quality of execution, depth of quantum and Atlas usage, originality.
FACTS RULE: every number, name, job id, qubit count and claim must come from entries/<slug>/README.md, piece.json, PARAMS.md, CREDITS.md and ${ROOT}\\cache\\jobs_index.json. Never invent a result. Simulator runs are called simulator runs. Never show the Moth Quantum logo or wordmark. End card: "An independent entry to Moth Hack 2026, built on Moth Quantum's Atlas engines. Not an official Moth Quantum page."
Work only inside ${W} (create it) plus common/demo_recipes/ for new recipe files named video_<slug>.cjs. Do not edit entries/, docs/, site/ or other common/ files. No git. FFmpeg: python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())" (has libx264, aac, drawtext with fontfile=C\\:/Windows/Fonts/...).`

const SCRIPT_T = `${ASK}
TASK: write the narration and generate the voiceover.
1. Read the pieces' README, piece.json, PARAMS.md and web/template.html (to know what the page shows), and reference\\engines.txt for the engine description.
2. Write ${W}\\script.json: {"voice":"...","sections":[{"id","title","narration","on_screen":"what the picture should show (which piece, which interaction or still, which card)","caption":"short on-screen caption, <= 70 chars"}]}. Structure (total spoken length 2:15-2:45, so the video stays under 3:00): (1) hook + idea pitch (~15 s); (2) the challenge and the engine explained simply: what Atlas's engine does to an image, its key parameters and the 20-qubit limit, simulator vs hardware (~30 s); (3) one section per piece, ~30-35 s each: what it is, what you do, what the engine did, one measured result; (4) what ties them together + what it does not claim (~15 s); (5) close: live links and repo (~8 s). Plain, warm, clear English; short sentences; numbers spoken naturally.
3. Voiceover: Windows SAPI via PowerShell (System.Speech.Synthesis.SpeechSynthesizer; voices available: "Microsoft Zira Desktop", "Microsoft David Desktop"; pick the clearer one, Rate 0 or -1), one WAV per section: ${W}\\vo\\<nn>_<id>.wav (SetOutputToWaveFile). Use SSML or the text so numbers and names are pronounced well (e.g. "blur v one", "IBM", "qubits"). Measure each WAV's duration (python wave module) and write them into script.json as "seconds". Re-tighten the text if the total exceeds 165 s.
Return the sections with their seconds and the total.`

const FOOT_T = (s, i) => `${ASK}
TASK: record one long screen recording of the piece ${s} for the video.
The exported static site is at ${ROOT}\\docs (page docs/pieces/${s}/index.html). Look at the existing README clip recipe ${ROOT}\\common\\demo_recipes\\${s}.cjs and ${ROOT}\\common\\demo_recipes\\highlight_${s}.cjs if present, and the piece's web/template.html, to learn its controls. Write ${ROOT}\\common\\demo_recipes\\video_${s}.cjs: 30-40 seconds of a real user playing the piece, showing: the scene and characters, the main interaction (paint/drag/wipe/slide), the engine output vs the original, switching between a few real engine jobs or settings, and the Data view or a measured result. Smooth, unhurried pointer moves; keep the scene filling the 960x600 viewport (scrollIntoView or runtime CSS only; never edit page files); scroll to a key figure briefly if it helps.
Record: cd ${ROOT}\\common\\qa && node record_demo.cjs ${ROOT}\\docs pieces/${s}/index.html ..\\demo_recipes\\video_${s}.cjs ${W}\\footage\\${s} ${7400 + i * 10}
Then check it: extract frames every 5 s with ffmpeg into ${W}\\frames_${s}\\ and read them. It must show motion and real results, no blank or loading frames. Iterate until good. Also note 2-4 timestamps of the best moments.
Return: the mp4 path, its duration, and a list of {t, what} moments.`

const ASSEMBLE_T = (script, foot) => `${ASK}
TASK: assemble the final video ${OUTMP4}.
Inputs: ${W}\\script.json and the WAVs in ${W}\\vo\\ (script agent report: ${JSON.stringify(script).slice(0, 3000)}); footage: ${JSON.stringify(foot)}; stills you may use: each piece's entries/<slug>/hero.png and other figure PNGs named in its README (e.g. sweep.png, jobs.png, ladder.png), docs\\demos\\<slug>.png.
1. Title and section cards, 1920x1080, rendered with Pillow in the project's look: paper #FBFAF9 background, ink #19238E text, ink-2 #545BA9 secondary, accent #B4541A for a small mono eyebrow; fonts from C:\\Windows\\Fonts (e.g. segoeui.ttf / segoeuib.ttf for text, consola.ttf for the mono eyebrow). Cards: opening title ("What the Noise Remembers", "Challenge ${C.n} · ${C.name}"), an engine explainer card (simple diagram: image + mask -> engine (20 qubits, simulator) -> output, drawn with Pillow), one title card per piece, and an end card with ${SITE} and ${REPO} plus the independent-entry line.
2. Timeline: for each script section, its picture runs exactly as long as its voiceover plus ~0.4 s padding: cards, footage segments (trimmed from the best moments), and stills with a slow Ken Burns zoom (zoompan) or plain holds, letterboxed onto 1920x1080 paper background (scale + pad, colour 0xFBFAF9). Upscale the 960x600 footage to fit 1920x1080 (lanczos) on the paper background.
3. Captions: burn each section's caption (and optionally short narration lines) at the bottom in a rounded-feel ink band with paper text (drawbox + drawtext), readable at 1080p.
4. Audio: concatenate the section WAVs with the padding as silence, loudness-normalise (loudnorm), AAC 160k; optionally a very quiet soft pad is NOT needed: voice only is fine.
5. Encode H.264 high, yuv420p, 30 fps, crf 20, +faststart, max 3:00 (must be under 180 s; target 150-175 s). Also write ${W}\\chapters.txt (YouTube chapter list "0:00 Title" per section) and ${W}\\youtube.txt with a suggested YouTube title and description (2-4 sentences + links + chapter list).
Check your own result: ffprobe duration < 180, an audio stream exists, and extract one frame per section to ${W}\\check\\ and read them. Fix anything wrong.
Return: the MP4 path, duration, size, the chapter list, and the youtube.txt text.`

const REVIEW_T = (a) => `${ASK}
TASK: independent review of ${OUTMP4}. Assembly report: ${JSON.stringify(a).slice(0, 3000)}.
Check: duration under 180 s; audio stream present and the voiceover audible throughout (ffmpeg volumedetect / silencedetect over the whole file); picture: extract a frame every 6 s into ${W}\\review\\ and read them all: no blank, black, stretched or loading frames, captions readable and not cut off, the right picture under each section; facts: read script.json and compare every number and claim with the piece files and jobs_index.json; the end card has the links and the independent-entry line; no Moth Quantum logo. If anything is wrong, FIX it yourself (edit script/cards/timeline and re-run the assembly steps in ${W}) and re-check. Return pass=true only if nothing wrong remains.`

const VERDICT = {type:'object', properties:{pass:{type:'boolean'}, fixed:{type:'array', items:{type:'string'}}, remaining:{type:'array', items:{type:'string'}}, duration:{type:'number'}}, required:['pass','fixed','remaining','duration']}
const SCRIPT_OUT = {type:'object', properties:{sections:{type:'array', items:{type:'object', properties:{id:{type:'string'}, seconds:{type:'number'}, caption:{type:'string'}}, required:['id','seconds','caption']}}, total:{type:'number'}, voice:{type:'string'}}, required:['sections','total','voice']}
const FOOT_OUT = {type:'object', properties:{slug:{type:'string'}, mp4:{type:'string'}, seconds:{type:'number'}, moments:{type:'array', items:{type:'object', properties:{t:{type:'number'}, what:{type:'string'}}, required:['t','what']}}}, required:['slug','mp4','seconds','moments']}
const ASM_OUT = {type:'object', properties:{mp4:{type:'string'}, duration:{type:'number'}, mb:{type:'number'}, chapters:{type:'string'}, youtube:{type:'string'}}, required:['mp4','duration','mb','chapters','youtube']}

phase('Prepare')
const prep = await parallel([
  () => agent(SCRIPT_T, {label:`script:${C.n}`, phase:'Prepare', schema: SCRIPT_OUT}),
  ...C.pieces.map((s, i) => () => agent(FOOT_T(s, i), {label:`footage:${s}`, phase:'Prepare', schema: FOOT_OUT})),
])
const script = prep[0]
const foot = prep.slice(1).filter(Boolean)
log(`script ${script ? script.total + ' s' : 'FAILED'}; footage ${foot.length}/${C.pieces.length}`)
phase('Assemble')
const asm = await agent(ASSEMBLE_T(script, foot), {label:`assemble:${C.n}`, phase:'Assemble', schema: ASM_OUT})
phase('Review')
const rev = asm ? await agent(REVIEW_T(asm), {label:`review:${C.n}`, phase:'Review', schema: VERDICT, effort:'high'}) : null
return {challenge: C.n, video: asm, review: rev}
