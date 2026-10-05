// End-to-end journey for Frog Chorus: node qa/e2e.cjs [port 6570-6579]
// Serves web/ locally (with HTTP range support, like the published host) and walks the main user journey in
// headless Chromium with real assertions: seat frogs (tap, drag from the log, drag between pads, keyboard), roll a
// measured night (from the Aer simulator, and from IBM's ibm_fez chip: the button, a tap on a row of the hardware chart
// and the keyboard), start the chorus and raise the coupling until the pond really takes turns (and, in the sync pond,
// falls into step), hear it (Web Audio sources counted by instrumentation, as common/qa/qa_page.cjs does), stop it,
// seat a frog on the pond map and pick pads on the phase circle and call raster (The data), check every titled
// section and open every drawer, play / scrub / stop a rendered clip (its chorus line and log chart both shown),
// copy a share link and reload with it to check the exact chorus comes back, and check the brand bar and the shared
// prev / hub / next nav. Writes qa/e2e.json and exits 1 on any failed check.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const SLUG = path.basename(PIECE);
const PORT = +(process.argv[2] || 6570);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const PIECEJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const JOBSJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'jobs.json'), 'utf8'));
const CAPN = +/^CAP = (\d+)/m.exec(fs.readFileSync(path.join(PIECE, 'run_qdrive.py'), 'utf8'))[1];
const HWJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'hardware.json'), 'utf8'));
const FEZ = HWJ.runs.fez;
const SLUGS = fs.readdirSync(path.join(ROOT, 'entries')).filter(s => fs.existsSync(path.join(ROOT, 'entries', s, 'piece.json'))).sort();
const at = SLUGS.indexOf(SLUG), PREV = SLUGS[(at - 1 + SLUGS.length) % SLUGS.length], NEXT = SLUGS[(at + 1) % SLUGS.length];

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.js': 'text/javascript' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = q.headers.range && /bytes=(\d*)-(\d*)/.exec(q.headers.range);
  if (m) {
    const s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': e - s + 1, 'Accept-Ranges': 'bytes' });
    return fs.createReadStream(f, { start: s, end: e }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(f).pipe(r);
});

// count every Web Audio source started and every media element that starts playing (as qa_page.cjs does)
const INSTRUMENT = () => {
  window.__qa = { sources: 0, media: 0 };
  const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
  if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const results = [];
const ok = (cond, msg) => { results.push({ ok: !!cond, msg }); console.log((cond ? 'PASS ' : 'FAIL ') + msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const base = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${PORT}` });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(String(e.message || e)));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.addInitScript(INSTRUMENT);
    await p.goto(base, { waitUntil: 'networkidle' });
    await sleep(600);
    const ev = (f, a) => p.evaluate(f, a);
    const qa = () => ev(() => ({ ...window.__qa }));
    const note = () => p.textContent('#stage-note');
    const seated = () => ev(() => st.occ.reduce((a, b) => a + b, 0));

    // ---- 1. opens quietly, on the scene, with the real numbers ----
    let q = await qa();
    ok(q.sources === 0 && q.media === 0, 'nothing sounds before the user acts (no autoplay)');
    ok(!(await p.isHidden('#scene-view')) && await p.isVisible('#pondmap') && await p.isVisible('#circle') && await p.isVisible('#raster') && await p.isVisible('#locks'),
      'opens on the illustrated pond scene, with the pond map, phase circle, call raster and lock chart in a visible section');
    ok((await p.textContent('.wtnr-bar .count')).trim() === 'Challenge 07' && /^Challenge 07/.test(await p.textContent('.kicker')) && !/bonus/i.test(await ev(() => document.body.textContent)),
      'brand bar and kicker read "Challenge 07"; no "Bonus" anywhere (all entries are equal)');
    ok(/Seat the frogs/.test(await p.textContent('h1')), 'verb-led headline is present');
    const proof = await p.textContent('#proof');
    ok(proof.includes(`${PIECEJ.qubits} qubits per pond`) && proof.includes(`${PIECEJ.jobs} real Atlas jobs`) && /Aer/.test(proof) &&
      proof.includes(`IBM ${PIECEJ.hardware} · ${PIECEJ.hardware_qubits} qubits · real hardware`),
      `proof chips match piece.json (${PIECEJ.qubits} qubits, ${PIECEJ.jobs} jobs, Aer, IBM ${PIECEJ.hardware} at ${PIECEJ.hardware_qubits} qubits): "${proof.trim()}"`);
    ok(PIECEJ.hardware === 'ibm_fez' && FEZ.backend === 'ibm_fez' && (await p.textContent('#r-hw')).startsWith(`IBM ibm_fez, ${FEZ.n} qubits, job ${FEZ.job_id}`),
      `the readout names the hardware run: "${(await p.textContent('#r-hw')).slice(0, 90)}"`);
    const job0 = await p.textContent('#r-job');
    ok(job0 === '8ece2a2c-4035-4d0c-950c-5174a228b2d4', `readout names the default pond's job (${job0})`);
    ok((await p.textContent('#sub-n')) === String(PIECEJ.qubits), 'sub names the 22-qubit circuit');
    // every graph (the restored G1-G8 and the scene) draws real marks: count canvas pixels that differ from the
    // canvas's own background (its top-left pixel), and check each log chart's SVG paths have length and extent
    const inked = sel => ev(sel => [...document.querySelectorAll(sel)].map(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 60) n++;
      return n; }), sel);
    const g0 = { scene: (await inked('#pond'))[0], map: (await inked('#pondmap'))[0], circle: (await inked('#circle'))[0], raster: (await inked('#raster'))[0],
      lines: await inked('.clip canvas.line') };
    ok(g0.scene > 20000 && g0.map > 5000 && g0.circle > 1000 && g0.raster > 500,
      `scene, pond map (G1), phase circle (G2) and call raster (G3) all draw (${g0.scene}, ${g0.map}, ${g0.circle}, ${g0.raster} inked px)`);
    const locks0 = await ev(() => [...document.querySelectorAll('#locks .lockrow')].map(r => [r.querySelector('.got').getBoundingClientRect().width, r.querySelector('.ask').getBoundingClientRect().height]));
    ok(locks0.length === 29 && locks0.every(([w, h]) => w > 0 && h > 0), `lock chart (G4) draws a bar and a tick on all ${locks0.length} edges`);
    const svgs = await ev(() => [...document.querySelectorAll('.clip .chart svg')].map(s => ({ paths: [...s.querySelectorAll('path')].map(q => q.getAttribute('d').length), w: s.getBBox().width, h: s.getBoundingClientRect().height })));
    ok(svgs.length === 4 && svgs.every(s => s.paths.length === 3 && s.paths.every(n => n > 200) && s.w > 300 && s.h > 40),
      `all 4 render log charts (G5-G8) draw their three lines (${svgs.map(s => s.paths.join('/')).join(', ')} path chars)`);
    ok(g0.lines.length === 4 && g0.lines.every(n => n > 1000), `all 4 chorus lines draw their frogs (${g0.lines.join(', ')} inked px)`);
    // the hardware charts: 20 ibm_fez nights (squares + bars) and taking turns on every hearing edge
    const hwInk = (await inked('#hwnights'))[0];
    const hwEdges = await ev(() => [...document.querySelectorAll('#hwedges .lockrow')].map(r => [r.querySelector('.got').getBoundingClientRect().width, r.querySelector('.ask').getBoundingClientRect().height]));
    ok(hwInk > 5000 && hwEdges.length === HWJ.edges.length && hwEdges.every(([w, h]) => w > 0 && h > 0),
      `the ibm_fez nights chart draws (${hwInk} inked px) and the per-edge chart has a bar and an emulator tick on all ${hwEdges.length} edges`);
    ok((await p.textContent('#hw-result')).startsWith(`IBM ibm_fez, ${FEZ.n} qubits, job ${FEZ.job_id}`) && (await p.textContent('#hw-result')).includes(FEZ.turns_mean.toFixed(2)),
      'the hardware chart is labelled "IBM ibm_fez, 20 qubits, job <id>" with its real result');

    // ---- 2. seat frogs: Lift all, tap a pad, drag from the log, drag between pads, keyboard ----
    await p.click('#clear');
    ok((await seated()) === 0 && /^0 of 22 frogs seated/.test(await note()), 'Lift all empties every pad');
    const box = await p.locator('#pond').boundingBox();
    const padXY = k => ev(k => { const [x, y] = P(k), r = $('pond').getBoundingClientRect(); return [r.left + x / geo.VW * r.width, r.top + y / geo.VH * r.height]; }, k);
    const logXY = () => ev(() => { const lb = logBox(), r = $('pond').getBoundingClientRect(); return [r.left + lb.x / geo.VW * r.width, r.top + (lb.y - 2) / geo.VH * r.height]; });
    await p.locator('#pond').scrollIntoViewIfNeeded();
    let [x, y] = await padXY(0);
    await p.mouse.click(x, y); await sleep(200);
    ok((await ev(() => st.occ[0])) === 1 && /^1 of 22/.test(await note()), 'tapping pad 0 seats a frog there');
    ok(/^pad 0: frog seated/.test(await p.textContent('#r-pad')), 'the pad readout describes the tapped pad');
    const drag = async (from, to) => { await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 5 }); await p.mouse.move(to[0], to[1], { steps: 5 }); await p.mouse.up(); await sleep(250); };
    await drag(await logXY(), await padXY(5));
    ok((await ev(() => st.occ[5])) === 1 && (await seated()) === 2, 'dragging a frog from the log onto pad 5 seats it');
    await drag(await padXY(5), await padXY(8));
    ok((await ev(() => [st.occ[5], st.occ[8]])).join() === '0,1' && (await seated()) === 2, 'dragging the frog from pad 5 to pad 8 moves it');
    await p.focus('#pond'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await sleep(150);
    const cur = await ev(() => st.cursor);
    ok((await ev(k => st.occ[k], cur)) === 1 && (await seated()) === 3, `keyboard: arrow to pad ${cur}, Enter seats it`);
    // a tap on open water (no pad, not the log) explains what to do instead of doing nothing
    const water = await ev(() => { const s = pondShape(), r = $('pond').getBoundingClientRect();
      for (let fy = -0.5; fy <= 0.5; fy += 0.1) for (let fx = -0.75; fx <= 0.75; fx += 0.05) {
        const x = s.cx + fx * s.rx, y = s.cy + fy * s.ry, ev0 = { clientX: r.left + x / geo.VW * r.width, clientY: r.top + y / geo.VH * r.height };
        let near = 1e9; for (let k = 0; k < ds().n; k++) { const [px0, py0] = P(k); near = Math.min(near, Math.hypot(px0 - x, py0 - y)); }
        if (near > 90 && !onLog(ev0)) return [ev0.clientX, ev0.clientY]; } return null; });
    const occW = await ev(() => st.occ.join(''));
    if (water) { await p.mouse.click(water[0], water[1]); await sleep(200); }
    ok(water && /Tap a lily pad to seat or lift a frog/.test(await p.textContent('#toast')) && (await ev(() => st.occ.join(''))) === occW,
      'tapping open water shows a hint and changes no pad');

    // ---- 3. roll a night measured from the engine's state ----
    await p.click('#night'); await sleep(200);
    const night = await ev(() => ({ n: st.night, occ: st.occ.join(''), bits: ds().nights[st.night], toast: $('toast').textContent, txt: $('r-night').textContent }));
    ok(night.occ === night.bits && /^Measured shot #/.test(night.toast) && night.txt.includes(`#${night.n + 1} of 1024`),
      `Roll a measured night seats exactly measured shot #${night.n + 1} (${night.bits})`);

    // ---- 3b. nights measured on IBM's ibm_fez chip: the button, a row of the chart, the keyboard ----
    await p.click('#hwnight'); await sleep(250);
    const hw1 = await ev(() => ({ n: ds().n, occ: st.occ.join(''), i: st.hwNight, src: st.nightSrc, night: $('r-night').textContent, toast: $('toast').textContent, size: document.querySelector('[data-size="20"]').getAttribute('aria-pressed') }));
    ok(hw1.n === 20 && hw1.src === 'fez' && hw1.occ === FEZ.nights[hw1.i] && hw1.size === 'true' && hw1.night.startsWith(`IBM ibm_fez night #${hw1.i + 1} of 20`) && /^IBM ibm_fez night #/.test(hw1.toast),
      `Roll an ibm_fez night switches to the 20-frog pond and seats exactly hardware shot #${hw1.i + 1} (${FEZ.nights[hw1.i]})`);
    await p.locator('#hwnights').scrollIntoViewIfNeeded(); await sleep(200);
    const row = hw1.i === 6 ? 2 : 6;
    const rowXY = await ev(row => { const r = $('hwnights').getBoundingClientRect(); return [r.left + r.width * 0.3, r.top + r.height * (HWL.top + HWL.row * (row + 0.5)) / $('hwnights').height]; }, row);
    await p.mouse.click(rowXY[0], rowXY[1]); await sleep(250);
    const hw2 = await ev(() => ({ occ: st.occ.join(''), i: st.hwNight, pick: $('hw-pick').textContent }));
    ok(hw2.i === row && hw2.occ === FEZ.nights[row] && hw2.pick.startsWith(`Night #${row + 1} of 20 on IBM ibm_fez`) && /seated in the pond above/.test(hw2.pick),
      `tapping row ${row + 1} of the ibm_fez chart seats that night (${hw2.pick.slice(0, 70)})`);
    await p.focus('#hwnights'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await sleep(250);
    ok((await ev(() => st.hwNight)) === row + 1 && (await ev(() => st.occ.join(''))) === FEZ.nights[row + 1], 'keyboard on the ibm_fez chart: ArrowDown + Enter seats the next night');
    await p.locator('#pond').scrollIntoViewIfNeeded();
    await p.click('[data-size="22"]'); await sleep(150);
    ok((await ev(() => st.nightSrc)) === 'aer' && /\(Aer simulator\)/.test(await p.textContent('#r-night')), 'back to 22 frogs, the seated night is an Aer-simulator shot again and says so');

    // ---- 4. the chorus: seat all, start, raise coupling, the pond learns to take turns; hear it; stop ----
    await p.click('#fill'); await sleep(100);
    ok((await seated()) === 22, 'Seat all seats every pad');
    const k = p.locator('#k'); await k.focus(); await p.keyboard.press('Home');
    for (let i = 0; i < 80; i++) await p.keyboard.press('ArrowRight');
    ok((await p.inputValue('#k')) === '8' && /^8\.0 rad\/s/.test(await p.textContent('#k-out')), 'coupling slider set to 8.0 rad/s by keyboard');
    q = await qa();
    const circBefore = await ev(() => $('circle').toDataURL());
    await p.click('#go'); await sleep(1200);
    ok((await p.textContent('#go')) === 'Stop the chorus' && (await p.getAttribute('#go', 'aria-pressed')) === 'true', 'Start the chorus flips to Stop the chorus');
    const q2 = await qa();
    ok(q2.sources > q.sources + 5, `sound started: ${q2.sources - q.sources} croaks scheduled on the Web Audio clock`);
    await sleep(5500);
    const altRun = await ev(() => ({ simT: st.simT, calls: events.length, R: +$('n-r').textContent, turns: +$('n-t').textContent, lock: $('n-l').textContent, puff: st.lastCall.filter(t => t > 0).length }));
    ok(altRun.simT > 5 && altRun.calls > 50 && altRun.puff === 22, `every frog calls (${altRun.calls} calls in ${altRun.simT.toFixed(1)} s)`);
    ok(altRun.turns > 0.6 && altRun.R < 0.3, `alternating pond, engine locks, K 8: the pond takes turns (taking turns ${altRun.turns}, in step ${altRun.R}; the WAV ends at 0.73 / 0.05)`);
    const spread = parseFloat(altRun.lock.replace(/[^0-9.]/g, ''));
    ok(spread < 0.05, `the rhythm locks (${altRun.lock})`);
    // the live charts follow the running chorus: the raster fills with call marks (ink / light-ink ticks only come
    // from calls) and the phase circle shows every seated frog's dot plus the average arrow
    await p.locator('#raster').scrollIntoViewIfNeeded(); await sleep(400);
    const live = await ev(() => { const d = $('raster').getContext('2d').getImageData(0, 0, $('raster').width, $('raster').height).data; let marks = 0;
      for (let i = 0; i < d.length; i += 4) if ((d[i] === 25 && d[i + 1] === 35 && d[i + 2] === 142) || (d[i] === 161 && d[i + 1] === 164 && d[i + 2] === 206)) marks++;
      return { marks, events: events.length }; });
    const circ1 = (await inked('#circle'))[0], circMoved = (await ev(() => $('circle').toDataURL())) !== circBefore;
    ok(live.events > 50 && live.marks > 3000 && circ1 > 1000 && circMoved,
      `while the chorus runs the call raster draws ${live.events} calls (${live.marks} px of call marks) and the phase circle redraws the moving phases (${circ1} px)`);
    await p.locator('#pond').scrollIntoViewIfNeeded();
    // compare: the sync pond with the couplings we asked for falls into step
    await p.click('[data-mode="sync"]'); await p.click('[data-src="asked"]');
    ok((await p.textContent('#r-job')) === '85baf230-d490-48fe-9825-86ea5f1015b6' && /asked-for locks/.test(await note()), 'Sync pond + We asked for: readout switches job and locks');
    await sleep(5000);
    const syncRun = await ev(() => ({ R: +$('n-r').textContent, turns: +$('n-t').textContent }));
    ok(syncRun.R > 0.9, `sync pond, asked-for locks: the frogs fall into step (in step ${syncRun.R})`);
    await p.click('#go'); await sleep(300);
    const qs = (await qa()).sources; await sleep(900);
    ok((await p.textContent('#go')) === 'Start the chorus' && !(await ev(() => st.running)) && (await qa()).sources === qs, 'Stop the chorus stops the sound');
    // keyboard S starts and stops too
    await p.focus('#pond'); await p.keyboard.press('s'); await sleep(300);
    const sOn = await ev(() => st.running); await p.keyboard.press('s'); await sleep(200);
    ok(sOn && !(await ev(() => st.running)), 'the S key starts and stops the chorus');
    // Reset phases puts every frog back at its engine phase
    await p.click('#reset'); await sleep(150);
    ok(await ev(() => st.theta.every((t, i) => Math.abs(t - ds().frogs[i].az * Math.PI / 180) < 1e-12) && events.length === 0) && /Phases reset/.test(await p.textContent('#toast')),
      'Reset phases restores the engine starting phases and says so');
    // Volume
    await p.focus('#vol'); await p.keyboard.press('Home'); await sleep(100);
    ok((await p.textContent('#vol-out')) === '0 %' && (await ev(() => master && master.gain.value)) === 0, 'Volume slider at 0 mutes the master gain');
    await p.keyboard.press('End');
    // pond size
    await p.click('[data-size="20"]'); await sleep(150);
    ok((await ev(() => ds().name)) === 'sync20' && /^20 pads = 20 qubits/.test(await p.textContent('#r-pond')), '20 frogs switches to the 20-qubit pond');
    await p.click('[data-size="22"]'); await p.click('[data-mode="alt"]');
    const askedEdge = await ev(() => couplings(ds(), st.src)[0][2]);
    await p.click('[data-src="engine"]'); await sleep(150);
    const eng = await ev(() => ({ A: couplings(ds(), st.src)[0][2], L: ds().edges[0].L, got: $('r-got').textContent, pressed: document.querySelector('[data-src="engine"]').getAttribute('aria-pressed') }));
    ok(askedEdge === -1.4 && eng.A === eng.L && eng.A !== askedEdge && /using: delivered locks/.test(eng.got) && /engine locks$/.test(await note()) && eng.pressed === 'true',
      `Engine delivered (after We asked for) switches the threads back to the engine's locks (edge 0: ${askedEdge} asked -> ${eng.A.toFixed(3)} delivered)`);

    // ---- 5. Scene / Data, and picking a pad in the data view ----
    await p.click('.legend [data-jump="data"]'); await sleep(900);
    ok(await ev(() => { const r = $('data').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'Live charts scrolls to The data');
    // the pond map (the earlier pond diagram) seats and lifts frogs too, and shares the pad readout
    const mapXY = k => ev(k => { const [x, y] = PM(k), r = $('pondmap').getBoundingClientRect(); return [r.left + x / MW * r.width, r.top + y / MH * r.height]; }, k);
    await p.locator('#pondmap').scrollIntoViewIfNeeded();
    const occ2 = await ev(() => st.occ[2]);
    [x, y] = await mapXY(2); await p.mouse.click(x, y); await sleep(200);
    ok((await ev(() => st.occ[2])) === 1 - occ2 && /^pad 2:/.test(await p.textContent('#r-pad')), 'tapping pad 2 on the pond map seats or lifts that frog and shows its readout');
    await p.mouse.click(x, y); await sleep(200);
    ok((await ev(() => st.occ[2])) === occ2, 'tapping it again undoes it');
    await p.locator('#raster').scrollIntoViewIfNeeded();
    const rb = await p.locator('#raster').boundingBox();
    await p.mouse.click(rb.x + rb.width * 0.5, rb.y + rb.height * (7.5 / 22)); await sleep(150);
    ok((await ev(() => st.pick)) === 7 && /^pad 7:/.test(await p.textContent('#r-pad')), 'tapping raster row 7 picks pad 7 and shows its readout');
    await p.locator('#circle').scrollIntoViewIfNeeded();
    for (let i = 0, last = ''; i < 20; i++) { await sleep(120); const b = JSON.stringify(await p.locator('#circle').boundingBox()); if (b === last) break; last = b; }
    const cb = await p.locator('#circle').boundingBox();
    await p.mouse.click(cb.x + cb.width * 0.5, cb.y + cb.height * 0.08); await sleep(150);
    const picked = await ev(() => st.pick);
    // independent check: the click points straight up (phase 0), so the pick must be a seated frog whose phase is nearest 0
    const nearest = await ev(() => { const g = st.theta.map((t, i) => { const m = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return st.occ[i] ? Math.min(m, 2 * Math.PI - m) : 9; }), best = Math.min(...g); return g.map((v, i) => v <= best + 0.06 ? i : -1).filter(i => i >= 0); });
    ok(nearest.includes(picked) && /^pad \d+:/.test(await p.textContent('#r-pad')), `tapping the top of the phase circle picks the frog nearest phase 0 (pad ${picked}; candidates ${nearest})`);
    await p.focus('#raster'); await p.keyboard.press('ArrowDown'); await sleep(100);
    ok((await ev(() => st.pick)) === (picked + 1) % 22, 'arrow keys move the pick in the data view');

    // ---- 6. the science drawers ----
    const titles = await ev(() => [...document.querySelectorAll('section.sec > .ink-bar span:first-child')].map(e => e.textContent));
    ok(['How to play', 'The data', 'Hear the rendered choruses', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits'].every(t => titles.includes(t)),
      `every titled section is on the page: ${titles.join(', ')}`);
    ok((await p.locator('#jobs-rows tr').count()) === JOBSJ.length && (await p.textContent('#jobs-lead')).includes(`${PIECEJ.credits_spent} credits of the ${CAPN}-credit cap`) &&
      (await p.textContent('#jobs-rows')).includes(FEZ.job_id) && /ran on IBM's ibm_fez chip/.test(await p.textContent('#jobs-lead')),
      `Jobs and credits lists all ${JOBSJ.length} ledgered jobs (the ibm_fez one included) and the spend (${PIECEJ.credits_spent} of ${CAPN})`);
    const drawers = p.locator('section.more details.drawer');
    const nd = await drawers.count();
    for (let i = 0; i < nd; i++) await drawers.nth(i).locator('summary').click();
    const open = await ev(() => [...document.querySelectorAll('section.more details.drawer')].map(d => d.open && d.querySelector('.body').getBoundingClientRect().height > 20));
    ok(nd === 4 && open.every(Boolean), `all ${nd} drawers (How it was made, The science) open and show their text`);
    ok((await p.textContent('#hw-how')).includes(FEZ.job_id) && (await p.textContent('#hw-caution')).length > 100 && (await p.textContent('#hw-note')).includes('ibm_fez'),
      'the ibm_fez drawer and honesty note are filled from the real run');
    // the "On this page" jump buttons each bring their section into view without touching the URL fragment
    const jumps = await ev(() => [...document.querySelectorAll('.toc [data-jump]')].map(b => b.dataset.jump));
    const reached = [];
    for (const id of jumps) {
      await p.click(`.toc [data-jump="${id}"]`); await sleep(1100);
      const r = await ev(id => { const t = document.getElementById(id).getBoundingClientRect(); return { top: t.top, bottom: t.bottom, hash: location.hash }; }, id);
      if (r.top < 900 && r.bottom > 0 && r.hash === '') reached.push(id);
      await p.evaluate(() => scrollTo(0, 0)); await sleep(150);
    }
    ok(jumps.length === 7 && reached.length === jumps.length, `all ${jumps.length} "On this page" buttons scroll to their section (${reached.join(', ')}), hash untouched`);
    ok((await p.textContent('#eng-result')).includes('8ece2a2c-4035-4d0c-950c-5174a228b2d4') && (await p.locator('#locks .lockrow').count()) === 29,
      'The data names the job and charts all 29 locks');

    // ---- 7. a rendered clip: play, hear, scrub, stop; the chart view ----
    const clip = p.locator('.clip').first();
    const m0 = (await qa()).media;
    await clip.locator('button', { hasText: 'Play' }).click(); await sleep(1800);
    const cl = await ev(() => { const a = document.querySelector('.clip audio'); return { t: a.currentTime, paused: a.paused, label: document.querySelector('.clip .btn').textContent }; });
    ok(!cl.paused && cl.t > 0.5 && cl.label === 'Pause' && (await qa()).media > m0, `Play plays the alt22 engine render on the page (at ${cl.t.toFixed(1)} s)`);
    const sc = clip.locator('input[type=range]'); await sc.focus();
    for (let i = 0; i < 100; i++) await p.keyboard.press('ArrowRight');
    await sleep(500);
    const after = await ev(() => document.querySelector('.clip audio').currentTime);
    ok(after > 9, `scrubbing jumps the playing clip (now at ${after.toFixed(1)} s)`);
    await clip.locator('button', { hasText: 'Stop' }).click(); await sleep(200);
    const st2 = await ev(() => { const a = document.querySelector('.clip audio'); return { t: a.currentTime, paused: a.paused, label: document.querySelector('.clip .btn').textContent, time: document.querySelector('.clip .time').textContent }; });
    ok(st2.paused && st2.t === 0 && st2.label === 'Play' && /^0:00/.test(st2.time), 'Stop pauses and rewinds the clip');
    // scrub a clip that has not loaded yet: the chorus line and readout jump straight away
    const c3 = p.locator('.clip').nth(2), s3 = c3.locator('input[type=range]');
    const line0 = await c3.locator('canvas.line').evaluate(c => c.toDataURL());
    await s3.focus();
    for (let i = 0; i < 150; i++) await p.keyboard.press('ArrowRight');
    await sleep(600);
    // independent check of the puffs: frogs whose last call in the replayed render is under 0.2 s before the scrubbed time
    const sc3 = await ev(() => { const c = clips[2], t = c.pos(); return { t, puffing: c.calls ? c.calls.filter(a => { const d = t - lastBefore(a, t); return d >= 0 && d < 0.2; }).length : 0 }; });
    const line1 = await c3.locator('canvas.line').evaluate(c => c.toDataURL());
    ok(/^at 0:15/.test(await c3.locator('.now').textContent()) && Math.abs(sc3.t - 15) < 0.01 && sc3.puffing > 0 && line1 !== line0,
      `scrubbing an unplayed clip moves its chorus line (${sc3.puffing} throats puffing at ${sc3.t.toFixed(1)} s) and readout (${(await c3.locator('.now').textContent()).slice(0, 60)})`);
    // every clip's scrubber works when moved anywhere but back to 0 (the dead-control scan moves each one to the end
    // and back to 0, where it started, so it flags some of them; this confirms those flags are false positives)
    const scrubbed = [];
    for (let i = 0; i < 4; i++) {
      const c = p.locator('.clip').nth(i), s = c.locator('input[type=range]');
      await s.focus(); await p.keyboard.press('Home');
      for (let j = 0; j < 100; j++) await p.keyboard.press('ArrowRight');
      await sleep(300);
      const r = await ev(i => ({ t: clips[i].pos(), now: document.querySelectorAll('.clip .now')[i].textContent, time: document.querySelectorAll('.clip .time')[i].textContent,
        head: +document.querySelectorAll('.clip .chart .head')[i].getAttribute('x1') }), i);
      if (Math.abs(r.t - 10) < 0.01 && /^at 0:10/.test(r.now) && /^0:10 \//.test(r.time) && r.head > 200) scrubbed.push(i);
      await p.keyboard.press('Home'); await sleep(100);
    }
    ok(scrubbed.length === 4, `all 4 clip scrubbers move their time, chorus-line readout and log-chart playhead to 0:10 (clips ${scrubbed.join(', ')})`);
    // tapping a chorus line plays its clip, tapping it again pauses it
    const c2 = p.locator('.clip').nth(1);
    await c2.locator('canvas.line').click(); await sleep(900);
    const lp = await ev(() => { const a = document.querySelectorAll('.clip audio')[1]; return { paused: a.paused, t: a.currentTime, label: document.querySelectorAll('.clip .ctl .btn')[2].textContent }; });
    await c2.locator('canvas.line').click(); await sleep(200);
    ok(!lp.paused && lp.t > 0 && lp.label === 'Pause' && await ev(() => document.querySelectorAll('.clip audio')[1].paused), 'tapping a chorus line plays its clip, and tapping again pauses it');
    await c2.locator('button', { hasText: 'Stop' }).click();
    const shown = await ev(() => [...document.querySelectorAll('.clip')].map(c => [c.querySelector('.linebox'), c.querySelector('.chart svg')].every(e => e && e.getBoundingClientRect().height > 10)));
    ok(shown.length === 4 && shown.every(Boolean), 'every clip shows both its chorus line and its log chart');
    // starting the live chorus stops a playing clip (they never talk over each other)
    await clip.locator('button', { hasText: 'Play' }).click(); await sleep(700);
    await p.click('#go'); await sleep(400);
    ok(await ev(() => document.querySelector('.clip audio').paused) && await ev(() => st.running), 'starting the chorus pauses a playing clip');
    await p.click('#go');

    // ---- 8. the hero frog croaks ----
    const qm = (await qa()).sources; await p.click('#mascot'); await sleep(300);
    ok((await qa()).sources === qm + 1, 'tapping the frog by the headline croaks once');

    // ---- 9. share link: copy, reload with the hash, the same chorus comes back ----
    await p.click('[data-mode="sync"]'); await p.click('[data-src="asked"]');
    for (const [id, keys] of [['#k', 65], ['#tempo', 16], ['#spread', 9]]) { await p.focus(id); await p.keyboard.press('Home'); for (let i = 0; i < keys; i++) await p.keyboard.press('ArrowRight'); }
    await p.locator('#pond').scrollIntoViewIfNeeded();
    [x, y] = await padXY(3); await p.mouse.click(x, y); await sleep(150);
    const want = await ev(() => ({ ds: ds().name, src: st.src, K: $('k').value, f0: $('tempo').value, sp: $('spread').value, occ: st.occ.join(''), night: st.night }));
    await p.click('#share'); await sleep(300);
    const hash = await ev(() => location.hash);
    ok(/^#v1\.sync22\.asked\.k65\.t26\.s9\.n\d+\.o[0-9a-f]+$/.test(hash), `share writes the chorus into the URL fragment (${hash})`);
    const clipText = await ev(() => navigator.clipboard.readText()).catch(() => '');
    ok(clipText === base + hash && /Link copied/.test(await p.textContent('#toast')), 'the copied link is the page URL with that fragment');
    const p2 = await ctx.newPage();
    p2.on('pageerror', e => errors.push(String(e.message || e)));
    await p2.goto(base + hash, { waitUntil: 'networkidle' }); await sleep(500);
    const got = await p2.evaluate(() => ({ ds: ds().name, src: st.src, K: $('k').value, f0: $('tempo').value, sp: $('spread').value, occ: st.occ.join(''), night: st.night,
      pm: document.querySelector('[data-mode="sync"]').getAttribute('aria-pressed'), ps: document.querySelector('[data-src="asked"]').getAttribute('aria-pressed'), note: $('stage-note').textContent }));
    ok(got.ds === want.ds && got.src === want.src && got.K === want.K && got.f0 === want.f0 && got.sp === want.sp && got.night === want.night,
      `reloading the link restores pond ${got.ds}, ${got.src} locks, K ${got.K}, tempo ${got.f0}, individuality ${got.sp}, night ${got.night}`);
    ok(got.occ === want.occ && got.pm === 'true' && got.ps === 'true' && got.note.startsWith(`${want.occ.split('').filter(c => c === '1').length} of 22`),
      'the restored page shows the same seated frogs and pressed toggles');
    await p2.close();
    // a shared ibm_fez night comes back as that hardware night
    await p.click('#hwnight'); await sleep(200);
    const hwWant = await ev(() => ({ i: st.hwNight, occ: st.occ.join('') }));
    await p.click('#share'); await sleep(300);
    const hhash = await ev(() => location.hash);
    ok(new RegExp(`\\.h${hwWant.i}$`).test(hhash), `sharing an ibm_fez night writes its index into the link (${hhash})`);
    const p3 = await ctx.newPage(); p3.on('pageerror', e => errors.push(String(e.message || e)));
    await p3.goto(base + hhash, { waitUntil: 'networkidle' }); await sleep(500);
    const hwGot = await p3.evaluate(() => ({ src: st.nightSrc, i: st.hwNight, occ: st.occ.join(''), n: ds().n, night: $('r-night').textContent }));
    ok(hwGot.src === 'fez' && hwGot.i === hwWant.i && hwGot.occ === hwWant.occ && hwGot.n === 20 && hwGot.night.startsWith(`IBM ibm_fez night #${hwWant.i + 1}`),
      `reloading it restores ibm_fez night #${hwWant.i + 1} in the 20-frog pond`);
    await p3.close();

    // ---- 10. connected to the set: brand bar, prev / hub / next, jump list ----
    ok((await p.getAttribute('.wtnr-bar a', 'href')) === HUB, 'brand bar links to the hub');
    const nav = await ev(() => ({ prev: document.querySelector('.wtnr-nav a[rel=prev]')?.href, next: document.querySelector('.wtnr-nav a[rel=next]')?.href,
      hub: document.querySelector('.wtnr-nav a.wn-hub')?.href, all: [...document.querySelectorAll('.wtnr-nav ol a')].map(a => a.href),
      cur: document.querySelector('.wtnr-nav ol a[aria-current=page]')?.href, foot: !!document.querySelector('.wtnr-nav + .wtnr-foot') }));
    ok(nav.prev === URLS[PREV] && nav.next === URLS[NEXT], `prev links ${PREV}, next links ${NEXT}`);
    ok(nav.hub === HUB && nav.all.length === SLUGS.length && nav.all.every(u => u.startsWith('https://claude.ai/artifact/')), `hub link and a jump list of all ${nav.all.length} pieces`);
    ok(nav.cur === URLS[SLUG] && nav.foot, 'this piece is marked current, and the nav sits just before the footer');
    await p.click('.wtnr-nav summary'); await sleep(200);
    ok(await ev(() => { const d = document.querySelector('.wtnr-nav details'); return d.open && [...d.querySelectorAll('ol a')].every(a => a.getBoundingClientRect().height > 0); }),
      'the "Jump to any piece" list opens and shows every piece');

    // ---- 11. phone width: no sideways scroll, the pond still seats frogs ----
    const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await mctx.newPage(); mp.on('pageerror', e => errors.push(String(e.message || e)));
    await mp.goto(base, { waitUntil: 'networkidle' }); await sleep(500);
    ok((await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, 'no horizontal scroll at 375 px');
    ok(await mp.evaluate(() => geo.portrait), 'the pond turns portrait on a phone');
    await mp.click('#clear');
    await mp.locator('#pond').scrollIntoViewIfNeeded();
    const mxy = await mp.evaluate(() => { const [x, y] = P(4), r = $('pond').getBoundingClientRect(); return [r.left + x / geo.VW * r.width, r.top + y / geo.VH * r.height]; });
    await mp.mouse.click(mxy[0], mxy[1]); await sleep(200);
    ok((await mp.evaluate(() => st.occ[4])) === 1, 'tapping a pad on a phone seats a frog');
    await mp.locator('#hwnights').scrollIntoViewIfNeeded(); await sleep(300);
    const mrow = await mp.evaluate(() => { const r = $('hwnights').getBoundingClientRect(); return { h: r.height / HW.runs.fez.shots * HWL.row / ($('hwnights').height / HW.runs.fez.shots), rowPx: r.height * HWL.row / $('hwnights').height,
      xy: [r.left + r.width * 0.3, r.top + r.height * (HWL.top + HWL.row * 4.5) / $('hwnights').height] }; });
    await mp.mouse.click(mrow.xy[0], mrow.xy[1]); await sleep(250);
    ok(mrow.rowPx >= 12 && (await mp.evaluate(() => st.hwNight)) === 4 && (await mp.evaluate(() => ds().n)) === 20,
      `on a phone each ibm_fez night is ${mrow.rowPx.toFixed(1)} px tall and tapping night #5 seats it`);
    await mctx.close();

    ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  } catch (e) {
    ok(false, 'journey threw: ' + String(e.stack || e).slice(0, 400));
  }
  const pass = results.every(r => r.ok);
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify({ piece: SLUG, ok: pass, passed: results.filter(r => r.ok).length, total: results.length, results, errors }, null, 1));
  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
  await browser.close(); server.close();
  process.exit(pass ? 0 : 1);
})();
