// Unit tests for the page's pure logic. Run: node web/test_page.js (from the entry folder).
// Pulls the "pure logic" block out of the built index.html and runs it against the real frame data.
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const data = script.split('// ---------- pure logic (unit-tested in test_page.js) ----------')[0];
const logic = script.split('// ---------- pure logic (unit-tested in test_page.js) ----------')[1].split('// ---------- state')[0];
const env = new Function('matchMedia', data + logic +
  '\nreturn {FR, META, SPR, nearestIndex, predicted, fmtL, nm, parseHash, makeHash, statusText, CROP, C0, rimAngle, twistAtRim, inZone, aaBasis, reading, readPeriod, probeAt, probeText};')(() => ({matches: false}));
const {FR, META, SPR, nearestIndex, predicted, fmtL, parseHash, makeHash, statusText, CROP, C0, rimAngle, twistAtRim, inZone, aaBasis, reading, readPeriod, probeAt, probeText} = env;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

ok(FR.length >= 24, 'at least 24 frames');
ok(FR.every((f, i) => i === 0 || f.t > FR[i - 1].t), 'frames sorted by angle');
ok(FR.every(f => /^[0-9a-f-]{36}$/.test(f.j)), 'every frame has a job id');
ok(FR.every(f => f.p.length === META.angles.length && f.pr.length === META.angles.length), 'profiles match angle grid');
// snapping
ok(FR[nearestIndex(1.1)].t === 1.1, '1.1 is a real frame');
ok(nearestIndex(-3) === 0 && nearestIndex(99) === FR.length - 1, 'clamps at the ends');
ok(FR[nearestIndex(1.12)].t === 1.1 && FR[nearestIndex(1.13)].t === 1.15, 'snaps to nearest');
// prediction matches lattice.py: a / (2 sin(theta/2))
ok(predicted(0) === Infinity, 'no twist -> infinite period');
ok(Math.abs(predicted(1.1) - 416.70297788635156) < 1e-6, 'L(1.1) = 416.70 px');
for (const f of FR) if (f.lp != null) ok(Math.abs(predicted(f.t) - f.lp) < 0.01, 'JS prediction == python at ' + f.t);
ok(Math.abs(predicted(1.1) * META.nmPerPx - 12.81) < 0.01, '12.8 nm in graphene at 1.1 deg');
ok(fmtL(Infinity) === '∞' && fmtL(416.7) === '416.7 px' && fmtL(null) === null, 'formatting');
// share links
ok(makeHash(1.1, 'orig', 'px') === '#t1.10-orig-px', 'make hash');
const h = parseHash('#t2.30-orig-px'); ok(h.theta === 2.3 && h.src === 'orig' && h.lens === 'px', 'parse hash');
const h2 = parseHash(makeHash(4.4, 'morph', 'env')); ok(h2.theta === 4.4 && h2.src === 'morph' && h2.lens === 'env', 'round trip');
ok(parseHash('#t0.00').src === 'morph' && parseHash('#t0.00').lens === 'env', 'defaults');
ok(parseHash('#evil<script>') === null && parseHash('') === null && parseHash('#t1.1-bad') === null, 'bad hashes ignored');
ok(/^#[A-Za-z0-9._~-]+$/.test(makeHash(4.8, 'morph', 'env')), 'hash uses allowed characters');
// share links carry the view too (Scene is the default and is left out, so older links still parse)
ok(makeHash(1.1, 'morph', 'env', 'scene') === '#t1.10-morph-env' && makeHash(1.1, 'morph', 'env') === '#t1.10-morph-env', 'scene view adds no suffix');
ok(makeHash(2.3, 'orig', 'px', 'frame') === '#t2.30-orig-px-frame' && makeHash(0, 'morph', 'env', 'data') === '#t0.00-morph-env-data', 'frame and data views in the hash');
for (const v of ['scene', 'frame', 'data']) for (const s of ['orig', 'morph']) for (const l of ['env', 'px']) {
  const r = parseHash(makeHash(1.15, s, l, v)); ok(r && r.theta === 1.15 && r.src === s && r.lens === l && r.view === v, 'round trip ' + [s, l, v].join('-'));
  ok(/^#[A-Za-z0-9._~-]+$/.test(makeHash(1.15, s, l, v)), 'allowed characters ' + [s, l, v].join('-'));
}
ok(parseHash('#t2.30-orig-px').view === 'scene' && parseHash('#t1.10-morph-env-nope') === null, 'view defaults to scene; unknown views ignored');
// the profile probe reads the same numbers the chart draws
{
  const f = FR[nearestIndex(2.0)], q = probeAt(f, f.t / 2);
  ok(Math.abs(q.a - f.t / 2) <= 0.02 + 1e-9 && q.k >= 0 && q.k < META.angles.length, 'probe snaps to the angle grid');
  ok(q.morph === f.p[q.k] / Math.max(...f.p) && q.orig === f.pr[q.k] / Math.max(...f.pr), "probe values are shares of each curve's peak");
  ok(probeAt(f, -99).k === 0 && probeAt(f, 99).k === META.angles.length - 1, 'probe clamps to the grid ends');
  ok(/^16\.00\u00b0 \(\+1\.00\u00b0 from the 15\u00b0 axis\): morph \d+ % of its peak, original \d+ % of its peak\. On layer B's predicted angle/.test(probeText(f, 1.0)), 'probe text names layer B at +theta/2: ' + probeText(f, 1.0));
  ok(/layer A's predicted angle/.test(probeText(f, -1.0)) && !/layer/.test(probeText(f, 3.0)), 'probe text names layer A at -theta/2 only');
  const g = FR.find(x => x.st === 'ok' && x.t > 3);
  ok(/a peak of the pair the FFT found/.test(probeText(g, g.d)), 'probe text names the pair the FFT found');
  ok(FR.every(x => { const r = probeAt(x, 0); return r.morph >= 0 && r.morph <= 1 && r.orig >= 0 && r.orig <= 1; }), 'probe shares are between 0 and 1 for every frame');
}
// status: every frame has one, counts match the summary, and text exists for each
ok(FR.every(f => ['ok', 'null', 'unresolved'].includes(f.st)), 'status set');
ok(FR.filter(f => f.st === 'ok' && f.lp != null).length === META.summary.n_ok, 'ok count matches summary');
ok(FR.every(f => typeof statusText(f) === 'string'), 'status text');
ok(FR.every(f => (f.st === 'unresolved') === (f.lm == null)), 'unresolved iff no period');
ok(FR.every(f => f.d == null || Math.abs(2 * f.d - f.tm) < 0.01), 'pair split = 2 delta');
ok(FR.every(f => f.map && f.mapin && f.raw), 'three images per frame');
// geometry of the crop
ok(CROP === 384 && C0 === 320, 'centre crop 384 px at 320');
// measured periods are finite and positive where resolved
ok(FR.every(f => f.lm == null || (f.lm > 0 && isFinite(f.lm))), 'measured periods sane');
// the turntable dial
ok(rimAngle(1.1) === -90, '1.1 deg sits at 12 o\'clock');
ok(FR.every(f => Math.abs(twistAtRim(rimAngle(f.t)) - f.t) < 1e-9), 'rim angle round-trips for every frame');
ok(twistAtRim(150) === 5 && twistAtRim(200) === 0 && twistAtRim(-160) === 0 && twistAtRim(170) === 5, 'the gap clamps to the nearer end');
ok(inZone(1.1) && inZone(1.0) && inZone(1.2) && !inZone(0.95) && !inZone(1.25), 'magic angle zone is 1.0-1.2 deg');
// Lec's AA spots: a triangular lattice of period L, where the two layers' first-shell Bragg phases agree (mod 2 pi)
const g1 = Math.min(...META.terms.map(t => Math.hypot(t[0], t[1])).filter(g => g > 1e-9));
const shell = META.terms.filter(t => Math.abs(Math.hypot(t[0], t[1]) - g1) < 1e-6);
ok(shell.length === 6, 'six first-shell Bragg vectors');
const rot = (g, deg) => { const p = deg * Math.PI / 180; return [g[0] * Math.cos(p) - g[1] * Math.sin(p), g[0] * Math.sin(p) + g[1] * Math.cos(p)]; };
for (const th of [0.5, 1.1, 2, 3.4, 5]) {
  const L = predicted(th), b = aaBasis(L, META.theta0);
  ok(Math.abs(Math.hypot(...b[0]) - L) < 1e-9 && Math.abs(Math.hypot(...b[1]) - L) < 1e-9 && Math.abs(Math.hypot(b[0][0] - b[1][0], b[0][1] - b[1][1]) - L) < 1e-9, 'AA lattice is triangular with period L at ' + th);
  for (const [i, j] of [[1, 0], [0, 1], [2, -1], [-3, 2]]) {
    const r = [i * b[0][0] + j * b[1][0], i * b[0][1] + j * b[1][1]];
    const worst = Math.max(...shell.map(t => { const ga = rot(t, META.theta0 - th / 2), gb = rot(t, META.theta0 + th / 2);
      const ph = (gb[0] - ga[0]) * r[0] + (gb[1] - ga[1]) * r[1]; return Math.abs(ph - 2 * Math.PI * Math.round(ph / (2 * Math.PI))); }));
    ok(worst < 1e-6, 'layers in register at AA spot (' + i + ',' + j + ') for ' + th + ' deg');
  }
}
// what the needle and Lec show follows the published reading
ok(FR.every(f => reading(f, 'morph') === {ok: 'read', null: 'skip', unresolved: 'lift'}[f.st]), 'morph reading = status');
ok(FR.every(f => (reading(f, 'orig') === 'read') === (f.lr != null)), 'original reading = method check resolved');
ok(FR.every(f => readPeriod(f, 'morph') === (f.st === 'ok' ? f.lm : null) && readPeriod(f, 'orig') === (f.lr != null ? f.lr : null)), 'Lec hops at the period that was read');
// sprites: shared palette only, even sizes, every frame the same size
const PALK = new Set('.KBLTW'.split(''));
for (const [k, v] of Object.entries(SPR)) {
  const w = v.frames[0][0].length, h = v.frames[0].length;
  ok(w % 2 === 0 && h % 2 === 0, k + ' has even size');
  ok(v.frames.every(f => f.length === h && f.every(r => r.length === w && [...r].every(c => PALK.has(c)))), k + ' frames are uniform and in the ink palette');
}
console.log(n + ' assertions passed');
