// Unit tests for the pure game logic in web/core.js.   node test_core.js
const assert = require('assert');
const J = require('./web/core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('3-bit slots are cut MSB-first from bytes', () => {
  // 0b111_000_10 0b1_010_011_0 -> 7,0,5,2,3 (16 bits -> 5 slots)
  assert.deepStrictEqual([...J.slotsFromBytes(Uint8Array.from([0b11100010, 0b10100110]))], [7, 0, 5, 2, 3]);
  assert.strictEqual(J.slotsFromBytes(new Uint8Array(3)).length, 8);
});

t('gap symbols: in-train slots and pause buckets', () => {
  assert.strictEqual(J.symOf(70), 0); assert.strictEqual(J.symOf(70 + 7 * 12), 7);
  for (let s = 0; s < 8; s++) assert.strictEqual(J.symOf(J.R.base + s * J.R.step), s);
  assert.strictEqual(J.symOf(200), 8); assert.strictEqual(J.symOf(450), 9); assert.strictEqual(J.symOf(900), 10);
  assert.strictEqual(J.symOf(5000), 11); assert.strictEqual(J.symOf(Infinity), 11);
});

t('n-gram learns a fixed rhythm and backs off when contexts are thin', () => {
  const g = new J.NGram();
  assert.strictEqual(g.dist().order, 0);
  for (let i = 0; i < 12; i++) g.observe(3);
  const d = g.dist(); assert.strictEqual(d.order, 3);
  assert.strictEqual(d.p.indexOf(Math.max(...d.p)), 3); assert(Math.max(...d.p) > 0.6);
  const sum = d.p.reduce((a, b) => a + b, 0); assert(Math.abs(sum - 1) < 1e-12);
});

t('PRNG source: peek equals next, same seed same stream', () => {
  const a = J.makeSource('prng', { seed: 42 }), b = J.makeSource('prng', { seed: 42 });
  for (let i = 0; i < 50; i++) { const p = a.peek(); assert.strictEqual(a.next(), p); assert.strictEqual(b.next(), p); assert(p >= 0 && p < 8); }
});

t('bank source walks slots in order and reports wrap', () => {
  const s = J.makeSource('bank', { slots: Uint8Array.from([1, 2, 3]) });
  assert.deepStrictEqual([s.next(), s.next(), s.next()], [1, 2, 3]); assert(!s.wrapped);
  assert.strictEqual(s.next(), 1); assert(s.wrapped);
});

function holdRound(src, seedKnown, ms) {
  const g = J.newGame({ source: src, seedKnown, noiseSeed: 7 });
  J.advance(g, 200, { hold: false, target: null });
  for (let k = 0; k < ms / 10 && !g.over; k++) J.advance(g, 10, { hold: true, target: { x: 100, y: 100 } });
  return g;
}

t('holding fires a click train with gaps base + slot*step', () => {
  const g = holdRound(J.makeSource('bank', { slots: Uint8Array.from([0, 7, 3, 5, 1, 2, 6, 4]) }), false, 900);
  assert(g.clicks.length >= 5);
  for (let i = 1; i < g.clicks.length; i++) {
    const gap = g.clicks[i].t - g.clicks[i - 1].t;
    assert(Math.abs(gap - (J.R.base + g.clicks[i].slot * J.R.step)) < 1e-9, `gap ${gap}`);
  }
});

t('metronome gets learned, leaked seed gets replayed, a bank does not', () => {
  const met = holdRound(J.makeSource('none'), false, 1500);
  assert(met.clicks.slice(-8).every(c => c.hit), 'metronome: last 8 clicks predicted');
  const leak = holdRound(J.makeSource('prng', { seed: 9 }), true, 1500);
  assert(leak.clicks.slice(1).every(c => c.hit), 'leaked seed: every in-train click predicted');
  assert.strictEqual(leak.clicks[1].mode, 'leaked seed');
  const r = J.mulberry32(5), slots = Uint8Array.from({ length: 4000 }, () => r() >>> 29);
  const bank = holdRound(J.makeSource('bank', { slots }), false, 1500);
  const rate = bank.clicks.filter(c => c.hit).length / bank.clicks.length;
  assert(rate < 0.4, 'random bank mostly unpredicted: ' + rate);
});

t('mispredicted clicks jam echoes for jamHold ms, predicted ones do not', () => {
  const g = holdRound(J.makeSource('none'), false, 1500);
  const last = g.clicks[g.clicks.length - 1];
  assert(last.hit && !J.jammedAt(g, last.t + 1) || g.jams.includes(last.t));
  const g2 = J.newGame({ source: J.makeSource('none'), seedKnown: false, noiseSeed: 1 });
  g2.jams.push(100); assert(J.jammedAt(g2, 100)); assert(J.jammedAt(g2, 100 + J.R.jamHold)); assert(!J.jammedAt(g2, 101 + J.R.jamHold));
});

t('breath: each click is pre-paid, and runs out', () => {
  const g = holdRound(J.makeSource('none'), false, 6000);
  assert(g.energy < J.R.clickCost + J.R.restartEnergy + 1e-9 || g.over);
});

t('rounds are deterministic for a given source and noise seed', () => {
  const a = J.simRound(J.makeSource('prng', { seed: 3 }), { seedKnown: false, noiseSeed: 11 });
  const b = J.simRound(J.makeSource('prng', { seed: 3 }), { seedKnown: false, noiseSeed: 11 });
  assert.deepStrictEqual(a, b); assert(['escaped', 'caught'].includes(a.result));
});

t('a silent moth is always caught; a leaked seed never escapes', () => {
  for (let r = 0; r < 30; r++) {
    const g = J.newGame({ source: J.makeSource('none'), seedKnown: false, noiseSeed: 500 + r });
    let k = 0; while (!g.over && k++ < 20000) J.advance(g, 10, { hold: false, target: J.autopilot(g).target });
    assert.strictEqual(g.result, 'caught');
    assert.strictEqual(J.simRound(J.makeSource('prng', { seed: r }), { seedKnown: true, noiseSeed: 500 + r }).result, 'caught');
  }
});

t('wilson interval and chi-square tail match known values', () => {
  const [lo, hi] = J.wilson(50, 100); assert(Math.abs(lo - 0.4038) < 1e-3 && Math.abs(hi - 0.5962) < 1e-3);
  assert(Math.abs(J.chi2sf(16.65, 7) - 0.019798) < 1e-5);      // scipy.stats.chi2.sf(16.65, 7)
  assert(Math.abs(J.chi2sf(2.5, 3) - 0.475291) < 1e-5);
  const h = J.homogeneity([{ surv: 276, n: 500 }, { surv: 277, n: 500 }, { surv: 296, n: 500 }, { surv: 291, n: 500 }]);
  assert(Math.abs(h.chi2 - 2.4643) < 1e-3 && Math.abs(h.p - 0.48178) < 1e-4);   // scipy chi2_contingency
});

t('switching source mid-flight takes effect at the next scheduled click', () => {
  const g = J.newGame({ source: J.makeSource('none'), seedKnown: true, noiseSeed: 3 });
  J.advance(g, 400, { hold: true, target: null });
  J.setSource(g, J.makeSource('prng', { seed: 77 }));
  J.advance(g, 600, { hold: true, target: null });
  assert(g.clicks.some(c => c.src === 'none') && g.clicks.some(c => c.src === 'prng'));
});

console.log(`\n${n} tests passed`);
