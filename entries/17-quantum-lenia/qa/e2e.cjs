// End-to-end journey for 17-quantum-lenia: node entries/17-quantum-lenia/qa/e2e.cjs [port 6510-6519]
// Serves web/ locally, opens the built page in headless Chromium and walks the main user journey with real
// assertions: paint the dish, play / pause / step / reset the live Lenia world, swap kernel lenses until the
// measured fates show up live (an Orbium keeps gliding under the original kernel, life floods under blur 1.0),
// paint with keyboard, soup and eraser, check the always-visible data section (heatmap, profile, fates table that
// loads a kernel), open every drawer, check the visible honesty and jobs sections, seed from a snapshot plate,
// play and stop the film (the piece's only media; it is silent and the page has no audio), copy a share link
// and reload with its #token to check the setup is restored, and check the prev / hub / next navigation.
// Every number the page shows for jobs and qubits is checked against piece.json and out/*.csv.
// Writes qa/e2e.json and exits 1 on the first failed assertion.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = path.basename(PIECE);
const PORT = +(process.argv[2] || 6510);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const PJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const csv = f => { const [h, ...rows] = fs.readFileSync(path.join(PIECE, 'out', f), 'utf8').trim().split(/\r?\n/);
  const k = h.split(','); return rows.map(r => Object.fromEntries(r.split(',').map((v, i) => [k[i], v]))); };
const KJ = Object.fromEntries(csv('kernel_jobs.csv').filter(r => r.status === 'completed').map(r => [String(+r.strength), r]));
const SJ = Object.fromEntries(csv('snapshot_jobs.csv').filter(r => r.status === 'completed').map(r => [String(+r.strength), r]));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {   // byte ranges, so the <video> can stream and seek like it does on the real host
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  fs.createReadStream(f).pipe(res);
});

// same instrumentation as common/qa/qa_page.cjs: Web Audio sources started, media 'playing' events
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, media: 0, mediaPause: 0, mediaErr: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
  document.addEventListener('pause', () => window.__qa.mediaPause++, true);
  document.addEventListener('error', e => { if (e.target instanceof HTMLMediaElement) window.__qa.mediaErr++; }, true);
};

const steps = [];
function ok(cond, msg) { if (!cond) throw new Error('FAILED: ' + msg); steps.push(msg); console.log('ok   ' + msg); }

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await chromium.launch();
  const errors = [];
  let result = { piece: SLUG, ok: false, steps };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${PORT}` });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    p.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
    await p.addInitScript(INSTRUMENT);
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const txt = id => p.locator('#' + id).textContent();
    const num = async id => parseFloat((await txt(id)).replace(/,/g, ''));
    const pressed = async loc => (await loc.getAttribute('aria-pressed')) === 'true';
    const cv = p.locator('#cv');
    const drag = async (fx0, fy0, fx1, fy1) => {
      const b = await cv.boundingBox();
      await p.mouse.move(b.x + b.width * fx0, b.y + b.height * fy0); await p.mouse.down();
      await p.mouse.move(b.x + b.width * fx1, b.y + b.height * fy1, { steps: 8 }); await p.mouse.up();
      await p.waitForTimeout(150);
    };
    const waitT = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await cond()) return true; await p.waitForTimeout(150); } throw new Error('FAILED (timeout): ' + what); };
    const lens = name => p.locator('#g-set .lens', { hasText: name });
    const shell = name => p.locator('#g-shell button', { hasText: name });

    // 1. load: scene first, paused, nothing sounding, honest numbers
    ok(await p.title() === 'Quantum Lenia', 'page title is "Quantum Lenia"');
    ok(await txt('l-r') === 'paused' && await num('l-t') === 0 && await p.locator('#play').textContent() === 'Play', 'loads paused at t 0 (nothing moves until Play)');
    ok(await num('l-c') === 5, 'default dish holds the 5 Orbium of the film scene (counter reads 5)');
    ok(await p.locator('#v-scene').isVisible() && await p.locator('#data #kprev').isVisible() && await p.locator('#data #kprof').isVisible() && await p.locator('#data #fates').isVisible(), 'fate strip in the lab, and the graphs sit in the visible "The data" section');
    const secs = await p.locator('.ink-bar > span:first-child').allInnerTexts();
    const want0 = ['How to play', 'Kernel lab', 'The data', 'What the noise remembers', 'The film', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits'];
    ok(want0.every(t => secs.map(x => x.toLowerCase()).includes(t.toLowerCase())), 'titled sections present: ' + want0.join(', '));
    ok(!/bonus/i.test(await p.locator('body').innerText()) && (await p.locator('nav.wtnr-bar .count').textContent()).trim() === 'Challenge 04', 'no "Bonus" wording: the brand bar reads "Challenge 04"');
    let q = await p.evaluate(() => ({ ...window.__qa }));
    ok(q.sources === 0 && q.media === 0, 'no sound or video starts on load (no autoplay)');
    const proof = (await p.locator('.proof').textContent()).replace(/\s+/g, ' ');
    ok(proof.includes(PJ.qubits + ' qubits per snapshot blur') && proof.includes('18 qubits per kernel blur') && proof.includes(PJ.jobs + ' completed Atlas jobs') && /no QPU/.test(proof) && PJ.hardware === null,
      `proof chips match piece.json (qubits ${PJ.qubits}, jobs ${PJ.jobs}, no hardware)`);

    // 1b. every graph restored from the earlier page renders (non-empty canvases, filled tables, a loadable poster)
    const inked = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(c => {   // pixels darker than the paper / white ground
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 1] < 200)) n++;
      return n; }), sel);
    const gW = await inked('#cv');
    ok(gW[0] > 1000, `graph G1, the live world canvas, is drawn (${gW[0]} inked pixels: the 5 Orbium of the scene)`);
    const gK = await inked('#kprev'), gP = await inked('#kprof');
    ok(gK[0] > 20 && gP[0] > 500, `graphs G3 + G4 in The data: kernel heatmap (${gK[0]} inked px) and radial profile (${gP[0]} inked px) are drawn`);
    const gS = await inked('#tiles .tile canvas');
    ok(gS.length === 3 && gS.every(n => n > 300), `graph G5: all 3 snapshot colony canvases are drawn (${gS.join(', ')} inked px)`);
    const gL = await inked('#g-set .lens canvas'), gStrip = await inked('#strip-c'), gM = await inked('#mascot-c');
    ok(gL.length === 4 && gL.every(n => n > 50) && gStrip[0] > 50 && gM[0] > 50, `the 4 lens magnifiers, the fate strip and Orbi are drawn (${gL.join(', ')} / ${gStrip[0]} / ${gM[0]} inked px)`);
    ok(await p.locator('#fates .fcell').count() === 16 && await p.locator('#jobs tr').count() === PJ.jobs + 1, 'table T1 (jobs, 5 rows) and the measured-fates table (16 cells) are filled');
    const poster = await p.evaluate(async () => { const v = document.querySelector('.film video'), im = new Image(); im.src = v.poster; await im.decode(); return [im.naturalWidth, im.naturalHeight]; });
    ok(poster[0] === 1280 && poster[1] === 720, `graph G2, the film: its poster frame loads (${poster.join(' x ')})`);

    // 2. paint: clear, then aim and drop one Orbium with the pipette
    await p.click('#clear');
    ok(await num('l-m') === 0 && await num('l-c') === 0 && await num('l-t') === 0, 'Clear empties the dish (mass 0, 0 blobs, t 0)');
    ok(await pressed(p.locator('[data-tool="creature"]')), 'Orbium pipette is the selected tool');
    await drag(0.5, 0.5, 0.65, 0.5);
    const m0 = await num('l-m');
    ok(m0 > 55 && m0 < 95 && await num('l-c') === 1, `drag-and-release drops one Orbium (mass ${m0}, counter 1)`);

    // 3. play / pause / step / reset under the original ring kernel: the measured fate is "glides"
    await p.click('#play');
    ok(await p.locator('#play').textContent() === 'Pause' && await pressed(p.locator('#play')), 'Play starts the world (button now reads Pause)');
    await waitT(async () => (await num('l-t')) >= 150, 60000, 'world reaches t 150');
    await p.click('#play');
    const tP = await num('l-t'); await p.waitForTimeout(600);
    ok(await num('l-t') === tP && await txt('l-r') === 'paused', `Pause stops the world (t holds at ${tP})`);
    const mG = await num('l-m');
    ok(await num('l-c') === 1 && mG > 55 && mG < 95, `original ring kernel: the Orbium survives as one creature after ${tP} steps (mass ${mG}), as measured ("glides")`);
    await p.click('#stepb');
    ok(await num('l-t') === tP + 1, 'Step advances exactly one step');
    await p.locator('#stepb').blur(); await p.keyboard.press('.');
    ok(await num('l-t') === tP + 2, 'keyboard "." steps too');
    await p.click('#reset');
    ok(await num('l-t') === 0 && await num('l-m') === m0, 'Reset returns to step 0 with the dropped Orbium restored');
    ok((await txt('toast')).includes('step 0'), 'Reset confirms with a toast');

    // 4. swap the lens: blur 1.0 floods the dish live, as measured
    await lens('Blur 1.0').click();
    ok(await pressed(lens('Blur 1.0')) && !(await pressed(lens('Original'))), 'Blur 1.0 lens is selected');
    ok(await txt('k-name') === 'Blur 1.0 \u00b7 Ring', 'lens title shows "Blur 1.0 \u00b7 Ring"');
    ok(await txt('r-job') === KJ['1'].job_id, `readout shows the strength-1.0 kernel job ${KJ['1'].job_id}`);
    ok((await txt('r-q')).startsWith(KJ['1'].qubits + ' qubits'), `readout register is ${KJ['1'].qubits} qubits (kernel_jobs.csv)`);
    ok(/floods/.test(await txt('fate')), 'fate line states the measured flood');
    await p.locator('#spd').fill('8');
    ok(await txt('spd-v') === '8', 'speed slider sets 8 steps/frame');
    await p.click('#play');
    await waitT(async () => (await num('l-m')) > 4000, 90000, 'blur 1.0 kernel floods the dish (mass over 4,000)');
    await p.click('#play');
    ok(true, `blur 1.0 kernel: life floods the dish live (mass ${await num('l-m')} at t ${await num('l-t')})`);
    await p.click('#reset');
    await lens('Blur 0.5').click();
    ok(await txt('r-job') === KJ['0.5'].job_id && /0\.29 cells\/step/.test(await txt('fate')), `Blur 0.5 lens: job ${KJ['0.5'].job_id}, measured glide 0.29 cells/step`);
    await shell('Gaussian').click();
    ok(await pressed(shell('Gaussian')) && /breaks up/.test(await txt('fate')) && await txt('k-name') === 'Blur 0.5 \u00b7 Gaussian', 'Gaussian shell + blur 0.5: fate line says the Orbium breaks up (measured)');
    await lens('Original').click();
    ok((await txt('r-job')).startsWith('\u2013') && /not blurred/.test(await txt('r-q')), 'Original lens: no job, register "not blurred"');
    // options the dead-control scan saw as "no change" were already selected: they work once another is chosen
    await shell('Ring').click();
    ok(await pressed(shell('Ring')) && await txt('k-name') === 'Original \u00b7 Ring' && /glides at 0\.61/.test(await txt('fate')), 'Ring shell (the default) re-selects after another shell: "Original \u00b7 Ring", glides 0.61');
    await lens('Blur 0.5').locator('canvas').click();
    ok(await pressed(lens('Blur 0.5')) && await txt('r-job') === KJ['0.5'].job_id, 'clicking the magnifier picture inside a lens selects that lens');
    await shell('Gaussian').click();

    // 5. keyboard painting, soup brush, eraser, brush size
    await p.click('#clear');
    await cv.focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
    ok(await num('l-c') === 1, 'keyboard: arrows move the cursor, Enter drops an Orbium');
    await p.click('[data-tool="soup"]');
    ok(await pressed(p.locator('[data-tool="soup"]')) && /soup/i.test(await txt('hint')), 'Soup tool selected (hint updates)');
    await p.locator('#br').fill('30');
    ok(await txt('br-v') === '30', 'brush slider sets 30 cells');
    const mS0 = await num('l-m'); await drag(0.2, 0.2, 0.3, 0.3); const mS1 = await num('l-m');
    ok(mS1 > mS0 + 100, `soup brush paints random values (mass ${mS0} -> ${mS1})`);
    await p.click('[data-tool="erase"]');
    await drag(0.2, 0.2, 0.3, 0.3); const mE = await num('l-m');
    ok(mE < mS1 - 100, `eraser clears cells (mass ${mS1} -> ${mE})`);
    await p.click('[data-tool="creature"]');

    // 6. The data section: heatmap, radial profile and the fates table follow the lab, and the table loads kernels
    await p.click('#to-data'); await p.waitForTimeout(700);
    ok(await p.evaluate(() => { const r = document.getElementById('data').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), '"See the graphs" scrolls to The data section');
    ok(await p.locator('#fates tr').count() === 5 && (await p.locator('#fates td.cur').textContent()) === 'breaks up', 'fates table has 4 shells and highlights the current cell ("breaks up")');
    ok(await txt('d-name') === 'Blur 0.5 · Gaussian', 'the data section names the kernel the lab holds');
    const kInk = await p.evaluate(() => { const d = document.getElementById('kprev').getContext('2d').getImageData(0, 0, 32, 32).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; });
    ok(kInk > 20, `kernel heatmap is drawn (${kInk} inked pixels)`);
    const prof = () => p.evaluate(() => document.getElementById('kprof').toDataURL());
    const pr0 = await prof();
    await p.locator('#fates tr', { hasText: 'Ring' }).locator('td').nth(4).locator('button').click(); await p.waitForTimeout(200);
    ok(await txt('k-name') === 'Blur 1.0 · Ring' && await pressed(lens('Blur 1.0')) && await pressed(shell('Ring')) && /floods/.test(await txt('fate')) && (await p.locator('#fates td.cur').textContent()) === 'floods', 'pressing a fates-table cell loads that kernel into the lab and the dish (Blur 1.0 · Ring, floods)');
    ok(await prof() !== pr0, 'the radial profile redraws for the new kernel');
    await lens('Blur 0.5').click(); await shell('Gaussian').click();
    await p.click('#strip');
    ok(/breaks up/.test(await txt('strip-tag')), 'tapping the strip replays the measured fate');

    // 7. growth drawer
    await p.click('#growth summary');
    ok(await p.locator('#growth').evaluate(d => d.open), 'Growth settings drawer opens');
    await p.locator('#mu').fill('0.2');
    ok(await txt('mu-v') === '0.200', 'mu slider sets 0.200');
    await p.click('#orbium');
    ok(await txt('mu-v') === '0.150' && await txt('sg-v') === '0.0150', '"Back to Orbium" restores mu 0.150, sigma 0.0150');

    // 8. science drawers + job table vs out/*.csv
    const drawers = p.locator('section.more details.drawer');
    const nd = await drawers.count();
    for (let i = 0; i < nd; i++) { const d = drawers.nth(i); await d.locator('summary').click(); ok(await d.evaluate(e => e.open) && await d.locator('.body').isVisible(), `science drawer "${await d.locator('summary').textContent()}" opens`); }
    ok(nd === 3, '3 drawers (Why Lenia?, What the quantum engine did, About the characters)');
    ok(await p.locator('#claims .honesty').count() === 2 && await p.locator('#claims .honesty').first().isVisible(), 'What this does not claim: both honesty notes are visible, not hidden in a drawer');
    ok(await p.locator('#jobs-sec #jobs').isVisible() && await p.locator('#jobs-sec .credits li').count() === 4, 'Jobs and credits: the jobs table and the credits are visible');
    const jobCells = await p.locator('#jobs td').allInnerTexts();
    const want = [...Object.values(KJ), ...Object.values(SJ)].map(r => r.job_id);
    ok(want.length === PJ.jobs && want.every(j => jobCells.includes(j)), `the jobs table lists all ${PJ.jobs} completed jobs from out/kernel_jobs.csv + out/snapshot_jobs.csv`);
    const cdir = path.join(ROOT, 'cache', 'blur-core-v1');
    const cached = new Set(fs.readdirSync(cdir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(cdir, f), 'utf8')).job_id));
    const shown = [...new Set((await p.content()).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g))];
    ok(shown.length === PJ.jobs && shown.every(j => cached.has(j)), `every job ID on the page (${shown.length}) is a cached blur-core-v1 job in cache/blur-core-v1/`);

    // 9. seed from a snapshot plate
    const plateC = p.locator('#tiles .tile', { hasText: 'strength 0.5' });
    ok((await plateC.textContent()).includes(SJ['0.5'].job_id) && (await plateC.textContent()).includes(SJ['0.5'].qubits + ' qubits'), `Plate C shows snapshot job ${SJ['0.5'].job_id}, ${SJ['0.5'].qubits} qubits`);
    await plateC.click(); await p.waitForTimeout(300);
    const mPlate = await num('l-m');
    ok(await pressed(plateC) && await num('l-t') === 0 && await txt('l-r') === 'paused' && mPlate > 50, `Plate C loads its colony into the dish, paused (mass ${mPlate})`);
    ok((await txt('toast')).includes('Loaded into the live world'), 'plate load confirms with a toast');
    const plateA = p.locator('#tiles .tile', { hasText: 'Un-blurred colony' });
    await plateA.locator('canvas').click(); await p.waitForTimeout(300);
    ok(await pressed(plateA) && !(await pressed(plateC)) && await num('l-m') !== mPlate, 'clicking the plate picture loads that plate (Plate A replaces Plate C)');
    await plateC.click(); await p.waitForTimeout(300);
    ok(await pressed(plateC) && await num('l-m') === mPlate, 'Plate C reloads');

    // 10. the film: play and stop (the piece's only media; silent, as captioned)
    const vid = p.locator('.film video');
    await vid.scrollIntoViewIfNeeded();
    const q0 = await p.evaluate(() => ({ ...window.__qa }));
    const vb = await vid.boundingBox(), playBtn = [vb.x + 24, vb.y + vb.height - 48];   // the native controls' play / pause button
    await p.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); await p.waitForTimeout(300);
    await p.mouse.click(...playBtn);
    await waitT(async () => (await p.evaluate(() => window.__qa.media)) > q0.media, 15000, 'the film fires "playing"');
    await p.waitForTimeout(1500);
    const v1 = await vid.evaluate(v => ({ paused: v.paused, t: v.currentTime, err: v.error && v.error.code }));
    ok(!v1.paused && v1.t > 0.5 && !v1.err, `the film's play button plays it on the page (t ${v1.t.toFixed(2)} s, "playing" event recorded)`);
    await p.mouse.click(...playBtn); await p.waitForTimeout(300);
    const v2 = await vid.evaluate(v => ({ paused: v.paused, t: v.currentTime })); await p.waitForTimeout(600);
    const v3 = await vid.evaluate(v => v.currentTime);
    ok(v2.paused && v3 === v2.t, `its pause button stops it (held at ${v2.t.toFixed(2)} s)`);
    await vid.focus(); await p.keyboard.press('Space'); await p.waitForTimeout(800);
    const v4 = await vid.evaluate(v => ({ paused: v.paused, t: v.currentTime }));
    await p.keyboard.press('Space'); await p.waitForTimeout(200);
    ok(!v4.paused && v4.t > v2.t && await vid.evaluate(v => v.paused) && await txt('l-r') === 'paused', 'keyboard: Space on the focused film plays and pauses it (and leaves the dish alone)');
    q = await p.evaluate(() => ({ ...window.__qa }));
    ok(q.sources === 0 && q.ctx === 0 && q.mediaErr === 0, 'the page has no Web Audio (the film is silent, as the page says) and no media errors');

    // 11. share link -> reload with the #token restores the setup
    await p.locator('#mu').fill('0.16');
    await p.click('#share'); await p.waitForTimeout(300);
    const hash = await p.evaluate(() => location.hash);
    ok(hash === '#bell.q50.m160.g150.nq50', `share writes the setup to the URL: ${hash}`);
    ok(/^#[A-Za-z0-9._~-]+$/.test(hash), 'token uses only letters, digits, . _ ~ -');
    const clip = await p.evaluate(() => navigator.clipboard.readText());
    ok(clip === p.url() && (await txt('toast')).startsWith('Link copied'), 'the link is on the clipboard and the toast says so');
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    ok(await txt('k-name') === 'Blur 0.5 \u00b7 Gaussian' && await pressed(lens('Blur 0.5')) && await pressed(shell('Gaussian')), 'reload: lens Blur 0.5 and the Gaussian shell restored');
    ok(await txt('mu-v') === '0.160' && await txt('sg-v') === '0.0150', 'reload: growth mu 0.160, sigma 0.0150 restored');
    ok(await pressed(p.locator('#tiles .tile', { hasText: 'strength 0.5' })) && await num('l-m') === mPlate && await num('l-t') === 0 && await txt('l-r') === 'paused', 'reload: Plate C colony re-seeded, paused at t 0');
    ok(await txt('r-job') === KJ['0.5'].job_id, 'reload: readout shows the restored kernel job');

    // 12. navigation that connects the set
    ok(await p.locator('nav.wtnr-bar a').getAttribute('href') === HUB, 'brand bar links to the hub');
    const names = Object.keys(URLS).sort(), i = names.indexOf(SLUG);
    const prev = names[(i - 1 + names.length) % names.length], next = names[(i + 1) % names.length];
    ok(await p.locator('nav.wtnr-nav a[rel="prev"]').getAttribute('href') === URLS[prev], `prev link -> ${prev}`);
    ok(await p.locator('nav.wtnr-nav a[rel="next"]').getAttribute('href') === URLS[next], `next link -> ${next}`);
    ok(await p.locator('nav.wtnr-nav a.wn-hub').getAttribute('href') === HUB && /All 22 pieces/.test(await p.locator('nav.wtnr-nav a.wn-hub').textContent()), 'hub button "All 22 pieces" -> hub');
    await p.locator('nav.wtnr-nav summary').click();
    const all = await p.locator('nav.wtnr-nav ol a').evaluateAll(as => as.map(a => [a.getAttribute('href'), a.getAttribute('aria-current')]));
    ok(all.length === 22 && all.every(([h]) => h === HUB || Object.values(URLS).includes(h)) && all.filter(a => a[1] === 'page').length === 1 && all.find(a => a[1] === 'page')[0] === URLS[SLUG], '"Jump to any piece" lists all 22, marking this one as current');
    await p.locator('nav.wtnr-nav a[rel="prev"]').focus(); await p.keyboard.press('Space'); await p.waitForTimeout(300);
    ok(await txt('l-r') === 'paused' && await num('l-t') === 0, 'Space on a focused nav link does not toggle the dish');

    // 13. Orbi the mascot
    await p.click('#mascot'); await p.waitForTimeout(200);
    ok(/measured|Orbium/.test(await txt('toast')), 'tapping Orbi shows a measured fact');

    ok(errors.length === 0, 'no console or page errors during the journey' + (errors.length ? ': ' + errors[0] : ''));
    await ctx.close();

    // 14. phone width
    const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await mctx.newPage(); await mp.goto(base, { waitUntil: 'networkidle' });
    const ov = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(ov <= 1 && await mp.locator('nav.wtnr-nav a[rel="next"]').isVisible(), `375 px: no horizontal scroll (${ov} px), nav visible`);
    await mctx.close();
    result.ok = true;
  } catch (e) {
    result.error = String(e.message || e).slice(0, 400);
    console.log(result.error);
  }
  result.errors = errors;
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(result, null, 1));
  console.log(result.ok ? `\nE2E OK: ${steps.length} assertions` : `\nE2E FAILED after ${steps.length} assertions`);
  await browser.close(); server.close();
  process.exit(result.ok ? 0 : 1);
})();
