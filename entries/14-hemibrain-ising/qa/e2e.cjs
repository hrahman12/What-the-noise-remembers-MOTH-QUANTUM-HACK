// End-to-end journey for 14 "Fly Brain Metro": node entries/14-hemibrain-ising/qa/e2e.cjs [port 6210-6219]
// Serves web/ locally, walks the main user journey in headless Chromium with real assertions, and checks the page
// against the source data it is built from (data/circuits.json, out/runs.json, out/thrml.json, out/atlas_jobs.json,
// piece.json, site/urls.json, cache/graph-v1/*.json). Writes qa/e2e.json and exits 1 on any failure.
//   nothing sounds or moves on load -> pick networks -> choose trains (IBM ibm_fez hardware and Atlas maglev = real
//   job IDs, compared with the exact blueprint; a network without a run says why)
//   -> ride to an outcome (lamps settle on the real sample; "Good service" when every line is in step) -> beta
//   -> Depart / Hold, the signal, the Gibbs journey and Play Gibbs chain -> tap stations, arrow keys, partners, the fly
//   -> chimes on (sound starts) and off (stops) -> Scene / Data, departures board, correlation matrix
//   -> the six sections and their drawers, the earlier words, Figures 1-3 and the Neuron card (all draw real pixels)
//   -> jobs table + "Ride this run" -> ticket link, reload with the hash, view restored -> prev / hub / next nav
//   -> 375 px phone width.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const piece = path.resolve(__dirname, '..'), web = path.join(piece, 'web'), root = path.resolve(piece, '..', '..');
const port = +(process.argv[2] || 6210);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

// ---- expected values, read from the sources the page is built from (not from the page) ----------------------
const J = p => JSON.parse(fs.readFileSync(path.join(piece, p), 'utf8'));
const CIRC = Object.fromEntries(J('data/circuits.json').circuits.map(c => [c.id, c]));
const RUNS = J('out/runs.json'), THRML = J('out/thrml.json'), JOBS = J('out/atlas_jobs.json'), PIECE = J('piece.json');
const URLS = JSON.parse(fs.readFileSync(path.join(root, 'site', 'urls.json'), 'utf8'));
const run = (c, m) => RUNS.find(r => r.circuit === c && r.mode === m && r.status === 'completed');
const HWRUNS = RUNS.filter(r => r.mode === 'qpu' && r.status === 'completed');
const REPLICA = J('out/replica.json');
const CAP = +(/CAP = "14-hemibrain-ising", (\d+)/.exec(fs.readFileSync(path.join(piece, 'run_graph.py'), 'utf8'))[1]);
const agreeOf = (b, c) => CIRC[c].edges.reduce((n, e) => n + (b[e.i] === b[e.j] ? 1 : 0), 0);
const upOf = b => [...b].filter(ch => ch === '0').length;
const spinsOf = b => [...b].map(ch => (ch === '0' ? 1 : -1));
const cacheIds = new Set(fs.readdirSync(path.join(root, 'cache', 'graph-v1')).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(root, 'cache', 'graph-v1', f), 'utf8')).job_id));
const ledger = fs.readFileSync(path.join(root, 'cache', 'ledger.jsonl'), 'utf8').trim().split(/\r?\n/).map(l => JSON.parse(l))
  .filter(l => l.piece === '14-hemibrain-ising');
const slugs = Object.keys(URLS).sort(), me = slugs.indexOf('14-hemibrain-ising');

const INSTRUMENT = () => {
  window.__qa = { sources: 0, media: 0, ctx: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { window.__qa.ctx++; return new AC(...a); }; W.prototype = AC.prototype;
    window.AudioContext = W; window.webkitAudioContext = W;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [], fails = [];
function check(name, cond, detail) {
  steps.push({ step: name, ok: !!cond, ...(detail !== undefined ? { detail } : {}) });
  if (!cond) fails.push({ step: name, detail });
}

// how much ink a canvas holds: fraction of pixels that differ from its top-left pixel, and distinct colours
const INK = id => {
  const c = document.getElementById(id), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  let diff = 0; const cols = new Set();
  for (let k = 0; k < d.length; k += 16) {
    if (Math.abs(d[k] - d[0]) + Math.abs(d[k + 1] - d[1]) + Math.abs(d[k + 2] - d[2]) + Math.abs(d[k + 3] - d[3]) > 24) diff++;
    if (cols.size < 400) cols.add((d[k] >> 3) + ',' + (d[k + 1] >> 3) + ',' + (d[k + 2] >> 3));
  }
  return { w: c.width, h: c.height, frac: diff / (d.length / 16), colours: cols.size, sig: c.toDataURL().length };
};
const inked = r => r && r.w > 0 && r.h > 0 && r.frac > 0.02 && r.colours > 3;

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const p = await ctx.newPage();
  const errors = [], failed = [], external = new Set();
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 300)));
  p.on('requestfailed', r => { if (!r.url().startsWith('data:')) failed.push(r.url()); });
  p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  p.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.add(u.hostname); });
  await p.addInitScript(INSTRUMENT);
  const txt = id => p.$eval('#' + id, e => e.textContent.trim());
  const pressed = sel => p.$eval(sel, e => e.getAttribute('aria-pressed'));
  const S = () => p.evaluate(() => ({ circuit: st.circuit, sampler: st.sampler, beta: st.beta, pat: st.pat, neuron: st.neuron, chain: st.chain, chainIdx: st.chainIdx, view: st.view }));
  const clickStation = async i => {
    await p.$eval('#scene', e => e.scrollIntoView({ block: 'center' }));
    const [x, y] = await p.evaluate(i => { const r = cv.getBoundingClientRect(), [X, Y] = SP_XY(i); return [r.left + X * r.width / LAY.w, r.top + Y * r.height / LAY.h]; }, i);
    await p.mouse.click(x, y); await p.waitForTimeout(250);
  };

  try {
    await p.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(900);

    // 1. the frame: title, brand bar to the hub, equal entries, real proof numbers, nothing playing
    check('title is the piece title from piece.json', (await p.title()) === PIECE.title, await p.title());
    check('brand bar links to the hub', (await p.$eval('.wtnr-bar a', a => a.href)) === HUB);
    const body = await p.$eval('body', b => b.innerText);
    check('no "Bonus" or "Main entry" ranking on the page', !/\bbonus\b|main entry/i.test(body));
    const proof = await txt('proof');
    check('proof chips: qubits and real jobs match piece.json', proof.includes(`${PIECE.qubits} qubits per run`) && proof.includes(`${PIECE.jobs} real Atlas jobs`), proof);
    check(HWRUNS.length ? 'hardware chip counts the real ibm_fez runs' : 'no hardware chip (no hardware data)',
      HWRUNS.length ? proof.includes(`IBM ibm_fez hardware · ${HWRUNS.length} run`) : !/hardware/.test(proof), proof);
    check('the IBM train is offered only when ibm_fez returned samples', (await p.$$eval('#seg-sampler [data-s="fez"]', b => b.length)) === (HWRUNS.length ? 1 : 0));
    check('nothing sounds or starts on load', await p.evaluate(() => __qa.sources === 0 && __qa.media === 0 && __qa.ctx === 0));
    check('Depart is not running on load', (await pressed('#play')) === 'false');
    check('scene canvas draws the plates (FIG. 1A-1C)', inked(await p.evaluate(INK, 'scene')), await p.evaluate(INK, 'scene'));
    check('signal and status-line fly sprites drawn', inked(await p.evaluate(INK, 'cond')) && (await p.evaluate(INK, 'moodfly')).frac > 0.02);

    // 2. pick a network: one switch drives the metro and The data
    await p.click('#seg-circuit [data-c="memory"]'); await p.waitForTimeout(300);
    check('Memory pressed on the metro and on the bench', (await pressed('#seg-circuit [data-c="memory"]')) === 'true' && (await pressed('#e-seg-circuit [data-c="memory"]')) === 'true');
    check('Figure 1 tag names the memory circuit', (await txt('e-tag')).startsWith(CIRC.memory.name), await txt('e-tag'));
    await p.click('#seg-circuit [data-c="compass"]'); await p.waitForTimeout(300);
    check('Compass works after another network (not a dead control)', (await S()).circuit === 'compass' && (await pressed('#e-seg-circuit [data-c="compass"]')) === 'true');

    // 3. choose the Atlas maglev: real graph-v1 job, 20 qubits, emulator
    await p.click('#seg-sampler [data-s="emu"]'); await p.waitForTimeout(400);
    const ce = run('compass', 'emu');
    check('maglev job ID = compass emulator job in out/runs.json', (await txt('r-job')) === ce.job_id && (await txt('e-r-job')) === ce.job_id, await txt('r-job'));
    check('that job ID is a cached graph-v1 job', cacheIds.has(ce.job_id));
    check('qubits readout = engine-reported num_qubits (20)', (await txt('r-qubits')).startsWith(String(ce.num_qubits)) && ce.num_qubits === PIECE.qubits, await txt('r-qubits'));
    check('runs-on readout says Atlas emulator (Aer), not hardware', /Atlas emulator: Aer/.test(await txt('r-where')) && !/IBM/.test(await txt('r-where')), await txt('r-where'));
    check('vs-exact readout = the emulator run against the exact replica', (await txt('r-vs')).startsWith(`TVD ${REPLICA.compass.runs.emu.tvd_top20.toFixed(3)}`), await txt('r-vs'));
    check('shots readout = 4,096 from the run', (await txt('r-shots')).startsWith(ce.shots.toLocaleString('en-US')), await txt('r-shots'));
    check('beta slider locked at 0.7 for the quantum train', await p.$eval('#beta', e => e.disabled) && (await txt('beta-val')) === '0.7');

    // 4. ride to an outcome: departure 1 is the run's most frequent pattern; the lamps settle on it
    const b0 = ce.top20[0].b, ag0 = agreeOf(b0, 'compass');
    await p.waitForTimeout(2200);
    check('lamps settle on the real top pattern of the run', JSON.stringify(await p.evaluate(() => lampShown)) === JSON.stringify(spinsOf(b0)));
    check('lines in step = computed from the sample and the 30 bonds', (await txt('m-agree')) === `${ag0} / ${CIRC.compass.edges.length}`, await txt('m-agree'));
    check('service status follows the lines', (await txt('m-svc')) === (ag0 === 30 ? 'Good service' : `${30 - ag0} line${30 - ag0 > 1 ? 's' : ''} out of step`), await txt('m-svc'));
    check('p readout = shot frequency of that pattern', (await txt('m-p')) === `${(100 * ce.top20[0].p).toFixed(2)}%`, await txt('m-p'));
    await p.$eval('#scrub', e => { e.value = '4'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(300);
    const b4 = ce.top20[4].b;
    check('slider to departure 5: readouts follow the data', (await txt('scrub-val')).startsWith('departure 5 of 20') && (await txt('m-up')) === `${upOf(b4)} / 20` && (await txt('m-agree')) === `${agreeOf(b4, 'compass')} / 30`, [await txt('scrub-val'), await txt('m-up')]);
    check('bench follows the scene (Figure 1 meter)', (await txt('e-m-rank')) === '5 / 20' && (await txt('e-m-up')) === `${upOf(b4)} / 20`);

    // 4b. the IBM ibm_fez hardware train: real hardware samples, labelled with the job IDs, compared with the exact state
    for (const hr of HWRUNS) {
      await p.click(`#seg-circuit [data-c="${hr.circuit}"]`); await p.waitForTimeout(300);
      await p.click('#seg-sampler [data-s="fez"]'); await p.waitForTimeout(400);
      check(`${hr.circuit}: IBM train job = the ibm_fez run in out/runs.json`, (await txt('r-job')) === `${hr.job_id} · IBM ${hr.ibm_job_id}` && cacheIds.has(hr.job_id), await txt('r-job'));
      check(`${hr.circuit}: runs-on says IBM hardware ibm_fez, 20 qubits`, (await txt('r-where')).startsWith('IBM quantum hardware: ibm_fez') && hr.backend === 'ibm_fez' && (await txt('r-qubits')).startsWith('20') && hr.num_qubits === 20, await txt('r-where'));
      check(`${hr.circuit}: train label names IBM ibm_fez hardware`, /IBM ibm_fez hardware/.test(await txt('r-sampler')), await txt('r-sampler'));
      const ck = REPLICA[hr.circuit].runs.qpu;
      check(`${hr.circuit}: vs-exact readout = hardware against the exact replica`, (await txt('r-vs')).startsWith(`TVD ${ck.tvd_top20.toFixed(3)}`), await txt('r-vs'));
      await p.$eval('#scrub', e => { e.value = '2'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(1600);
      check(`${hr.circuit}: drag to departure 3: lamps settle on the third hardware pattern`, JSON.stringify(await p.evaluate(() => lampShown)) === JSON.stringify(spinsOf(hr.top20[2].b)) && (await txt('m-p')) === `${(100 * hr.top20[2].p).toFixed(2)}%`, await txt('m-p'));
    }
    await p.click('#seg-circuit [data-c="compass"]'); await p.waitForTimeout(300);
    await p.click('#seg-sampler [data-s="emu"]'); await p.waitForTimeout(300);

    // 5. Exact blueprint, then the smell network has no quantum run
    await p.click('#seg-sampler [data-s="exact"]'); await p.waitForTimeout(300);
    check('Exact blueprint is labelled classical, no Atlas job', /classical/.test(await txt('r-job')) && /exact statevector/.test(await txt('r-where')));
    await p.click('#seg-circuit [data-c="smell"]'); await p.waitForTimeout(300);
    check('smell falls back to the Gibbs train', (await S()).sampler === 'gibbs');
    await p.click('#seg-sampler [data-s="emu"]'); await p.waitForTimeout(300);
    check('smell: maglev explains the missing run and stays on Gibbs', (await S()).sampler === 'gibbs' && /credit budget ran out/.test(await txt('toast')), await txt('toast'));
    await p.click('#e-seg-sampler [data-s="exact"]'); await p.waitForTimeout(300);
    if (!REPLICA.smell) check('smell: bench "Exact state" says why (toast) and stays on Gibbs', (await S()).sampler === 'gibbs' && /No Exact state run for the smell circuit/.test(await txt('toast')), await txt('toast'));

    // 6. Gibbs at another beta: slider and bench slider mirror, patterns are THRML's at that beta
    await p.$eval('#beta', e => { e.value = '12'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForTimeout(300);
    const t12 = THRML.circuits.smell.betas['1.2'];
    check('beta 1.2 on both sliders', (await txt('beta-val')) === '1.2' && (await p.$eval('#e-beta', e => e.value)) === '12' && (await txt('e-beta-val')) === '1.2');
    check('readout: Gibbs at beta 1.2 with the THRML sample count', (await txt('r-sampler')).includes('β = 1.2') && (await txt('r-shots')).startsWith(t12.n.toLocaleString('en-US')), await txt('r-shots'));
    check('departure 1 = THRML top pattern at beta 1.2', (await txt('m-up')) === `${upOf(t12.top20[0].b)} / 20` && (await txt('m-p')) === `${(100 * t12.top20[0].p).toFixed(2)}%`);

    // 7. Depart / Hold, the signal, the Gibbs journey and Play Gibbs chain (one shared timer)
    await p.click('#play'); await p.waitForTimeout(2300);
    const s1 = await S();
    check('Depart rides through samples (Hold shown)', (await pressed('#play')) === 'true' && /Hold/.test(await txt('play')) && s1.pat >= 2, s1.pat);
    await p.click('#play'); await p.waitForTimeout(150); const h1 = (await S()).pat; await p.waitForTimeout(1300);
    check('Hold stops the ride', (await pressed('#play')) === 'false' && (await S()).pat === h1);
    await p.click('#cond'); await p.waitForTimeout(300);
    check('tapping the signal departs', (await pressed('#play')) === 'true');
    await p.click('#cond'); await p.waitForTimeout(200);
    check('tapping the signal again holds', (await pressed('#play')) === 'false');
    await p.click('#seg-route [data-r="chain"]'); await p.waitForTimeout(250);
    check('Journey: slider spans the 160-step Gibbs chain', (await p.$eval('#scrub', e => e.max)) === '159' && (await txt('scrub-val')).startsWith('journey sample'));
    await p.click('#e-play'); await p.waitForTimeout(1200);
    const c1 = await S();
    check('Play Gibbs chain runs the chain; Depart shows the same timer', c1.chain && c1.chainIdx > 1 && (await txt('e-play')) === 'Pause' && (await pressed('#play')) === 'true', c1.chainIdx);
    await p.click('#e-play'); await p.waitForTimeout(200);
    check('Pause stops both', (await txt('e-play')) === 'Play Gibbs chain' && (await pressed('#play')) === 'false');
    const ci = (await S()).chainIdx, tb = THRML.circuits.smell.betas['1.2'].trace[ci];
    check('chain lamps are the real THRML chain sample', (await txt('m-up')) === `${upOf(tb)} / 20` && (await txt('m-agree')) === `${agreeOf(tb, 'smell')} / 30` && (await txt('scrub-val')) === `journey sample ${ci + 1} of 160`, [ci, await txt('m-up')]);
    await p.click('#seg-route [data-r="top"]'); await p.waitForTimeout(200);
    check('Timetable returns to the top 20', (await p.$eval('#scrub', e => e.max)) === '19' && !(await S()).chain);

    // 8. stations: tap on the map, arrow keys, a partner row, the bench graph
    await p.click('#seg-circuit [data-c="compass"]'); await p.waitForTimeout(300);
    await clickStation(7);
    check('tap station 7: station card and Neuron card show that real neuron', (await S()).neuron === 7 && (await txt('e-n-title')) === CIRC.compass.neurons[7].instance && (await txt('n-type')) === CIRC.compass.neurons[7].type, await txt('e-n-title'));
    await p.focus('#scene'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
    check('arrow key walks to the next station', (await S()).neuron === 8);
    const syn = CIRC.compass.synapses, strongest = syn.map((r, j) => [j, j === 8 ? -1 : syn[8][j] + syn[j][8]]).sort((a, b) => b[1] - a[1])[0][0];
    await p.click('#n-partners button'); await p.waitForTimeout(300);
    check('first partner row = strongest real partner; tapping it selects that neuron', (await S()).neuron === strongest && (await txt('e-n-title')) === CIRC.compass.neurons[strongest].instance, [strongest, (await S()).neuron]);
    await p.$eval('#scene', e => e.scrollIntoView({ block: 'start' })); await p.waitForTimeout(150);
    const fly0 = await p.evaluate(() => poke);
    const [fx, fy] = await p.evaluate(() => { const r = cv.getBoundingClientRect(); return [r.left + LAY.fly.cx * r.width / LAY.w, r.top + LAY.fly.cy * r.height / LAY.h]; });
    await p.mouse.click(fx, fy); await p.waitForTimeout(100);
    check('tapping the fly on FIG. 1A makes it buzz (decoration)', (await p.evaluate(() => poke)) > fly0);
    const mf0 = await p.evaluate(() => mfPoke);
    await p.click('#moodfly'); await p.waitForTimeout(100);
    check('tapping the status-line fly makes it buzz (decoration)', (await p.evaluate(() => mfPoke)) > mf0);

    // 9. chimes: off until pressed, sound starts, then stops
    const src0 = await p.evaluate(() => __qa.sources);
    await p.click('#chime'); await p.waitForTimeout(900);
    check('Chimes on: Web Audio sound started', (await p.evaluate(() => __qa.sources)) > src0 && (await pressed('#chime')) === 'true' && (await p.evaluate(() => AC.state)) === 'running', await p.evaluate(() => __qa.sources));
    const src1 = await p.evaluate(() => __qa.sources);
    await p.$eval('#scrub', e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(700);
    check('each new sample chimes', (await p.evaluate(() => __qa.sources)) > src1);
    await p.click('#chime'); await p.waitForTimeout(300);
    const src2 = await p.evaluate(() => __qa.sources);
    await p.$eval('#scrub', e => { e.value = '6'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(700);
    check('Chimes off: audio suspended and silent on the next sample', (await txt('chime')) === 'Chimes: off' && (await p.evaluate(() => AC.state)) === 'suspended' && (await p.evaluate(() => __qa.sources)) === src2);

    // 10. Scene / Data: departures board and correlation matrix
    await p.click('#seg-view [data-v="data"]'); await p.waitForTimeout(400);
    check('Data view shows the board and hides the plates', await p.$eval('#dataview', e => !e.hidden) && await p.$eval('#scene', e => e.hidden));
    check('departures board lists the 20 real patterns', (await p.$$eval('#pats .pat', b => b.length)) === 20);
    check('Data view correlation matrix draws', inked(await p.evaluate(INK, 'h')));
    await p.click('#pats .pat:nth-child(2)'); await p.waitForTimeout(250);
    check('board row 02 selects departure 2', (await S()).pat === 1 && (await pressed('#pats .pat:nth-child(2)')) === 'true');
    await p.click('#pats .pat:nth-child(1)'); await p.waitForTimeout(250);
    check('board row 01 works after another row (not a dead control)', (await S()).pat === 0);
    const hb = await p.$eval('#h', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; });
    await p.mouse.move(hb[0] + hb[2] * 5.5 / 20, hb[1] + hb[2] * 2.5 / 20); await p.waitForTimeout(250);
    check('pointing at a cell names the pair and its synapses', /synapses/.test(await txt('heat-stat')) && JSON.stringify(await p.evaluate(() => st.hoverPair)) === '[2,5]', await txt('heat-stat'));
    const hh = await p.$eval('#heat-stat', e => e.offsetHeight);
    await p.mouse.move(5, 5); await p.waitForTimeout(250);
    check('the card keeps its height when the pointer leaves (no jitter)', (await p.$eval('#heat-stat', e => e.offsetHeight)) === hh);
    await p.click('#seg-view [data-v="scene"]'); await p.waitForTimeout(400);
    check('Scene returns the plates', await p.$eval('#scene', e => !e.hidden) && (await S()).view === 'scene' && inked(await p.evaluate(INK, 'scene')));

    // 11. the six sections, their drawers and the earlier words
    for (const id of ['sec-play', 'sec-data', 'sec-made', 'sec-science', 'sec-claims', 'sec-jobs']) {
      await p.click(`[data-go="${id}"]`); await p.waitForTimeout(1800);
      const [top, atEnd] = await p.$eval('#' + id, e => [e.getBoundingClientRect().top, scrollY + innerHeight >= document.documentElement.scrollHeight - 2]);
      check(`section button scrolls to ${id}`, top > -5 && (top < 120 || atEnd), Math.round(top));
    }
    check('six drawers, all open', (await p.$$eval('details.drawer', d => d.length + ':' + d.filter(x => x.open).length)) === '6:6');
    await p.click('details.drawer >> nth=0 >> summary'); await p.waitForTimeout(150);
    const closed = await p.$eval('details.drawer', d => !d.open);
    await p.click('details.drawer >> nth=0 >> summary'); await p.waitForTimeout(150);
    check('a drawer closes and opens', closed && await p.$eval('details.drawer', d => d.open));
    const words = ['Pull 20 spins into line with a fly’s own synapses.', 'Real wiring from the hemibrain connectome sets the couplings of an Ising toy.',
      'Why a fly brain?', 'How synapses become couplings', 'What the quantum engine did', 'What the classical sampler did',
      'The faint thin lines on the graph are real connections that were left out of the model.', 'How to read the plates, the map and the fly',
      'An Ising toy on a connectome graph, not a brain simulation. Spins are not neurons firing.', 'Twenty is the most qubits Atlas graph-v1 accepts.',
      'Results bench', 'Wiring graph', 'Spin patterns', 'Correlations', 'Strongest partners in this circuit'];
    const body2 = await p.$eval('body', b => b.textContent.replace(/\s+/g, ' '));
    const missing = words.filter(w => !body2.includes(w));
    check('earlier words are on the page', missing.length === 0, missing);
    const dq = await txt('d-quantum');
    check('engine drawer names every completed job ID', RUNS.filter(r => r.status === 'completed').every(r => dq.includes(r.job_id)));
    check('engine drawer names every failed ibm_fez job', JOBS.filter(j => j.mode === 'qpu' && j.status !== 'completed').every(j => dq.includes(j.job_id)));

    // 12. the restored graphs draw and respond (Figure 1, 2, 3, Neuron card)
    check('Figure 1 wiring graph draws', inked(await p.evaluate(INK, 'eg')));
    check('Figure 3 correlation matrix draws', inked(await p.evaluate(INK, 'eh')));
    check('Figure 2 lists 20 spin patterns with 20 cells each', (await p.$$eval('#e-pats .epat', b => b.length + ':' + b[0].querySelectorAll('.cells i').length)) === '20:20');
    check('colour scale has 21 swatches', (await p.$$eval('#e-scale i', i => i.length)) === 21);
    await p.$eval('#eh', e => e.scrollIntoView({ block: 'center' }));
    const eb = await p.$eval('#eh', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; });
    const g0 = (await p.evaluate(INK, 'eg')).sig;
    await p.mouse.move(eb[0] + eb[2] * 9.5 / 20, eb[1] + eb[2] * 4.5 / 20); await p.waitForTimeout(250);
    check('Figure 3 hover lights the pair on Figure 1', /synapses/.test(await txt('e-heat-stat')) && (await p.evaluate(INK, 'eg')).sig !== g0, await txt('e-heat-stat'));
    await p.mouse.click(eb[0] + eb[2] * 9.5 / 20, eb[1] + eb[2] * 4.5 / 20); await p.waitForTimeout(300);
    check('Figure 3 click selects the neuron on the metro too', (await S()).neuron === 4 && (await txt('e-n-title')) === CIRC.compass.neurons[4].instance);
    await p.click('#e-next'); await p.waitForTimeout(200);
    check('Pattern → steps Figure 2 and the metro', (await S()).pat === 1 && (await txt('e-m-rank')) === '2 / 20');
    await p.click('#e-prev'); await p.waitForTimeout(200);
    check('← Pattern steps back', (await S()).pat === 0);
    await p.click('#e-pats .epat:nth-child(3)'); await p.waitForTimeout(200);
    check('Figure 2 row selects that pattern', (await S()).pat === 2);
    await p.click('#e-n-partners button'); await p.waitForTimeout(250);
    check('Neuron card partner selects that neuron', (await S()).neuron !== 4);
    await p.$eval('#eg', e => e.scrollIntoView({ block: 'center' }));
    const gb = await p.$eval('#eg', e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; });
    const n2 = CIRC.compass.neurons[2], GX = 500 + n2.x * 1000 * 0.39, GY = 500 + n2.y * 1000 * 0.37 - 30;
    await p.mouse.click(gb[0] + GX * gb[2] / 1000, gb[1] + GY * gb[2] / 1000); await p.waitForTimeout(250);
    check('Figure 1 node click selects that neuron', (await S()).neuron === 2);

    // 13. jobs and credits: every ledgered job, totals, Ride this run
    const rows = await p.$$eval('#jobs tr', t => t.map(r => r.innerText));
    const ids = JOBS.map(j => j.job_id);
    check('jobs table lists every job in out/atlas_jobs.json', ids.every(id => rows.some(r => r.includes(id))) && rows.length === ids.length + 2, rows.length);
    check('every listed job is in the credit ledger; completed ones are cached', ids.every(id => ledger.some(l => l.job_id === id)) && JOBS.filter(j => j.status === 'completed').every(j => cacheIds.has(j.job_id)));
    const credits = JOBS.reduce((a, j) => a + j.credits_ledgered, 0);
    check('credit total matches the ledger and piece.json', rows[rows.length - 1].includes(`${credits} of ${CAP}`) && credits === PIECE.credits_spent && credits === ledger.reduce((a, l) => a + l.credits, 0), rows[rows.length - 1]);
    check('completed jobs = piece.json jobs', JOBS.filter(j => j.status === 'completed').length === PIECE.jobs);
    await p.click('[data-ride="memory"]'); await p.waitForTimeout(900);
    const sr = await S();
    check('"Ride this run" puts the memory run on the metro', sr.circuit === 'memory' && sr.sampler === 'emu' && (await txt('r-job')) === run('memory', 'emu').job_id);

    // 14. share a ticket, reload with the hash, the view comes back
    await p.click('#seg-sampler [data-s="exact"]'); await p.waitForTimeout(200);
    await p.$eval('#scrub', e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await p.waitForTimeout(200);
    await clickStation(5);
    await p.click('#share'); await p.waitForTimeout(300);
    const hash = await p.evaluate(() => location.hash);
    check('ticket writes the view into the URL hash', hash === '#c.memory.s.exact.b.7.p.3.n.5', hash);
    check('hash uses only letters, digits and . _ ~ -', /^#[A-Za-z0-9._~-]+$/.test(hash));
    let clip = ''; try { clip = await p.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = ''; }
    check('ticket copied to the clipboard (or the toast says so)', clip.endsWith(hash) || /Copy blocked/.test(await txt('toast')), clip);
    await p.click('#e-share'); await p.waitForTimeout(200);
    check('Copy link to this view writes the same hash', (await p.evaluate(() => location.hash)) === hash);
    const p2 = await ctx.newPage(); await p2.addInitScript(INSTRUMENT);
    await p2.goto(base + hash, { waitUntil: 'networkidle' }); await p2.waitForTimeout(600);
    const s2 = await p2.evaluate(() => ({ circuit: st.circuit, sampler: st.sampler, pat: st.pat, neuron: st.neuron }));
    check('reload with the hash restores network, train, departure and station', JSON.stringify(s2) === JSON.stringify({ circuit: 'memory', sampler: 'exact', pat: 3, neuron: 5 }), s2);
    check('restored view shows it (buttons, slider, both cards)', (await p2.$eval('#seg-circuit [data-c="memory"]', e => e.getAttribute('aria-pressed'))) === 'true'
      && (await p2.$eval('#scrub-val', e => e.textContent)).startsWith('departure 4 of 20') && (await p2.$eval('#e-n-title', e => e.textContent)) === CIRC.memory.neurons[5].instance);
    await p2.goto(base + '#c.smell.s.gibbs.b.12.p.2.n.0', { waitUntil: 'networkidle' }); await p2.reload({ waitUntil: 'networkidle' }); await p2.waitForTimeout(400);
    check('a Gibbs ticket restores beta too', (await p2.$eval('#beta-val', e => e.textContent)) === '1.2' && (await p2.$eval('#e-seg-circuit [data-c="smell"]', e => e.getAttribute('aria-pressed'))) === 'true');
    await p2.close();

    // 15. connected to the set: prev / hub / next, the jump list, the footer
    const nav = await p.$eval('nav.wtnr-nav', n => ({ prev: n.querySelector('[rel=prev]').href, next: n.querySelector('[rel=next]').href, hub: n.querySelector('.wn-hub').href,
      items: n.querySelectorAll('ol li').length, cur: (n.querySelector('[aria-current=page]') || {}).textContent || '' }));
    check('nav prev = previous piece', nav.prev === URLS[slugs[me - 1]], nav.prev);
    check('nav next = next piece', nav.next === URLS[slugs[me + 1]], nav.next);
    check('nav hub link', nav.hub === HUB);
    check('jump list has every piece and marks this one', nav.items === Object.keys(URLS).length && nav.cur.includes(PIECE.title), nav);
    check('footer disclaimer present', /independent entry to Moth Hack 2026/.test(await p.$eval('.wtnr-foot', e => e.textContent)));

    // 16. phone width: no horizontal scroll in Scene or Data view
    const m = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await m.newPage();
    await mp.goto(base, { waitUntil: 'networkidle' }); await mp.waitForTimeout(500);
    const ovS = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await mp.click('#seg-view [data-v="data"]'); await mp.waitForTimeout(300);
    const ovD = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('no horizontal scroll at 375 px (Scene and Data)', ovS <= 1 && ovD <= 1, { ovS, ovD });
    await m.close();
  } catch (e) {
    check('journey ran without throwing', false, String(e.message || e).slice(0, 400));
  }

  check('no page or console errors', errors.length === 0, errors.slice(0, 5));
  check('no failed requests', failed.length === 0, failed.slice(0, 5));
  check('only Google Fonts hosts contacted', [...external].every(h => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h)), [...external]);

  const out = { piece: '14-hemibrain-ising', ok: fails.length === 0, passed: steps.filter(s => s.ok).length, total: steps.length, fails, steps };
  fs.writeFileSync(path.join(piece, 'qa', 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ok: out.ok, passed: out.passed, total: out.total, fails }, null, 1));
  await browser.close(); server.close();
  process.exit(out.ok ? 0 : 1);
})();
