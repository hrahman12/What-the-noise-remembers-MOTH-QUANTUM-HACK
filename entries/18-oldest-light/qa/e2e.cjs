// End-to-end journey for 18 Oldest Light: node entries/18-oldest-light/qa/e2e.cjs [port 6540-6549]
// Serves web/ locally, opens the built page in headless Chromium and walks the main user journey with real
// assertions: check every restored graph renders with content (sky, legend, beam ruler, meters, line-up, sky map,
// three tables), drag Mapper across the sky, hover for a temperature, slide through all 7 blur stops (each engine job
// ID checked against out/jobs.json and the Atlas cache), plant galaxy seeds and read the census, switch Quantum /
// Gaussian / COBE and Wipe / Original / Blurred, toggle Scene / Data, mark the Cold Spot, zoom, use the keyboard,
// take the quiz (and answer every one of its 23 options after a reset), press every "Show me" story button, open every science drawer, copy a share link and reload with
// its hash, check the prev / hub / next nav, and confirm the page makes no sound (it has no audio deliverable).
// Also cross-checks the numbers on the page against piece.json, README.md, PARAMS.md and cache/blur-core-v1.
// Writes qa/e2e.json and prints it; exit code 1 if any step fails.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = '18-oldest-light', HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const port = +(process.argv[2] || 6540);
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const INSTRUMENT = () => {   // same audio instrumentation as common/qa/qa_page.cjs
  window.__qa = { sources: 0, ctx: 0, media: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [], errors = [], external = new Set();
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function step(name, fn) {
  const t0 = Date.now();
  try { const note = await fn(); steps.push({ step: name, ok: true, note: note || '', ms: Date.now() - t0 }); console.log('ok  ', name, note ? '- ' + note : ''); }
  catch (e) { steps.push({ step: name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log('FAIL', name, '-', String(e.message || e).slice(0, 400)); }
}

// ---------- reference data (the files the page must agree with) ----------
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const jobs = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'jobs.json'), 'utf8'));
const analysis = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'analysis.json'), 'utf8'));
const readme = fs.readFileSync(path.join(PIECE, 'README.md'), 'utf8');
const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8');
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const done = jobs.filter(j => j.status === 'completed').sort((a, b) => a.strength - b.strength);
const failed = jobs.filter(j => j.status !== 'completed');
const cacheIds = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'cache', 'blur-core-v1'))) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'cache', 'blur-core-v1', f), 'utf8'));
  cacheIds.set(d.job_id, { file: f, strength: d.params.strength, seconds: d.seconds, shape: [d.params.values.length, d.params.values[0].length] });
}
const ledger = fs.readFileSync(path.join(ROOT, 'cache', 'ledger.jsonl'), 'utf8');

(async () => {
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const watch = (page) => {
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
    page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.hostname !== '127.0.0.1') external.add(u.hostname); });
  };
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage(); watch(page);
  const $t = (sel) => page.$eval(sel, e => e.textContent.trim());
  const pressed = (sel) => page.$eval(sel, e => e.getAttribute('aria-pressed'));
  const S = () => page.evaluate(() => ({ ...st }));
  const fxInk = () => page.evaluate(() => { const c = document.getElementById('fx'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  const skyHash = () => page.evaluate(() => { const u = document.getElementById('cv').toDataURL(); let h = 0; for (let i = 0; i < u.length; i += 7) h = (h * 31 + u.charCodeAt(i)) | 0; return h; });

  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);

  await step('page loads: title, hook, proof chips and the default view (quantum blur 0.5)', async () => {
    assert((await page.title()) === 'Oldest Light', 'title');
    assert((await $t('h1')) === 'Blur the oldest light in the universe.', 'hook headline');
    const proof = await $t('#proof');
    assert(/18\s*qubits per blur/.test(proof) && /6\s*real Atlas jobs/.test(proof) && /simulator/.test(proof), 'proof chips: ' + proof);
    assert((await $t('#lvl-val')) === '0.5', 'default strength 0.5');
    const j = done.find(x => x.strength === 0.5);
    assert((await $t('#r-job')).startsWith(j.job_id), 'default job id ' + (await $t('#r-job')));
    assert((await $t('#r-qubits')).startsWith('18 '), 'qubits readout');
    assert(/blur-core-v1/.test(await $t('#r-engine')) && /statevector simulator/.test(await $t('#r-engine')), 'engine readout');
    assert((await pressed('[data-scene="s"]')) === 'true', 'scene view is the default');
    assert((await fxInk()) > 50, 'Mapper sprite drawn on the overlay');
    return 'job ' + j.job_id.slice(0, 8);
  });

  await step('every restored graph renders with real content: sky, legend, ruler + marker, meters, line-up, sky map, 3 tables', async () => {
    const g = await page.evaluate(() => {
      const cv = document.getElementById('cv'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cols = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      const lg = getComputedStyle(document.getElementById('lg-bar')).backgroundImage;
      const ruler = document.getElementById('ruler'), me = ruler.querySelector('.me');
      const w = id => parseFloat(document.getElementById(id).style.width) || 0;
      const img = document.querySelector('#sky img'), polys = [...document.querySelectorAll('#sky svg polygon, #sky svg polyline, #sky svg path')];
      const rows = id => document.querySelectorAll('#' + id + ' tr').length - 1;
      return { skyColours: cols.size, legendStops: (lg.match(/rgb/g) || []).length, rulerKids: ruler.querySelectorAll('*').length,
        rulerLabels: ruler.querySelectorAll('.lab').length, marker: !!me && me.getBoundingClientRect().width > 0,
        meters: [w('m-kept'), w('m-std'), w('m-kept2'), w('m-std2')], lineup: document.querySelectorAll('#lineup img, #lineup canvas, #lineup .pix').length,
        mapW: img.naturalWidth, mapDone: img.complete, outline: polys.map(p => (p.getAttribute('points') || p.getAttribute('d') || '').length),
        fit: rows('t-fit'), limits: rows('t-limits'), jobs: rows('t-jobs') };
    });
    assert(g.skyColours > 200, 'sky canvas looks blank: ' + g.skyColours + ' colours');
    assert(g.legendStops >= 5, 'colour legend gradient: ' + g.legendStops + ' stops');
    assert(g.rulerLabels === 6 && g.rulerKids >= 12 && g.marker, 'beam ruler: ' + JSON.stringify(g));
    assert(g.meters.every(x => x > 0), 'meters empty: ' + g.meters);
    assert(g.lineup >= 3, 'mission line-up sprites: ' + g.lineup);
    assert(g.mapDone && g.mapW === 1024 && g.outline.length >= 1 && g.outline.every(n => n > 20), 'whole-sky map / outline: ' + JSON.stringify(g));
    assert(g.fit === done.length && g.jobs === done.length && g.limits >= 5, 'tables: ' + JSON.stringify(g));
    return `sky ${g.skyColours} colours, legend ${g.legendStops} stops, ruler ${g.rulerKids} parts, meters ${g.meters.map(x => x.toFixed(0)).join('/')}%, line-up ${g.lineup}, map ${g.mapW}px, tables ${g.fit}/${g.limits}/${g.jobs} rows`;
  });

  const box = await page.$eval('#cv', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await step('drag Mapper across the sky: the wipe follows and the sky redraws', async () => {
    const h0 = await skyHash(), s0 = await S();
    await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(box.x + box.w * (0.5 - 0.03 * k), box.y + box.h * (0.5 + 0.01 * k));
    await page.mouse.up();
    await page.waitForTimeout(200);
    const s1 = await S();
    assert(Math.abs(s0.wipe - 0.5) < 1e-9 && Math.abs(s1.wipe - 0.26) < 0.03, 'wipe moved 0.5 -> ' + s1.wipe);
    assert((await skyHash()) !== h0, 'sky canvas did not change');
    const cast = await page.evaluate(() => cast.hy);
    assert(Math.abs(cast - 0.58) < 0.03, 'Mapper height followed the pointer: ' + cast);
    return 'wipe ' + s1.wipe.toFixed(2);
  });

  await step('hover the sky: the probe reads the temperature and galactic coordinates; Mapper catches photons', async () => {
    await page.mouse.move(box.x + box.w * 0.7, box.y + box.h * 0.3);
    await page.mouse.move(box.x + box.w * 0.72, box.y + box.h * 0.32);
    await page.waitForTimeout(150);
    const probe = await page.$eval('#probe', e => ({ hidden: e.hidden, t: e.textContent }));
    assert(!probe.hidden && /original [+\u2212-]?\d+ \u00b5K/.test(probe.t) && /blurred/.test(probe.t) && /l \d+\.\d\u00b0 \u00b7 b/.test(probe.t), 'probe: ' + JSON.stringify(probe));
    const photons = await page.evaluate(() => cast.photons.length);
    assert(photons > 0, 'no photons spawned on hover');
    await page.mouse.move(box.x - 40, box.y + 20);   // leave the canvas
    return probe.t.replace(/\s+/g, ' ');
  });

  await step('slide through all 7 blur stops: each shows its own real engine job and measured numbers', async () => {
    await page.focus('#lvl'); await page.keyboard.press('Home'); await page.waitForTimeout(80);
    assert((await $t('#lvl-val')) === '0' && /no quantum job/.test(await $t('#r-job')), 'stop 0 is the unblurred sky');
    const seen = [];
    for (let k = 0; k < done.length; k++) {
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60);
      const j = done[k], a = analysis.find(r => r.name === j.name);
      const job = await $t('#r-job'), val = await $t('#lvl-val'), kept = await $t('#n-kept'), sr = await $t('#n-std'), say = await $t('#say');
      assert(val === String(j.strength), `stop ${k + 1}: strength ${val} != ${j.strength}`);
      assert(job.startsWith(j.job_id) && job.includes('(' + j.seconds + ' s)'), `stop ${k + 1}: job ${job}`);
      assert(cacheIds.has(j.job_id) && cacheIds.get(j.job_id).strength === j.strength, `job ${j.job_id} not in cache/blur-core-v1 with strength ${j.strength}`);
      assert(kept === Math.round(a.detail_kept * 100) + '%' && sr === Math.round(a.std_ratio * 100) + '%', `stop ${k + 1}: meters ${kept} ${sr}`);
      assert(say.includes('Quantum blur ' + j.strength), 'Mapper did not narrate the new blur: ' + say);
      const row = params.split('\n').find(l => l.includes(j.job_id)) || '', cells = row.split('|').map(c => c.trim());
      assert(+cells[4] === j.strength && cells[5] === '18' && cells[6] === 'completed' && +cells[7] === j.seconds, 'PARAMS.md row for ' + j.job_id + ': ' + row);
      seen.push(j.strength + ':' + j.job_id.slice(0, 8));
    }
    return seen.join(' ');
  });

  await step('plant galaxy seeds: the census on the real outputs matches the README (strength 0.5)', async () => {
    await page.focus('#lvl'); await page.keyboard.press('Home'); for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
    assert((await $t('#lvl-val')) === '0.5', 'back to 0.5');
    await page.click('#seeds'); await page.waitForTimeout(300);
    assert((await pressed('#seeds')) === 'true' && (await $t('#seeds')) === 'Pull up the seeds', 'seeds button state');
    const m = readme.match(/for strength 0\.5: quantum (\d+) kept, (\d+) lost, (\d+) phantoms; Gaussian (\d+), (\d+), (\d+)/);
    const nHot = +readme.match(/the (\d+) hottest spots/)[1];
    assert(m, 'README census sentence not found');
    const cq = await page.$eval('#census', e => e.innerText.replace(/\s+/g, ' '));
    assert(cq.includes(m[1] + ' kept') && cq.includes(m[2] + ' blurred away') && cq.includes(m[3] + ' phantoms') && cq.includes('of ' + nHot + ' hot spots'), 'quantum census: ' + cq);
    assert((await $t('#say')).includes('I planted ' + nHot + ' seeds'), 'Mapper announces the planting');
    await page.click('[data-kind="g"]'); await page.waitForTimeout(250);
    const cg = await page.$eval('#census', e => e.innerText.replace(/\s+/g, ' '));
    assert(cg.includes(m[4] + ' kept') && cg.includes(m[5] + ' blurred away') && cg.includes(m[6] + ' phantoms'), 'Gaussian census: ' + cg);
    assert((await $t('#r-qubits')) === '0 (classical view)' && /Gaussian beam/.test(await $t('#tag-r')), 'Gaussian is labelled classical');
    await page.click('#seeds'); await page.waitForTimeout(100);
    assert((await pressed('#seeds')) === 'false' && /waiting for seeds/.test(await $t('#census')), 'seeds pulled up');
    return 'quantum ' + cq + ' | gaussian ' + cg;
  });

  await step('switch blur kind and view: COBE 7 deg disables the slider; Original / Blurred / Wipe change the sky', async () => {
    await page.click('[data-kind="c"]'); await page.waitForTimeout(250);
    assert((await page.$eval('#lvl', e => e.disabled)) && (await $t('#lvl-val')) === '7\u00b0' && (await pressed('[data-kind="c"]')) === 'true', 'COBE state');
    assert(/COBE-like/.test(await $t('#beam-txt')), 'COBE beam text');
    await page.click('[data-kind="q"]'); await page.waitForTimeout(150);
    assert(!(await page.$eval('#lvl', e => e.disabled)) && (await $t('#lvl-val')) === '0.5', 'back to quantum 0.5');
    const h = {};
    for (const m of ['o', 'b', 'w']) { await page.click(`[data-mode="${m}"]`); await page.waitForTimeout(120); h[m] = await skyHash(); assert((await pressed(`[data-mode="${m}"]`)) === 'true', 'mode ' + m); }
    assert(h.o !== h.b && h.b !== h.w && h.o !== h.w, 'Original / Blurred / Wipe render the same sky');
    assert(await page.$eval('#tag-l', e => !e.hidden) && await page.$eval('#tag-r', e => !e.hidden), 'wipe shows both tags');
  });

  await step('toggle Scene / Data: the cast leaves, the plain handle stays, the cast returns', async () => {
    await page.click('[data-scene="d"]'); await page.waitForTimeout(250);
    assert((await pressed('[data-scene="d"]')) === 'true' && (await pressed('[data-scene="s"]')) === 'false', 'Data pressed');
    assert((await fxInk()) === 0, 'sprite overlay not cleared in Data view');
    assert(/Data view/.test(await $t('#say')), 'Mapper says goodbye');
    await page.click('[data-scene="s"]'); await page.waitForTimeout(300);
    assert((await pressed('[data-scene="s"]')) === 'true' && (await fxInk()) > 50, 'cast back in Scene view');
  });

  await step('mark the Cold Spot, zoom with the buttons and the keyboard, peek at the original with space', async () => {
    await page.click('#cold'); await page.waitForTimeout(150);
    assert((await $t('#cold')) === 'Hide the Cold Spot' && /Cold Spot: this circle is 10\u00b0 across and averages \u2212\d+ \u00b5K/.test(await $t('#say')), 'cold spot: ' + await $t('#say'));
    await page.click('#cold');
    assert((await $t('#cold')) === 'Mark the Cold Spot', 'cold spot hidden again');
    const z0 = (await S()).z;
    await page.click('#z-in'); assert((await S()).z > z0, 'zoom in');
    await page.click('#z-out'); assert(Math.abs((await S()).z - z0) < 1e-6, 'zoom out');
    await page.click('#z-reset'); assert((await S()).z === 1 && await page.$eval('#z-out', e => e.disabled), 'reset to the whole patch');
    await page.focus('#cv');
    await page.keyboard.press('+'); assert((await S()).z > 1, 'key + zooms');
    await page.keyboard.press('ArrowRight'); const cx = (await S()).cx; assert(cx > 257 / 2, 'arrow pans');
    await page.keyboard.press('0'); assert((await S()).z === 1, 'key 0 resets');
    const w0 = (await S()).wipe; await page.keyboard.press('Shift+ArrowRight'); assert((await S()).wipe > w0, 'shift+arrow moves Mapper');
    await page.keyboard.down(' '); await page.waitForTimeout(80);
    assert(await page.$eval('#tag-r', e => e.hidden), 'space peeks at the original');
    await page.keyboard.up(' '); await page.waitForTimeout(80);
    assert(await page.$eval('#tag-r', e => !e.hidden), 'releasing space returns');
  });

  await step('story: every "Show me" button sets the instrument to match its card', async () => {
    const expect = { 1: s => s.level === 0 && s.mode === 'o' && s.z === 1, 2: s => s.z === 3.5 && s.mode === 'o', 3: s => s.cold && s.mode === 'o',
      4: s => s.level === done.length && s.kind === 'q' && s.mode === 'w' && s.z === 3, 5: s => s.kind === 'c' };
    for (const n of [1, 2, 3, 4, 5]) {
      await page.click(`[data-show="${n}"]`); await page.waitForTimeout(150);
      const s = await S();
      assert(expect[n](s), `Show me ${n}: ${JSON.stringify(s)}`);
      assert(await page.$eval('#c' + n, e => e.classList.contains('on')), 'card ' + n + ' highlighted');
    }
    assert((await $t('#lvl-val')) === '7\u00b0', 'COBE view label');
  });

  await step('quiz: a wrong answer is explained, all six right is perfect, and it resets', async () => {
    const A = await page.evaluate(() => QUIZ.map(q => q.a));
    await page.click(`button[data-q="0"][data-k="${(A[0] + 1) % 4}"]`);
    assert((await $t('#qw0')).startsWith('Not quite.') && (await $t('#score')) === '0 / 1 right', 'wrong answer');
    await page.click('#quiz-reset');
    assert((await $t('#score')) === '6 questions', 'reset');
    for (let n = 0; n < A.length; n++) await page.click(`button[data-q="${n}"][data-k="${A[n]}"]`);
    assert((await $t('#score')) === '6 / 6 right \u00b7 perfect', 'score ' + await $t('#score'));
    assert((await page.$$eval('.q .why', ws => ws.filter(w => !w.hidden && w.textContent.startsWith('Right.')).length)) === 6, 'six explanations');
    await page.click('#quiz-reset');
    assert((await $t('#score')) === '6 questions', 'reset again');
    // the dead-control scan can only click one option per question (the rest disable once answered, by design):
    // prove every option works by resetting before each one
    const nOpt = await page.evaluate(() => QUIZ.map(q => q.o.length));
    let tried = 0;
    for (let n = 0; n < A.length; n++) for (let k = 0; k < nOpt[n]; k++) {
      await page.click('#quiz-reset');
      const b = `button[data-q="${n}"][data-k="${k}"]`;
      assert(!(await page.$eval(b, e => e.disabled)), `option ${n}.${k} disabled after reset`);
      await page.click(b);
      const why = await $t('#qw' + n);
      assert(why.startsWith(k === A[n] ? 'Right.' : 'Not quite.') && (await $t('#score')) === (k === A[n] ? '1 / 1 right' : '0 / 1 right'), `option ${n}.${k}: ${why.slice(0, 40)} / ${await $t('#score')}`);
      assert(await page.$eval(b, (e, r) => e.classList.contains(r ? 'right' : 'wrong'), k === A[n]), `option ${n}.${k} not marked`);
      tried++;
    }
    await page.click('#quiz-reset');
    return tried + ' options each answered after a reset';
  });

  await step('science drawers all open with content; the job table lists every engine job; the census column fills', async () => {
    const n = await page.$$eval('.sec details.drawer', d => d.length);
    for (let k = 0; k < n; k++) {
      const s = (await page.$$('.sec details.drawer summary'))[k];
      await s.scrollIntoViewIfNeeded(); await s.click(); await page.waitForTimeout(80);
    }
    const open = await page.$$eval('.sec details.drawer', d => d.map(x => x.open && x.querySelector('.body').getBoundingClientRect().height > 20));
    assert(open.length === 5 && open.every(Boolean), 'drawers: ' + JSON.stringify(open));
    await page.click('#seed-count');
    const rows = await page.$$eval('#t-jobs tr', r => r.slice(1).map(x => x.innerText.split('\t')));
    assert(rows.length === done.length && rows.every((r, k) => r[1] === done[k].job_id && r[2] === '18'), 'job table: ' + JSON.stringify(rows));
    const lim = await page.$eval('#t-limits', e => e.innerText);
    assert(lim.includes(failed[0].job_id.slice(0, 8)) && /413/.test(lim), 'limits table');
    await page.waitForTimeout(400);
    const seeds = await page.$$eval('#t-fit td[id^="t-seed"]', t => t.map(x => x.textContent));
    assert(seeds.length === 6 && seeds.every(s => /^\d+ \u00b7 \d+ \/ \d+ \u00b7 \d+$/.test(s)), 'seed census column: ' + JSON.stringify(seeds));
    return n + ' drawers; seeds q/g per strength ' + seeds.join(' | ');
  });

  await step('restored sections: titled bars, first-version words verbatim, no "Bonus", graphs visible and wired to the sky', async () => {
    const bars = await page.$$eval('.sec .bar-h', b => b.map(x => x.textContent.trim()));
    assert(JSON.stringify(bars) === JSON.stringify(['How to play', 'The data', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits']), 'section bars ' + JSON.stringify(bars));
    const body = await page.evaluate(() => document.body.innerText);
    for (const t of ['Drag the sky to explore the patch; zoom with + and −.', 'Slide the blur from a perfect telescope to a blurry one.', 'Wipe across the sky to compare the original with the blur.',
      'Drag the sky to explore. Drag the round handle to wipe between the original and the blur.', 'Keys: arrows pan, shift plus arrows move the wipe, plus and minus zoom, hold space to see the original.',
      'There is no quantum advantage here.'])
      assert(body.includes(t), 'missing verbatim text: ' + t);
    assert(!/bonus/i.test(body) && (await $t('.wtnr-bar .count')) === 'Challenge 11', 'brand bar / no Bonus: ' + await $t('.wtnr-bar .count'));
    const vis = await page.$$eval('#ruler, #t-fit, #t-limits, #t-jobs, #sky', els => els.map(e => { const r = e.getBoundingClientRect(); return !e.closest('details') && r.width > 100 && r.height > 20; }));
    assert(vis.length === 5 && vis.every(Boolean), 'graphs visible outside drawers: ' + JSON.stringify(vis));
    const labs = await page.$$eval('#ruler .lab', l => l.map(x => x.textContent));
    assert(JSON.stringify(labs) === JSON.stringify(['Planck', 'WMAP', 'this map 1°', 'COBE 7°', 'sharper', 'blurrier']), 'ruler labels ' + JSON.stringify(labs));
    const me = () => page.$eval('#ruler .me', e => parseFloat(e.style.left));
    await page.click('[data-stop="0"]'); await page.waitForTimeout(60);   // also leaves the COBE view a story card may have set
    assert((await $t('#lvl-val')) === '0' && (await pressed('[data-kind="q"]')) === 'true', 'Fig. 1 stop 0');
    const m0 = await me();
    await page.click('[data-stop="6"]'); await page.waitForTimeout(60);
    const m6 = await me();
    assert((await $t('#lvl-val')) === '1' && m6 > m0 + 5, `Fig. 1 strength 1 drives the sky and moves the marker ${m0} -> ${m6}`);
    assert((await $t('#n-kept2')) === (await $t('#n-kept')) && (await $t('#n-std2')) === (await $t('#n-std')) && (await $t('#beam-txt2')) === (await $t('#beam-txt')), 'Fig. 1 meters mirror the panel');
    assert(await page.$eval('#t-fit tr[data-lv="6"]', r => r.classList.contains('on')) && await page.$eval('#t-jobs tr[data-lv="6"]', r => r.classList.contains('on')), 'table rows follow the sky');
    await page.click('#fig-beam [data-kind="c"]'); await page.waitForTimeout(60);
    assert((await $t('#lvl-val')) === '7°' && (await me()) > m6, 'Fig. 1 COBE button');
    await page.click('[data-job="2"]'); await page.waitForTimeout(400);
    const j = done[1];
    assert((await $t('#r-job')).startsWith(j.job_id) && (await $t('#lvl-val')) === String(j.strength), 'Table 2 Show puts job 2 on the sky: ' + await $t('#r-job'));
    await page.click('[data-goto="data"]'); await page.waitForTimeout(500);
    await page.click('[data-goto="stage"]'); await page.waitForTimeout(500);
    assert(await page.evaluate(() => document.activeElement === document.getElementById('cv')), 'Go to the sky focuses the sky');
    return 'bars ' + bars.length + '; marker ' + m0.toFixed(1) + '% -> ' + m6.toFixed(1) + '%';
  });

  await step('share link: copy this view, reload with the hash, and the whole state comes back', async () => {
    await page.click('[data-show="1"]');   // a known start, then a distinctive view
    await page.focus('#lvl'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.click('[data-kind="g"]'); await page.click('[data-mode="b"]'); await page.click('#cold'); await page.click('#seeds');
    await page.click('#z-in'); await page.click('[data-scene="d"]');
    const want = await S();
    await page.click('#share'); await page.waitForTimeout(250);
    const hash = await page.evaluate(() => location.hash);
    assert(/^#v1~[A-Za-z0-9._~-]+$/.test(hash), 'hash token ' + hash);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip === base + hash, 'clipboard holds the link: ' + clip);
    assert(/copied/.test(await $t('#toast')), 'toast: ' + await $t('#toast'));
    for (const how of ['reload', 'fresh tab']) {
      let p2 = page;
      if (how === 'reload') await page.reload({ waitUntil: 'networkidle' });
      else { p2 = await ctx.newPage(); watch(p2); await p2.goto(base + hash, { waitUntil: 'networkidle' }); }
      await p2.waitForTimeout(400);
      const got = await p2.evaluate(() => ({ ...st }));
      for (const k of ['level', 'kind', 'mode', 'cold', 'seeds', 'data']) assert(got[k] === want[k], `${how}: ${k} ${got[k]} != ${want[k]}`);
      for (const k of ['z', 'cx', 'cy', 'wipe']) assert(Math.abs(got[k] - want[k]) < 0.06, `${how}: ${k} ${got[k]} != ${want[k]}`);
      const ui = await p2.evaluate(() => ({ lvl: document.getElementById('lvl-val').textContent, g: document.querySelector('[data-kind="g"]').getAttribute('aria-pressed'),
        b: document.querySelector('[data-mode="b"]').getAttribute('aria-pressed'), cold: document.getElementById('cold').textContent,
        seeds: document.getElementById('seeds').getAttribute('aria-pressed'), data: document.querySelector('[data-scene="d"]').getAttribute('aria-pressed'), round: serialize(st) }));
      assert(ui.lvl === '0.25' && ui.g === 'true' && ui.b === 'true' && ui.cold === 'Hide the Cold Spot' && ui.seeds === 'true' && ui.data === 'true', how + ' UI: ' + JSON.stringify(ui));
      assert('#' + ui.round === hash, `${how}: state re-serialises to ${ui.round}`);
      if (p2 !== page) await p2.close();
    }
    return hash;
  });

  await step('nav: brand bar, prev (17), hub, next (19) and the jump list of all pieces', async () => {
    assert((await page.$eval('.wtnr-bar a', a => a.href)) === HUB, 'brand bar links the hub');
    const nav = await page.$eval('nav.wtnr-nav', n => ({ prev: n.querySelector('a[rel="prev"]').href, prevT: n.querySelector('a[rel="prev"]').textContent,
      next: n.querySelector('a[rel="next"]').href, nextT: n.querySelector('a[rel="next"]').textContent, hub: n.querySelector('a.wn-hub').href,
      items: [...n.querySelectorAll('ol a')].map(a => a.href), cur: (n.querySelector('ol a[aria-current="page"]') || {}).textContent }));
    assert(nav.prev === urls['17-quantum-lenia'] && /17 Quantum Lenia/.test(nav.prevT), 'prev ' + nav.prev + ' ' + nav.prevT);
    assert(nav.next === urls['19-frog-chorus'] && /19 Frog Chorus/.test(nav.nextT), 'next ' + nav.next + ' ' + nav.nextT);
    assert(nav.hub === HUB, 'hub');
    assert(nav.items.length === 22 && nav.items.every(u => /^https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+$/.test(u)), 'jump list ' + nav.items.length);
    assert(nav.items.includes(urls[SLUG]) && /18\s*Oldest Light/.test(nav.cur || ''), 'current piece marked: ' + nav.cur);
    const foot = await page.$eval('nav.wtnr-nav', n => n.nextElementSibling && n.nextElementSibling.classList.contains('wtnr-foot'));
    assert(foot, 'nav sits just before the footer');
    await page.click('nav.wtnr-nav summary'); assert(await page.$eval('nav.wtnr-nav details', d => d.open), 'jump list opens');
    return 'prev ' + nav.prev.slice(-22) + ' next ' + nav.next.slice(-22);
  });

  await step('sound: the piece ships no audio; no control creates an AudioContext or plays media (nothing autoplays)', async () => {
    const media = await page.$$eval('audio,video', m => m.length);
    const q = await page.evaluate(() => ({ ...window.__qa }));
    const audioFiles = fs.readdirSync(WEB, { recursive: true }).filter(f => /\.(wav|mp3|ogg|m4a|webm|mp4)$/i.test(String(f)));
    assert(media === 0 && audioFiles.length === 0 && q.ctx === 0 && q.sources === 0 && q.media === 0, 'unexpected audio: ' + JSON.stringify({ media, audioFiles, q }));
    assert(/no audio or video deliverables, so nothing on the page makes sound/.test(readme), 'README states the piece is silent');
    return 'no audio deliverable (README); sources started 0, media events 0';
  });

  await step('phone width (375 px): no horizontal scroll, nav buttons wrap', async () => {
    const m = await browser.newContext({ viewport: { width: 375, height: 812 } }); const p3 = await m.newPage(); watch(p3);
    await p3.goto(base, { waitUntil: 'networkidle' }); await p3.waitForTimeout(400);
    const over = await p3.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const navOver = await p3.$$eval('nav.wtnr-nav a.wn-btn', a => a.filter(x => x.getBoundingClientRect().right > innerWidth + 1).length);
    assert(over <= 1 && navOver === 0, `overflow ${over}px, nav buttons off-screen ${navOver}`);
    await m.close();
  });

  await step('data consistency: page numbers = piece.json = README = PARAMS.md = cache; deliverables exist; files.json complete', async () => {
    const D = await page.evaluate(() => ({ levels: D.levels.map(L => ({ s: L.strength, id: L.job_id, q: L.qubits, sec: L.seconds })), failed: D.failed.map(f => ({ id: f.job_id, q: f.qubits })) }));
    assert(piece.qubits === 18 && piece.jobs === D.levels.length && piece.jobs === done.length, 'piece.json qubits/jobs');
    assert(piece.hardware === null && piece.engines.length === 1 && piece.engines[0] === 'blur-core-v1', 'piece.json engine/hardware');
    assert(D.levels.every(L => L.q === 18 && cacheIds.has(L.id) && cacheIds.get(L.id).seconds === L.sec && cacheIds.get(L.id).shape.join('x') === '257x257'), 'levels vs cache');
    assert(D.failed.length === 1 && D.failed[0].q === 19 && ledger.includes(D.failed[0].id), 'failed job recorded in cache/ledger.jsonl');
    assert(/\*\*Qubits: 18 per job\.\*\*/.test(readme) && /6 completed \+ 1 failed \(19 qubits\), 7 credits/.test(readme) && piece.credits_spent === 7, 'README qubits/jobs/credits');
    for (const id of D.levels.map(L => L.id).concat(D.failed.map(f => f.id))) assert(params.includes(id) && readme.includes('blur-core-v1'), 'PARAMS.md lists ' + id);
    for (const pre of ['43503eaa', '02b057fb', 'a8a739fb']) assert(ledger.includes(pre), 'sibling job ' + pre + ' in the ledger');
    const missing = piece.deliverables.filter(f => !fs.existsSync(path.join(PIECE, f)));
    const rmFiles = [...readme.matchAll(/`((?:web|out|tests|qa)\/[^`*]+?|[\w.]+\.(?:py|png|md|json))`/g)].map(m => m[1]).filter(f => !f.includes('*') && !f.includes(' '));
    const rmMissing = rmFiles.filter(f => !fs.existsSync(path.join(PIECE, f)) && !fs.existsSync(path.join(PIECE, 'web', f)) && !fs.existsSync(path.join(PIECE, 'out', f)) && !fs.existsSync(path.join(ROOT, 'common', f)));
    assert(missing.length === 0 && rmMissing.length === 0, 'missing deliverables ' + JSON.stringify(missing) + ' README paths ' + JSON.stringify(rmMissing));
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'), fm = JSON.parse(fs.readFileSync(path.join(WEB, 'files.json'), 'utf8'));
    const rel = [...html.matchAll(/(?<![\w-])(?:href|src)\s*=\s*["']([^"']+)["']/g)].map(m => m[1]).filter(l => !/^(https?:|data:|#|mailto:|blob:|javascript:)/.test(l) && !l.includes('{'));
    assert(rel.length > 0 && rel.every(l => fm[l] && fs.existsSync(path.join(ROOT, fm[l]))), 'files.json misses ' + JSON.stringify(rel.filter(l => !fm[l])));
    assert(Object.values(fm).every(f => fs.existsSync(path.join(ROOT, f))), 'files.json points at missing files');
    return `${D.levels.length} jobs in cache, failed ${D.failed[0].id.slice(0, 8)} in ledger, ${piece.deliverables.length} deliverables, ${rmFiles.length} README paths, files.json ${Object.keys(fm).join(', ')}`;
  });

  await step('no page errors and no requests beyond Google Fonts', async () => {
    const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
    assert(errors.length === 0, 'errors: ' + errors.slice(0, 5).join(' | '));
    assert(bad.length === 0, 'external hosts: ' + bad.join(', '));
  });

  const out = { piece: SLUG, ok: steps.every(s => s.ok), passed: steps.filter(s => s.ok).length, total: steps.length, steps };
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ok: out.ok, passed: out.passed, total: out.total }));
  await browser.close(); server.close();
  process.exit(out.ok ? 0 : 1);
})();
