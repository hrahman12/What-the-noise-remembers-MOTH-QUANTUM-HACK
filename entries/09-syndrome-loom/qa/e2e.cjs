// End-to-end journey for Syndrome Loom: node entries/09-syndrome-loom/qa/e2e.cjs [port 6360-6369]
// Serves web/ locally, opens the built page in headless Chromium and walks the main journey with real assertions:
// load (no sound, real numbers), check every restored graph renders (the woven-cloth canvas has a picture, the
// logical-vs-physical SVG chart has its 4 series, 12 job points, axes and legend), switch the loom sound on, weave the demo moth (pause, resume, finish with a verdict),
// turn the noise dial through every notch and both profiles (each shown job ID must match PARAMS.md and exist in
// cache/tamagotchi-v1), inspect a block by click and by keyboard, switch view / codewords / width / seed, toggle
// Scene and Data, check the titled sections below the loom (the chart always visible in The data, the honesty
// notes, the jobs table), open every science drawer, copy the WIF draft, load your own image and go back, copy a link and
// reload it (state restored), check the prev / hub / next navigation, reduced motion, the 375 px layout and the
// hand-copy fallback when the clipboard is blocked.
// Writes qa/e2e.json and exits 1 on the first failed assertion.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6360);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8');
// every job ID in the engine's cache of completed jobs
const cached = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'cache', 'tamagotchi-v1'))) {
  if (!f.endsWith('.json')) continue;
  for (const m of fs.readFileSync(path.join(ROOT, 'cache', 'tamagotchi-v1', f), 'utf8').matchAll(/"job_id":\s*"([0-9a-f-]{36})"/g)) cached.add(m[1]);
}
// PARAMS.md grid rows: | profile | noise | p | yes/no | ... | `job_id` |
const grid = {};
for (const m of params.matchAll(/^\| (loom|thread) \| [^|]+\| ([0-9.]+) \| (yes|no) \|.*`([0-9a-f-]{36})` \|$/gm)) grid[m[1] + '_' + m[2] + '_' + m[3]] = m[4];
const ladder = [...params.matchAll(/^\| (\d+) \| [\d,]+ \| \d+ \| \d+ \| [0-9.]+ % \| `([0-9a-f-]{36})` \|$/gm)].map(m => ({ n: +m[1], id: m[2] }));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { const c = new AC(...a); window.__qa.ctx++; (window.__qa.ctxs ||= []).push(c); return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
    // AudioBufferSourceNode has its own start(), so wrap it as well as the base class (oscillators)
    for (const P of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
      if (!Object.prototype.hasOwnProperty.call(P, 'start')) continue;
      const st = P.start; P.start = function (...a) { window.__qa.sources++; return st.apply(this, a); };
    }
  }
};

const steps = [];
const step = (name, detail) => { steps.push(detail ? name + ': ' + detail : name); console.log('ok  ' + name + (detail ? ' (' + detail + ')' : '')); };
const base = `http://127.0.0.1:${port}/index.html`;

(async () => {
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(opts = {}, hash = '') {
    const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 900 }, reducedMotion: opts.reducedMotion || 'no-preference' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
    await page.addInitScript(INSTRUMENT);
    // a host that blocks the clipboard (the published artifact frame can): writeText rejects
    if (opts.blockClipboard) await page.addInitScript(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('blocked', 'NotAllowedError')); });
    await page.goto(base + hash, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    return { ctx, page };
  }
  const txt = (page, sel) => page.locator(sel).first().evaluate(e => e.textContent); // textContent: CSS uppercases some labels
  const num = async (page, sel) => +(await txt(page, sel)).replace(/[^0-9]/g, '');
  const sources = page => page.evaluate(() => window.__qa.sources);
  const setRange = (page, sel, v) => page.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, v]);
  // the cloth area of the loom canvas: sampled colours, how many samples are ink (dark), and a signature of the pixels
  const clothSig = page => page.evaluate(() => {
    const c = document.getElementById('cv'), g = c.getContext('2d'), cl = LY.cl;
    const d = g.getImageData(cl.x, cl.y, cl.w, cl.h).data, cols = new Set();
    let ink = 0, n = 0, h = 0;
    for (let i = 0; i < d.length; i += 4 * 13) { n++; cols.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); if (d[i + 3] && d[i] + d[i + 1] + d[i + 2] < 330) ink++; h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) >>> 0; }
    return { w: c.width, h: c.height, cols: cols.size, ink, n, sig: h };
  });
  // a chart SVG: rendered size, series, points, gridlines, labels and legend icons
  const svgStats = (page, sel) => page.evaluate(sel => {
    const s = document.querySelector(sel), r = s.getBoundingClientRect(), fig = s.closest('figure');
    return { w: r.width, h: r.height, polylines: s.querySelectorAll('polyline').length,
      points: s.querySelectorAll(':scope > circle, :scope > path').length, lines: s.querySelectorAll('line').length,
      text: [...s.querySelectorAll('text')].map(t => t.textContent).join('|'),
      legendIcons: fig ? fig.querySelectorAll('figcaption svg').length : 0 };
  }, sel);
  // read what a copy button put on the clipboard, or in the manual-copy fallback when the clipboard is blocked
  async function copied(page) {
    await page.waitForTimeout(250);
    const manual = await page.locator('#manual').isVisible();
    return manual ? page.inputValue('#manual-text') : page.evaluate(() => navigator.clipboard.readText());
  }

  try {
    // ---- 1. load: scene first, honest numbers, nothing sounds ----
    let { ctx, page } = await open();
    assert.strictEqual(await page.title(), 'Syndrome Loom');
    assert.strictEqual((await txt(page, 'h1')).trim(), piece.hook);
    assert(await page.locator('#cv').isVisible(), 'the loom scene is not the first view');
    assert(await page.locator('#data-wrap').isHidden(), 'the live copy of the chart should be one click away');
    // the brand bar names the challenge; all entries are equal (no ranking words anywhere)
    assert.strictEqual((await txt(page, '.wtnr-bar .count')).replace(/\s+/g, ' ').trim(), 'Challenge 09 '+String.fromCharCode(183)+' Lose');
    assert(!/\bbonus\b|main entry/i.test(await page.evaluate(() => document.body.innerText)), 'ranking words on the page');
    // titled sections below the loom, in order, each with a visible ink-bar heading
    const SECTIONS = [['how-to-play', 'How to play'], ['the-data', 'The data'], ['the-science', 'The science'], ['how-it-was-made', 'How it was made'], ['no-claims', 'What this does not claim'], ['jobs-credits', 'Jobs and credits']];
    const order = await page.evaluate(() => [...document.querySelectorAll('section.sect')].map(s => s.id));
    assert.deepStrictEqual(order, SECTIONS.map(x => x[0]), 'section order: ' + order);
    for (const [id, title] of SECTIONS) {
      assert(await page.locator('#' + id + ' > .ink-bar h2').isVisible(), id + ' heading not visible');
      assert((await txt(page, '#' + id + ' > .ink-bar h2')).startsWith(title), id + ' heading: ' + await txt(page, '#' + id + ' > .ink-bar h2'));
    }
    assert(await page.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(), s = document.getElementById('how-to-play').getBoundingClientRect(); return s.top > c.bottom; }), 'sections must sit below the loom scene');
    // The data: the earlier chart, visible without any toggle, with 12 job points, legend, caption and live note
    assert(await page.locator('#the-data #chart').isVisible(), 'the chart is not visible in The data');
    assert.strictEqual((await txt(page, '#chart-h')).trim(), 'When does the code earn its keep?');
    assert(await page.locator('#chart circle').count() >= 12, 'chart points missing in The data');
    const legend = await txt(page, '#legend');
    for (const l of ['whole loom, 1 SE round', 'only the thread, 1 SE round', 'whole loom, no SE round', 'only the thread, no SE round', 'no flips seen: 95% upper bound, 3/n', 'now on the loom']) assert(legend.includes(l), 'legend: ' + l);
    assert((await txt(page, '#chart-note')).includes('Now on the loom: p = 0.005, noise on the whole loom'), await txt(page, '#chart-note'));
    assert(await page.locator('#chart #mark circle').count() === 1, 'live marker missing');
    // How to play keeps the earlier steps word for word
    const stepText = await txt(page, '#how-to-play .steps');
    for (const w of ['Each notch replays a real tamagotchi-v1 job.', 'from the top, or drag through the picks, and switch between the threads as read and after correction.', "your own image. It's woven in your browser from the engine's recorded rates.", 'the WIF 1.1 draft and open it in any weaving program.']) assert(stepText.includes(w), 'step text: ' + w);
    // What this does not claim: visible honesty notes; Jobs and credits: the 12 grid jobs
    assert.strictEqual(await page.locator('#no-claims .honesty').count(), 3);
    assert(await page.locator('#no-claims .honesty').first().isVisible(), 'honesty notes not visible');
    assert.strictEqual(await page.locator('#gridjobs tr.top').count(), 12, 'grid jobs table should list 12 jobs');
    assert(await page.locator('#the-science details.drawer').first().evaluate(d => d.open), 'the science drawer should start open');
    const gj = await txt(page, '#gridjobs');
    for (const k of Object.keys(grid)) assert(gj.includes(grid[k]), 'grid job missing from Jobs and credits: ' + k);
    assert((await txt(page, '#jobs-count')).startsWith(piece.jobs + ' completed jobs'));
    const proof = await txt(page, '#proof');
    assert(proof.includes(piece.qubits.toLocaleString('en-US') + ' data qubits'), 'proof chip qubits: ' + proof);
    assert(proof.includes(piece.jobs + ' real Atlas jobs'), 'proof chip jobs: ' + proof);
    assert((await txt(page, '#how-it-was-made .ink-bar')).includes(piece.jobs + ' real Atlas jobs'));
    assert.strictEqual(piece.hardware, null);
    assert((await txt(page, '.readout')).includes('Aer stabilizer simulator'));
    assert.strictEqual(await page.evaluate(() => window.__qa.sources + window.__qa.ctx), 0, 'sound or an AudioContext before any click');
    assert.strictEqual(await txt(page, '#p-val'), '0.005');
    assert((await txt(page, '#r-job')).startsWith(grid['loom_0.005_yes']));
    assert.strictEqual(await num(page, '#m-blocks'), 32 * 24);
    step('load', 'scene first, ' + piece.qubits + ' qubits and ' + piece.jobs + ' jobs match piece.json, no sound; Challenge 09 brand bar; 6 titled sections below the loom; The data chart visible with 12 points, legend and live note; 3 honesty notes; 12 grid jobs listed');

    // ---- 1b. every restored graph renders: the woven cloth (canvas, C4) and the logical-vs-physical chart (SVG, G1) ----
    const cloth = await clothSig(page);
    assert(cloth.w > 0 && cloth.h > 0, 'cloth canvas has no size');
    assert(cloth.cols >= 4, 'cloth canvas is blank or flat: ' + cloth.cols + ' colours');
    assert(cloth.ink > 0 && cloth.ink < cloth.n, 'cloth shows no picture (ink ' + cloth.ink + ' of ' + cloth.n + ' samples)');
    const g1 = await svgStats(page, '#chart');
    assert(g1.w > 200 && g1.h > 150, 'chart SVG has no visible size: ' + JSON.stringify(g1));
    assert.strictEqual(g1.polylines, 4, 'chart should draw 4 series');
    assert(g1.points >= 12, 'chart points (circles + 3/n triangles): ' + g1.points);
    assert(g1.lines >= 9, 'chart gridlines and diagonal: ' + g1.lines);
    for (const t of ['physical noise p', 'logical flip rate', 'logical = physical', '1e-5', '1e-1', '0.001', '0.005', '0.01']) assert(g1.text.includes(t), 'chart label missing: ' + t);
    assert(g1.legendIcons >= 6, 'legend icons: ' + g1.legendIcons);
    step('graphs render', `woven cloth canvas ${cloth.w}x${cloth.h} with ${cloth.cols} sampled colours and ink on ${cloth.ink} of ${cloth.n} samples; chart ${Math.round(g1.w)}x${Math.round(g1.h)} px with 4 series, ${g1.points} job points, axes, diagonal and ${g1.legendIcons} legend icons`);

    // ---- 2. loom sound on: a click starts real Web Audio ----
    let s0 = await sources(page);
    await page.click('#sound');
    assert.strictEqual(await page.getAttribute('#sound', 'aria-pressed'), 'true');
    assert.strictEqual((await txt(page, '#sound')).trim(), 'Loom sound: on');
    assert(await sources(page) > s0, 'switching the sound on made no sound');
    assert(await page.evaluate(() => (window.__qa.ctxs || []).some(c => c.state === 'running')), 'AudioContext not running');
    step('sound on', 'AudioContext running, clack played');

    // ---- 3. weave the moth: start, pause, resume, finish with the measured verdict ----
    s0 = await sources(page);
    await page.click('#weave');
    assert.strictEqual((await txt(page, '#weave')).trim(), 'Pause');
    await page.waitForTimeout(900);
    const mid = +(await page.inputValue('#picks'));
    assert(mid > 0 && mid < 168, 'weaving did not advance: ' + mid);
    assert(await sources(page) > s0 + 3, 'no loom ticks while weaving with sound on');
    await page.click('#weave');
    assert.strictEqual((await txt(page, '#weave')).trim(), 'Keep weaving');
    const paused = +(await page.inputValue('#picks'));
    await page.waitForTimeout(500);
    assert.strictEqual(+(await page.inputValue('#picks')), paused, 'Pause did not stop the loom');
    await page.click('#weave');
    await page.waitForFunction(() => document.getElementById('weave').textContent === 'Weave from the top', null, { timeout: 30000 });
    assert.strictEqual(await txt(page, '#picks-out'), '168 / 168 picks');
    assert(/^\d+ red stitches caught, \d+ pixels lost$/.test(await txt(page, '#toast')), 'weave-end toast: ' + await txt(page, '#toast'));
    const verdict = await page.evaluate(() => ({ pose: anim.react && anim.react.pose, bub: anim.bubW && anim.bubW.text, ins: anim.bubI && anim.bubI.text, red: cur.c.flagged, failed: cur.c.failed, ler: cur.lv.se.logical_error_rate, p: cur.lv.p }));
    assert.strictEqual(verdict.pose, verdict.ler < verdict.p ? 'cheer' : 'sigh');
    assert.strictEqual(verdict.bub, verdict.failed + (verdict.failed === 1 ? ' pixel' : ' pixels') + ' slipped through');
    assert.strictEqual(verdict.ins, verdict.red + ' caught');
    assert.strictEqual(await num(page, '#m-red'), verdict.red);
    assert(verdict.red > 0, 'no red stitches at p = 0.005');
    step('weave', `paused at pick ${paused}, finished 168 picks: ${verdict.red} red stitches, ${verdict.failed} pixels slipped, Ada ${verdict.pose}s (logical ${verdict.ler} vs p ${verdict.p})`);

    // ---- 4. sound off: the loom goes quiet ----
    await page.click('#sound');
    assert.strictEqual((await txt(page, '#sound')).trim(), 'Loom sound: off');
    s0 = await sources(page);
    await page.click('#weave'); await page.waitForTimeout(700); await page.click('#weave');
    assert.strictEqual(await sources(page), s0, 'sound kept playing after switching it off');
    await setRange(page, '#picks', '168');
    step('sound off', 'no sources started while weaving');

    // ---- 5. the noise dial and the profile: every notch replays the PARAMS.md job ----
    const reds = {}, clothSigs = new Set();
    for (const prof of ['loom', 'thread']) {
      await page.click(`[data-prof="${prof}"]`);
      for (const p of ['0.001', '0.005', '0.01']) {
        await page.click(`#ticks button[data-p="${p}"]`);
        assert.strictEqual(await txt(page, '#p-val'), p);
        assert.strictEqual(await page.getAttribute(`#ticks button[data-p="${p}"]`, 'aria-pressed'), 'true');
        const job = (await txt(page, '#r-job')).split(' ')[0], bare = (await txt(page, '#r-bare')).trim();
        assert.strictEqual(job, grid[`${prof}_${p}_yes`], `${prof} p=${p} SE job`);
        assert.strictEqual(bare, grid[`${prof}_${p}_no`], `${prof} p=${p} no-SE job`);
        assert(cached.has(job) && cached.has(bare), 'job not in cache/tamagotchi-v1: ' + job + ' ' + bare);
        assert((await txt(page, '#r-size')).startsWith('256 logical qubits = 1,792 data qubits'));
        reds[prof + p] = await num(page, '#m-red');
        await page.waitForTimeout(80);
        clothSigs.add((await clothSig(page)).sig);
      }
    }
    // same seed, higher p: the sampled events only grow
    assert(reds['loom0.001'] <= reds['loom0.005'] && reds['loom0.005'] <= reds['loom0.01'], JSON.stringify(reds));
    assert(reds['thread0.001'] <= reds['thread0.005'] && reds['thread0.005'] <= reds['thread0.01'], JSON.stringify(reds));
    assert(clothSigs.size >= 5, 'the woven cloth did not redraw for each job: ' + clothSigs.size + ' distinct of 6');
    await setRange(page, '#dial', '0');
    assert.strictEqual(await txt(page, '#p-val'), '0.001');
    await setRange(page, '#dial', '2');
    assert.strictEqual(await txt(page, '#p-val'), '0.01');
    const pose = await page.evaluate(() => anim.react.pose);
    assert.strictEqual(pose, 'cheer', 'only-the-thread at p = 0.01 measured below p: Ada should cheer');
    step('dial', '3 notches x 2 profiles: every job ID matches PARAMS.md and exists in the cache; the cloth redrew (' + clothSigs.size + ' distinct cloths); red stitches ' + JSON.stringify(reds));

    // ---- 6. inspect a block by click and by keyboard ----
    const pt = await page.evaluate(() => { const r = cv.getBoundingClientRect(), k = r.width / cv.width;
      return { x: r.left + (LY.cl.x + LY.cl.w * (10.5 / cur.cols)) * k, y: r.top + (LY.cl.y + LY.cl.h * (5.5 / cur.rows)) * k }; });
    await page.mouse.click(pt.x, pt.y);
    let ins = await txt(page, '#inspect');
    assert(/Block \(10, 5\)/.test(ins) && /Syndrome [01]{3}/.test(ins), ins);
    await page.keyboard.press('ArrowRight');
    ins = await txt(page, '#inspect');
    assert(/Block \(11, 5\)/.test(ins), 'arrow key did not move the inspector: ' + ins);
    assert(await page.evaluate(() => anim.ins.pose === 'look' && !!anim.bubI.text), 'the inspector did not react');
    step('inspect', 'click picked block (10, 5), ArrowRight moved to (11, 5)');

    // ---- 7. view, codewords, re-roll, width ----
    await page.click('[data-view="corrected"]');
    assert.strictEqual(await page.getAttribute('[data-view="corrected"]', 'aria-pressed'), 'true');
    assert((await txt(page, '#inspect')).includes('Corrected'));
    await page.click('[data-cw="measured"]');
    assert.strictEqual(await page.getAttribute('[data-cw="measured"]', 'aria-pressed'), 'true');
    await page.click('#reroll');
    assert((await txt(page, '#r-seed')).startsWith('seed 2 '));
    assert.strictEqual(await txt(page, '#toast'), 'New shot: seed 2');
    await page.selectOption('#width', '48');
    assert((await txt(page, '#src')).startsWith('Demo moth (48'), await txt(page, '#src'));
    const rows48 = await page.evaluate(() => cur.rows);
    assert.strictEqual(await num(page, '#m-blocks'), 48 * rows48);
    assert((await txt(page, '#r-seed')).includes('48 \u00d7 ' + rows48 + ' blocks'));
    step('controls', `after correction, Z-readout codewords, seed 2, moth re-woven 48 x ${rows48}`);

    // ---- 8. Scene / Data ----
    await page.click('#weave'); await page.waitForTimeout(300);
    await page.click('[data-mode="data"]');
    assert(await page.locator('#data-wrap').isVisible() && await page.locator('#scene-wrap').isHidden());
    assert.strictEqual((await txt(page, '#weave')).trim(), 'Keep weaving', 'leaving the scene should pause the weave and say so');
    assert(await page.locator('#chart-live circle').count() >= 12, 'live chart points missing');
    const g1live = await svgStats(page, '#chart-live');
    assert(g1live.w > 150 && g1live.h > 100 && g1live.polylines === 4 && g1live.points === g1.points && g1live.legendIcons >= 6, 'live chart copy does not render: ' + JSON.stringify(g1live));
    assert(await page.locator('#chart-live #mark-live circle').count() === 1, 'live marker missing in the stage copy');
    assert((await txt(page, '#chart-note-live')).includes('p = 0.01, noise only in the thread'));
    assert((await txt(page, '#chart-note')).includes('p = 0.01, noise only in the thread'));
    assert(await page.locator('#the-data #chart').isVisible(), 'The data chart must stay visible while the stage shows Data');
    await page.click('[data-mode="scene"]');
    assert(await page.locator('#cv').isVisible() && await page.locator('#data-wrap').isHidden());
    await setRange(page, '#picks', await page.evaluate(() => cur.cells.length));
    step('scene/data', 'live chart copy with 12 job points and the marker beside the dial; The data chart stays visible; weave paused when leaving the scene');

    // ---- 9. science drawers ----
    const drawers = page.locator('section.more details.drawer');
    const nd = await drawers.count();
    assert.strictEqual(nd, 3, 'drawers in The science and How it was made');
    for (let i = 0; i < nd; i++) {
      if (!(await drawers.nth(i).evaluate(d => d.open))) await drawers.nth(i).locator('summary').click(); // The science starts open
      assert(await drawers.nth(i).evaluate(d => d.open), 'drawer ' + i + ' did not open');
      assert(await drawers.nth(i).locator('.body').isVisible());
    }
    const lad = await txt(page, '#ladder');
    for (const l of ladder) {
      assert(lad.includes(l.id), 'ladder job missing on the page: ' + l.id);
      assert(cached.has(l.id), 'ladder job not in cache: ' + l.id);
    }
    assert.strictEqual(ladder.length, 4);
    assert.strictEqual(await page.locator('#ladder td.id').count(), ladder.length, 'size-ladder table rows');
    assert(await page.locator('#ladder').isVisible(), 'size-ladder table not visible in its open drawer');
    const allIds = (await page.content()).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || [];
    for (const id of allIds) assert(cached.has(id), 'job ID on the page is not in cache/tamagotchi-v1: ' + id);
    step('drawers', `${nd} drawers open; ladder IDs match PARAMS.md; all ${new Set(allIds).size} job IDs in the page exist in the cache`);

    // ---- 10. copy the WIF draft ----
    await page.click('#copy-wif');
    const wif = await copied(page);
    assert(wif.startsWith('[WIF]\r\nVersion=1.1'), 'WIF not copied');
    assert(wif.includes('Threads=' + 48 * 7) && wif.includes(grid['thread_0.01_yes']), 'WIF does not match the view');
    step('copy WIF', `${wif.length} chars, 336 ends, cites the job`);

    // ---- 11. your own image, then back to the moth ----
    await page.setInputFiles('#file', path.join(WEB, 'img', 'mascot.png'));
    await page.waitForFunction(() => document.getElementById('src').textContent.startsWith('Your image'));
    assert(await page.locator('#demo').isVisible());
    assert.strictEqual((await txt(page, '#file-label')).trim(), 'Load another image');
    const userBlocks = await num(page, '#m-blocks');
    await page.selectOption('#width', '24');
    await page.waitForFunction(() => document.getElementById('src').textContent.startsWith('Your image (24'));
    assert.notStrictEqual(await num(page, '#m-blocks'), userBlocks, 'width did not re-weave your image');
    await page.click('#demo');
    assert((await txt(page, '#src')).startsWith('Demo moth (24'));
    assert(await page.locator('#demo').isHidden());
    await page.selectOption('#width', '48');
    step('own image', 'mascot.png woven in the browser at 48 and 24 wide, then back to the moth');

    // ---- 12. share a link and reload it ----
    await page.click('#share');
    const hash = await page.evaluate(() => location.hash);
    assert.strictEqual(hash, '#thread_p0.01_s2_fixed_measured_w48');
    assert.strictEqual(await copied(page), base + hash);
    const before = { job: await txt(page, '#r-job'), red: await txt(page, '#m-red'), seed: await txt(page, '#r-seed') };
    const cellsBefore = await page.evaluate(() => JSON.stringify(cur.cells));
    await ctx.close();
    ({ ctx, page } = await open({}, hash));
    assert.strictEqual(await txt(page, '#p-val'), '0.01');
    for (const sel of ['[data-prof="thread"]', '[data-view="corrected"]', '[data-cw="measured"]', '#ticks button[data-p="0.01"]'])
      assert.strictEqual(await page.getAttribute(sel, 'aria-pressed'), 'true', sel);
    assert.strictEqual(await page.inputValue('#width'), '48');
    assert.deepStrictEqual({ job: await txt(page, '#r-job'), red: await txt(page, '#m-red'), seed: await txt(page, '#r-seed') }, before);
    assert((await txt(page, '#src')).startsWith('Demo moth (48'));
    assert.strictEqual(await page.evaluate(() => JSON.stringify(cur.cells)), cellsBefore, 'the reloaded link wove a different cloth');
    step('share link', hash + ' restores profile, p, seed, view, codewords and width (same cloth)');

    // ---- 13. navigation to the rest of the set ----
    assert.strictEqual(await page.getAttribute('.wtnr-bar a', 'href'), HUB);
    assert.strictEqual(await page.getAttribute('.wtnr-nav a[rel="prev"]', 'href'), urls['08-pbit-or-qubit']);
    assert.strictEqual(await page.getAttribute('.wtnr-nav a[rel="next"]', 'href'), urls['10-squeezed-chirp']);
    assert.strictEqual(await page.getAttribute('.wtnr-nav a.wn-hub', 'href'), HUB);
    assert((await txt(page, '.wtnr-nav a[rel="prev"]')).includes('08'));
    assert((await txt(page, '.wtnr-nav a[rel="next"]')).includes('10'));
    await page.click('.wtnr-nav summary');
    const list = page.locator('.wtnr-nav ol a');
    assert.strictEqual(await list.count(), Object.keys(urls).length);
    assert.strictEqual(await page.getAttribute('.wtnr-nav ol a[aria-current="page"]', 'href'), urls['09-syndrome-loom']);
    const navFoot = await page.evaluate(() => { const n = document.querySelector('.wtnr-nav'), f = document.querySelector('.wtnr-foot'); return !!(n.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING); });
    assert(navFoot, 'nav should sit just above the footer');
    step('nav', 'brand bar -> hub, prev 08, next 10, hub, all ' + Object.keys(urls).length + ' pieces listed');
    await ctx.close();

    // ---- 14. reduced motion: weaving goes straight to the finished cloth and its verdict ----
    ({ ctx, page } = await open({ reducedMotion: 'reduce' }));
    await setRange(page, '#picks', '20');
    assert.strictEqual(await txt(page, '#picks-out'), '20 / 168 picks');
    await page.click('#weave');
    assert.strictEqual(await txt(page, '#picks-out'), '168 / 168 picks');
    assert.strictEqual((await txt(page, '#weave')).trim(), 'Weave from the top');
    assert(await page.evaluate(() => !!anim.react && /slipped through$/.test(anim.bubW.text)), 'no verdict under reduced motion');
    step('reduced motion', 'Weave finishes at once and shows the verdict');
    await ctx.close();

    // ---- 15. phone width ----
    ({ ctx, page } = await open({ viewport: { width: 375, height: 812 } }));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(over <= 1, 'horizontal overflow at 375 px: ' + over);
    assert(await page.locator('.wtnr-nav a[rel="next"]').isVisible());
    step('375 px', 'no horizontal scroll, nav visible');
    await ctx.close();

    // ---- 16. clipboard blocked: each copy button falls back to selected text that names what it holds ----
    ({ ctx, page } = await open({ blockClipboard: true }));
    await page.click('#share');
    await page.waitForFunction(() => !document.getElementById('manual').hidden, null, { timeout: 5000 });
    assert(await page.locator('#manual').isVisible(), 'no hand-copy fallback when the clipboard is blocked');
    assert.strictEqual(await page.inputValue('#manual-text'), base + '#loom_p0.005_s1_read_plain');
    assert((await txt(page, '#manual-label')).includes('the link to this view'), await txt(page, '#manual-label'));
    assert((await txt(page, '#toast')).includes('the link to this view is selected below'));
    assert(await page.evaluate(() => document.activeElement.id === 'manual-text'), 'fallback text not focused');
    await page.click('#copy-wif');
    await page.waitForFunction(() => document.getElementById('manual-label').textContent.includes('the WIF draft'), null, { timeout: 5000 });
    // a textarea's value normalises CRLF to LF, so the hand-copied draft has LF line ends (WIF readers take both)
    const handWif = await page.inputValue('#manual-text');
    assert(/^\[WIF\]\r?\nVersion=1\.1/.test(handWif), 'fallback does not hold the WIF draft: ' + handWif.slice(0, 40));
    assert(handWif.includes('Threads=' + 32 * 7) && handWif.includes(grid['loom_0.005_yes']), 'fallback WIF does not match the view');
    step('clipboard blocked', 'Copy link and Copy WIF each show their own text, selected, with a label that names it');
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
    await browser.close(); srv.close();
  }
})();
