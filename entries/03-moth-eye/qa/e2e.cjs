// End-to-end journey for Moth Eye:  node entries/03-moth-eye/qa/e2e.cjs [port 6210-6219]
// Serves web/ locally, opens the built page in headless Chromium and walks the main user journey with real
// assertions, using real mouse and keyboard input (page internals are only READ, never written):
//   load (no autoplay, no sound on the page, WebGL viewer up, brand bar -> hub, "Challenge 03", no ranking words) ->
//   proof chips and readouts match piece.json / PARAMS.md / the job cache -> play the instrument to an outcome
//   (1 layer, flat slab, head-on = "Hidden"; grazing = "Spotted!") -> geometry / shading / interaction / orbit /
//   zoom / lamp pad / sky drag / torch / labels / film spacing -> the shared tilt sweep (start from one button, pause
//   from the other) -> every graph renders (layer plot, tilt chart, R table, WebGL loupe, plates, scene, meter, stack)
//   -> charts load runs (plot column click + Enter, control cross) -> Jobs and credits (8 runs, 5 probes, load a
//   run) -> the 7 titled sections and every drawer -> the film plays and pauses (silent, as labelled) -> copy link,
//   reload, new tab, hashchange and an old _vD link restore the state -> Reset -> prev / hub / next nav ->
//   375 px phone: no sideways scroll, a chart column still loads a run.
// Exit code 1 if any check fails. Screenshots: qa/e2e-home.png, qa/e2e-restored.png, qa/e2e-mobile.png.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = path.basename(PIECE), HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const port = +(process.argv[2] || 6210);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', range = q.headers.range;
  if (range) {   // the <video> asks for byte ranges
    const m = /bytes=(\d*)-(\d*)/.exec(range), a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
});

// the same audio instrumentation as common/qa/qa_page.cjs: count started sources and AudioContexts
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
};

const steps = [], fails = [];
function check(cond, msg) { (cond ? steps : fails).push((cond ? 'PASS ' : 'FAIL ') + msg); console.log((cond ? 'PASS ' : 'FAIL ') + msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- ground truth from the files on disk ----------
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8'), readme = fs.readFileSync(path.join(PIECE, 'README.md'), 'utf8');
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const runRows = params.split(/\r?\n/).filter(l => /^\| L\d_R6/.test(l)).map(l => l.split('|').map(c => c.trim()))
  .map(c => ({ tag: c[1], layers: +c[2], rays: +c[3], inter: +c[4], R: +c[6], T: +c[7], job: UUID.exec(c[8])[0] }));
const probeRows = params.split(/\r?\n/).filter(l => /^\| \d+ \| \d+ \| (failed|completed)/.test(l)).map(l => l.split('|').map(c => c.trim()))
  .map(c => ({ layers: +c[1], rays: +c[2], status: c[3], job: UUID.exec(c[5])[0] }));
const run = Object.fromEntries(runRows.map(r => [r.tag, r]));
const engine = piece.engines[0];
const cacheText = fs.readdirSync(path.join(ROOT, 'cache', engine)).filter(f => f.endsWith('.json'))
  .map(f => fs.readFileSync(path.join(ROOT, 'cache', engine, f), 'utf8')).join('\n');
const ledger = fs.readFileSync(path.join(ROOT, 'cache', 'ledger.jsonl'), 'utf8');
const sweep = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'view_sweep.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const order = fs.readdirSync(path.join(ROOT, 'entries')).filter(s => fs.existsSync(path.join(ROOT, 'entries', s, 'piece.json'))).sort();
const me = order.indexOf(SLUG), prevSlug = order[(me - 1 + order.length) % order.length], nextSlug = order[(me + 1) % order.length];
const sweepAt = (tag, deg, key) => sweep.runs[tag].rows[sweep.elevations.indexOf(deg)][key];

(async () => {
  // ---------- files, before the browser ----------
  check(runRows.length === 8 && probeRows.length === 5, `PARAMS.md lists ${runRows.length} completed runs and ${probeRows.length} budget probes`);
  check(piece.jobs === runRows.length, `piece.json jobs (${piece.jobs}) = completed runs in PARAMS.md (${runRows.length})`);
  check(piece.qubits === 21 && /\*\*21\*\* \(limit/.test(params) && /21 qubits/.test(readme), 'qubits: piece.json 21 = PARAMS.md 6x6 limit = README');
  check(runRows.every(r => cacheText.includes(r.job)), `all ${runRows.length} completed job IDs are in cache/${engine}/*.json`);
  check(probeRows.every(p => ledger.includes(p.job)), 'all 5 probe job IDs are in cache/ledger.jsonl (the 4 rejected ones have no result file)');
  check(piece.credits_spent === (ledger.match(new RegExp(`"piece": "${SLUG}"`, 'g')) || []).length, `credits_spent ${piece.credits_spent} = ledger submissions for ${SLUG}`);
  const missing = piece.deliverables.map(d => d.split(' (')[0].trim()).filter(d => !fs.existsSync(path.join(PIECE, d)));
  check(!missing.length, `every piece.json deliverable exists${missing.length ? ' (missing: ' + missing.join(', ') + ')' : ''}`);
  const filesJson = JSON.parse(fs.readFileSync(path.join(WEB, 'files.json'), 'utf8'));
  check(Object.entries(filesJson).every(([k, v]) => fs.existsSync(path.join(WEB, k)) && fs.existsSync(path.join(ROOT, v))), 'every web/files.json entry exists');
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'latin1');
  check(![...html].some(c => c.charCodeAt(0) > 127), 'web/index.html is pure ASCII');
  const rel = [...new Set([...html.matchAll(/(?<![\w-])(?:src|href|poster|data-src)\s*=\s*"([^"#:{}$]+)"/g)].map(m => m[1]))];
  check(rel.length > 0 && rel.every(r => filesJson[r]), `every relative file the page references is in files.json (${rel.join(', ')})`);
  check(Object.keys(filesJson).every(k => rel.includes(k) || k === piece.mascot.replace(/^web\//, '')), 'files.json has no unused file (the mascot is for the hub, via piece.json)');

  await new Promise(r => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [];
  const watch = p => { p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); };
  watch(page);
  await ctx.addInitScript(INSTRUMENT);
  const text = (sel, p = page) => p.textContent(sel).then(s => (s || '').trim());
  const attr = (sel, a, p = page) => p.getAttribute(sel, a);
  const meter = async (p = page) => { await p.waitForTimeout(700); return { big: parseFloat(await text('#m-big', p)) / 100, mood: await text('#m-mood', p) }; };
  const toastText = async () => { await page.waitForTimeout(150); return text('#toast'); };
  const readouts = async (p = page) => ({ l: await text('#l-val', p), th: await text('#th-val', p), tilt: await text('#tilt-val', p), pad: await text('#pad-val', p),
    job: await text('#r-job', p), geo: await p.$eval('[data-geo][aria-pressed="true"]', b => b.dataset.geo), mode: await p.$eval('[data-mode][aria-pressed="true"]', b => b.dataset.mode),
    inter: await p.$eval('[data-int][aria-pressed="true"]', b => b.dataset.int) });
  const colours = (sel, p = page) => p.$eval(sel, c => {   // distinct colours in a canvas (WebGL: copied in the same task as a fresh draw)
    if (c.id === 'cv') V.draw(st, { bothZoom: 2.0 });
    const t = document.createElement('canvas'); t.width = 64; t.height = 64; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data, s = new Set(); for (let i = 0; i < d.length; i += 4) s.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return s.size; });

  // ---------- 1. load ----------
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  check(!errors.length, 'page loads with no console errors');
  check(await page.$eval('#nogl', e => e.hidden), 'WebGL2 viewer is up (the no-WebGL note stays hidden)');
  const film0 = await page.$eval('#film', v => ({ paused: v.paused, autoplay: v.autoplay, src: v.querySelector('source').getAttribute('src') }));
  check(film0.paused && !film0.autoplay, 'nothing autoplays: the film is paused');
  check(await page.$$eval('audio', a => a.length) === 0 && (await page.evaluate(() => __qa.ctx + __qa.sources)) === 0, 'no sound on load (no <audio>, no AudioContext): the piece is silent, as its film label says');
  check(await attr('.wtnr-bar a', 'href') === HUB, 'brand bar links to the hub');
  check(/Challenge 03\s*·\s*Hide/.test(await text('.wtnr-bar')), 'brand bar reads "Challenge 03 · Hide"');
  const body = await page.evaluate(() => document.body.innerText);
  check(!/main entry|bonus/i.test(body), 'no "Main entry" or "Bonus" ranking anywhere on the page (all entries equal)');
  check(/Try to hide a moth.s eye from the lamp\./.test(await text('h1')), 'restored h1 is on the page');

  // ---------- 2. proof chips and readouts against the files ----------
  const proof = await text('#proof');
  check(/21 qubits at the 6 × 6 limit/.test(proof) && new RegExp(`${piece.jobs} real shader runs`).test(proof) && /5 budget probes/.test(proof) && /statevector/.test(proof),
    `proof chips: "${proof}" match piece.json (21 qubits, ${piece.jobs} jobs) and PARAMS.md (5 probes)`);
  const meta = await page.evaluate(() => META.results.map(r => ({ tag: r.tag, job: r.job_id, R: r.lut_mean_R, T: r.lut_mean_T, layers: r.layers, rays: r.rays, inter: r.interaction })));
  check(meta.length === 8 && meta.every(m => run[m.tag] && run[m.tag].job === m.job && near(run[m.tag].R, m.R, 6e-5) && near(run[m.tag].T, m.T, 6e-5) && run[m.tag].layers === m.layers && run[m.tag].inter === m.inter),
    'every run on the page (tag, job ID, layers, interaction, mean R and T) matches PARAMS.md');
  check(await text('#r-job') === run.L6_R6.job && /^21: the 6 × 6 budget limit/.test(await text('#r-qubits')), 'readouts open on the 6 x 6 run at 21 qubits with its job ID');
  check(/entanglement-shader-v1/.test(await text('.readout')) && /statevector simulator/.test(await text('.readout')), 'readout names the engine and the simulator');
  const m0 = await meter();
  check(m0.big > 0.2 && m0.big < 0.8 && ['Hidden', 'Glimpsed', 'Spotted'].includes(m0.mood), `the meter reads the live render: ${(m0.big * 100).toFixed(1)}% ${m0.mood}`);
  await page.screenshot({ path: path.join(PIECE, 'qa', 'e2e-home.png') });

  // ---------- 3. the instrument, to an outcome ----------
  await page.focus('#layers'); await page.keyboard.press('Home'); await page.waitForTimeout(300);
  check(await text('#l-val') === '1 layer' && await text('#r-job') === run.L1_R6.job, 'layers slider (Home) loads the 1-layer run and its job ID');
  check(/<b>4<\/b> bounce back/.test(await page.$eval('#stack-txt', e => e.innerHTML)) && /1-layer stack/.test(await text('#stack-txt')), 'layer stack: 4 of 10 dots bounce back at 1 layer (mean R 0.418)');
  await page.click('[data-geo="slab"]'); await page.click('#headon');
  let m = await meter();
  check(await attr('[data-geo="slab"]', 'aria-pressed') === 'true' && /tilt 0\D/.test(await text('#tilt-val')), 'Flat slab + Head-on: slab selected, tilt 0');
  check(m.mood === 'Hidden' && near(m.big, sweepAt('L1_R6', 0, 'slab'), 0.05), `outcome 1: the flat slab head-on is Hidden (${(m.big * 100).toFixed(1)}%, tilt data ${sweepAt('L1_R6', 0, 'slab').toFixed(3)})`);
  await page.click('#graze');
  let spotted = false;
  for (let i = 0; i < 20 && !spotted; i++) { await page.waitForTimeout(100); spotted = (await text('#bubble')) === 'Spotted!' && await page.$eval('#bubble', b => b.classList.contains('on')); }
  m = await meter();
  check(/tilt 72\D/.test(await text('#tilt-val')) && m.mood === 'Spotted' && spotted, `outcome 2: tilt to grazing and the bat spots the slab ("Spotted!", ${(m.big * 100).toFixed(1)}%)`);
  check(near(m.big, (sweepAt('L1_R6', 70, 'slab') + sweepAt('L1_R6', 75, 'slab')) / 2, 0.08), 'grazing meter agrees with the measured tilt sweep for the slab');
  const slabBig = m.big;
  await page.click('[data-geo="eye"]');
  m = await meter();
  check(await attr('[data-geo="eye"]', 'aria-pressed') === 'true' && Math.abs(m.big - slabBig) > 0.05, `"Moth eye" works once another geometry is chosen (was flagged only because it starts selected): ${(m.big * 100).toFixed(1)}%`);
  const bars = await page.$$eval('#m-bars .bar', b => b.length);
  check(bars === 3 && /Moth eye/.test(await text('#m-bars')) && /Flat slab/.test(await text('#m-bars')), 'meter shows the three per-geometry bars');
  await page.click('[data-geo="both"]'); await page.waitForTimeout(300);
  check(await attr('[data-geo="both"]', 'aria-pressed') === 'true', 'Eye vs slab selects');
  const px0 = await colours('#cv');
  await page.click('[data-mode="1"]'); await page.waitForTimeout(300);
  check(await attr('[data-mode="1"]', 'aria-pressed') === 'true', 'Raw R shading selects');
  await page.click('[data-mode="0"]'); await page.click('[data-geo="eye"]');
  check(await attr('[data-mode="0"]', 'aria-pressed') === 'true', 'Night scene shading selects again');
  // interaction off/on at 6 layers
  await page.focus('#layers'); await page.keyboard.press('End'); await page.waitForTimeout(300);
  await page.click('[data-int="0"]'); await page.waitForTimeout(300);
  check(await text('#r-job') === run.L6_R6_int0.job, 'interaction Off (0) at 6 layers loads the control run L6_R6_int0');
  await page.click('[data-int="1"]'); await page.waitForTimeout(300);
  check(await text('#r-job') === run.L6_R6.job, '"On (1)" works once Off is chosen (flagged only because it starts selected)');
  await page.focus('#layers'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(200);
  check(await text('#l-val') === '3 layers' && await page.$eval('[data-int="0"]', b => b.disabled), 'at 3 layers the Off control is disabled (it was only run at 1 and 6)');
  // orbit, zoom, lamp
  await page.$eval('#scenebox', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const t0 = await text('#tilt-val');
  const cb = await page.$eval('#cv', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(cb.x + cb.w * 0.5, cb.y + cb.h * 0.5); await page.mouse.down();
  await page.mouse.move(cb.x + cb.w * 0.65, cb.y + cb.h * 0.7, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
  const t1 = await text('#tilt-val');
  check(t1 !== t0, `dragging the loupe orbits the eye (${t0} -> ${t1})`);
  await page.focus('#cv'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  check(await text('#tilt-val') !== t1, 'arrow keys on the loupe orbit too');
  const dist0 = await page.evaluate(() => st.dist);
  await page.mouse.move(cb.x + cb.w * 0.5, cb.y + cb.h * 0.5); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  check(await page.evaluate(() => st.dist) !== dist0, 'scrolling on the loupe zooms');
  await page.$eval('#pad', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const pad0 = await text('#pad-val');
  const pb = await page.$eval('#pad', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(pb.x + pb.w * 0.8, pb.y + pb.h * 0.3); await page.waitForTimeout(200);
  const pad1 = await text('#pad-val');
  check(pad1 !== pad0 && await attr('#pad', 'aria-valuetext') === pad1, `light pad moves the lamp (${pad0} -> ${pad1})`);
  await page.focus('#pad'); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(150);
  check(await text('#pad-val') !== pad1, 'arrow keys on the light pad move the lamp');
  await page.$eval('#scenebox', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const bulb0 = await page.$eval('#bulbu', u => u.getAttribute('x') + ',' + u.getAttribute('y'));
  const sb = await page.$eval('#bg', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(sb.x + sb.w * 0.95, sb.y + sb.h * 0.08); await page.mouse.down(); await page.mouse.move(sb.x + sb.w * 0.97, sb.y + sb.h * 0.6, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(250);
  check(await page.$eval('#bulbu', u => u.getAttribute('x') + ',' + u.getAttribute('y')) !== bulb0, 'dragging the sky moves the bulb (and the light pad)');
  await page.click('#torch');
  check(/torch test|lamp only lights the front/.test(await toastText()), `Torch test puts the lamp behind your head ("${await text('#toast')}")`);
  await page.click('#lbl'); await page.waitForTimeout(200);
  check(await attr('#lbl', 'aria-pressed') === 'false' && await page.$eval('#labels', g => g.getAttribute('visibility')) === 'hidden', 'Labels button hides the plate labels');
  await page.click('#lbl');
  check(await attr('#lbl', 'aria-pressed') === 'true', 'Labels button shows them again');
  await page.focus('#thick'); await page.keyboard.press('End'); await page.waitForTimeout(150);
  check(await text('#th-val') === '1000 nm', 'film-spacing slider sets the shader uniform (1000 nm)');
  await page.keyboard.press('Home');

  // ---------- 4. the shared tilt sweep ----------
  await page.click('#headon');
  await page.click('#sweep'); await page.waitForTimeout(700);
  const sw1 = await page.$$eval('.sweepbtn', b => b.map(x => x.getAttribute('aria-pressed') + ':' + x.textContent));
  const tiltA = parseFloat((await text('#tilt-val')).replace(/\D+/, ''));
  check(sw1.every(s => s === 'true:Pause the sweep') && tiltA > 3, `Sweep the tilt starts from the controls and both sweep buttons follow (tilt ${tiltA})`);
  await page.click('#sweep2'); await page.waitForTimeout(150);
  const tiltB = await text('#tilt-val'); await page.waitForTimeout(400);
  check((await page.$$eval('.sweepbtn', b => b.every(x => x.getAttribute('aria-pressed') === 'false'))) && await text('#tilt-val') === tiltB, 'the sweep button in The data pauses it');
  check(new RegExp(`YOU ${parseFloat(tiltB.replace(/\D+/, ''))}`).test(await page.$eval('#tilt', s => s.textContent)), 'tilt chart "YOU" marker follows the bat\'s tilt');

  // ---------- 5. every graph renders ----------
  const plot = await page.$eval('#plot', s => ({ poly: s.querySelectorAll('polyline').length, cols: s.querySelectorAll('g.pt:not([data-i])').length, circles: s.querySelectorAll('g.pt circle').length, ctl: s.querySelectorAll('g.pt[data-i="0"]').length, w: s.getBoundingClientRect().width }));
  check(plot.poly === 4 && plot.cols === 6 && plot.circles === 24 && plot.ctl === 2 && plot.w > 200, `layer plot renders: 4 series, 6 run columns (24 points), 2 control crosses`);
  check(/Mean R rises: 0\.418 → 0\.479/.test(await text('#ch-verdict')) && (await page.$$eval('#legend span', s => s.length)) === 5, 'layer plot verdict tag and legend');
  const tilt = await page.$eval('#tilt', s => ({ poly: s.querySelectorAll('polyline').length, circles: s.querySelectorAll('circle').length }));
  check(tilt.poly === 3 && tilt.circles === 3 * sweep.elevations.length && (await page.$$eval('#tl-legend span', s => s.length)) === 4, 'tilt chart renders: 3 series over 18 tilts, legend with "your current tilt"');
  check(await colours('#lut') > 20, 'R lookup-table canvas is drawn');
  check(px0 > 20 && await colours('#cv') > 20, 'WebGL loupe canvas is drawn');
  const svgs = await page.evaluate(() => ['bg', 'fx', 'bateye', 'stack', 'pl-omma', 'pl-nip'].map(id => [id, document.getElementById(id).querySelectorAll('*').length]));
  check(svgs.every(([, n]) => n > 10), `scene, meter, stack and both plates render (${svgs.map(([i, n]) => i + ':' + n).join(' ')})`);
  check((await text('#ch-note')).startsWith('No. Going from 1 to 6 layers') && (await text('#verdict-long')).length > 100, 'verdict and long verdict are filled in');

  // ---------- 6. the charts load runs ----------
  await page.click('#plot g.pt[data-l="3"]:not([data-i]) rect'); await page.waitForTimeout(300);
  check(await text('#l-val') === '3 layers' && await text('#r-job') === run.L3_R6.job && /L3_R6/.test(await text('#lut-run')) &&
    await attr('.runbtn[aria-label="Load run L3_R6"]', 'aria-pressed') === 'true' && /for 3 layers/.test(await attr('#tilt', 'aria-label')),
    'clicking the 3-layer column in the plot loads L3_R6 into the slider, readouts, R table, tilt chart and jobs table');
  await page.focus('#plot g.pt[data-l="5"]:not([data-i])'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check(await text('#r-job') === run.L5_R6.job, 'a plot column focused with Tab loads its run on Enter');
  await page.click('#plot g.pt[data-l="6"][data-i="0"]'); await page.waitForTimeout(300);
  check(await text('#r-job') === run.L6_R6_int0.job && await attr('[data-int="0"]', 'aria-pressed') === 'true', 'the 6-layer control cross loads L6_R6_int0 and switches interaction off');

  // ---------- 7. Jobs and credits ----------
  const runBtns = await page.$$eval('.runbtn', b => b.map(x => x.textContent));
  const runsTxt = await text('#runs');
  check(runBtns.length === 8 && runRows.every(r => runBtns.includes(r.tag) && runsTxt.includes(r.job)), 'Jobs and credits lists all 8 runs with their full job IDs');
  check(/8 completed shader runs and 4 rejected budget probes: 12 Atlas jobs/.test(await text('#jobs-note')), 'jobs note: 8 runs + 4 rejected probes = 12 jobs (= credits_spent)');
  const probesTxt = await text('#probes');
  check((await page.$$eval('#probes tr', r => r.length)) === 6 && probeRows.every(p => probesTxt.includes(p.job.slice(0, 8))), 'probe table lists the 5 probes from PARAMS.md');
  await page.click('.runbtn[aria-label="Load run L2_R6"]');
  check(/Run L2_R6 loaded/.test(await toastText()) && await text('#l-val') === '2 layers' && /2-layer stack/.test(await text('#stack-txt')), 'pressing run L2_R6 loads it (toast, slider, layer stack)');

  // ---------- 8. sections and drawers ----------
  const toc = await page.$$eval('nav.toc a', a => a.map(x => x.getAttribute('href')));
  check(toc.length === 7, `"On this page" has 7 links (${toc.join(' ')})`);
  for (const h of toc) {
    await page.click(`nav.toc a[href="${h}"]`); await page.waitForTimeout(250);
    const top = await page.$eval(h, e => e.getBoundingClientRect().top);
    check(top > -5 && top < 200 && await text('#l-val') === '2 layers', `"On this page" ${h} scrolls to its section (state kept)`);
  }
  const secs = await page.$$eval('section.sec', s => s.map(x => x.querySelector('.ink-bar h2').textContent.trim()));
  check(secs.join('|') === 'The data|The real eye, plate by plate|The film · moth_eye.mp4|The science|How it was made|What this does not claim|Jobs and credits', `7 titled sections: ${secs.join(' / ')}`);
  const drawers = await page.$$('details.drawer');
  let dOK = 0;
  for (const d of drawers) {
    const s = await d.$('summary'); await s.click(); const o1 = await d.evaluate(e => e.open && e.querySelector('.body').innerText.length > 100);
    await s.click(); const o2 = await d.evaluate(e => e.open);
    if (o1 && !o2) dOK++;
  }
  check(drawers.length === 5 && dOK === 5, `all ${drawers.length} drawers open (with text) and close`);
  check(/This is an analogy\./.test(await text('#claims')) && await page.$eval('#claims', e => e.getBoundingClientRect().height > 100), 'What this does not claim is always open');
  await page.click('.stagebar a.jump'); await page.waitForTimeout(250);
  check(near(await page.$eval('#data', e => e.getBoundingClientRect().top), 0, 200), '"The data ↓" in the stage bar jumps to The data');

  // ---------- 9. the film ----------
  await page.$eval('#the-film', e => e.scrollIntoView()); await page.waitForTimeout(400);
  await page.waitForFunction(() => document.getElementById('film').readyState >= 1, null, { timeout: 15000 });
  const dur = await page.$eval('#film', v => v.duration);
  check(await page.$eval('#film source', s => s.getAttribute('src')) === 'video/moth_eye.mp4' && near(dur, 52, 1.5), `film source attaches near the viewport; duration ${dur.toFixed(1)} s (labelled 52 s)`);
  await page.focus('#film'); await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  let fv = await page.$eval('#film', v => ({ paused: v.paused, t: v.currentTime }));
  if (fv.paused) { await page.click('#film'); await page.waitForTimeout(1200); fv = await page.$eval('#film', v => ({ paused: v.paused, t: v.currentTime })); }
  check(!fv.paused && fv.t > 0.3, `the film plays when the user presses play (t = ${fv.t.toFixed(2)} s)`);
  check(await page.$eval('#film', v => (v.webkitAudioDecodedByteCount || 0) === 0), 'the film is silent, as labelled "no sound"');
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  if (!(await page.$eval('#film', v => v.paused))) { await page.click('#film'); await page.waitForTimeout(300); }
  const tP = await page.$eval('#film', v => v.currentTime); await page.waitForTimeout(500);
  check(await page.$eval('#film', v => v.paused) && await page.$eval('#film', v => v.currentTime) === tP, 'and pauses when pressed again');

  // ---------- 10. share link, reload, new tab, hashchange, old _vD link ----------
  await page.click('.runbtn[aria-label="Load run L4_R6"]');
  await page.click('[data-geo="slab"]'); await page.click('[data-mode="1"]'); await page.click('#headon');
  await page.focus('#cv'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  await page.focus('#pad'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
  await page.focus('#thick'); for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const want = await readouts();
  await page.click('#share');
  check(await toastText() === 'Link copied', 'Copy link to this view: "Link copied"');
  const href = page.url(), clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === href && new URL(href).hash.slice(1).split('_').length === 10 && /^[A-Za-z0-9._~-]+$/.test(new URL(href).hash.slice(1)), `clipboard holds the shareable link ${new URL(href).hash}`);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const got = await readouts();
  if (JSON.stringify(got) !== JSON.stringify(want)) console.log('  want', JSON.stringify(want), '| got', JSON.stringify(got));
  check(JSON.stringify(got) === JSON.stringify(want), `reload with the hash restores layers, interaction, geometry, shading, tilt, lamp and spacing (${got.l}, ${got.geo}, mode ${got.mode}, ${got.tilt}, ${got.pad}, ${got.th})`);
  await page.screenshot({ path: path.join(PIECE, 'qa', 'e2e-restored.png') });
  const p2 = await ctx.newPage(); watch(p2);
  await p2.goto(href, { waitUntil: 'networkidle' }); await p2.waitForTimeout(600);
  check(JSON.stringify(await readouts(p2)) === JSON.stringify(want), 'the same link opened in a new tab restores the same view');
  await p2.close();
  await page.evaluate(() => { location.hash = 'L1_i0_dome_m0_a0_e0_d50_x0.30_y0.40_t300'; }); await page.waitForTimeout(500);
  const hc = await readouts();
  check(hc.l === '1 layer' && hc.inter === '0' && hc.geo === 'dome' && hc.mode === '0' && hc.th === '300 nm' && hc.job === run.L1_R6_int0.job, 'a shared link pasted into the same tab (hashchange) loads its view');
  const p3 = await ctx.newPage(); watch(p3);
  await p3.goto(base + '#L6_i1_eye_m0_a28_e22_d50_x-0.45_y0.50_t500_vD', { waitUntil: 'networkidle' }); await p3.waitForTimeout(800);
  check(near(await p3.$eval('#data', e => e.getBoundingClientRect().top), 0, 200), 'an old link ending _vD opens at The data');
  await p3.close();
  await page.click('#reset'); await page.waitForTimeout(300);
  const rs = await readouts();
  check(rs.l === '6 layers' && rs.geo === 'eye' && rs.mode === '0' && rs.th === '500 nm' && rs.job === run.L6_R6.job && new URL(page.url()).hash === '', 'Reset returns to the opening view and clears the hash');

  // ---------- 11. prev / hub / next ----------
  const nav = await page.$eval('nav.wtnr-nav', n => ({ prev: n.querySelector('a[rel=prev]').href, next: n.querySelector('a[rel=next]').href, hub: n.querySelector('a.wn-hub').href,
    prevT: n.querySelector('a[rel=prev]').textContent, nextT: n.querySelector('a[rel=next]').textContent, items: [...n.querySelectorAll('ol a')].map(a => a.href), cur: (n.querySelector('ol a[aria-current="page"]') || {}).href }));
  check(nav.prev === urls[prevSlug] && nav.next === urls[nextSlug] && nav.hub === HUB, `nav: prev -> ${prevSlug} (${nav.prevT.trim()}), hub, next -> ${nextSlug} (${nav.nextT.trim()})`);
  check(nav.items.length === order.length && nav.items.every(u => u === HUB || Object.values(urls).includes(u)) && nav.cur === urls[SLUG], `"Jump to any piece" lists all ${order.length} pieces, this one marked current`);
  await page.click('nav.wtnr-nav summary');
  check(await page.$eval('nav.wtnr-nav details', d => d.open), 'the jump list opens');
  check(await page.$eval('nav.wtnr-nav', n => n.nextElementSibling && n.nextElementSibling.classList.contains('wtnr-foot')), 'the nav sits just before the footer disclaimer');

  // ---------- 12. phone width ----------
  // (no isMobile: the page has no viewport meta of its own; the artifact host wraps it in a skeleton that has one)
  const mp = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true }); watch(mp);
  await mp.goto(base, { waitUntil: 'networkidle' }); await mp.waitForTimeout(800);
  check(await mp.evaluate(() => document.documentElement.scrollWidth) <= 375, 'no sideways scroll at 375 px');
  await mp.tap('#plot g.pt[data-l="2"]:not([data-i]) rect'); await mp.waitForTimeout(300);
  check(await text('#l-val', mp) === '2 layers', 'at 375 px a tap on a plot column loads the run');
  await mp.tap('[data-geo="dome"]'); await mp.waitForTimeout(200);
  check(await attr('[data-geo="dome"]', 'aria-pressed', mp) === 'true', 'at 375 px the geometry buttons work');
  check(await mp.$eval('nav.wtnr-nav', n => n.getBoundingClientRect().width <= 375 && n.scrollWidth <= n.clientWidth + 1), 'nav fits at 375 px');
  await mp.screenshot({ path: path.join(PIECE, 'qa', 'e2e-mobile.png') });
  await mp.close();

  check(!errors.length, `no console errors during the journey${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(`\n${steps.length} passed, ${fails.length} failed`);
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify({ ok: !fails.length, passed: steps.length, failed: fails }, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); srv.close(); process.exit(1); });
