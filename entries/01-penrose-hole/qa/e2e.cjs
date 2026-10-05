// End-to-end journey for 01 "The Hole in the Penrose": node entries/01-penrose-hole/qa/e2e.cjs [port 6210-6219]
// Serves web/ locally, walks the main user journey in headless Chromium with real assertions, and checks the page
// against the source data (web/positions.json, out/jobs.csv, site/urls.json). Writes qa/e2e.json and exits 1 on failure.
//   paint tiles back -> bigger brush -> "Restore the rest" to completion -> Re-erase -> move the hole (drag + arrow key)
//   -> switch blur setting -> compare wipe + hold Space -> the 12-job sweep -> Scene/Data + the job table
//   -> share link -> reload with the hash and confirm the view comes back -> the six sections, earlier words, both figures
//   -> every graph renders real pixels (scene, Figure 1's three panels, Figure 2's 12 cells, the meter) -> section links -> nav.
// This piece makes no sound: there are no audio files, and the run asserts that nothing ever starts audio.
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

// expected data, read from the sources the page is built from (not from the page)
const POS = JSON.parse(fs.readFileSync(path.join(web, 'positions.json'), 'utf8'));
const SWEEP = fs.readFileSync(path.join(piece, 'out', 'jobs.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => l.split(',')).map(([s, st, r, id, status]) => ({ strength: +s, style: st, reach: +r, job_id: id, status }))
  .filter(j => j.status === 'completed');
const URLS = JSON.parse(fs.readFileSync(path.join(root, 'site', 'urls.json'), 'utf8'));
const posJob = (x, y, set) => POS.find(p => p.x === x && p.y === y && p.setting === set).job_id;
const swJob = (s, st, r) => SWEEP.find(j => j.strength === s && j.style === st && j.reach === r).job_id;

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
  if (!cond) fails.push(name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''));
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [], failed = [], external = new Set();
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.hostname !== '127.0.0.1') external.add(u.hostname); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.addInitScript(INSTRUMENT);

  const T = id => page.$eval('#' + id, e => e.textContent.trim());
  const tiles = async () => { const m = (await T('m-num')).match(/(\d+) \/ (\d+)/); return { done: +m[1], total: +m[2] }; };
  const vis = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; });
  const attr = (sel, a) => page.$eval(sel, (e, a) => e.getAttribute(a), a);
  const canvasSig = sel => page.$eval(sel, c => c.toDataURL().length + ':' + c.toDataURL().slice(-400));
  const fxInk = () => page.$eval('#fx', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  // what a graph actually shows on screen: screenshot the element, decode it in the page, and return the number of
  // distinct colours (4 bits per channel) plus a 16 x 16 grey thumbnail for comparing two graphs
  async function pix(sel, pg = page) {
    const el = pg.locator(sel).first();
    await el.scrollIntoViewIfNeeded();
    const b64 = (await el.screenshot()).toString('base64');
    return pg.evaluate(async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
      const t = document.createElement('canvas'); t.width = t.height = 16; const tx = t.getContext('2d'); tx.drawImage(im, 0, 0, 16, 16);
      const td = tx.getImageData(0, 0, 16, 16).data, thumb = [];
      for (let i = 0; i < td.length; i += 4) thumb.push((td[i] + td[i + 1] + td[i + 2]) / 3);
      return { w: c.width, h: c.height, colors: set.size, thumb };
    }, b64);
  }
  const thumbDiff = (a, b) => a.thumb.reduce((s, v, i) => s + Math.abs(v - b.thumb[i]), 0) / a.thumb.length;
  async function at(x, y) { const b = await (await page.$('#cv')).boundingBox(); return { x: b.x + x / 1024 * b.width, y: b.y + y / 1024 * b.height }; }
  async function drag(x0, y0, x1, y1, n = 12) {
    await page.$eval('#cv', c => c.scrollIntoView({ block: 'center' }));
    const a = await at(x0, y0), b = await at(x1, y1);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: n }); await page.mouse.up();
  }

  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(600);

    // 1. start: the default hole, nothing restored, scene view
    check('loads with the centre hole and its scrambled job', (await T('r-hole')).startsWith('(512, 512)') && (await T('r-job')) === posJob(512, 512, 'scrambled'), [await T('r-hole'), await T('r-job')]);
    let t = await tiles();
    check('meter starts at 0 restored of a non-empty hole', t.done === 0 && t.total > 50, t);
    check('Re-erase is disabled while nothing is restored', await page.$eval('#reset', e => e.disabled));
    check('scene view: cast visible, Data note hidden, job table visible in The data', (await vis('.cast')) && !(await vis('#data-note')) && (await vis('#jobs')));
    check('scene view: the moths are drawn on the overlay', (await fxInk()) > 500);

    // 2. paint with the mender (Repair brush): confirm the tool toggle really switches first
    await page.click('#t-move');
    check('Move hole tool selects', (await attr('#stage', 'data-tool')) === 'move' && (await attr('#t-move', 'aria-pressed')) === 'true');
    await page.click('#t-brush');
    check('Repair brush tool selects', (await attr('#stage', 'data-tool')) === 'brush' && (await attr('#t-brush', 'aria-pressed')) === 'true');
    await drag(400, 512, 620, 512);
    const t1 = await tiles();
    check('painting restores tiles', t1.done > 0 && t1.done < t1.total, t1);
    check('Re-erase is enabled once tiles are back', !(await page.$eval('#reset', e => e.disabled)));
    await page.focus('#brush'); await page.keyboard.press('End');
    check('brush size slider goes to 140 px', (await T('brush-val')) === '140 px');
    await drag(512, 330, 512, 700);
    const t2 = await tiles();
    check('a bigger brush restores more tiles', t2.done > t1.done, [t1.done, t2.done]);

    // 3. Restore the rest, to completion
    await page.click('#auto');
    check('"Restore the rest" turns into "Pause" while it runs', (await T('auto')) === 'Pause');
    await page.waitForFunction(() => { const m = document.getElementById('m-num').textContent.match(/(\d+) \/ (\d+)/); return m && m[1] === m[2]; }, null, { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Pattern restored from the rim inward'), null, { timeout: 5000 });
    check('all tiles restored, celebration toast shown, button resets and disables',
      (await T('auto')) === 'Restore the rest' && (await page.$eval('#auto', e => e.disabled)), await T('toast'));

    // 4. Re-erase
    await page.click('#reset');
    t = await tiles();
    check('Re-erase clears the repair and disables itself', t.done === 0 && (await page.$eval('#reset', e => e.disabled)), t);

    // 5. move the hole: drag, then arrow key
    await page.click('#t-move');
    await drag(512, 512, 724, 300);
    await page.waitForTimeout(150);
    check('dragging the hole snaps it to (724, 300) and loads that job', (await T('r-hole')).startsWith('(724, 300)') && (await T('r-job')) === posJob(724, 300, 'scrambled'), [await T('r-hole'), await T('r-job')]);
    await page.focus('#cv'); await page.keyboard.press('ArrowLeft');
    check('arrow key steps the hole to (512, 300)', (await T('r-hole')).startsWith('(512, 300)') && (await T('r-job')) === posJob(512, 300, 'scrambled'), await T('r-hole'));

    // 6. blur setting
    await page.click('#s-mem');
    check('Faint memory loads the strength 0.3 job', (await T('r-job')) === posJob(512, 300, 'memory') && (await T('r-params')).includes('strength 0.3'), await T('r-params'));
    await page.click('#s-scr');
    check('Scrambled switches back', (await T('r-job')) === posJob(512, 300, 'scrambled') && (await attr('#s-scr', 'aria-pressed')) === 'true');

    // 7. compare: wipe and hold Space
    await page.click('#t-wipe');
    const c0 = await canvasSig('#cv');
    await drag(980, 600, 60, 600);
    const c1 = await canvasSig('#cv');
    check('Compare wipe changes the picture', c0 !== c1);
    await page.focus('#cv'); await page.keyboard.down(' ');
    const c2 = await canvasSig('#cv');
    await page.keyboard.up(' ');
    const c3 = await canvasSig('#cv');
    check('holding Space shows the original, releasing restores the view', c2 !== c1 && c3 === c1);

    // 8. the 12-job sweep
    await page.click('#tune-toggle');
    check('sweep opens: panel shown and button relabelled', (await vis('#tune')) && (await T('tune-toggle')) === 'Back to the movable hole');
    check('sweep uses the original hole at (580, 440) and disables Move', (await T('r-hole')).startsWith('(580, 440)') && (await page.$eval('#t-move', e => e.disabled)), await T('r-hole'));
    check('sweep hides the Scrambled / Faint memory group (it does not apply there)', !(await vis('#g-setting')));
    check('sweep defaults to the hero job', (await T('r-job')) === swJob(1, 'rx', 1), await T('r-job'));
    check('Move hole explains why it is disabled in the sweep', ((await attr('#t-move', 'title')) || '').includes('(580, 440)'));
    // every one of the 12 sweep jobs is reachable from the Strength / Gate / Reach buttons, and each one repaints the hole
    const seen = [];
    let sigPrev = await canvasSig('#cv');
    for (const s of [0.3, 0.6, 1]) for (const g of ['rx', 'ry']) for (const r of [0, 1]) {
      await page.click('#t-strength-' + String(s).replace('.', '_')); await page.click('#t-style-' + g); await page.click('#t-reach-' + r);
      await page.waitForFunction(() => { const i = imgs[current().file]; return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => draw());
      const sig = await canvasSig('#cv'), job = await T('r-job');
      const pressed = await page.$$eval('#tune [aria-pressed="true"]', bs => bs.map(b => b.textContent).join(' '));
      seen.push({ s, g, r, ok: job === swJob(s, g, r) && pressed === `${s.toFixed(1)} ${g} ${r ? '1 global' : '0 local'}`, changed: sig !== sigPrev });
      sigPrev = sig;
    }
    check('all 12 sweep jobs load from the buttons, buttons show the selection', seen.length === 12 && seen.every(x => x.ok), seen.filter(x => !x.ok));
    check('each sweep job repaints the hole', seen.every(x => x.changed), seen.filter(x => !x.changed).map(x => `${x.s}/${x.g}/${x.r}`));
    // deadcontrols.cjs flags the "rx" gate as a no-op only because rx is already selected when it clicks it.
    // Confirm: with ry selected, rx switches the job; clicking rx again keeps the same job (by design).
    await page.click('#t-style-ry');
    const jRy = await T('r-job');
    await page.click('#t-style-rx');
    const jRx = await T('r-job');
    await page.click('#t-style-rx');
    check('Gate rx is live: from ry it loads the rx job; re-clicking the selected rx keeps it',
      jRy === swJob(1, 'ry', 1) && jRx === swJob(1, 'rx', 1) && (await T('r-job')) === jRx && (await attr('#t-style-rx', 'aria-pressed')) === 'true', [jRy, jRx]);
    await page.click('#t-strength-0_6'); await page.click('#t-style-ry'); await page.click('#t-reach-0');
    check('strength 0.6 / ry / reach 0 loads its job', (await T('r-job')) === swJob(0.6, 'ry', 0) && (await T('r-params')).includes('strength 0.6'), await T('r-job'));

    // 9. share the sweep view
    await page.click('#share');
    await page.waitForTimeout(200);
    check('share writes the sweep view into the hash and copies it', (await page.evaluate(() => location.hash)) === '#t6ry0'
      && (await T('toast')) === 'Link copied' && (await page.evaluate(() => navigator.clipboard.readText())).endsWith('#t6ry0'), await page.evaluate(() => location.hash));

    // 10. Scene / Data
    await page.click('#g-view [data-view="data"]');
    check('Data view: note shown, cast hidden, toggle pressed', (await vis('#data-note')) && !(await vis('.cast')) && (await attr('#g-view [data-view="data"]', 'aria-pressed')) === 'true');
    check('Data view takes the moths off the canvas', (await fxInk()) === 0);
    const table = await page.$$eval('#jobs .jb', bs => bs.map(b => ({ k: b.dataset.k, id: b.title.replace('Job ', ''), cur: b.getAttribute('aria-current') })));
    const want = new Set(POS.map(p => p.job_id).concat(SWEEP.map(j => j.job_id)));
    check('job table lists all 30 jobs with the right IDs', table.length === 30 && table.every(r => want.has(r.id)) && new Set(table.map(r => r.id)).size === 30, table.length);
    check('job table marks the job on screen', table.filter(r => r.cur === 'true').map(r => r.k).join() === 't6ry0');
    await page.click('#jobs .jb[data-k="p300-724-memory"]');
    check('picking a hole job in the table leaves the sweep and loads it', !(await vis('#tune')) && (await T('r-hole')).startsWith('(300, 724)')
      && (await T('r-job')) === posJob(300, 724, 'memory') && (await attr('#s-mem', 'aria-pressed')) === 'true'
      && (await attr('#jobs .jb[data-k="p300-724-memory"]', 'aria-current')) === 'true', await T('r-job'));
    await page.click('#jobs .jb[data-k="t3rx0"]');
    check('picking a sweep job in the table opens the sweep on it', (await vis('#tune')) && (await T('r-job')) === swJob(0.3, 'rx', 0), await T('r-job'));
    await page.click('#jobs .jb[data-k="p300-724-memory"]');

    // 11. share the Data view, reload with the hash, confirm the state comes back
    await page.click('#share');
    await page.waitForTimeout(200);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    check('share link carries the hole, setting and Data view', link.endsWith('#p300-724-memory-data'), link);
    const p2 = await ctx.newPage();
    p2.on('pageerror', e => errors.push('pageerror (reload): ' + String(e.message || e).slice(0, 200)));
    await p2.addInitScript(INSTRUMENT);
    await p2.goto(link, { waitUntil: 'networkidle' });
    await p2.reload({ waitUntil: 'networkidle' });
    const r = await p2.evaluate(() => ({ hole: document.getElementById('r-hole').textContent, job: document.getElementById('r-job').textContent,
      data: document.getElementById('wrap').dataset.show, mem: document.getElementById('s-mem').getAttribute('aria-pressed'), tune: document.getElementById('tune').hidden }));
    check('reloading the shared link restores hole, setting and Data view', r.hole.startsWith('(300, 724)') && r.job === posJob(300, 724, 'memory') && r.data === 'data' && r.mem === 'true' && r.tune, r);
    await p2.goto(base + '#t10rx1', { waitUntil: 'networkidle' });
    await p2.reload({ waitUntil: 'networkidle' });
    const r2 = await p2.evaluate(() => ({ job: document.getElementById('r-job').textContent, tune: document.getElementById('tune').hidden, view: document.getElementById('wrap').dataset.show }));
    check('a sweep link (#t10rx1) opens the hero job in the sweep, scene view', r2.job === swJob(1, 'rx', 1) && !r2.tune && r2.view === 'scene', r2);
    await p2.evaluate(() => { location.hash = '#p724-724-scrambled'; });
    await p2.waitForTimeout(200);
    check('changing the hash in place loads that view too', (await p2.$eval('#r-job', e => e.textContent)) === posJob(724, 724, 'scrambled'));
    await p2.close();

    // 12. back to the scene
    await page.click('#g-view [data-view="scene"]');
    await page.$eval('#cv', c => c.scrollIntoView({ block: 'center' }));
    const sc = { cast: await vis('.cast'), note: await vis('#data-note'), table: await vis('#jobs'), ink: await fxInk() };   // no wait: the toggle redraws the overlay at once
    check('Scene view: cast back, note hidden, table still in The data, moths back on the canvas', sc.cast && !sc.note && sc.table && sc.ink > 500, sc);

    // 13. the titled sections below the scene: all visible, the earlier page's words verbatim, both figures drawn and wired
    const secs = await page.$$eval('section.sec', ss => ss.map(e => ({ id: e.id, h2: e.querySelector('h2')?.textContent.trim(), shown: e.getBoundingClientRect().height > 60 && getComputedStyle(e).display !== 'none' })));
    check('six titled sections, all visible', secs.map(x => x.h2).join('|') === 'How to play|The data|How it was made|The science|What this does not claim|Jobs and credits' && secs.every(x => x.shown), secs);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    const EARLIER = [
      "A quantum blur scrambled this hole across 20 qubits. Now it's your job to put the pattern back, tile by tile.",
      'Paint over the hole to restore the tiles under your brush.', 'Move the hole anywhere and watch the engine rewrite a new patch.',
      'Compare: drag across to see the original beneath the blur.',
      'Two rhombs cover the plane forever without repeating. Every finite patch still shows up again and again, so the surroundings of a hole pin down what used to be inside it.',
      'Li & Boyle (arXiv:2311.13040) turned that property into a quantum error-correcting code: erase any finite region and it can be diagnosed and repaired from the rest. Your repair brush is a hand-drawn cartoon of that idea.',
      "Atlas blur-v1 encodes the pixels inside the hole as a quantum state on a Gray-coded register. The hole's 541-pixel bounding box needs 10 + 10 = 20 qubits, which is the engine's maximum. One rotation is applied per qubit and the state is read back out. At full strength and reach, the aperiodic pattern comes back on a square grid: a periodic ghost of the qubit register itself.",
      'Every image you see inside the hole is a downloaded engine output: 9 hole positions × 2 settings, plus a 12-job parameter sweep. The job ID updates as you go.',
      "blur-v1 runs on a classical statevector simulator and has no QPU mode. The repair is classical geometry: your browser re-runs the same Robinson-triangle deflation. Atlas didn't encode or correct anything. The hole snaps to the nearest of nine computed positions.",
      "An independent entry to Moth Hack 2026, built on Moth Quantum's Atlas engines. Not an official Moth Quantum page.",
      "Ran on Atlas's classical statevector simulator (blur-v1 has no QPU mode). Panel 3 is classical geometry: the same Robinson-triangle deflation, repainted inside the hole.",
      'Penrose tilings form quantum error-correcting codes in which erasures of any finite region can be recovered (Li & Boyle, arXiv:2311.13040). Atlas did not run that code.'];
    const missing = EARLIER.filter(t => !text.includes(t));
    check('every earlier paragraph and step is on the page, word for word', missing.length === 0, missing.map(t => t.slice(0, 60)));
    check('brand bar reads "Challenge 01", and the page never says Bonus', (await page.$eval('.wtnr-bar .count', e => e.textContent.trim())) === 'Challenge 01 · Recover' && !/bonus|main entry/i.test(text));
    await page.$eval('#fig-sweep', e => e.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => sheetCells.every(c => c.im.getAttribute('href') === c.j.file && ready(imgs[c.j.file])), null, { timeout: 15000 }).catch(() => {});
    const f1 = await page.evaluate(() => ({ crop: document.getElementById('tri-crop').getAttribute('href'), cx: document.getElementById('tri-clipc').getAttribute('cx'),
      thick: (document.getElementById('tri-thick').getAttribute('d') || '').length, thin: (document.getElementById('tri-thin').getAttribute('d') || '').length,
      rings: document.querySelectorAll('#tri-ring2 circle, #tri-ring3 circle').length }));
    check('Figure 1: panel 2 is the hero job image, panel 3 holds the rebuilt tiles, caption is the hero job by default',
      f1.crop === 'img/sweep_s1.0_rx_r1.0.webp' && f1.cx === '580' && f1.thick > 2000 && f1.thin > 2000 && f1.rings === 4
      && (await T('tri-cap')).endsWith('job_id ' + swJob(1, 'rx', 1)) && (await T('tri-cap')).includes('strength=1.0, style=rx, reach=1.0'), { f1, cap: await T('tri-cap') });
    const sheet = await page.$$eval('#sheet .sj', bs => bs.map(b => b.title.replace('Job ', '')));
    check('Figure 2: 12 cells, the sweep jobs in jobs.csv order, every image loaded', sheet.join() === SWEEP.map(j => j.job_id).join()
      && (await page.evaluate(() => sheetCells.every(c => c.im.getAttribute('href') === c.j.file && ready(imgs[c.j.file])))), sheet.length);
    await page.click('#g-tri [data-tri="scene"]');
    check('Figure 1 follows the job on screen when asked', (await T('tri-cap')).endsWith('job_id ' + posJob(300, 724, 'memory')) && (await T('tri-load')) === 'Back to the scene', await T('tri-cap'));
    await page.click('#sheet .sj[data-k="t6ry1"]');
    check('a Figure 2 cell loads its job in the scene, marks itself, and Figure 1 follows', (await T('r-job')) === swJob(0.6, 'ry', 1) && (await vis('#tune'))
      && (await attr('#sheet .sj[data-k="t6ry1"]', 'aria-current')) === 'true' && (await T('tri-cap')).endsWith('job_id ' + swJob(0.6, 'ry', 1)), await T('r-job'));
    await page.click('#g-tri [data-tri="hero"]');
    await page.click('#tri-load');
    check('"Load this job in the scene" loads the hero job', (await T('r-job')) === swJob(1, 'rx', 1) && (await attr('#sheet .sj[data-k="t10rx1"]', 'aria-current')) === 'true', await T('r-job'));

    // 13b. every graph renders real pixels: the scene, the three panels of Figure 1, the 12 cells of Figure 2, the cast
    const scene = await pix('#cv');
    check('the scene canvas renders the tiling and the job image', scene.w > 300 && scene.colors > 30, scene.colors);
    const f1a = await pix('#tri-1'), f1b = await pix('#tri-2'), f1c = await pix('#tri-3');
    check('Figure 1: all three panels render', [f1a, f1b, f1c].every(p => p.w > 100 && p.colors > 30), [f1a.colors, f1b.colors, f1c.colors]);
    const d12 = thumbDiff(f1a, f1b), d13 = thumbDiff(f1a, f1c), d23 = thumbDiff(f1b, f1c);
    check('Figure 1: panel 2 (blur-v1) differs from panel 1 (intact); panel 3 (rebuilt) is far closer to panel 1 than panel 2 is', d12 > 3 && d23 > 3 && d13 < d12 / 2, { d12: +d12.toFixed(2), d13: +d13.toFixed(2), d23: +d23.toFixed(2) });
    const cells = [];
    for (let i = 1; i <= 12; i++) cells.push(await pix(`#sheet .sj:nth-child(${i}) svg`));
    const uniq = new Set(cells.map(c => c.thumb.map(v => Math.round(v)).join(','))).size;
    check('Figure 2: all 12 cells render, each a different job image', cells.every(c => c.w > 50 && c.colors > 10) && uniq === 12, { colors: cells.map(c => c.colors), uniq });
    const cast = await page.evaluate(() => ['cast-mender', 'cast-nibbler'].map(id => { const i = document.getElementById(id); return i.complete && i.naturalWidth > 0; }));
    check('the cast pictures render', cast.every(Boolean), cast);
    await page.$eval('#m-bar', e => e.scrollIntoView({ block: 'center' }));
    await page.click('#t-brush'); await drag(480, 440, 680, 440);
    const mb = await page.evaluate(() => { const m = document.getElementById('m-num').textContent.match(/(\d+) \/ (\d+)/); return { w: parseFloat(document.getElementById('m-bar').style.width), want: 100 * m[1] / m[2] }; });
    check('Restored meter bar width tracks the tile count', mb.want > 0 && Math.abs(mb.w - mb.want) < 0.01, mb);
    await page.click('#reset');

    // 13c. every in-page link lands on its section
    const anchors = [['nav.toc a[href="#how-to-play"]', 'how-to-play'], ['nav.toc a[href="#data"]', 'data'], ['nav.toc a[href="#made"]', 'made'],
      ['nav.toc a[href="#science"]', 'science'], ['nav.toc a[href="#claims"]', 'claims'], ['nav.toc a[href="#credits"]', 'credits'],
      ['.steps a[href="#data"]', 'data'], ['.facts a[href="#jobs"]', 'jobs']];
    const landed = [];
    for (const [sel, id] of anchors) {
      await page.click(sel); await page.waitForTimeout(700);
      landed.push(await page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, hash: location.hash, inView: r.top < innerHeight - 40 && r.bottom > 40 }; }, id));
    }
    check('section links (6 in the row, plus "The data" in step 4 and "Table 1" in Jobs and credits) scroll to their sections', landed.every(l => l.hash === '#' + l.id && l.inView), landed.filter(l => !(l.hash === '#' + l.id && l.inView)));
    check('a section link does not change the view on screen', (await T('r-job')) === swJob(1, 'rx', 1), await T('r-job'));

    // 14. piece-to-piece navigation
    const nav = await page.evaluate(() => {
      const n = document.querySelector('nav.wtnr-nav'); if (!n) return null;
      return { prev: n.querySelector('a[rel=prev]')?.href, next: n.querySelector('a[rel=next]')?.href, hub: n.querySelector('a.wn-hub')?.href,
        brand: document.querySelector('.wtnr-bar a')?.href, all: [...n.querySelectorAll('ol a')].map(a => a.href),
        here: n.querySelector('ol a[aria-current=page]')?.href, beforeFoot: !!(n.compareDocumentPosition(document.querySelector('.wtnr-foot')) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    check('nav present before the footer', nav && nav.beforeFoot);
    check('prev -> 22, next -> 02, hub and brand bar -> hub', nav && nav.prev === URLS['22-scroll-unroll'] && nav.next === URLS['02-coda-reservoir'] && nav.hub === HUB && nav.brand === HUB, nav && { prev: nav.prev, next: nav.next, hub: nav.hub });
    const known = new Set(Object.values(URLS).concat([HUB]));
    check('"Jump to any piece" lists all 22, every link known, this page marked', nav && nav.all.length === 22 && nav.all.every(u => known.has(u)) && nav.here === URLS['01-penrose-hole'], nav && nav.all.length);
    await page.click('nav.wtnr-nav summary');
    check('"Jump to any piece" opens', await page.$eval('nav.wtnr-nav details', e => e.open));

    // 15. audio: this piece has none, and nothing may sound on its own
    const audioFiles = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(wav|mp3|ogg|m4a|webm|mp4)$/i.test(f)) audioFiles.push(f); } })(web);
    const q = await page.evaluate(() => window.__qa);
    check('no audio files and no sound started anywhere in the journey (silent piece)', audioFiles.length === 0 && q.sources === 0 && q.media === 0, { audioFiles, q });

    // 16. numbers on the page match piece.json, and web/ ships exactly what files.json lists
    const PJ = JSON.parse(fs.readFileSync(path.join(piece, 'piece.json'), 'utf8'));
    const chips = await page.$$eval('.proof b', bs => bs.map(b => +b.textContent));
    check('proof chips match piece.json (qubits, jobs)', chips[0] === PJ.qubits && chips[1] === PJ.jobs && PJ.jobs === POS.length + SWEEP.length, { chips, qubits: PJ.qubits, jobs: PJ.jobs });
    const FM = JSON.parse(fs.readFileSync(path.join(web, 'files.json'), 'utf8'));
    const onDisk = fs.readdirSync(path.join(web, 'img')).map(f => 'img/' + f);
    const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
    check('web/img holds exactly the files in files.json, all present', onDisk.length === Object.keys(FM).length && onDisk.every(f => FM[f] === 'entries/01-penrose-hole/web/' + f)
      && Object.values(FM).every(v => fs.existsSync(path.join(root, v))), { onDisk: onDisk.length, listed: Object.keys(FM).length });
    check('every image the page loads is listed in files.json', Object.keys(FM).every(f => f === 'img/mascot.png' || html.includes(f)) && [...html.matchAll(/img\/[\w.]+\.webp/g)].every(m => FM[m[0]]));

    // 17. phone width: Data view and Scene view fit at 375 px
    const m = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await m.newPage();
    await mp.goto(base + '#p512-512-scrambled-data', { waitUntil: 'networkidle' });
    const ovD = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await mp.click('#g-view [data-view="scene"]');
    const ovS = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('no horizontal scroll at 375 px in Data or Scene view', ovD <= 1 && ovS <= 1, { ovD, ovS });
    await m.close();
  } catch (e) {
    check('journey ran without throwing', false, String(e.message || e).slice(0, 300));
  }

  check('no page or console errors', errors.length === 0, errors.slice(0, 5));
  check('no failed requests', failed.length === 0, failed.slice(0, 5));
  check('only Google Fonts hosts contacted', [...external].every(h => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h)), [...external]);

  const out = { piece: '01-penrose-hole', ok: fails.length === 0, passed: steps.filter(s => s.ok).length, total: steps.length, fails, steps };
  fs.writeFileSync(path.join(piece, 'qa', 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ok: out.ok, passed: out.passed, total: out.total, fails }, null, 1));
  await browser.close(); server.close();
  process.exit(out.ok ? 0 : 1);
})();
