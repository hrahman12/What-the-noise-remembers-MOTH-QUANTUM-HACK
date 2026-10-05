// End-to-end journey for 06 Tweezer: node entries/06-tweezer/qa/e2e.cjs [port 6330-6339]
// Serves web/ locally, opens the built page in headless Chromium and walks the main user journey with real assertions:
// load (no autoplay, proof chips = piece.json), walk the lab (Later, station tap, path drag, clock keys, survival curve),
// use the instruments to an outcome checked against the cached job data on the page (comet attempts, qpixl threshold,
// Rydberg patterns), play and stop every kind of sound (MIDI synth, MP3 echo, stage players, the film) with Web Audio /
// media instrumentation, Scene / Data, the science drawers, copy-link + reload-with-hash restore, and the shared
// nav (brand bar to the hub, prev / hub / next, jump list). It checks every chart is drawn (the 18 charts in The data, every stage
// card Data view, the dial and the survival curve; every dial marker and curve point navigates), then sweeps EVERY
// control in EVERY stage card (Scene and Data) and in EVERY chart in The data, and fails if any control changes nothing.
// Data checks: proof chips vs piece.json, every completed job ID on the page exists in cache/<engine>/*.json, failed ones
// in cache/ledger.jsonl, PARAMS.md lists exactly the page's completed jobs. Writes qa/e2e.json; exit code 1 on failure.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6330);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, type = T[path.extname(f).toLowerCase()] || 'application/octet-stream', rg = q.headers.range;
  if (rg) {   // byte ranges, so <video>/<audio> can seek like on the real host
    const m = /bytes=(\d*)-(\d*)/.exec(rg), a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size }); fs.createReadStream(f).pipe(r);
});

// sound instrumentation (as common/qa/qa_page.cjs) + a pausable clock: the sweep freezes performance.now so idle sprite
// loops stop moving and only what a control itself changed shows up in the before / after comparison
const INIT = () => {
  window.__qa = { sources: 0, osc: 0, media: 0, mediaErr: 0 };
  const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
  if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; if (this instanceof OscillatorNode) window.__qa.osc++; return st.apply(this, a); }; }
  document.addEventListener('playing', () => window.__qa.media++, true);
  document.addEventListener('error', e => { if (e.target instanceof HTMLMediaElement) window.__qa.mediaErr++; }, true);
  const real = performance.now.bind(performance); let frz = null, off = 0;
  performance.now = () => frz != null ? frz : real() + off;
  window.__clock = { freeze() { if (frz == null) frz = real() + off; return frz; }, thaw() { if (frz != null) { off = frz - real(); frz = null; } } };
};

const steps = [], fails = [];
function check(name, ok, detail) {
  steps.push({ step: name, ok: !!ok, detail: detail == null ? undefined : String(detail).slice(0, 300) });
  if (!ok) fails.push(name + (detail != null ? ': ' + String(detail).slice(0, 300) : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail != null ? '  [' + String(detail).slice(0, 160) + ']' : ''));
}
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [], external = new Set();
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  await page.addInitScript(INIT);
  const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
  const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));

  try {
    // ------------------------------------------------------------------ 1. load
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(600);
    const q0 = await page.evaluate(() => ({ ...window.__qa }));
    check('load: nothing sounds before a click (no autoplay)', q0.sources === 0 && q0.media === 0, JSON.stringify(q0));
    check('load: title and verb-led hook', (await page.title()) === 'Tweezer' && /^Walk one atom array/.test(await page.textContent('h1')), await page.textContent('h1'));
    const proof = (await page.textContent('#proof')).replace(/\s+/g, ' ');
    check('load: proof chips match piece.json (engines, jobs, hardware qubits, max qubits)',
      proof.includes(`${piece.engines.length} engines completed`) && proof.includes(`${piece.jobs} real Atlas jobs`) &&
      proof.includes(`156 qubits on IBM ${piece.hardware}`) && proof.includes(`up to ${piece.qubits} simulated`), proof);
    check('load: opens on the first stage, Scene view', (await page.textContent('#c-clock')) === '05:00' &&
      (await page.getAttribute('#mode button[data-m="scene"]', 'aria-pressed')) === 'true', await page.textContent('#pos'));
    const CH = await page.evaluate(() => CHAIN.map(s => ({ id: s.id, clock: s.clock, engine: s.engine, completed: !!s.completed, job_id: s.job_id, jobs: s.jobs || null, qubits: s.qubits || null, where: s.where || '',
      attempts: (s.attempts || []).map(t => ({ job_id: t.job_id, size: t.size || null })), small: s.small ? { attempts: (s.small.attempts || []).map(t => ({ job_id: t.job_id })) } : null })));
    const N = CH.length;
    check('load: 18 stations on the lab path, one per stage', N === 18 && (await page.$$('#stns .stn')).length === N, N);

    // ------------------------------------------------------------------ 2. walk the lab
    await page.click('#lab-next'); await page.waitForTimeout(250);
    check('walk: "Later" moves Tweezy to 05:30 (comet)', (await page.textContent('#c-clock')) === '05:30' && (await page.textContent('#pos')).includes('2 / 18') &&
      (await page.textContent('#say')).includes('148-qubit register'), await page.textContent('#say'));
    await page.click('#lab-prev'); await page.waitForTimeout(250);
    check('walk: "Earlier" walks back to 05:00', (await page.textContent('#c-clock')) === '05:00');
    const gi = CH.findIndex(s => s.id === 'graph');
    await page.click(`#stns .stn >> nth=${gi}`); await page.waitForTimeout(250);
    check('walk: tapping the 10:00 station opens graph-v1', (await page.textContent('#c-clock')) === '10:00' &&
      (await page.getAttribute(`#stns .stn >> nth=${gi}`, 'aria-current')) === 'step', await page.textContent('#c-title'));
    // drag along the path from station 0 to station 3: Tweezy walks to the station where the drag ends
    const sb = i => page.locator('#stns .stn').nth(i).boundingBox();
    const b0 = await sb(0), b3 = await sb(3);
    await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2); await page.mouse.down();
    await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
    check('walk: dragging along the path walks Tweezy to the station where you let go', (await page.textContent('#c-clock')) === CH[3].clock, await page.textContent('#c-clock'));
    await page.focus('#clock'); await page.keyboard.press('End'); await page.waitForTimeout(250);
    check('walk: clock dial End key jumps to the last stage (23:00)', (await page.textContent('#c-clock')) === '23:00' && (await page.getAttribute('#clock', 'aria-valuenow')) === '23');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
    check('walk: clock dial Home + ArrowRight = 05:30', (await page.textContent('#c-clock')) === '05:30');
    const clk = await page.locator('#clock').boundingBox();   // the clock's window (right part of the dial) flips day / night
    await page.mouse.click(clk.x + clk.width * 0.8, clk.y + clk.height * 0.5); await page.waitForTimeout(250);
    check('walk: tapping the clock window at 05:30 (night) jumps to the first morning stage (06:00)', (await page.textContent('#c-clock')) === CH.find(s => +s.clock.slice(0, 2) >= 6).clock, await page.textContent('#c-clock'));
    await page.mouse.click(clk.x + clk.width * 0.8, clk.y + clk.height * 0.5); await page.waitForTimeout(250);
    check('walk: tapping it again jumps from day to the first night stage', (await page.textContent('#c-clock')) === CH.find(s => +s.clock.slice(0, 2) >= 19).clock, await page.textContent('#c-clock'));
    const qi = CH.findIndex(s => s.id === 'qpixl');
    await page.click(`#curve g.pt >> nth=${qi}`); await page.waitForTimeout(250);
    check('walk: the survival curve navigates (tap the 08:30 point)', (await page.textContent('#c-clock')) === '08:30');
    const ro = (await page.textContent('#readout')).replace(/\s+/g, ' ');
    check('readout: "What actually ran" names the engine, backend and job ID of the stage', ro.includes('qpixl-v1') && ro.includes(CH[qi].where) && ro.includes(CH[qi].job_id), ro.slice(0, 200));

    // ------------------------------------------------------------------ 3. the instruments, to outcomes checked against the data
    // 08:30 qpixl scene: raise the threshold to its top, tap a truly loaded tweezer: it must be called empty (decoded < 0.98)
    const qd = await page.evaluate(() => { const d = CHAIN.find(s => s.id === 'qpixl').data; return { thr: d.thr, out: d.out, truth: d.truth }; });
    const site = qd.truth.findIndex((t, i) => t === 1 && qd.out[i] < 0.98 && qd.out[i] >= qd.thr);
    const tapSite = async (i, kind) => {
      await page.evaluate(() => SCENE.c.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
      const xy = await page.evaluate(([i, kind]) => {
        const S = SCENE, P = S.P, r = S.c.getBoundingClientRect();
        const [ax, ay] = kind === 'zone' ? [16 + (i % 5) * 24, 44 + Math.floor(i / 5) * 24] : [9 + (i % 12) * 10, 33 + Math.floor(i / 12) * 10];
        return [r.left + (P.ox + ax * P.u) * r.width / S.c.width, r.top + (P.oy + ay * P.u) * r.height / S.c.height];
      }, [i, kind || 'arr']);
      await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(150);
    };
    await page.focus('#view input[type=range]'); await page.keyboard.press('End'); await page.waitForTimeout(150);
    await tapSite(site);
    let lab = (await page.textContent('#view p.note')).replace(/\s+/g, ' ');
    check('qpixl: at threshold 0.98 a truly loaded tweezer is called empty (from the cached decoded counts)',
      lab.includes(`decoded ${qd.out[site].toFixed(2)}`) && lab.includes('called empty') && lab.includes('really loaded'), lab);
    await page.click('#view button:has-text("Reset")'); await page.waitForTimeout(150); await tapSite(site);
    lab = (await page.textContent('#view p.note')).replace(/\s+/g, ' ');
    check('qpixl: Reset restores the chain threshold and the same tweezer is called loaded again',
      +(await page.inputValue('#view input[type=range]')) === qd.thr && lab.includes('called loaded'), lab);
    // the Data view's count of correct calls is recomputed from the data at every threshold
    await page.click('#mode button[data-m="data"]'); await page.waitForTimeout(250);
    check('Scene/Data: Data opens the charts and the hash records it', (await page.getAttribute('#mode button[data-m="data"]', 'aria-pressed')) === 'true' &&
      (await page.evaluate(() => location.hash)) === '#qpixl.data' && (await page.$$('#view canvas')).length === 2, await page.evaluate(() => location.hash));
    for (const key of ['End', 'Home']) {
      await page.focus('#view input[type=range]'); await page.keyboard.press(key); await page.waitForTimeout(150);
      const thr = +(await page.inputValue('#view input[type=range]'));
      const want = qd.out.reduce((a, o, i) => a + (((o >= thr) ? 1 : 0) === qd.truth[i] ? 1 : 0), 0);
      const t = await page.locator('#view p.note', { hasText: 'called correctly' }).textContent();
      check(`qpixl Data: at threshold ${thr.toFixed(2)} the page reports ${want} of 144 correct (recomputed here from the data)`, t.includes(`${want} of 144`), t.slice(0, 120));
    }
    await page.click('#mode button[data-m="scene"]'); await page.waitForTimeout(250);
    check('Scene/Data: Scene returns to the pixel scene', (await page.getAttribute('#mode button[data-m="scene"]', 'aria-pressed')) === 'true' &&
      (await page.evaluate(() => location.hash)) === '#qpixl' && (await page.$$('#view canvas.pix')).length === 1);

    // 05:30 comet: "Load again" moves to the next real attempt; a tapped tweezer reads its real 10,000-shot rate
    await page.click(`#stns .stn >> nth=${CH.findIndex(s => s.id === 'comet')}`); await page.waitForTimeout(250);
    await page.click('#view button:has-text("Load again")'); await page.waitForTimeout(150);
    const cd = await page.evaluate(() => { const d = CHAIN.find(s => s.id === 'comet').data; return { f1: d.frames[1], bias: d.site_bias }; });
    await tapSite(17);
    lab = (await page.textContent('#view p.note')).replace(/\s+/g, ' ');
    check('comet: "Load again" shows attempt 2 and the tapped tweezer matches the hardware bitstring and rate',
      (await page.inputValue('#view input[type=range]')) === '2' && lab.includes('attempt 2') &&
      lab.includes(cd.f1[17] === '1' ? 'loaded' : 'empty') && lab.includes((100 * cd.bias[17]).toFixed(1) + '%'), lab);

    // 10:00 graph: pick pattern 2; the readout states its real frequency over 4096 shots
    await page.click(`#stns .stn >> nth=${gi}`); await page.waitForTimeout(250);
    const gp = await page.evaluate(() => CHAIN.find(s => s.id === 'graph').data.top[1].p);
    await page.click('#view .patterns button >> nth=1'); await page.waitForTimeout(150);
    lab = await page.locator('#view p.note', { hasText: 'Pattern 2' }).textContent();
    check('graph: choosing pattern 2 shows its measured frequency from graph-v1', lab.includes((100 * gp).toFixed(2) + '%') &&
      (await page.getAttribute('#view .patterns button >> nth=1', 'aria-pressed')) === 'true', lab.slice(0, 100));

    // ------------------------------------------------------------------ 4. sound: every kind plays and stops, one at a time
    const qa = () => page.evaluate(() => ({ ...window.__qa }));
    const rows = page.locator('#sounds li');
    const nSounds = await page.evaluate(() => { const r = CHAIN.find(s => s.id === 'retro'); return 4 + (r && r.earlier && r.earlier.media && r.earlier.media.after ? 1 : 0); });
    check(`sounds: all ${nSounds} sound deliverables are listed (the ibm_fez echo and, beside it, the recorded one)`, (await rows.count()) === nSounds &&
      (nSounds === 4 || ((await rows.nth(3).textContent()).includes('echo_out_fez.wav') && (await rows.nth(4).textContent()).includes('recorded'))), await rows.count());
    let a = await qa();
    await rows.nth(0).locator('button').click(); await page.waitForTimeout(700);
    // the first sound creates the AudioContext; give its clock up to 3 s to start before reading the progress hairline
    await page.waitForFunction(() => parseFloat(document.querySelector('#sounds li .bar i').style.width) > 0, null, { timeout: 3000 }).catch(() => {});
    let b = await qa();
    const bar = await rows.nth(0).locator('.bar i').evaluate(e => parseFloat(e.style.width) || 0);
    check('sound: MIDI score (Web Audio synth) starts: oscillators scheduled, button says Stop, progress moves',
      b.osc > a.osc && (await rows.nth(0).locator('button').textContent()).includes('Stop') && bar > 0, `osc ${a.osc}->${b.osc}, bar ${bar}%`);
    a = b;
    await rows.nth(3).locator('button').click(); await page.waitForTimeout(1200);
    b = await qa();
    const wet = await rows.nth(3).locator('audio').evaluate(e => ({ paused: e.paused, t: e.currentTime }));
    check('sound: echoed WAV (MP3) plays, and starting it stopped the MIDI (one sound at a time)',
      b.media > a.media && !wet.paused && wet.t > 0 && (await rows.nth(0).locator('button').textContent()).includes('Play'), JSON.stringify(wet));
    await rows.nth(3).locator('button').click(); await page.waitForTimeout(200);
    const wet2 = await rows.nth(3).locator('audio').evaluate(e => ({ paused: e.paused, t: e.currentTime }));
    check('sound: pressing Stop stops and rewinds it', wet2.paused && wet2.t === 0 && (await rows.nth(3).locator('button').textContent()).includes('Play'), JSON.stringify(wet2));
    if (nSounds === 5) {      // the recorded echo, kept beside the ibm_fez one, plays too
      a = await qa(); await rows.nth(4).locator('button').click(); await page.waitForTimeout(1200); b = await qa();
      const rec = await rows.nth(4).locator('audio').evaluate(e => ({ paused: e.paused, t: e.currentTime }));
      check('sound: the recorded echo (exact Aer run) plays from its own row', b.media > a.media && !rec.paused && rec.t > 0, JSON.stringify(rec));
      await rows.nth(4).locator('button').click(); await page.waitForTimeout(200);
    }
    // the stage's own players: 18:00 echo scene and 16:00 xylophone
    await page.click(`#stns .stn >> nth=${CH.findIndex(s => s.id === 'retro')}`); await page.waitForTimeout(250);
    a = await qa(); await page.click('#view button:has-text("Echoed")'); await page.waitForTimeout(1000); b = await qa();
    check('sound: 18:00 scene "Echoed" plays the engine output', b.media > a.media && (await page.textContent('#view .ctl')).includes('Stop'));
    await page.click(`#stns .stn >> nth=${CH.findIndex(s => s.id === 'blurmidi')}`); await page.waitForTimeout(250);
    const stale = await page.evaluate(() => [...document.querySelectorAll('audio')].filter(e => !e.paused).length);
    check('sound: leaving a stage stops its player', stale === 0, stale);
    a = await qa(); await page.click('#view button:has-text("Play")'); await page.waitForTimeout(600); b = await qa();
    check('sound: 16:00 xylophone plays the blurred score (oscillators)', b.osc > a.osc && (await page.textContent('#view .ctl')).includes('Stop'), `osc +${b.osc - a.osc}`);
    await page.click('#view button:has-text("Stop")'); await page.waitForTimeout(150);
    check('sound: xylophone Stop', (await page.textContent('#view .ctl')).includes('Play'));
    // the film (video with soundtrack): source attaches near the viewport, plays on request, and yields to other sounds
    await page.locator('#film').scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
    const src = await page.getAttribute('#film source', 'src');
    a = await qa();
    await page.evaluate(() => document.getElementById('film').play()); await page.waitForTimeout(1500);
    b = await qa();
    const film = await page.evaluate(() => { const v = document.getElementById('film'); return { paused: v.paused, t: v.currentTime, w: v.videoWidth, d: v.duration, autoplay: v.autoplay }; });
    check('video: tweezer_day.mp4 is attached lazily, decodes and plays (no autoplay attribute)', src === 'video/tweezer_day.mp4' && b.media > a.media && !film.paused && film.t > 0 && film.w > 0 && !film.autoplay, JSON.stringify(film));
    await rows.nth(0).locator('button').click(); await page.waitForTimeout(300);
    check('video: starting a sound pauses the film', await page.evaluate(() => document.getElementById('film').paused));
    await rows.nth(0).locator('button').click(); await page.waitForTimeout(150);

    // ------------------------------------------------------------------ 5. the science drawers
    const drawers = page.locator('details.drawer');
    const nd = await drawers.count();
    for (let i = 0; i < nd; i++) { await drawers.nth(i).locator('summary').click(); await page.waitForTimeout(80); }
    const open = await page.$$eval('details.drawer', ds => ds.map(d => d.open));
    check(`drawers: all ${nd} drawers open`, nd >= 4 && open.every(Boolean), JSON.stringify(open));
    const allRows = await page.$$eval('#jobs tr', trs => trs.slice(1).map(tr => [...tr.children].map(td => td.textContent)));
    const jobRows = allRows.filter(r => !/^(ibm_fez re-run|recorded run|downscaled retry)/.test(r[2]));      // the extra rows: ibm_fez attempts, recorded runs, 08:15 downscaled tries
    check('drawers: "Every engine, every job" lists all 18 stages with their job IDs and the failure tally', jobRows.length === N &&
      jobRows.every((r, i) => r[5] === (CH[i].job_id || '\u2014')) && (await page.textContent('#failnote')).includes(`${piece.jobs} completed and counted`), jobRows.length);
    const smallTries = CH.flatMap(s => ((s.small && s.small.attempts) || []).map(t => t.job_id));
    const smallRows = allRows.filter(r => /^downscaled retry/.test(r[2]));
    check(`drawers: the jobs table has a row for each of the ${smallTries.length} 08:15 downscaled-frame tries, marked not done`,
      smallRows.length === smallTries.length && smallTries.every(j => smallRows.some(r => r[5] === j && /^no:/.test(r[6]))), smallRows.map(r => r[5]).join(', '));
    await drawers.nth(0).locator('summary').click(); await page.waitForTimeout(80);
    check('drawers: a drawer closes again', !(await drawers.nth(0).evaluate(d => d.open)));

    // ------------------------------------------------------------------ 5b. the restored sections, the dial and every chart in The data
    const secs = await page.$$eval('section.sect .ink-bar h2', hs => hs.filter(x => x.getBoundingClientRect().height > 0).map(x => x.textContent.trim()));
    check('sections: How to play, The data, The science, What this does not claim, Jobs and credits are titled and visible',
      ['How to play', 'The data', 'The science', 'What this does not claim', 'Jobs and credits'].every(t => secs.includes(t)), secs.join(' | '));
    const how = (await page.textContent('#how')).replace(/\s+/g, ' ');
    check('sections: How to play has the three steps (Step / Play / Judge)', how.includes('Step through the day, or jump to any hour on the dial or the curve.') &&
      how.includes('Play with each stage\'s real output: scrub, compare, move thresholds, listen.') && how.includes('Judge each hop: survival F, set against what chance alone would score.'));
    check('sections: the honesty note is visible without opening anything', await page.locator('#claims p.honesty').isVisible());
    const oi = CH.findIndex(s => s.id === 'otoc');
    const dialN = await page.$$eval('#dial g.mk', g => g.length);
    await page.locator('#dial').scrollIntoViewIfNeeded(); await page.click(`#dial g.mk >> nth=${oi}`); await page.waitForTimeout(250);
    check('dial: 18 hour markers; tapping the 20:00 marker opens otoc-echo-v1 and the hand moves there',
      dialN === N && (await page.textContent('#c-clock')) === '20:00' && (await page.textContent('#dial')).includes('20:00otoc-echo-v1') &&
      (await page.textContent('#c-pos')) === `stage ${oi + 1} of ${N}`, `${dialN} markers, ${await page.textContent('#dial')}`);
    const gal = await page.$$eval('#gallery figure.fig', fs => fs.map(f => {
      const cs = [...f.querySelectorAll('canvas')];
      const inked = cs.filter(c => { try { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 64) if (x[i] < 200) n++; return n > 20; } catch (e) { return false; } }).length;
      return { id: f.id.slice(4), canvases: cs.length, inked, status: !!f.querySelector('.status'), cur: f.classList.contains('cur'), h: Math.round(f.getBoundingClientRect().height), hop: f.querySelector('.hop').textContent.slice(0, 40) };
    }));
    const badFig = gal.filter((g, i) => CH[i].completed ? !(g.canvases > 0 && g.inked === g.canvases) : !g.status);
    check(`The data: all ${N} stages have a visible chart block; every canvas of the ${CH.filter(s => s.completed).length} completed stages is drawn, failed stages show their status card`,
      gal.length === N && gal.every((g, i) => g.id === CH[i].id && g.h > 80) && badFig.length === 0, JSON.stringify(badFig.length ? badFig : gal.map(g => `${g.id}:${g.inked}/${g.canvases}`)));
    check('The data: the stage open in the card is outlined in The data', gal.filter(g => g.cur).length === 1 && gal[oi].cur);
    // the rail's two SVG charts are drawn from the chain: 18 dial markers + hand, and the survival curve through every scored hop
    const svgs = await page.evaluate(() => ({ dialMk: document.querySelectorAll('#dial g.mk').length, dialHand: document.querySelectorAll('#dial line').length,
      pts: document.querySelectorAll('#curve g.pt').length, verts: ((document.querySelector('#curve > path') || {}).getAttribute ? document.querySelector('#curve > path').getAttribute('d') : '').split(/[ML]/).filter(s => s.trim()).length,
      scored: CHAIN.filter(s => s.completed && s.hop).length }));
    check('rail charts: the 24-hour dial (18 markers, ticks, hand) and the survival curve (a point per stage, a line through every scored hop) are drawn',
      svgs.dialMk === N && svgs.dialHand >= 25 && svgs.pts === N && svgs.verts === svgs.scored && svgs.scored === 16, JSON.stringify(svgs));
    // every dial marker and every curve point opens its own stage
    const navBad = [];
    for (const [sel, nm] of [['#dial g.mk', 'dial'], ['#curve g.pt', 'curve']]) {
      for (let i = 0; i < N; i++) {
        await page.evaluate(j => go(j), (i + 1) % N); await page.waitForTimeout(60);
        await page.locator(sel).nth(i).click(); await page.waitForTimeout(120);
        const ck = await page.textContent('#c-clock');
        if (ck !== CH[i].clock) navBad.push(`${nm} ${CH[i].clock} -> ${ck}`);
      }
    }
    check(`rail charts: all ${N} dial markers and all ${N} survival-curve points open their own stage`, navBad.length === 0, JSON.stringify(navBad));
    await page.evaluate(j => go(j), oi); await page.waitForTimeout(150);
    const gq = await page.$$eval('#fig-qpixl input[type=range], #view input[type=range]', r => r.length);
    await page.locator('#fig-graph .figfoot button').click(); await page.waitForTimeout(900);
    check('The data: "Show 10:00 in the lab" walks Tweezy to graph-v1 and scrolls up to the lab', (await page.textContent('#c-clock')) === '10:00' &&
      (await page.evaluate(() => document.querySelector('section.lab').getBoundingClientRect().top)) < 200 && (await page.$eval('#fig-graph', f => f.classList.contains('cur'))), gq);
    // a chart in The data keeps playing when the stage card changes stage (only the card's own players stop)
    await page.locator('#fig-blurmidi').scrollIntoViewIfNeeded();
    a = await qa(); await page.click('#fig-blurmidi button:has-text("Play")'); await page.waitForTimeout(500); b = await qa();
    await page.evaluate(() => go(cur + 1)); await page.waitForTimeout(300);
    check('The data: the 16:00 piano roll plays the score and keeps playing when the card changes stage', b.osc > a.osc &&
      (await page.textContent('#fig-blurmidi .ctl')).includes('Stop'), `osc +${b.osc - a.osc}`);
    await page.click('#fig-blurmidi button:has-text("Stop")'); await page.waitForTimeout(150);
    check('The data: and it stops on Stop', (await page.textContent('#fig-blurmidi .ctl')).includes('Play'));

    // ------------------------------------------------------------------ 6. share link and restore from the hash
    await page.click(`#stns .stn >> nth=${gi}`); await page.waitForTimeout(250);
    await page.click('#mode button[data-m="data"]'); await page.waitForTimeout(250);
    await page.click('#share'); await page.waitForTimeout(300);
    const toast = await page.textContent('#toast'), clip = await page.evaluate(() => navigator.clipboard.readText());
    check('share: "Copy link to this stage" copies a link with the stage and view', toast.includes('Link copied') && toast.includes('10:00, Data view') && clip.endsWith('#graph.data'), `${toast} | ${clip}`);
    const p2 = await ctx.newPage(); await p2.addInitScript(INIT);
    await p2.goto(clip, { waitUntil: 'networkidle' }); await p2.waitForTimeout(400);
    check('share: reloading the copied link restores 10:00 graph-v1 in the Data view', (await p2.textContent('#c-clock')) === '10:00' &&
      (await p2.getAttribute('#mode button[data-m="data"]', 'aria-pressed')) === 'true' && (await p2.$$('#view .patterns button')).length > 0 &&
      (await p2.getAttribute(`#stns .stn >> nth=${gi}`, 'aria-current')) === 'step');
    // a hash change is a same-document navigation: it only needs to commit; the reload that follows is the real check
    await p2.goto(base.replace('index.html', 'index.html#otoc'), { waitUntil: 'commit' }); await p2.reload({ waitUntil: 'networkidle' }); await p2.waitForTimeout(300);
    check('share: a scene link (#otoc) restores 20:00 in the Scene view', (await p2.textContent('#c-clock')) === '20:00' && (await p2.getAttribute('#mode button[data-m="scene"]', 'aria-pressed')) === 'true');
    await p2.close();

    // ------------------------------------------------------------------ 7. nav: brand bar, prev / hub / next, jump list
    const slugs = Object.keys(urls).sort(), me = slugs.indexOf('06-tweezer');
    const prevUrl = urls[slugs[me - 1]], nextUrl = urls[slugs[me + 1]];
    const nav = await page.evaluate(() => ({
      brand: document.querySelector('.wtnr-bar a').href,
      prev: (document.querySelector('nav.wtnr-nav a[rel=prev]') || {}).href, next: (document.querySelector('nav.wtnr-nav a[rel=next]') || {}).href,
      hub: (document.querySelector('nav.wtnr-nav a.wn-hub') || {}).href, list: document.querySelectorAll('nav.wtnr-nav ol a').length,
      cur: (document.querySelector('nav.wtnr-nav ol a[aria-current=page]') || {}).textContent, foot: !!document.querySelector('p.wtnr-foot'),
      navBeforeFoot: !!document.querySelector('nav.wtnr-nav + p.wtnr-foot') }));
    check('nav: brand bar links to the hub', nav.brand === HUB, nav.brand);
    const brand = (await page.textContent('.wtnr-bar')).replace(/\s+/g, ' ').trim(), body = await page.evaluate(() => document.body.innerText);
    check('nav: brand bar names the challenge like every other piece (all entries equal: no "Bonus" or "main entry" anywhere)',
      brand === 'What the Noise RemembersChallenge 06 · Lose' && !/\bbonus\b|main entry/i.test(body), brand);
    check(`nav: prev = ${slugs[me - 1]}, next = ${slugs[me + 1]}, hub button, all ${slugs.length} pieces listed, this one marked`,
      nav.prev === prevUrl && nav.next === nextUrl && nav.hub === HUB && nav.list === slugs.length && /06\s*Tweezer/.test(nav.cur || ''), JSON.stringify(nav));
    check('nav: sits just before the footer disclaimer', nav.foot && nav.navBeforeFoot);
    await page.locator('nav.wtnr-nav summary').click();
    check('nav: "Jump to any piece" opens', await page.locator('nav.wtnr-nav details').evaluate(d => d.open));

    // ------------------------------------------------------------------ 8. data on the page vs the cache, PARAMS.md and README
    const cacheIds = {};
    for (const s of CH) {
      const dir = path.join(ROOT, 'cache', s.engine);
      cacheIds[s.engine] = cacheIds[s.engine] || (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).job_id; } catch (e) { return null; } }) : []);
    }
    const ledger = fs.readFileSync(path.join(ROOT, 'cache', 'ledger.jsonl'), 'utf8');
    const shown = [];
    for (const s of CH) for (const j of (s.jobs || [s.job_id])) if (j) shown.push({ engine: s.engine, id: j, completed: s.completed });
    const missing = shown.filter(j => j.completed && !cacheIds[j.engine].includes(j.id));
    check(`data: all ${shown.filter(j => j.completed).length} completed job IDs on the page exist in cache/<engine>/*.json`, missing.length === 0, JSON.stringify(missing));
    const failed = shown.filter(j => !j.completed);
    check(`data: the ${failed.length} failed job IDs shown (labelled "did not complete") are in cache/ledger.jsonl`, failed.every(j => ledger.includes(j.id)), failed.map(j => j.id).join(', '));
    const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8'), pIds = [...params.matchAll(/`([0-9a-f]{8}-[0-9a-f-]{27})`/g)].map(m => m[1]);
    const cIds = shown.filter(j => j.completed).map(j => j.id);
    check('data: PARAMS.md lists exactly the completed jobs on the page', pIds.length === piece.jobs && cIds.length === piece.jobs && pIds.every(i => cIds.includes(i)), `${pIds.length} vs ${cIds.length}`);
    const readme = fs.readFileSync(path.join(PIECE, 'README.md'), 'utf8');
    check(`data: README states the same totals (${piece.engines.length} engines, ${piece.jobs} jobs, ${piece.hardware_qubits} on ${piece.hardware}, 210 stabilizer)`, readme.includes(`${piece.engines.length} engines completed, ${piece.jobs} completed jobs`) && readme.includes(`${piece.hardware_qubits} qubits on IBM ${piece.hardware}`) && readme.includes('210 data qubits'));
    const hw = CH.filter(s => /IBM hardware/.test(s.where)), HS = piece.hardware_stages || {};
    check(`data: the hardware stages on the page match piece.json (${Object.keys(HS).join(', ')}), each with its backend, qubits and job`,
      hw.length === Object.keys(HS).length && hw.every(s => HS[s.id] && s.where.includes(HS[s.id].backend) && (s.qubits || null) === (HS[s.id].qubits || null) && s.job_id === HS[s.id].job_id),
      hw.map(s => `${s.id}: ${s.where} ${s.qubits || '-'}`).join(' / '));
    const fezMax = Math.max(0, ...hw.filter(s => /\(ibm_fez\)/.test(s.where)).map(s => s.qubits || 0));
    check(`data: piece.json hardware is ibm_fez and hardware_qubits (${piece.hardware_qubits}) is the most qubits that ran there`, piece.hardware === 'ibm_fez' && piece.hardware_qubits === fezMax && (piece.hardware_all || [])[0] === 'ibm_fez', `${piece.hardware} ${piece.hardware_qubits} vs ${fezMax}`);
    // the ibm_fez re-runs: every hardware-capable stage was sent there; each attempt that did not complete is on the page
    // (card note, readout, jobs table), is in the ledger, is NOT in the job cache, and is not counted anywhere
    const FEZ_IDS = ['coin', 'comet', 'tessa', 'qpixl', 'maze', 'graph', 'retro', 'otoc'];
    const fz = await page.evaluate(ids => CHAIN.filter(s => ids.includes(s.id)).map(s => ({ id: s.id, ok: !!s.earlier || /IBM hardware \(ibm_fez\)/.test(s.where || ''),
      tries: ((s.fez && s.fez.attempts) || []).map(t => t.job_id) })), FEZ_IDS);
    check('fez: all 8 hardware-capable stages were sent to ibm_fez (a result or a logged attempt each)', fz.length === 8 && fz.every(s => s.ok || s.tries.length), JSON.stringify(fz.map(s => s.id + ':' + (s.ok ? 'ok' : s.tries.length))));
    const fezJobs = fz.flatMap(s => s.tries);
    const allCached = Object.values(cacheIds).flat();
    check(`fez: the ${fezJobs.length} ibm_fez attempts that did not complete are in the ledger, not in the cache, and not counted`,
      fezJobs.length > 0 && fezJobs.every(j => ledger.includes(j) && !allCached.includes(j) && !cIds.includes(j) && !pIds.includes(j)), fezJobs.join(', '));
    const jt = (await page.textContent('#jobs')).replace(/\s+/g, ' ');
    check('fez: the jobs table has a row for every ibm_fez attempt', fezJobs.every(j => jt.includes(j)) && (jt.match(/ibm_fez re-run \(same input\)/g) || []).length === fezJobs.length, (jt.match(/ibm_fez re-run \(same input\)/g) || []).length);
    const fezProof = (await page.textContent('#proof')).replace(/\s+/g, ' '), meta = await page.evaluate(() => META);
    check('fez: the proof chips count the ibm_fez re-runs honestly', fezProof.includes(`${meta.fez_done} of ${meta.fez_sent} ibm_fez re-runs completed`) && meta.fez_sent === 8 && meta.fez_done === fz.filter(s => s.ok).length, fezProof);
    const ci = CH.findIndex(s => s.id === 'comet');
    await page.evaluate(i => go(i), ci); await page.waitForTimeout(250);
    const cfez = (await page.textContent('#c-fez')).replace(/\s+/g, ' '), cro = (await page.textContent('#readout')).replace(/\s+/g, ' ');
    const cst = fz.find(s => s.id === 'comet');
    check('fez: the 05:30 card says what happened on ibm_fez and names the job', cst.ok ? (cfez.includes(`IBM ibm_fez, ${CH[ci].qubits} qubits, job ${CH[ci].job_id}`) && cst.tries.every(j => cfez.includes(j) && cro.includes(j)) && /recorded run/i.test(cfez)) : (cst.tries.every(j => cfez.includes(j) && cro.includes(j)) && /ibm_fez/.test(cfez) && /recorded run/.test(cfez)), cfez.slice(0, 200));

    const ti = CH.findIndex(s => s.id === 'tessa');
    if (ti >= 0 && !CH[ti].completed) {   // the closed 08:15 station: every attempt (all sizes) and the plain reason are on its card
      await page.evaluate(i => go(i), ti); await page.waitForTimeout(250);
      const tv = (await page.textContent('#view')).replace(/\s+/g, ' ');
      check(`tessa: the closed 08:15 card lists all ${CH[ti].attempts.length} attempts (with frame size) and says why it failed`,
        CH[ti].attempts.every(t => tv.includes(t.job_id)) && /16 × 16 frame/.test(tv) && /Why it failed/.test(tv) && /synchronous/.test(tv), tv.slice(0, 240));
    }

    // ------------------------------------------------------------------ 9. every control in every stage card does something
    const FP = () => {
      const card = document.getElementById('card'), out = [card.innerText];
      card.querySelectorAll('[aria-pressed],input,[style]').forEach(e => out.push((e.getAttribute('aria-pressed') || '') + '|' + (e.value != null ? e.value : '') + '|' + (e.getAttribute('style') || '')));
      card.querySelectorAll('canvas').forEach(c => { try { out.push(c.width + 'x' + c.height + ':' + c.toDataURL()); } catch (e) { out.push('tainted'); } });
      document.querySelectorAll('audio,video').forEach(m => out.push(m.paused ? 'p' : 'P'));
      out.push(location.hash, window.__qa.sources, window.__qa.media, document.getElementById('sounds').innerText);
      return out.join('#');
    };
    const sweep = [], dead = [], dataViews = [], dataBad = [];
    for (let i = 0; i < N; i++) {
      for (const mode of ['scene', 'data']) {
        await page.evaluate(() => { stopAll(); window.__clock.thaw(); });
        await page.click(`#stns .stn >> nth=${i}`); await page.waitForTimeout(150);
        await page.click(`#mode button[data-m="${mode}"]`); await page.waitForTimeout(350);
        if (mode === 'data') {   // the stage card's Data view: every chart canvas of a completed stage is drawn (failed: status card)
          const v = await page.evaluate(() => { const cs = [...document.querySelectorAll('#view canvas')];
            const inked = cs.filter(c => { try { const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < x.length; i += 64) if (x[i] < 200) n++; return n > 20; } catch (e) { return false; } }).length;
            return { n: cs.length, inked, status: !!document.querySelector('#view .status') }; });
          dataViews.push(`${CH[i].id}:${v.inked}/${v.n}`);
          if (CH[i].completed ? !(v.n > 0 && v.inked === v.n) : !v.status) dataBad.push(`${CH[i].id}:${v.inked}/${v.n}`);
        }
        const SEL = '#view button, #view input, #view select, #view canvas[tabindex]';
        const n = await page.$$eval(SEL, els => els.length);
        for (let k = 0; k < n; k++) {
          // every control is tried from the stage card's fresh state (as when you arrive at the stage)
          await page.evaluate(() => { stopAll(); window.__clock.thaw(); renderView(); }); await page.waitForTimeout(200);
          let hdl = (await page.$$(SEL))[k];
          if (!hdl || !(await hdl.isVisible())) continue;
          const info = await hdl.evaluate(e => ({ tag: e.tagName.toLowerCase(), type: e.type || '', label: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 50), pressed: e.getAttribute('aria-pressed'),
            min: e.min, max: e.max, value: e.value, disabled: !!e.disabled }));
          const name = `${info.tag}${info.type ? '[' + info.type + ']' : ''} "${info.label}"`;
          if (info.disabled) { sweep.push({ stage: CH[i].clock + ' ' + CH[i].id, mode, control: name, skipped: 'disabled in the fresh state' }); continue; }
          await hdl.scrollIntoViewIfNeeded(); await page.waitForTimeout(80);
          // an already-selected option is a false positive: select a sibling first, then come back to it
          if (info.pressed === 'true') {
            const sib = await hdl.evaluateHandle(e => [...e.parentNode.children].find(x => x !== e && x.getAttribute('aria-pressed') === 'false'));
            if (sib && sib.asElement()) { await sib.asElement().click(); await page.waitForTimeout(150); }
            // a switch that re-renders the card (the ibm_fez / recorded Run switch) replaces its buttons: find this one again
            if (!(await hdl.evaluate(e => e.isConnected))) { hdl = (await page.$$(SEL))[k]; if (!hdl) continue; await hdl.scrollIntoViewIfNeeded(); }
          }
          // a Reset in the fresh state has nothing to undo (a false positive): move its slider first, then press Reset
          if (/^Reset/.test(info.label)) {
            const rng = await hdl.evaluateHandle(e => e.parentNode.querySelector('input[type=range]'));
            if (rng && rng.asElement()) { await rng.asElement().focus(); await page.keyboard.press('End'); await page.waitForTimeout(150); }
          }
          await page.evaluate(() => { window.__clock.freeze(); if (SCENE) SCENE.redraw(); });
          const before = await page.evaluate(FP);
          const box = await hdl.boundingBox();
          if (info.tag === 'input' && info.type === 'range') {
            await hdl.focus(); await page.keyboard.press(+info.value >= +info.max ? 'Home' : 'End');
          } else if (info.tag === 'canvas' && box) {
            await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.45); await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55, { steps: 6 }); await page.mouse.up();
          } else await hdl.click({ timeout: 2500 });
          await page.waitForTimeout(450);
          await page.evaluate(() => { if (SCENE) SCENE.redraw(); });
          const after = await page.evaluate(FP);
          const changed = before !== after;
          const rec = { stage: CH[i].clock + ' ' + CH[i].id, mode, control: name, changed };
          sweep.push(rec); if (!changed) dead.push(rec);
          await page.evaluate(() => { stopAll(); window.__clock.thaw(); });
        }
      }
    }
    const skipped = sweep.filter(r => r.skipped), tested = sweep.filter(r => !r.skipped);
    check('controls: no control starts out disabled in a stage card', skipped.length === 0, JSON.stringify(skipped));
    check(`controls: all ${tested.length} controls across the 18 stage cards (Scene and Data) change something`, dead.length === 0, JSON.stringify(dead));
    check(`Data view: every chart in the stage card's Data view is drawn for all ${CH.filter(s => s.completed).length} completed stages (failed stages show their status card)`,
      dataBad.length === 0 && dataViews.length === N, JSON.stringify(dataBad.length ? dataBad : dataViews));

    // ------------------------------------------------------------------ 10. every control in The data (all 18 charts) does something
    // each control is tried on a freshly drawn chart (the same renderer gallery() uses), so an option that is already
    // selected or a Reset with nothing to undo is not mistaken for a dead control
    await page.evaluate(() => { stopAll(); window.__clock.thaw(); });
    const GFP = id => {
      const f = document.getElementById('fig-' + id), out = [f.innerText, f.className];
      f.querySelectorAll('[aria-pressed],input,[style]').forEach(e => out.push((e.getAttribute('aria-pressed') || '') + '|' + (e.value != null ? e.value : '') + '|' + (e.getAttribute('style') || '')));
      f.querySelectorAll('canvas').forEach(c => { try { out.push(c.width + 'x' + c.height + ':' + c.toDataURL()); } catch (e) { out.push('tainted'); } });
      document.querySelectorAll('audio,video').forEach(m => out.push(m.paused ? 'p' : 'P'));
      out.push(location.hash, window.__qa.sources, window.__qa.media, document.getElementById('c-clock').textContent);
      return out.join('#');
    };
    const fresh = id => page.evaluate(id => {
      stopAll(); window.__clock.thaw();
      const st = CHAIN.find(s => s.id === id), body = document.querySelector('#fig-' + id + ' .view'); body.textContent = '';
      timers.forEach((el, t) => { if (el && !el.isConnected) { clearInterval(t); timers.delete(t); } });
      const keep = FK; FK = Math.max(1, Math.min(2, 560 / Math.max(240, body.clientWidth || 560)));
      const fn = st.completed ? (R[st.id] || statusCard) : (st.id === 'tamagotchi' ? R.tamagotchi : statusCard);
      fn(body, st); FK = keep;
    }, id);
    const gsweep = [], gdead = [], gskip = [];
    for (let i = 0; i < N; i++) {
      const id = CH[i].id, SEL = `#fig-${id} button, #fig-${id} input, #fig-${id} select, #fig-${id} canvas[tabindex]`;
      await fresh(id); await page.waitForTimeout(150);
      const n = await page.$$eval(SEL, els => els.length);
      for (let k = 0; k < n; k++) {
        await fresh(id); await page.mouse.move(1, 1); await page.waitForTimeout(120);
        const hdl = (await page.$$(SEL))[k];
        if (!hdl || !(await hdl.isVisible())) continue;
        const info = await hdl.evaluate(e => ({ tag: e.tagName.toLowerCase(), type: e.type || '', label: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 50), pressed: e.getAttribute('aria-pressed'),
          max: e.max, value: e.value, disabled: !!e.disabled, show: !!e.closest('.figfoot') }));
        const name = `${info.tag}${info.type ? '[' + info.type + ']' : ''} "${info.label}"`;
        if (info.disabled) { gskip.push(`${CH[i].clock} ${name}`); continue; }
        await hdl.scrollIntoViewIfNeeded(); await page.waitForTimeout(80);
        if (info.pressed === 'true') {
          const sib = await hdl.evaluateHandle(e => [...e.parentNode.children].find(x => x !== e && x.getAttribute('aria-pressed') === 'false'));
          if (sib && sib.asElement()) { await sib.asElement().click(); await page.waitForTimeout(150); }
        }
        if (/^Reset/.test(info.label)) {
          const rng = await hdl.evaluateHandle(e => e.parentNode.querySelector('input[type=range]'));
          if (rng && rng.asElement()) { await rng.asElement().focus(); await page.keyboard.press('End'); await page.waitForTimeout(150); }
        }
        if (info.show) { await page.evaluate(j => { if (cur === j) go(j + 1); }, i); await page.waitForTimeout(150); }   // "Show in the lab" from another stage
        await page.evaluate(() => window.__clock.freeze());
        const before = await page.evaluate(GFP, id);
        const box = await hdl.boundingBox();
        if (info.tag === 'input' && info.type === 'range') {
          await hdl.focus(); await page.keyboard.press(+info.value >= +info.max ? 'Home' : 'End');
        } else if (info.tag === 'canvas' && box) {
          await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.45); await page.mouse.down();
          await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.55, { steps: 6 }); await page.mouse.up();
        } else await hdl.click({ timeout: 2500 });
        await page.waitForTimeout(450);
        const after = await page.evaluate(GFP, id);
        const rec = { stage: CH[i].clock + ' ' + id, control: name, changed: before !== after };
        gsweep.push(rec); if (!rec.changed) gdead.push(rec);
        await page.evaluate(() => { stopAll(); window.__clock.thaw(); });
      }
      await fresh(id);
    }
    check('The data: no control starts out disabled in any of the 18 charts', gskip.length === 0, JSON.stringify(gskip));
    check(`The data: all ${gsweep.length} controls across the 18 charts (buttons, sliders, charts you hover, tap or drag, "Show in the lab") change something`,
      gdead.length === 0 && gsweep.length > 40, JSON.stringify(gdead));
    fs.writeFileSync(path.join(PIECE, 'qa', 'e2e_controls.json'), JSON.stringify({ tested: sweep.length + gsweep.length, dead: dead.concat(gdead), sweep, gallery: gsweep }, null, 1));

    check('page: no console errors, page errors or dialogs during the journey', errors.length === 0, errors.slice(0, 3).join(' | '));
    const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
    check('page: no requests to hosts other than Google Fonts', bad.length === 0, [...external].join(', '));
  } catch (e) {
    check('journey ran to the end without an exception', false, e.stack || e.message);
  }
  const out = { piece: '06-tweezer', ok: fails.length === 0, passed: steps.filter(s => s.ok).length, failed: fails, steps };
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(`\n${out.ok ? 'E2E OK' : 'E2E FAILED'}: ${out.passed}/${steps.length} steps passed`);
  await browser.close(); srv.close();
  process.exit(out.ok ? 0 : 1);
})();
