export const meta = {
  name: 'restore-and-audit',
  description: 'Restore every earlier paragraph and graph into titled sections, then make every control work, wire the shared nav and verify end to end',
  phases: [
    { title: 'Restore', detail: 'earlier text + graphs back, verbatim, under titled sections' },
    { title: 'Audit', detail: 'nav + rebuild + dead controls + e2e journey + data/link consistency' },
    { title: 'Verify', detail: 'independent re-run incl. restoration completeness' },
    { title: 'Fix', detail: 'close remaining gaps, re-verify' },
  ],
}

const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const ASK = `CONTEXT: the user's requests in this session, verbatim, most recent first: (a) "you need to keep the same word content u did as before and graphs that u had in the earlier versions just have those under sections in each project u know"; (b) "make sure everything in every project works and connects and has a function weve done a lot of changes so please make sure everything connects to each other"; (c) "all are equal entries" (no "Main entry"/"Bonus" ranking anywhere). Still in force: every piece interactive with the user in control; the Moth Hack brief-page look; audio and video playable on the page; max qubits; subject-specific sprites with the scene on top; honesty labels. This task is exactly what the user asked for: do it in full for this piece.`
const SLUGS = args.slugs
const portA = i => 6200 + i * 30

const RESTORED = {type:'object', properties:{slug:{type:'string'}, restored_text_blocks:{type:'number'}, restored_graphs:{type:'array', items:{type:'string'}},
  sections:{type:'array', items:{type:'string'}}, conflicts:{type:'array', items:{type:'string'}}, qa_ok:{type:'boolean'}, summary:{type:'string'}},
  required:['slug','restored_text_blocks','restored_graphs','sections','conflicts','qa_ok','summary']}
const OUT = {type:'object', properties:{
  slug:{type:'string'}, nav_ok:{type:'boolean'}, rebuild_in_sync:{type:'boolean'}, qa_ok:{type:'boolean'},
  dead_controls_fixed:{type:'array', items:{type:'string'}}, dead_controls_left:{type:'array', items:{type:'string'}},
  e2e_ok:{type:'boolean'}, e2e_steps:{type:'array', items:{type:'string'}}, data_consistent:{type:'boolean'},
  crosslinks_ok:{type:'boolean'}, issues_left:{type:'array', items:{type:'string'}}, summary:{type:'string'}},
  required:['slug','nav_ok','rebuild_in_sync','qa_ok','dead_controls_fixed','dead_controls_left','e2e_ok','e2e_steps','data_consistent','crosslinks_ok','issues_left','summary']}
const VERDICT = {type:'object', properties:{pass:{type:'boolean'},
  issues:{type:'array', items:{type:'object', properties:{severity:{type:'string', enum:['blocking','minor']}, what:{type:'string'}, fix:{type:'string'}}, required:['severity','what','fix']}},
  checked:{type:'string'}}, required:['pass','issues','checked']}

const restore = (s, i) => `${ASK}
You are restoring content in entries/${s} in ${ROOT} (Moth Hack 2026, "What the Noise Remembers"). Work only in your folder; MOTH_FREEZE=1 for all Python (no Atlas jobs).
The EARLIER version the user wants the words and graphs from is entries/${s}/history/template.pre_sprite.html: the page source before the sprite and realism passes, complete. The CURRENT page is entries/${s}/web/template.html (built by build_web.py). An earlier audit pass may have partly edited the current page: keep its good work.
1. Make a full inventory of the EARLIER version's user-facing content: every heading, paragraph, list item, caption, label, readout text, quiz/glossary entry, table, drawer text and honesty note, and every graph/chart/plot/figure (canvas or SVG drawing code plus its container, legend and caption). Write it to history/inventory.md.
2. Check each item against the CURRENT page. Anything missing, shortened or reworded must come back WITH THE SAME WORDS (verbatim). Exceptions: if a later pass corrected a fact (measured results, honesty fixes, the 'all entries equal' rule), keep the corrected fact and note it under "conflicts". Earlier graphs must come back fully working, wired to the same real data, in the current visual style (paper/ink palette).
3. Organise the restored content under clear, visible, titled SECTIONS below the sprite scene, for example "How to play", "The data" (the graphs, each with its caption), "How it was made", "The science", "What this does not claim" and "Jobs and credits". Collapsible drawers are fine for long text, but every graph must sit in a visible titled section, not ONLY behind a toggle. Keep the sprite scene/game on top, plus all audio/video, controls and existing new content.
4. Remove any "Bonus" wording from the brand bar and page: it should read "Challenge NN" (all entries are equal).
5. Rebuild (python build_web.py), run node common/qa/qa_page.cjs entries/${s} ${portA(i) + 21} until ok, and READ the screenshots. Write history/restore_report.md mapping every inventory item to its place on the current page.
Return the structured result.`

const work = (s, i) => `${ASK}
You are the integration engineer for entries/${s} in ${ROOT} (Moth Hack 2026, "What the Noise Remembers"). Read ${ROOT}\\common\\BUILD_GUIDE.md section 4, ${ROOT}\\common\\SPRITES.md, and this piece's README, piece.json, web/template.html, build_web.py and history/restore_report.md (content was just restored: keep ALL of it). Work only in your folder. Never submit Atlas jobs: run all Python with MOTH_FREEZE=1.
1. CONNECT THE SET: add the shared piece-to-piece navigation. Put the marker <!--NAV--> just before the page's .wtnr-foot footer in web/template.html (if not already there), and in build_web.py do: sys.path.insert(0, str(<project root>/"common")); from nav import nav_html; html = html.replace("<!--NAV-->", nav_html("${s}")) BEFORE the to_ascii step. Check the brand-bar link points to the hub https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa.
2. REBUILD FROM SOURCE: run python build_web.py (MOTH_FREEZE=1) twice and confirm the output is identical (deterministic).
3. EVERY CONTROL HAS A FUNCTION: run node common/qa/deadcontrols.cjs entries/${s} ${portA(i)} from the project root. Fix or remove genuinely dead controls; confirm false positives (an option already selected) by selecting another option first. Re-run until none are genuinely dead. Labels must match what controls do.
4. END-TO-END JOURNEY: write or update qa/e2e.cjs (Playwright: require(String.raw\`${ROOT}\\common\\qa\\node_modules\\playwright\`)) serving web/ locally and walking the main user journey with real assertions: start it, use the main instrument or game to an outcome, play and stop audio (assert sound started), check every restored graph renders (non-empty canvas/SVG), open the sections and drawers, use the share link and reload with the hash to assert the state is restored (if any), and check the prev/next/hub nav links exist. Fix the page until it passes. Use ports ${portA(i) + 10}-${portA(i) + 19}.
5. DATA CONSISTENCY: the numbers on the page (qubits, jobs, backend, job IDs) match piece.json, README and PARAMS.md; job IDs exist in ${ROOT}\\cache\\<engine>\\*.json; every deliverable path in README and piece.json exists; web/files.json lists every referenced file, and unused files are removed from web/ and files.json.
5b. OTHER DELIVERABLES IN SYNC: anything shipped alongside the page (08's app/public, 07's JUCE plugin editor and README, 10's notebook, a CLI, an MP4 or WAV) reflects the current page and theme, or README says plainly what differs.
6. Run node common/qa/qa_page.cjs entries/${s} ${portA(i) + 20} until ok (sound_started true if the piece has audio), READ the screenshots, and run python common/qa/crosslinks.py: no problems for ${s}.
Return the structured result honestly.`

const verify = (s, i, r) => `${ASK}
Independent verifier for entries/${s} in ${ROOT}. Don't submit Atlas jobs (MOTH_FREEZE=1). The engineer reported: ${JSON.stringify(r)}.
A. RESTORATION: compare entries/${s}/history/template.pre_sprite.html (the earlier version) with the current web/template.html, using history/inventory.md and history/restore_report.md as aids but checking yourself. Every earlier paragraph, heading, caption, list item, table and graph must be present with the same words (allowed exceptions: corrected facts listed as conflicts, and the removed 'Bonus' wording), under visible titled sections, with every graph rendering real data.
B. FUNCTION: python build_web.py twice (identical output), node common/qa/deadcontrols.cjs entries/${s} ${portA(i) + 25}, node entries/${s}/qa/e2e.cjs, node common/qa/qa_page.cjs entries/${s} ${portA(i) + 26}, python common/qa/crosslinks.py (lines for ${s}). Read the screenshots. Spot-check job IDs and numbers against piece.json and the cache.
Blocking = any earlier text or graph missing or reworded without a recorded reason, a graph not rendering, a genuinely dead control, e2e failing or trivial, QA not ok, audio broken, nav missing or wrong, data mismatch, or a missing deliverable.`
const fix = (s, i, v) => `${ASK}
Close the remaining gaps in entries/${s} in ${ROOT}. MOTH_FREEZE=1, work only in your folder. The earlier version is history/template.pre_sprite.html. Verifier findings: ${JSON.stringify(v, null, 1)}
Fix every blocking issue (restore missing words and graphs verbatim under sections; fix function, nav and data), re-run the deadcontrols, e2e, qa_page and crosslinks checks (ports ${portA(i)}-${portA(i) + 29}), and return the structured result.`

const out = await pipeline(SLUGS,
  (s, _o, i) => agent(restore(s, i), {label:`restore:${s}`, phase:'Restore', schema: RESTORED}),
  (rr, s, i) => rr ? agent(work(s, i), {label:`audit:${s}`, phase:'Audit', schema: OUT}).then(r => ({rr, r})) : null,
  (x, s, i) => x && x.r ? agent(verify(s, i, x.r), {label:`verify:${s}`, phase:'Verify', schema: VERDICT, effort:'high'}).then(v => ({...x, v})) : x,
  async (x, s, i) => {
    if (!x || !x.r) return {slug:s, ok:false, note:'no restore/audit result'}
    if (x.v && x.v.pass) return {slug:s, ok:true, rr:x.rr, r:x.r}
    const f = await agent(fix(s, i, x.v || {issues:[]}), {label:`fix:${s}`, phase:'Fix', schema: OUT})
    const v2 = f ? await agent(verify(s, i, f), {label:`reverify:${s}`, phase:'Fix', schema: VERDICT, effort:'high'}) : null
    return {slug:s, ok:!!(v2 && v2.pass), rr:x.rr, r:f || x.r, open: v2 ? v2.issues.filter(z=>z.severity==='blocking').map(z=>z.what) : ['no re-verify']}
  })
return out.map(o => o && ({slug:o.slug, ok:o.ok, restored_text:o.rr && o.rr.restored_text_blocks, restored_graphs:o.rr && o.rr.restored_graphs, sections:o.rr && o.rr.sections, e2e:o.r && o.r.e2e_ok, qa:o.r && o.r.qa_ok, open:o.open || (o.r && o.r.issues_left) || []}))
