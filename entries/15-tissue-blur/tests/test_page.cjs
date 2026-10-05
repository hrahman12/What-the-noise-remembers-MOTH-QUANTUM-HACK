// Unit tests for the page's pure logic. Run: node tests/test_page.cjs (after python build_web.py)
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const mod = {exports: {}};
new Function("module", src)(mod);
const P = mod.exports, D = P.D;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('8 jobs, all 20 qubits', () => { assert.strictEqual(D.jobs.length, 8); D.jobs.forEach(j => assert.strictEqual(j.qubits, 20)); });
t('every echo lens view exists for both sets', () => {
  for (const s of ['A', 'B']) for (const m of ['lens_282', 'lens_512', 'lens_742']) assert.ok(P.findJob(D.jobs, s, m, 'echo'), s + m);
});
t('settle keeps a computed view unchanged', () => {
  const v = P.settle(D.jobs, {set: 'B', mask: 'lens_282', setting: 'echo'}, 'mask');
  assert.deepStrictEqual([v.set, v.mask, v.setting, v.changed.length], ['B', 'lens_282', 'echo', 0]);
});
t('reach 0.5 from set B jumps to the one plaid job', () => {
  const v = P.settle(D.jobs, {set: 'B', mask: 'lens_742', setting: 'plaid'}, 'setting');
  assert.deepStrictEqual([v.set, v.mask, v.setting], ['A', 'lens_512', 'plaid']);
  assert.deepStrictEqual(v.changed.sort(), ['mask', 'set']);
});
t('moving the lens while on plaid drops to echo, keeps the lens', () => {
  const v = P.settle(D.jobs, {set: 'A', mask: 'lens_282', setting: 'plaid'}, 'mask');
  assert.deepStrictEqual([v.set, v.mask, v.setting, v.changed.join()], ['A', 'lens_282', 'echo', 'setting']);
});
t('whole section on set B switches set to A', () => {
  const v = P.settle(D.jobs, {set: 'B', mask: 'section', setting: 'echo'}, 'mask');
  assert.deepStrictEqual([v.set, v.mask, v.setting], ['A', 'section', 'echo']);
});
t('switching to set B while on section keeps B, moves mask', () => {
  const v = P.settle(D.jobs, {set: 'B', mask: 'section', setting: 'echo'}, 'set');
  assert.strictEqual(v.set, 'B'); assert.ok(v.mask.startsWith('lens_'));
});
t('nearestLens snaps', () => {
  assert.strictEqual(P.nearestLens(D.masks, 0), 'lens_282');
  assert.strictEqual(P.nearestLens(D.masks, 600), 'lens_512');
  assert.strictEqual(P.nearestLens(D.masks, 1023), 'lens_742');
});
t('inMask lens and section', () => {
  const L = D.masks.lens_512; assert.ok(P.inMask(L, L.x, L.y)); assert.ok(!P.inMask(L, 0, 0));
  const S = D.masks.section; assert.ok(P.inMask(S, 512, 320)); assert.ok(!P.inMask(S, 2, 2));
});
t('token round trip and rejects junk', () => {
  const s = {set: 'B', gene: 1, mask: 'lens_742', setting: 'echo', wipe: .37, tool: 'move', view: 'data'};
  const tok = P.encodeToken(s); assert.ok(/^[A-Za-z0-9._~-]+$/.test(tok), tok);
  assert.strictEqual(tok, 'B.C1ql2.lens_742.echo.w37.move.data');
  assert.deepStrictEqual(P.decodeToken('#' + tok), s);
  const s2 = {set: 'A', gene: -1, mask: 'section', setting: 'echo', wipe: .5, tool: 'wipe', view: 'scene'};
  assert.strictEqual(P.encodeToken(s2), 'A.all.section.echo.w50.wipe');
  assert.deepStrictEqual(P.decodeToken('#' + P.encodeToken(s2)), s2);
  // older 5-part links still open: wipe tool on only if the wipe was moved, Scene view
  assert.deepStrictEqual(P.decodeToken('#A.Satb2.lens_512.echo.w50'), {set: 'A', gene: 0, mask: 'lens_512', setting: 'echo', wipe: .5, tool: 'move', view: 'scene'});
  assert.strictEqual(P.decodeToken('#A.Satb2.lens_512.echo.w20').tool, 'wipe');
  assert.strictEqual(P.decodeToken('#A.all.lens_512.echo.w50.fly'), null);
  assert.strictEqual(P.decodeToken('#A.all.lens_512.echo.w50.move.chart'), null);
  assert.strictEqual(P.decodeToken('#B.Nope.lens_742.echo.w50'), null);
  assert.strictEqual(P.decodeToken('#<script>'), null);
  assert.strictEqual(P.decodeToken('#Z.all.lens_512.echo.w50'), null);
  assert.strictEqual(P.decodeToken('#A.all.lens_512.echo.w999').wipe, 1);
});
t('colorize: pigments on white; composite is subtractive, single gene uses its LUT', () => {
  const p = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]), o = new Uint8ClampedArray(8);
  P.colorize(p, o, -1); assert.deepStrictEqual([...o.slice(0, 4)], [...P.COL[0], 255]); assert.deepStrictEqual([...o.slice(4)], [255, 255, 255, 255]);
  P.colorize(p, o, 1); assert.deepStrictEqual([...o.slice(0, 3)], [255, 255, 255]);   // green channel is 0: no pigment
  P.colorize(p, o, 0); assert.deepStrictEqual([...o.slice(0, 3)], [255, 255, 255].map((w, k) => P.LUT[0][255 * 3 + k]));
  for (let g = 0; g < 3; g++){ assert.deepStrictEqual([0, 1, 2].map(k => P.LUT[g][k]), [255, 255, 255]);   // zero = paper
    for (let v = 1; v < 256; v++) for (let k = 0; k < 3; k++) assert.ok(P.LUT[g][v * 3 + k] <= P.LUT[g][(v - 1) * 3 + k], 'LUT darkens monotonically'); }
  const two = new Uint8ClampedArray([255, 255, 0, 255]), o2 = new Uint8ClampedArray(4); P.colorize(two, o2, -1);
  for (let k = 0; k < 3; k++) assert.ok(o2[k] <= Math.min(P.COL[0][k], P.COL[1][k]), 'overlapping pigments darken');
});
t('summary numbers come from the data', () => {
  const e = P.summary(D.jobs, 'echo'), p = P.summary(D.jobs, 'plaid');
  assert.ok(e.rmin > 0.7 && e.rmax < 0.95 && e.n === 20, JSON.stringify(e));
  assert.ok(p.rmax < 0 && p.gmin > 0.6, JSON.stringify(p));
});
t('ghost counts follow ghost signal: ~1 per 10%, at least 1, none for absent genes', () => {
  assert.strictEqual(P.ghostCount({present: true, ghost_blurred: .0473}), 1);
  assert.strictEqual(P.ghostCount({present: true, ghost_blurred: .1632}), 2);
  assert.strictEqual(P.ghostCount({present: true, ghost_blurred: .2508}), 3);
  assert.strictEqual(P.ghostCount({present: true, ghost_blurred: .9418}), 9);
  assert.strictEqual(P.ghostCount({present: true, ghost_blurred: .005}), 0);
  assert.strictEqual(P.ghostCount({present: false, ghost_blurred: .79}), 0);
});
t('every ghost sits on a real dark-measured, brighter-blurred pixel inside the mask, and there are enough of them', () => {
  for (const j of D.jobs){
    const mk = D.masks[j.mask];
    j.stats.forEach((s, g) => {
      const cand = j.ghosts[g];
      assert.ok(cand.length >= P.ghostCount(s), `${j.job_id} gene ${g}: ${cand.length} spots < ${P.ghostCount(s)}`);
      for (const [x, y, m, b] of cand){ assert.ok(m < 4 / 255 && b >= 12 / 255 - 6e-4, 'ghost pixel values'); assert.ok(P.inMask(mk, x, y), 'ghost inside mask'); }
    });
    const placed = P.placeGhosts(j, [0, 1, 2], 40);
    assert.strictEqual(placed.length, j.stats.reduce((a, s) => a + P.ghostCount(s), 0));
  }
  const plaid = D.jobs.find(j => j.setting === 'plaid');
  assert.strictEqual(P.placeGhosts(plaid, [0, 1, 2], 40).length, 22);
});
t('the mouse mood and words come from the job stats', () => {
  assert.strictEqual(P.mood([.86, .88, .93]), 'happy'); assert.strictEqual(P.mood([.62, .7]), 'hmm'); assert.strictEqual(P.mood([-.04, -.12]), 'dizzy');
  const echo = P.findJob(D.jobs, 'A', 'lens_512', 'echo'), plaid = P.findJob(D.jobs, 'A', 'lens_512', 'plaid');
  const v1 = P.verdict(echo, D.composites.A, [0, 1, 2], 'Centre lens'), v2 = P.verdict(plaid, D.composites.A, [0, 1, 2], 'Centre lens');
  assert.strictEqual(v1.mood, 'happy'); assert.ok(/agreement r 0\.86 to 0\.93/.test(v1.text), v1.text); assert.strictEqual(v1.n, 3);
  assert.strictEqual(v2.mood, 'dizzy'); assert.ok(/plaid/.test(v2.text) && /64 to 94%/.test(v2.text), v2.text); assert.strictEqual(v2.n, 22);
  const front = P.findJob(D.jobs, 'A', 'lens_282', 'echo'), v3 = P.verdict(front, D.composites.A, [2], 'Front lens');
  assert.strictEqual(v3.n, 0); assert.ok(/Gabra6 is barely present/.test(v3.text), v3.text);
});
t('the mouse stands beside the lens with its paw on the handle', () => {
  const a = P.mousePose(400, 250, 230, 1, 4, 512), b = P.mousePose(600, 250, 230, -1, 4, 512);
  assert.ok(!a.flip && a.pawX > a.rimX && a.pawY > a.rimY && a.top + 26 * 4 <= 512);
  assert.ok(b.flip && b.pawX < b.rimX && Math.abs(b.left + 25.5 * 4 - b.pawX) < 1e-9);
});
t('sprites use only the shared ink palette', () => {
  for (const [k, v] of Object.entries(P.SPR)) for (const f of v.frames){ const w = f[0].length; for (const r of f){ assert.strictEqual(r.length, w, k); assert.ok(/^[.KBLTWOG]+$/.test(r), k); } }
});
console.log(n + ' tests passed');
