// Unit tests for web/core.js (pure logic) plus cross-checks against the Python replay and the built page.
// Run: node test_core.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const C = require('./web/core.js');

const HERE = __dirname;
const T = JSON.parse(fs.readFileSync(path.join(HERE, 'data/alphag_table1.json'), 'utf8'));
const ROWS = T.rows.map(r => ({b: r[0], trials: r[1], n_up: r[2], n_dn: r[3]}));
const MAIN = ROWS.filter(r => Math.abs(r.b) <= 3).sort((a, b) => a.b - b.b);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

ok('pDown follows Table 1 and clamps negative counts', () => {
  const z = ROWS.find(r => r.b === 0);
  assert.strictEqual(C.pDown(z.n_up, z.n_dn), 94.5 / (36.7 + 94.5));
  assert.strictEqual(C.pDown(-0.1, 185.7), 1);                 // +10 g calibration row
  assert.strictEqual(C.pDown(0, 0), 0.5);
  for (let i = 1; i < MAIN.length - 1; i++) assert(C.pDown(MAIN[i].n_up, MAIN[i].n_dn) > C.pDown(MAIN[i - 1].n_up, MAIN[i - 1].n_dn) || MAIN[i].b === 3);
});
ok('threshold and decide are exact at the edges', () => {
  assert.strictEqual(C.threshold(0), 0);
  assert.strictEqual(C.threshold(1), 65536);
  assert.strictEqual(C.decide(0, 0), 'up');                   // p = 0: never down
  assert.strictEqual(C.decide(65535, 1), 'dn');               // p = 1: always down
  assert.strictEqual(C.decide(32767, 0.5), 'dn');
  assert.strictEqual(C.decide(32768, 0.5), 'up');
  // exact frequency: over all 65536 words, the down count equals the threshold
  for (const r of MAIN) {
    const p = C.pDown(r.n_up, r.n_dn), t = C.threshold(p);
    let d = 0; for (let w = 0; w < 65536; w++) if (C.decide(w, p) === 'dn') d++;
    assert.strictEqual(d, t);
    assert(Math.abs(t / 65536 - p) <= 0.5 / 65536);
  }
});
ok('hex bank reading never wraps', () => {
  const b = C.hexToBytes('ff00a1');
  assert.deepStrictEqual(Array.from(b), [255, 0, 161]);
  assert.strictEqual(C.word16(b, 0), 0xff00);
  const d = C.drawFromBank(b, 0, 0.5);
  assert.strictEqual(d.word, 0xff00); assert.strictEqual(d.next, 2); assert.strictEqual(d.dir, 'up');
  assert.strictEqual(C.drawFromBank(b, 2, 0.5), null);         // only 1 byte left: refuse
});
ok('series sizes add up to the paper total', () => {
  const tot = MAIN.reduce((s, r) => s + C.seriesSize(r), 0);
  assert.strictEqual(tot, 1721);                               // 1,722 in the paper before rounding each bias
  assert.strictEqual(C.trialSize(ROWS.find(r => r.b === 0)), 19);
});
ok('wilson interval brackets the estimate', () => {
  const w = C.wilson(7, 10, 1);
  assert(w.lo < 0.7 && w.hi > 0.7 && w.lo > 0 && w.hi < 1);
  assert.strictEqual(C.wilson(0, 0), null);
});
ok('logistic fit recovers a known balance point', () => {
  const pts = [-3, -2, -1, 0, 1, 2, 3].map(b => { const p = C.logistic(b, 0.5, 0.8); return {b, dn: 1000 * p, up: 1000 * (1 - p)}; });
  const f = C.fitLogistic(pts);
  assert(Math.abs(f.b0 - 0.5) < 0.021 && Math.abs(f.w - 0.8) < 0.03 && f.lo <= 0.5 && f.hi >= 0.5);
  assert.strictEqual(C.fitLogistic([{b: 0, dn: 5, up: 5}]), null);   // one bias: under-determined
});
ok('share token round-trips and rejects junk', () => {
  const s = {src: 'emu', bi: 3, off: {fez: 3442, emu: 12}, tally: MAIN.concat([{}, {}]).map((_, i) => [i * 7, i * 11 + 1])};
  const tok = C.encodeToken(s);
  assert(/^[A-Za-z0-9._~-]+$/.test(tok), tok);
  assert.deepStrictEqual(C.decodeToken(tok, 13, {fez: 1e6, emu: 1e6}), s);
  assert.strictEqual(C.decodeToken(tok, 12), null);                                // wrong bias count
  assert.strictEqual(C.decodeToken(tok.replace('_f2nm', '_f2nn'), 13), null);       // odd byte offset
  assert.strictEqual(C.decodeToken(tok, 13, {fez: 100, emu: 100}), null);           // beyond the bank
  assert.strictEqual(C.decodeToken('v1_fez_b0_f0_e0_t<script>', 13), null);
  assert.strictEqual(C.decodeToken('', 13), null);
});

// ---- cross-checks with real data (need run_qrng.py, replay.py and build_web.py to have run) ----
const R = JSON.parse(fs.readFileSync(path.join(HERE, 'out/replay.json'), 'utf8'));
for (const name of ['fez_148p8', 'emu_20p0']) {
  ok(`JS campaign with the ${name} bank matches replay.py exactly`, () => {
    const bank = C.hexToBytes(fs.readFileSync(path.join(HERE, `data/bank_${name}.hex`), 'ascii').trim());
    let off = 0;
    MAIN.forEach((r, i) => {
      const p = C.pDown(r.n_up, r.n_dn); let up = 0, dn = 0;
      for (let k = 0; k < C.seriesSize(r); k++) { const d = C.drawFromBank(bank, off, p); off = d.next; d.dir === 'dn' ? dn++ : up++; }
      const py = R[name].tallies[i];
      assert.strictEqual(py.b, r.b); assert.strictEqual(py.threshold, C.threshold(p));
      assert.deepStrictEqual([up, dn], [py.up, py.dn], `bias ${r.b}`);
    });
    assert.strictEqual(off / 2, R[name].words_used);
    const f = C.fitLogistic(MAIN.map((r, i) => ({b: r.b, up: R[name].tallies[i].up, dn: R[name].tallies[i].dn})));
    for (const k of ['b0', 'w', 'lo', 'hi']) assert(Math.abs(f[k] - R[name].fit[k]) < 1e-9, k);
  });
}
ok('paper-count fit matches Python', () => {
  const f = C.fitLogistic(MAIN.map(r => ({b: r.b, up: Math.max(0, r.n_up), dn: Math.max(0, r.n_dn)})));
  for (const k of ['b0', 'w', 'lo', 'hi']) assert(Math.abs(f[k] - R.paper_table1_fit[k]) < 1e-9, k);
});
ok('built page carries the banks byte-for-byte', () => {
  const html = fs.readFileSync(path.join(HERE, 'web/index.html'), 'ascii');
  const m = /const BANKS = (\{.*?\});\r?\n/.exec(html);
  assert(m, 'BANKS literal not found');
  const B = JSON.parse(m[1]);
  assert.strictEqual(B.fez.hex, fs.readFileSync(path.join(HERE, 'data/bank_fez_148p8.hex'), 'ascii').trim());
  assert.strictEqual(B.emu.hex, fs.readFileSync(path.join(HERE, 'data/bank_emu_20p0.hex'), 'ascii').trim());
  const jobs = JSON.parse(fs.readFileSync(path.join(HERE, 'out/jobs.json'), 'utf8'));
  assert.strictEqual(B.fez.job_id, jobs.find(j => j.name === 'fez_148p8').job_id);
  assert.strictEqual(B.emu.job_id, jobs.find(j => j.name === 'emu_20p0').job_id);
});
console.log(`${n} tests passed`);
