// Unit-test the page's pure logic in node with a stub DOM: node test_page.js
// Checks the in-browser machine (halt step, ones), checkpoint seeking against Python's column table,
// note decoding, the voice budget, phrase lookup, the pitch mapping and the share-link parser.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'web', 'index.html'), 'utf8');
const score = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'score.json'), 'utf8'));
const src = html.split('<script>')[1].split('</script>')[0];

const ctxStub = new Proxy({}, { get: (t, k) => k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
  : k === 'measureText' ? () => ({ width: 30 }) : (k in t ? t[k] : () => {}), set: (t, k, v) => (t[k] = v, true) });
// stub elements record their attributes, listeners and children, so control wiring can be tested
function el(props) {
  return Object.assign({ textContent: '', innerHTML: '', value: '0', max: '0', dataset: {}, style: {}, width: 800, height: 64,
    attrs: {}, listeners: [], children: [],
    classList: { add() {}, remove() {}, toggle() {} }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, querySelectorAll() { return this.children; },
    addEventListener(type, fn) { this.listeners.push({ type, fn }); }, appendChild(c) { this.children.push(c); return c; },
    getContext: () => ctxStub, getBoundingClientRect: () => ({ width: 800, height: 64, left: 0, top: 0 }), focus() {}, matches: () => false }, props || {});
}
const els = {};
// the static segmented buttons in the template (strength buttons are created by the script inside #g-strength)
const btn = (key, val) => el({ dataset: { [key]: val } });
const groups = { score: ['raw', 'blur'].map(v => btn('score', v)), grid: ['0', '60'].map(v => btn('grid', v)), reach: ['0', '1'].map(v => btn('reach', v)) };
const document = { getElementById: id => (els[id] = els[id] || el()), createElement: () => el(), querySelector: () => el(),
  querySelectorAll: sel => { const m = /^\[data-(\w+)\]$/.exec(sel); if (!m) return [];
    return m[1] === 'strength' ? (els['g-strength'] ? els['g-strength'].children : []) : (groups[m[1]] || []); },
  addEventListener() {} };
// fake Web Audio: records every oscillator start so scheduling can be checked
const audioLog = { starts: [], now: 0 };
function param() { return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} }; }
function node(extra) { return Object.assign({ connect() {}, disconnect() {}, gain: param(), frequency: param(), threshold: param(), ratio: param() }, extra || {}); }
class FakeAC {
  get currentTime() { return audioLog.now; }
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
  createGain() { return node(); } createDynamicsCompressor() { return node(); } createConvolver() { return node(); }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
  createOscillator() { const o = node({ type: '', start(t) { audioLog.starts.push(t); }, stop() {}, onended: null }); return o; }
  resume() {}
}
const window = { addEventListener() {}, devicePixelRatio: 1, AudioContext: FakeAC };
// the inlined InkSprite helper registers itself on window, which in a browser is the global object
Object.defineProperty(window, 'InkSprite', { set(v) { globalThis.InkSprite = v; }, get() { return globalThis.InkSprite; } });
const location = { hash: '#c1234.ms0.5r0.t22', href: 'x' };
const api = new Function('document', 'window', 'location', 'history', 'navigator', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
  src + '\n;return {HALT_COL, play, pause, schedule, seekCol, setMode, sim, seekStep, cps, COLSTEP, P, decode, MODES, phraseOf, cellX, deg2midi, st, lowerBound, modeId, TOTAL, OFF, HALT, isVerified: () => verified, MAXV,' +
  ' drawScene, SPR, SPX, CELLS, scene: () => ({ lastBx, wasHalted, celebT, damLo, damHi, AW, S })};')(
  document, window, location, { replaceState() {} }, {}, () => ({ matches: false }), () => 0, () => {});

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

setTimeout(function wait() {
  if (!api.isVerified() && api.cps.length * (1 << 19) < api.HALT) return setTimeout(wait, 20);
  ok(api.isVerified(), 'in-page machine halts at 47,176,870 with 4,098 ones');
  ok(api.cps.length === Math.floor(api.HALT / (1 << 19)) + 1, 'checkpoints cover the run (' + api.cps.length + ')');
  // the page's machine agrees with Python on the head cell at every 37th column, in random seek order
  const cols = []; for (let c = 0; c < api.TOTAL; c += 37) cols.push(c);
  cols.sort(() => Math.random() - 0.5);
  let bad = 0; for (const c of cols) { api.seekStep(api.COLSTEP[c]); if (api.sim.pos - api.OFF !== score.col_cell[c]) bad++; }
  ok(bad === 0, `head cell matches Python at ${cols.length} columns sought in random order (${bad} mismatches)`);
  // phrase starts: state A, block of x ones right of the head
  let pbad = 0; for (const p of api.P.slice(0, 14)) { api.seekStep(p.start_step); if (api.sim.q !== 0 || api.sim.ones !== p.x || api.sim.tape[api.sim.pos + 1] !== (p.x ? 1 : 0)) pbad++; }
  ok(pbad === 0, 'every phrase starts in state A with x ones on the tape');
  api.seekStep(api.HALT); ok(api.sim.q === 5 && api.sim.ones === 4098 && api.sim.step === api.HALT, 'seek to the halt');
  api.seekStep(10); ok(api.sim.step === 10 && api.sim.q !== 5, 'seek back to step 10');
  // decoding + voice budget
  for (const id of Object.keys(api.MODES)) {
    const m = api.decode(api.MODES[id]); let sorted = true, over = 0;
    for (let i = 1; i < m.count; i++) if (m.start[i] < m.start[i - 1]) sorted = false;
    for (let i = 0; i < m.count;) { let j = i, a = 0; while (j < m.count && m.start[j] === m.start[i]) { a += m.aud[j]; j++; } if (a > (m.start[i] >= api.TOTAL - 24 ? 32 : api.MAXV)) over++; i = j; }
    ok(m.count === m.n && sorted && over === 0, `${id}: ${m.count} notes decode sorted, <= ${api.MAXV} audible per step (32 on the final chord)`);
  }
  const raw = api.decode(api.MODES.raw);
  const rnd = v => { const f = Math.floor(v), d = v - f; return Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); }; // Python round(): half to even
  let pm = 0; for (let i = 0; i < raw.count; i++) if (raw.trk[i] === 0 && raw.dur[i] === 1) { const c = raw.start[i]; if (raw.pitch[i] !== api.deg2midi(score.phrases[score.col_phrase[c]].deg_lo + rnd((score.col_cell[c] - score.phrases[score.col_phrase[c]].lo) / Math.max(1, score.phrases[score.col_phrase[c]].hi - score.phrases[score.col_phrase[c]].lo) * (score.phrases[score.col_phrase[c]].degrees - 1)))) pm++; }
  ok(pm === 0, 'every raw melody note is the pitch of its head cell (' + pm + ' mismatches)');
  ok(api.phraseOf(0) === 0 && api.phraseOf(api.TOTAL - 1) === 14 && api.phraseOf(api.P[9].col0) === 9 && api.phraseOf(api.P[9].col0 - 1) === 8, 'phraseOf boundaries');
  ok(api.lowerBound(new Float32Array([1, 2, 2, 3]), 2) === 1 && api.lowerBound(new Float32Array([1, 2]), 9) === 2, 'lowerBound');
  const k = 13, p = api.P[k]; ok(api.cellX(k, p.lo) < api.cellX(k, p.hi) && Math.abs(api.cellX(k, p.lo) - (16 + (api.deg2midi(p.deg_lo) + 0.5 - 30) / 68 * 968)) < 1e-6, 'cellX: left end of the tape = lowest note');
  ok(api.st.col === 1234 && api.st.rate === 22 && api.modeId() === 's0.5r0', 'share link #c1234.ms0.5r0.t22 restores col, tempo and score');
  // control wiring: every button and the tempo slider carry exactly one handler, and the count stays constant
  // however many times the controls are used (syncControls must never add listeners)
  const strengthBtns = els['g-strength'].children, ctls = [...groups.score, ...groups.grid, ...groups.reach, ...strengthBtns, els.tempo];
  const nL = () => ctls.reduce((a, b) => a + b.listeners.length, 0);
  const fire = (b, type) => b.listeners.filter(l => l.type === type).forEach(l => l.fn({}));
  const L0 = nL();
  ok(strengthBtns.length === 2 && L0 === ctls.length && ctls.every(b => b.listeners.length === 1), `one handler per control at load (${L0} on ${ctls.length} controls)`);
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) { fire(groups.grid[i % 2], 'click'); fire(groups.score[i % 2], 'click'); fire(groups.reach[i % 2], 'click');
    fire(strengthBtns[i % 2], 'click'); els.tempo.value = String(4 + i % 37); fire(els.tempo, 'input'); if (nL() !== L0) break; }  // a leak doubles per click: stop early
  ok(nL() === L0, `listener count unchanged after 200 control events (${nL()} == ${L0}, ${Date.now() - t0} ms)`);
  // control semantics: grid 1/32 exists only for strength 0.2; picking 0.5 falls back to the 1/16 grid and disables 1/32
  fire(groups.score[1], 'click'); fire(strengthBtns[0], 'click'); fire(groups.reach[1], 'click'); fire(groups.grid[1], 'click');
  ok(api.modeId() === 's0.2r1x60' && groups.grid[1].attrs['aria-pressed'] === 'true' && groups.grid[0].attrs['aria-pressed'] === 'false', 'grid 1/32 click selects s0.2r1x60');
  fire(strengthBtns[1], 'click');
  ok(api.modeId() === 's0.5r1' && groups.grid[0].attrs['aria-pressed'] === 'true', 'strength 0.5 falls back to the 1/16 grid');
  fire(groups.grid[1], 'click');
  ok(api.modeId() === 's0.2r1x60' && strengthBtns[0].attrs['aria-pressed'] === 'true' && !groups.grid[1].disabled, 'grid 1/32 at strength 0.5 is never dead: it moves to strength 0.2 (the only 1/32 jobs)');
  fire(strengthBtns[1], 'click');
  fire(groups.score[0], 'click'); ok(api.modeId() === 'raw' && groups.score[0].attrs['aria-pressed'] === 'true', 'Raw click returns to the raw score');
  // with Raw on, the blur's settings are idle (dimmed) but live, never announced as disabled; picking one switches to the blur
  ok(['g-reach', 'g-strength', 'g-grid'].every(id => els[id].dataset.idle === 'true' && !('aria-disabled' in els[id].attrs) && /switches to the quantum blur/.test(els[id].attrs['aria-label'])) && strengthBtns[0].title === 'Switch to the quantum blur at this setting',
    'with Raw on, the reach/strength/grid groups are idle and labelled as switching to the blur (not disabled)');
  fire(strengthBtns[0], 'click'); ok(api.modeId() !== 'raw' && api.st.strength === 0.2 && els['g-strength'].dataset.idle === 'false' && els['g-strength'].attrs['aria-label'] === 'Blur strength', 'from Raw, picking strength 0.2 switches to the blur and the groups leave the idle state');
  fire(groups.score[0], 'click');
  els.tempo.value = '20'; fire(els.tempo, 'input'); ok(api.st.rate === 20 && els['tempo-lab'].textContent === '20 notes/s', 'tempo slider sets 20 notes/s');
  // phrase and halt buttons: Phrase > in the last phrase goes forward to the halt (never backwards); Jump to the halt lands on the halting note
  api.seekCol(api.P[14].col0 + 5); fire(els.next, 'click');
  ok(api.st.col === api.HALT_COL && api.COLSTEP[api.HALT_COL] === api.HALT && api.COLSTEP[api.HALT_COL - 1] < api.HALT, 'Phrase > in the last phrase goes forward to the halt (column ' + api.HALT_COL + ')');
  ok(els.next.disabled === true && els.prev.disabled === false, 'at the halt Phrase > is disabled and < Phrase is not');
  fire(els.prev, 'click'); ok(api.st.col === api.P[14].col0, '< Phrase from the halt goes to the start of the halting phrase');
  api.seekCol(0); ok(els.prev.disabled === true && els.next.disabled === false, 'at note 1 < Phrase is disabled');
  fire(els.next, 'click'); ok(api.st.col === api.P[1].col0, 'Phrase > from note 1 goes to phrase 2');
  fire(els.halt, 'click'); ok(api.st.col === api.HALT_COL, 'Jump to the halt lands on the first halted note');
  api.seekCol(0);
  // audio scheduling: play raw from note 0 for 2 s at 15 notes/s -> about 30 head notes + bass
  try {
    api.st.rate = 15; api.setMode(() => api.st.score = 'raw'); api.seekCol(0); audioLog.now = 1; api.play();
    for (let t = 0; t < 80; t++) { audioLog.now += 0.025; api.schedule(); }
    const n1 = audioLog.starts.length / 2;     // 2 oscillators per voice
    ok(n1 >= 30 && n1 <= 40, `raw playback scheduled ${n1} voices in 2 s at 15 notes/s`);
    api.st.rate = 40; api.seekCol(3000); for (let t = 0; t < 40; t++) { audioLog.now += 0.025; api.schedule(); }
    api.setMode(() => { api.st.score = 'blur'; api.st.strength = 0.5; api.st.reach = 1; api.st.grid = 0; });
    const before = audioLog.starts.length; for (let t = 0; t < 40; t++) { audioLog.now += 0.025; api.schedule(); }
    const v = (audioLog.starts.length - before) / 2;
    ok(api.modeId() === 's0.5r1' && v > 0 && v <= 10 * 40 * 1.2 + 10, `dense blur s0.5r1 at 40 notes/s: ${v} voices in 1 s (budget 10 per step)`);
    api.pause(); ok(!api.st.playing, 'pause stops playback');
  } catch (e) { ok(false, 'audio path threw: ' + e.stack); }
  // the scene: sprites, the beaver's cell, the far dam and the halt celebration (after any hop animation from the seeks above)
  setTimeout(() => {
  try {
    const names = ['beaver_idle', 'beaver_hop', 'beaver_gnaw', 'beaver_slap', 'beaver_cheer', 'hat', 'log', 'wave', 'lodge', 'pin', 'mascot', 'glyph_A', 'glyph_E', 'glyph_H'];
    const pal = new Set('.KBLTWOG');
    const badPx = names.filter(n => !api.SPR[n] || api.SPR[n].frames.some(f => f.some(r => [...r].some(ch => !pal.has(ch)))));
    ok(badPx.length === 0, 'sprites exist and use only the shared ink palette (' + (badPx.join(',') || 'all ok') + ')');
    const rect = names.every(n => api.SPR[n].frames.every(f => f.every(r => r.length === f[0].length) && f.length === api.SPR[n].frames[0].length));
    ok(rect, 'every sprite frame is a clean rectangle');
    api.pause(); api.st.playing = false;
    let cb = 0; for (const c of [0, 5, 77, 1500, 3999]) { api.st.col = c; api.drawScene(c); if (api.scene().lastBx !== api.CELLS[c]) cb++; }
    ok(cb === 0, "paused, the beaver stands on the head's real cell (5 columns)");
    api.st.col = 0; api.drawScene(0);
    ok(!api.scene().wasHalted, 'not halted at the start');
    const firstHalt = api.COLSTEP.indexOf(api.HALT);
    api.st.col = firstHalt; api.drawScene(firstHalt); const sc1 = api.scene();
    ok(sc1.wasHalted && sc1.celebT > 0 && api.sim.step === 47176870 && api.sim.ones === 4098, `dam-complete fires at the real halt (column ${firstHalt}, step ${api.sim.step})`);
    ok(sc1.damHi - sc1.damLo + 1 === 12289, `far dam at the halt spans ${sc1.damHi - sc1.damLo + 1} cells`);
    api.st.col = firstHalt - 1; api.drawScene(firstHalt - 1); ok(!api.scene().wasHalted, 'one note before the halt the dam is not complete');
  } catch (e) { ok(false, 'scene path threw: ' + e.stack); }
  console.log(fails ? fails + ' FAILED' : 'all page tests passed');
  process.exit(fails ? 1 : 0);
  }, 400);
}, 50);
