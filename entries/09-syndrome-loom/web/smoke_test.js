// Run the whole page script in node against a stub DOM and press every control once.
// Catches runtime errors in the UI code (the browser pane is shared, so no live browser here).
// Usage: node web/smoke_test.js web/index.html
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(process.argv[2], 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];

const handlers = {};
const els = {};
let draws = 0;
const texts = [];
function el(id) {
  if (els[id]) return els[id];
  const e = {
    id, textContent: '', innerHTML: '', value: '', hidden: false, className: '', max: 0, dataset: {}, attrs: {},
    style: {}, files: [], children: [],
    addEventListener(t, f) { (handlers[id + ':' + t] = handlers[id + ':' + t] || []).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    focus() {}, select() {},
    classList: {add() {}, remove() {}},
    getBoundingClientRect() { return {left: 0, top: 0, width: 1344, height: 1008}; },
  };
  // every element can hand out a 2D context: the scene canvas, the offscreen cloth and the sprite bakes.
  // Unknown methods are no-ops; property writes are stored; drawing calls are counted.
  e.width = id === 'cv' ? 720 : 0; e.height = id === 'cv' ? 720 : 0;
  e.getContext = () => {
    const base = {
      createImageData: (w, h) => ({width: w, height: h, data: new Uint8ClampedArray(w * h * 4)}),
      getImageData: (x, y, w, h) => ({width: w, height: h, data: new Uint8ClampedArray(w * h * 4)}),
      measureText: s => ({width: String(s).length * 7}),
      drawImage() { draws++; }, fillText() { texts.push(arguments[0]); },
    };
    return new Proxy(base, {get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }});
  };
  els[id] = e;
  return e;
}
// buttons that the page finds with querySelectorAll, by data attribute
const groups = {
  '[data-view]': ['received', 'corrected'].map(v => ({dataset: {view: v}})),
  '[data-cw]': ['plain', 'measured'].map(v => ({dataset: {cw: v}})),
  '[data-prof]': ['loom', 'thread'].map(v => ({dataset: {prof: v}})),
  '[data-mode]': ['scene', 'data'].map(v => ({dataset: {mode: v}})),
};
for (const [sel, list] of Object.entries(groups)) list.forEach((b, i) => {
  b.attrs = {}; b.setAttribute = function (k, v) { this.attrs[k] = v; };
  b.addEventListener = (t, f) => { (handlers[sel + i + ':' + t] = handlers[sel + i + ':' + t] || []).push(f); };
});
let tickButtons = [];
global.document = {
  getElementById: el,
  querySelectorAll(sel) {
    if (sel === '#ticks button') return tickButtons;
    return groups[sel] || [];
  },
  createElement: () => el('tmp' + Math.random()),
};
// #ticks innerHTML assignment creates three buttons
Object.defineProperty(el('ticks'), 'innerHTML', {set(v) {
  tickButtons = [...v.matchAll(/data-p="([^"]+)"/g)].map((m, i) => ({dataset: {p: m[1]}, attrs: {},
    setAttribute(k, x) { this.attrs[k] = x; }, addEventListener(t, f) { (handlers['tick' + i + ':' + t] = handlers['tick' + i + ':' + t] || []).push(f); }}));
}, get() { return ''; }});
global.ImageData = function (w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); };
global.matchMedia = () => ({matches: false});
let rafQ = [];
global.requestAnimationFrame = f => { rafQ.push(f); return rafQ.length; };
global.cancelAnimationFrame = () => {};
global.performance = {now: () => Date.now()};
global.location = {hash: '#thread_p0.01_s7_read_measured', href: 'https://example.invalid/#x'};
global.history = {replaceState(a, b, h) { location.hash = h; }};
let clip = null;
Object.defineProperty(globalThis, 'navigator', {value: {clipboard: {writeText: async t => { clip = t; }}}, configurable: true});
global.URL = {createObjectURL: () => 'blob:x', revokeObjectURL() {}};
global.setTimeout = () => 0; global.clearTimeout = () => {};

new Function(script)();
const fire = (key, ev = {}) => (handlers[key] || []).forEach(f => f(ev));
const flush = (n = 400) => { for (let i = 0; i < n && rafQ.length; i++) { const q = rafQ; rafQ = []; q.forEach(f => f(performance.now() + i * 40)); } };

// the shared link in location.hash was applied
assert.strictEqual(el('p-val').textContent, '0.01');
assert(/^\d+$/.test(el('m-red').textContent));
// dial, ticks, profile, view, codewords, re-roll
el('dial').value = '0'; fire('dial:input'); flush(); assert.strictEqual(el('p-val').textContent, '0.001');
fire('tick2:click'); flush(); assert.strictEqual(el('p-val').textContent, '0.01');
fire('[data-prof]0:click'); fire('[data-view]1:click'); fire('[data-cw]0:click'); flush();
fire('reroll:click'); flush();
// weave: start, pause, scrub, finish
fire('weave:click'); flush(5); fire('weave:click'); el('picks').value = '40'; fire('picks:input');
fire('weave:click'); flush(2000);
assert(texts.some(t => /caught$/.test(t)), 'the inspector never reported a caught row');
assert(texts.some(t => /slipped through$/.test(t)), 'the weaver never reacted to the finished cloth');
assert(draws > 100, 'the scene never drew sprites');
// scene / data toggle and the loom sound switch (no Web Audio in node: it must fail softly)
fire('[data-mode]1:click'); assert(el('data-wrap').hidden === false && el('scene-wrap').hidden === true);
fire('[data-mode]0:click'); assert(el('scene-wrap').hidden === false);
fire('sound:click'); fire('sound:click');
// inspector by click and keys (a point inside the cloth of the 720 px wide scene)
fire('cv:click', {clientX: 300, clientY: 420}); assert(el('inspect').innerHTML.includes('Syndrome'));
flush(3); assert(texts.some(t => /^syndrome /.test(t)), 'the inspector did not read the block');
fire('cv:keydown', {key: 'ArrowRight', preventDefault() {}}); fire('cv:keydown', {key: 'ArrowDown', preventDefault() {}});
// copy WIF and link
(async () => {
  fire('copy-wif:click'); await new Promise(r => setImmediate(r));
  assert(clip && clip.startsWith('[WIF]\r\nVersion=1.1'), 'WIF not copied');
  fire('share:click'); await new Promise(r => setImmediate(r));
  assert(/^#(loom|thread)_p[0-9.]+_s\d+_(read|fixed)_(plain|measured)$/.test(location.hash), location.hash);
  console.log('smoke test OK: every control ran without errors; link token ' + location.hash);
})();
