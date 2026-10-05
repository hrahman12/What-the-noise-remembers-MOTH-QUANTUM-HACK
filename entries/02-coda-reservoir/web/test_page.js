// Unit tests for the page's pure logic, run against the BUILT page: node web/test_page.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = html.split('<script>').slice(1).map(s => s.split('</script>')[0]);
assert.strictEqual(scripts.length, 1, 'one inline script');
const mod = {exports: {}};
new Function('module', scripts[0])(mod);
const L = mod.exports;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// extract D from the page the same way the browser sees it
const D = new Function('module', scripts[0] + '\nreturn D;')({exports: {}});

// 1. every reachable UI state maps to a real track
const states = [];
for (const mode of ['real', 'res', 'handoff']) for (const whale of ['all', '1', '2', '3', '4']) for (const v of D.variations) for (const take of [1, 2]) {
  if (mode === 'res' && whale !== 'all') continue;                 // the whale row is hidden for the reservoir
  if (mode !== 'res' && (v !== 1 || take !== 1)) continue;          // variation/take rows only exist for the reservoir
  states.push({mode, whale, variation: v, take});
}
ok(states.filter(s => s.mode === 'res').length === 2 * D.variations.length, 'reservoir states = variations x takes');
for (const s of states) ok(D.tracks[L.trackId(L.resolve(s, D.tracks))], 'track exists for ' + JSON.stringify(s));
// take 2 exists exactly for variations 0.25-4; 16 and 64 fall back to take 1
for (const v of D.variations) {
  const r = L.resolve({mode: 'res', whale: 'all', variation: v, take: 2}, D.tracks);
  ok(r.take === (v <= 4 ? 2 : 1), 'take fallback for variation ' + v);
}
ok(Object.keys(D.tracks).length === 5 + 1 + D.variations.length + 5, 'track count: 5 real + handoff + variations + 5 second takes');

// 2. click offsets: one per click, increasing, matching the token's click count
for (const [id, t] of Object.entries(D.tracks)) {
  for (const ev of t.ev.slice(0, 400)) {
    const o = L.clickOffsets(ev);
    ok(o.length === D.vocab[ev[1]].n, `${id}: ${o.length} offsets for a ${D.vocab[ev[1]].n}-click token`);
    // 9 real codas contain ICIs of 1-7 microseconds (near-duplicate click annotations in the CSV); stored at
    // 0.1 ms resolution these become 0, so offsets are non-decreasing rather than strictly increasing
    for (let k = 1; k < o.length; k++) ok(o[k] >= o[k - 1], `${id}: offsets non-decreasing`);
  }
  for (let k = 1; k < t.ev.length; k++) ok(t.ev[k][0] >= t.ev[k - 1][0], `${id}: events sorted`);
  ok(t.dur >= L.codaEnd(t.ev[t.ev.length - 1]), `${id}: duration covers the last click`);
  const lanes = new Set(t.ev.map(e => e[2]));
  if (t.kind === 'gen') ok(lanes.size === 1 && lanes.has(0), `${id}: generated codas sit in the reservoir lane`);
  if (t.kind === 'real') ok(!lanes.has(0), `${id}: real codas never in the reservoir lane`);
}

// 3. flatten gives every click exactly once, in time order
const hf = L.flatten(D.tracks.handoff);
ok(hf.length === D.tracks.handoff.ev.reduce((a, e) => a + D.vocab[e[1]].n, 0), 'flatten keeps every click');
for (let k = 1; k < hf.length; k++) ok(hf[k][0] >= hf[k - 1][0], 'flatten sorted');

// 4. handoff = the WAV: real part then reservoir part, split between them, 60-90 s
const h = D.tracks.handoff;
const firstGen = h.ev.findIndex(e => e[3] < 0);
ok(firstGen === h.real_n, 'handoff: real codas first');
ok(h.ev.slice(firstGen).every(e => e[3] < 0), 'handoff: only reservoir codas after the split');
ok(h.ev[firstGen][0] >= h.split - 1e-6, 'handoff: first reservoir coda at or after the split');
ok(h.dur >= 60 && h.dur <= 90, 'handoff length in 60-90 s: ' + h.dur);

// 5. lowerBound, tvd, seqStats
const arr = [0, 1, 1, 2, 5];
ok(L.lowerBound(arr, 1, x => x) === 1 && L.lowerBound(arr, 3, x => x) === 4 && L.lowerBound(arr, 9, x => x) === 5, 'lowerBound');
ok(Math.abs(L.tvd([1, 0], [0, 1]) - 1) < 1e-12 && L.tvd([.5, .5], [.5, .5]) === 0, 'tvd');
const ps = new Set([0 * 64 + 1]);
const s = L.seqStats([0, 1, 1, 0], 2, ps);
ok(s.n === 4 && Math.abs(s.repeat - 1 / 3) < 1e-12 && Math.abs(s.unseen - 2 / 3) < 1e-12 && s.distinct === 2, 'seqStats');

// 6. share links round-trip and only use allowed characters
for (const st of states) {
  const tok = L.encodeHash(st, 123.45);
  ok(/^[A-Za-z0-9._~-]+$/.test(tok), 'hash chars: ' + tok);
  const back = L.decodeHash('#' + tok);
  ok(back && L.trackId(back.s) === L.trackId(st) && Math.abs(back.pos - 123.5) < 1e-9, 'hash round trip: ' + tok);
}
ok(L.decodeHash('#nonsense') === null && L.decodeHash('') === null, 'bad hashes rejected');

// 7. page-reported metrics agree with the page's own seqStats on the full reservoir tracks
const PAIRS = new Set(D.pairs.map(([a, b]) => a * 64 + b));
const CORPUS = D.vocab.map(v => v.c / D.total);
for (const v of D.variations) {
  const t = D.tracks['var_' + v];
  const m = D.metrics.find(x => x.label === 'Reservoir, variation ' + v + ', take 1');
  ok(m, 'metric row for variation ' + v);
  // the track may hold every generated token; metrics are computed on the full generated sequence
  const st = L.seqStats(t.ev.map(e => e[1]), D.vocab.length, PAIRS);
  ok(Math.abs(L.tvd(st.share, CORPUS) - m.tvd) < 1e-9 && Math.abs(st.repeat - m.repeat) < 1e-9, 'metrics consistent for ' + v);
}
console.log(`ok: ${n} assertions passed`);
