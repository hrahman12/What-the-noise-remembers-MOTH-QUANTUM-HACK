// End-to-end journey for p-bit or qubit? (Sauna vs Fridge): node entries/08-pbit-or-qubit/qa/e2e.cjs [port 6210-6219]
// Serves web/ locally, opens the built page in headless Chromium and walks the main journey with real assertions:
// load (nothing sounds, the proof chips match piece.json and PARAMS.md), the titled sections and every restored graph
// (edge correlations, magnetisation, both mutual-information maps, the stat tiles, the 16-tile classic board, the
// engravings), reading the charts by pointer and by keyboard, Press start (sound starts), the magnet board, tape and
// transport, a call and its reveal (every job ID shown is in PARAMS.md and in cache/graph-v1), sound off (playing
// sounds stop, new calls stay silent) and back on, pause, the clock, a whole game down the fridge to the boss round on
// real ibm_fez shots and the final card, the boss's lock on every picker, the one-problem-for-the-page wiring (dial,
// graph buttons, The data, the classic board, Jobs "Show"), the classic board (pin a tile, guess, score, reset), the
// already-selected options (confirmed live by picking another option first), every drawer, Copy link and a reload
// with the hash (state restored), the hand-copy fallback when the clipboard is blocked, the prev / hub / next
// navigation, the jobs table against PARAMS.md and the cache, reduced motion, the 375 px layout, and the web app's
// front end (app/public, served by app/server.js with live runs switched off: no Atlas call is possible).
// Writes qa/e2e.json and exits 1 on the first failed assertion.
'use strict';
process.env.ALLOW_LIVE = '0';   // the web app's server, required below, must never submit a job from a test
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6210), appPort = port + 1;
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8');
const readme = fs.readFileSync(path.join(PIECE, 'README.md'), 'utf8');
// PARAMS.md: completed jobs | graph | J | edges | where | backend | `job_id` | `ibm` or - | ..., then the cancelled ones
const done = [...params.matchAll(/^\| (ring|ladder|random) \| ([0-9.]+) \| \d+ \| (emulator|hardware) \| (\w+) \| `([0-9a-f-]{36})` \| (?:`(\w+)`|-) \|/gm)]
  .map(m => ({ graph: m[1], J: +m[2], where: m[3], backend: m[4], id: m[5], ibm: m[6] }));
const cancelled = [...params.matchAll(/^\| (ring|ladder|random) \| ([0-9.]+) \| qpu \| `([0-9a-f-]{36})` \|/gm)].map(m => m[3]);
// every job ID in the engine's cache of completed jobs (and the IBM job IDs those results carry)
const cache = [];
for (const f of fs.readdirSync(path.join(ROOT, 'cache', 'graph-v1'))) if (f.endsWith('.json')) cache.push(fs.readFileSync(path.join(ROOT, 'cache', 'graph-v1', f), 'utf8'));
const inCache = id => cache.some(t => t.includes(id));
const ledger = fs.readFileSync(path.join(ROOT, 'cache', 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(x => x.piece === piece.slug);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
// count every sound source started, and how many are still sounding
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, active: 0, ac: null };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { const c = new AC(...a); window.__qa.ctx++; window.__qa.ac = c; return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
    for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      if (!Object.prototype.hasOwnProperty.call(P, 'start')) continue;
      const st = P.start;
      P.start = function (...a) { window.__qa.sources++; window.__qa.active++; this.addEventListener('ended', () => window.__qa.active--); return st.apply(this, a); };
    }
  }
};

const steps = [];
const step = (name, detail) => { steps.push(detail ? name + ': ' + detail : name); console.log('ok  ' + name + (detail ? ' (' + detail + ')' : '')); };
const base = `http://127.0.0.1:${port}/index.html`;

(async () => {
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  const appSrv = require(path.join(PIECE, 'app', 'server.js'));
  await new Promise(r => appSrv.listen(appPort, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(opts = {}, hash = '', url = base) {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
    await page.addInitScript(INSTRUMENT);
    if (opts.blockClipboard) await page.addInitScript(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
    await page.goto(url + hash, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  const txt = (page, sel) => page.locator(sel).first().evaluate(e => e.textContent);   // textContent: CSS uppercases some labels
  const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0; }, sel);
  const qa = page => page.evaluate(() => ({ sources: window.__qa.sources, active: window.__qa.active, ctx: window.__qa.ctx, state: window.__qa.ac && window.__qa.ac.state }));
  const inked = (page, id) => page.evaluate(i => { const c = document.getElementById(i), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 120 && d[k + 3] > 0) n++; return n; }, id);
  const canvasSig = (page, id) => page.evaluate(i => document.getElementById(i).toDataURL().length + ':' + document.getElementById(i).toDataURL().slice(-80), id);
  const tilesSig = page => page.$$eval('#tiles canvas', cs => cs.map(c => c.toDataURL().slice(-40)).join('|'));
  const segBtn = (id, v) => `#${id} button[data-v="${v}"]`;
  const pressed = (page, id, v) => page.getAttribute(segBtn(id, v), 'aria-pressed');
  const jobIdsIn = s => [...s.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)].map(m => m[0]);

  try {
    // ---- 0. the data behind the page agrees with itself ----
    assert.strictEqual(done.length, piece.jobs, `PARAMS.md lists ${done.length} completed jobs, piece.json says ${piece.jobs}`);
    assert.strictEqual(cancelled.length, 4, 'PARAMS.md cancelled jobs');
    for (const j of done) assert(inCache(j.id), 'job not in cache/graph-v1: ' + j.id);
    for (const j of done.filter(j => j.ibm)) assert(inCache(j.ibm) && readme.includes(j.ibm), 'IBM job not in the cache or README: ' + j.ibm);
    assert.strictEqual(ledger.length, done.length + cancelled.length, 'ledgered submissions');
    assert.strictEqual(ledger.reduce((a, x) => a + x.credits, 0), piece.credits_spent, 'ledgered credits vs piece.json');
    for (const id of [...done.map(j => j.id), ...cancelled]) assert(ledger.some(x => x.job_id === id), 'job not in the ledger: ' + id);
    assert(done.every(j => (j.where === 'hardware') === (j.backend === piece.hardware)), 'hardware rows name ' + piece.hardware);
    for (const d of piece.deliverables) assert(fs.existsSync(path.join(PIECE, d)), 'missing deliverable ' + d);
    const files = JSON.parse(fs.readFileSync(path.join(WEB, 'files.json'), 'utf8'));
    for (const [k, v] of Object.entries(files)) assert(fs.existsSync(path.join(ROOT, v)) && fs.existsSync(path.join(WEB, k)), 'files.json entry missing: ' + k);
    const nHW = done.filter(j => j.where === 'hardware').length;
    step('data consistency', `${done.length} completed jobs (${nHW} on ${piece.hardware}) and ${cancelled.length} cancelled, all in the ledger (${piece.credits_spent} credits); completed ones in cache/graph-v1; deliverables and files.json present`);

    // ---- 1. load: the versus card, nothing sounds, honest numbers ----
    let { ctx, page } = await open();
    assert.strictEqual(await page.title(), 'Sauna vs Fridge');
    assert(await vis(page, '#vs') && !(await vis(page, '#play')), 'the versus card is not the first view');
    let a = await qa(page);
    assert.strictEqual(a.sources, 0, 'sound before any click'); assert.strictEqual(a.ctx, 0, 'an AudioContext before any click');
    assert.strictEqual(await page.getAttribute('.wtnr-bar a', 'href'), HUB, 'brand bar does not link the hub');
    assert.strictEqual((await txt(page, '.wtnr-bar .count')).replace(/\s+/g, ' ').trim(), 'Challenge 08 ' + String.fromCharCode(183) + ' Lose');
    assert(!/main entry|bonus \u00b7|\/ 11/i.test(await page.evaluate(() => document.body.innerText)), 'ranking words on the page');
    const proof = await txt(page, '#proof');
    for (const s of [`${piece.qubits} qubits per job`, `${piece.jobs} real Atlas jobs`, `${nHW} on ${piece.hardware}`, `${piece.jobs - nHW} on the emulator`]) assert(proof.includes(s), 'proof chips: ' + s + ' in ' + proof);
    assert(/graph-v1, 20 qubits/.test(await txt(page, '#r-qubit')), 'readout qubits');
    step('load', 'versus card first, silent, brand bar to the hub, proof chips = piece.json / PARAMS.md');

    // ---- 2. the titled sections and every restored graph ----
    const SECTIONS = [['how-to-play', 'How to play'], ['data', 'The data'], ['classic', 'The classic board'], ['cards-sec', 'Lab cards'], ['made', 'How it was made'], ['science', 'The science'], ['claims', 'What this does not claim'], ['jobs', 'Jobs and credits']];
    const order = await page.evaluate(() => [...document.querySelectorAll('section.sec')].map(s => s.id));
    assert.deepStrictEqual(order, SECTIONS.map(x => x[0]), 'section order: ' + order);
    for (const [id, h] of SECTIONS) assert(await vis(page, '#' + id) && (await txt(page, `#${id} .ink-bar h2`)) === h, 'section ' + h);
    for (const [id, h] of SECTIONS) { await page.click(`.toc a[href="#${id}"]`); await page.waitForTimeout(150); assert(await page.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }, id), 'toc link ' + h); }
    assert(await inked(page, 'c-edge') > 50 && await inked(page, 'c-mag') > 50 && await inked(page, 'c-mi-p') > 200 && await inked(page, 'c-mi-q') > 200, 'a fingerprint chart is blank');
    assert.strictEqual(await page.$$eval('#fstats .stat', e => e.length), 5, 'stat tiles');
    assert((await txt(page, '#why')).length > 200, 'the why box');
    assert(/darkest = [\d.]+ bits/.test(await txt(page, '#mi-cap')), 'MI caption scale');
    assert.strictEqual(await page.$$eval('#tiles .tile', e => e.length), 16);
    assert(await page.$$eval('#tiles canvas', cs => cs.every(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let k = 0; k < d.length; k += 4) if (d[k] < 120) return true; return false; })), 'a classic tile is blank');
    assert.strictEqual(await page.$$eval('.eng', e => e.length), 6, 'engravings');
    assert(await page.$$eval('#vs .eng text', e => e.some(t => /MgO/.test(t.textContent)) && e.some(t => /mix\. chamber/.test(t.textContent))), 'engraving labels');
    assert.strictEqual(await page.$$eval('#cards .lcard', e => e.length), 10, 'lab cards');
    step('sections and graphs', '8 titled sections in order, toc links scroll to each; edge, magnetisation and both MI charts drawn; 5 stat tiles; 16 tiles; 6 engravings; 10 lab cards');

    // ---- 3. reading the charts (pointer, tap, keyboard) ----
    await page.locator('#c-edge').scrollIntoViewIfNeeded();
    const before = await canvasSig(page, 'c-edge');
    let box = await page.locator('#c-edge').boundingBox();
    await page.mouse.click(box.x + 28 + (box.width - 34) * 2.5 / 28, box.y + box.height / 2);   // the default problem (ladder) has 28 edges
    let ins = await page.evaluate(() => ({ k: INS.edge, F: FPL && { p: FPL.zzP[INS.edge], q: FPL.zzQ[INS.edge], x: FPL.zzX[INS.edge], e: FPL.g.edges[INS.edge] } }));
    assert.strictEqual(ins.k, 2, 'tap picked edge ' + ins.k);
    let it = await txt(page, '#i-edge');
    assert(it.startsWith('Edge 3 of 28, spins ' + ins.F.e[0]) && it.includes(Math.abs(ins.F.q).toFixed(2)) && it.includes(Math.abs(ins.F.x).toFixed(2)), 'edge readout: ' + it);
    assert.notStrictEqual(await canvasSig(page, 'c-edge'), before, 'the inspected edge is not highlighted');
    await page.focus('#c-edge'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    assert.strictEqual(await page.evaluate(() => INS.edge), 4); assert((await txt(page, '#i-edge')).startsWith('Edge 5 of 28'));
    await page.click('#t-tomo'); await page.waitForTimeout(100);
    assert((await txt(page, '#i-edge')).includes('graph-v1 tomography') && await vis(page, '#lg-tomo'), 'tomography tick box');
    await page.click('#t-tomo');
    box = await page.locator('#c-mag').boundingBox();
    await page.mouse.click(box.x + 34 + (box.width - 40) * 20.5 / 21, box.y + box.height / 2);
    assert((await txt(page, '#i-mag')).startsWith('Magnetisation +20 (20 of 20 spins up)'), await txt(page, '#i-mag'));
    box = await page.locator('#c-mi-q').boundingBox();
    await page.mouse.click(box.x + box.width * 3.5 / 20, box.y + box.height * 5.5 / 20);
    it = await txt(page, '#i-mi');
    assert(/^Qubit map\. Spins 5 and 3 \((a coupled pair|not coupled)\): qubits . ibm_fez [\d.]+ bits . p-bits [\d.]+ bits$/.test(it), 'MI readout: ' + it);
    const miVals = await page.evaluate(() => [FPL.miQ[5 * 20 + 3].toFixed(3), FPL.miP[5 * 20 + 3].toFixed(3)]);
    assert(it.includes(miVals[0] + ' bits') && it.includes(miVals[1] + ' bits'), 'MI readout values');
    await page.focus('#c-mi-p'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
    assert.deepStrictEqual(await page.evaluate(() => INS.mi), [6, 4, 'p']);
    assert((await txt(page, '#i-mi')).startsWith('p-bit map. Spins 6 and 4'), 'the readout names the map you are reading');
    await page.keyboard.press('Escape');
    assert(await page.evaluate(() => INS.mi === null) && (await txt(page, '#i-mi')).startsWith('Point at or tap a cell'));
    step('chart readouts', 'tap an edge / bar / cell, arrow keys step, Esc clears; readouts quote the drawn numbers; tomography tick adds its value');

    // ---- 4. press start: the game and its sound ----
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#b-start'); await page.waitForTimeout(400);
    a = await qa(page);
    assert(a.sources > 0 && a.state === 'running', 'Press start made no sound: ' + JSON.stringify(a));
    assert(await vis(page, '#play') && !(await vis(page, '#vs')), 'start did not open the game');
    assert(/Stage 1/.test(await txt(page, '#hud-stage')) && /Atlas emulator/.test(await txt(page, '#srcchip')));
    assert.strictEqual(await page.$$eval('#board .mg', e => e.length), 20, 'magnets');
    assert(await page.evaluate(() => { const s = GM.round.samples[PB.k]; return [...document.querySelectorAll('#board .mg')].every((m, i) => m.classList.contains('dn') === (s[i] < 0)); }), 'magnets do not match the sample');
    assert(await inked(page, 'tape') > 100, 'the tape is blank');
    assert(await page.evaluate(() => GM.cards.has('mtj')), 'first lab card');
    step('Press start', `sound started (${a.sources} sources, AudioContext ${a.state}); 20 magnets match the real sample; tape drawn`);

    // transport: stop, step, back, tap the tape
    if (await page.evaluate(() => PB.on)) await page.click('#b-play');
    assert.strictEqual(await txt(page, '#b-play'), 'Play batch');
    await page.evaluate(() => showSample(5, false));
    await page.click('#b-step'); assert.strictEqual(await page.evaluate(() => PB.k), 6);
    await page.click('#b-prev'); assert.strictEqual(await page.evaluate(() => PB.k), 5);
    box = await page.locator('#tape').boundingBox();
    await page.mouse.click(box.x + box.width * 11.5 / 16, box.y + box.height / 2);
    assert.strictEqual(await page.evaluate(() => PB.k), 11); assert((await txt(page, '#board-cap')).includes('12'));
    await page.click('#b-play'); assert.strictEqual(await txt(page, '#b-play'), 'Stop');
    step('transport', 'Play batch / Stop, step forward and back, tap a tape column: the board follows');

    // a call and its reveal
    const s1 = parseFloat(await txt(page, '#secs')); await page.waitForTimeout(800);
    assert(parseFloat(await txt(page, '#secs')) < s1, 'the clock does not count down');
    assert(/hidden/.test(await txt(page, '#r-batch')));
    await page.keyboard.press('s'); await page.waitForTimeout(300);
    assert(/These were from/.test(await txt(page, '#verdict')) && await vis(page, '#stamp') && await vis(page, '#b-next'));
    assert.strictEqual(await txt(page, '#m-count'), (await page.evaluate(() => GM.calls[0].ok ? 1 : 0)) + ' of 1 right');
    const shown = new Set();
    const noteBatch = async () => jobIdsIn(await txt(page, '#r-batch')).forEach(id => shown.add(id));
    await noteBatch();
    step('a call', 'S calls the sauna; the stamp, verdict, chance meter and the envelope\'s source appear');

    // sound off stops what is playing and keeps the next calls silent; on again plays
    await page.keyboard.press('n'); await page.waitForTimeout(150);
    await page.keyboard.press('f'); await page.waitForTimeout(350);   // the reveal's sizzle or chime lasts about a second
    await noteBatch();
    a = await qa(page);
    assert(a.active > 0, 'nothing sounding before Sound: off');
    await page.click('#b-sound'); await page.waitForTimeout(200);
    const off = await qa(page);
    assert.strictEqual(off.active, 0, 'sounds still playing after Sound: off');
    assert.strictEqual(await page.getAttribute('#b-sound', 'aria-pressed'), 'false'); assert.strictEqual(await txt(page, '#b-sound'), 'Sound: off');
    assert.strictEqual(await txt(page, '#b-sound0'), 'Sound: off', 'the two sound buttons disagree');
    await page.keyboard.press('n'); await page.waitForTimeout(150); await page.keyboard.press('s'); await page.waitForTimeout(400); await noteBatch();
    assert.strictEqual((await qa(page)).sources, off.sources, 'a sound started while the sound was off');
    await page.click('#b-sound'); await page.waitForTimeout(150);
    assert((await qa(page)).sources > off.sources, 'Sound: on is silent');
    step('sound', `playing sounds stopped by Sound: off (${a.active} -> 0), calls silent while off, Sound: on plays again`);

    // pause, then a time-out
    await page.keyboard.press('n'); await page.waitForTimeout(150);
    await page.click('#b-pause');
    assert(/paused/.test(await txt(page, '#secs')) && await page.$eval('#b-pbit', b => b.disabled), 'pause');
    await page.keyboard.press('s'); assert.strictEqual(await page.evaluate(() => GM.phase), 'guess', 'a call went through while paused');
    await page.click('#b-pause'); assert(!(await page.$eval('#b-pbit', b => b.disabled)), 'resume');
    const nCalls = await page.evaluate(() => GM.calls.length);
    await page.evaluate(() => { GM.left = 0.05; GM.graceUntil = 0; }); await page.waitForTimeout(400);
    assert(await page.evaluate(() => GM.phase === 'reveal' && GM.round.guessed === 'timeout'), 'time-out');
    assert.strictEqual(await page.evaluate(() => GM.calls.length), nCalls, 'a time-out was counted as a call');
    await noteBatch();
    step('pause and clock', 'Pause locks the calls, Resume frees them; the clock running out ends the envelope and is not a call');

    // play the whole game: every plate, the boss on real ibm_fez shots, the final card
    async function playStage() {
      for (let k = 0; k < 9; k++) {
        const ph = await page.evaluate(() => GM.phase);
        if (ph === 'over' || ph === 'intro' || await vis(page, '#ovl')) break;
        if (ph === 'guess') await page.keyboard.press(Math.random() < .5 ? 's' : 'f');
        await page.waitForTimeout(110); await noteBatch();
        if (await page.evaluate(() => GM.phase) === 'reveal') await page.keyboard.press('n');
        await page.waitForTimeout(110);
      }
    }
    await playStage();
    assert(await vis(page, '#ovl') && /Stage (clear|failed)/.test(await txt(page, '#ovl')) && /standard errors/.test(await txt(page, '#ovl')), 'stage result card');
    for (let s = 1; s <= 4; s++) {
      const btn = (await page.$('#o-down')) || (await page.$('#o-skip'));
      await btn.click(); await page.waitForTimeout(250);
      if (s < 4) { assert(new RegExp(['', '4 K plate', 'Still', 'Cold plate'][s]).test(await txt(page, '#hud-stage')), 'stage ' + (s + 1)); await playStage(); }
    }
    assert(/Mixing chamber/.test(await txt(page, '#hud-stage')) && /Boss: ibm_fez/.test(await txt(page, '#ovl')) && await page.evaluate(() => GM.phase === 'intro'), 'boss card');
    await page.click('#o-fight'); await page.waitForTimeout(300);
    assert(await page.evaluate(() => GM.phase === 'guess' && GM.round.src === 'qpu'), 'the boss deals real ibm_fez envelopes');
    assert(await page.$eval('#j-dial', b => b.disabled) && await vis(page, '#lockline') && await vis(page, '#lock-d') && await vis(page, '#lock-c'), 'boss lock lines');
    assert(await page.$$eval('#g-graph button, #d-graph button, #cl-graph button, #d-J button, #cl-J button', e => e.filter(b => b.getAttribute('aria-pressed') !== 'true').every(b => b.disabled)), 'a picker is open during the boss round');
    assert(await page.$$eval('.jobshow', e => e.every(b => b.disabled)), 'Jobs "Show" is open during the boss round');
    // one fridge envelope of the boss, to see the hardware label and its job ID
    await page.evaluate(() => { const c = cfg(), d = drawBatch(c, 'qpu', 'qubit'); Object.assign(GM.round, {truth: 'qubit', samples: d.samples, info: d.info}); showSample(0, false); });
    await page.keyboard.press('f'); await page.waitForTimeout(300); await noteBatch();
    assert(/ibm_fez/.test(await txt(page, '#st-small')) && /real ibm_fez shots/.test(await txt(page, '#verdict')) && /real IBM hardware/.test(await txt(page, '#r-batch')), 'hardware label');
    await page.keyboard.press('n'); await page.waitForTimeout(150);
    await playStage();
    const fin = await txt(page, '#ovl');
    assert(/Boss down|The boss holds/.test(fin) && /Final score/.test(fin) && /p = /.test(fin), 'final card');
    assert(await page.evaluate(() => GM.cards.has('fez') && GM.cards.has('mxc')), 'lab cards on the way down');
    assert(/of 10 unlocked/.test(await txt(page, '#cards-count')) && await page.$$eval('#cards .lcard:not(.locked)', e => e.length) >= 3, 'unlocked lab cards are shown');
    for (const id of shown) assert(done.some(j => j.id === id) && inCache(id), 'a shown job ID is not in PARAMS.md / the cache: ' + id);
    assert([...shown].some(id => done.find(j => j.id === id).where === 'hardware'), 'no hardware job was revealed');
    step('whole game', `5 plates to the final card (${fin.match(/Final score [\d,]+/)[0]}); boss locks every picker; ${shown.size} job IDs revealed, all in PARAMS.md and cache/graph-v1`);
    await page.screenshot({ path: path.join(PIECE, 'qa', 'e2e-final.png') });
    await page.click('#o-data'); await page.waitForTimeout(800);
    assert(await page.evaluate(() => { const r = document.getElementById('data').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'Open the data');
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#o-again'); await page.waitForTimeout(250);
    assert(await page.evaluate(() => GM.mode === 'play' && GM.stage === 0 && GM.score === 0), 'Play again');
    step('final card buttons', 'Open the data scrolls to the charts; Play again restarts at the 50 K plate');

    // ---- 5. one problem for the whole page ----
    await page.click(segBtn('g-graph', 'ring')); await page.waitForTimeout(200);
    assert(await page.evaluate(() => st.graph === 'ring' && GM.round.graph === 'ring' && CL.round.graph === 'ring') && /ring/.test(await txt(page, '#fp-title')) && /^ring/.test(await txt(page, '#r-prob')), 'arena graph button');
    const J0 = await page.evaluate(() => st.J);
    await page.click('#j-dial'); await page.waitForTimeout(200);
    const J1 = await page.evaluate(() => st.J);
    assert(J1 !== J0 && (await txt(page, '#j-val')) === 'J = ' + J1.toFixed(1) && (await txt(page, '#fp-title')).includes('J = ' + J1.toFixed(1)) && await page.evaluate(J => GM.round.J === J && CL.round.J === J, J1), 'the J dial');
    await page.click(segBtn('d-graph', 'random')); await page.waitForTimeout(200);
    assert(await page.evaluate(() => st.graph === 'random' && GM.round.graph === 'random' && CL.round.graph === 'random') && (await pressed(page, 'g-graph', 'random')) === 'true' && (await pressed(page, 'cl-graph', 'random')) === 'true', 'The data graph picker');
    await page.click(segBtn('cl-J', '1')); await page.waitForTimeout(200);
    assert(await page.evaluate(() => st.J === 1 && GM.round.J === 1) && (await txt(page, '#j-val')) === 'J = 1.0' && (await pressed(page, 'd-J', '1')) === 'true', 'classic J picker');
    assert.strictEqual(await page.getAttribute(segBtn('g-src', 'qpu'), 'disabled'), '', 'no hardware for spin glass J 0.4: its ibm_fez option should be off');
    await page.click('.jobshow[data-g="ladder"][data-j="1"][data-m="qpu"]'); await page.waitForTimeout(800);
    assert(await page.evaluate(() => st.graph === 'ladder' && st.J === 1 && st.src === 'qpu' && CL.round.src === 'qpu') && (await page.getAttribute('.jobshow[data-g="ladder"][data-j="1"][data-m="qpu"]', 'aria-pressed')) === 'true', 'Jobs Show');
    assert((await txt(page, '.qname')).includes('ibm_fez') && (await txt(page, '#fp-title')).includes('ladder, J = 1.0'), 'Show updates The data');
    step('one problem', 'arena graph buttons, J dial, The data and classic pickers and Jobs "Show" all move the boards, readouts and charts together');

    // ---- 6. the already-selected options really work (pick another first) ----
    let sig = await canvasSig(page, 'c-edge');
    await page.click(segBtn('g-src', 'emu')); await page.waitForTimeout(200);
    const sigEmu = await canvasSig(page, 'c-edge');
    assert(sigEmu !== sig && (await pressed(page, 'cl-src', 'emu')) === 'true', 'Fridge batches: Atlas emulator');
    await page.click(segBtn('cl-src', 'qpu')); await page.waitForTimeout(200);
    assert((await canvasSig(page, 'c-edge')) === sig && (await pressed(page, 'g-src', 'qpu')) === 'true', 'Qubit batches: ibm_fez');
    await page.click(segBtn('cl-src', 'emu')); await page.waitForTimeout(200);
    assert((await canvasSig(page, 'c-edge')) === sigEmu && /Atlas emulator/.test(await txt(page, '.qname')), 'Qubit batches: Atlas emulator after ibm_fez');
    const st20 = await txt(page, '#fstats');
    await page.click(segBtn('g-n', '4096')); await page.waitForTimeout(250);
    const stAll = await txt(page, '#fstats');
    assert(stAll !== st20 && /from 4096 samples/.test(stAll), 'p-bit samples: all');
    await page.click(segBtn('g-n', '20')); await page.waitForTimeout(250);
    assert.strictEqual(await txt(page, '#fstats'), st20, 'p-bit samples: 20 after all');
    const tg = await tilesSig(page);
    await page.click(segBtn('cl-tile', 'bars')); await page.waitForTimeout(150);
    const tb = await tilesSig(page);
    await page.click(segBtn('cl-tile', 'graph')); await page.waitForTimeout(150);
    assert(tb !== tg && (await tilesSig(page)) === tg && (await pressed(page, 'cl-tile', 'graph')) === 'true', 'Tiles show: Graph after Bits');
    step('selected options', 'Atlas emulator / ibm_fez, 20 / all and Graph / Bits each change the page when picked after the other option (the dead-control flags were already-selected options)');

    // ---- 7. the classic board ----
    await page.locator('#classic').scrollIntoViewIfNeeded();
    await page.click('#tiles .tile:nth-child(3)');
    assert(/^Tile 3 \(pinned\): [01]{20} . \d+ bonds? broken$/.test(await txt(page, '#bitline')) && await page.$eval('#tiles .tile:nth-child(3)', f => f.classList.contains('pin')), 'pin a tile: ' + await txt(page, '#bitline'));
    await page.hover('#tiles .tile:nth-child(7)'); assert((await txt(page, '#bitline')).startsWith('Tile 7: '));
    await page.mouse.move(5, 5); await page.waitForTimeout(100); assert((await txt(page, '#bitline')).startsWith('Tile 3 (pinned)'), 'pinned line returns');
    await page.focus('#tiles .tile:nth-child(3)'); await page.keyboard.press('Enter');
    assert(!(await page.$eval('#tiles .tile:nth-child(3)', f => f.classList.contains('pin'))) && /unpinned/.test(await txt(page, '#bitline')), 'Enter unpins');
    await page.click('#cl-qubit'); await page.waitForTimeout(150);
    assert(/These were (p-bits|qubits \()/.test(await txt(page, '#cl-verdict')) && /^[01] \/ 1$/.test(await txt(page, '#sc-num')) && !/hidden/.test(await txt(page, '#cl-batch')), 'classic guess');
    jobIdsIn(await txt(page, '#cl-batch')).forEach(id => assert(done.some(j => j.id === id), 'classic batch job ' + id));
    await page.click('#cl-next'); await page.waitForTimeout(150);
    await page.focus('#cl-pbit'); await page.keyboard.press('p'); await page.waitForTimeout(150);
    assert(/^[012] \/ 2$/.test(await txt(page, '#sc-num')), 'P key guesses');
    await page.keyboard.press('n'); await page.waitForTimeout(150);
    assert(await vis(page, '#cl-pbit'), 'N deals the next batch');
    await page.click('#cl-reset'); await page.waitForTimeout(150);
    assert.strictEqual(await txt(page, '#sc-num'), '0 / 0'); assert.strictEqual(await txt(page, '#toast'), 'Score reset');
    await page.click('#cl-reveal'); await page.waitForTimeout(800);
    assert(await page.evaluate(() => { const r = document.getElementById('data').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'Reveal the fingerprints');
    step('classic board', 'pin / unpin a tile (click, Enter), hover reads bits, guess by click and key, score against a coin, next, reset, reveal scrolls to The data');

    // ---- 8. drawers, lab cards and the reset ----
    const nDrawers = await page.$$eval('details.drawer', e => e.length);
    for (let k = 0; k < nDrawers; k++) {
      const d = page.locator('details.drawer').nth(k);
      await d.locator('summary').scrollIntoViewIfNeeded(); await d.locator('summary').click(); await page.waitForTimeout(100);
      assert(await d.evaluate(e => e.open) && await d.locator('.body').isVisible(), 'drawer ' + k + ' did not open');
    }
    assert(await page.$$eval('#an-mtj svg, #an-dr svg', e => e.length) === 2 && await page.locator('#an-dr svg').isVisible(), 'anatomy drawer drawings');
    await page.locator('details.drawer').first().locator('summary').click();
    assert(!(await page.locator('details.drawer').first().evaluate(e => e.open)), 'a drawer did not close');
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#b-reset'); await page.waitForTimeout(200);
    assert(await vis(page, '#vs') && await page.evaluate(() => GM.mode === 'title'), 'Reset game');
    await page.click('#b-sound0'); assert.strictEqual(await txt(page, '#b-sound'), 'Sound: off', 'title sound button');
    await page.click('#b-sound0');
    await page.click(segBtn('g-timer', 'off')); assert.strictEqual(await txt(page, '#secs'), 'no clock');
    await page.click(segBtn('g-timer', 'on')); assert(/ s$/.test(await txt(page, '#secs')), '15 s clock after No clock');
    step('drawers and reset', `${nDrawers} drawers open and close; Reset game returns to the versus card; the title card's Sound button drives the in-game one; No clock / 15 s clock`);

    // ---- 9. jobs table against PARAMS.md ----
    const pageIds = await page.$$eval('#jobs-t code', e => e.map(c => c.textContent));
    assert.deepStrictEqual(pageIds.filter(x => x.length === 36).sort(), [...done.map(j => j.id), ...cancelled].sort(), 'jobs table vs PARAMS.md');
    assert.deepStrictEqual(pageIds.filter(x => x.length !== 36).sort(), done.filter(j => j.ibm).map(j => j.ibm).sort(), 'IBM job IDs');
    assert(new RegExp(`^${ledger.length} graph-v1 submissions at 5 credits each: ${piece.credits_spent} credits`).test(await txt(page, '#jobs-spend')), 'spend line');
    assert.strictEqual(await txt(page, '#jobs-n'), `${piece.jobs} completed · ${cancelled.length} cancelled`);
    step('jobs table', `${pageIds.length} IDs = PARAMS.md; spend ${piece.credits_spent} credits = ledger`);
    await ctx.close();

    // ---- 10. copy link, reload with the hash ----
    ({ ctx, page } = await open());
    await page.click(segBtn('d-graph', 'ring')); await page.click(segBtn('d-J', '0.4')); await page.click(segBtn('g-src', 'emu')); await page.click(segBtn('cl-tile', 'bars'));
    await page.click('#b-share'); await page.waitForTimeout(300);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    assert.strictEqual(link, base + '#ring.0p4.emu.bars', 'copied link: ' + link);
    assert.strictEqual(await txt(page, '#toast'), 'Link copied');
    await ctx.close();
    ({ ctx, page } = await open({}, '#ring.0p4.emu.bars'));
    assert.deepStrictEqual(await page.evaluate(() => [st.graph, st.J, st.src, st.tile, CL.round.graph, CL.round.J, CL.round.src]), ['ring', 0.4, 'emu', 'bars', 'ring', 0.4, 'emu'], 'state not restored');
    assert((await pressed(page, 'cl-tile', 'bars')) === 'true' && (await pressed(page, 'g-graph', 'ring')) === 'true' && (await pressed(page, 'g-src', 'emu')) === 'true', 'restored pickers');
    assert((await txt(page, '#j-val')) === 'J = 0.4' && (await txt(page, '#fp-title')).includes('ring, J = 0.4') && (await txt(page, '.qname')).includes('Atlas emulator'), 'restored readouts');
    await page.click('#cl-share'); await page.waitForTimeout(200);
    assert.strictEqual(await page.evaluate(() => navigator.clipboard.readText()), base + '#ring.0p4.emu.bars', 'the classic board share button');
    await ctx.close();
    ({ ctx, page } = await open({}, '#nonsense.9p9.x.y'));
    assert.deepStrictEqual(await page.evaluate(() => [st.graph, st.J]), ['ladder', 1], 'a bad hash should fall back to the default view');
    await ctx.close();
    step('share and reload', 'Copy link writes #ring.0p4.emu.bars; reloading it restores graph, J, source and tile style everywhere; a bad hash falls back');

    // ---- 11. clipboard blocked ----
    ({ ctx, page } = await open({ blockClipboard: true }));
    await page.click('#cl-share'); await page.waitForTimeout(300);
    assert(await page.locator('#classic .manual').isVisible() && !(await page.locator('#how-to-play .manual').isVisible()), 'hand-copy fallback');
    assert.strictEqual(await page.locator('#classic .manual-text').inputValue(), base + '#ladder.1p0.qpu.graph');
    assert(await page.evaluate(() => document.activeElement.classList.contains('manual-text')), 'fallback text not focused');
    assert.strictEqual(await txt(page, '#toast'), 'Copy failed: the link is in your address bar, and selected below');
    step('clipboard blocked', 'the link appears selected next to the button that was pressed');
    await ctx.close();

    // ---- 12. navigation to the rest of the set ----
    ({ ctx, page } = await open());
    assert.strictEqual(await page.getAttribute('.wtnr-nav a[rel="prev"]', 'href'), urls['07-flavour']);
    assert.strictEqual(await page.getAttribute('.wtnr-nav a[rel="next"]', 'href'), urls['09-syndrome-loom']);
    assert.strictEqual(await page.getAttribute('.wtnr-nav a.wn-hub', 'href'), HUB);
    assert((await txt(page, '.wtnr-nav a[rel="prev"]')).includes('07') && (await txt(page, '.wtnr-nav a[rel="next"]')).includes('09'));
    await page.locator('.wtnr-nav summary').scrollIntoViewIfNeeded(); await page.click('.wtnr-nav summary');
    const navLinks = await page.$$eval('.wtnr-nav ol a', e => e.map(a => [a.getAttribute('href'), a.getAttribute('aria-current')]));
    assert.strictEqual(navLinks.length, 22);
    const known = new Set([...Object.values(urls), HUB]);
    assert(navLinks.every(([h]) => known.has(h)), 'nav links to an unknown page');
    assert.deepStrictEqual(navLinks.filter(([, c]) => c === 'page').map(([h]) => h), [urls['08-pbit-or-qubit']]);
    assert(await page.evaluate(() => { const n = document.querySelector('.wtnr-nav'), f = document.querySelector('.wtnr-foot'), j = document.getElementById('jobs'); return !!(j.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) && n.nextElementSibling === f && ![...document.querySelectorAll('section')].some(x => n.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING); }), 'nav is not between the last section and the footer');
    step('navigation', 'brand bar and nav reach the hub; prev 07, next 09; the list opens with 22 known pieces and marks this one');
    await ctx.close();

    // ---- 13. reduced motion ----
    ({ ctx, page } = await open({ reducedMotion: 'reduce' }));
    const fl0 = await page.evaluate(() => FL.i); await page.waitForTimeout(1400);
    assert.strictEqual(await page.evaluate(() => FL.i), fl0, 'the free layer animates under reduced motion');
    await page.click('#b-start'); await page.waitForTimeout(200); await page.keyboard.press('s'); await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => FX.parts.length), 0, 'particles under reduced motion');
    assert(await vis(page, '#stamp'), 'the reveal still shows');
    step('reduced motion', 'no idle flips, no particles; the game still plays');
    await ctx.close();

    // ---- 14. phone width ----
    ({ ctx, page } = await open({ viewport: { width: 375, height: 812 } }));
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(await over() <= 0, 'horizontal overflow at 375 px (title)');
    await page.click('#b-start'); await page.waitForTimeout(800);
    assert(await over() <= 0, 'horizontal overflow at 375 px (game)');
    const tops = await page.evaluate(() => ({ jobs: document.getElementById('jobs').getBoundingClientRect().top, nav: document.querySelector('.wtnr-nav').getBoundingClientRect().top, foot: document.querySelector('.wtnr-foot').getBoundingClientRect().top, proof: document.getElementById('proof').getBoundingClientRect().top }));
    assert(tops.jobs < tops.nav && tops.nav < tops.foot && tops.proof < tops.nav, 'phone layout puts the nav out of order: ' + JSON.stringify(tops));
    await page.locator('.wtnr-nav').scrollIntoViewIfNeeded();
    assert(await page.locator('.wtnr-nav a[rel="next"]').isVisible());
    await page.screenshot({ path: path.join(PIECE, 'qa', 'e2e-mobile-nav.png') });
    step('375 px', 'no horizontal scroll; the nav sits after Jobs and credits, above the footer');
    await ctx.close();

    // ---- 15. the web app's front end (app/public via app/server.js, live runs off) ----
    const appUrl = `http://127.0.0.1:${appPort}/`;
    ({ ctx, page } = await open({}, '', appUrl));
    await page.waitForFunction(() => !/Checking/.test(document.getElementById('l-status').textContent), null, { timeout: 5000 });
    assert(await vis(page, '#live') && !(await vis(page, '#d-app')), 'the live panel');
    assert(/Live runs are off: live runs are switched off \(ALLOW_LIVE\)|Live runs are off: no MOTH_API_KEY/.test(await txt(page, '#l-status')) && await page.$eval('#l-run', b => b.disabled), 'live status: ' + await txt(page, '#l-status'));
    await page.click(segBtn('l-graph', 'ladder')); assert.strictEqual(await pressed(page, 'l-graph', 'ladder'), 'true');
    assert(await page.evaluate(() => st.graph === 'ladder' && !!document.querySelector('.wtnr-nav a[rel="next"]')), 'the app page carries the same instrument and nav');
    await page.click('#b-start'); await page.waitForTimeout(300);
    assert((await qa(page)).sources > 0, 'the app page makes no sound');
    const strip = h => h.replace(/<section class="live"[\s\S]*?<\/section>/, '').replace(/\/\/ ---------- live panel[\s\S]*?\}\)\(\);\s*(?=<\/script>)/, '').replace(/const LIVE = (true|false);/, '').replace(/\s+/g, '');
    const appHtml = strip(fs.readFileSync(path.join(PIECE, 'app', 'public', 'index.html'), 'ascii')), webHtml = strip(fs.readFileSync(path.join(WEB, 'index.html'), 'ascii'));
    let at = 0; while (at < appHtml.length && appHtml[at] === webHtml[at]) at++;
    assert(appHtml === webHtml, `app/public/index.html is not web/index.html plus the live panel; first difference: ${JSON.stringify(appHtml.slice(at, at + 80))} vs ${JSON.stringify(webHtml.slice(at, at + 80))}`);
    step('web app front end', 'app/public is the same page plus the live panel; /api/health answers; Run stays off with live runs disabled (no Atlas call)');
    await ctx.close();

    assert.deepStrictEqual(errors, [], 'page errors: ' + errors.join(' | '));
    step('no page errors');
    fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify({ ok: true, steps }, null, 1));
    console.log('E2E OK: ' + steps.length + ' steps');
  } catch (e) {
    fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify({ ok: false, steps, error: String(e.stack || e), errors }, null, 1));
    console.error('E2E FAILED: ' + (e.stack || e));
    if (errors.length) console.error('page errors: ' + errors.join(' | '));
    process.exitCode = 1;
  } finally {
    await browser.close(); srv.close(); appSrv.close();
  }
})();
