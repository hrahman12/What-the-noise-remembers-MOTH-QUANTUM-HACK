// End-to-end journey for Maxwell's Ribbon: node entries/11-maxwells-ribbon/qa/e2e.cjs [port 6390-6399]
// Serves web/ locally, opens index.html in headless Chromium and walks the main user journey with real assertions:
// the shoot sequence on two machines, the shots slider, the Scene / Data toggle and the 3D ball, the science drawers,
// the chapter instruments (filters, hidden-arrow game, run table, ribbon, quiz), every first-version graph rendering
// under its titled section (screenshot pixels, not just the DOM), the share link restored after a
// reload, the shared prev / hub / next nav, and the numbers on the page against piece.json and the engine cache.
// This piece makes no sound (README: "There is no audio in this piece"), so the audio step asserts that no audio or
// video ships and that nothing ever sounds, using the same instrumentation as common/qa/qa_page.cjs.
// Prints a JSON report and exits 1 if any step fails.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6390);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(WEB, 'data.json'), 'utf8'));
const JOB = (m, s) => data.jobs.find(j => j.machine === m && j.shots === s);
const BALL = require(path.join(WEB, 'ball.js'));   // the page's own colour-ball maths (inlined into index.html at build)
// the plates readout the page must show for a test-colour pick: sent (c+1)/2 from the swatch, measured (c+1)/2 from the job's raw output
function expectedPlates(hex, job) {
  const sw = data.swatches, n = BALL.nearest(BALL.unhex(hex), sw), v = BALL.toVec(BALL.rgbToBall(sw[n.i].rgb)), raw = job.swv[n.i];
  return [0, 1, 2].map(a => `${'XYZ'[a]} ${((v[a] + 1) / 2).toFixed(2)} → ${((raw[a] + 1) / 2).toFixed(2)}`).join(' · ') + ' (sent → measured)';
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.js': 'text/javascript' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

const INSTRUMENT = () => {   // as common/qa/qa_page.cjs: count Web Audio sources and media 'playing' events
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

const steps = [];
let failed = false;
function check(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(INSTRUMENT);

  const text = sel => page.$eval(sel, e => e.textContent.trim());
  const visible = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.width > 0 && r.height > 0; });
  const readouts = () => page.evaluate(() => ({ where: document.getElementById('r-where').textContent, qubits: document.getElementById('r-qubits').textContent,
    src: document.getElementById('r-src').textContent, plates: document.getElementById('r-plates').textContent, job: document.getElementById('r-job').textContent,
    err: document.getElementById('m-err').textContent, pick: document.getElementById('pick').value, shots: document.getElementById('shots').value,
    machine: (document.querySelector('#g-machine button[aria-pressed="true"]') || {}).dataset?.m,
    view: document.getElementById('data-view').hidden ? 'scene' : 'data', drift: document.getElementById('drift').getAttribute('aria-pressed') }));
  async function shootAndWait() {   // press the shoot button, see the sequence start, wait for it to finish
    await page.click('#shoot');
    await page.waitForFunction(() => document.getElementById('shoot').textContent === 'Skip to the result', null, { timeout: 3000 });
    await page.waitForFunction(() => document.getElementById('shoot').textContent === 'Take the three photos', null, { timeout: 9000 });
    await page.waitForTimeout(150);
  }
  const tagPos = () => page.$$eval('#tags .tag', es => es.map(e => e.style.left + ',' + e.style.top).join(';'));
  // what is actually on screen for an element: screenshot it, then count the pixels that are not paper (#FBFAF9) and
  // the distinct colours (5 bits per channel). Works the same for 2D canvases, WebGL canvases, images and HTML charts.
  async function painted(sel) {
    await page.$eval(sel, e => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(350);
    const png = (await page.locator(sel).first().screenshot()).toString('base64');
    return page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, cols = new Set(); let ink = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - 251) + Math.abs(d[i + 1] - 250) + Math.abs(d[i + 2] - 249) > 30) ink++;
        cols.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
      }
      return { w: c.width, h: c.height, ink: +(ink / (d.length / 4)).toFixed(3), colours: cols.size };
    }, png);
  }
  async function step(name, fn) {
    const e0 = errors.length;
    try { const detail = await fn(); check(errors.length === e0, 'page error: ' + errors.slice(e0).join(' | ')); steps.push({ name, ok: true, detail: detail || '' }); }
    catch (e) { failed = true; steps.push({ name, ok: false, detail: String(e.message || e).slice(0, 400) }); }
  }

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  await step('loads in the Scene view with Maxwell speaking and nothing playing', async () => {
    check(await visible('#scene'), 'scene canvas not visible');
    check(!(await visible('#sphere')), 'data view should start hidden');
    check((await page.getAttribute('#g-view [data-view="scene"]', 'aria-pressed')) === 'true', 'Scene button not pressed');
    check((await text('#say-text')).length > 10, 'Maxwell has no line');
    check((await text('#shoot')) === 'Take the three photos', 'shoot button label');
    const r = await readouts();
    check(r.job.startsWith(JOB('aer', 1024).job_id), 'default run is not aer 1024: ' + r.job);
    return r.job;
  });

  await step('proof chips and readouts match piece.json and the job data', async () => {
    const proof = await text('#proof');
    check(proof.includes(`${piece.qubits} qubits on ${piece.hardware}`), 'qubit chip: ' + proof);
    check(proof.includes(`${piece.jobs} real Atlas jobs`), 'jobs chip: ' + proof);
    check(data.jobs.length === piece.jobs, `data.json has ${data.jobs.length} jobs, piece.json says ${piece.jobs}`);
    const hw = data.jobs.find(j => j.kind === 'hw');
    check(hw && hw.backend === piece.hardware, 'hardware job backend');
    check(piece.qubits_note.includes(hw.ibm_job_id), 'piece.json qubits_note names the IBM job');
    return proof;
  });

  await step('take the three photos (perfect simulator): plates land, portrait rebuilt, Maxwell reacts to the real miss', async () => {
    const before = await page.$eval('#scene', c => c.toDataURL());
    await shootAndWait();
    const after = await page.$eval('#scene', c => c.toDataURL());
    check(before !== after, 'scene did not change');
    const say = await text('#say-text'), r = await readouts();
    const miss = (say.match(/Off by (\d\.\d\d)/) || [])[1];
    check(miss, 'Maxwell did not give the miss: ' + say);
    check(r.err === `off by ${miss}`, `meter (${r.err}) and Maxwell (${miss}) disagree`);
    const want = expectedPlates(r.pick, JOB('aer', 1024));
    check(r.plates === want, `plates readout ${r.plates} is not the cached aer 1024 output ${want}`);
    return say + ' | ' + r.plates;
  });

  await step('switch to the real ibm_fez chip and shoot again', async () => {
    await page.click('#g-machine [data-m="ibm_fez"]');
    const r = await readouts(), hw = JOB('ibm_fez', 1024);
    check(r.job.includes(hw.job_id) && r.job.includes(hw.ibm_job_id), 'job readout: ' + r.job);
    check(r.qubits.startsWith('156'), 'qubits readout: ' + r.qubits);
    check(r.where.includes('real IBM quantum hardware') && r.where.includes('ibm_fez'), 'where readout: ' + r.where);
    check(await page.$eval('#shots', e => e.disabled), 'shots slider should be fixed for the single hardware run');
    await shootAndWait();
    const say = await text('#say-text');
    check(/Off by \d\.\d\d/.test(say) && say.includes('real chip'), 'Maxwell line after the hardware shoot: ' + say);
    const r2 = await readouts(), want = expectedPlates(r2.pick, hw);
    check(r2.plates === want, `hardware plates readout ${r2.plates} is not the cached ibm_fez output ${want}`);
    return say + ' | ' + r2.plates;
  });

  await step('shots slider and machine selector swap the cached runs', async () => {
    await page.click('#g-machine [data-m="aer"]');
    await page.focus('#shots'); await page.keyboard.press('Home');
    let r = await readouts();
    check(r.shots === '0' && r.job.startsWith(JOB('aer', 16).job_id), '16-shot aer run: ' + r.job);
    check((await text('#shots-note')).includes('exactly 0 or 1'), '16-shot note');
    await page.click('#g-machine [data-m="fake_brisbane"]');
    await page.focus('#shots'); await page.keyboard.press('End');
    r = await readouts();
    check(r.job.startsWith(JOB('fake_brisbane', 1024).job_id), 'brisbane 1024 run: ' + r.job);
    check(r.qubits.startsWith('127'), 'brisbane qubits: ' + r.qubits);
    await page.click('#g-machine [data-m="aer"]');
    r = await readouts();
    check(r.job.startsWith(JOB('aer', 1024).job_id), 'back to aer 1024: ' + r.job);
    return 'aer 16 -> brisbane 1024 -> aer 1024';
  });

  await step('click the sitter and the camera in the scene', async () => {
    const box = await page.$eval('#scene', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const pick0 = (await readouts()).pick;
    await page.mouse.click(box.x + box.w * 0.03, box.y + box.h * 0.67);   // the sitter on its stool
    await page.waitForTimeout(300);
    const r = await readouts();
    check(r.pick !== pick0 && /^test colour \d+ of 112/.test(r.src), 'sitter click: ' + r.src);
    await page.mouse.click(box.x + box.w * 0.22, box.y + box.h * 0.75);   // the camera
    await page.waitForFunction(() => document.getElementById('shoot').textContent === 'Skip to the result', null, { timeout: 3000 });
    await page.click('#shoot');                                            // "Skip to the result"
    await page.waitForFunction(() => document.getElementById('shoot').textContent === 'Take the three photos', null, { timeout: 3000 });
    check(/Off by/.test(await text('#say-text')), 'skip did not land on the result');
    return r.src;
  });

  await step('toggle Scene / Data: turn the 3D colour ball, drift lines, reset the angle', async () => {
    await page.click('#g-view [data-view="data"]');
    await page.waitForTimeout(400);
    check(await visible('#sphere') && !(await visible('#scene')), 'data view not shown');
    check(!(await page.$('#data-view p.note')), 'WebGL fallback shown instead of the ball');
    const t0 = await tagPos();
    check(t0.split(';').length === 12, 'ball labels missing');
    const b = await page.$eval('#sphere', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(b.x + b.w * .3, b.y + b.h * .3); await page.mouse.down();
    await page.mouse.move(b.x + b.w * .6, b.y + b.h * .5, { steps: 8 }); await page.mouse.up();
    const t1 = await tagPos();
    check(t1 !== t0, 'dragging did not turn the ball');
    await page.click('#reset-view');
    check((await tagPos()) === t0, 'Reset view did not restore the starting angle');
    check((await text('#toast')) === 'Colour ball turned back to its starting angle', 'Reset view gave no feedback');
    await page.click('#drift');
    check((await page.getAttribute('#drift', 'aria-pressed')) === 'true' && (await text('#drift')) === 'Hide the drift', 'drift toggle');
    await page.click('#drift');
    check((await page.getAttribute('#drift', 'aria-pressed')) === 'false', 'drift toggle off');
    await page.click('#g-view [data-view="scene"]');
    check(await visible('#scene') && !(await visible('#sphere')), 'scene view not back');
    return 'ball turned and reset; drift on/off';
  });

  await step('titled sections under the scene: How to play (first-version steps), The data, brand bar says Challenge 11', async () => {
    const heads = await page.$$eval('section.sec .ink-bar h2', hs => hs.map(h => h.textContent.trim()));
    for (const h of ['How to play', 'The data', 'How it was made', 'What this does not claim', 'Jobs and credits'])
      check(heads.includes(h), `section "${h}" missing: ${heads.join(' / ')}`);
    const steps = await page.$$eval('#play ol.steps li', ls => ls.map(l => l.textContent.trim()));
    check(steps.join('|') === "Pick any colour, or click a pixel of Maxwell's ribbon further down.|Slide the shots: more measurements give a sharper rebuild.|Switch machines: a perfect simulator, two noisy-chip models, a real IBM chip.", 'How to play steps: ' + steps.join('|'));
    const bar = await text('nav.wtnr-bar .count');
    check(bar.startsWith('Challenge 11') && !/bonus|\/ 11/i.test(bar), 'brand bar: ' + bar);
    check(!/\bBonus\b/.test(await page.evaluate(() => document.body.innerText)), 'the word "Bonus" (a ranking) is on the page');
    return heads.join(' / ');
  });

  await step('The data: the colour ball is on show without any toggle, turns with the one at the top, and follows every pick', async () => {
    await page.$eval('#data', e => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    check(await visible('#sphere-d') && !(await page.$('#ball-d p.note')), 'ball in "The data" not visible (or WebGL fallback)');
    const tp = () => page.$$eval('#tags-d .tag', es => es.map(e => e.style.left + ',' + e.style.top).join(';'));
    const t0 = await tp();
    check(t0.split(';').length === 12, 'ball labels in The data');
    const b = await page.$eval('#sphere-d', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(b.x + b.w * .3, b.y + b.h * .3); await page.mouse.down();
    await page.mouse.move(b.x + b.w * .6, b.y + b.h * .5, { steps: 8 }); await page.mouse.up();
    check((await tp()) !== t0, 'dragging the ball in The data did not turn it');
    await page.click('#drift-d');
    check((await page.getAttribute('#drift-d', 'aria-pressed')) === 'true' && (await page.getAttribute('#drift', 'aria-pressed')) === 'true', 'drift switch in The data is not shared with the one at the top');
    await page.click('#drift-d');
    const before = await text('#d-run');
    await page.click('#runs button[data-m="fake_brisbane"][data-s="128"]');
    check((await text('#d-run')).includes('Brisbane noise') && (await text('#d-run')) !== before, 'The data does not follow a run picked in chapter 4: ' + await text('#d-run'));
    await page.click('#g-machine [data-m="aer"]'); await page.focus('#shots'); await page.keyboard.press('End');
    await page.click('#c-top');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'sphere-d'), '"See it on the ball" did not go to the ball');
    return (await text('#d-run')).slice(0, 80);
  });

  await step('chapter 3: the "Where your colour sits" bars are back and follow the pick', async () => {
    const rows = await page.$$eval('#c-bars > span', s => s.map(x => x.textContent));
    check(rows.length === 8 && rows[0] === 'Z: light–dark' && rows[6] === 'away from grey', 'c-bars rows: ' + rows.join('|'));
    const v0 = await text('#c-bars');
    await page.$eval('#pick', e => { e.value = '#20e0a0'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    check((await text('#c-bars')) !== v0, 'c-bars did not change with a new colour');
    return (await text('#c-bars')).replace(/\s+/g, ' ');
  });

  await step('Jobs and credits: one row per cached job, Load puts it everywhere, the failed Tessa jobs listed', async () => {
    const n = await page.$$eval('#jobs-table tbody tr', r => r.length);
    check(n === data.jobs.length, `${n} job rows for ${data.jobs.length} jobs`);
    const ids = await text('#jobs-table');
    check(data.jobs.every(j => ids.includes(j.job_id)) && ids.includes(JOB('ibm_fez', 1024).ibm_job_id), 'a job ID is missing from the table');
    await page.click('#jobs-table button[data-m="fake_fez"][data-s="1024"]');
    const r = await readouts();
    check(r.job.startsWith(JOB('fake_fez', 1024).job_id) && r.machine === 'fake_fez', 'Load did not load the run: ' + r.job);
    check((await page.getAttribute('#runs button[data-m="fake_fez"][data-s="1024"]', 'aria-pressed')) === 'true', 'run table does not show the loaded run');
    check(((await text('#jobs-tessa')).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/g) || []).length === 5, 'Tessa failures: ' + await text('#jobs-tessa'));
    await page.click('#g-machine [data-m="aer"]');
    return `${n} jobs; Load fake_fez 1024 ok`;
  });

  await step('How it was made (two drawers) and What this does not claim (always open)', async () => {
    const n = await page.$$eval('details.drawer', ds => ds.length);
    check(n === 2, `${n} drawers`);
    for (let i = 0; i < n; i++) {
      const s = (await page.$$('details.drawer summary'))[i];
      await s.click();
      check(await page.$$eval('details.drawer', (ds, i) => ds[i].open && ds[i].querySelector('.body').textContent.trim().length > 100, i), `drawer ${i} empty or shut`);
    }
    const eng = await text('#drawer-engine');
    check(eng.includes('qpixl-v1') && eng.includes(JOB('ibm_fez', 1024).ibm_job_id), 'engine drawer content');
    check(await visible('#drawer-honest') && (await text('#drawer-honest')).includes('No quantum advantage is claimed'), 'honesty notes not on show');
    return 'Why Maxwell / What the engine did; What this does not claim open';
  });

  await step('chapter 1: filter buttons and clicking the picture step through the plates', async () => {
    await page.click('#g-filters [data-f="0"]');
    check((await text('#filters-cap')).startsWith('Two plates'), 'one filter off');
    await page.click('#filters');
    check((await text('#filters-cap')).startsWith('Only the red-filter plate'), 'picture click 1: ' + await text('#filters-cap'));
    await page.click('#filters'); await page.click('#filters');
    check((await text('#filters-cap')).startsWith('Only the blue-filter plate'), 'picture click 3');
    await page.click('#filters');
    check((await text('#filters-cap')).startsWith('All three plates'), 'picture click 4');
    check((await page.$$eval('#g-filters button', bs => bs.map(b => b.getAttribute('aria-pressed')).join())) === 'true,true,true', 'filter buttons follow the picture');
    return 'R -> G -> B -> all';
  });

  await step('chapter 2: measure the hidden arrow, reveal it by clicking the curtain, send the rebuild up', async () => {
    await page.click('#g-new');
    for (const m of ['2', '0', '1']) await page.click(`#game [data-m="${m}"]`);
    check((await text('#g-count')) === '30 clicks', 'click count: ' + await text('#g-count'));
    check((await text('#g-msg')).startsWith('All three directions measured'), 'game message');
    await page.click('#g-hidden');
    check(/Your rebuild was off by \d\.\d\d/.test(await text('#g-msg')), 'curtain click did not reveal');
    const pick0 = (await readouts()).pick;
    await page.click('#g-guess');
    const r = await readouts();
    check(/^nearest of 112 test colours/.test(r.src), 'rebuild not sent to the studio: ' + r.src);
    check((await text('#toast')).includes("Maxwell's studio"), 'toast after sending the rebuild');
    return `pick ${pick0} -> ${r.pick}`;
  });

  await step('chapter 4: a run-table cell loads that run at the top', async () => {
    await page.click('#runs button[data-m="fake_fez"][data-s="128"]');
    const r = await readouts();
    check(r.job.startsWith(JOB('fake_fez', 128).job_id) && r.machine === 'fake_fez', 'run cell: ' + r.job);
    check((await page.getAttribute('#runs button[data-m="fake_fez"][data-s="128"]', 'aria-pressed')) === 'true', 'cell pressed state');
    return r.job;
  });

  await step('every graph of the first version renders under its section (history/restore_report.md G1-G8), plus the studio scene', async () => {
    const out = [], need = (name, r, ink, cols) => { check(r.w > 20 && r.h > 20 && r.ink >= ink && r.colours >= cols, `${name} looks empty: ${JSON.stringify(r)}`); out.push(`${name} ${Math.round(r.ink * 100)}% ink/${r.colours} col`); };
    // which section each graph sits under
    const where = await page.evaluate(() => Object.fromEntries(['sphere-d', 'filters', 'g-hidden', 'g-guess', 'g-bars', 'c-bars', 'runs', 'rib'].map(id =>
      [id, (document.getElementById(id).closest('section') || {}).id])));
    check(JSON.stringify(where) === JSON.stringify({ 'sphere-d': 'data', filters: 'ch1', 'g-hidden': 'ch2', 'g-guess': 'ch2', 'g-bars': 'ch2', 'c-bars': 'ch3', runs: 'ch4', rib: 'ch5' }),
      'a graph is not under its section: ' + JSON.stringify(where));
    check((await page.$eval('#ch1 img.photo', e => e.closest('section').id)) === 'ch1', 'the 1861 photograph is not in chapter 1');
    need('studio scene', await painted('#scene'), 0.15, 12);
    need('G1 colour ball (The data)', await painted('#sphere-d'), 0.05, 40);
    check((await page.$$eval('#tags-d .tag', t => t.length)) === 12, 'G1 ball labels');
    await page.click('#g-view [data-view="data"]'); await page.waitForTimeout(400);
    need('G1 colour ball (hero Data view)', await painted('#sphere'), 0.05, 40);
    await page.click('#g-view [data-view="scene"]');
    need('G2 filters', await painted('#filters'), 0.5, 40);
    await page.$eval('#ch1 img.photo', e => e.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => { const i = document.querySelector('#ch1 img.photo'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
    check((await page.$eval('#ch1 img.photo', i => i.naturalWidth + 'x' + i.naturalHeight)) === '720x589', 'G3 photograph size');
    need('G3 photograph', await painted('#ch1 img.photo'), 0.5, 100);
    need('G4 hidden arrow', await painted('#g-hidden'), 0.2, 4);
    need('G4 your rebuild', await painted('#g-guess'), 0.2, 4);
    const gb = await page.$$eval('#g-bars i', is => is.map(i => [...i.querySelectorAll('span')].map(s => s.getBoundingClientRect().width)));
    check(gb.length === 3 && gb.every(w => w.length >= 1 && w.some(x => x > 0)), 'G5 hidden-arrow estimate bars: ' + JSON.stringify(gb));
    need('G5 estimate bars', await painted('#g-bars'), 0.05, 3);
    const cb = await page.$$eval('#c-bars i span', s => s.map(x => x.getBoundingClientRect().width));
    check(cb.length === 4 && cb.filter(w => w > 0).length >= 2, 'G6 "Where your colour sits" bars: ' + JSON.stringify(cb));
    need('G6 colour bars', await painted('#c-bars'), 0.05, 3);
    const cells = await page.$$eval('#runs button[data-m]', bs => bs.map(b => b.textContent.trim()));
    check(cells.length === data.jobs.length && cells.every(t => /\d\.\d\d/.test(t)), 'G7 run table cells: ' + cells.join(' | '));
    need('G7 run table', await painted('#runs'), 0.05, 3);
    need('G8 ribbon', await painted('#rib'), 0.5, 60);
    return out.join('; ');
  });

  await step('chapter 5: click a ribbon pixel, then share the view and restore it after a reload', async () => {
    await page.click('#g-machine [data-m="ibm_fez"]');
    const rb = await page.$eval('#rib', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(rb.x + rb.w * 0.55, rb.y + rb.h * 0.45);
    let r = await readouts();
    check(/^ribbon pixel \(\d, \d\) of 6×6/.test(r.src), 'ribbon pixel: ' + r.src);
    await page.click('#g-view [data-view="data"]');
    await page.click('#share');
    await page.waitForTimeout(200);
    const hash = await page.evaluate(() => location.hash);
    check(/^#ibm_fez\.1024\.r\.6\.\d\.\d\.b$/.test(hash), 'share token: ' + hash);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(clip.endsWith(hash) && (await text('#toast')) === 'Link copied', 'clipboard / toast');
    const want = await readouts();
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    r = await readouts();
    for (const k of ['job', 'src', 'plates', 'pick', 'machine', 'view', 'err']) check(r[k] === want[k], `after reload ${k}: ${r[k]} != ${want[k]}`);
    // a test colour picked on the sitter comes back as that test colour
    await page.click('#g-view [data-view="scene"]');
    await page.click('#g-machine [data-m="aer"]');
    const box = await page.$eval('#scene', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(box.x + box.w * 0.03, box.y + box.h * 0.67);
    await page.click('#share');
    const want2 = await readouts(), hash2 = await page.evaluate(() => location.hash);
    check(/^#aer\.1024\.c\.[0-9a-f]{6}$/.test(hash2), 'share token 2: ' + hash2);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    r = await readouts();
    for (const k of ['job', 'src', 'plates', 'pick', 'machine', 'view']) check(r[k] === want2[k], `after reload 2 ${k}: ${r[k]} != ${want2[k]}`);
    return `${hash} and ${hash2} restored`;
  });

  await step('quiz: answer, score, start again', async () => {
    check(!(await visible('#q-reset')), '"Start again" should stay hidden until something is answered');
    await page.check('input[name="q0"][value="0"]');
    check(await visible('#q-reset'), '"Start again" did not appear after an answer');
    check((await text('#q-score')) === '1 / 3' && (await text('#fb0')).startsWith('Right.'), 'right answer');
    await page.check('input[name="q1"][value="0"]');
    check((await text('#fb1')).startsWith('Not quite.'), 'wrong answer feedback');
    await page.click('#q-reset');
    check((await text('#q-score')) === '0 / 3' && !(await page.$('input[name="q0"]:checked')), 'Start again');
    check(!(await visible('#q-reset')) && (await page.evaluate(() => document.activeElement.name)) === 'q0', 'after Start again: button hidden, focus on question 1');
    return 'score 1 / 3 then reset';
  });

  await step('shared nav: prev / hub / next links and the jump list, brand bar to the hub', async () => {
    const nav = await page.$eval('nav.wtnr-nav', n => ({ prev: n.querySelector('a[rel="prev"]').href, prevT: n.querySelector('a[rel="prev"]').textContent,
      next: n.querySelector('a[rel="next"]').href, nextT: n.querySelector('a[rel="next"]').textContent, hub: n.querySelector('a.wn-hub').href,
      items: n.querySelectorAll('ol a').length, cur: (n.querySelector('ol a[aria-current="page"]') || {}).href }));
    check(nav.prev === urls['10-squeezed-chirp'] && nav.prevT.includes('10'), 'prev link: ' + nav.prev);
    check(nav.next === urls['12-chirp-instrument'] && nav.nextT.includes('12'), 'next link: ' + nav.next);
    check(nav.hub === HUB, 'hub link: ' + nav.hub);
    check(nav.items === Object.keys(urls).length, `jump list has ${nav.items} pieces`);
    check(nav.cur === urls['11-maxwells-ribbon'], 'current piece not marked: ' + nav.cur);
    check((await page.$eval('nav.wtnr-bar a', a => a.href)) === HUB, 'brand bar link');
    check(await page.$eval('nav.wtnr-nav', n => n.nextElementSibling && n.nextElementSibling.classList.contains('wtnr-foot')), 'nav sits just before the footer');
    await page.click('nav.wtnr-nav summary');
    check(await page.$eval('nav.wtnr-nav details', d => d.open), 'jump list does not open');
    return `prev ${nav.prevT.trim()} | next ${nav.nextT.trim()}`;
  });

  await step('audio: none in this piece, and nothing ever sounded', async () => {
    const media = await page.$$eval('audio, video', es => es.length);
    const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(wav|mp3|ogg|m4a|webm|mp4)$/i.test(f)) files.push(f); } })(WEB);
    const q = await page.evaluate(() => window.__qa);
    check(media === 0 && files.length === 0, `media elements ${media}, media files ${files.join(',')}`);
    check(q.sources === 0 && q.media === 0, 'something sounded: ' + JSON.stringify(q));
    return 'no audio/video elements or files; 0 sources started';
  });

  await step('phone width: no horizontal scroll with the nav in place', async () => {
    const m = await ctx.newPage();
    await m.setViewportSize({ width: 375, height: 812 });
    await m.goto(base, { waitUntil: 'networkidle' }); await m.waitForTimeout(500);
    const over = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await m.close();
    check(over <= 1, `overflow ${over}px`);
    return '0 px overflow at 375 px';
  });

  await browser.close(); server.close();
  const report = { piece: path.basename(PIECE), ok: !failed && errors.length === 0, steps, errors };
  console.log(JSON.stringify(report, null, 1));
  process.exit(report.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
