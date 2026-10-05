// End-to-end journey for The Quantum Nose Test: node entries/21-quantum-nose/qa/e2e.cjs [port 6630-6639]
// Serves web/ locally (with HTTP range requests, as a real host does for audio seeking) and walks the main journey
// in headless Chromium with real mouse and keyboard input:
//   load (no sound) -> pick a molecule (readouts follow) -> Play the chord (sound starts) -> Swap H<->D while it
//   sounds (the oscillators glide down to the deuterated bins) -> Pause (no new sound) -> Q-blur strength x reach,
//   each showing its own real job ID and notes-out count from PARAMS.md (Local works after Halfway) -> play the dense
//   blurred chord and stop it -> Play the WAV render, swap while it plays (it jumps to the matching file), stop it ->
//   scrub -> Scene/Data toggle, click and keys on the spectrum roll -> Sniff -> plate key and callouts -> Fig. b/c/d
//   (drag the hypothetical gap onto a line, swap to D and it goes quiet) -> blind test (play A/B, stop, answer with
//   A and with B, score and p-value checked against an independent binomial, disguise pitch, vials, nose, reset) ->
//   Copy link to this view -> reload with the hash: molecule, isotope, blur setting and view restored -> Copy my
//   score -> every science drawer, the drawer buttons that load molecules and shade bands -> the audio tour chips
//   (and that they stop the instrument) -> the titled sections below the scene (How to play, The data with Graph 1
//   the spectrum roll, Graph 2 every chord x every blur, Table 1; The science; How it was made; What this does not
//   claim; Jobs and credits), the earlier page's words restored verbatim -> prev / hub / next nav links.
// Exits 1 and prints the failed assertion if anything breaks. Writes qa/e2e.json.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6630);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const PIECEJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
// out/jobs.csv: the completed blur-midi-v1 jobs (strength, reach -> job_id)
const JOBS = fs.readFileSync(path.join(PIECE, 'out', 'jobs.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','))
  .filter(c => c[5] === 'completed').map(c => ({ key: 's' + (+c[0]) + '_r' + (+c[1]), id: c[4] }));
const jobOf = k => (JOBS.find(j => j.key === k) || {}).id;
// PARAMS.md: notes out per track for every job (track order: aceto H, aceto D, exaltone H, exaltone D, muscone H, muscone D)
const NOTES_OUT = {};
for (const l of fs.readFileSync(path.join(PIECE, 'PARAMS.md'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\| ([\d.]+) \| ([\d.]+) \| 20 \| 1 \| `([0-9a-f-]{36})` \| completed \| [\d.]+ \| ([\d /]+) \|$/);
  if (m) NOTES_OUT['s' + (+m[1]) + '_r' + (+m[2])] = m[4].split('/').map(s => +s.trim());
}
const TRACK = { acetophenone_H: 0, acetophenone_D: 1, exaltone_H: 2, exaltone_D: 3, muscone_H: 4, muscone_D: 5 };
function binomTail(k, n) { let p = 0; const f = x => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; }; for (let i = k; i <= n; i++) p += f(n) / (f(i) * f(n - i)) / Math.pow(2, n); return Math.min(1, p); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size }); fs.createReadStream(f).pipe(r);
});

// the same audio instrumentation as common/qa/qa_page.cjs (count every Web Audio source that starts, and media 'playing'),
// plus sample-buffer sources, which the dense blurred chords and the sniff use
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, media: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
    // AudioBufferSourceNode declares its own start(when, offset, duration), which shadows the one above: count it too
    const B = window.AudioBufferSourceNode && AudioBufferSourceNode.prototype;
    if (B && Object.prototype.hasOwnProperty.call(B, 'start')) { const bs = B.start; B.start = function (...a) { window.__qa.sources++; return bs.apply(this, a); }; }
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
  p.on('pageerror', e => errors.push(String(e.message || e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  await p.addInitScript(INSTRUMENT);
  let result = { ok: false };
  const S = (fn, a) => p.evaluate(fn, a);
  const src = () => S(() => window.__qa.sources), media = () => S(() => window.__qa.media);
  const txt = sel => p.textContent(sel);
  const pOf = t => { const m = /p = ([0-9.e+-]+)/.exec(t || ''); return m ? parseFloat(m[1]) : NaN; };
  const pressed = sel => p.getAttribute(sel, 'aria-pressed');
  const wait = ms => p.waitForTimeout(ms);
  async function waitFor(fn, ms, what, a) { try { await p.waitForFunction(fn, a, { timeout: ms || 4000 }); } catch (e) { ok(false, 'timed out waiting for ' + what); } }

  try {
    await p.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
    await wait(700);

    // 1. load: nothing sounds, the proof chips carry the real numbers
    ok((await src()) === 0 && (await media()) === 0, 'no sound before any click');
    const proof = await txt('#proof');
    ok(proof.includes(PIECEJ.qubits + ' qubits per blur pass') && proof.includes(JOBS.length + ' real Atlas jobs') && proof.includes('no QPU'),
      'proof chips: qubits, jobs, simulator (piece.json / jobs.csv)', proof);
    ok(PIECEJ.jobs === JOBS.length && PIECEJ.hardware === null, 'piece.json jobs and hardware agree with jobs.csv');
    ok((await p.getAttribute('.wtnr-bar a', 'href')) === HUB, 'brand bar links the hub');
    ok((await txt('.wtnr-bar .count')).trim() === 'Challenge 02' && !(await S(() => /Bonus/i.test(document.body.innerText))), 'brand bar reads Challenge 02; no "Bonus" anywhere (all entries are equal)');
    ok(!(await p.isVisible('#v-data')) && (await p.isVisible('#v-scene')), 'opens on the scene, data one click away');
    step(`loaded silent; proof chips "${proof.replace(/\s+/g, ' ').trim()}"`);

    // 2. pick a molecule: the readouts and plates follow it
    await p.click('#g-mol button[data-mol="exaltone"]');
    ok((await pressed('#g-mol button[data-mol="exaltone"]')) === 'true' && (await pressed('#g-mol button[data-mol="acetophenone"]')) === 'false', 'molecule seg follows the click');
    ok((await txt('#molname')).includes('Cyclopentadecanone') && (await txt('#molname')).includes('28 hydrogens'), 'molecule name and H count', await txt('#molname'));
    ok((await txt('#r-track')).includes('track 3 of 6') && (await txt('#p2-mol')).includes('Cyclopentadecanone'), 'track readout and Plate II follow the molecule');
    ok((await txt('#t-mol')) === 'cyclopentadecanone', 'the blind test uses the same molecule');
    ok((await S(() => puffs.length)) > 0, 'picking a molecule sends a puff up the nose');
    ok((await src()) === 0, 'picking a molecule makes no sound');
    step('picked Exaltone: name, 28 H, track 3 of 6, Plate II and the blind test all follow');

    // 3. Play the chord: real Web Audio sources start, the clock runs
    let s0 = await src();
    await p.click('#play');
    await wait(3300);
    ok((await src()) > s0, 'Play starts sound', { before: s0, after: await src() });
    ok((await S(() => main.playing)) && (await txt('#play')) === 'Pause', 'Play becomes Pause while sounding');
    const clk = await txt('#clock');
    ok(parseFloat(clk) >= 2.5, 'clock runs', clk);
    const fH = await S(() => Math.max(...[...main.voices].map(v => v.o.frequency.value)));
    ok(Math.abs(fH - 105 * 7) < 1, 'top oscillator is the CH2 stretch bin 105 = 735 Hz', fH);
    ok((await S(() => vibOn)), 'the atoms wobble with the notes');
    ok((await txt('#lp-read')).includes('Sounding'), 'the loupe caption names the sounding line');
    step(`Play: sound started, clock ${clk}, top line 735 Hz, atoms wobble, loupe names the line`);

    // 4. Swap H -> D while it sounds: the lines glide down, live
    await p.click('#swap');
    await wait(1100);
    ok((await S(() => st.iso)) === 'D' && (await pressed('#g-iso button[data-iso="D"]')) === 'true', 'swap sets deuterium');
    ok((await S(() => main.playing && main.src === NOTES.clean.exaltone_D)), 'still playing, now the deuterated chord');
    const fD = await S(() => Math.max(...[...main.voices].map(v => v.o.frequency.value)));
    ok(fD <= 77 * 7 + 1 && fD > 400, 'after the glide the top oscillator sits at the C-D stretch bin (<= 539 Hz)', fD);
    ok((await txt('#molname')).includes('cyclopentadecanone-d28'.replace(/^c/, 'C')) && (await txt('#molname')).includes('28 deuteriums'), 'name shows the d28 form');
    ok((await txt('#shift')).includes('semitones'), 'shift readout');
    step(`Swap while playing: top oscillator glided ${fH.toFixed(0)} -> ${fD.toFixed(0)} Hz (5.35 semitones)`);

    // 5. Pause: no new voices start
    await p.click('#play');
    await wait(150);
    s0 = await src(); await wait(700);
    ok(!(await S(() => main.playing)) && (await src()) === s0, 'Pause stops the chord (no new sources)');
    ok(['Play', 'Replay'].includes(await txt('#play')), 'button back to Play');
    step('Pause: chord stopped, no new sound');

    // 6. Q-blur: every strength x reach is a real job, with its own job ID and notes-out count
    ok((await p.isDisabled('#g-reach button[data-reach="0.5"]')), 'reach is disabled while the blur is off');
    await p.click('#g-str button[data-str="0.5"]');
    const checkSet = async (k) => {
      ok((await S(() => curSet())) === k, 'setting is ' + k, await S(() => curSet()));
      ok((await txt('#r-job')) === jobOf(k), 'job readout for ' + k, await txt('#r-job'));
      const want = NOTES_OUT[k][TRACK[(await S(() => st.mol)) + '_' + (await S(() => st.iso))]];
      ok((await txt('#r-track')).includes(want + ' notes out'), `notes out for ${k} match PARAMS.md (${want})`, await txt('#r-track'));
      ok((await txt('#r-qubits')).startsWith('20 per pass'), 'qubits readout 20 per pass');
      ok((await txt('#r-engine')).includes('blur-midi-v1'), 'engine readout');
    };
    ok((await pressed('#g-reach button[data-reach="0"]')) === 'true', 'Local is the default reach');
    await checkSet('s0.5_r0');
    await p.click('#g-reach button[data-reach="0.5"]'); await checkSet('s0.5_r0.5');
    ok((await pressed('#g-reach button[data-reach="0"]')) === 'false', 'Local released after Halfway');
    await p.click('#g-reach button[data-reach="0"]'); await checkSet('s0.5_r0');
    ok((await pressed('#g-reach button[data-reach="0"]')) === 'true', 'Local selects again (it is not a dead control)');
    await p.click('#g-str button[data-str="1"]'); await checkSet('s1_r0');
    await p.click('#g-str button[data-str="0.25"]'); await checkSet('s0.25_r0');
    await p.click('#g-reach button[data-reach="1"]'); await checkSet('s0.25_r1');
    await p.click('#g-str button[data-str="0.5"]'); await checkSet('s0.5_r1');
    ok((await txt('#t-set')).includes('strength 0.5, reach 1'), 'the blind test follows the blur');
    step('Q-blur: 0.5/local, 0.5/halfway, back to local, 1/local, 0.25/local, 0.25/global, 0.5/global: job IDs and notes-out match jobs.csv and PARAMS.md');

    // 7. play the dense blurred chord (a sample buffer synthesised from the engine output) and stop it
    s0 = await src();
    await p.click('#play'); await wait(700);
    ok((await src()) > s0 && (await S(() => main.playing && main.dense)), 'the blurred chord plays (dense: sample buffer)', { s0, s1: await src(), st: await S(() => [main.playing, main.dense, main.src && main.src.n.length, curSet(), st.mol, st.iso]) });
    await p.click('#play'); await wait(200);
    ok(!(await S(() => main.playing)), 'and stops');
    step('played and stopped the 0.5/global engine output (2,323 notes)');

    // 8. the WAV deliverable for the selection: play, swap while it plays (it follows), stop
    let m0 = await media();
    await p.click('#wavbtn');
    await waitFor(() => { const w = document.getElementById('wav'); return !w.paused && w.currentTime > 0.3; }, 6000, 'the WAV render to play');
    ok((await media()) > m0, 'the WAV render fired playing');
    ok((await S(() => document.getElementById('wav').src)).endsWith('audio/chords/s0.5_r1/exaltone_D.mp3'), 'plays the file for this selection');
    ok((await txt('#wavbtn')) === 'Stop the WAV render' && (await pressed('#wavbtn')) === 'true', 'button says Stop while it plays');
    ok((await txt('#wavname')).includes('wav/s0.5_r1/exaltone_D.wav'), 'names the deliverable', await txt('#wavname'));
    await wait(400);
    await p.click('#swap');
    await waitFor(() => { const w = document.getElementById('wav'); return w.src.endsWith('exaltone_H.mp3') && !w.paused; }, 6000, 'the WAV to follow the swap');
    ok((await txt('#wavname')).includes('wav/s0.5_r1/exaltone_H.wav'), 'readout follows the swap');
    await p.click('#wavbtn'); await wait(250);
    ok((await S(() => document.getElementById('wav').paused)) && (await txt('#wavbtn')) === 'Play the WAV render', 'WAV stops and the button resets');
    step('WAV render: played s0.5_r1/exaltone_D, swapped mid-play to exaltone_H, stopped');

    // 9. scrub with the keyboard
    await p.focus('#scrub'); await p.keyboard.press('End'); await wait(150);
    const dur = await S(() => DUR);
    ok(Math.abs((await S(() => main.pos)) - dur) < 0.06, 'End scrubs to the end', await S(() => main.pos));
    await p.keyboard.press('Home'); await wait(150);
    ok((await S(() => main.pos)) === 0 && (await txt('#clock')).startsWith('0.0 /'), 'Home scrubs to 0');
    step(`scrub: End -> ${dur} s, Home -> 0 s`);

    // 10. Scene / Data: the spectrum roll, clicked and keyed
    await p.click('#g-view button[data-view="data"]'); await wait(250);
    ok((await p.isVisible('#v-data')) && !(await p.isVisible('#v-scene')) && !(await p.isVisible('#v-key')), 'Data shows the roll and hides the plate');
    ok((await txt('#viewcap')).includes('spectrum roll'), 'caption follows');
    const ink = await S(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120 && d[i + 2] > 100) n++; return n; });
    ok(ink > 2000, 'the roll is drawn (ink pixels)', ink);
    const box = await p.locator('#cv').boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5); await wait(150);
    const tClick = await S(() => main.pos);
    ok(tClick > 2 && tClick < 5, 'clicking the roll moves the playhead', tClick);
    await p.keyboard.press('ArrowRight'); await wait(100);
    ok(Math.abs((await S(() => main.pos)) - tClick - 0.5) < 0.02, 'ArrowRight scrubs +0.5 s');
    await p.keyboard.press('s'); await wait(150);
    ok((await S(() => st.iso)) === 'D', 'S key swaps H <-> D');
    s0 = await src();
    await p.keyboard.press(' '); await wait(500);
    ok((await S(() => main.playing)) && (await src()) > s0, 'Space plays');
    await p.keyboard.press(' '); await wait(150);
    ok(!(await S(() => main.playing)), 'Space pauses');
    await p.click('#g-view button[data-view="scene"]'); await wait(200);
    ok((await p.isVisible('#v-scene')) && (await p.isVisible('#v-key')) && !(await p.isVisible('#v-data')), 'Scene comes back');
    // the Swap button's "Shortcut: S" also works in the Scene view (focus on the page, not the roll)
    ok((await p.getAttribute('#swap', 'aria-keyshortcuts')) === 'S', 'Swap button declares its shortcut');
    await S(() => document.activeElement && document.activeElement.blur());
    const isoS = await S(() => st.iso);
    await p.keyboard.press('s'); await wait(150);
    ok((await S(() => st.iso)) !== isoS, 'S swaps H <-> D in the Scene view too');
    step(`Scene/Data: roll drawn (${ink} ink px), click -> ${tClick.toFixed(2)} s, ArrowRight, S swaps, Space plays/pauses, back to Scene, where S swaps too`);

    // 11. Sniff: a sniff sound, puffs ride the airflow, the mascot sniffs
    const masc0 = await p.getAttribute('#mascot', 'src');
    s0 = await src();
    await p.click('#sniff'); await wait(300);
    ok((await src()) > s0, 'Sniff makes the sniff sound');
    ok((await S(() => puffs.length)) > 0, 'puffs in flight');
    ok((await p.getAttribute('#mascot', 'src')) !== masc0, 'the mascot sniffs');
    step('Sniff: sound, puffs and the mascot');

    // 12. Plate I: the key and the callouts; clicking the plate sniffs
    await p.hover('#key li[data-k="3"]');
    ok((await S(() => document.querySelector('#plate1 .co[data-k="3"]').classList.contains('hl'))), 'hovering a key name highlights its callout');
    await p.click('#plate1 .co[data-k="9"] text'); await wait(150);
    ok((await txt('#toast')).includes('Olfactory bulb'), 'clicking callout 9 names the olfactory bulb', await txt('#toast'));
    step('Plate I: key hover highlights 3; callout 9 names the olfactory bulb');

    // 13. Plate II: Fig. b drops an odorant; Fig. c swaps; Fig. d gap onto a line, then D goes quiet
    await p.click('#figb'); await wait(100);
    ok((await S(() => performance.now() - dockB.t0)) < 1500, 'Fig. b drops a fresh odorant onto a cilium');
    const iso0 = await S(() => st.iso);
    await p.click('#figc'); await wait(100);
    ok((await S(() => st.iso)) !== iso0, 'clicking Fig. c swaps H and D');
    if ((await S(() => st.iso)) !== 'H') await p.click('#g-iso button[data-iso="H"]');
    await p.locator('#figd').scrollIntoViewIfNeeded(); await wait(100);
    const target = await S(() => Math.round(meV(2930)));
    const pt = await S(t => { const s = document.getElementById('figd'), m = s.getScreenCTM(); const q = new DOMPoint(300, DY0 - t * DK).matrixTransform(m); return [q.x, q.y]; }, target);
    await p.mouse.click(pt[0], pt[1]); await wait(150);
    const g = await S(() => gap);
    ok(Math.abs(g - target) <= 2 && (await p.inputValue('#gap')) === String(g), 'clicking Fig. d sets the gap and the slider', { g, target });
    ok((await txt('#d-read')).includes('matches') && (await txt('#d-read')).includes('stretch'), 'the gap matches a C-H stretch rung', await txt('#d-read'));
    await p.click('#g-iso button[data-iso="D"]'); await wait(100);
    ok((await txt('#d-read')).includes('stays silent') && (await txt('#d-read')).includes('normal molecule would set it off'), 'deuterated: the receptor goes quiet', await txt('#d-read'));
    await p.focus('#gap'); await p.keyboard.press('ArrowDown'); await wait(80);
    ok((await S(() => gap)) === g - 1, 'the gap slider responds to the keyboard');
    step(`Plate II: Fig. b binds, Fig. c swaps, Fig. d gap ${g} meV matches the CH2 stretch, D goes quiet`);

    // 14. blind test
    await p.click('#g-iso button[data-iso="H"]');
    await p.click('#g-str button[data-str="off"]');
    await p.locator('#test').scrollIntoViewIfNeeded();
    s0 = await src();
    await p.click('#pA'); await wait(400);
    ok((await src()) > s0 && (await S(() => test.playing && which === 'A')) && (await txt('#pA')) === 'Stop A', 'Play A sounds sample A');
    await p.click('#pB'); await wait(300);
    ok((await S(() => test.playing && which === 'B')) && (await txt('#pB')) === 'Stop B' && (await txt('#pA')) === 'Play A', 'Play B switches to B');
    const wantB = await S(() => (trial.dIsA ? 'D' : 'H'));
    ok((await S(() => test.src === curTrack(trial.dIsA ? 'H' : 'D'))), 'sample B is the other isotope of the selected chord', wantB);
    await p.click('#pB'); await wait(200);
    ok(!(await S(() => test.playing)) && (await txt('#pB')) === 'Play B', 'Stop B stops it');
    const answerRight = async () => { const a = await S(() => trial.dIsA); await p.click(a ? '#cA' : '#cB'); await wait(120); return a; };
    let usedB = false, usedA = false;
    for (let i = 0; i < 6; i++) {
      const a = await answerRight(); if (a) usedA = true; else usedB = true;
      ok((await p.isDisabled('#cA')) && (await p.isDisabled('#cB')) && !(await p.isDisabled('#next')), 'answered: picks lock, Next pair opens');
      ok((await txt(a ? '#vA' : '#vB')) === 'deuterated' && (await txt(a ? '#vB' : '#vA')) === 'normal', 'verdicts shown');
      await p.click('#next'); await wait(80);
      ok(!(await p.isDisabled('#cA')) && !(await p.isDisabled('#cB')), 'Next pair unlocks the picks');
    }
    // make sure the "B is deuterated" button itself has been used (dead-control QA could not click it once A had answered)
    if (!usedB) { await S(() => { trial.dIsA = false; }); await answerRight(); await p.click('#next'); usedB = true; }
    if (!usedA) { await S(() => { trial.dIsA = true; }); await answerRight(); await p.click('#next'); usedA = true; }
    const k = await S(() => hist.filter(h => h.ok).length), n = await S(() => hist.length);
    ok(k === n && n >= 6, 'all right answers counted', { k, n });
    ok((await txt('#tscore')).replace(/\s+/g, ' ').trim() === `${k} / ${n}`, 'score shown', await txt('#tscore'));
    const pRight = binomTail(k, n);
    ok(Math.abs(pOf(await txt('#tp')) - pRight) < 0.0011, 'p-value matches an independent binomial tail', { tp: await txt('#tp'), pRight });
    // one wrong answer
    const a = await S(() => trial.dIsA); await p.click(a ? '#cB' : '#cA'); await wait(120);
    ok((await S(() => hist[hist.length - 1].ok)) === false && (await txt('#tscore')).replace(/\s+/g, ' ').trim() === `${k} / ${n + 1}`, 'a wrong answer is scored');
    const pW = binomTail(k, n + 1);
    const phrase = pW < 0.01 ? 'Your ear hears deuterium' : (pW < 0.05 ? 'Probably not luck' : 'guessing so far');
    ok(Math.abs(pOf(await txt('#tp')) - pW) < 0.0011 && (await txt('#tp')).includes(phrase), 'p-value after a miss, with the matching verdict', { tp: await txt('#tp'), pW, phrase });
    ok((await txt('#toast')).startsWith('Not this time'), 'toast after a miss');
    // the earlier page's score-record graph (G2): one dot per answer, k right then the miss last
    const dots = await p.$$eval('#tdots i', d => d.map(x => x.className));
    const dbox = await p.$eval('#tdots', e => { const r = e.getBoundingClientRect(); return r.width * r.height; });
    ok(dots.length === n + 1 && dots.filter(c => c === 'ok').length === k && dots[dots.length - 1] === 'no' && dbox > 0, 'score dots: one per answer, rendered', { dots: dots.length, dbox });
    await p.click('#next');
    // disguise pitch: the sample is transposed by the trial's random factor
    await p.check('#disguise');
    await p.click('#pA'); await wait(300);
    const mul = await S(() => [test.mul, trial.mulA]);
    ok(mul[0] === mul[1] && mul[0] !== 1 && mul[0] >= 0.8 && mul[0] <= 1.25, 'disguise transposes sample A by up to 25 %', mul);
    await p.click('#pA'); await wait(100);
    await p.uncheck('#disguise');
    // the vials and the nose are buttons too
    s0 = await src();
    await p.click('#vialB'); await wait(300);
    ok((await S(() => test.playing && which === 'B')) && (await src()) > s0, 'clicking vial B uncorks and plays B');
    await p.locator('#vialB').press('Enter'); await wait(150);
    ok(!(await S(() => test.playing)), 'Enter on vial B stops it');
    s0 = await src();
    await p.click('#sniffer'); await wait(200);
    ok((await src()) > s0, 'clicking the test nose sniffs (sound)');
    await p.click('#treset'); await wait(100);
    ok((await txt('#tscore')).replace(/\s+/g, ' ').trim() === '0 / 0' && (await txt('#tp')).startsWith('Answer a few pairs'), 'Reset score');
    ok((await p.$$eval('#tdots i', d => d.length)) === 0, 'Reset clears the score dots');
    step(`blind test: A/B play and stop, ${n} right (p = ${pRight.toFixed(3)}), 1 miss (p = ${pW.toFixed(3)}), score dots, both pick buttons used, disguise x${mul[0].toFixed(3)}, vials, nose, reset`);

    // 15. share: Copy link to this view, then reload with the hash
    await p.click('#g-mol button[data-mol="muscone"]');
    await p.click('#g-iso button[data-iso="D"]');
    await p.click('#g-str button[data-str="0.25"]');
    await p.click('#g-reach button[data-reach="0.5"]');
    await p.click('#g-view button[data-view="data"]');
    await p.click('#share'); await wait(200);
    const hash = await S(() => location.hash);
    ok(hash === '#muscone~D~s0.25_r0.5~data', 'share writes the view into the hash', hash);
    ok(/^[#A-Za-z0-9._~-]+$/.test(hash), 'hash uses only the allowed characters');
    let clip = ''; try { clip = await S(() => navigator.clipboard.readText()); } catch (e) { clip = ''; }
    const toastShare = await txt('#toast');
    ok(clip.endsWith(hash) || toastShare.includes('address bar'), 'the link was copied (or the fallback said where it is)', { clip, toastShare });
    await p.goto('about:blank');
    await p.goto(base + hash, { waitUntil: 'networkidle' }); await wait(600);
    ok((await src()) === 0 && (await media()) === 0, 'no sound after reload');
    const sv = await S(() => ({ mol: st.mol, iso: st.iso, set: curSet(), view: st.view }));
    ok(sv.mol === 'muscone' && sv.iso === 'D' && sv.set === 's0.25_r0.5' && sv.view === 'data', 'state restored from the hash', sv);
    ok((await pressed('#g-mol button[data-mol="muscone"]')) === 'true' && (await pressed('#g-iso button[data-iso="D"]')) === 'true' &&
      (await pressed('#g-str button[data-str="0.25"]')) === 'true' && (await pressed('#g-reach button[data-reach="0.5"]')) === 'true', 'controls show the restored state');
    ok((await p.isVisible('#v-data')) && (await txt('#r-job')) === jobOf('s0.25_r0.5') && (await txt('#molname')).includes('Muscone-d30'), 'Data view, job ID and name restored');
    ok((await txt('#r-track')).includes(NOTES_OUT['s0.25_r0.5'][TRACK.muscone_D] + ' notes out'), 'restored notes-out matches PARAMS.md');
    step(`share: ${hash} copied; reload restores muscone-d30, 0.25/halfway (job ${jobOf('s0.25_r0.5').slice(0, 8)}), Data view`);

    // 16. Copy my score
    await p.click('#tshare'); await wait(200);
    const ts = await txt('#toast'); let clip2 = ''; try { clip2 = await S(() => navigator.clipboard.readText()); } catch (e) { clip2 = ''; }
    ok(ts === 'Score copied' ? clip2.includes('The Quantum Nose Test') && clip2.includes(hash) : ts.includes('The Quantum Nose Test'), 'Copy my score copies a message with the link', { ts, clip2 });
    step('Copy my score: message with the link');

    // 17. every science drawer; the drawer buttons load molecules and shade bands
    const drawers = await p.$$('details.drawer');
    for (const d of drawers) { const sm = await d.$('summary'); await sm.scrollIntoViewIfNeeded(); await sm.click(); await wait(60); ok(await d.evaluate(e => e.open), 'drawer opens'); }
    ok(drawers.length === 11, '11 drawers: 4 evidence for, 4 against (The science), 3 in How it was made', drawers.length);
    await p.click('[data-zone="musk"]'); await wait(900);
    ok((await S(() => st.mol === 'muscone' && st.zone === 'musk')), 'Block 2015 button loads muscone and shades 1,380-1,550 on the roll');
    ok((await txt('#toast')) === 'Shaded on the instrument', 'zone toast (earlier wording)', await txt('#toast'));
    ok((await S(() => { const r = document.getElementById('cv2').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })), 'the page scrolls to Graph 1, where the band is shaded');
    await p.click('[data-zone="cd"]'); await wait(300);
    ok((await S(() => st.zone === 'cd')) && (await txt('#toast')).includes('Shaded'), 'Franco 2011 button shades the C-D stretch range');
    await p.click('button[data-load="exaltone"]'); await wait(300);
    ok((await S(() => st.mol === 'exaltone' && st.zone === null)) && (await txt('#toast')) === 'Loaded Cyclopentadecanone', 'Gane 2013 button loads cyclopentadecanone');
    await p.click('.against button[data-load="acetophenone"]'); await wait(300);
    ok((await S(() => st.mol === 'acetophenone')), 'Keller & Vosshall button loads acetophenone');
    ok((await txt('#joblist')).split('Jobs:')[1].match(/[0-9a-f-]{36}/g).length === JOBS.length, 'engine drawer lists every job ID');
    ok((await p.$$eval('#ltable tbody tr', r => r.length)) === 10, 'line table lists acetophenone\'s 10 lines');
    step(`opened ${drawers.length} drawers; Block/Franco/Gane/Keller buttons load molecules and shade bands; job list and line table filled`);

    // 18. the audio tour: chips jump to a pair and stop the instrument
    await p.click('#g-view button[data-view="scene"]');
    await p.click('#play'); await wait(300);
    ok(await S(() => main.playing), 'instrument playing before the tour');
    m0 = await media();
    await p.locator('#tour-chips').scrollIntoViewIfNeeded();
    await p.click('#tour-chips button:nth-child(5)'); // Exaltone · local blur
    await waitFor(() => { const t = document.getElementById('tour'); return !t.paused && t.currentTime > 64; }, 8000, 'the tour to play from 64 s');
    ok((await media()) > m0, 'tour playing');
    ok(!(await S(() => main.playing)), 'the tour stops the instrument');
    ok((await p.getAttribute('#tour-chips button:nth-child(5)', 'aria-current')) === 'true', 'the chip for the sounding pair is marked');
    ok((await txt('#tour-j1')) === jobOf('s1_r0') && (await txt('#tour-j2')) === jobOf('s0.5_r1'), 'tour text names its two jobs');
    await S(() => document.getElementById('tour').pause()); // the native player's pause
    await wait(150);
    ok(await S(() => document.getElementById('tour').paused), 'tour pauses');
    step('tour: chip "Exaltone · local blur" plays from 64 s, stops the instrument, pauses');

    // 18b. the titled sections below the scene: the earlier page's words verbatim, and every graph visible and wired to the instrument
    const secs = await p.$$eval('section.sec h2.sec-t', h => h.map(x => x.textContent.trim()));
    ok(JSON.stringify(secs) === JSON.stringify(['How to play', 'The data', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits']), 'six titled sections', secs);
    const tocN = await p.$$eval('nav.toc a', a => a.filter(x => document.querySelector(x.getAttribute('href'))).length);
    ok(tocN === 9, 'every "On this page" link has a target', tocN);
    const body = await S(() => document.body.textContent.replace(/\s+/g, ' '));
    for (const t of ['Pick a molecule and press Play to hear its vibrational chord.',
      'Swap H for D while it sounds: the hydrogen lines slide down by about a fourth.',
      'Blur the chord through the quantum circuit, from a light smear to a global scramble.',
      'Test yourself blind: which sample is deuterated?', '2 samples · 1 is deuterated',
      'One is normal, one is deuterated, in random order. Listen to both as often as you like, then pick the deuterated one. The test uses the molecule and blur chosen above.',
      'an electron crosses the receptor only if it can hand a vibrational quantum of the right energy to the molecule. He reported that acetophenone and acetophenone-d8 smell different.',
      'This page does not test it, support it or refute it. The quantum circuit did not simulate electron tunnelling, an odorant receptor or a nose.'])
      ok(body.includes(t), 'earlier words restored verbatim: ' + t.slice(0, 50));
    ok(await p.isVisible('#claims .honesty'), 'What this does not claim is visible, not behind a drawer');
    // Graph 1: the spectrum roll, always drawn in The data, sharing the instrument's playhead and transport
    await p.locator('#g-roll').scrollIntoViewIfNeeded(); await wait(300);
    const inkOf = id => S(i => { const c = document.getElementById(i), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 120 && d[k + 2] > 100) n++; return n; }, id);
    const ink2 = await inkOf('cv2');
    ok(ink2 > 2000, 'Graph 1 (the spectrum roll) is drawn in The data', ink2);
    ok((await txt('#legend2')) === (await txt('#legend')) && (await txt('#legend2')).length > 10, 'Graph 1 carries the instrument legend');
    ok((await txt('#shift2')).includes('semitones'), 'Graph 1 caption carries the shift line');
    const b2 = await p.locator('#cv2').boundingBox();
    await p.mouse.click(b2.x + b2.width * 0.33, b2.y + b2.height * 0.5); await wait(150);
    const t2 = await S(() => main.pos);
    ok(t2 > 1 && t2 < 3.5, 'clicking Graph 1 moves the shared playhead', t2);
    s0 = await src();
    await p.click('#play2'); await wait(500);
    ok((await S(() => main.playing)) && (await src()) > s0 && (await txt('#play2')) === 'Pause' && (await txt('#play')) === 'Pause', 'Graph 1 Play plays the instrument; both Play buttons say Pause');
    const iso2 = await S(() => st.iso);
    await p.click('#swap2'); await wait(250);
    ok((await S(() => st.iso)) !== iso2, 'Graph 1 Swap swaps H and D');
    await p.click('#play2'); await wait(150);
    ok(!(await S(() => main.playing)), 'Graph 1 Pause pauses');
    // Graph 2: every chord x every blur, drawn live; a cell loads into the instrument
    await p.locator('#g-grid').scrollIntoViewIfNeeded(); await wait(200);
    const gink = await inkOf('grid');
    ok(gink > 8000, 'Graph 2 is drawn from the note lists', gink);
    const cell = await S(() => { const c = document.getElementById('grid'), r = c.getBoundingClientRect(), q = gcell(GCOLS.indexOf('s1_r0'), GROWS.findIndex(([m, i]) => m === 'exaltone' && i === 'D')); return [r.left + (q.x + q.w / 2) / GW * r.width, r.top + (q.y + q.h / 2) / GH * r.height]; });
    await p.mouse.click(cell[0], cell[1]); await wait(250);
    ok((await S(() => st.mol === 'exaltone' && st.iso === 'D' && curSet() === 's1_r0')), 'a Graph 2 cell loads cyclopentadecanone-d28, strength 1, reach 0 into the instrument');
    ok((await txt('#r-job')) === jobOf('s1_r0') && (await pressed('#g-str button[data-str="1"]')) === 'true' && (await pressed('#g-mol button[data-mol="exaltone"]')) === 'true', 'the instrument controls and readouts follow Graph 2');
    ok((await txt('#grid-read')).includes(jobOf('s1_r0')), 'Graph 2 names the framed cell and its job');
    await p.focus('#grid'); await p.keyboard.press('ArrowLeft'); await wait(150);
    ok((await S(() => curSet())) === 's0.5_r0', 'arrow keys move along Graph 2', await S(() => curSet()));
    // Table 1 follows the molecule
    ok((await p.$$eval('#ltable tbody tr', r => r.length)) === 9 && (await txt('#lt-mol')).includes('Cyclopentadecanone'), 'Table 1 follows the molecule (cyclopentadecanone, 9 lines)');
    // Jobs and credits: every job, with notes out matching PARAMS.md, each loadable
    ok((await p.$$eval('#jobtable tbody tr', r => r.length)) === JOBS.length + 1, 'jobs table: every job plus the input score');
    const outs = await p.$$eval('#jobtable tbody tr[data-key]', r => r.map(x => [x.dataset.key, x.children[2].textContent, x.children[4].textContent]));
    for (const [k, id, o] of outs) if (k !== 'clean') { ok(id === jobOf(k), 'job ID for ' + k, id); ok(o.replace(/\s/g, '') === NOTES_OUT[k].join('/'), 'notes out for ' + k + ' match PARAMS.md', o); }
    await p.click('#jobtable button[data-job="s0.25_r1"]'); await wait(200);
    ok((await S(() => curSet())) === 's0.25_r1' && (await txt('#r-job')) === jobOf('s0.25_r1'), 'Load in the jobs table sets the instrument to that job');
    ok((await p.getAttribute('#jobtable tr[data-key="s0.25_r1"]', 'class')) === 'cur', 'the loaded job is marked');
    // the Turin drawer points at the figure it describes; the index jumps to a section
    await p.click('[data-fig="fig-d"]'); await wait(900);
    ok((await S(() => { const r = document.getElementById('fig-d').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && performance.now() < elecUntil; })), 'Turin 1996 "See it drawn" scrolls to Fig. d and sets the electron going');
    await p.click('nav.toc a[href="#jobs"]'); await wait(500);
    ok((await S(() => { const r = document.getElementById('jobs').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })), 'On this page: "Jobs and credits" jumps to its section');
    step(`sections: ${secs.join(' / ')}; earlier words verbatim; Graph 1 drawn (${ink2} ink px), shares playhead and transport; Graph 2 (${gink} ink px) loads cells; Table 1 and the jobs table follow; Turin -> Fig. d; index links`);

    // 19. the set: prev / hub / next and the jump list
    const prev = await p.getAttribute('nav.wtnr-nav a[rel="prev"]', 'href'), next = await p.getAttribute('nav.wtnr-nav a[rel="next"]', 'href');
    ok(prev === URLS['20-antimatter-drop'] && next === URLS['22-scroll-unroll'], 'prev/next point at 20 and 22', { prev, next });
    ok((await p.getAttribute('nav.wtnr-nav a.wn-hub', 'href')) === HUB, 'nav hub link');
    ok((await txt('nav.wtnr-nav a[rel="prev"]')).includes('20') && (await txt('nav.wtnr-nav a[rel="next"]')).includes('22'), 'prev/next labels name the pieces');
    await p.click('nav.wtnr-nav summary');
    const jl = await p.$$eval('nav.wtnr-nav ol a', a => a.map(x => ({ href: x.getAttribute('href'), cur: x.getAttribute('aria-current') })));
    ok(jl.length === Object.keys(URLS).length && jl.every(x => Object.values(URLS).includes(x.href)), 'jump list links every published piece', jl.length);
    ok(jl.filter(x => x.cur === 'page').map(x => x.href).join() === URLS['21-quantum-nose'], 'this piece is marked current');
    ok((await p.$$eval('nav.wtnr-nav + p.wtnr-foot', e => e.length)) === 1, 'nav sits just before the footer');
    step(`nav: prev 20, hub, next 22, and a ${jl.length}-piece jump list`);

    const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
    ok(!bad.length, 'no requests to other hosts', bad);
    ok(!errors.length, 'no page errors', errors.slice(0, 5));
    step('no page errors; no external requests beyond Google Fonts');
    result = { ok: true, steps };
  } catch (e) {
    result = { ok: false, steps, failed: String(e.message || e).slice(0, 600), errors: errors.slice(0, 5) };
    try { await p.screenshot({ path: path.join(PIECE, 'qa', 'e2e-fail.png') }); } catch (_) {}
  }
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close(); srv.close();
  process.exit(result.ok ? 0 : 1);
})();
