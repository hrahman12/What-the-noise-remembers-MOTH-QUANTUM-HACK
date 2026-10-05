// End-to-end journey for 16-busy-beaver-score: node entries/16-busy-beaver-score/qa/e2e.cjs [port 6480-6489]
// Serves web/ locally, opens the page in headless Chromium and walks the main journey with real assertions:
// warm-up check, play/pause the live synth (sound instrumented), scrub and phrase/halt controls, every score option,
// the Scene/Data toggle and dragging the Data view, a WAV render play/pause, the drawers and job table, the restored
// sections below the scene (How to play, The data with both graphs visible and wired, honesty, Jobs and credits),
// the share link (copied, then reloaded from the hash), and the prev/hub/next nav. Exit code 1 on any failure.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const piece = path.resolve(__dirname, '..'), web = path.join(piece, 'web');
const ROOT = path.resolve(piece, '..', '..');
const port = +(process.argv[2] || 6480);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const score = JSON.parse(fs.readFileSync(path.join(piece, 'out', 'score.json'), 'utf8'));
const jobs = fs.readFileSync(path.join(piece, 'out', 'jobs.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','))
  .map(r => ({ strength: +r[0], reach: +r[1], res: +r[2], job: r[4] }));
const jobFor = (s, r, res) => jobs.find(j => j.strength === s && j.reach === r && j.res === res).job;

const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {   // byte ranges, so <audio> can seek like it can on the real host
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  fs.createReadStream(f).pipe(res);
});

// the same sound instrumentation as common/qa/qa_page.cjs: count Web Audio sources started and <audio> 'playing' events
const INSTRUMENT = () => {
  window.__qa = { sources: 0, osc: 0, media: 0, ctxs: [] };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctxs.push(c); return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; if (this instanceof OscillatorNode) window.__qa.osc++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [];
let fails = 0;
function check(cond, msg) { steps.push((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; console.log((cond ? 'ok   ' : 'FAIL ') + msg); }

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.addInitScript(INSTRUMENT);
  const txt = sel => page.$eval(sel, e => e.textContent.trim());
  const qa = () => page.evaluate(() => ({ sources: window.__qa.sources, osc: window.__qa.osc, media: window.__qa.media, running: window.__qa.ctxs.some(c => c.state === 'running') }));
  const col = async () => +(await txt('#p-col')).replace(/,/g, '');
  const pressed = sel => page.$eval(sel, e => e.getAttribute('aria-pressed'));
  // how many sampled pixels of a canvas are drawn (not blank and not the paper colour #FBFAF9)
  const ink = sel => page.$eval(sel, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 0 && (d[i] < 200 || d[i + 2] < 200)) n++; return n; });
  try {
    // 1. start: the page runs the whole machine in the browser and verifies the halt; nothing sounds yet
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => /Verified here|Check failed/.test(document.getElementById('warm').textContent), null, { timeout: 30000 });
    check(/Verified here: halted at step 47,176,870 with 4,098 ones/.test(await txt('#warm')), 'warm-up re-runs the machine and verifies 47,176,870 steps / 4,098 ones in the browser');
    check(/re-checked in your browser/.test(await txt('#proof-run')), 'proof chip updates to "re-checked in your browser"');
    const chips = await page.$$eval('.proof span', ss => ss.map(s => s.textContent.replace(/\s+/g, ' ').trim()));
    check(/qubits=20 \(engine max\)/.test(chips[0]) && chips[1] === jobs.length + ' real Atlas jobs · simulator, no hardware',
      `proof chips match piece.json and out/jobs.csv: ${chips.slice(0, 2).join(' | ')}`);
    const q0 = await qa();
    check(q0.sources === 0 && q0.media === 0, 'no sound before any click (no autoplay)');
    check(await page.isVisible('#scene') && !(await page.isVisible('#cv')), 'opens on the Scene view');
    check(await txt('#p-total') === '4,574' && await col() === 1, 'scrubber covers 4,574 notes, at note 1');
    check(await page.$eval('#prev', b => b.disabled) && !(await page.$eval('#next', b => b.disabled)), '< Phrase is disabled at note 1 (nothing earlier), Phrase > is enabled');
    await page.click('#next'); const cN = await col(); await page.click('#prev');
    check(cN === score.phrases[1].col0 + 1 && await col() === 1 && await page.$eval('#prev', b => b.disabled), `Phrase > goes to phrase 2 (note ${cN}) and < Phrase comes back to note 1, where it is disabled again`);
    const sceneInk = await ink('#scene'), miniInk = await ink('#mini');
    check(sceneInk > 2000 && miniInk > 200, `the scene and the minimap under it are drawn (${sceneInk} and ${miniInk} ink samples)`);

    // 2. play the live synth: sound starts, the run advances; pause stops both
    await page.click('#play');
    await page.waitForTimeout(1200);
    const q1 = await qa(), c1 = await col();
    check(q1.osc > 0 && q1.running, `Play starts Web Audio (${q1.osc} oscillators, context running)`);
    check(c1 > 5 && await pressed('#play') === 'true' && /Pause/.test(await txt('#play')), `the run advances while playing (note ${c1}) and the button reads Pause`);
    await page.click('#play');
    await page.waitForTimeout(300);
    const qa2 = await qa(), c2 = await col(); await page.waitForTimeout(600);
    const qa3 = await qa(), c3 = await col();
    check(qa3.osc === qa2.osc && c3 === c2 && await pressed('#play') === 'false', `Pause stops the synth and the run (note ${c3}, no new oscillators)`);

    // 3. phrase and keyboard navigation, readouts tied to the real run
    await page.click('#next');
    let kNow = 0; score.phrases.forEach((p, i) => { if (p.col0 <= c3 - 1) kNow = i; });
    check(await col() === score.phrases[kNow + 1].col0 + 1, `Phrase > jumps from phrase ${kNow + 1} to the start of phrase ${kNow + 2} (note ${score.phrases[kNow + 1].col0 + 1})`);
    await page.focus('#scene'); const cA = await col(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100);
    check(await col() === cA + 1, 'ArrowRight on the scene steps one note');
    await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(100);
    check(await col() === cA + 17, 'Shift+ArrowRight steps 16 notes');
    // scrub to a fixed note and check the readout against Python's score table
    await page.$eval('#scrub', (s, v) => { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, 2000);
    await page.waitForTimeout(150);
    const cell = score.col_cell[2000], stp = score.col_step[2000];
    check(await col() === 2001 && (await txt('#p-step')) === stp.toLocaleString('en-US'), `scrubbing to note 2,001 shows machine step ${stp.toLocaleString('en-US')}`);
    check((await txt('#r-head')).startsWith('cell ' + cell.toLocaleString('en-US') + ' '), `the head readout is the real cell ${cell} (from out/score.json)`);

    // 4. the meaningful outcome: jump to the halt, where the dam is complete
    await page.click('#halt');
    await page.waitForTimeout(400);
    check(await txt('#p-step') === '47,176,870' && /^halted on cell -12,242/.test(await txt('#r-head')), 'Jump to the halt lands on step 47,176,870, head halted on cell -12,242');
    check(/^4,098 ones/.test(await txt('#r-tape')) && /no more steps/.test(await txt('#lapse')), 'the tape holds 4,098 ones and the time-lapse label says the run is over');
    check(await page.$eval('#next', b => b.disabled) && !(await page.$eval('#prev', b => b.disabled)), 'at the halt Phrase > is disabled, < Phrase is enabled');
    check(/Halted at step 47,176,870/.test(await txt('#toast')), 'the halt toast explains what happened');
    await page.click('#prev'); await page.waitForTimeout(150);
    check(await col() === score.phrases[14].col0 + 1, '< Phrase from the halt goes to the start of the halting phrase');

    // 5. every score option does something (each tested after selecting a different one first)
    const mode = async () => [await txt('#r-job'), await txt('#h-mode')];
    await page.click('[data-score="blur"]');
    check((await mode())[0] === jobFor(0.2, 1, 60) && await pressed('[data-grid="60"]') === 'true', 'Quantum blur selects the 20-qubit reach-1 job ' + jobFor(0.2, 1, 60));
    await page.click('[data-reach="0"]');
    check((await mode())[0] === jobFor(0.2, 0, 60), 'reach 0 selects job ' + jobFor(0.2, 0, 60));
    await page.click('[data-reach="1"]');
    check((await mode())[0] === jobFor(0.2, 1, 60), 'reach 1 selects job ' + jobFor(0.2, 1, 60));
    await page.click('[data-grid="0"]');
    check((await mode())[0] === jobFor(0.2, 1, 0) && await pressed('[data-grid="0"]') === 'true', '1/16 grid (after 1/32) selects job ' + jobFor(0.2, 1, 0));
    await page.click('[data-strength="0.5"]');
    check((await mode())[0] === jobFor(0.5, 1, 0), 'strength 0.5 selects job ' + jobFor(0.5, 1, 0));
    await page.click('[data-grid="60"]');
    check((await mode())[0] === jobFor(0.2, 1, 60) && await pressed('[data-strength="0.2"]') === 'true' && /1\/32 grid was run at strength 0.2 only/.test(await txt('#toast')),
      '1/32 grid at strength 0.5 moves to strength 0.2 (the only 1/32 jobs) and says so');
    await page.click('[data-strength="0.5"]'); await page.click('[data-grid="0"]');
    await page.click('[data-strength="0.2"]');
    check((await mode())[0] === jobFor(0.2, 1, 0) && await pressed('[data-strength="0.2"]') === 'true', 'strength 0.2 (after 0.5) selects job ' + jobFor(0.2, 1, 0));
    await page.click('[data-score="raw"]');
    check((await mode())[0] === 'none (classical score)' && (await mode())[1] === 'Raw score', 'Raw returns to the classical score');
    // with the raw score on, the blur's settings are idle but live (not announced as disabled): picking one switches to that blur
    const idle = await page.$$eval('#g-reach, #g-strength, #g-grid', gs => gs.every(g => g.dataset.idle === 'true' && !g.hasAttribute('aria-disabled') && /switches to the quantum blur/.test(g.getAttribute('aria-label'))));
    check(idle, 'with Raw on, the reach/strength/grid groups are idle (dimmed) and say picking one switches to the blur');
    await page.click('[data-reach="0"]');
    check((await mode())[0] === jobFor(0.2, 0, 0) && await pressed('[data-score="blur"]') === 'true' && await page.$eval('#g-reach', g => g.dataset.idle === 'false' && g.getAttribute('aria-label') === 'Blur reach'),
      'from Raw, picking reach 0 switches to the blur, job ' + jobFor(0.2, 0, 0));
    await page.click('[data-reach="1"]'); await page.click('[data-score="raw"]');
    await page.keyboard.press('b');
    check((await mode())[0] !== 'none (classical score)', 'the B key flips to the blur');
    await page.keyboard.press('b');
    await page.$eval('#tempo', s => { s.value = 30; s.dispatchEvent(new Event('input', { bubbles: true })); });
    check(await txt('#tempo-lab') === '30 notes/s', 'the tempo slider sets 30 notes/s');

    // 6. Scene / Data toggle, and dragging the Data view scrubs the run
    await page.click('[data-view="data"]');
    check(await page.isVisible('#cv') && !(await page.isVisible('#scene')) && !(await page.isVisible('#legend')) && await pressed('[data-view="data"]') === 'true', 'Data shows the falling score + tape and hides the scene and its legend');
    const cvInk = await ink('#cv');
    check(cvInk > 2000, `the Data view's score + tape graph is drawn (${cvInk} ink samples)`);
    const box = await page.$('#cv').then(h => h.boundingBox()), cD = await col();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6, { steps: 8 }); await page.mouse.up();
    const cD2 = await col();
    check(cD2 > cD + 10, `dragging the score down moves forward (${cD} -> ${cD2})`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3, { steps: 8 }); await page.mouse.up();
    check(Math.abs(await col() - cD) <= 1, `dragging it back up returns (${await col()})`);

    // 7. share link: copy, then reload from the hash and check the moment is restored (note, score, tempo, Data view)
    await page.click('[data-score="blur"]');
    const want = { col: await col(), job: (await mode())[0], tempo: await txt('#tempo-lab') };
    await page.click('#share'); await page.waitForTimeout(200);
    const hash = await page.evaluate(() => location.hash);
    check(hash === '#c' + (want.col - 1) + '.m' + (await page.evaluate(() => modeId())) + '.t30.vd' && /^#c\d+\.ms[\d.]+r\d(x\d+)?\.t30\.vd$/.test(hash) && /^[#A-Za-z0-9._~-]+$/.test(hash),
      'Copy link writes #c<note>.m<score>.t<tempo>.vd (safe characters only): ' + hash);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check(clip === base + hash && /Link copied/.test(await txt('#toast')), 'the link is on the clipboard and the toast confirms it');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    check(await col() === want.col && (await mode())[0] === want.job && await txt('#tempo-lab') === want.tempo && await page.isVisible('#cv'),
      `reloading with the hash restores note ${want.col}, job ${want.job}, ${want.tempo}, Data view`);
    // where copying is blocked, the link is shown, selected, beside the button
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); document.execCommand = () => false; });
    await page.click('#share'); await page.waitForTimeout(200);
    const fb = await page.$eval('#share-url', i => ({ shown: !i.hidden && i.offsetWidth > 0, value: i.value, sel: i.selectionEnd - i.selectionStart }));
    check(fb.shown && fb.value === base + hash && fb.sel === fb.value.length && /copy it by hand/.test(await txt('#toast')), 'if copying is blocked, the link appears selected beside the button');
    await page.click('[data-view="scene"]');
    check(await page.isVisible('#scene') && !(await page.isVisible('#cv')), 'Scene brings the illustrated view back');

    // 8. a full WAV render plays on the page, the score follows it, and Pause stops it
    const m0 = (await qa()).media;
    const tbtn = '.track[data-mode="s0.2r0x60"] button';
    await page.click(tbtn);
    await page.waitForFunction(() => { const a = document.querySelector('.track[data-mode="s0.2r0x60"] audio'); return a && !a.paused && a.currentTime > 0.3; }, null, { timeout: 15000 });
    check((await qa()).media > m0 && await pressed(tbtn) === 'true', 'the reach-0 blur WAV render plays on the page (media "playing" fired)');
    check(/^WAV render/.test(await txt('#h-mode')) && (await mode())[0] === jobFor(0.2, 0, 60), 'the score above switches to the matching job');
    await page.waitForTimeout(800);
    const ct = await page.$eval('.track[data-mode="s0.2r0x60"] audio', a => a.currentTime), cF = await col();
    check(ct > 0.8 && Math.abs(cF - (Math.floor(ct * 15) + 1)) <= 8, `the score follows the recording on the 15 notes/s clock (t = ${ct.toFixed(2)} s, note ${cF})`);
    await page.click(tbtn); await page.waitForTimeout(200);
    check(await page.$eval('.track[data-mode="s0.2r0x60"] audio', a => a.paused) && await pressed(tbtn) === 'false', 'Pause stops the render');
    // starting the live synth pauses any render (one source at a time)
    await page.click(tbtn); await page.waitForTimeout(600); await page.click('#play'); await page.waitForTimeout(300);
    check(await page.$eval('.track[data-mode="s0.2r0x60"] audio', a => a.paused) && await pressed('#play') === 'true', 'Play on the live synth pauses the render');
    await page.click('#play');

    // 9. the science / how-it-was-made drawers open, the honesty notes are visible, and the job table lists the six real jobs
    const drawers = await page.$$('details.drawer');
    for (const d of drawers) { await d.$eval('summary', s => s.click()); }
    const opened = await page.$$eval('details.drawer', ds => ds.filter(d => d.open).length);
    check(drawers.length === 3 && opened === 3, `all ${drawers.length} drawers open (Why this machine?, How 47 million steps..., What the quantum engine did)`);
    check(await page.$$eval('#claims .honesty', ps => ps.length === 2 && ps.every(p => p.offsetHeight > 0)), 'both honesty notes are visible under "What this does not claim"');
    const rows = await page.$$eval('#jobs tbody tr', trs => trs.map(t => t.lastChild.textContent));
    check(rows.length === 6 && jobs.every(j => rows.includes(j.job)), 'the job table lists all 6 job IDs from out/jobs.csv');

    // 9b. the restored sections: titled, visible, in order, with both graphs always on screen and wired to the run
    const secs = await page.$$eval('section .ink-bar > span:first-child', ss => ss.filter(s => s.offsetHeight > 0).map(s => s.textContent.trim()));
    const wantSecs = ['How to play', 'The data', 'Hear the full renders', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits'];
    check(JSON.stringify(secs) === JSON.stringify(wantSecs), 'the sections below the scene are, in order: ' + secs.join(' | '));
    const howSteps = await page.$$eval('#how ol.steps li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    check(howSteps.length === 4 && howSteps[0] === "Play, then scrub anywhere in the run. The strip under the notes is the machine's tape at that exact step."
      && howSteps[3] === 'Hear the three full WAV renders below, every note, with the score following along.', 'How to play carries the four original steps, word for word');
    check(!/bonus/i.test(await page.evaluate(() => document.body.innerText)) && /^Challenge 02$/.test(await txt('.wtnr-bar .count')), 'no "Bonus" wording anywhere; the brand bar reads Challenge 02');
    await page.click('[data-view="scene"]').catch(() => {});
    await page.$eval('#cv2', c => c.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const inked = await page.$eval('#cv2', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] < 120) n++; return n; });
    check(await page.isVisible('#scene') && !(await page.isVisible('#cv')) && await page.isVisible('#cv2') && inked > 500, `with the Scene on the stage, the score + tape graph is visible and drawn under "The data" (${inked} ink samples)`);
    const live0 = await txt('#fig-live');
    check(live0.includes('note ' + (await txt('#p-col')) + ' / 4,574') && live0.includes(await txt('#h-mode')), 'its live line matches the stage: ' + live0);
    await page.$eval('#scrub', s => { s.value = 2000; s.dispatchEvent(new Event('input', { bubbles: true })); }); await page.waitForTimeout(150);
    const b2 = await page.$('#cv2').then(h => h.boundingBox()), cE = await col();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height * 0.6); await page.mouse.down();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height * 0.3, { steps: 8 }); await page.mouse.up();
    check(await col() < cE - 10, `dragging the graph in "The data" scrubs the run (${cE} -> ${await col()})`);
    await page.$eval('#roll', c => c.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const rb = await page.$('#roll').then(h => h.boundingBox());
    await page.mouse.click(rb.x + rb.width * 0.5, rb.y + rb.height / 2); await page.waitForTimeout(200);
    const cR = await col();
    check(cR > 2000 && cR < 2600, `clicking the middle of the whole-run graph jumps to the middle of the run (note ${cR})`);
    const rollInk = await ink('#roll');
    check(rollInk > 1000, `the whole-run graph is drawn (${rollInk} ink samples)`);
    await page.mouse.move(rb.x + rb.width * 0.4, rb.y + rb.height * 0.4); await page.mouse.down();
    await page.mouse.move(rb.x + rb.width * 0.6, rb.y + rb.height * 0.55, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    const cR2 = await col();
    check(cR2 > 2500 && cR2 < 3000, `dragging across the whole-run graph from 40% to 60% of its width scrubs with the pointer (note ${cR2})`);
    await page.$eval('#jobs-credits', s => s.scrollIntoView());
    await page.click(`[data-job="s0.5r0"]`); await page.waitForTimeout(150);
    check((await mode())[0] === jobFor(0.5, 0, 0) && await pressed('[data-job="s0.5r0"]') === 'true' && /Showing job/.test(await txt('#toast')), 'Show in the job table puts job ' + jobFor(0.5, 0, 0) + ' on the stage');
    await page.click('[data-score="raw"]');

    // 10. piece-to-piece navigation
    const nav = await page.evaluate(() => ({
      brand: document.querySelector('.wtnr-bar a').href,
      prev: (document.querySelector('.wtnr-nav a[rel="prev"]') || {}).href, next: (document.querySelector('.wtnr-nav a[rel="next"]') || {}).href,
      hub: (document.querySelector('.wtnr-nav a.wn-hub') || {}).href, list: [...document.querySelectorAll('.wtnr-nav ol a')].map(a => a.href),
      current: (document.querySelector('.wtnr-nav ol a[aria-current="page"]') || {}).href,
      navBeforeFoot: !!document.querySelector('.wtnr-nav') && (document.querySelector('.wtnr-nav').compareDocumentPosition(document.querySelector('.wtnr-foot')) & 4) > 0 }));
    check(nav.brand === HUB && nav.hub === HUB, 'brand bar and "All 22 pieces" link to the hub');
    check(nav.prev === urls['15-tissue-blur'] && nav.next === urls['17-quantum-lenia'], 'prev links to 15 Tissue Blur, next to 17 Quantum Lenia');
    check(nav.list.length === 22 && nav.current === urls['16-busy-beaver-score'] && nav.navBeforeFoot, 'the jump list has all 22 pieces, marks this one, and sits above the footer');

    check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } catch (e) {
    check(false, 'journey threw: ' + String(e.stack || e).slice(0, 400));
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(__dirname, 'e2e.json'), JSON.stringify({ ok: fails === 0, fails, steps }, null, 1));
  console.log(fails ? fails + ' FAILED' : 'e2e passed');
  process.exit(fails ? 1 : 0);
})();
