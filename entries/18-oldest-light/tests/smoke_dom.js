// DOM smoke test of the built page with jsdom (canvas stubbed). Needs jsdom: `npm install jsdom`
// (or NODE_PATH pointing at a node_modules that has it). Usage: node tests/smoke_dom.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>', {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.invalid/#v1~s6~kg~mb~z2.00~x100.0~y90.0~w30~c1',
  beforeParse(w){
    const calls = {drawImage: 0};
    const ctx = new Proxy({calls}, {get: (t, k) => k in t ? t[k] : (k === 'createImageData' ? (a, b) => ({data: new Uint8ClampedArray(a * b * 4)}) :
      (k === 'drawImage' ? () => { calls.drawImage++; } : k === 'measureText' ? (t) => ({width: 12 * String(t).length}) : () => {})), set: (t, k, v) => { t[k] = v; return true; }});
    w.HTMLCanvasElement.prototype.getContext = function(){ return ctx; };
    w.HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,'; };   // jsdom has no canvas backend; the sprite helper asks for PNG URLs
    w.__ctx = ctx;
    w.matchMedia = () => ({matches: false, addEventListener(){}});
    w.HTMLElement.prototype.scrollIntoView = function(){};
    w.HTMLElement.prototype.setPointerCapture = function(){};
    w.navigator.clipboard = {writeText: async () => {}};
    w.addEventListener('error', (e) => errors.push(e.message));
  }
});
const w = dom.window, d = w.document, $ = (id) => d.getElementById(id);
const fire = (el, type, opts = {}) => { const e = new w.MouseEvent(type, {bubbles: true, cancelable: true, ...opts}); if ("pointerId" in opts) Object.defineProperty(e, "pointerId", {value: opts.pointerId}); el.dispatchEvent(e); };
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
setTimeout(() => {
  ok('page script ran without errors and drew the sky', () => { assert.deepStrictEqual(errors, []); assert.ok(w.__ctx.calls.drawImage > 0); });
  ok('shared link restored: Gaussian, blurred-only, strength 1, Cold Spot on', () => {
    assert.strictEqual($('lvl').value, '6'); assert.match($('tag-r').textContent, /Gaussian beam/); assert.strictEqual($('tag-l').hidden, true);
    assert.strictEqual($('cold').getAttribute('aria-pressed'), 'true'); assert.match($('r-qubits').textContent, /classical/);
  });
  ok('quantum mode shows the real job id and 18 qubits', () => {
    d.querySelector('[data-kind="q"]').click();
    assert.match($('r-job').textContent, /^[0-9a-f-]{36} /); assert.match($('r-qubits').textContent, /^18 /); assert.match($('r-engine').textContent, /statevector simulator/);
  });
  ok('slider walks through every stop', () => {
    const seen = new Set();
    for (let v = 0; v <= 6; v++){ $('lvl').value = String(v); $('lvl').dispatchEvent(new w.Event('input')); seen.add($('r-job').textContent); }
    assert.strictEqual(seen.size, 7); // 6 jobs + the "no quantum job" text at strength 0
  });
  ok('view modes and the COBE reference', () => {
    for (const m of ['w', 'o', 'b']){ d.querySelector(`[data-mode="${m}"]`).click(); assert.strictEqual(d.querySelector(`[data-mode="${m}"]`).getAttribute('aria-pressed'), 'true'); }
    d.querySelector('[data-kind="c"]').click(); assert.strictEqual($('lvl').disabled, true); assert.match($('beam-txt').textContent, /COBE/);
  });
  ok('story buttons drive the instrument', () => {
    for (const b of d.querySelectorAll('[data-show]')) b.click();
    assert.ok(d.querySelector('#c5').classList.contains('on')); assert.match($('tag-r').textContent, /COBE/);
    d.querySelector('[data-show="3"]').click(); assert.strictEqual($('cold').getAttribute('aria-pressed'), 'true');
  });
  ok('pointer pan, wipe drag and keyboard', () => {
    const cv = $('cv'); cv.getBoundingClientRect = () => ({left: 0, top: 0, width: 512, height: 512});
    d.querySelector('[data-show="4"]').click();
    fire(cv, 'pointerdown', {clientX: 256, clientY: 100, pointerId: 1}); fire(cv, 'pointermove', {clientX: 120, clientY: 100, pointerId: 1}); fire(cv, 'pointerup', {clientX: 120, clientY: 100, pointerId: 1});
    fire(cv, 'pointerdown', {clientX: 400, clientY: 300, pointerId: 2}); fire(cv, 'pointermove', {clientX: 300, clientY: 250, pointerId: 2}); fire(cv, 'pointerup', {clientX: 300, clientY: 250, pointerId: 2});
    for (const key of ['ArrowLeft', 'ArrowUp', '+', '-', '0']) cv.dispatchEvent(new w.KeyboardEvent('keydown', {key, bubbles: true}));
    cv.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'ArrowRight', shiftKey: true, bubbles: true}));
    $('z-in').click(); $('z-out').click(); $('z-reset').click();
    assert.deepStrictEqual(errors, []);
  });
  ok('quiz scores answers', () => {
    const qs = d.querySelectorAll('#quiz .q'); assert.strictEqual(qs.length, 6);
    qs[0].querySelector('[data-k="0"]').click(); qs[1].querySelector('[data-k="0"]').click();
    assert.match($('score').textContent, /1 \/ 2 right/); assert.strictEqual(qs[0].querySelector('.why').hidden, false);
    $('quiz-reset').click(); assert.match($('score').textContent, /6 questions/);
  });
  ok('science tables are filled from the job records', () => {
    assert.strictEqual($('t-jobs').querySelectorAll('tr').length, 7);
    assert.match($('t-limits').textContent, /413/); assert.match($('t-limits').textContent, /89f0fcee/);
    assert.strictEqual($('t-fit').querySelectorAll('tr').length, 7);
  });
  ok('share writes a valid #token', async () => { $('share').click(); });
  setTimeout(() => {
    assert.match(w.location.hash, /^#v1~[A-Za-z0-9._~-]+$/); assert.deepStrictEqual(errors, []);
    console.log(`\n${n} smoke tests passed; final hash ${w.location.hash}`);
    w.close(); process.exit(0);   // the page's idle sprite loop would otherwise keep node running
  }, 50);
}, 200);
