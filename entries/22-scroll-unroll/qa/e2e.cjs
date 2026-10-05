// End-to-end journey for Scroll Unroll: node entries/22-scroll-unroll/qa/e2e.cjs [port 6660-6669]
// Serves web/ on 127.0.0.1, drives the built page in headless Chromium with real mouse and keyboard input, and
// asserts the main journey: start the unroll, pause it, unroll fully, step the damage, sweep the reading window
// across the hidden line (heavy damage must NOT count, light damage must), the reveal, the titled sections below the
// scene (The data chart, always visible: clicking each close-together job point; the Jobs and credits table loading
// its jobs), the restored "Roll it back up", every display control, the four science drawers, the share link
// (every graph is checked to render non-empty pixels: desk, CT slice and overlay, reading window, ladder, chart,
// cast portraits, reveal picture; each cast card's "Show on the desk" button marks its character on the desk),
// and the share link
// (copied, then reloaded from the hash with the state restored), "Start over", the prev/hub/next nav, a 375 px
// pass, and that nothing ever makes sound (the piece has no audio). It also checks the page's job IDs against
// out/metrics.json, PARAMS.md and cache/blur-v1. Writes qa/e2e.json and qa/e2e-*.png; exit code 1 on any failure.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const HERE = path.resolve(__dirname, '..'), WEB = path.join(HERE, 'web'), ROOT = path.resolve(HERE, '..', '..');
const SLUG = path.basename(HERE), port = +(process.argv[2] || 6660);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
// audio instrumentation, as in common/qa/qa_page.cjs
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, media: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const results = [];
const check = (cond, msg) => { results.push({ ok: !!cond, msg }); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], failed = [], external = new Set();
  async function newPage(ctx) {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    p.on('requestfailed', r => failed.push(r.url()));
    p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    p.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && u.hostname !== '127.0.0.1') external.add(u.hostname); });
    p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
    await p.addInitScript(INSTRUMENT);
    return p;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` }); } catch (e) { /* older builds */ }
  const p = await newPage(ctx);
  const ev = (f, a) => p.evaluate(f, a);
  const frames = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const text = sel => p.$eval(sel, e => e.textContent.trim());
  // how many distinct colours an element shows on screen (from a real screenshot, so WebGL and SVG count too)
  async function colours(pg, sel) {
    const loc = pg.locator(sel).first();
    await loc.scrollIntoViewIfNeeded();
    const buf = await loc.screenshot();
    return pg.evaluate(async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
      return set.size;
    }, buf.toString('base64'));
  }

  // ---- 0. data the page must agree with ------------------------------------------------------------------------
  const metrics = JSON.parse(fs.readFileSync(path.join(HERE, 'out', 'metrics.json'), 'utf8')).jobs.slice().sort((a, b) => a.off_ink - b.off_ink);
  const params = fs.readFileSync(path.join(HERE, 'PARAMS.md'), 'utf8');
  const piece = JSON.parse(fs.readFileSync(path.join(HERE, 'piece.json'), 'utf8'));
  const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
  const cache = fs.readdirSync(path.join(ROOT, 'cache', 'blur-v1')).filter(f => f.endsWith('.json')).map(f => fs.readFileSync(path.join(ROOT, 'cache', 'blur-v1', f), 'utf8')).join('\n');

  // ---- 1. start ------------------------------------------------------------------------------------------------
  await p.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction(() => typeof pix === 'object' && pix['img/base.webp'] && pix[inkSrc()], null, { timeout: 30000 });
  await frames();
  check((await p.title()) === 'Scroll Unroll', 'title is "Scroll Unroll"');
  check(await ev(() => glOK), 'WebGL path active (the CT slice can unroll)');
  check(await p.isVisible('#desk') && await p.isVisible('#gl'), 'the scene is on top: the desk and the CT slice are visible');
  const secs = await p.$$eval('section.sec > h2.ink-bar > span:first-child', es => es.map(e => e.textContent.trim()));
  check(JSON.stringify(secs) === JSON.stringify(['How to play', 'The cast', 'The data', 'Behind the scroll', 'Jobs and credits']), 'titled sections below the scene: ' + secs.join(' / '));
  check(await p.isVisible('#chart') && (await p.$$('#chart [data-pt]')).length === 10, 'The data: the jobs chart is visible without a toggle (9 jobs + clean ink)');
  check((await text('.wtnr-bar .count')) === 'Challenge 01' && !(await ev(() => /bonus/i.test(document.body.innerText))), 'brand bar reads "Challenge 01"; no "Bonus" anywhere on the page');
  check((await p.$$('#jobs-body tr')).length === 9 && (await p.$$eval('#jobs-body td.id', ts => ts.map(t => t.textContent))).join() === (await ev(() => JOBS.map(j => j.job_id).join())), 'Jobs and credits: 9 rows with the page job IDs');
  check((await text('#u-num')) === '12 % flat', 'opens 12 % unrolled');
  check((await text('#c-found')).includes('not found yet'), 'hidden line not found at start');
  check(await ev(() => document.getElementById('reveal').hidden), 'translation hidden at start');
  const pageJobs = await ev(() => JOBS.map(j => j.job_id));
  check(JSON.stringify(pageJobs) === JSON.stringify(metrics.map(m => m.job_id)), 'page jobs = out/metrics.json, in damage order');
  check(pageJobs.every(id => params.includes(id)), 'every page job ID is in PARAMS.md');
  check(pageJobs.every(id => cache.includes(id)), 'every page job ID exists in cache/blur-v1/*.json');
  check(pageJobs.length === piece.jobs, `page shows ${pageJobs.length} jobs = piece.json jobs (${piece.jobs})`);
  const proof = await text('.proof');
  check(proof.includes(`${piece.qubits} qubits`) && proof.includes(`${piece.jobs} real Atlas jobs`), `proof chips: ${piece.qubits} qubits, ${piece.jobs} jobs`);
  check((await text('#r-job')) === pageJobs[1], 'readout shows the opening job ID (job 2)');
  await p.screenshot({ path: path.join(HERE, 'qa', 'e2e-start.png') });

  // ---- 1b. every graph renders (non-empty pixels) -----------------------------------------------------------------
  for (const [sel, name, min] of [['#desk', 'the desk scene (pixel art)', 4], ['#gl', 'G1: the CT slice (WebGL)', 12], ['#ov', 'G2: the CT overlay with the moth', 3],
    ['#rd', 'G4: the reading window strip', 8], ['#ladder', 'G5: the damage ladder (9 bars)', 3], ['#chart', 'The data: the nine jobs chart', 4],
    ['#pic-moth', 'cast portrait: the archaeologist', 3], ['#pic-roll', 'cast portrait: the roll', 3], ['#pic-ash', 'cast portrait: the ash', 3]]) {
    const n = await colours(p, sel);
    check(n >= min, `${name} renders (${n} distinct colours on screen)`);
  }
  const ladderH = await p.$$eval('#ladder button', bs => bs.map(b => Math.round(b.getBoundingClientRect().height)));
  check(ladderH.length === 9 && ladderH.every((h, i) => h > 0 && (i === 0 || h >= ladderH[i - 1])) && ladderH[8] > ladderH[0],
    `G5: 9 job bars, height = ink moved, light to heavy (${ladderH.join(',')} px)`);
  check(await p.$$eval('.card button.pic img', is => is.length === 3 && is.every(i => i.complete && i.naturalWidth > 0)), 'the three cast portraits are drawn');
  await p.evaluate(() => scrollTo(0, 0)); await frames();

  // ---- 2. the unroll: start it, pause it, then unroll fully --------------------------------------------------------
  await p.click('#play');
  await sleep(1200);
  const u1 = await ev(() => st.u);
  check(u1 > 0.14, `"Unroll it" starts the unroll (u ${u1.toFixed(3)} > 0.12)`);
  check((await text('#play')) === 'Pause', 'the button now reads "Pause"');
  await p.click('#play');
  const u2 = await ev(() => st.u); await sleep(400); const u3 = await ev(() => st.u);
  check(u2 === u3, 'Pause stops the unroll');
  check((await text('#play')) === 'Resume unrolling', 'the button now reads "Resume unrolling"');
  await p.focus('#u'); await p.keyboard.press('End'); await frames();
  check((await text('#u-num')) === '100 % flat' && (await ev(() => st.u)) === 1, 'unroll slider (End key) lays the whole sheet flat');
  check((await text('#play')) === 'Roll it up', 'fully unrolled: the button offers "Roll it up"');

  // ---- 3. heavy damage: sweeping the line must not count ----------------------------------------------------------
  await p.click('#ladder button[data-d="5"]');
  await p.waitForFunction(() => pix[inkSrc()], null, { timeout: 20000 }); await frames();
  check((await text('#r-job')) === pageJobs[5], 'ladder bar 6 loads job 6 (readout shows its ID)');
  check((await text('#r-line')).startsWith('r = 0.03'), 'job 6 readout: line kept r = 0.03');
  async function sweep() {   // put the window at the start of the line, then step it along by whole windows (Shift+Right)
    await p.fill('#w', String(Math.floor(await ev(() => SCROLL.text_s[0])) - 40)); await frames();
    await p.focus('#rd');
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Shift+ArrowRight'); await frames(); }
  }
  await sweep();
  await sleep(250);
  check(!(await ev(() => st.found)), 'a sweep under heavy damage (r = 0.03) does NOT find the line');
  check(await ev(() => M.sprite === 'archPuzzled' && M.bubble === 'bubbleScribble'), 'the moth scowls at the scrambled ink');

  // ---- 4. light damage: the same sweep finds it ------------------------------------------------------------------
  await p.click('#ladder button[data-d="0"]');
  await p.waitForFunction(() => pix[inkSrc()], null, { timeout: 20000 }); await frames();
  check((await text('#r-job')) === pageJobs[0], 'ladder bar 1 loads job 1');
  await sweep(); await sleep(150);
  check(await ev(() => st.found), 'a sweep under light damage (r = 0.98) finds the hidden line');
  check(!(await ev(() => document.getElementById('reveal').hidden)), 'the translation is revealed');
  check((await text('#greek')) === (await ev(() => SCROLL.text)), 'the reveal shows the Greek line');
  check((await text('#c-found')).includes('found'), 'the CT chip says "found"');
  check((await text('#toast')).includes('You read the hidden line'), 'a toast celebrates the find');
  await p.$eval('#reveal', e => e.scrollIntoView({ block: 'center' }));
  check(await p.$eval('#rv-pic', i => i.complete && i.naturalWidth > 0) && (await colours(p, '#rv-pic')) >= 3, 'the reveal shows the cheering moth');
  await p.screenshot({ path: path.join(HERE, 'qa', 'e2e-found.png') });
  await p.evaluate(() => scrollTo(0, 0));

  // ---- 5. the desk and the CT slice take input --------------------------------------------------------------------
  const deskBox = await p.locator('#desk').boundingBox();
  const w0a = await ev(() => st.w0);
  await p.mouse.click(deskBox.x + deskBox.width * 0.3, deskBox.y + deskBox.height * 0.72);
  await frames();
  check(Math.abs((await ev(() => st.w0)) - w0a) > 100, 'tapping the desk sends the moth (reading window) there');
  await p.click('#play'); await sleep(500); await p.click('#play');
  check((await ev(() => st.u)) < 1, '"Roll it up" rolls the sheet back');
  const foundBefore = await ev(() => st.found);
  await p.click('#rollup'); await frames();
  check((await text('#u-num')) === '0 % flat' && (await ev(() => st.zoom)) === 1 && (await ev(() => st.found)) === foundBefore, '"Roll it back up" rolls the whole sheet up (0 % flat, zoom 1x) and keeps what was read');
  await p.focus('#u'); await p.keyboard.press('End'); await frames();

  // ---- 5b. The cast: each card's "Show on the desk" marks its character on the desk -------------------------------
  for (const [who, word] of [['moth', 'archaeologist'], ['roll', 'roll'], ['ash', 'ash']]) {
    await p.$eval('#cast-sec', e => e.scrollIntoView({ block: 'center' })); await frames();
    await p.click(`.card button[data-show="${who}"]`); await sleep(900);
    const top = await p.$eval('#stage', e => e.getBoundingClientRect().top);
    const drawn = await ev(() => { const t = HL.until - 0.1; drawDesk(t); const a = bx.getImageData(0, 0, DB.width, DB.height).data;
      const h = HL; HL = null; drawDesk(t); const b = bx.getImageData(0, 0, DB.width, DB.height).data; HL = h; let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; });
    check(Math.abs(top) < 80 && (await ev(() => HL && HL.who)) === who && (await text('#toast')).toLowerCase().includes(word) && drawn > 0,
      `cast "Show on the desk" (${who}): scrolls up to the desk, marks it there (${drawn} px changed), toast names it`);
  }
  await p.evaluate(() => scrollTo(0, 0));

  // ---- 6. The data (always visible) and every chart point is clickable; the jobs table loads jobs ---------------
  await p.$eval('#data-sec', e => e.scrollIntoView({ block: 'start' })); await frames();
  check(await p.isVisible('#chart') && await p.isVisible('#desk'), 'The data section shows the chart while the desk stays in place (no toggle)');
  check((await p.$$('#chart [data-pt]')).length === 10, 'chart has the 9 jobs + clean ink as buttons');
  for (const i of [5, 6, 7, 2]) {          // 6 and 7 sit about 12 px apart: each must load itself
    const b = await p.locator(`#chart [data-pt="${i}"] .hit`).boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await frames();
    check((await text('#r-job')) === pageJobs[i], `clicking chart point ${i + 1} loads job ${i + 1}`);
  }
  const cb = await p.locator('#chart [data-pt="clean"] .hit').boundingBox();
  await p.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await frames();
  check((await text('#r-job')).startsWith('none'), 'clicking the clean-ink point loads the clean ink');
  await p.focus('#chart [data-pt="3"]'); await p.keyboard.press('Enter'); await frames();
  check((await text('#r-job')) === pageJobs[3], 'chart points work from the keyboard (Enter)');
  await p.screenshot({ path: path.join(HERE, 'qa', 'e2e-data.png') });
  check((await ev(() => st.view)) === 'data', 'using the chart marks the data view (for the share link)');
  await p.click('#jobs-body button[data-d="7"]'); await frames();
  check((await text('#r-job')) === pageJobs[7] && (await p.getAttribute('#jobs-body tr:nth-child(8)', 'aria-current')) === 'true', 'Jobs and credits: a job number loads that job and marks its row');
  await p.click('#jobs-body button[data-d="3"]'); await frames();
  check((await text('#r-job')) === pageJobs[3], 'Jobs and credits: job 4 loads job 4');
  await p.evaluate(() => scrollTo(0, 0));

  // ---- 7. display controls --------------------------------------------------------------------------------------
  await p.click('[data-ink="clean"]'); check((await text('#r-job')).startsWith('none'), '"Clean ink" shows the ink as written (no job)');
  await p.click('[data-ink="blur"]'); check((await text('#r-job')) === pageJobs[3], '"Blurred ink" returns to the current job');
  await p.click('[data-layer="ink"]'); await frames(); check((await text('#c-view')).startsWith('Ink layer'), '"Ink layer only" shows the raw engine output');
  await p.click('[data-layer="scan"]'); await frames(); check((await text('#c-view')).startsWith('Scan'), '"Scan" returns to the scan');
  await p.click('#tint'); await frames(); check((await p.getAttribute('#tint', 'aria-pressed')) === 'true', '"Tint the ink" toggles on');
  await p.click('#close'); await frames(); check((await ev(() => winW())) === 300, '"Closer look" halves the reading window (more magnified)');
  await p.focus('#k'); await p.keyboard.press('End'); await frames(); check((await text('#k-val')) === '100', 'contrast slider drives the contrast');
  await p.focus('#z'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await frames();
  check((await text('#z-val')) === '1.2\u00d7', 'zoom slider drives the zoom');
  await p.focus('#d'); await p.keyboard.press('ArrowRight'); await frames();
  check((await text('#r-job')) === pageJobs[4], 'damage slider steps to the next job');

  // ---- 8. the science drawers ---------------------------------------------------------------------------------
  const sums = await p.$$('section.more details.drawer > summary');
  check(sums.length === 4, '4 science drawers');
  for (const s of sums) await s.click();
  const open = await p.$$eval('section.more details.drawer', ds => ds.map(d => d.open && d.querySelector('.body').getBoundingClientRect().height > 20));
  check(open.every(Boolean), 'every drawer opens and shows its text');

  // ---- 9. share link: copy, then reload from the hash -------------------------------------------------------------
  const want = await ev(() => ({ u: st.u, w0: Math.round(st.w0), d: st.d, clean: st.clean, inkOnly: st.inkOnly, tint: st.tint, k: st.k, zoom: st.zoom, close: st.close }));
  await p.click('#chart [data-pt="4"] .hit'); await frames();
  const want2 = await ev(() => st.d); want.d = want2;
  await p.click('#share'); await sleep(300);
  const hash = await ev(() => location.hash);
  check(/^#u\d+\.w\d+\.d\d\.c[01]\.l[01]\.t[01]\.k\d+\.z\d+\.x[01]\.v[01]$/.test(hash), `share writes the view into the hash (${hash})`);
  const tmsg = await text('#toast');
  let clip = null; try { clip = await ev(() => navigator.clipboard.readText()); } catch (e) { /* no clipboard */ }
  check(tmsg === 'Link copied' ? clip === base + hash : tmsg.startsWith('Copy failed'), `share copies the link (toast: "${tmsg}")`);
  const p2 = await newPage(ctx);
  await p2.goto(base + hash, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => typeof pix === 'object' && pix[inkSrc()], null, { timeout: 30000 });
  const got = await p2.evaluate(() => ({ u: st.u, w0: Math.round(st.w0), d: st.d, clean: st.clean, inkOnly: st.inkOnly, tint: st.tint, k: st.k, zoom: st.zoom, close: st.close, view: st.view }));
  check(Math.abs(got.u - want.u) < 0.0011 && Math.abs(got.w0 - want.w0) <= 1 && got.d === want.d && got.clean === want.clean && got.inkOnly === want.inkOnly
    && got.tint === want.tint && got.k === want.k && Math.abs(got.zoom - want.zoom) < 1e-9 && got.close === want.close && got.view === 'data',
    'reloading the shared link restores the exact view: ' + JSON.stringify(got));
  check((await p2.$eval('#r-job', e => e.textContent)) === pageJobs[want.d] && (await p2.getAttribute('#tint', 'aria-pressed')) === 'true'
    && (await p2.evaluate(() => Math.abs(document.getElementById('data-sec').getBoundingClientRect().top) < 40)), 'restored view shows the same job and tint, and opens at The data');
  await p2.close();

  // ---- 10. start over ------------------------------------------------------------------------------------------
  await p.click('#reset'); await frames();
  check((await ev(() => location.hash)) === '' && (await text('#u-num')) === '12 % flat' && (await ev(() => !st.found && document.getElementById('reveal').hidden)),
    '"Start over" returns to the opening view and forgets the find');

  // ---- 11. the set: brand bar and prev / hub / next ----------------------------------------------------------------
  const slugs = Object.keys(urls).sort(), i = slugs.indexOf(SLUG);
  const prevSlug = fs.readdirSync(path.join(ROOT, 'entries')).filter(s => fs.existsSync(path.join(ROOT, 'entries', s, 'piece.json'))).sort();
  const k = prevSlug.indexOf(SLUG), prev = prevSlug[(k - 1 + prevSlug.length) % prevSlug.length], next = prevSlug[(k + 1) % prevSlug.length];
  check(i >= 0, 'this piece is in site/urls.json');
  check((await p.getAttribute('.wtnr-bar a', 'href')) === HUB, 'brand bar links to the hub');
  check((await p.getAttribute('.wtnr-nav a[rel="prev"]', 'href')) === (urls[prev] || HUB), `nav prev -> ${prev}`);
  check((await p.getAttribute('.wtnr-nav a[rel="next"]', 'href')) === (urls[next] || HUB), `nav next -> ${next}`);
  check((await p.getAttribute('.wtnr-nav a.wn-hub', 'href')) === HUB, 'nav hub button -> hub');
  await p.click('.wtnr-nav summary');
  const jump = await p.$$eval('.wtnr-nav ol a', as => as.map(a => [a.href, a.getAttribute('aria-current')]));
  check(jump.length === prevSlug.length && jump.filter(a => a[1] === 'page').length === 1, `jump list opens with all ${jump.length} pieces, this one marked current`);
  check(await p.isVisible('.wtnr-foot'), 'footer disclaimer present');

  // ---- 12. sound: none, ever ----------------------------------------------------------------------------------
  const q = await ev(() => window.__qa);
  const hasAudio = fs.readdirSync(WEB, { recursive: true }).some(f => /\.(wav|mp3|ogg|m4a|mp4|webm)$/i.test(String(f)));
  check(!hasAudio && (await p.$$('audio,video')).length === 0, 'the piece ships no audio or video (nothing to play or stop)');
  check(q.sources === 0 && q.media === 0, 'no sound started at any point (no autoplay)');

  // ---- 13. phone width ------------------------------------------------------------------------------------------
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const m = await newPage(mctx);
  await m.goto(base, { waitUntil: 'networkidle' });
  await m.waitForFunction(() => typeof pix === 'object' && pix[inkSrc()], null, { timeout: 30000 });
  check((await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '375 px: no horizontal scroll');
  await m.$eval('#data-sec', e => e.scrollIntoView({ block: 'start' })); await m.waitForTimeout(100);
  const mb = await m.locator('#chart [data-pt="0"] .hit').boundingBox();
  await m.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2); await m.waitForTimeout(150);
  check((await m.$eval('#r-job', e => e.textContent)) === pageJobs[0], '375 px: tapping a chart point loads its job');
  check((await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, '375 px: still no horizontal scroll with The data and the jobs table');
  await m.$eval('.wtnr-nav', e => e.scrollIntoView());
  await m.screenshot({ path: path.join(HERE, 'qa', 'e2e-mobile-nav.png') });
  await mctx.close();

  const ext = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
  check(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  check(failed.length === 0, 'no failed requests' + (failed.length ? ': ' + failed.join(' | ') : ''));
  check(ext.length === 0, 'no requests to other hosts' + (ext.length ? ': ' + ext.join(', ') : ''));

  const ok = results.every(r => r.ok);
  fs.writeFileSync(path.join(HERE, 'qa', 'e2e.json'), JSON.stringify({ piece: SLUG, ok, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).map(r => r.msg), steps: results.map(r => (r.ok ? 'PASS ' : 'FAIL ') + r.msg) }, null, 1));
  console.log(`\n${ok ? 'OK' : 'FAILED'}: ${results.filter(r => r.ok).length}/${results.length} checks`);
  await browser.close(); srv.close();
  process.exit(ok ? 0 : 1);
})().catch(async e => { console.error(e); try { srv.close(); } catch (_) {} process.exit(2); });
