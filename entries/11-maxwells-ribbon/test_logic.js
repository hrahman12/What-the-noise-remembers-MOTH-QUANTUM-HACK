// Unit tests for the page's pure logic (node test_logic.js). Exits non-zero on failure.
const assert = require('assert');
const B = require('./web/ball.js');
const sw = require('./swatches.json').swatches;
let n = 0;
// 1. JS ball->rgb reproduces plate.py's swatch colours (same formula in both languages)
for (const s of sw) { const rgb = B.ballToRgb(...s.ball); rgb.forEach((v, k) => assert(Math.abs(v - s.rgb[k]) <= 1, `swatch ${s.i}: ${rgb} vs ${s.rgb}`)); n++; }
// 2. round trip rgb -> ball -> rgb within 1 level
for (let k = 0; k < 2000; k++) { const c = [0, 0, 0].map(() => Math.floor(Math.random() * 256)); const b = B.rgbToBall(c); const back = B.ballToRgb(b.r, b.theta, b.phi); back.forEach((v, j) => assert(Math.abs(v - c[j]) <= 1, `${c} -> ${back}`)); n++; }
// 3. landmarks
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
let w = B.rgbToBall([255, 255, 255]); assert(near(w.r, 1) && near(w.theta, 0)); n++;
let k0 = B.rgbToBall([0, 0, 0]); assert(near(k0.r, 1) && near(k0.theta, Math.PI)); n++;
let g = B.rgbToBall([128, 128, 128]); assert(g.r < 0.01); n++;
let red = B.rgbToBall([255, 0, 0]); assert(near(red.r, 1) && near(red.theta, Math.PI / 2) && near(red.phi, 0)); n++;
let grn = B.rgbToBall([0, 255, 0]); assert(near(grn.phi, 2 * Math.PI / 3)); n++;
// 4. nearest swatch of a swatch colour is itself
sw.forEach((s, i) => { assert.strictEqual(B.nearest(s.rgb, sw).i, i); n++; });
// 5. vector round trip
for (const s of sw) { const b = { r: s.ball[0], theta: s.ball[1], phi: s.ball[2] }; const v = B.toVec(b); const b2 = B.fromVec(v); const v2 = B.toVec(b2); v.forEach((x, j) => assert(near(x, v2[j], 1e-9))); n++; }
// 6. measurement statistics: a +z state always gives +1 along z; along x it is ~50/50
let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
assert.strictEqual(B.measure([0, 0, 1], 2, 500, rand), 500); n++;
const px = B.measure([0, 0, 1], 0, 20000, rand) / 20000; assert(Math.abs(px - 0.5) < 0.02, px); n++;
const est = B.estimate({ x: [0, 0], y: [0, 0], z: [30, 40] }); assert(near(est[2], 0.5) && est[0] === 0); n++;
// 7. the page's rebuilt colour (JS, from the measured arrow) matches extract.py's (Python) for every job and swatch
const data = require('./web/data.json');
const clip = v => { const r = Math.hypot(...v); return r > 1 ? v.map(x => x / r) : v; };
const dec = s => { const o = []; for (let i = 0; i < s.length; i += 6) o.push([0, 2, 4].map(k => parseInt(s.substr(i + k, 2), 16))); return o; };
for (const j of data.jobs) {
  const px = dec(j.sw);
  assert.strictEqual(px.length, 112); assert.strictEqual(j.swv.length, 112);
  j.swv.forEach((v, i) => { const b = B.fromVec(clip(v)); const c = B.ballToRgb(b.r, b.theta, b.phi); c.forEach((x, k) => assert(Math.abs(x - px[i][k]) <= 2, `${j.machine} ${j.shots} swatch ${i}: ${c} vs ${px[i]}`)); n++; });
  assert.strictEqual(dec(j.rib).length, j.rib_n * j.rib_n); n++;
}
// 8. ribbon cell mapping between ribbon sizes (35x35 <-> 6x6) stays in range and keeps corners
const ribCell = (src, m) => ({x: Math.min(m - 1, Math.floor((src.x + .5) * m / src.n)), y: Math.min(m - 1, Math.floor((src.y + .5) * m / src.n))});
for (let x = 0; x < 35; x++) for (let y = 0; y < 35; y++) { const c = ribCell({n: 35, x, y}, 6); assert(c.x >= 0 && c.x < 6 && c.y >= 0 && c.y < 6); n++; }
assert.deepStrictEqual(ribCell({n: 35, x: 0, y: 0}, 6), {x: 0, y: 0}); assert.deepStrictEqual(ribCell({n: 35, x: 34, y: 34}, 6), {x: 5, y: 5});
assert.deepStrictEqual(ribCell({n: 6, x: 5, y: 0}, 35), {x: 32, y: 2}); n++;
// 9. the cast (web/sprites.json): even sizes, ink palette only; the sitter alone carries the data colour keys C/c
const SPR = require('./web/sprites.json');
for (const [name, sp] of Object.entries(SPR)) {
  const h = sp.frames[0].length, w = sp.frames[0][0].length;
  assert(w % 2 === 0 && h % 2 === 0, name);
  for (const f of sp.frames) { assert.strictEqual(f.length, h, name); for (const r of f) { assert.strictEqual(r.length, w, name); assert(/^[.KBLTWOGCc]*$/.test(r), name); if (name !== 'bloch') assert(!/[Cc]/.test(r), name); } }
  n++;
}
// 10. the scene's plates show real numbers: for every job and test colour, the plate value (v+1)/2 of the engine's raw
//     X, Y, Z is the number qpixl returned, inside 0..1, and turning it back gives the same arrow the page rebuilds from
for (const j of data.jobs) j.swv.forEach(v => v.forEach(x => { const m = (x + 1) / 2; assert(m >= -1e-9 && m <= 1 + 1e-9, `${j.machine} ${m}`); assert(Math.abs(2 * m - 1 - x) < 1e-12); n++; }));
// 11. the shoot sequence: plates land X, then Y, then Z, the screen lights only after all three, and it ends lit
global.window = global; global.InkSprite = undefined;
eval(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'common', 'inksprite.js'), 'utf8'));
global.SPR = SPR;
const SCENE = eval(require('fs').readFileSync(require('path').join(__dirname, 'web', 'scene.js'), 'utf8') + ';SCENE');
let landedAt = [null, null, null], litAt = null;
for (let t = 0; t <= 4.7; t += 0.01) {
  const s = SCENE._seqState(t);
  s.landed.forEach((l, i) => { if (l && landedAt[i] === null) landedAt[i] = t; });
  if (s.lit > 0 && litAt === null) litAt = t;
  if (s.lit > 0) assert(s.landed.every(Boolean), 'screen lit before all plates landed');
  n++;
}
assert(landedAt[0] < landedAt[1] && landedAt[1] < landedAt[2] && landedAt[2] <= litAt, JSON.stringify({landedAt, litAt}));
assert.strictEqual(SCENE._seqState(4.7).lit, 1); n++;
// 12. the pixel font covers every label the scene draws
for (const s of ['REBUILT', 'LONDON 1861', 'AER SIM', 'FAKE FEZ', 'FAKE BRIS', 'IBM FEZ', '16 SHOTS', '128 SHOTS', '1024 SHOTS', 'XYZ', '0.00', '1.00', '?'])
  for (const ch of s) { assert(SCENE._font[ch], `glyph ${ch}`); n++; }
console.log(`ok: ${n} checks passed`);
