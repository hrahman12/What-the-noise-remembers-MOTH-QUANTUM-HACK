export const meta = {
  name: 'demo-clips',
  description: 'Record a short demo GIF + MP4 of every piece being played, from the exported static site, and check each clip',
  phases: [
    { title: 'Record', detail: 'one recipe + clip per piece' },
    { title: 'Check', detail: 'review frames; re-record if weak' },
  ],
}
const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const ASK = `CONTEXT: the user asked, verbatim: "i want a demo thing that i can put in one github readme" and then "yeah just give a demo of each of the 22 things". This task makes that demo clip for one piece: do it in full.`
const SLUGS = args.slugs
const port = i => 7200 + i * 10
const OUT = {type:'object', properties:{slug:{type:'string'}, gif_mb:{type:'number'}, mp4_mb:{type:'number'}, seconds:{type:'number'}, shows:{type:'string'}, ok:{type:'boolean'}}, required:['slug','gif_mb','mp4_mb','seconds','shows','ok']}
const VERDICT = {type:'object', properties:{pass:{type:'boolean'}, issues:{type:'array', items:{type:'string'}}}, required:['pass','issues']}

const rec = (s, i) => `${ASK}
Piece: entries/${s} in ${ROOT}. The final static site is exported at ${ROOT}\\docs (the page is docs/pieces/${s}/index.html). DO NOT edit anything under entries/ or docs/pieces: you only write a recipe and record.
1. Read the piece's web/template.html to learn its controls (ids and selectors) and its most delightful interaction.
2. Write ${ROOT}\\common\\demo_recipes\\${s}.cjs: module.exports = async (page, h) => {...}. It performs 6-10 seconds of the piece's best moment, as a real user would: start the game, instrument or animation; drag, paint or play; trigger the characters' reactions; show a key result. Scroll so the sprite scene fills the 960x600 viewport (scrollIntoView on the stage). Use h.wait, h.drag, h.center and h.clickText, or page.* directly. No audio is captured, so favour visual motion.
3. Record: cd ${ROOT}\\common\\qa && node record_demo.cjs ${ROOT}\\docs pieces/${s}/index.html ..\\demo_recipes\\${s}.cjs ${ROOT}\\docs\\demos\\${s} ${port(i)}
4. Look at the result: read docs/demos/${s}.png, and extract 3 more frames with the bundled ffmpeg (python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"), for example -ss 1, 5 and 9 on docs/demos/${s}.mp4 into your scratch area, and read them. The clip must clearly show the piece being used (motion, the characters, a result), not a static or blank page. Iterate on the recipe until it does. Keep the GIF under 3 MB (22 of these go in the repo): if it is bigger, shorten the recipe or lower the frame rate.
Return the structured result.`
const check = (s, i, r) => `${ASK}
Review the demo clip for entries/${s}: ${ROOT}\\docs\\demos\\${s}.gif / .mp4 / .png (the recorder reported ${JSON.stringify(r)}). Extract 4 frames spread across the MP4 with the bundled ffmpeg and read them. Pass only if the clip clearly shows the piece being played (visible motion or change, the subject's characters, a meaningful moment), nothing is broken, blank or stuck on a loading state, and the GIF is under 3 MB.`
const redo = (s, i, v) => `${ASK}
The demo clip for entries/${s} needs another take. Reviewer issues: ${JSON.stringify(v.issues)}. Improve ${ROOT}\\common\\demo_recipes\\${s}.cjs and re-record with: cd ${ROOT}\\common\\qa && node record_demo.cjs ${ROOT}\\docs pieces/${s}/index.html ..\\demo_recipes\\${s}.cjs ${ROOT}\\docs\\demos\\${s} ${port(i) + 5}. Check the frames, and return the structured result.`

const out = await pipeline(SLUGS,
  (s, _o, i) => agent(rec(s, i), {label:`rec:${s}`, phase:'Record', schema: OUT}),
  (r, s, i) => r ? agent(check(s, i, r), {label:`check:${s}`, phase:'Check', schema: VERDICT}).then(v => ({r, v})) : null,
  async (x, s, i) => {
    if (!x) return {slug:s, ok:false}
    if (x.v && x.v.pass) return {slug:s, ok:true, gif:x.r.gif_mb, shows:x.r.shows}
    const r2 = await agent(redo(s, i, x.v), {label:`redo:${s}`, phase:'Check', schema: OUT})
    const v2 = r2 ? await agent(check(s, i, r2), {label:`recheck:${s}`, phase:'Check', schema: VERDICT}) : null
    return {slug:s, ok:!!(v2 && v2.pass), gif:r2 && r2.gif_mb, shows:r2 && r2.shows, issues:v2 && v2.issues}
  })
return out
