// Headless test of the built page (web/index.html) with jsdom: drives the real buttons and checks the
// state machine, the no-autoplay rule, the dice accounting and the share link.
// Run: JSDOM_PATH=<dir containing node_modules/jsdom> node test_page.js   (or have jsdom installed locally)
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {JSDOM} = require(process.env.JSDOM_PATH ? path.join(process.env.JSDOM_PATH, 'node_modules', 'jsdom') : 'jsdom');

const HERE = __dirname;
const HTML = fs.readFileSync(path.join(HERE, 'web/index.html'), 'ascii');
const REPLAY = JSON.parse(fs.readFileSync(path.join(HERE, 'out/replay.json'), 'utf8'));
const FEZ = Buffer.from(fs.readFileSync(path.join(HERE, 'data/bank_fez_148p8.hex'), 'ascii').trim(), 'hex');
const EMU = Buffer.from(fs.readFileSync(path.join(HERE, 'data/bank_emu_20p0.hex'), 'ascii').trim(), 'hex');

function page(hash, reduced) {
  let clock = 1000;
  const frames = [];
  const dom = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body>' + HTML + '</body></html>', {
    url: 'https://antimatter.test/' + (hash ? '#' + hash : ''), runScripts: 'dangerously',
    beforeParse(w) {
      const noop = () => {};
      const ctx = new Proxy({}, {get: (t, k) => k === 'createLinearGradient' ? () => ({addColorStop: noop}) : (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; }});
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.matchMedia = q => ({matches: !!reduced && /reduce/.test(q)});
      w.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
      w.cancelAnimationFrame = noop;
      Object.defineProperty(w.performance, 'now', {value: () => clock, configurable: true});
    }
  });
  const w = dom.window, $ = id => w.document.getElementById(id);
  const tick = (n, ms = 16) => {
    for (let i = 0; i < n && frames.length; i++) { clock += ms; const q = frames.splice(0); q.forEach(cb => cb(clock)); }
  };
  const run = (max = 20000) => { let i = 0; while (frames.length && i++ < max) tick(1); return i; };
  const click = id => $(id).click();
  return {w, $, tick, run, click, frames, dom};
}
const words = (bank, from, n) => Array.from({length: n}, (_, i) => (bank[from + 2 * i] << 8) | bank[from + 2 * i + 1]);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

ok('loads with an empty trap and nothing animating', () => {
  const p = page();
  assert.strictEqual(p.$('hud-phase').textContent, 'Trap empty');
  assert.strictEqual(p.$('hud-bias').textContent, 'Bias 0 g');
  assert(p.$('play').disabled && p.$('ramp').disabled && !p.$('stack').disabled);
  assert.strictEqual(p.frames.length, 0, 'no animation frame requested on load');
  assert.strictEqual(p.w.document.querySelectorAll('#g-bias button').length, 11);
  assert.strictEqual(p.w.document.querySelectorAll('#g-cal button').length, 2);
  assert(/Not enough data/.test(p.$('verdict').textContent));
});

ok('stack, ramp, finish: 19 atoms at 0 g use the first 19 hardware words', () => {
  const p = page();
  p.click('stack');
  assert.strictEqual(p.$('hud-phase').textContent, '19 of 19 atoms trapped');
  assert.strictEqual(p.frames.length, 0, 'stacking alone does not start motion');
  p.click('play');
  assert.strictEqual(p.$('play').textContent, 'Pause');
  p.run();
  const W = words(FEZ, 0, 19), dn = W.filter(x => x < 47204).length;
  assert.strictEqual(p.$('hud-phase').textContent, `Done: ${dn} down · ${19 - dn} up`);
  assert(/19 used/.test(p.$('r-bank').textContent));
  assert.strictEqual(p.w.document.querySelectorAll('#dice li').length, 8);
  assert.strictEqual(p.frames.length, 0, 'animation stops when the trial is over');
  assert.strictEqual(p.$('stack').textContent, 'Stack again');
});

ok('the stage button stacks, ramps, pauses and restacks', () => {
  const p = page();
  assert.strictEqual(p.$('act').textContent, 'Stack');
  p.click('act'); assert.strictEqual(p.$('act').textContent, 'Ramp'); assert.strictEqual(p.frames.length, 0);
  p.click('act'); assert.strictEqual(p.$('act').textContent, 'Pause'); p.tick(20);
  p.click('act'); p.run(); assert.strictEqual(p.$('act').textContent, 'Resume');
  p.click('act'); p.run(); assert.strictEqual(p.$('act').textContent, 'Stack again');
  assert(/^Done: /.test(p.$('hud-phase').textContent));
});

ok('pause freezes the ramp; the slider only moves forward; dump spends no dice', () => {
  const p = page();
  p.click('stack'); p.click('play'); p.tick(40);                    // ~0.64 s real at 5x = ~3.2 s of ramp
  p.click('play');                                                   // pause
  p.run();
  const t1 = p.$('m-t').textContent; p.tick(50);
  assert.strictEqual(p.$('m-t').textContent, t1, 'time does not advance while paused');
  const r = p.$('ramp'); r.value = '10'; r.dispatchEvent(new p.w.Event('input'));
  assert.strictEqual(p.$('m-t').textContent, t1, 'cannot ramp backwards');
  r.value = '150'; r.dispatchEvent(new p.w.Event('input')); p.run();
  const used = +/(\d+) used/.exec(p.$('r-bank').textContent)[1];
  assert(used > 0 && used < 19, `some but not all atoms escaped by 15 s (${used})`);
  p.click('dump');
  assert.strictEqual(p.$('hud-phase').textContent, 'Trap empty');
  assert.strictEqual(+/(\d+) used/.exec(p.$('r-bank').textContent)[1], used, 'dumped atoms use no dice');
});

ok('bias is locked during a trial and the calibration rows work', () => {
  const p = page();
  p.click('stack');
  const b = p.w.document.querySelector('#g-bias button[data-bi="0"]');
  assert(b.disabled);
  p.click('dump');
  assert(!b.disabled);
  p.w.document.querySelector('#g-cal button[data-bi="12"]').click();      // +10 g: P(down) = 1
  assert.strictEqual(p.$('hud-bias').textContent, 'Bias +10 g · calibration');
  p.click('stack'); const r = p.$('ramp'); r.value = '200'; r.dispatchEvent(new p.w.Event('input')); p.run();
  assert(/Done: 31 down · 0 up/.test(p.$('hud-phase').textContent), p.$('hud-phase').textContent);
  assert(/\+10 g: 31 down \/ 0 up/.test(p.$('cal-line').textContent));
});

console.log(`${n} tests passed (synchronous part)`);

// The campaign uses setTimeout between biases, so drive it asynchronously.
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const p = page();
  p.click('campaign');
  for (let i = 0; i < 400; i++) {
    p.run();
    if (p.$('campaign').textContent === 'Run the whole campaign') break;
    await sleep(60);
  }
  assert.strictEqual(p.$('campaign').textContent, 'Run the whole campaign', 'campaign finished');
  const T = REPLAY.fez_148p8.tallies;
  const label = p.$('c-n').textContent;
  assert.strictEqual(label, '1,721 escapes');
  assert(new RegExp(`${REPLAY.fez_148p8.words_used.toLocaleString('en-US')} used`).test(p.$('r-bank').textContent));
  const f = REPLAY.fez_148p8.fit, sign = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  assert(p.$('verdict').textContent.includes(`Balance at ${sign(f.b0)} g`), p.$('verdict').textContent);
  // share link restores the same curve in a new page
  p.click('share'); await sleep(10);
  const tok = p.w.location.hash.slice(1);
  assert(/^[A-Za-z0-9._~-]+$/.test(tok), tok);
  const tal = tok.split('_t')[1].split('~').slice(0, 11).map(s => s.split('.').map(x => parseInt(x, 36)));
  T.forEach((t, i) => assert.deepStrictEqual(tal[i], [t.up, t.dn], `bias ${t.b}`));
  const q = page(tok);
  assert.strictEqual(q.$('c-n').textContent, '1,721 escapes');
  assert(q.$('verdict').textContent.includes(`Balance at ${sign(f.b0)} g`));
  n++; console.log('  ok  the whole campaign on a fresh page reproduces replay.py exactly, and the share link restores it');

  // reduced motion: the ramp completes at once with no animation frames
  const r = page('', true);
  r.click('stack'); r.click('play');
  assert.strictEqual(r.frames.length, 0);
  assert(/^Done: /.test(r.$('hud-phase').textContent));
  n++; console.log('  ok  reduced motion completes the ramp without animating');

  // emulator bank exhaustion: start two dice from the end via a share token (the bank has an odd
  // byte count, 8,423, so its last byte can never form a 16-bit die)
  const start = (EMU.length & ~1) - 4;
  const e = page(`v1_emu_b5_f0_e${start.toString(36)}_t${Array(13).fill('0.0').join('~')}`);
  assert(/^Emulator/.test(e.w.document.querySelector('[data-src="emu"]').textContent) && e.w.document.querySelector('[data-src="emu"]').getAttribute('aria-pressed') === 'true');
  e.click('stack'); const rr = e.$('ramp'); rr.value = '200'; rr.dispatchEvent(new e.w.Event('input')); e.run();
  assert(!e.$('exhausted').hidden, 'exhaustion notice shown');
  assert.strictEqual(e.$('hud-phase').textContent, '17 of 19 atoms trapped');
  assert(/Resume ramp/.test(e.$('play').textContent));
  e.click('rewind');
  assert(/ 0 used/.test(e.$('r-bank').textContent));
  n++; console.log('  ok  an exhausted bank stops the ramp and offers a rewind');

  // quiz
  const z = page();
  const first = z.w.document.querySelector('#quiz .q .opts button');
  first.click();
  assert(/1 right of 1 answered/.test(z.$('q-score').textContent));
  const wrong = z.w.document.querySelectorAll('#quiz .q')[1].querySelectorAll('.opts button')[0];
  wrong.click();
  assert(/1 right of 2 answered/.test(z.$('q-score').textContent));
  assert(!z.w.document.querySelectorAll('#quiz .q')[1].querySelector('.why').hidden);
  z.click('q-reset');
  assert(/0 \/ 6 answered/.test(z.$('q-score').textContent));
  n++; console.log('  ok  quiz scores, explains and resets');
  console.log(`${n} tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
