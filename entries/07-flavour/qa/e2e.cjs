// End-to-end journey for FLAVOUR: node entries/07-flavour/qa/e2e.cjs [port 6210-6219]
// Serves web/ locally (with HTTP byte ranges, as a real web host does, so the demo players can seek) and walks the
// main journey in headless Chromium with real mouse and keyboard input:
//   load (silent; brand bar to the hub; proof chips match piece.json) -> every source and energy (one-energy sources
//   show a plain label, not a dead button) -> drag the neutrino along its baseline -> Start the synth -> hold a
//   photomultiplier key: sound starts and one neutrino is detected -> click the detector until a Cherenkov ring
//   lights -> Detect x100 until the tally matches the curves -> swap chips (from another chip back to ibm_fez), Mix,
//   Flight (a held note flies outward), the L/E knob, the drone -> both restored graphs render (the curves and the
//   meters' waveforms) and the plate's figures are drawn -> drag and arrow-key the curves (the plate follows; leaving
//   the reactor's range switches source) -> click a waveform to hear that oscillator alone -> Stop all sound -> each
//   demo plays and stops, a scrub then play starts there, a cue jumps to its machine -> every drawer and section
//   opens, the earlier words are in place -> the job table matches PARAMS.md and puts a chip on the synth -> Copy link
//   to this sound, reload with the hash: chip, source, energy, L/E, mix, model and flight restored -> prev / hub /
//   next nav -> phone width with no overflow -> no page errors, no external requests beyond Google Fonts.
// Exits 1 and prints the failed assertion if anything breaks. Writes qa/e2e.json (and qa/e2e-fail.png on failure).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6210);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const PJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const PARAMS = fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8');
const BUNDLE = JSON.parse(fs.readFileSync(path.join(PIECE, 'plugin', 'Resources', 'flavour_curves.json'), 'utf8'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', size = fs.statSync(f).size, m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) { const s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], size - 1) : size - 1; r.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': e - s + 1 }); return fs.createReadStream(f, { start: s, end: e }).pipe(r); }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
});

// the same audio instrumentation as common/qa/qa_page.cjs: count every Web Audio source that starts, and media 'playing'
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
function ok(cond, msg, detail) { if (!cond) { const e = new Error('ASSERTION FAILED: ' + msg + (detail !== undefined ? ' | ' + JSON.stringify(detail) : '')); e.assert = true; throw e; } }
function step(name) { steps.push(name); console.log('ok  ' + name); }

(async () => {
  await new Promise(r => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` }); } catch (e) { /* older chromium */ }
  const p = await ctx.newPage();
  const errors = [], external = new Set();
  const watch = pg => {
    pg.on('pageerror', e => errors.push(String(e.message || e)));
    pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    pg.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  };
  watch(p);
  await p.addInitScript(INSTRUMENT);
  let result = { ok: false };
  const S = (fn, arg) => p.evaluate(fn, arg);
  const snd = () => S(() => window.__qa.sources);
  const tallyN = () => S(() => tally.n[0] + tally.n[1] + tally.n[2]);
  const live = () => S(() => voices.filter(v => !v.rel).length);
  const toastText = () => p.textContent('#toast');
  // a graph "renders" when its canvas holds real marks: several colours and a share of pixels unlike the corner (background)
  const canvasInk = sel => S(s => {
    const c = document.querySelector(s), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    const bg = d.slice(0, 4).join(), cols = new Set(); let ink = 0, alpha = 0;
    for (let i = 0; i < d.length; i += 16) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]; cols.add(k); if (k !== bg) ink++; if (d[i + 3]) alpha++; }
    return { w: c.width, h: c.height, colours: cols.size, inkShare: ink / (d.length / 16), alpha };
  }, sel);
  const plotSig = () => S(() => { const c = $('plot'); return c.toDataURL().length + ':' + c.toDataURL().slice(-400); });
  async function center(sel) { await p.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150); return p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); }
  async function plateXY(fn) {   // plate coordinates -> viewport, after scrolling the plate into view
    await p.evaluate(() => window.scrollTo(0, PL.svg.getBoundingClientRect().top + scrollY - 20)); await p.waitForTimeout(120);
    return p.evaluate(fn);
  }
  async function hold(x, y, ms) { await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); }

  try {
    // 1. load: brand bar, proof chips that match piece.json, nothing sounding
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    ok((await p.title()) === 'FLAVOUR', 'page title', await p.title());
    ok((await p.getAttribute('.wtnr-bar a', 'href')) === HUB, 'brand bar links the hub');
    ok((await p.textContent('.wtnr-bar .count')).includes('Challenge 07'), 'brand bar reads Challenge 07');
    const proof = (await p.textContent('#proof')).replace(/\s+/g, ' ');
    const aer = BUNDLE.machines.find(m => m.id === 'aer'), hw = BUNDLE.machines.find(m => m.kind === 'qpu');
    ok(proof.includes(`${aer.values}-value curves`) && proof.includes(`${PJ.qubits} qubits by the QPIXL rule`), 'proof chips: values and qubits match piece.json', proof);
    ok(proof.includes(`${PJ.hardware} real hardware`) && proof.includes(`${hw.values} values`), 'proof chips: hardware backend matches piece.json', proof);
    ok(proof.includes(`${PJ.jobs} completed Atlas jobs`) && proof.includes(`${BUNDLE.machines.filter(m => m.kind === 'emu').length} IBM noise models`), 'proof chips: job count matches piece.json', proof);
    ok(await snd() === 0 && await S(() => window.__qa.media) === 0, 'no sound before any user action');
    ok((await p.textContent('#bar-state')).trim() === 'Silent', 'synth bar says Silent');
    step(`loaded: hub link, proof chips (${PJ.qubits} qubits, ${PJ.hardware}, ${PJ.jobs} jobs) match piece.json, silent`);

    // 2. sources and energies: two-energy sources offer two buttons; one-energy sources show a plain label
    await p.click('#src-seg [data-src="2"]'); await p.click('#e-seg [data-e="1"]');
    ok(await S(() => st.src === 2 && st.ei === 1) && (await p.getAttribute('#e-seg [data-e="1"]', 'aria-pressed')) === 'true', 'atmosphere at 5 GeV selected');
    ok((await p.$$('#e-seg button')).length === 2, 'atmosphere offers two energies');
    await p.click('#src-seg [data-src="0"]');
    ok((await p.$$('#e-seg button')).length === 0 && (await p.textContent('#e-seg .e-only')).includes('4 MeV'), 'reactor shows its one energy as a label, not a button');
    ok((await p.textContent('#readout')).includes('CPT check') && await p.isVisible('#chipnote'), 'reactor: CPT readout and the classical-curves note');
    ok(await S(() => Math.abs(leOf(st.u) * eOf(st) - 52.5) < 0.01), 'reactor starts at JUNO, 52.5 km');
    await p.click('#src-seg [data-src="3"]');
    ok((await p.textContent('#e-seg .e-only')).includes('10 MeV') && await S(() => st.u === U1), 'the Sun: one energy label, fixed at 1 AU');
    await p.click('#src-seg [data-src="1"]');
    ok(await S(() => st.src === 1 && st.ei === 0 && Math.abs(leOf(st.u) * eOf(st) - 295) < 0.5) && (await p.$$('#e-seg button')).length === 2, 'accelerator at T2K, 295 km, two energies');
    step('sources: atmosphere 5 GeV, reactor (4 MeV label, CPT readout), Sun (10 MeV label), accelerator at T2K 295 km');

    // 3. drag the neutrino along its real baseline on the plate
    const J = await plateXY(() => { window.scrollTo(0, PL.svg.getBoundingClientRect().top + scrollY + PL.J.y - 40); const r = PL.svg.getBoundingClientRect(), A = jAxis(), k = r.width / PL.W; return { x0: r.left + A.x0 * k, x1: r.left + A.x1 * k, y: r.top + (A.yb - 20) * k }; });
    const J2 = await S(() => { const r = PL.svg.getBoundingClientRect(), A = jAxis(), k = r.width / PL.W; return { x0: r.left + A.x0 * k, x1: r.left + A.x1 * k, y: r.top + (A.yb - 20) * k }; });
    await p.mouse.move(J2.x0 + (J2.x1 - J2.x0) * 0.3, J2.y); await p.mouse.down(); await p.mouse.move(J2.x0 + (J2.x1 - J2.x0) * 0.8, J2.y, { steps: 8 }); await p.mouse.up();
    const Ldrag = await S(() => leOf(st.u) * eOf(st));
    ok(Ldrag > 300 && Ldrag < 1300, 'journey drag moved the neutrino along the beamline', { Ldrag, J });
    ok((await p.textContent('#le-line')).includes(Math.round(Ldrag).toLocaleString('en-US')), 'plate readout follows the drag');
    ok(await S(() => document.querySelectorAll('#j-dyn path').length >= 3), 'flavour bands drawn along the journey');
    await p.focus('#scene'); await p.keyboard.press('Home');
    ok(await S(() => Math.abs(st.u - srcRange(st.src, st.ei)[0]) < 1e-9), 'Home key: start of the baseline');
    for (let i = 0; i < 3; i++) await p.keyboard.press('Shift+ArrowRight');
    ok(await S(() => st.u > srcRange(st.src, st.ei)[0]), 'arrow keys move the neutrino');
    step(`dragged the neutrino to L = ${Math.round(Ldrag)} km; Home and Shift+arrows move it too`);

    // 4. Start the synth, then hold a photomultiplier key: sound starts, one neutrino is detected
    await p.click('#start-btn');
    ok(await p.isHidden('#start') && (await p.textContent('#bar-state')).includes('Ready'), 'Start the synth: ready');
    const n0 = await tallyN(), s0 = await snd();
    const key = await center('#keys [data-note="57"]');
    await p.mouse.move(key.x + key.w / 2, key.y + key.h / 2); await p.mouse.down(); await p.waitForTimeout(450);
    const s1 = await snd();
    ok(s1 >= s0 + 3, 'holding a key starts three oscillators (sound started)', { s0, s1 });
    ok((await p.textContent('#bar-state')).includes('Sounding') && await S(() => document.querySelector('#keys [data-note="57"]').classList.contains('on')), 'bar says Sounding and the tube lights');
    await p.mouse.up(); await p.waitForTimeout(150);
    ok(await tallyN() === n0 + 1, 'one key press = one neutrino detected');
    ok((await p.textContent('#tastelog')).includes('Last event:'), 'detection log names the last event');
    step(`Start the synth; holding the A3 tube started ${s1 - s0} Web Audio sources and detected one neutrino`);

    // 5. click the detector until a Cherenkov ring lights (at 0.6 GeV a tau is below threshold: a missing event)
    await p.click('#src-seg [data-src="2"]'); await p.click('#e-seg [data-e="1"]');   // atmosphere, 5 GeV: every flavour can make a ring
    let ring = null;
    for (let k = 0; k < 12 && !ring; k++) {
      const D = await plateXY(() => { const r = PL.svg.getBoundingClientRect(), bx = PL.box.det, k = r.width / PL.W; return { x: r.left + (bx.x + bx.w / 2) * k, y: r.top + (bx.y + bx.h / 2) * k }; });
      const before = await tallyN(); await hold(D.x, D.y, 120); await p.waitForTimeout(80);
      ok(await tallyN() === before + 1, 'detector click detects one neutrino');
      ring = await S(() => ev.cur && !ev.cur.miss ? { kind: ev.cur.kind, nh: ev.cur.nh, dots: document.querySelectorAll('#ed-dyn circle').length } : null);
    }
    ok(ring && ring.nh > 10 && ring.dots > 10, 'a Cherenkov ring lit on the event display', ring);
    step(`clicked Super-K: a ${ring.kind}-like ring lit ${ring.nh} tubes`);

    // 6. Detect x100 until the tally matches the curves (classical draws weighted by the measured values)
    for (let i = 0; i < 12; i++) await p.click('#panel');
    const conv = await S(() => { const P = probsAt(st.u), t = P[0] + P[1] + P[2], n = tally.n[0] + tally.n[1] + tally.n[2]; return { n, err: Math.max(...[0, 1, 2].map(f => Math.abs(tally.n[f] / n - P[f] / t))) }; });
    ok(conv.n >= 1200 && conv.err < 0.05, 'tally approaches the curves', conv);
    ok((await p.textContent('#tastelog')).includes(`Detected here: ${conv.n}`), 'log shows the tally', await p.textContent('#tastelog'));
    step(`Detect x100: ${conv.n} neutrinos, largest gap to the curves ${(100 * conv.err).toFixed(1)} %`);

    // 7. chips (each from another chip, so the already-selected default is tested fairly), Mix, model
    await p.click('#src-seg [data-src="1"]');
    await p.$eval('#plot', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    let sig = await plotSig();
    await p.click('#chip-seg [data-chip="4"]'); await p.waitForTimeout(150);
    ok(await S(() => st.chip === 4) && (await p.textContent('#readout')).includes('fake_torino'), 'fake_torino on the synth and in the readout');
    await center('#plot'); await p.waitForTimeout(150);   // the curves redraw when they are on screen
    ok(await plotSig() !== sig, 'the curves redraw with fake_torino\'s dots');
    await p.click('#chip-seg [data-chip="0"]');
    ok(await S(() => st.chip === 0) && (await p.getAttribute('#chip-seg [data-chip="0"]', 'aria-pressed')) === 'true', 'ibm_fez selected again from another chip');
    await p.click('#chip-seg [data-chip="13"]'); await p.click('#chip-seg [data-chip="0"]');
    ok(await S(() => st.chip === 0), 'fake_brussels then ibm_fez');
    sig = await plotSig();
    await p.focus('#k-mix'); await p.keyboard.press('Home'); await p.waitForTimeout(120);
    ok(await S(() => st.mix === 0) && (await p.textContent('#o-mix')) === 'exact', 'Mix to exact: knob and label', [await S(() => st.mix), await p.textContent('#o-mix')]);
    await center('#plot'); await p.waitForTimeout(150);   // the curves redraw when they are on screen
    ok(await plotSig() !== sig, 'Mix to exact: the curves redraw (dots fade, lines strengthen)');
    await p.focus('#k-mix'); await p.keyboard.press('End'); ok(await S(() => st.mix === 1) && (await p.textContent('#o-mix')) === 'measured', 'Mix back to measured');
    await p.click('[data-model="2"]'); ok(await S(() => st.model === 2) && (await p.textContent('#p-tau')) === 'off', '2-flavour model: tau off');
    await p.click('[data-model="3"]'); ok(await S(() => st.model === 3), '3-flavour model');
    step('chips fake_torino, fake_brussels and back to ibm_fez redraw the curves; Mix exact/measured; model 2/3');

    // 8. Flight: a held note flies outward in L/E (its marker moves on the curves); the L/E knob moves the neutrino
    await p.focus('#k-flight'); await p.keyboard.press('End');
    ok(await S(() => st.flight === 0.5) && (await p.textContent('#o-flight')) === '0.50 dec/s', 'Flight at 0.5 decades/s');
    await p.focus('#panel'); await p.keyboard.down('h'); await p.waitForTimeout(900);
    const fly = await S(() => { const v = voices.find(x => !x.rel); return v ? voiceU(v) - st.u : -1; });
    await p.keyboard.up('h');
    ok(fly > 0.25, 'a held note flew outward in L/E', fly);
    await p.focus('#k-flight'); await p.keyboard.press('Home'); ok(await S(() => st.flight === 0) && (await p.textContent('#o-flight')) === 'off', 'Flight off');
    await p.focus('#k-u'); await p.keyboard.press('Home');
    ok(await S(() => st.u === U0 && st.src === 1) && (await p.textContent('#o-u')).includes('20 km/GeV'), 'L/E knob to 20 km/GeV on the beamline', await p.textContent('#o-u'));
    await p.keyboard.press('End');   // 50,000 km/GeV: no muon-neutrino baseline reaches it, so it stops at the beam's end
    ok(await S(() => st.src === 1 && Math.abs(st.u - srcRange(st.src, st.ei)[1]) < 1e-9 && Math.abs(+$('k-u').value - st.u) < 1e-3), 'L/E knob past every baseline stops at the end of the beam');
    await p.$eval('#k-u', el => { el.value = 4.5; el.dispatchEvent(new Event('input')); });   // a knob drag to 31,600 km/GeV
    ok(await S(() => st.src === 2 && Math.abs(st.u - 4.5) < 1e-3) && (await toastText()).includes('switched to atmosphere'), 'L/E knob past the beam switches to the atmosphere');
    step(`Flight: a held note flew ${fly.toFixed(2)} decades in 0.9 s; L/E knob moves the neutrino and switches source`);

    // 9. the drone holds and stops
    await p.click('#drone'); await p.waitForTimeout(200);
    ok((await p.getAttribute('#drone', 'aria-pressed')) === 'true' && (await p.textContent('#drone')) === 'Stop the drone' && await S(() => voices.some(v => v.drone && !v.rel)), 'drone sounding');
    await p.click('#drone'); await p.waitForTimeout(100);
    ok((await p.getAttribute('#drone', 'aria-pressed')) === 'false' && await live() === 0, 'drone stopped');
    step('Hold a drone / Stop the drone');

    // 10. the restored graphs render: the curves (G1) and the meters with waveforms (G2), in The data, not in a drawer
    await p.click('#src-seg [data-src="1"]');
    await center('#plot');
    const g1 = await canvasInk('#plot');
    ok(g1.w > 600 && g1.colours > 8 && g1.inkShare > 0.03, 'the curves render (G1)', g1);
    for (const f of ['e', 'mu', 'tau']) { const g = await canvasInk('#w-' + f); ok(g.alpha > 40, `the ${f} waveform renders (G2)`, g); }
    ok(await S(() => $('plot').closest('section').id === 'data' && $('meters').closest('section').id === 'data' && !$('plot').closest('details') && !$('meters').closest('details')), 'both graphs sit in The data, not in a drawer');
    ok(await S(() => PL.svg.querySelectorAll('*').length > 300 && document.querySelectorAll('#j-dyn path').length >= 3), 'the plate\'s figures are drawn');
    step(`graphs render: curves ${g1.w}x${g1.h} with ${g1.colours} colours; three waveforms; plate figures`);

    // 11. drag and arrow-key the curves: the neutrino (and the plate) follow; out of the reactor's range switches source
    const pb = await center('#plot');
    await p.mouse.move(pb.x + pb.w * 0.3, pb.y + pb.h * 0.5); await p.mouse.down(); await p.mouse.move(pb.x + pb.w * 0.45, pb.y + pb.h * 0.5, { steps: 6 }); await p.mouse.up();
    const uPlot = await S(() => st.u);
    ok(await S(() => { const G = geom(), x = (0.45 * $('plot').getBoundingClientRect().width) * G.d; return Math.abs(st.u - (U0 + (x - G.x0) / (G.x1 - G.x0) * (U1 - U0))) < 0.02; }), 'drag on the curves set L/E where released', uPlot);
    ok((await p.textContent('#le-read')).includes(Math.round(10 ** uPlot).toLocaleString('en-US')), 'L/E readout under the curves follows');
    await p.focus('#plot'); await p.keyboard.press('ArrowRight');
    ok(await S(u => Math.abs(st.u - (u + 0.01)) < 1e-6, uPlot), 'ArrowRight on the curves moves L/E');
    await p.click('#src-seg [data-src="0"]');
    const pb2 = await center('#plot');
    await p.mouse.click(pb2.x + pb2.w * 0.04, pb2.y + pb2.h * 0.5); await p.waitForTimeout(100);
    ok(await S(() => SRC[st.src].nu === 'mu') && (await toastText()).includes('switched to'), 'clicking the curves out of the reactor\'s range switched to a muon-neutrino source');
    step(`dragged the curves to L/E ${Math.round(10 ** uPlot)} km/GeV; arrow keys; out-of-range click switched source`);

    // 12. click a waveform to hear that oscillator alone (mouse and Enter); off in the 2-flavour model
    await center('#meters');
    let sw = await snd();
    await p.click('#w-mu'); await p.waitForTimeout(150);
    ok(await snd() === sw + 1 && await S(() => $('w-mu').classList.contains('on')) && (await toastText()).includes('oscillator alone'), 'clicking the mu waveform plays that oscillator');
    await p.waitForTimeout(1300);
    ok(await S(() => !$('w-mu').classList.contains('on') && solo === null), 'the solo ends by itself after about a second');
    sw = await snd(); await p.focus('#w-e'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    ok(await snd() === sw + 1, 'Enter on the e waveform plays it');
    await p.click('[data-model="2"]'); sw = await snd(); await p.click('#w-tau'); await p.waitForTimeout(100);
    ok(await snd() === sw && (await toastText()).includes('off in the 2-flavour model'), 'tau waveform in the 2-flavour model says it is off');
    await p.click('[data-model="3"]');
    step('waveforms: click or Enter plays that oscillator alone; tau is off in the 2-flavour model');

    // 13. Stop all sound: synth voices, drone, a demo and a solo all stop
    await p.click('#drone'); await p.click('#w-tau'); await p.click('[data-play="0"]'); await p.waitForTimeout(700);
    ok(await live() > 0 && await S(() => !document.querySelector('#demo-0 audio').paused), 'drone, solo and demo all sounding');
    await p.click('#panic'); await p.waitForTimeout(200);
    ok(await live() === 0 && await S(() => !droneOn && solo === null && document.querySelector('#demo-0 audio').paused), 'Stop all sound silenced everything');
    ok((await toastText()).includes('All sound stopped') && (await p.textContent('#drone')) === 'Hold a drone', 'Stop all sound: toast and drone button reset');
    step('Stop all sound stops the voices, the drone, the solo and the demo');

    // 14. the demos: play and stop each; a scrub then play starts there; a cue jumps to its machine
    const demoState = i => S(i => { const a = document.querySelector('#demo-' + i + ' audio'); return { paused: a.paused, t: a.currentTime, btn: document.querySelector('[data-play="' + i + '"]').textContent, time: $('dt-' + i).textContent }; }, i);
    for (const i of [0, 1, 2]) {
      const m0 = await S(() => window.__qa.media);
      await p.click(`[data-play="${i}"]`); await p.waitForTimeout(1100);
      const a = await demoState(i);
      ok(!a.paused && a.t > 0.3 && a.btn === 'Pause' && await S(() => window.__qa.media) > m0, `demo ${i} plays`, a);
      await p.click(`[data-stop="${i}"]`); await p.waitForTimeout(200);
      const b = await demoState(i);
      ok(b.paused && b.t === 0 && b.btn === 'Play' && b.time.startsWith('0:00'), `demo ${i} stops and rewinds`, b);
    }
    const ds = await center('#ds-0');
    await p.mouse.click(ds.x + ds.w * 0.4, ds.y + ds.h / 2); await p.waitForTimeout(150);
    const want = await S(() => +$('ds-0').value);
    ok(want > 6 && (await p.textContent('#dt-0')).startsWith(`0:${String(Math.floor(want)).padStart(2, '0')}`), 'scrubber sets the position', want);
    await p.click('[data-play="0"]'); await p.waitForTimeout(700);
    const sc = await demoState(0);
    ok(!sc.paused && sc.t >= want - 0.2 && sc.t < want + 2, 'play after a scrub starts at the scrubbed position', { want, sc });
    await p.click('[data-stop="0"]');
    const cue = await S(() => { const k = DEMOS[1].cues.findIndex(c => c.label === 'fake_torino'); return { k, t: DEMOS[1].cues[k].t }; });
    await p.click(`[data-cue="1:${cue.k}"]`); await p.waitForTimeout(600);
    const cs = await demoState(1);
    ok(!cs.paused && cs.t >= cue.t && cs.t < cue.t + 1.5 && await S(k => document.querySelector(`[data-cue="1:${k}"]`).classList.contains('now'), cue.k), 'cue button jumps to its machine', { cue, cs });
    await p.click('[data-stop="1"]');
    step(`demos: all three play and stop; scrub to ${want.toFixed(1)} s then play starts there; the fake_torino cue jumps to ${cue.t} s`);

    // 15. every drawer and section opens; the earlier words are in place
    const nd = await p.$$eval('details', ds => ds.length);
    for (let k = 0; k < nd; k++) {
      const d = (await p.$$('details'))[k];
      if (!(await d.evaluate(e => e.open))) { await (await d.$('summary')).click(); await p.waitForTimeout(80); }
      ok(await d.evaluate(e => e.open && [...e.children].some(c => c.tagName !== 'SUMMARY' && c.getBoundingClientRect().height > 0)), `drawer ${k} opens and shows its body`, await d.evaluate(e => e.querySelector('summary').textContent.slice(0, 40)));
    }
    const SECTIONS = { play: 'Play the particle that changes identity mid-flight.', data: 'The curves you are playing', 'demos-sec': 'Hear it in use', 'plug-sec': 'The plugin',
      made: 'How it was made', science: 'The science', claims: 'What this does not claim', 'jobs-sec': 'Jobs and credits' };
    for (const [id, h] of Object.entries(SECTIONS)) ok(await p.isVisible('#' + id) && (await p.textContent(`#${id} h2`)).trim() === h, `section ${id} visible and titled "${h}"`);
    await p.click('nav.toc a[href="#jobs-sec"]'); await p.waitForTimeout(900);
    ok(await S(() => { const r = $('jobs-sec').getBoundingClientRect(); return r.top > -20 && r.top < innerHeight / 2; }), 'On this page link scrolls to its section');
    const body = await p.textContent('body');
    for (const s of ['A muon neutrino turns into electron and tau neutrinos as it travels.', 'Look at the ibm_fez dots: the errors come in short blocks',
      'Why a neutrino is a qubit you can\'t hold', 'Three wavetable oscillators per note', 'No neutrino is simulated on a quantum computer here.',
      'Reactor and Sun: why their curves are classical', 'What the plate shows, and what it doesn\'t', 'Knob (editor label)'])
      ok(body.includes(s), 'earlier words in place: ' + s);
    ok(!/\bbonus\b|main entry|\b\d+ \/ 11\b/i.test(body), 'no bonus / main-entry / "n / 11" ranking wording');
    step(`${nd} drawers open; eight titled sections visible; earlier words in place; no ranking wording`);

    // 16. the job table matches PARAMS.md and the cache-backed bundle, and each machine puts its chip on the synth
    const rows = await p.$$eval('#jobs tr', tr => tr.slice(1).map(r => [...r.cells].map(c => c.textContent.trim())));
    ok(rows.length === PJ.jobs, 'job table has piece.json\'s job count', rows.length);
    for (const r of rows) { const m = BUNDLE.machines.find(x => x.id === r[0]); ok(m && r[5] === m.job_id && PARAMS.includes('`' + m.job_id + '`') && +r[2] === m.values, 'job row matches PARAMS.md', r); }
    const ky = BUNDLE.machines.findIndex(m => m.id === 'fake_kyoto');
    await p.click('#src-seg [data-src="1"]');
    await p.click(`#jobs [data-jobchip="${ky}"]`);
    ok(await S(k => st.chip === k, ky) && (await p.getAttribute(`#chip-seg [data-chip="${ky}"]`, 'aria-pressed')) === 'true' && (await toastText()).includes('fake_kyoto'), 'job-table machine puts its chip on the synth');
    step(`job table: ${rows.length} rows match PARAMS.md; fake_kyoto from the table is on the synth`);

    // 17. Copy link to this sound, then reload with the hash: the state comes back
    await p.click('#src-seg [data-src="2"]'); await p.click('#e-seg [data-e="1"]'); await p.click('[data-model="2"]');
    await p.focus('#k-mix'); await p.keyboard.press('Home'); for (let i = 0; i < 40; i++) await p.keyboard.press('ArrowRight');
    await p.focus('#k-flight'); await p.keyboard.press('Home'); for (let i = 0; i < 20; i++) await p.keyboard.press('ArrowRight');
    await p.focus('#scene'); await p.keyboard.press('Home'); for (let i = 0; i < 4; i++) await p.keyboard.press('Shift+ArrowRight');
    const before = await S(() => ({ chip: st.chip, src: st.src, ei: st.ei, model: st.model, mix: st.mix, flight: st.flight, le: Math.round(leOf(st.u)) }));
    ok(before.mix === 0.4 && before.flight === 0.2 && before.chip === ky, 'state set for sharing', before);
    await p.click('#share'); await p.waitForTimeout(150);
    const hash = await S(() => location.hash);
    ok(/^#[A-Za-z0-9._~-]+$/.test(hash) && hash.startsWith('#fake_kyoto~'), 'share token in the URL', hash);
    let clip = null; try { clip = await S(() => navigator.clipboard.readText()); } catch (e) { /* clipboard not readable here */ }
    ok(clip === null || clip.endsWith(hash), 'copied link carries the token', clip);
    const p2 = await ctx.newPage(); watch(p2); await p2.addInitScript(INSTRUMENT);
    await p2.goto(base + hash, { waitUntil: 'networkidle' }); await p2.waitForTimeout(400);
    const after = await p2.evaluate(() => ({ chip: st.chip, src: st.src, ei: st.ei, model: st.model, mix: st.mix, flight: st.flight, le: Math.round(leOf(st.u)) }));
    ok(JSON.stringify(after) === JSON.stringify(before), 'reload with the hash restores the state', { before, after });
    ok((await p2.getAttribute(`#chip-seg [data-chip="${ky}"]`, 'aria-pressed')) === 'true' && (await p2.getAttribute('#src-seg [data-src="2"]', 'aria-pressed')) === 'true'
      && (await p2.getAttribute('#e-seg [data-e="1"]', 'aria-pressed')) === 'true' && (await p2.getAttribute('[data-model="2"]', 'aria-pressed')) === 'true'
      && (await p2.textContent('#o-mix')) === '40% meas.' && (await p2.textContent('#o-flight')) === '0.20 dec/s', 'restored controls show the shared state');
    ok(await p2.evaluate(() => window.__qa.sources === 0), 'a shared link does not start sound by itself');
    await p2.goto(base + '#fake_fez~800~50~3~10~sky', { waitUntil: 'networkidle' }); await p2.waitForTimeout(300);
    ok(await p2.evaluate(() => st.src === 2 && st.ei === 0 && st.chip === 2 && Math.round(leOf(st.u)) === 800), 'another link opened in the same tab (an old gelateria link) applies: atmosphere, fake_fez, 800 km/GeV');
    ok((await p2.textContent('#toast')).includes('Opened the shared view') && (await p2.getAttribute('#chip-seg [data-chip="2"]', 'aria-pressed')) === 'true', 'same-tab link: toast and controls follow');
    await p2.close();
    step(`share link ${hash} restores chip, source, energy, L/E ${before.le}, mix 0.4, model 2 and flight 0.2 after reload; a second link in the same tab (an old gelateria link) applies too`);

    // 18. the set: prev / hub / next and the jump list
    const prev = await p.getAttribute('nav.wtnr-nav a[rel="prev"]', 'href'), next = await p.getAttribute('nav.wtnr-nav a[rel="next"]', 'href');
    ok(prev === URLS['06-tweezer'] && next === URLS['08-pbit-or-qubit'], 'prev/next point at 06 and 08', { prev, next });
    ok((await p.getAttribute('nav.wtnr-nav a.wn-hub', 'href')) === HUB, 'nav hub link');
    ok((await p.textContent('nav.wtnr-nav a[rel="prev"]')).includes('06') && (await p.textContent('nav.wtnr-nav a[rel="next"]')).includes('08'), 'prev/next labels name the pieces');
    const jl = await p.$$eval('nav.wtnr-nav ol a', a => a.map(x => ({ href: x.getAttribute('href'), cur: x.getAttribute('aria-current') })));
    ok(jl.length === Object.keys(URLS).length && jl.every(x => Object.values(URLS).includes(x.href)), 'jump list links every published piece', jl.length);
    ok(jl.filter(x => x.cur === 'page').map(x => x.href).join() === URLS['07-flavour'], 'this piece is marked current');
    ok(await S(() => { const n = document.querySelector('nav.wtnr-nav'), f = document.querySelector('.wtnr-foot'); return n && f && n.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'nav sits just before the footer');
    step(`nav: prev 06, hub, next 08, and a ${jl.length}-piece jump list`);

    // 19. phone width: stacked plate, no horizontal overflow, the one-energy label fits
    const m = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage(); watch(m);
    await m.goto(base, { waitUntil: 'networkidle' }); await m.waitForTimeout(300);
    await m.click('#src-seg [data-src="3"]'); await m.waitForTimeout(100);
    ok(await m.evaluate(() => PL.mode === 'narrow' && document.documentElement.scrollWidth <= innerWidth + 1), 'phone layout without overflow');
    ok(await m.evaluate(() => { const r = document.querySelector('#e-seg .e-only').getBoundingClientRect(); return r.right <= innerWidth && r.width > 20; }), 'Sun energy label fits at 375 px');
    await m.close();
    step('phone width 375 px: narrow plate, no overflow');

    const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
    ok(!bad.length, 'no requests to other hosts', bad);
    ok(!errors.length, 'no page errors', errors.slice(0, 5));
    step('no page errors; no external requests beyond Google Fonts');
    result = { ok: true, steps };
  } catch (e) {
    result = { ok: false, steps, failed: String(e.message || e).slice(0, 800), errors: errors.slice(0, 5) };
    try { await p.screenshot({ path: path.join(PIECE, 'qa', 'e2e-fail.png') }); } catch (_) {}
  }
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close(); srv.close();
  process.exit(result.ok ? 0 : 1);
})();
