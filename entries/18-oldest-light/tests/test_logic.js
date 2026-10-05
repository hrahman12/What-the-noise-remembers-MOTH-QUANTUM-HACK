// Unit tests for the page's pure logic, run against the BUILT page (web/index.html) and the Python
// pipeline's own numbers (tests/ref.json from tests/make_ref.py). Usage: node tests/test_logic.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const sandbox = {module: {exports: {}}, atob: (s) => Buffer.from(s, 'base64').toString('latin1'), Math, Object, String, Float32Array, Float64Array, Uint16Array, Uint8ClampedArray, isFinite, parseFloat};
vm.createContext(sandbox); vm.runInContext(src + '\n;module.exports.D = D; module.exports.LV = LV;', sandbox);
const F = sandbox.module.exports, D = F.D, LV = F.LV, N = D.n;
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

ok('six engine outputs, strengths ascending, 18 qubits each, real job ids', () => {
  assert.strictEqual(LV.length, 6);
  for (let i = 1; i < LV.length; i++) assert.ok(LV[i].strength > LV[i - 1].strength);
  for (const L of LV){ assert.strictEqual(L.qubits, 18); assert.match(L.job_id, /^[0-9a-f-]{36}$/); assert.match(L.detail, /18-qubit/); }
  assert.strictEqual(D.failed.length, 1); assert.strictEqual(D.failed[0].qubits, 19);
});
ok('decode16 reproduces the integer grid the engine received', () => {
  const u = F.decode16(D.original); assert.strictEqual(u.length, N * N);
  ref.idx.forEach(([i, j], k) => assert.strictEqual(u[i * N + j] / D.q, ref.orig_units[k]));
});
ok('toUK matches Python (engine output, mean shift removed)', () => {
  const L = LV[3]; assert.strictEqual(L.strength, ref.level.strength);
  const v = F.toUK(F.decode16(L.grid), L.shift);
  ref.idx.forEach(([i, j], k) => close(v[i * N + j], ref.level.uK[k], 0.02, 'uK'));
});
ok('gaussian() matches scipy.ndimage.gaussian_filter (reflect)', () => {
  const o = new Float32Array(N * N), u = F.decode16(D.original);
  for (let i = 0; i < o.length; i++) o[i] = u[i] / D.q * D.meta.uK_per_unit + D.meta.t_lo_uK;
  const g = F.gaussian(o, N, LV[3].sigma_px), c = F.gaussian(o, N, D.cobe.sigma_px);
  ref.idx.forEach(([i, j], k) => { close(g[i * N + j], ref.level.gauss_uK[k], 0.01, 'gauss'); close(c[i * N + j], ref.cobe_uK[k], 0.01, 'cobe'); });
});
ok('galactic() matches make_patch.oblique_lonlat', () => {
  ref.idx.forEach(([i, j], k) => {
    const g = F.galactic(i, j); let dl = Math.abs(g.l - ref.lb[k][0]); dl = Math.min(dl, 360 - dl);
    close(dl, 0, 1e-6, 'l'); close(g.b, ref.lb[k][1], 1e-6, 'b');
  });
  const c = F.galactic((N - 1) / 2, (N - 1) / 2); close(c.l, 209, 1e-9, 'centre l'); close(c.b, -57, 1e-9, 'centre b');
});
ok('colour LUT matches cmap.py at the reference temperatures', () => {
  const t = F.lut(D.stops, 512);
  for (const [T, rgb] of Object.entries(ref.colors)){
    const x = Math.max(-1, Math.min(1, +T / D.scale_uK)), k = Math.round((x + 1) / 2 * 511) * 3;
    for (let c = 0; c < 3; c++) close(t[k + c], rgb[c], 2, 'rgb');
  }
});
ok('clampView keeps the window inside the patch', () => {
  const a = F.clampView({z: 0.2, cx: -50, cy: 999}); assert.strictEqual([a.z, a.cx, a.cy].join(), [1, N / 2, N / 2].join());
  const b = F.clampView({z: 4, cx: 0, cy: N}); assert.strictEqual(b.cx, N / 8); assert.strictEqual(b.cy, N - N / 8);
  assert.strictEqual(F.clampView({z: 99, cx: 100, cy: 100}).z, 6);
});
ok('share token round-trips and only uses allowed characters', () => {
  const s = {level: 6, kind: 'g', mode: 'b', z: 2.5, cx: 100.25, cy: 140, wipe: 0.37, cold: true};
  const tok = F.serialize(s); assert.match(tok, /^[A-Za-z0-9._~-]+$/);
  const p = F.parse('#' + tok, {level: 4, kind: 'q', mode: 'w', z: 1.5, cx: 128.5, cy: 128.5, wipe: 0.5, cold: false});
  assert.strictEqual(p.level, 6); assert.strictEqual(p.kind, 'g'); assert.strictEqual(p.mode, 'b'); assert.strictEqual(p.z, 2.5);
  close(p.cx, 100.3, 0.06, 'cx'); assert.strictEqual(p.cy, 140); close(p.wipe, 0.37, 1e-9, 'wipe'); assert.strictEqual(p.cold, true);
});
ok('parse ignores junk and out-of-range values', () => {
  const base = {level: 4, kind: 'q', mode: 'w', z: 1.5, cx: 128.5, cy: 128.5, wipe: 0.5, cold: false};
  assert.strictEqual(JSON.stringify(F.parse('#hello', base)), JSON.stringify(base));
  const p = F.parse('#v1~s9~kz~mq~z50~w400~xabc', base);
  assert.strictEqual(p.level, 4); assert.strictEqual(p.kind, 'q'); assert.strictEqual(p.mode, 'w'); assert.strictEqual(p.z, 6); assert.strictEqual(p.wipe, 1);
});
ok('equivalent beam grows with strength; ruler mapping is monotonic', () => {
  let prev = F.beamArcmin({kind: 'q', level: 0});
  assert.strictEqual(prev, 60);
  for (let l = 1; l <= LV.length; l++){ const b = F.beamArcmin({kind: 'q', level: l}); assert.ok(b > prev); prev = b; }
  assert.strictEqual(F.beamArcmin({kind: 'c', level: 3}), 420);
  assert.ok(F.rulerPos(5) < F.rulerPos(60) && F.rulerPos(60) < F.rulerPos(420)); assert.strictEqual(F.rulerPos(1), 0); assert.strictEqual(F.rulerPos(1e5), 1);
});
ok('spot pattern kept falls with strength; quantum keeps more contrast than the Gaussian', () => {
  for (let i = 1; i < LV.length; i++) assert.ok(LV[i].kept <= LV[i - 1].kept + 1e-9);
  for (const L of LV) assert.ok(L.std_ratio >= L.std_ratio_gauss - 1e-9);
});
ok('galaxy-seed census (hot spots kept / lost / phantom) matches the Python reference', () => {
  const u = F.decode16(D.original), o = new Float32Array(N * N);
  for (let i = 0; i < o.length; i++) o[i] = u[i] / D.q * D.meta.uK_per_unit + D.meta.t_lo_uK;
  const R = F.hotSpots(o, N, F.spotThreshold(o), 6); assert.strictEqual(R.length, ref.census.roots);
  const L = LV[3], maps = {q: F.toUK(F.decode16(L.grid), L.shift), g: F.gaussian(o, N, L.sigma_px), c: F.gaussian(o, N, D.cobe.sigma_px)};
  for (const k of ['q', 'g', 'c']){
    const C = F.census(R, F.hotSpots(maps[k], N, F.spotThreshold(maps[k]), 6), 4), r = ref.census[k];
    close(C.nKept, r.kept, 1, k + ' kept'); close(C.nLost, r.lost, 1, k + ' lost'); close(C.nPhantom, r.phantom, 1, k + ' phantom');
    assert.strictEqual(C.nKept + C.nLost, R.length);
  }
  assert.ok(ref.census.q.phantom > ref.census.g.phantom);   // the quantum blur's square blocks invent spots; the smooth beam barely does
});
ok('eye fuzziness follows spot pattern kept: sharp at no blur, a smudge at COBE', () => {
  assert.strictEqual(F.eyeFrame(1, D.cobe.kept), 0); assert.strictEqual(F.eyeFrame(D.cobe.kept, D.cobe.kept), 6);
  let prev = -1; for (const L of LV){ const f = F.eyeFrame(L.kept, D.cobe.kept); assert.ok(f >= prev); prev = f; }
});
console.log(`\n${n} tests passed`);
