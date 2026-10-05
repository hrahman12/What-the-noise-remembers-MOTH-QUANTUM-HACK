export const meta = {
  name: 'ibm-fez-pass',
  description: 'Re-run every hardware-capable quantum step of a piece on real IBM ibm_fez, wire the results in, and re-verify',
  phases: [
    { title: 'Fez', detail: 'submit ibm_fez jobs, update code, data, page and docs' },
    { title: 'Verify', detail: 'jobs really ran on ibm_fez; page, QA and e2e still pass' },
    { title: 'Fix', detail: 'close gaps, re-verify' },
  ],
}
const ROOT = 'C:\\Users\\Rahma\\OneDrive\\Desktop\\MOTH QUANTUM'
const ASK = `CONTEXT: the user's request, verbatim: "wait wait also you didn't run everything on ibm_fez u needed to do that (for the projects that require it) redo and update code as necassary". Earlier requests still in force: everything interactive with the user in control; the Moth Hack look; all earlier words and graphs kept under titled sections; every control working; prev/next nav; max qubits; honesty labels. This task is exactly what the user asked for: do it in full for this piece.`
const BRIEF = args.briefs || {}
const OUT = {type:'object', properties:{slug:{type:'string'}, fez_jobs:{type:'array', items:{type:'object', properties:{engine:{type:'string'}, job_id:{type:'string'}, backend_reported:{type:'string'}, qubits:{type:'number'}, role:{type:'string'}}, required:['engine','job_id','backend_reported','qubits','role']}},
  not_possible:{type:'array', items:{type:'string'}}, credits_spent_now:{type:'number'}, qa_ok:{type:'boolean'}, e2e_ok:{type:'boolean'}, summary:{type:'string'}},
  required:['slug','fez_jobs','not_possible','credits_spent_now','qa_ok','e2e_ok','summary']}
const VERDICT = {type:'object', properties:{pass:{type:'boolean'}, issues:{type:'array', items:{type:'object', properties:{severity:{type:'string', enum:['blocking','minor']}, what:{type:'string'}, fix:{type:'string'}}, required:['severity','what','fix']}}}, required:['pass','issues']}
const port = i => 6800 + i * 30

const work = (s, i) => `${ASK}
Piece: entries/${s} in ${ROOT}. Read ${ROOT}\\common\\BUILD_GUIDE.md (sections 2-5) and this piece's README, PARAMS.md, piece.json, run scripts and web/template.html.
Specific notes for this piece: ${BRIEF[s] || 'Re-run every quantum step whose engine can target IBM hardware on ibm_fez.'}
1. List every quantum step in this piece whose engine can run on IBM hardware: coin-toss-v1, comet-qrng-v1, graph-v1 and labyrinth-v1 via mode="qpu" + backend_name="ibm_fez"; qpixl-v1 via mode="qpu" + backend_name="ibm_fez"; tessa-image-v1 via machine="ibm_fez"; otoc-echo-v1 and retrocausal-echo-v1 via machine="ibm_fez"; qdrive-api-v1 and tomography-api-v2: probe whether ibm_fez is accepted (a 422 schema rejection is free). Read each engine's params_schema with a.get("/engines/<id>") first.
2. Run each of those steps on ibm_fez at the most qubits the engine and the 156-qubit chip allow (comet: 148 + 8 Bell; graph: 20; labyrinth: up to the chip; and so on). Use Atlas(piece="${s}", credit_cap=<current a.spent() + this piece's allowance below>) and timeout=3600 (hardware queues). Check the backend each result reports is ibm_fez. If ibm_fez rejects a job or times out twice, record it under not_possible and keep the previous run, honestly labelled.
   Credit allowance for this piece: ${(args.allowance || {})[s] || 15} credits.
3. UPDATE THE CODE: make ibm_fez the default hardware target in the run scripts (no more ibm_marrakesh/ibm_miami/emu as the default for these steps). Keep emulator runs ONLY where they're a deliberate, labelled comparison or baseline.
4. Wire the ibm_fez outputs into the page as the primary results (labels say "IBM ibm_fez, N qubits, job <id>"), update piece.json (hardware "ibm_fez", "hardware_qubits": the max qubits that actually ran on the chip), README, PARAMS.md and CREDITS. Keep ALL existing words and graphs and every section: only change what the new runs change.
5. MOTH_FREEZE=1 python build_web.py (twice, identical), node common/qa/qa_page.cjs entries/${s} ${port(i)} until ok, node entries/${s}/qa/e2e.cjs if it exists (update it if needed), and python common/qa/crosslinks.py (lines for ${s}). Read the screenshots.
Return the structured result.`
const verify = (s, i, r) => `${ASK}
Independent verifier for entries/${s} in ${ROOT}. Don't submit Atlas jobs. Builder report: ${JSON.stringify(r)}.
Check that every reported ibm_fez job exists in ${ROOT}\\cache\\<engine>\\*.json with params targeting ibm_fez and a result reporting ibm_fez (or the engine's documented hardware field), that no hardware-capable step still defaults to another backend or emu without a labelled reason, that the page shows the ibm_fez results with correct labels and numbers, that piece.json/README/PARAMS match, and that the earlier words and graphs are all still there. Run MOTH_FREEZE=1 python build_web.py, node common/qa/qa_page.cjs entries/${s} ${port(i) + 20}, the e2e if present, and crosslinks. Blocking = a claimed fez job that didn't run on fez, a hardware-capable step left off fez without a recorded reason, QA/e2e failing, content lost, or a data mismatch.`
const fix = (s, i, v) => `${ASK}
Close the gaps in entries/${s} (${ROOT}). Verifier: ${JSON.stringify(v, null, 1)}. You may submit ibm_fez jobs only for missing steps, within the allowance (${(args.allowance || {})[s] || 15} credits above the spend when this pass began). Rebuild, re-run qa_page (port ${port(i) + 5}), e2e and crosslinks, and return the structured result.`

const out = await pipeline(args.slugs,
  (s, _o, i) => agent(work(s, i), {label:`fez:${s}`, phase:'Fez', schema: OUT}),
  (r, s, i) => r ? agent(verify(s, i, r), {label:`verify:${s}`, phase:'Verify', schema: VERDICT, effort:'high'}).then(v => ({r, v})) : null,
  async (x, s, i) => {
    if (!x) return {slug:s, ok:false}
    if (x.v.pass) return {slug:s, ok:true, r:x.r}
    const f = await agent(fix(s, i, x.v), {label:`fix:${s}`, phase:'Fix', schema: OUT})
    const v2 = f ? await agent(verify(s, i, f), {label:`reverify:${s}`, phase:'Fix', schema: VERDICT, effort:'high'}) : null
    return {slug:s, ok:!!(v2 && v2.pass), r:f || x.r, open: v2 ? v2.issues.filter(z=>z.severity==='blocking').map(z=>z.what) : ['no re-verify']}
  })
return out.map(o => o && ({slug:o.slug, ok:o.ok, fez_jobs:o.r && o.r.fez_jobs, not_possible:o.r && o.r.not_possible, credits:o.r && o.r.credits_spent_now, open:o.open || []}))
