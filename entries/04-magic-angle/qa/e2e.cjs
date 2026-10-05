// End-to-end journey for Magic Angle: node entries/04-magic-angle/qa/e2e.cjs [port 6270-6279]
// Serves web/ locally, opens the built page in headless Chromium and walks the main journey with real assertions:
// check the brand bar and the prev / hub / next nav, drag the turntable rim to a twist the FFT reads, step it with
// the keys and the slider, flip Original / Quantum morph (the needle and Lec follow the published reading), peek with
// Space, poke a layer, switch the lens, play and pause the sweep, jump to the magic angle (the register echo), toggle
// Scene / Frame / Data (magnifier, the period plot's click-to-jump, the profile probe), check the restored titled
// sections (How to play, The data with both earlier graphs and their captions, The film, The science, How it was
// made, What this does not claim, Jobs and credits) and the jobs table's links, open every drawer,
// copy a share link and reload with its hash (state restored, including the view), and play and pause the film.
// The piece has no audio track: the film is silent, so the "sound" check is the same media instrumentation as
// common/qa/qa_page.cjs (a <video> 'playing' event), and it also asserts nothing plays before a click.
// Exits 1 on the first failed assertion; writes qa/e2e.json.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = '04-magic-angle';
const port = +(process.argv[2] || 6270);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const PJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const MEAS = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'measure.json'), 'utf8'));
const frameAt = t => MEAS.frames.find(f => Math.abs(f.theta - t) < 1e-9);
const SLUGS = fs.readdirSync(path.join(ROOT, 'entries')).filter(s => fs.existsSync(path.join(ROOT, 'entries', s, 'piece.json'))).sort();

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {   // byte ranges, so the <video> can seek and play like it would on the real host
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
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
let page, errors = [], failed = [], aborted = [], external = new Set();
async function step(name, fn) {
  try { await fn(); steps.push({ step: name, ok: true }); console.log('ok  ', name); }
  catch (e) { steps.push({ step: name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log('FAIL', name, '\n     ', String(e.message || e).slice(0, 400)); throw e; }
}
const txt = sel => page.$eval(sel, e => e.textContent.trim());
const pressed = attr => page.$$eval(`[data-${attr}][aria-pressed="true"]`, bs => bs.map(b => b.textContent.trim()));
const canvasSig = sel => page.$eval(sel, c => c.toDataURL());
const sig = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const angle = () => txt('#m-ang');
const waitAngle = async (t, ms = 4000) => page.waitForFunction(a => document.getElementById('m-ang').textContent === a, t.toFixed(2) + '\u00b0', { timeout: ms });
const state = () => page.evaluate(() => ({ i: st.i, t: FR[st.i].t, src: st.src, lens: st.lens, view: st.view, peek: st.peek, playing: !!st.playing,
  lec: lec.mode, arm: armState(), job: document.getElementById('r-job').textContent, probe: st.probe }));
// a point on the turntable rim for twist th (the page's own dial mapping), in viewport px
async function rimPoint(th) {
  await page.locator('#scene').scrollIntoViewIfNeeded();
  const b = await page.locator('#scene').boundingBox();
  const phi = await page.evaluate(t => rimAngle(t), th) * Math.PI / 180, u = b.width / 100, rm = (29.2 + 33) / 2 * u;
  return { x: b.x + 50 * u + rm * Math.cos(phi), y: b.y + 44 * u + rm * Math.sin(phi) };
}
async function newPage(ctx, hash = '') {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  p.on('requestfailed', r => {
    const why = (r.failure() || {}).errorText || '';
    if (r.url().startsWith('data:') || /fonts\.(googleapis|gstatic)\.com/.test(r.url())) return;
    // a <video> fetch the browser cancels itself (metadata preload cut short by a reload, a closed tab or a range
    // request) is normal media behaviour, not a missing file; a 404 still shows up below as a response >= 400
    if (why === 'net::ERR_ABORTED' && /\.mp4$/.test(r.url())) { aborted.push(r.url()); return; }
    failed.push(r.url() + ' ' + why);
  });
  p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  p.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  await p.addInitScript(INSTRUMENT);
  await p.goto(`http://127.0.0.1:${port}/index.html${hash}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => typeof st === 'object' && document.getElementById('r-job').textContent.length === 36, null, { timeout: 15000 });
  await p.waitForTimeout(300);
  return p;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  let exitCode = 0;
  try {
    page = await newPage(ctx);

    await step('page opens on the scene at the magic angle, nothing playing', async () => {
      assert.strictEqual(await angle(), '1.10\u00b0');
      assert.deepStrictEqual(await pressed('view'), ['Scene']);
      assert.deepStrictEqual(await pressed('src'), ['Quantum morph']);
      assert.deepStrictEqual(await pressed('lens'), ['Moir\u00e9 envelope']);
      assert.ok(await page.isVisible('#scene') && !(await page.isVisible('#cv')) && !(await page.isVisible('#v-data')), 'the stage shows only the scene');
      assert.ok(await page.$eval('#prof', c => !!c.closest('#data-home')) && await page.$eval('#plot', c => !!c.closest('#data-home')), 'both charts sit in The data section');
      assert.strictEqual(await txt('.wtnr-bar .count'), 'Challenge 04 · Hide');
      assert.ok(!/bonus/i.test(await page.evaluate(() => document.body.innerText)), 'no Bonus wording anywhere');
      const s = await state();
      assert.strictEqual(s.job, frameAt(1.1).job_id, 'job ID of the 1.10 deg frame');
      assert.strictEqual(s.arm, 'skip'); assert.strictEqual(s.lec, 'dizzy');   // the 1.10 frame is a register-echo (null) frame
      assert.match(await txt('#say'), /register's echo/);
      assert.strictEqual(await txt('#m-badge'), 'magic angle zone \u00b7 not resolved');
      const q = await page.evaluate(() => ({ ...window.__qa }));
      assert.strictEqual(q.media + q.sources, 0, 'nothing plays before a click');
      assert.ok(await page.$eval('#film', v => v.paused), 'film is paused on load');
    });

    await step('brand bar, proof chips and readout match piece.json', async () => {
      assert.strictEqual(await page.$eval('.wtnr-bar a', a => a.href), HUB);
      assert.match(await txt('.proof'), new RegExp(`${PJ.qubits} qubits per morph`));
      assert.strictEqual(await txt('#p-njobs'), String(PJ.jobs));
      assert.strictEqual(await txt('#p-jobs'), String(MEAS.frames.length));
      assert.match(await txt('.readout'), new RegExp(`${PJ.engines[0]}.*${PJ.qubits} qubits`));
      assert.strictEqual(await page.title(), PJ.title);
    });

    await step('shared nav: prev / hub / next and the full list link to the published pieces', async () => {
      const i = SLUGS.indexOf(SLUG), prev = SLUGS[(i - 1 + SLUGS.length) % SLUGS.length], next = SLUGS[(i + 1) % SLUGS.length];
      assert.strictEqual(await page.$eval('nav.wtnr-nav a[rel="prev"]', a => a.href), URLS[prev]);
      assert.strictEqual(await page.$eval('nav.wtnr-nav a.wn-hub', a => a.href), HUB);
      assert.strictEqual(await page.$eval('nav.wtnr-nav a[rel="next"]', a => a.href), URLS[next]);
      assert.match(await txt('nav.wtnr-nav a[rel="prev"]'), /^\u2190 03 /);
      assert.match(await txt('nav.wtnr-nav a[rel="next"]'), /^05 .* \u2192$/);
      const list = await page.$$eval('nav.wtnr-nav ol a', as => as.map(a => [a.href, a.getAttribute('aria-current')]));
      assert.strictEqual(list.length, SLUGS.length);
      assert.deepStrictEqual(list.filter(x => x[1] === 'page').map(x => x[0]), [URLS[SLUG]]);
      assert.ok(list.every(([h]) => Object.values(URLS).includes(h)), 'every list link is a published piece');
      await page.click('nav.wtnr-nav summary');
      assert.ok(await page.$eval('nav.wtnr-nav details', d => d.open) && await page.isVisible('nav.wtnr-nav ol a[aria-current="page"]'));
      await page.click('nav.wtnr-nav summary');
      const foot = await page.$eval('.wtnr-foot', f => f.previousElementSibling && f.previousElementSibling.matches('nav.wtnr-nav'));
      assert.ok(foot, 'nav sits just before the footer');
    });

    await step('drag the turntable rim from 1.1 to 3.0 deg: the FFT reads the period, Lec hops', async () => {
      const a = await rimPoint(1.1);
      await page.mouse.move(a.x, a.y); await page.mouse.down();
      for (let k = 1; k <= 12; k++) { const p = await rimPoint(1.1 + (3.0 - 1.1) * k / 12); await page.mouse.move(p.x, p.y); }
      assert.strictEqual(await page.evaluate(() => drag.on), true, 'grabbing while the button is down');
      await page.mouse.up();
      await waitAngle(3.0);
      const s = await state(), f = frameAt(3.0);
      assert.strictEqual(s.job, f.job_id); assert.strictEqual(f.status, 'ok');
      assert.strictEqual(s.arm, 'read'); assert.strictEqual(s.lec, 'hop');
      assert.match(await txt('#r-status'), /tracks the twist/);
      assert.match(await txt('#m-per'), new RegExp('from the morph ' + f.L_meas.toFixed(1) + ' px'));
      assert.ok(!(await page.evaluate(() => drag.on)));
      assert.match(await page.$eval('#twist', s => s.getAttribute('aria-valuetext')), /^3\.00 degrees, tracks the twist$/);
    });

    await step('keys on the turntable step through the real frames (arrows, Home, End)', async () => {
      await page.focus('#scene');
      await page.keyboard.press('ArrowRight'); await waitAngle(3.2);
      await page.keyboard.press('Home'); await waitAngle(0);
      let s = await state(); assert.strictEqual(s.arm, 'skip', 'the untwisted frame is the register echo itself');
      assert.match(await txt('#say'), /aligned, yet the needle still finds a pair/);
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await waitAngle(0.3);
      s = await state(); assert.strictEqual(s.arm, 'lift'); assert.strictEqual(s.lec, 'sleep');   // unresolved
      await page.keyboard.press('End'); await waitAngle(5);
      assert.strictEqual((await state()).job, frameAt(5).job_id);
    });

    await step('the slider snaps to the 45 computed angles', async () => {
      await page.focus('#twist');
      await page.keyboard.press('ArrowLeft'); await waitAngle(4.8);
      await page.$eval('#twist', s => { s.value = '2.33'; s.dispatchEvent(new Event('input', { bubbles: true })); });
      await waitAngle(2.3);
      assert.strictEqual(await page.$eval('#twist', s => s.value), '2.3');
      assert.strictEqual((await state()).job, frameAt(2.3).job_id);
      // "Page Up and Page Down step five" (Keys, clicks and links)
      const i = MEAS.frames.findIndex(f => Math.abs(f.theta - 2.3) < 1e-9);
      await page.keyboard.press('PageUp'); await waitAngle(MEAS.frames[i + 5].theta);
      assert.strictEqual((await state()).job, MEAS.frames[i + 5].job_id);
      await page.keyboard.press('PageDown'); await waitAngle(2.3);
    });

    await step('flip Original / Quantum morph: the readout and the cast follow the reading for that source', async () => {
      await page.click('[data-src="orig"]');
      let s = await state();
      assert.strictEqual(s.src, 'orig'); assert.deepStrictEqual(await pressed('src'), ['Original']);
      assert.strictEqual(s.arm, 'read'); assert.strictEqual(s.lec, 'hop');
      assert.match(await txt('#say'), new RegExp("Lec hops between AA spots at the method check's period, " + frameAt(2.3).L_ref.toFixed(1) + ' px'));
      await page.click('[data-src="morph"]');
      s = await state(); assert.strictEqual(s.src, 'morph');
      assert.match(await txt('#say'), new RegExp('Lec hops at the period the FFT read from this morph: ' + frameAt(2.3).L_meas.toFixed(1) + ' px'));
    });

    await step('hold Space on the scene to peek at the other source; poke Ay for a hop', async () => {
      await page.focus('#scene');
      await page.keyboard.down('Space');
      assert.strictEqual((await state()).peek, 'orig');
      assert.match(await txt('#say'), /^Original layers/);
      await page.keyboard.up('Space');
      assert.strictEqual((await state()).peek, null);
      const b = await page.locator('#scene').boundingBox(), u = b.width / 100;
      const before = await page.evaluate(() => pokes.a);
      await page.mouse.click(b.x + 9.6 * u, b.y + (44 - 3) * u);
      assert.ok(await page.evaluate(p => pokes.a > p, before), 'Ay jumped');
    });

    await step('lens: Raw pixels shows the 1:1 crop on the record, Moire envelope the band-pass map', async () => {
      const s0 = sig(await canvasSig('#scene'));
      await page.click('[data-lens="px"]');
      assert.strictEqual((await state()).lens, 'px'); assert.deepStrictEqual(await pressed('lens'), ['Raw pixels']);
      await page.waitForFunction(() => { const i = imgs[FR[st.i].raw]; return i && i.complete && i.naturalWidth === 384; }, null, { timeout: 8000 });
      await page.waitForTimeout(200);
      assert.notStrictEqual(sig(await canvasSig('#scene')), s0, 'the record changed');
      assert.match(await txt('#tag'), /telablur output \u00b7 raw pixels/);
      await page.click('[data-lens="env"]');
      assert.strictEqual((await state()).lens, 'env');
    });

    await step('Play the sweep runs from where you are, Pause stops it', async () => {
      await page.focus('#twist'); await page.keyboard.press('Home'); await waitAngle(0);
      await page.click('#play');
      assert.strictEqual(await txt('#play'), 'Pause');
      await page.waitForFunction(() => st.i >= 3, null, { timeout: 6000 });
      await page.click('#play');
      assert.strictEqual(await txt('#play'), 'Play the sweep');
      const i = (await state()).i; await page.waitForTimeout(1200);
      const s = await state();
      assert.strictEqual(s.i, i, 'the sweep stopped'); assert.ok(!s.playing);
      assert.strictEqual(s.job, MEAS.frames[i].job_id);
    });

    await step('Jump to 1.1 deg lands on the magic angle zone, flagged as the register echo', async () => {
      await page.click('#magic');
      await waitAngle(1.1);
      assert.match(await txt('#toast'), /^1\.1°: predicted L = 416\.7 px = 12\.8 nm in graphene\. Magic angle zone: the morph reads the register echo here\.$/);
      assert.strictEqual(await txt('#r-status'), 'register echo');
      assert.strictEqual(frameAt(1.1).status, 'null');
    });

    await step('Frame view: the full engine frame with a magnifier while you drag', async () => {
      await page.click('[data-view="frame"]');
      assert.deepStrictEqual(await pressed('view'), ['Frame']);
      assert.ok(await page.isVisible('#cv') && !(await page.isVisible('#scene')));
      await page.waitForFunction(() => { const i = imgs[FR[st.i].map]; return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
      await page.evaluate(() => draw());
      const s0 = sig(await canvasSig('#cv')), b = await page.locator('#cv').boundingBox();
      await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.45, { steps: 5 });
      assert.ok(await page.evaluate(() => !!st.loupe), 'magnifier on');
      assert.notStrictEqual(sig(await canvasSig('#cv')), s0, 'magnifier drawn');
      await page.mouse.up();
      const at = await page.evaluate(() => st.loupe);
      assert.ok(at && Math.abs(at.x - 512) < 3 && Math.abs(at.y - 0.45 * 1024) < 3, 'the magnifier stays where it was let go');
      assert.match(await txt('#tag'), /telablur output \u00b7 moir\u00e9 envelope/);
      // it stays put while the twist and the source change under it
      const m0 = sig(await canvasSig('#cv'));
      await page.focus('#cv'); await page.keyboard.press('ArrowRight'); await waitAngle(1.15);
      await page.waitForFunction(() => { const i = imgs[FR[st.i].map]; return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 });
      await page.evaluate(() => draw());
      assert.deepStrictEqual(await page.evaluate(() => st.loupe), at);
      assert.notStrictEqual(sig(await canvasSig('#cv')), m0, 'the next frame shows under the magnifier');
      // a click inside it puts it away; Esc does too
      await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.45);
      assert.strictEqual(await page.evaluate(() => st.loupe), null, 'click inside removes the magnifier');
      await page.mouse.click(b.x + b.width * 0.7, b.y + b.height * 0.7);
      assert.ok(await page.evaluate(() => !!st.loupe), 'a click elsewhere places it');
      await page.keyboard.press('Escape');
      assert.strictEqual(await page.evaluate(() => st.loupe), null, 'Esc removes the magnifier');
    });

    await step('Data view: the period plot jumps to a clicked twist, the profile probe reads the power', async () => {
      await page.click('[data-view="data"]');
      assert.deepStrictEqual(await pressed('view'), ['Data']);
      assert.ok(await page.isVisible('#prof') && await page.isVisible('#plot') && !(await page.isVisible('#cv')));
      assert.ok(await page.$eval('#prof', c => !!c.closest('#v-data')), 'the Data view borrows the charts into the stage');
      assert.ok(await page.isVisible('#data-away'), 'The data section says where the charts went');
      assert.strictEqual(await page.$$eval('#plot circle', c => c.length) >= 45, true, 'every frame is on the plot');
      // click the plot at 4.0 deg (the Data view is taller than the window: bring the plot into view first)
      await page.locator('#plot').scrollIntoViewIfNeeded();
      const b = await page.locator('#plot').boundingBox();
      const x = await page.evaluate(() => (P.l + 4.0 / 5 * (P.w - P.l - P.r)) / P.w);
      await page.mouse.click(b.x + x * b.width, b.y + b.height * 0.5);
      await waitAngle(4.0);
      assert.strictEqual(await txt('#prof-st'), 'pair ' + frameAt(4.0).theta_meas.toFixed(2) + '\u00b0 apart');
      // the probe
      await page.locator('#prof').scrollIntoViewIfNeeded();
      const s0 = sig(await canvasSig('#prof')), pb = await page.locator('#prof').boundingBox();
      await page.mouse.click(pb.x + pb.width * 0.62, pb.y + pb.height * 0.5);
      const s = await state(); assert.ok(s.probe != null, 'probe set');
      assert.notStrictEqual(sig(await canvasSig('#prof')), s0, 'probe drawn');
      assert.match(await txt('#prof-read'), /^\d+\.\d\d\u00b0 \([+\u2212]\d\.\d\d\u00b0 from the 15\u00b0 axis\): morph \d+ % of its peak, original \d+ % of its peak/);
      const t1 = await txt('#prof-read');
      await page.focus('#prof'); await page.keyboard.press('ArrowRight');
      assert.notStrictEqual(await txt('#prof-read'), t1, 'arrow moves the probe');
      await page.keyboard.press('ArrowUp'); await waitAngle(4.2);   // up/down change the twist, the probe stays
      assert.ok((await state()).probe != null);
      await page.keyboard.press('Escape');
      assert.ok((await state()).probe === null && /^Click or drag/.test(await txt('#prof-read')), 'Esc clears the probe');
    });

    await step('picking a lens from the Data view brings the picture back', async () => {
      await page.click('[data-lens="px"]');
      const s = await state();
      assert.strictEqual(s.lens, 'px'); assert.strictEqual(s.view, 'frame', 'back to the last picture view (Frame)');
      assert.ok(await page.isVisible('#cv'));
      await page.click('[data-view="scene"]');
      assert.ok(await page.isVisible('#scene')); assert.deepStrictEqual(await pressed('view'), ['Scene']);
      await page.click('[data-view="data"]'); await page.click('[data-lens="env"]');
      assert.strictEqual((await state()).view, 'scene');
    });

    await step('the restored sections: titled, visible, both graphs with their captions, the jobs table links', async () => {
      assert.strictEqual((await state()).view, 'scene');
      assert.ok(await page.$eval('#prof', c => !!c.closest('#data-home')) && !(await page.isVisible('#data-away')), 'charts back in The data');
      const bars = await page.$$eval('.ink-bar.sect', b => b.map(x => x.firstElementChild.textContent.trim()));
      assert.deepStrictEqual(bars, ['How to play', 'The data · How the twist is read', 'The film', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits']);
      for (const sel of ['.ink-bar.sect', '#how ~ .two .steps', '#cast', '#prof', '#plot', '#claims ~ .honest-sect .honesty']) assert.ok(await page.locator(sel).first().isVisible(), sel + ' visible');
      const heads = await page.$$eval('#data-cards h2', h => h.map(x => x.textContent));
      assert.deepStrictEqual(heads, ['The measurement', 'Period against twist']);
      const caps = await page.$$eval('#data-cards .card > p:not(.label):not(.cap)', p => p.map(x => x.textContent));
      assert.ok(caps[0].startsWith("Power around the Bragg ring of this frame's morph") && caps[1].startsWith("The period each frame's morph gives, against the prediction."));
      const steps = await page.$$eval('#how ~ .two .steps li', l => l.map(x => x.textContent));
      assert.ok(steps.length === 3 && steps[0].startsWith('Drag the twist from 0° to 5°') && /The dashed notch is 1\.1°, the magic angle\./.test(steps[0]));
      assert.ok(await page.isVisible('#magicmark'), 'the dashed 1.1 deg notch on the slider');
      // both graphs draw real data: the profile is not blank and the plot has a mark for every frame
      const blank = await page.$eval('#prof', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 200) n++; return n; });
      assert.ok(blank > 2000, 'the profile has ink on it');
      assert.ok(await page.$$eval('#plot circle', c => c.length) >= 45 && (await page.$$eval('#plot text', t => t.map(x => x.textContent))).includes('1.1° magic'));
      assert.strictEqual(await txt('#prof-t'), (await state()).t.toFixed(2) + '°');
      // jobs and credits: counts from the data, every sweep job listed, an angle link shows that frame
      assert.deepStrictEqual(await page.$$eval('[data-njobs]', s => [...new Set(s.map(x => x.textContent))]), [String(PJ.jobs)]);
      const rows = await page.$$eval('#jobs tr[data-i]', r => r.map(x => x.lastElementChild.textContent));
      assert.deepStrictEqual(rows, MEAS.frames.map(f => f.job_id));
      await page.click('#jobs-drawer summary');
      await page.click('#jobs a[data-go="35"]');
      await waitAngle(MEAS.frames[35].theta);
      assert.strictEqual(await page.$eval('#jobs tr.cur', r => r.dataset.i), '35');
      assert.strictEqual((await state()).job, MEAS.frames[35].job_id);
      await page.click('#jobs-drawer summary');
      // the Data view's note brings the charts back
      await page.click('[data-view="data"]');
      await page.click('#data-here');
      assert.strictEqual((await state()).view, 'scene');
      assert.ok(await page.$eval('#plot', c => !!c.closest('#data-home')));
    });

    await step('every science drawer opens and is filled from the data', async () => {
      const n = await page.$$eval('details.drawer', d => d.length);
      assert.strictEqual(n, 4);
      for (let k = 0; k < n; k++) {
        const d = page.locator('details.drawer').nth(k);
        await d.locator('summary').click();
        assert.ok(await d.evaluate(e => e.open), 'drawer ' + k + ' open');
        assert.ok(await d.locator('.body').isVisible());
      }
      const probes = await page.$$eval('#probes tr', r => r.map(x => x.textContent));
      assert.strictEqual(probes.length, 6, 'five probe jobs + header');
      for (const p of JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'probe_notes.json'), 'utf8'))) assert.ok(probes.some(r => r.includes(p.j)), 'probe job ' + p.j);
      const sums = await page.$$eval('[data-sum]', s => s.map(x => x.textContent));
      assert.ok(sums.length >= 10 && sums.every(v => v && v !== '\u2013'), 'every summary number filled');
      assert.strictEqual(await page.$eval('[data-sum="n_frames"]', s => s.textContent), String(MEAS.frames.length));
      const sprites = await page.$$eval('img[data-sprite]', im => im.map(i => i.complete && i.naturalWidth > 0 && i.src.startsWith('data:image/png')));
      assert.ok(sprites.length === 4 && sprites.every(Boolean), 'the cast is drawn');
      for (let k = 0; k < n; k++) await page.locator('details.drawer').nth(k).locator('summary').click();
    });

    let shared;
    await step('copy a link to this view (2.30 deg, Original, Raw pixels, Frame)', async () => {
      await page.click('[data-view="frame"]');
      await page.focus('#twist'); await page.$eval('#twist', s => { s.value = '2.3'; s.dispatchEvent(new Event('input', { bubbles: true })); });
      await waitAngle(2.3);
      await page.click('[data-src="orig"]'); await page.click('[data-lens="px"]');
      await page.click('#share');
      await page.waitForFunction(() => document.getElementById('toast').classList.contains('on'));
      assert.strictEqual(await page.evaluate(() => location.hash), '#t2.30-orig-px-frame');
      assert.strictEqual(await txt('#toast'), 'Link copied: 2.30\u00b0, original, raw pixels, frame');
      shared = await page.evaluate(() => navigator.clipboard.readText());
      assert.strictEqual(shared, `http://127.0.0.1:${port}/index.html#t2.30-orig-px-frame`);
    });

    await step('reload with the hash: twist, source, lens and view are restored', async () => {
      const check = async p => {
        assert.strictEqual(await p.$eval('#m-ang', e => e.textContent), '2.30\u00b0');
        const s = await p.evaluate(() => ({ src: st.src, lens: st.lens, view: st.view, job: document.getElementById('r-job').textContent }));
        assert.deepStrictEqual(s, { src: 'orig', lens: 'px', view: 'frame', job: frameAt(2.3).job_id });
        assert.deepStrictEqual(await p.$$eval('[data-view][aria-pressed="true"],[data-src][aria-pressed="true"],[data-lens][aria-pressed="true"]', b => b.map(x => x.textContent.trim())), ['Frame', 'Original', 'Raw pixels']);
        assert.ok(await p.isVisible('#cv') && !(await p.isVisible('#scene')));
        assert.match(await p.$eval('#tag', e => e.textContent), /^original layers \u00b7 raw pixels/);
      };
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => typeof st === 'object' && document.getElementById('r-job').textContent.length === 36);
      await check(page);
      const p2 = await newPage(ctx, '#t2.30-orig-px-frame');
      await check(p2); await p2.close();
      // a link pasted into the open page applies too
      await page.evaluate(() => { location.hash = '#t4.40-morph-env-data'; });
      await waitAngle(4.4);
      const s = await state();
      assert.deepStrictEqual([s.src, s.lens, s.view], ['morph', 'env', 'data']);
      assert.ok(await page.isVisible('#plot'));
      // an old-style link (no view) still opens on the scene
      const p3 = await newPage(ctx, '#t1.10-morph-env');
      assert.strictEqual(await p3.evaluate(() => st.view), 'scene'); await p3.close();
    });

    await step('the film plays on the page and pauses (silent: no audio track)', async () => {
      const q0 = await page.evaluate(() => ({ ...window.__qa }));
      await page.click('[data-view="scene"]');
      await page.focus('#twist'); await page.keyboard.press('Home'); await page.click('#play');   // the film stops the sweep
      await page.locator('#film-play').scrollIntoViewIfNeeded();
      await page.click('#film-play');
      await page.waitForFunction(() => window.__qa.media > 0 && !document.getElementById('film').paused, null, { timeout: 15000 });
      assert.strictEqual(await txt('#film-play'), 'Pause the film');
      assert.ok(!(await page.evaluate(() => !!st.playing)), 'starting the film paused the sweep');
      await page.waitForFunction(() => document.getElementById('film').currentTime > 0.5, null, { timeout: 15000 });
      const q1 = await page.evaluate(() => ({ ...window.__qa }));
      assert.ok(q1.media > q0.media, 'media playing event (sound_started in qa_page terms)');
      assert.match(await txt('#film-t'), /^0:0\d \/ 0:30$/);
      await page.click('#film-play');
      assert.ok(await page.$eval('#film', v => v.paused), 'paused');
      await page.waitForFunction(() => document.getElementById('film-play').textContent === 'Play the film', null, { timeout: 3000 });
      const t = await page.$eval('#film', v => v.currentTime); await page.waitForTimeout(600);
      assert.strictEqual(await page.$eval('#film', v => v.currentTime), t, 'stays paused');
      assert.strictEqual(await page.$eval('#film source', s => s.getAttribute('src')), 'video/magic_angle_web.mp4');
    });

    await step('no page errors, failed requests or disallowed hosts along the way', async () => {
      assert.deepStrictEqual(errors, []);
      assert.deepStrictEqual(failed, []);
      const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
      assert.deepStrictEqual(bad, []);
    });
  } catch (e) { exitCode = 1; }
  const out = { piece: SLUG, ok: exitCode === 0 && steps.every(s => s.ok), steps, errors, failed, media_aborts: aborted.length, external: [...external] };
  fs.writeFileSync(path.join(__dirname, 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(out.ok ? `\nE2E OK (${steps.length} steps)` : '\nE2E FAILED');
  await browser.close(); server.close();
  process.exit(out.ok ? 0 : 1);
})();
