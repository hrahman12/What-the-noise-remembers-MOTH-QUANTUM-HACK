export const meta = {
  name: 'integration-audit',
  description: 'Make every control in every piece work, wire the shared piece-to-piece nav, and verify data, links and replay end to end',
  phases: [
    { title: 'Audit', detail: 'nav + rebuild + dead controls + e2e journey + data/link consistency' },
    { title: 'Verify', detail: 'independent re-run of every check' },
    { title: 'Fix', detail: 'close remaining gaps, re-verify' },
  ],
}

const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const ASK = `CONTEXT: the user's latest request, verbatim: "make sure everything in every project works and connects and has a function weve done a lot of changes so please make sure everything connects to each other". Earlier requests in this session (all still in force): every piece interactive with the user in control; the Moth Hack brief-page look; audio and video playable on the page; max qubits; subject-specific sprites, scene first; real-life art for 03, 07, 08, 10, 12 and 14; 10 as the LIGO Night Shift game; 08 as the SAUNA vs FRIDGE arcade showdown. This audit is exactly what the user asked for: do it in full for this piece.`
const SLUGS = args.slugs
const portA = i => 6200 + i * 30

const OUT = {type:'object', properties:{
  slug:{type:'string'}, nav_ok:{type:'boolean'}, rebuild_in_sync:{type:'boolean'}, qa_ok:{type:'boolean'},
  dead_controls_fixed:{type:'array', items:{type:'string'}}, dead_controls_left:{type:'array', items:{type:'string'}},
  e2e_ok:{type:'boolean'}, e2e_steps:{type:'array', items:{type:'string'}}, data_consistent:{type:'boolean'},
  crosslinks_ok:{type:'boolean'}, issues_left:{type:'array', items:{type:'string'}}, summary:{type:'string'}},
  required:['slug','nav_ok','rebuild_in_sync','qa_ok','dead_controls_fixed','dead_controls_left','e2e_ok','e2e_steps','data_consistent','crosslinks_ok','issues_left','summary']}
const VERDICT = {type:'object', properties:{pass:{type:'boolean'},
  issues:{type:'array', items:{type:'object', properties:{severity:{type:'string', enum:['blocking','minor']}, what:{type:'string'}, fix:{type:'string'}}, required:['severity','what','fix']}},
  checked:{type:'string'}}, required:['pass','issues','checked']}

const work = (s, i) => `${ASK}
You are the integration engineer for entries/${s} in ${ROOT} (Moth Hack 2026, "What the Noise Remembers"). Read ${ROOT}\\common\\BUILD_GUIDE.md section 4, ${ROOT}\\common\\SPRITES.md, and this piece's README, piece.json, web/template.html and build_web.py. Work only in your folder. Never submit Atlas jobs: run all Python with MOTH_FREEZE=1.
1. CONNECT THE SET: add the shared piece-to-piece navigation. Put the marker <!--NAV--> just before the page's .wtnr-foot footer in web/template.html, and in build_web.py do: sys.path.insert(0, str(<project root>/"common")); from nav import nav_html; html = html.replace("<!--NAV-->", nav_html("${s}")) BEFORE the to_ascii step. Check the brand-bar link points to the hub https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa.
2. REBUILD FROM SOURCE: run python build_web.py (MOTH_FREEZE=1). The built web/index.html must come only from template + build (no hand edits lost). Rebuild twice and confirm the output is identical (deterministic).
3. EVERY CONTROL HAS A FUNCTION: run node common/qa/deadcontrols.cjs entries/${s} ${portA(i)} from the project root. For each reported dead control, work out whether it's genuinely dead (fix it so it does something visible and meaningful, or remove it if pointless) or a false positive (for example, an option that was already selected: confirm by selecting another option first). Re-run until no genuinely dead controls remain. Also make sure every link and button label matches what it does.
4. END-TO-END JOURNEY: write qa/e2e.cjs (Playwright, already installed in common/qa/node_modules: require it via require(String.raw\`${ROOT}\\common\\qa\\node_modules\\playwright\`)) that serves web/ locally and walks the piece's main user journey with real assertions: start it, use the main instrument or game to a meaningful outcome, play and stop audio (assert sound started via instrumentation like common/qa/qa_page.cjs does), toggle Scene/Data, open the science drawers, use the share-link feature and reload with the hash to assert the state is restored (if the piece has one), and check the prev/next/hub nav links exist. Fix the page until the e2e passes. Use ports ${portA(i) + 10}-${portA(i) + 19}.
5. DATA CONSISTENCY: the numbers shown on the page (qubits, jobs, backend, job IDs) match piece.json, README and PARAMS.md, and every job ID shown exists in ${ROOT}\\cache\\<engine>\\*.json. Every deliverable path in README and piece.json exists. web/files.json lists every file the page references.
5b. OTHER DELIVERABLES IN SYNC: if this piece ships anything built from or alongside the page (for example 08's standalone web app in app/ with app/public, 07's JUCE plugin editor and README, 10's notebook, a repo CLI, an MP4 or WAV), make sure it reflects the current page and theme: rebuild it if it's generated, otherwise update it or state plainly in README what differs. Remove stale files the page no longer uses from web/ and drop them from web/files.json.
6. Run node common/qa/qa_page.cjs entries/${s} ${portA(i) + 20} until ok (sound_started true if the piece has audio), READ the screenshots, and run python common/qa/crosslinks.py, which must report no problems for ${s}.
Return the structured result honestly.`
const verify = (s, i, r) => `${ASK}
Independent verifier for entries/${s} in ${ROOT}. Don't submit Atlas jobs (MOTH_FREEZE=1). The engineer reported: ${JSON.stringify(r)}.
Re-run everything yourself: python build_web.py (twice; outputs identical), node common/qa/deadcontrols.cjs entries/${s} ${portA(i) + 25}, node entries/${s}/qa/e2e.cjs, node common/qa/qa_page.cjs entries/${s} ${portA(i) + 26}, and python common/qa/crosslinks.py (look only at lines for ${s}). Read the screenshots. Spot-check that job IDs on the page exist in the cache and that numbers match piece.json. Click through the page's main journey mentally against the e2e script: does it really test the core experience? Blocking = a genuinely dead control, e2e failing or trivial, QA not ok, audio broken, nav missing or wrong, data mismatch, or a missing deliverable.`
const fix = (s, i, v) => `${ASK}
Close the remaining gaps in entries/${s} in ${ROOT}. MOTH_FREEZE=1, work only in your folder. Verifier findings: ${JSON.stringify(v, null, 1)}
Fix every blocking issue, re-run the deadcontrols, e2e, qa_page and crosslinks checks (ports ${portA(i)}-${portA(i) + 29}), and return the structured result.`

const out = await pipeline(SLUGS,
  (s, _o, i) => agent(work(s, i), {label:`audit:${s}`, phase:'Audit', schema: OUT}),
  (r, s, i) => r ? agent(verify(s, i, r), {label:`verify:${s}`, phase:'Verify', schema: VERDICT, effort:'high'}).then(v => ({r, v})) : null,
  async (rv, s, i) => {
    if (!rv) return {slug:s, ok:false, note:'no audit result'}
    if (rv.v && rv.v.pass) return {slug:s, ok:true, r:rv.r}
    const f = await agent(fix(s, i, rv.v), {label:`fix:${s}`, phase:'Fix', schema: OUT})
    const v2 = f ? await agent(verify(s, i, f), {label:`reverify:${s}`, phase:'Fix', schema: VERDICT, effort:'high'}) : null
    return {slug:s, ok:!!(v2 && v2.pass), r:f || rv.r, open: v2 ? v2.issues.filter(x=>x.severity==='blocking').map(x=>x.what) : ['no re-verify']}
  })
return out.map(o => o && ({slug:o.slug, ok:o.ok, e2e:o.r && o.r.e2e_ok, qa:o.r && o.r.qa_ok, nav:o.r && o.r.nav_ok, dead_fixed:o.r && o.r.dead_controls_fixed, open:o.open || (o.r && o.r.issues_left) || []}))
