// End-to-end journey for Tissue Blur: node entries/15-tissue-blur/qa/e2e.cjs [port 6450-6459]
// Serves web/ locally, opens the built page in headless Chromium and walks the main journey with real assertions:
// pick a gene set and a gene, drag the lens (and step it with the keys), push reach to 0.5 and back, catch every
// ghost in a view (the game's outcome), hold the measurement, wipe and sweep, probe a pixel, toggle Scene / Data,
// open the science drawers, read the restored sections (How to play, The data with its side-by-side figure, the per-gene
// table and its probe, What this does not claim, Jobs and credits with Show buttons), check that every text run of the
// earlier page (history/template.pre_sprite.html) is still on the page and that every restored graph renders, copy a
// share link and reload it (state restored), and check the prev / hub / next nav.
// The piece makes no sound, so the audio check asserts silence (no media, no Web Audio source ever started).
// Exits 1 on the first failed assertion; writes qa/e2e.json.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6450);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const D = JSON.parse(fs.readFileSync(path.join(WEB, 'data.json'), 'utf8'));
const jobOf = (set, mask, setting) => D.jobs.find(j => j.composite === set && j.mask === mask && j.setting === setting);
const ghostCount = s => (!s || !s.present || s.ghost_blurred == null || s.ghost_blurred < .01) ? 0 : Math.max(1, Math.floor(s.ghost_blurred * 10 + .5));

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// sound instrumentation, as in common/qa/qa_page.cjs
const INSTRUMENT = () => {
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

const steps = [];
let page, errors = [], failed = [], external = new Set();
async function step(name, fn) {
  try { await fn(); steps.push({ step: name, ok: true }); console.log('ok  ', name); }
  catch (e) { steps.push({ step: name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log('FAIL', name, '\n     ', String(e.message || e).slice(0, 400)); throw e; }
}
const txt = sel => page.$eval(sel, e => e.textContent.trim());
const pressedIn = grp => page.$$eval(`#${grp} button[aria-pressed="true"]`, bs => bs.map(b => b.textContent.trim()));
const btn = (grp, label) => page.locator(`#${grp} button`, { hasText: label }).first();
const waitJob = async (id, ms = 5000) => { await page.waitForFunction(i => document.getElementById('r-job').textContent === i, id, { timeout: ms }); };
const canvasSig = sel => page.$eval(sel, c => { const u = c.toDataURL(); return u.length + ':' + u.slice(-400); });
const sig = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
async function cvPoint(x, y) {   // canvas px (1024 x 640 band) -> viewport px (scrolls the slide into view first)
  await page.locator('#cv').scrollIntoViewIfNeeded();
  const b = await page.locator('#cv').boundingBox();
  return { x: b.x + x / 1024 * b.width, y: b.y + y / D.crop.h * b.height };
}
async function newPage(ctx, hash = '') {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200) + ' @ ' + String(e.stack || '').slice(0, 600) + ' after step: ' + (steps.length ? steps[steps.length - 1].step : 'load')));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  p.on('requestfailed', r => failed.push(r.url() + ' ' + ((r.failure() || {}).errorText || '')));
  p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  p.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  await p.addInitScript(INSTRUMENT);
  await p.goto(`http://127.0.0.1:${port}/index.html${hash}`, { waitUntil: 'networkidle', timeout: 60000 });
  // all engine images decoded (the page draws them into its canvas)
  await p.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 20000 });
  await p.waitForTimeout(500);
  return p;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin }); } catch (e) { /* clipboard is optional: the page falls back to the address bar */ }
  let code = 0, token = '';
  try {
    page = await newPage(ctx);
    const A512 = jobOf('A', 'lens_512', 'echo'), B512 = jobOf('B', 'lens_512', 'echo'), B282 = jobOf('B', 'lens_282', 'echo'),
      B742 = jobOf('B', 'lens_742', 'echo'), B512e = B512, Aplaid = jobOf('A', 'lens_512', 'plaid');

    await step('page opens on the scene: title, hook, real proof chips, default job (A, centre lens, reach 0)', async () => {
      assert.strictEqual(await page.title(), 'Tissue Blur');
      assert.match(await txt('h1'), /Slide a quantum lens across a mouse brain's genes/);
      const proof = await txt('.proof');
      assert.match(proof, /20\s*qubits per blur/); assert.match(proof, /8\s*real Atlas jobs/); assert.match(proof, /95,104\s*measured cells/);
      assert.strictEqual(await txt('#p-jobs'), String(D.jobs.length));
      assert.strictEqual(await txt('#r-job'), A512.job_id);
      assert.match(await txt('#r-mask'), /Centre lens .* 541 . 541 px box .* 20 qubits/);
      assert.match(await txt('#r-params'), /strength 1\.0 . rx . reach 0/);
      assert.strictEqual(await page.$eval('body', b => b.dataset.view), 'scene');
      assert.ok(await page.locator('#case').isVisible(), 'mouse case notes visible in Scene');
      assert.ok(await page.locator('#stats').isVisible(), 'the per-gene table is always visible (The data)');
      assert.strictEqual(await page.$$eval('#stats tr', t => t.length), 3);
      const ink = await page.$eval('#fx', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) n++; return n; });
      assert.ok(ink > 2000, 'sprite overlay drew the cast (' + ink + ' px)');
    });

    await step('audio: the piece makes no sound; no <audio>/<video>, and nothing has started a sound', async () => {
      assert.strictEqual(await page.$$eval('audio,video', a => a.length), 0);
      const q = await page.evaluate(() => window.__qa);
      assert.strictEqual(q.sources + q.media, 0, 'no sound before any action');
    });

    await step('pick the gene set "Folds and tracts": job, gene chips and notes switch to set B', async () => {
      await btn('g-set', 'Folds and tracts').click();
      await waitJob(B512.job_id);
      assert.deepStrictEqual(await pressedIn('g-set'), ['Folds and tracts']);
      const chips = await page.$$eval('#g-gene button', bs => bs.map(b => b.textContent.trim()));
      assert.deepStrictEqual(chips, ['All three', 'Fezf2', 'C1ql2', 'Mog']);
      assert.match(await txt('#gene-notes'), /C1ql2: dentate gyrus · [\d,]+ cells with signal/);
    });

    await step('pick one gene (C1ql2): chip pressed, the mouse and tally speak about that gene only', async () => {
      await btn('g-gene', 'C1ql2').click();
      assert.deepStrictEqual(await pressedIn('g-gene'), ['C1ql2']);
      assert.match(await txt('#say'), /C1ql2's blurred ink/);
      const n = ghostCount(B512.stats[1]);
      assert.match(await txt('#tally'), new RegExp(`^${n} ghosts? in this view`));
    });

    await step('drag the lens from the centre to the front: it snaps to the computed front-lens job', async () => {
      const a = await cvPoint(512, 320 + 262), b = await cvPoint(282, 320 + 262);   // grab the lens by its lower rim (ghosts sit well inside it)
      const before = await canvasSig('#cv');
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 5 });
      assert.strictEqual(await page.$eval('#face', f => f.dataset.k), 'mouseWalk', 'the mouse walks while the lens is dragged');
      await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
      await waitJob(B282.job_id);
      assert.deepStrictEqual(await pressedIn('g-mask'), ['Front']);
      assert.match(await txt('#r-mask'), /Front lens/);
      assert.notStrictEqual(await canvasSig('#cv'), before);
    });

    await step('step the lens with the arrow keys: right twice reaches the back lens', async () => {
      await page.focus('#cv');
      await page.keyboard.press('ArrowRight'); await waitJob(B512e.job_id);
      await page.keyboard.press('ArrowRight'); await waitJob(B742.job_id);
      assert.deepStrictEqual(await pressedIn('g-mask'), ['Back']);
    });

    await step('push reach to 0.5: only one such job exists, so the view settles on it and says so', async () => {
      await btn('g-reach', '0.5').click();
      await waitJob(Aplaid.job_id);
      assert.deepStrictEqual(await pressedIn('g-reach'), ['0.5 \u00b7 wider']);
      assert.deepStrictEqual(await pressedIn('g-set'), ['Three territories']);
      assert.deepStrictEqual(await pressedIn('g-mask'), ['Centre']);
      assert.match(await txt('#toast'), /Switched .*nearest computed view is Three territories . centre lens . reach 0\.5/);
      assert.match(await txt('#say'), /scrambled it into plaid/);
      assert.strictEqual(await page.$eval('#face', f => f.dataset.k), 'mouseDizzy');
      assert.strictEqual(await txt('#tag-r'), 'Blurred \u00b7 reach 0.5');
    });

    await step('"0 · local" brings reach 0 back (the dead-control report was the already-selected default)', async () => {
      await btn('g-reach', '0 \u00b7 local').click();
      await waitJob(A512.job_id);
      assert.deepStrictEqual(await pressedIn('g-reach'), ['0 \u00b7 local']);
      assert.strictEqual(await page.$eval('#face', f => f.dataset.k), 'mouseHappy');
    });

    await step('game outcome: catch every ghost in the view (button and C key) until "all caught"', async () => {
      const total = A512.stats.reduce((a, s) => a + ghostCount(s), 0);
      assert.ok(total > 0);
      assert.match(await txt('#tally'), new RegExp(`^${total} ghosts? in this view . 0 caught`));
      await page.locator('#catch').click();
      assert.match(await txt('#say'), /^Caught one! \w+ at this pixel: 0\.0\d measured, \d\.\d\d blurred/);
      assert.match(await txt('#probe'), /ghost pixel \(\d+, \d+\).*measured . \d\.\d\d blurred/);
      await page.focus('#cv');
      for (let i = 1; i < total; i++) {
        if (i === 1) await page.keyboard.press('c'); else await page.locator('#catch').click();
      }
      assert.match(await txt('#tally'), new RegExp(`${total} caught . all caught`));
      assert.ok(await page.locator('#catch').isDisabled(), 'catch button disabled when none are left');
      assert.match(await txt('#say'), /That was the last ghost in this view/);
    });

    await step('hold "Hold: measured": the measurement shows (no ghosts in it), release returns the blur', async () => {
      await page.locator('#peek').scrollIntoViewIfNeeded();
      const b = await page.locator('#peek').boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await page.waitForTimeout(150);
      assert.strictEqual(await page.$eval('#stage', s => s.dataset.compare), 'on');
      assert.match(await txt('#say'), /This is the measurement/);
      await page.mouse.up(); await page.waitForTimeout(150);
      assert.strictEqual(await page.$eval('#stage', s => s.dataset.compare), 'off');
    });

    await step('probe a pixel: pointing inside the lens reads measured and blurred values for all three genes', async () => {
      const p = await cvPoint(512, 300);
      await page.mouse.move(p.x, p.y); await page.waitForTimeout(150);
      const t = await txt('#probe');
      assert.match(t, /inside mask/);
      for (const g of D.composites.A.genes) assert.match(t, new RegExp(`${g.gene} \\d\\.\\d\\d measured . \\d\\.\\d\\d blurred`));
      const o = await cvPoint(40, 40);
      await page.mouse.move(o.x, o.y); await page.waitForTimeout(150);
      assert.match(await txt('#probe'), /outside mask: unchanged/);
    });

    await step('wipe compare: the tool turns on, the divider follows a drag, the Measured tag shows', async () => {
      await btn('g-tool', 'Wipe compare').click();
      assert.deepStrictEqual(await pressedIn('g-tool'), ['Wipe compare']);
      assert.strictEqual(await page.$eval('#stage', s => s.dataset.compare), 'on');
      assert.ok(await page.locator('#stage .tag.l').isVisible());
      const s0 = await canvasSig('#cv');
      const a = await cvPoint(700, 100), b = await cvPoint(300, 100);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
      assert.notStrictEqual(await canvasSig('#cv'), s0, 'canvas redrawn with the divider moved');
    });

    await step('the sprite overlay (#fx, flagged by the dead-control scan) is click-through: its drag moves the wipe on the slide', async () => {
      const fb = await page.locator('#fx').boundingBox();
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).id, [fb.x + fb.width * .5, fb.y + fb.height * .5]);
      assert.strictEqual(hit, 'cv');
      const s0 = await canvasSig('#cv');   // the scan's own gesture: drag from 40% to 60% of the overlay's box
      await page.mouse.move(fb.x + fb.width * .4, fb.y + fb.height * .4); await page.mouse.down();
      await page.mouse.move(fb.x + fb.width * .6, fb.y + fb.height * .55, { steps: 6 }); await page.mouse.up();
      assert.notStrictEqual(await canvasSig('#cv'), s0, 'the wipe followed the drag');
    });

    await step('"Sweep the wipe" animates the divider and "Pause" stops it', async () => {
      await page.locator('#sweep').click();
      assert.strictEqual(await txt('#sweep'), 'Pause');
      await page.waitForTimeout(250); const s1 = await canvasSig('#cv');
      await page.waitForTimeout(400); const s2 = await canvasSig('#cv');
      assert.notStrictEqual(s1, s2, 'the divider moves while sweeping');
      await page.locator('#sweep').click();
      assert.strictEqual(await txt('#sweep'), 'Sweep the wipe');
      await page.mouse.move(5, 5); await page.waitForTimeout(300);
      const s3 = await canvasSig('#cv'); await page.waitForTimeout(400);
      assert.strictEqual(await canvasSig('#cv'), s3, 'paused: the divider holds still');
    });

    await step('Scene / Data: Data shows the exact per-gene table from the job and hides the cast; Scene brings it back', async () => {
      await btn('g-view', 'Data').click();
      assert.strictEqual(await page.$eval('body', b => b.dataset.view), 'data');
      assert.ok(await page.locator('.datahint').isVisible());
      assert.ok(await page.locator('#stats').isVisible());
      assert.ok(!(await page.locator('#case').isVisible()));
      const rows = await page.$$eval('#stats tr', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
      assert.strictEqual(rows.length, 3);
      rows.forEach((r, i) => { const s = A512.stats[i]; assert.strictEqual(r[0], D.composites.A.genes[i].gene); assert.strictEqual(r[1], s.r.toFixed(2)); });
      const ink = await page.$eval('#fx', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let k = 3; k < d.length; k += 4) if (d[k]) return 1; return 0; });
      assert.strictEqual(ink, 0, 'no sprites in Data view');
      await btn('g-view', 'Scene').click();
      assert.strictEqual(await page.$eval('body', b => b.dataset.view), 'scene');
      assert.ok(await page.locator('#case').isVisible());
    });

    await step('science drawers open, and their numbers are computed from the job data', async () => {
      const n = await page.locator('section.more details.drawer').count();
      assert.ok(n >= 4, n + ' drawers');
      for (let i = 0; i < n; i++) {
        const d = page.locator('section.more details.drawer').nth(i);
        await d.locator('summary').click();
        assert.ok(await d.evaluate(e => e.open), 'drawer ' + i + ' open');
        assert.ok(await d.locator('.body').isVisible());
      }
      const sums = await page.$$eval('[data-sum]', ss => ss.map(s => s.textContent));
      assert.deepStrictEqual(sums, ['0.73 to 0.93 across 20 gene views', '-0.12 to -0.04', '64% to 94%']);
      assert.ok(await page.$$eval('#cast li', l => l.length) >= 8, 'cast drawer lists the sprites');
      assert.match(await txt('#made'), /no QPU mode, so none of this ran on quantum hardware/);
    });

    await step('restored words: no "Bonus" anywhere, earlier sub, steps, Mask label and claims text, all under titled sections', async () => {
      assert.strictEqual(await txt('.wtnr-bar .count'), 'Challenge 01');
      assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /bonus/i);
      assert.match(await txt('.sub'), /Wipe back to the measurement to see what the blur kept, and what it made up\.$/);
      assert.match(await txt('.steps'), /Move the lens: drag it, or tap where you want it to go\./);
      assert.ok(await page.locator('.controls .label', { hasText: /^Mask$/ }).isVisible());
      const titles = await page.$$eval('main .ink-bar > span:first-child, .wrap > section .ink-bar > span:first-child', s => s.map(x => x.textContent.trim()));
      for (const t of ['How to play', 'The data', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits']) assert.ok(titles.includes(t), 'section ' + t);
      for (const id of ['#how', '#data', '#claims']) assert.ok(await page.locator(id).isVisible(), id + ' visible');
      const claims = await txt('#claims');
      assert.match(claims, /The ghost-signal column shows it placing expression where none was measured\./);
      assert.match(claims, /The lens snaps to the three computed positions, and nothing is computed live\./);
    });

    await step('earlier words kept: every text run of the pre-sprite page (history/template.pre_sprite.html) is on the page now', async () => {
      // Parse the earlier page's static HTML in a blank, script-free tab and collect every leaf text block.
      const old = fs.readFileSync(path.join(PIECE, 'history', 'template.pre_sprite.html'), 'utf8');
      const body = old.slice(old.indexOf('</style>') + 8, old.indexOf('<script'));
      const tmp = await ctx.newPage();
      await tmp.setContent(body.replace(/<link[^>]*>/g, ''), { waitUntil: 'domcontentloaded' });
      const sums = await page.$$eval('[data-sum]', ss => ss.map(s => [s.dataset.sum, s.textContent]));   // computed from data on both pages
      await tmp.evaluate(ss => ss.forEach(([k, v]) => document.querySelectorAll(`[data-sum="${k}"]`).forEach(e => { e.textContent = v; })), sums);
      const runs = await tmp.$$eval('h1, p, li, summary, span.label, dt, dd, button, th, .ink-bar > span, .tag, .proof > span, nav.wtnr-bar a',
        es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => t && t !== '-'));
      const aria = await tmp.$eval('#cv', c => c.getAttribute('aria-label'));
      await tmp.close();
      const now = (await page.evaluate(() => document.body.textContent)).replace(/\s+/g, ' ');
      const bonus = runs.filter(t => /bonus/i.test(t));   // the one deliberate change: all entries are equal
      const missing = runs.filter(t => !/bonus/i.test(t) && !now.includes(t));
      assert.ok(runs.length >= 50, runs.length + ' runs');
      assert.deepStrictEqual(missing, [], 'earlier text missing now');
      assert.deepStrictEqual(bonus.map(t => t.replace(/Bonus · /, '')).filter(t => !now.includes(t)), [], 'Bonus lines kept minus the word');
      assert.ok((await page.$eval('#cv', c => c.getAttribute('aria-label'))).startsWith(aria), 'slide aria-label keeps the earlier words');
    });

    await step('every restored graph renders: the slide, Figure 1 (both panes) and the ghost-signal bars of the per-gene table', async () => {
      const inkedCv = await page.$eval('#cv', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 16) if (d[k] < 200 || d[k + 1] < 200) n++; return n; });
      assert.ok(inkedCv > 4000, 'slide drawn (' + inkedCv + ')');
      const bars = await page.$$eval('#stats .gbar i', is => is.map(i => i.getBoundingClientRect().width));
      assert.ok(bars.length >= 2 && bars.every(w => w > 0), 'ghost-signal bars drawn: ' + bars.join(','));
      assert.ok(await page.locator('#fig-m').isVisible() && await page.locator('#fig-b').isVisible(), 'Figure 1 visible without a toggle');
    });

    await step('The data: figure 1 draws measured | blurred for the view, follows the controls, and its probe reads one pixel in both', async () => {
      await page.locator('#data').scrollIntoViewIfNeeded();
      const inked = sel => page.$eval(sel, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 16) if (d[k] < 200 || d[k + 1] < 200) n++; return n; });
      assert.ok(await inked('#fig-m') > 4000, 'measured map drawn');
      assert.ok(await inked('#fig-b') > 4000, 'blurred map drawn');
      assert.notStrictEqual(await canvasSig('#fig-m'), await canvasSig('#fig-b'), 'the two panes differ');
      assert.match(await txt('#fig-cap'), new RegExp(A512.job_id.slice(0, 8)));
      assert.strictEqual(await txt('#fig-tag'), 'Quantum-blurred');
      const before = await canvasSig('#fig-b');
      await btn('g-gene', 'Gpr88').click();
      assert.notStrictEqual(await canvasSig('#fig-b'), before, 'figure follows the gene pick');
      assert.match(await txt('#fig-legend'), /^Gpr88$/);
      // "All three" (flagged by the dead-control scan only because it is the default) works once another gene is picked
      const one = await canvasSig('#fig-b');
      await btn('g-gene', 'All three').click();
      assert.deepStrictEqual(await pressedIn('g-gene'), ['All three']);
      assert.notStrictEqual(await canvasSig('#fig-b'), one, '"All three" redraws the figure with all three pigments');
      assert.deepStrictEqual(await page.$$eval('#fig-legend > span', s => s.map(x => x.textContent.trim())), D.composites.A.genes.map(g => g.gene));
      await page.locator('#fig-m').scrollIntoViewIfNeeded();
      const b = await page.locator('#fig-m').boundingBox();
      await page.mouse.move(b.x + b.width * 512 / 1024, b.y + b.height * 300 / D.crop.h); await page.waitForTimeout(150);
      const t = await txt('#fig-probe');
      assert.match(t, /pixel \(512, \d+\) . inside mask/);
      for (const g of D.composites.A.genes) assert.match(t, new RegExp(`${g.gene} \\d\\.\\d\\d measured . \\d\\.\\d\\d blurred`));
      await page.mouse.move(5, 5);
    });

    await step("Jobs and credits: one row per job, the slide's job is marked, Show puts another job on the slide", async () => {
      const rows = await page.$$eval('#jobrows tr', t => t.map(r => [r.dataset.job, r.className]));
      assert.deepStrictEqual(rows.map(r => r[0]), D.jobs.map(j => j.job_id));
      assert.deepStrictEqual(rows.filter(r => r[1] === 'on').map(r => r[0]), [A512.job_id]);
      const sec = D.jobs.findIndex(j => j.mask === 'section');
      await page.locator('#jobrows tr').nth(sec).locator('button').click();
      await waitJob(D.jobs[sec].job_id);
      assert.deepStrictEqual(await pressedIn('g-mask'), ['Whole section']);
      assert.strictEqual(await page.locator('#jobrows tr.on button').innerText(), 'On the slide');
      await page.locator('#jobrows tr').nth(D.jobs.indexOf(A512)).locator('button').click();
      await waitJob(A512.job_id);
    });

    await step('share: set a view, copy its link; the hash holds the full state', async () => {
      await btn('g-set', 'Folds and tracts').click(); await waitJob(B512.job_id);
      await btn('g-gene', 'Mog').click();
      await btn('g-tool', 'Move lens').click();
      await page.focus('#cv'); await page.keyboard.press('ArrowRight'); await waitJob(B742.job_id);   // wipe resets to the lens centre: 742/1024
      await btn('g-tool', 'Wipe compare').click();
      await page.focus('#cv'); await page.keyboard.press('ArrowLeft');   // wipe 0.7246 - 0.05
      await btn('g-view', 'Data').click();
      await page.locator('#share').click();
      await page.waitForTimeout(200);
      token = await page.evaluate(() => location.hash);
      assert.strictEqual(token, '#B.Mog.lens_742.echo.w67.wipe.data');
      assert.match(await txt('#toast'), /^(Link copied|Copy failed: the link is in your address bar)$/);
      try { const clip = await page.evaluate(() => navigator.clipboard.readText()); if (clip) assert.ok(clip.endsWith(token), 'clipboard holds the link'); } catch (e) { /* clipboard read not permitted: the toast covers it */ }
    });

    const checkRestored = async p => {
      const pr = async g => p.$$eval(`#${g} button[aria-pressed="true"]`, bs => bs.map(b => b.textContent.trim()));
      assert.strictEqual(await p.$eval('#r-job', e => e.textContent), B742.job_id);
      assert.deepStrictEqual(await pr('g-set'), ['Folds and tracts']);
      assert.deepStrictEqual(await pr('g-gene'), ['Mog']);
      assert.deepStrictEqual(await pr('g-mask'), ['Back']);
      assert.deepStrictEqual(await pr('g-reach'), ['0 \u00b7 local']);
      assert.deepStrictEqual(await pr('g-tool'), ['Wipe compare']);
      assert.deepStrictEqual(await pr('g-view'), ['Data']);
      assert.strictEqual(await p.$eval('body', b => b.dataset.view), 'data');
      assert.strictEqual(await p.$eval('#stage', s => s.dataset.tool + '/' + s.dataset.compare), 'wipe/on');
    };
    await step('reload with the hash (same tab): the exact view is restored', async () => {
      await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(500);
      assert.strictEqual(await page.evaluate(() => location.hash), token);
      await checkRestored(page);
    });
    await step('open the shared link in a fresh tab: same view, and sharing again yields the same token', async () => {
      const p2 = await newPage(ctx, token);
      await checkRestored(p2);
      await p2.locator('#share').click(); await p2.waitForTimeout(150);
      assert.strictEqual(await p2.evaluate(() => location.hash), token);
      await p2.close();
    });

    await step('navigation: brand bar and nav link to the hub; prev is 14, next is 16; the jump list holds all 22', async () => {
      assert.strictEqual(await page.$eval('.wtnr-bar a', a => a.href), HUB);
      const nav = page.locator('nav.wtnr-nav');
      assert.ok(await nav.isVisible());
      assert.strictEqual(await nav.locator('a[rel="prev"]').getAttribute('href'), URLS['14-hemibrain-ising']);
      assert.strictEqual(await nav.locator('a[rel="next"]').getAttribute('href'), URLS['16-busy-beaver-score']);
      assert.strictEqual(await nav.locator('a.wn-hub').getAttribute('href'), HUB);
      assert.match(await nav.locator('a[rel="prev"]').innerText(), /14 Fly Brain Metro/);
      assert.match(await nav.locator('a[rel="next"]').innerText(), /16 Busy Beaver Score/);
      await nav.locator('summary').click();
      const items = await nav.locator('ol a').evaluateAll(as => as.map(a => [a.getAttribute('href'), a.getAttribute('aria-current')]));
      assert.strictEqual(items.length, 22);
      assert.ok(items.some(([h, c]) => h === URLS['15-tissue-blur'] && c === 'page'), 'this piece is marked current');
      for (const [h] of items) assert.ok(Object.values(URLS).includes(h) || h === HUB, 'unknown nav link ' + h);
      assert.ok(await page.$eval('nav.wtnr-nav', n => n.nextElementSibling && n.nextElementSibling.classList.contains('wtnr-foot')), 'nav sits just before the footer');
    });

    await step('phone width (375 px): no horizontal scroll, the instrument and the nav fit', async () => {
      const m = await browser.newContext({ viewport: { width: 375, height: 812 } });
      const p = await m.newPage();
      await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      assert.ok(await p.locator('nav.wtnr-nav a.wn-hub').isVisible());
      await m.close();
    });

    await step('no sound ever started, no page errors, no failed or off-site requests', async () => {
      const q = await page.evaluate(() => window.__qa);
      assert.strictEqual(q.sources + q.media, 0);
      assert.deepStrictEqual(errors, []);
      assert.deepStrictEqual(failed, []);
      const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
      assert.deepStrictEqual(bad, []);
    });
  } catch (e) {
    code = 1;
  }
  const out = { piece: '15-tissue-blur', ok: code === 0, steps, errors, failed, external: [...external] };
  fs.writeFileSync(path.join(__dirname, 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(code === 0 ? `\nE2E OK: ${steps.length} steps passed` : `\nE2E FAILED after ${steps.filter(s => s.ok).length} passing steps`);
  await browser.close(); server.close();
  process.exit(code);
})();
