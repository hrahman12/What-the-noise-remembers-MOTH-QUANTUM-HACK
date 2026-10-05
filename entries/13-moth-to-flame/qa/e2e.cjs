// End-to-end journey for Moth to Flame:  node entries/13-moth-to-flame/qa/e2e.cjs [port 6420-6429]
// Serves web/ locally, opens the built page in headless Chromium and walks the main user journey with real
// assertions, using real mouse and keyboard input only (page internals are READ to know where the moth is,
// never written):
//   start screen + no autoplay -> data on the page matches jobs.csv / piece.json / PARAMS.md / the job cache ->
//   lamp-map square picker -> shot stepping -> take off (sound starts) -> steer the moth home by dragging on
//   the town -> share from the end card -> Play again -> pause (audio suspended) -> resume by pressing the town ->
//   sound off / on -> hands-off reflex beside a lamp (the lamp holds the moth) -> Scene / Data -> Plan vs
//   measured -> Whole town -> the six titled sections (first-version words, no "Bonus") and their section buttons ->
//   every graph drawn (all canvases, the three Figure 3 panels, the two Figure 4 panels, the energy bar) -> The data:
//   Figure 1 edge readout, shared Plan switch, shot stepping, Figure 2 pixels + pick, Figure 3 loads a level, Figure 4
//   (ibm_fez level beside its labelled comparison run: pair switch, disagreement marks, table, fly the level), flying
//   from Figure 1, jobs table -> copy link + reload restores level, shot and pull -> another
//   shared link opened in the same tab (hashchange) and in a new tab -> touch pad take-off -> prev / hub / next nav
//   and the "Jump to any piece" list.
// Exit code 1 if any check fails. Screenshots: qa/e2e-home.png, qa/e2e-restored.png.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = path.basename(PIECE), HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const port = +(process.argv[2] || 6420);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

// the same audio instrumentation as common/qa/qa_page.cjs: count started sources, keep every AudioContext
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; (window.__qa.ctxs ||= []).push(c); return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
};

const steps = [], fails = [];
function check(cond, msg) { (cond ? steps : fails).push((cond ? 'PASS ' : 'FAIL ') + msg); console.log((cond ? 'PASS ' : 'FAIL ') + msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ground truth from the files on disk
const LEVELS = JSON.parse(fs.readFileSync(path.join(WEB, 'levels.json'), 'utf8'));
const COMPARE = JSON.parse(fs.readFileSync(path.join(WEB, 'compare.json'), 'utf8'));
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const params = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8'), readme = fs.readFileSync(path.join(PIECE, 'README.md'), 'utf8');
// out/jobs.csv: one row per level (role "level", all IBM ibm_fez) and per labelled comparison run (role "comparison")
const csvRows = (() => { const [head, ...ls] = fs.readFileSync(path.join(PIECE, 'out', 'jobs.csv'), 'utf8').trim().split(/\r?\n/); const h = head.split(',');
  return ls.map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i]; }); return { level: o.level, role: o.role, name: o.name, mode: o.mode, qubits: +o.qubits, backend: o.backend, job: o.job_id }; }); })();
const jobs = csvRows.filter(j => j.role === 'level'), cmpJobs = csvRows.filter(j => j.role === 'comparison');
const cacheText = fs.readdirSync(path.join(ROOT, 'cache', 'labyrinth-v1')).filter(f => f.endsWith('.json'))
  .map(f => fs.readFileSync(path.join(ROOT, 'cache', 'labyrinth-v1', f), 'utf8')).join('\n');
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const order = fs.readdirSync(path.join(ROOT, 'entries')).filter(s => fs.existsSync(path.join(ROOT, 'entries', s, 'piece.json'))).sort();
const me = order.indexOf(SLUG), prevSlug = order[(me - 1 + order.length) % order.length], nextSlug = order[(me + 1) % order.length];

function route(L) {   // BFS through the measured open streets (<ZZ> >= 0), start -> home
  const adj = {}; L.edges.forEach(([a, b, , zz]) => { if (zz >= 0) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } });
  const prev = { [L.start]: -1 }, q = [L.start];
  while (q.length) { const u = q.shift(); for (const v of adj[u] || []) if (!(v in prev)) { prev[v] = u; q.push(v); } }
  const p = []; for (let u = L.home; u !== -1; u = prev[u]) p.unshift(u); return p;
}

(async () => {
  await new Promise(r => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(INSTRUMENT);
  const st = () => page.evaluate(() => ({ state: S.state, paused: ui.paused, x: S.x, y: S.y, t: S.t, orbits: S.orbits, glare: S.glare, energy: S.energy, dlr: S.dlr, hands: ui.hands, li: ui.li, shot: ui.shot, pull: ui.pull }));
  const qa = () => page.evaluate(() => ({ sources: __qa.sources, ctx: __qa.ctx, states: (__qa.ctxs || []).map(c => c.state) }));
  const text = sel => page.textContent(sel).then(s => (s || '').trim());
  const attr = (sel, a) => page.getAttribute(sel, a);
  const isHidden = sel => page.$eval(sel, e => e.hidden || getComputedStyle(e).display === 'none');
  const pixel = (x, y) => page.evaluate(([x, y]) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3), [x, y]);
  const toScreen = (wx, wy) => page.evaluate(([wx, wy]) => { const v = view(), r = cv.getBoundingClientRect(), dpr = cv.width / r.width;
    return { x: r.left + (v.ox + wx * v.s) / dpr, y: r.top + (v.oy + wy * v.s) / dpr }; }, [wx, wy]);
  const setPull = async v => { await page.focus('#pull'); await page.keyboard.press('Home'); for (let k = 0; k < Math.round(v * 10); k++) await page.keyboard.press('ArrowRight'); };

  try {
    // ---------- 1. start screen, nothing plays on its own ----------
    await page.goto(base, { waitUntil: 'networkidle' }); await sleep(600);
    check(!(await isHidden('#overlay')) && (await text('#ov-title')) === 'Lamp Lane' && (await text('#ov-go')) === 'Take off', 'start card: Lamp Lane, "Take off"');
    let s = await st(); check(s.state === 'ready' && s.t === 0, 'nothing moves before take-off');
    let a = await qa(); check(a.sources === 0 && a.ctx === 0, 'no sound and no AudioContext before a click (no autoplay)');
    check(await page.$eval('#reset', b => b.disabled) && await page.$eval('#shot-top', b => b.disabled), '"Reset flight" and "First shot" are disabled when there is nothing to reset');

    // ---------- 2. numbers on the page = jobs.csv / piece.json / PARAMS.md / README / cache ----------
    const proof = await text('.proof');
    check(/156\s*qubits on IBM ibm_fez/.test(proof) && /3\s*real Atlas jobs on IBM ibm_fez, one per level/.test(proof) && /4096\s*shots per job/.test(proof)
      && /2\s*comparison runs: Aer emulator, IBM ibm_miami/.test(proof), 'proof chips: 156 on ibm_fez, 3 ibm_fez jobs, 4096 shots, 2 labelled comparison runs');
    check(jobs.length === 3 && jobs.every(j => j.mode === 'qpu' && j.backend === 'ibm_fez') && LEVELS.every(L => L.mode === 'qpu' && L.backend === 'ibm_fez'),
      'every level in out/jobs.csv and levels.json ran on IBM ibm_fez (engine-reported backend)');
    check(piece.qubits === Math.max(...jobs.map(j => j.qubits)) && piece.jobs === jobs.length + cmpJobs.length && piece.hardware === 'ibm_fez' && piece.hardware_qubits === 156
      && JSON.stringify([...piece.hardware_all].sort()) === JSON.stringify([...new Set(jobs.filter(j => j.mode === 'qpu').map(j => j.backend))].sort())
      && JSON.stringify(piece.comparison_runs.map(c => c.job)) === JSON.stringify(cmpJobs.map(j => j.job)), 'piece.json qubits / jobs / hardware / comparison runs match out/jobs.csv');
    const lvButtons = await page.$$('#levels button');
    check(lvButtons.length === jobs.length, `${jobs.length} level buttons, one per job`);
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i], L = LEVELS[i];
      await lvButtons[i].click(); await sleep(150);
      const rq = await text('#r-q'), rjob = await text('#r-job'), ribm = await text('#r-ibm'), rran = await text('#r-ran'), chip = await text('#chip');
      const ibm = L.ibmJob;
      check(rjob === j.job && rq.startsWith(String(j.qubits) + ' ') && chip.includes(j.job.slice(0, 8)) && chip.includes(`${j.qubits} qubits`) && chip.includes(`IBM ${j.backend}`)
        && (await text(`#levels button:nth-child(${i + 1})`)).includes(`IBM ${j.backend} · ${j.qubits} qubits`)
        && (j.mode === 'qpu' ? rran.includes(j.backend) && ribm === ibm : rran.includes('Aer emulator') && ribm.startsWith('none')),
        `${j.level} readout: job ${j.job.slice(0, 8)}, ${j.qubits} qubits, ${j.mode === 'qpu' ? j.backend + ', IBM job ' + ibm : 'Aer emulator'}`);
      check(params.includes(j.job) && readme.includes(j.job) && (!ibm || (params.includes(ibm) && readme.includes(ibm))) && params.includes(`| ${j.qubits} |`), `${j.level} job IDs and qubits are in PARAMS.md and README`);
      check(cacheText.includes(j.job) && (!ibm || cacheText.includes(ibm)), `${j.level} job ${j.job.slice(0, 8)}${ibm ? ' / ' + ibm : ''} exists in cache/labyrinth-v1`);
      check((await attr(`#levels button:nth-child(${i + 1})`, 'aria-pressed')) === 'true', `${j.level} button shows as selected`);
    }
    await lvButtons[0].click(); await sleep(150);

    // ---------- 3. lamp map: pick a square, read its qubit and bit ----------
    const L1 = LEVELS[0], pickI = 1 * L1.cols + 2;   // row 2, col 3
    await page.$eval('#bits', e => e.scrollIntoView({ block: 'center' }));
    let bb = await (await page.$('#bits')).boundingBox();
    await page.mouse.click(bb.x + (2.5 / L1.cols) * bb.width, bb.y + (1.5 / L1.rows) * bb.height);
    const bit = L1.shotList[0][0][pickI], note = await text('#pick-note');
    check(note.includes(`qubit ${pickI}`) && note.includes(`bit ${bit}`) && note.includes(bit === '1' ? 'lit' : 'dark'), `lamp map click -> "${note}" (bit ${bit} from levels.json)`);
    check((await attr('#overlay', 'class')).includes('look'), 'picking a square lifts the start card so the square shows in the town');
    await page.keyboard.press('ArrowRight'); await sleep(80);
    check((await text('#pick-note')).includes(`qubit ${pickI + 1}`), 'arrow key on the lamp map moves the pick');
    await page.keyboard.press('Escape'); await sleep(80);
    check((await text('#pick-note')).startsWith('Tap a square') && !(await attr('#overlay', 'class')).includes('look'), 'Escape clears the pick');

    // ---------- 4. shot stepping (prev is disabled only on shot 1) ----------
    check(await page.$eval('#shot-prev', b => b.disabled), '‹ is disabled on shot 1 (the detector\'s timeout is this, not a dead button)');
    await page.click('#shot-next'); await sleep(100);
    check((await text('#shot-num')).startsWith('shot 2 of 40') && !(await page.$eval('#shot-prev', b => b.disabled)), '› goes to shot 2 and enables ‹');
    await page.click('#shot-prev'); await sleep(100);
    check((await text('#shot-num')).startsWith('shot 1 of 40'), '‹ goes back to shot 1');
    await page.click('#shot-next'); await page.click('#shot-next'); await sleep(100);
    await page.click('#shot-top'); await sleep(100);
    check((await text('#shot-num')).startsWith('shot 1 of 40') && await page.$eval('#shot-top', b => b.disabled), '"Most frequent" returns to shot 1, then disables itself');

    // ---------- 5. take off: sound starts ----------
    await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    a = await qa();
    await page.click('#ov-go'); await sleep(400);
    s = await st(); const a1 = await qa();
    check(s.state === 'fly' && await isHidden('#overlay') && (await text('#go')) === 'Pause', 'Take off: the moth flies, the card closes, the main button becomes Pause');
    check(a1.sources > a.sources && a1.states.includes('running'), `sound started on Take off (${a1.sources - a.sources} sources, context running)`);
    check(!(await page.$eval('#reset', b => b.disabled)), '"Reset flight" is enabled in flight');

    // ---------- 6. steer home by dragging on the town (real pointer, closed loop) ----------
    const r = route(L1), Wl = await page.evaluate(() => W.lamps.filter(l => l.lit).map(l => ({ i: l.i, x: l.x, y: l.y })));
    const wps = r.map(c => { let x = c % L1.cols + .5, y = Math.floor(c / L1.cols) + .5; const lp = Wl.find(l => l.i === c);
      if (lp) { const dx = x - lp.x, dy = y - lp.y, d = Math.hypot(dx, dy) || 1; x += .22 * dx / d; y += .22 * dy / d; } return [x, y]; });
    let k = 1, flap = false, p0 = await toScreen(...wps[k]);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      s = await st(); if (s.state !== 'fly') break;
      if (Math.hypot(wps[k][0] - s.x, wps[k][1] - s.y) < .3 && k < wps.length - 1) k++;
      const p = await toScreen(...wps[k]); await page.mouse.move(p.x, p.y);
      const want = Math.abs(s.dlr) > 1.2;   // a lamp is pulling: flap (Shift) to break away
      if (want !== flap) { flap = want; await (flap ? page.keyboard.down('Shift') : page.keyboard.up('Shift')); }
      await sleep(25);
    }
    if (flap) await page.keyboard.up('Shift');
    await page.mouse.up();
    s = await st(); await sleep(300);
    check(s.state === 'home', `dragging on the town steered the moth home along the measured streets (${s.state}, ${s.t.toFixed(1)} s, ${s.energy.toFixed(0)}% energy, ${s.orbits} loops)`);
    check((await text('#ov-title')).startsWith('Home in') && !(await isHidden('#ov-share')) && (await text('#go')) === 'Fly again', 'end card: "Home in …", share button shown, main button "Fly again"');
    await page.screenshot({ path: path.join(__dirname, 'e2e-home.png') });

    // ---------- 7. share from the end card ----------
    await page.click('#ov-share'); await sleep(300);
    let clip = ''; try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = ''; }
    check((await page.evaluate(() => location.hash)) === '#L1.s0.p10' && clip.endsWith('#L1.s0.p10'), `end-card "Copy link" put #L1.s0.p10 in the URL and on the clipboard`);

    // ---------- 8. Play after the flight, pause (audio suspended), resume by pressing the town ----------
    check((await text('#pause')) === 'Play', 'corner button reads "Play" after the flight');
    await page.click('#pause'); await sleep(300);
    s = await st(); check(s.state === 'fly' && s.t < 1, 'corner "Play" after a flight starts a new flight');
    await page.click('#pause'); await sleep(300);
    s = await st(); a = await qa();
    check(s.paused && (await text('#ov-title')) === 'Paused' && a.states.every(x => x !== 'running'), 'Pause: flight frozen, audio context suspended (sound stops)');
    bb = await (await page.$('#stage')).boundingBox();
    await page.mouse.move(bb.x + 18, bb.y + bb.height * .82); await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(250);
    s = await st(); a = await qa();
    check(s.state === 'fly' && !s.paused && a.states.includes('running'), 'pressing the dimmed town resumes the flight and the sound');

    // ---------- 9. sound off / on ----------
    await page.click('#sound'); await sleep(350);
    let g = await page.evaluate(() => Snd.master.gain.value);
    check((await text('#sound')) === 'Sound off' && (await attr('#sound', 'aria-pressed')) === 'false' && g < 0.02, `Sound off mutes the output (gain ${g.toFixed(3)})`);
    await page.click('#sound'); await sleep(350);
    g = await page.evaluate(() => Snd.master.gain.value);
    check((await text('#sound')) === 'Sound on' && g > 0.4, `Sound on restores it (gain ${g.toFixed(2)})`);

    // ---------- 10. hands off beside a lamp: the reflex holds the moth ----------
    await page.click('#reset'); await sleep(200);
    check((await st()).state === 'ready', 'Reset flight returns to the start');
    await page.click('#demo'); await sleep(200);
    const d0 = await page.evaluate(() => { const lt = Sim.light(W, S.x, S.y, P); return lt.lamp ? { x: lt.lamp.x, y: lt.lamp.y } : null; });
    s = await st();
    check(s.state === 'fly' && s.hands && (await attr('#t-hands', 'aria-pressed')) === 'true' && (await text('#h-warn')) === 'hands off', '"Let go by a lamp": moth dropped beside a lit lamp, hands off');
    await sleep(6000);
    s = await st();
    const dist = d0 ? Math.hypot(s.x - d0.x, s.y - d0.y) : 99;
    check(d0 && s.state === 'fly' && dist < 1.2 && s.glare > 0.5 && /loop/.test(await text('#h-orb')), `after 6 s hands off the lamp still holds the moth (${dist.toFixed(2)} squares from the bulb, ${s.glare.toFixed(1)} s in the glare, ${s.orbits} loops)`);
    await page.click('#t-hands'); await sleep(100);
    check(!(await st()).hands && (await attr('#t-hands', 'aria-pressed')) === 'false', 'Hands off toggles back to manual');
    await page.click('#go'); await sleep(150);   // Pause via the main button
    check((await st()).paused && (await text('#go')) === 'Resume', 'main button pauses mid-flight and reads "Resume"');
    await page.click('#reset'); await sleep(150);

    // ---------- 11. Scene / Data ----------
    await page.evaluate(() => scrollTo(0, 0)); await sleep(100);
    const sceneBg = await pixel(2, 2);
    await page.click('#v-data'); await sleep(200);
    const dataBg = await pixel(2, 2);
    check((await attr('#v-data', 'aria-pressed')) === 'true' && await page.$eval('#stage', e => e.classList.contains('data')) && !(await isHidden('#leg-data')) && await isHidden('#leg-scene')
      && dataBg.join() === '240,240,244' && sceneBg.join() === '25,35,142', `Data view: schematic on paper (corner ${dataBg}), data legend shown; Scene was night ink (${sceneBg})`);

    // ---------- 12. Plan vs measured: the changed edge gets orange dashes (Data view) ----------
    const chg = L1.edges.find(e => (e[3] >= 0) !== (e[2] > 0));
    const ca = chg[0] % L1.cols, ra = Math.floor(chg[0] / L1.cols), cb = chg[1] % L1.cols, rb = Math.floor(chg[1] / L1.cols);
    const mid = ra === rb ? [Math.max(ca, cb), ra + .5] : [ca + .5, Math.max(ra, rb)];
    const warnNear = async () => page.evaluate(([wx, wy]) => { const v = view(), cx = Math.round(v.ox + wx * v.s), cy = Math.round(v.oy + wy * v.s);
      const d = cv.getContext('2d').getImageData(cx - 3, cy - 3, 7, 7).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 180) < 30 && Math.abs(d[i + 1] - 84) < 30 && Math.abs(d[i + 2] - 26) < 30) n++; return n; }, mid);
    const before = await warnNear();
    await page.click('#t-plan'); await sleep(200);
    const after = await warnNear();
    check((await attr('#t-plan', 'aria-pressed')) === 'true' && before === 0 && after > 0, `Plan vs measured marks a changed edge on L1 in orange (${before} -> ${after} warm pixels)`);
    await page.click('#t-plan'); await page.click('#v-scene'); await sleep(200);
    check((await pixel(2, 2)).join() === '25,35,142' && (await attr('#v-scene', 'aria-pressed')) === 'true', 'Scene view is back');

    // ---------- 13. Whole town on the big hardware level ----------
    await lvButtons[2].click(); await sleep(200);
    const z1 = await page.evaluate(() => view().s);
    check(!(await page.$eval('#t-whole', b => b.disabled)) && (await attr('#t-whole', 'aria-pressed')) === 'false', 'L3: Whole town is available (zoomed in by default)');
    await page.click('#t-whole'); await sleep(200);
    const z2 = await page.evaluate(() => view().s);
    check((await attr('#t-whole', 'aria-pressed')) === 'true' && z2 < z1, `Whole town zooms out (square ${z1.toFixed(0)} -> ${z2.toFixed(0)} px)`);
    await page.click('#t-whole'); await sleep(100);

    // ---------- 14. the titled sections below the game, and their text ----------
    const secTitles = await page.$$eval('section.more section.sec h2', hs => hs.map(h => h.textContent.trim()));
    check(JSON.stringify(secTitles) === JSON.stringify(['How to play', 'The data', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits']),
      `six visible titled sections: ${secTitles.join(' / ')}`);
    const drawers = await page.$$('section.more details.drawer');
    let openNow = 0, toggles = 0;
    for (const d of drawers) { if (await d.evaluate(e => e.open && e.querySelector('.body').innerText.trim().length > 80)) openNow++;
      const sm = await d.$('summary'); await sm.scrollIntoViewIfNeeded(); await sm.click(); await sleep(100);
      const closed = await d.evaluate(e => !e.open); await sm.click(); await sleep(100); if (closed && await d.evaluate(e => e.open)) toggles++; }
    check(drawers.length === 3 && openNow === 3 && toggles === 3, `the ${drawers.length} long-text drawers start open, with content, and fold / unfold`);
    const more = await text('section.more');
    check(/labyrinth-v1/.test(more) && /Fabian/.test(more) && /That faint trace is what the noise remembers\./.test(more)
      && /Nothing here shows quantum advantage, and the lamp patterns are not certified randomness\./.test(more)
      && /disagrees with the plan \(orange dashes\)\./.test(more) && /Hedge thickness is \|⟨ZZ⟩\|\./.test(more), 'section text: engine, paper, level notes, honesty note and the first version\'s words are all on the page');
    check(!/bonus/i.test(await page.evaluate(() => document.body.innerText)) && (await text('.wtnr-bar .count')) === 'Challenge 05', 'no "Bonus" anywhere on the page; brand bar reads "Challenge 05"');

    // ---------- 14a. the section buttons jump to their sections ----------
    const toc = await page.$$('nav.toc button[data-go]');
    let jumped = 0;
    for (const b of toc) {
      const id = await b.getAttribute('data-go'); await b.scrollIntoViewIfNeeded(); await b.click();
      let top = 1e9; for (let w = 0; w < 30 && Math.abs(top) >= 40; w++) { await sleep(100); top = await page.$eval('#' + id, e => e.getBoundingClientRect().top); }   // smooth scroll
      if (Math.abs(top) < 40) jumped++;
    }
    check(toc.length === 6 && jumped === 6 && (await page.evaluate(() => location.hash)) === '#L1.s0.p10', `the ${toc.length} section buttons each scroll to their section (${jumped} of ${toc.length}) and leave the share token alone`);

    // ---------- 14b0. every restored graph renders: all canvases and every Figure 3 panel are drawn, not blank ----------
    const blank = await page.evaluate(() => {
      const colours = (ctx, w, h) => { const d = ctx.getImageData(0, 0, w, h).data, set = new Set(); for (let i = 0; i < d.length; i += 16) set.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]); return set.size; };
      const out = {};
      document.querySelectorAll('canvas').forEach(c => { out['#' + c.id] = c.width > 0 && c.height > 0 ? colours(c.getContext('2d'), c.width, c.height) : 0; });
      document.querySelectorAll('#minis img').forEach((im, i) => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d'); if (c.width) x.drawImage(im, 0, 0); out['Figure 3 panel ' + (i + 1)] = c.width ? colours(x, c.width, c.height) : 0; });
      document.querySelectorAll('#cmp-minis > * > img:first-child').forEach((im, i) => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const x = c.getContext('2d'); if (c.width) x.drawImage(im, 0, 0); out['Figure 4 panel ' + (i + 1)] = c.width ? colours(x, c.width, c.height) : 0; });
      out['energy bar'] = document.getElementById('h-bar').getBoundingClientRect().width > 0 ? 2 : 0;
      return out;
    });
    const drawn = Object.entries(blank), empty = drawn.filter(([, n]) => n < 2).map(([k]) => k);
    check(['#cv', '#ov-moth', '#bits', '#dmap', '#dbits', 'Figure 3 panel 1', 'Figure 3 panel 3', 'Figure 4 panel 1', 'Figure 4 panel 2', 'energy bar'].every(k => k in blank) && empty.length === 0,
      `every graph is drawn: ${drawn.map(([k, n]) => `${k} ${n} colours`).join(', ')}`);

    // ---------- 14b. The data: Figure 1 (schematic town), Figure 2 (lamp map), Figure 3 (every level) ----------
    await lvButtons[0].click(); await sleep(150);
    await page.$eval('#dmap', e => e.scrollIntoView({ block: 'center' })); await sleep(250);
    const inkCount = () => page.evaluate(() => { const d = mctx.getImageData(0, 0, dmap.width, dmap.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] < 70 && d[i + 2] > 110) n++; return n; });
    check(await inkCount() > 1000, 'Figure 1 draws the measured town in ink');
    const e3 = await page.evaluate(() => { const e = L.edges[3], a = centre(e[0]), b = centre(e[1]), v = mapGeom(), r = dmap.getBoundingClientRect();
      return { x: r.left + (v.ox + (a[0] + b[0]) / 2 * v.s) / v.dpr, y: r.top + (v.oy + (a[1] + b[1]) / 2 * v.s) / v.dpr, e }; });
    await page.mouse.move(e3.x, e3.y); await sleep(150);
    const en = await text('#dm-edge');
    check(en.includes(`qubits ${e3.e[0]} and ${e3.e[1]}`) && en.includes(Math.abs(e3.e[3]).toFixed(3)) && en.includes(e3.e[2] > 0 ? 'planned street' : 'planned hedge'),
      `pointing at an edge in Figure 1 reads its measured <ZZ> from levels.json ("${en}")`);
    await page.click('#dm-plan'); await sleep(150);
    check((await attr('#t-plan', 'aria-pressed')) === 'true' && (await attr('#dm-plan', 'aria-pressed')) === 'true', 'Plan vs measured in The data and in the panel are one switch');
    await page.click('#dm-plan'); await sleep(100);
    await page.click('#dm-next'); await sleep(150);
    check((await st()).shot === 1 && (await text('#db-num')) === (await text('#shot-num')) && (await text('#dm-level')).includes('shot 2'), 'Shot › in The data steps the shot for the game too; Figure 2 caption follows');
    const dbx = await page.evaluate(() => { const b = L.shotList[ui.shot][0], i = 7, x = (i % L.cols + .5) * BC, y = (Math.floor(i / L.cols) + .5) * BC;
      return { want: i === L.start || i === L.home ? '161,164,206' : b[i] === '1' ? '25,35,142' : '255,255,255', got: [...dbctx.getImageData(x, y, 1, 1).data].slice(0, 3).join(',') }; });
    check(dbx.want === dbx.got, `Figure 2 cell for qubit 7 is ${dbx.got} (bit from levels.json -> ${dbx.want})`);
    await page.$eval('#dbits', e => e.scrollIntoView({ block: 'center' })); await sleep(100);
    const dbb = await (await page.$('#dbits')).boundingBox();
    await page.mouse.click(dbb.x + (2.5 / L1.cols) * dbb.width, dbb.y + (1.5 / L1.rows) * dbb.height); await sleep(120);
    check((await text('#db-pick')).includes(`qubit ${pickI}`) && (await text('#pick-note')) === (await text('#db-pick')), 'clicking Figure 2 picks the same square as the panel lamp map');
    await page.keyboard.press('Escape'); await sleep(80);
    await page.click('#shot-top'); await sleep(100);
    const minis = await page.$$('#minis button');
    check(minis.length === LEVELS.length && await page.$$eval('#minis img', ims => ims.length === 3 && ims.every(i => i.naturalWidth > 50 && i.naturalHeight > 50)), `Figure 3 draws all ${LEVELS.length} levels`);
    await minis[1].scrollIntoViewIfNeeded(); await minis[1].click(); await sleep(150);
    check((await st()).li === 1 && (await attr('#minis button:nth-child(2)', 'aria-pressed')) === 'true' && (await text('#r-job')) === jobs[1].job, 'clicking Hedge Row in Figure 3 loads it in the game and readouts');
    // ---------- 14c. Figure 4: the ibm_fez level beside its labelled comparison run ----------
    const segB = await page.$$('#cmp-seg button');
    check(segB.length === COMPARE.length && COMPARE.length === 2 && (await attr('#cmp-seg button:nth-child(1)', 'aria-pressed')) === 'true', `Figure 4 has one switch per comparison run (${segB.length})`);
    const cmpT = async () => text('#cmp-table'), cmpA = async () => text('#cmp-a'), cmpB = async () => text('#cmp-b');
    for (let k = 0; k < COMPARE.length; k++) {
      const c = COMPARE[k], L = LEVELS.find(l => l.id === c.of);
      await segB[k].scrollIntoViewIfNeeded(); await segB[k].click(); await sleep(200);
      const t = await cmpT(), a = await cmpA(), b = await cmpB(), note = await text('#cmp-note');
      check((await attr(`#cmp-seg button:nth-child(${k + 1})`, 'aria-pressed')) === 'true' && t.includes(L.job) && t.includes(c.job) && (!c.ibmJob || t.includes(c.ibmJob))
        && a.includes(`${L.id} ${L.name}: IBM ibm_fez, ${L.qubits} qubits`) && a.includes(L.job.slice(0, 8))
        && b.includes('Comparison run, not a level') && b.includes(c.mode === 'qpu' ? `IBM ${c.backend}` : 'Aer emulator') && b.includes(c.job.slice(0, 8))
        && note.includes(`${c.diff} of ${c.nEdges} edges`) && params.includes(c.job) && readme.includes(c.job) && cacheText.includes(c.job),
        `Figure 4 pair ${k + 1}: ${L.name} on IBM ibm_fez (job ${L.job.slice(0, 8)}) beside the comparison run on ${c.mode === 'qpu' ? c.backend : 'the Aer emulator'} (job ${c.job.slice(0, 8)}), ${c.diff} edges differ; IDs in PARAMS.md, README and the cache`);
    }
    const srcB = await page.$eval('#cmp-b img', i => i.src);
    await page.click('#cmp-diff'); await sleep(200);
    check((await attr('#cmp-diff', 'aria-pressed')) === 'true' && (await page.$eval('#cmp-b img', i => i.src)) !== srcB && (await text('#cmp-note')).includes('marked'),
      '"Mark where the two runs disagree" redraws both panels with the disagreeing edges banded, and says so');
    await page.click('#cmp-diff'); await sleep(150);
    check((await attr('#cmp-diff', 'aria-pressed')) === 'false' && (await page.$eval('#cmp-b img', i => i.src)) === srcB, 'pressing it again clears the marks');
    await page.click('#cmp-a'); await sleep(300);
    check((await st()).li === LEVELS.findIndex(l => l.id === COMPARE[COMPARE.length - 1].of) && (await text('#r-job')) === LEVELS.find(l => l.id === COMPARE[COMPARE.length - 1].of).job,
      'pressing the ibm_fez panel in Figure 4 loads that level in the game and readouts');
    await minis[1].scrollIntoViewIfNeeded(); await minis[1].click(); await sleep(150);
    await page.$eval('#dmap', e => e.scrollIntoView({ block: 'center' })); await sleep(150);
    await page.focus('#dmap'); await page.keyboard.down('ArrowLeft'); await sleep(500); await page.keyboard.up('ArrowLeft');
    s = await st();
    check(s.state === 'fly' && s.t > 0.2 && (await page.evaluate(() => document.activeElement.id)) === 'dmap', 'with Figure 1 focused, an arrow key takes off and the keys stay on Figure 1');
    await page.click('#sec-jobs button[data-fly="0"]'); await sleep(400);
    s = await st();
    check(s.li === 0 && s.state === 'ready' && await page.evaluate(() => document.getElementById('stage').getBoundingClientRect().top < innerHeight), 'Jobs table: "L1 Lamp Lane" loads that level and brings the game into view');
    const jobsText = await text('#sec-jobs');
    check(jobs.every(j => jobsText.includes(j.job)) && LEVELS.every(L => !L.ibmJob || jobsText.includes(L.ibmJob)) && /25 of the 27-credit cap/.test(jobsText)
      && cmpJobs.every(j => jobsText.includes(j.job)) && COMPARE.every(c => !c.ibmJob || jobsText.includes(c.ibmJob)) && (jobsText.match(/Comparison/g) || []).length >= 2
      && (await page.$$('#sec-jobs button[data-fly]')).length === jobs.length,
      'Jobs and credits lists every Atlas and IBM job ID (levels and the two labelled comparison rows, which have no Fly button) and the 25-credit spend');
    await lvButtons[2].click(); await sleep(150);   // back to Night Town, where the share-link journey below starts

    // ---------- 15. copy link -> reload restores level, shot and pull ----------
    await page.evaluate(() => scrollTo(0, 0));
    for (let k2 = 0; k2 < 6; k2++) { await page.click('#shot-next'); }
    await setPull(1.5); await sleep(100);
    await page.click('#share'); await sleep(300);
    const hash = await page.evaluate(() => location.hash);
    clip = ''; try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = ''; }
    check(hash === '#L3.s6.p15' && clip.endsWith('#L3.s6.p15'), `"Copy link to this town" -> ${hash} (clipboard ${clip ? 'has it' : 'empty'})`);
    await page.reload({ waitUntil: 'networkidle' }); await sleep(500);
    s = await st();
    check(s.li === 2 && s.shot === 6 && Math.abs(s.pull - 1.5) < 1e-9 && (await attr('#levels button:nth-child(3)', 'aria-pressed')) === 'true'
      && (await text('#shot-num')).startsWith('shot 7 of 40') && (await page.inputValue('#pull')) === '1.5' && (await text('#pull-val')) === '1.5×'
      && (await text('#chip')).includes('L3') && (await text('#chip')).includes('shot 7') && (await text('#r-job')) === jobs[2].job,
      'reload with the hash restores Night Town, shot 7 and pull 1.5×');
    check((await text('#dm-level')).startsWith('L3 Night Town') && (await text('#dm-level')).includes('shot 7') && (await text('#db-num')) === (await text('#shot-num'))
      && (await attr('#minis button:nth-child(3)', 'aria-pressed')) === 'true', 'after the reload The data (Figures 1-3) shows the restored town and shot too');
    await page.screenshot({ path: path.join(__dirname, 'e2e-restored.png') });
    await page.goto(base + '#L2.s3.p5', { waitUntil: 'networkidle' }); await sleep(400);   // same document: a hashchange
    s = await st();
    check(s.li === 1 && s.shot === 3 && s.pull === .5 && (await text('#ov-title')) === 'Hedge Row' && (await page.inputValue('#pull')) === '0.5',
      'opening another shared link (#L2.s3.p5) in the already-open tab switches to Hedge Row, shot 4, pull 0.5×');
    {
      const p2 = await ctx.newPage(); await p2.addInitScript(INSTRUMENT);
      await p2.goto(base + '#L1.s5.p0', { waitUntil: 'networkidle' }); await sleep(300);
      const s2 = await p2.evaluate(() => ({ li: ui.li, shot: ui.shot, pull: ui.pull, title: document.getElementById('ov-title').textContent }));
      check(s2.li === 0 && s2.shot === 5 && s2.pull === 0 && s2.title === 'Lamp Lane', 'a cold visit to #L1.s5.p0 in a new tab opens Lamp Lane, shot 6, pull 0×');
      await p2.close();
    }

    // ---------- 16. touch pad: holding a pad button takes off and steers ----------
    await page.$eval('#p-left', e => e.scrollIntoView({ block: 'center' })); await sleep(150);   // the pad sits under the town: bring it on screen first
    const pb = await (await page.$('#p-left')).boundingBox();
    await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.mouse.down(); await sleep(400);
    s = await st(); const on = await page.$eval('#p-left', b => b.classList.contains('on'));
    await page.mouse.up(); await sleep(100);
    check(s.state === 'fly' && on, `holding "← Left" on the touch pad takes off and steers (state ${s.state}, pad on ${on}, pad at ${Math.round(pb.x)},${Math.round(pb.y)})`);
    await page.click('#pause'); await sleep(150);
    check((await st()).paused, 'corner Pause pauses the pad flight');
    const fb = await (await page.$('#p-flap')).boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.mouse.down(); await sleep(250);
    s = await st(); await page.mouse.up(); await sleep(100);
    check(s.state === 'fly' && !s.paused && (await qa()).states.includes('running'), 'pressing "Flap" on the pad while paused resumes the flight and the sound');
    await page.click('#reset'); await sleep(150);
    await page.focus('#cv'); await page.keyboard.down('ArrowRight'); await sleep(250);
    s = await st(); await page.keyboard.up('ArrowRight');
    check(s.state === 'fly' && s.t > 0, 'with the town focused, the first → key takes off (as the hint "← → steer" promises)');

    // ---------- 17. the set: brand bar, prev / hub / next ----------
    check((await attr('.wtnr-bar a', 'href')) === HUB, 'brand bar links to the hub');
    const prevA = await attr('.wtnr-nav a[rel="prev"]', 'href'), nextA = await attr('.wtnr-nav a[rel="next"]', 'href'), hubA = await attr('.wtnr-nav a.wn-hub', 'href');
    check(prevA === urls[prevSlug] && nextA === urls[nextSlug] && hubA === HUB,
      `nav: prev -> ${prevSlug} (${prevA}), hub, next -> ${nextSlug} (${nextA})`);
    const jump = await page.$$eval('.wtnr-nav ol a', as => as.map(a => ({ href: a.href, cur: a.getAttribute('aria-current') })));
    check(jump.length === order.length && jump.filter(j => j.cur === 'page').length === 1 && jump.every(j => j.href.startsWith('https://claude.ai/artifact/')), `jump list: ${jump.length} pieces, this one marked current`);
    const footY = await page.$eval('.wtnr-foot', e => e.getBoundingClientRect().top), navY = await page.$eval('.wtnr-nav', e => e.getBoundingClientRect().top);
    check(navY < footY, 'nav sits just above the footer');
    const jd = await page.$('.wtnr-nav details'), js = await page.$('.wtnr-nav summary');
    await js.scrollIntoViewIfNeeded(); await js.click(); await sleep(150);
    check(await jd.evaluate(e => e.open) && await page.$eval('.wtnr-nav ol a[aria-current="page"]', a => a.getBoundingClientRect().height > 0 && a.textContent.includes('Moth to Flame')),
      '"Jump to any piece" opens and shows this piece as the current one');

    check(errors.length === 0, `no page or console errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  } catch (e) {
    check(false, 'journey threw: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' '));
  }
  await browser.close(); srv.close();
  console.log(`\n${steps.length} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
