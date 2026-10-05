// Exercise the built page under jsdom: every stage renders in Scene and Data views, every control fires, no exceptions.
// Usage: NODE_PATH=<dir with jsdom> node test_page.cjs   (canvas and audio are stubbed; this tests logic, not pixels)
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'web', 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/#comet',
  beforeParse(w) {
    const any = () => new Proxy(function () {}, { get: (t, k) => (k === 'data' ? new Uint8ClampedArray(160 * 160 * 4) : k === Symbol.toPrimitive ? () => 1 : any()), apply: () => any(), set: () => true });
    w.HTMLCanvasElement.prototype.getContext = function () { return any(); };
    w.matchMedia = () => ({ matches: false, addEventListener() {} });
    const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
    const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), type: 'sine' });
    w.AudioContext = function () { return { currentTime: 0, state: 'running', resume() {}, destination: {}, createGain: node, createOscillator: node }; };
    w.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {}, currentTime: 0, duration: 1 }; };
    w.navigator.clipboard = { writeText: () => Promise.resolve() };
    w.HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new w.Event('playing')); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function () {};
    w.HTMLMediaElement.prototype.load = function () {};
    w.addEventListener('error', e => errors.push('window error: ' + (e.error && e.error.stack || e.message)));
    w.console.error = (...a) => errors.push('console.error: ' + a.join(' '));
  },
});
const w = dom.window, d = w.document;
const ids = JSON.parse(JSON.stringify(w.eval('CHAIN.map(s => s.id)')));
let clicks = 0;
if (!d.getElementById('c-title').textContent.trim()) errors.push('initial render empty');
if (w.eval('CHAIN[cur].id') !== 'comet') errors.push('hash #comet did not select the comet stage');
const exercise = (i, mode) => {
  const view = d.getElementById('view');
  if (!view.children.length) errors.push(`stage ${ids[i]} (${mode}): empty view`);
  // press every button and nudge every slider inside the view, poke every canvas
  for (const b of [...view.querySelectorAll('button')]) { b.click(); clicks++; }
  for (const r of [...view.querySelectorAll('input[type=range]')]) { r.value = r.max; r.dispatchEvent(new w.Event('input')); r.value = r.min; r.dispatchEvent(new w.Event('input')); clicks++; }
  for (const c of [...view.querySelectorAll('canvas')]) { c.dispatchEvent(new w.MouseEvent('click', {clientX: 5, clientY: 5})); c.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'ArrowRight'})); clicks++; }
  for (const b of [...view.querySelectorAll('button')]) { b.click(); clicks++; }   // toggle back (stop players)
  try { w.eval('SCENE && SCENE.draw(NOW() + 0.5); SCENE && SCENE.draw(NOW() + 3)'); } catch (e) { errors.push(`stage ${ids[i]} (${mode}) scene draw: ${e.message}`); }
};
const modeBtn = m => d.querySelector(`#mode button[data-m="${m}"]`);
for (let i = 0; i < ids.length; i++) {
  try {
    w.eval(`go(${i})`);
    modeBtn('scene').click(); exercise(i, 'scene');
    if (!w.eval('SCENE')) errors.push(`stage ${ids[i]}: no pixel scene`);
    modeBtn('data').click(); exercise(i, 'data');
    modeBtn('scene').click();
    const tb = d.getElementById('tune-btn'); tb.click(); tb.click(); clicks += 2;      // page-level sound on, off
    if (!d.getElementById('readout').children.length) errors.push(`stage ${ids[i]}: empty readout`);
    if (!d.getElementById('say').textContent.trim()) errors.push(`stage ${ids[i]}: Tweezy says nothing`);
    if (w.location.hash !== '#' + ids[i]) errors.push(`stage ${ids[i]}: hash not updated`);
  } catch (e) { errors.push(`stage ${ids[i]}: ${e.stack}`); }
}
// stepper wraps around; lab stations, lab buttons and curve markers navigate; the path and clock draw mid-walk
d.getElementById('next').click(); if (w.eval('cur') !== 0) errors.push('next did not wrap to 0');
d.getElementById('prev').click(); if (w.eval('cur') !== ids.length - 1) errors.push('prev did not wrap to last');
const stns = d.querySelectorAll('#stns .stn'); if (stns.length !== ids.length) errors.push(`lab has ${stns.length} stations for ${ids.length} stages`);
stns[2].click(); if (w.eval('cur') !== 2) errors.push('station click did not navigate');
try { w.eval('pathDraw(NOW() + 0.3); pathDraw(NOW() + 5)'); } catch (e) { errors.push('path draw: ' + e.message); }
d.getElementById('lab-next').click(); if (w.eval('cur') !== 3) errors.push('lab Later did not navigate');
d.getElementById('lab-prev').click(); if (w.eval('cur') !== 2) errors.push('lab Earlier did not navigate');
const moods = JSON.parse(JSON.stringify(w.eval('CHAIN.map(MOOD)')));
if (!moods.includes('happy') || !moods.includes('sad')) errors.push('moods look wrong: ' + moods.join(','));
const pts = d.querySelectorAll('#curve .pt'); pts[4].dispatchEvent(new w.Event('click')); if (w.eval('cur') !== 4) errors.push('curve point click did not navigate');
d.getElementById('share').click();
setTimeout(() => {
  console.log(`stages ${ids.length}, controls exercised ${clicks}, errors ${errors.length}`);
  errors.forEach(e => console.log(' - ' + e));
  process.exit(errors.length ? 1 : 0);
}, 300);
