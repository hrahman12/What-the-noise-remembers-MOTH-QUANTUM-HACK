// Unit tests for the page's pure logic: node tests/test_page.js (from the entry folder).
// Runs the geometry block from web/index.html against the Python reference points in scroll.json.
const fs = require('fs'), path = require('path'), assert = require('assert');
const here = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(here, 'web', 'index.html'), 'utf8');
const geoSrc = html.split('/*GEO-START*/')[1].split('/*GEO-END*/')[0];
const lib = new Function(geoSrc + '; return {makeGeo, contrastWindow, shade, encodeHash, decodeHash, fmtR};')();
const info = JSON.parse(fs.readFileSync(path.join(here, 'scroll.json'), 'utf8'));
const G = lib.makeGeo(info.geometry);
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

ok(G.L === info.L, `L: js ${G.L} vs python ${info.L}`);
ok(G.H === info.H, 'H');
for (const c of info.check) {      // sheet -> image matches Python to a hundredth of a pixel
  const q = G.toImage(c.s, c.t);
  ok(Math.hypot(q[0] - c.xy[0], q[1] - c.xy[1]) < 0.01, `toImage(${c.s},${c.t}) = ${q} vs ${c.xy}`);
}
for (let i = 0; i < 400; i++) {    // image -> sheet inverts sheet -> image
  const s = 5 + Math.random() * (G.L - 10), t = (Math.random() - 0.5) * (G.H - 2);
  const q = G.toImage(s, t), r = G.toSheet(q[0], q[1]);
  ok(r.valid && Math.abs(r.s - s) < 0.05 && Math.abs(r.t - t) < 0.05, `roundtrip s=${s} t=${t} -> ${JSON.stringify(r)}`);
}
// the unroll motion: at u = 0 the world is the scan itself (shifted), flat part reads left to right, outward is down
let fr = G.frame(G.L);
ok(Math.abs(fr.tx - 1) < 0.001 && Math.abs(fr.ty) < 0.03, `outer end heads right (within 2 degrees): ${fr.tx},${fr.ty}`);
for (const sp of [G.L, 9000, 4000, 1200, 30]) {
  fr = G.frame(sp);
  const a = G.world(fr, sp, sp - 0.01, 0), b = G.world(fr, sp, sp, 0);
  ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.1, `roll and ribbon meet at sp=${sp}`);
  const o = G.world(fr, sp, sp - 0.01, 10);      // outward (t > 0) maps to +y
  ok(o[1] > 9 && o[1] < 11, `outward is +y at sp=${sp}: ${o}`);
  // the roll is a rigid motion: distances are preserved
  const p1 = G.toImage(sp * 0.5, 3), p2 = G.toImage(sp * 0.3, -7), w1 = G.world(fr, sp, sp * 0.5, 3), w2 = G.world(fr, sp, sp * 0.3, -7);
  ok(Math.abs(Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) - Math.hypot(w1[0] - w2[0], w1[1] - w2[1])) < 1e-6, 'rigid');
  // the roll never dips into the ribbon: every roll point sits above the table line y = H/2
  let maxY = -1e9; for (let s = 0; s < sp; s += 7) maxY = Math.max(maxY, G.world(fr, sp, s, G.H / 2)[1]);
  ok(maxY <= G.H / 2 + 0.6, `roll stays on the table at sp=${sp}: max y ${maxY}`);
  // unworld inverts world on both parts
  for (const [s, t] of [[sp * 0.6, 4], [Math.min(G.L - 1, sp + 50), -6]]) {
    const w = G.world(fr, sp, s, t), back = G.unworld(fr, sp, w[0], w[1]);
    ok(back && Math.abs(back.s - s) < 0.1 && Math.abs(back.t - t) < 0.1, `unworld at sp=${sp}, s=${s}: ${JSON.stringify(back)}`);
  }
}
// pure helpers
const cw = lib.contrastWindow(35); ok(cw.lo < cw.hi, 'contrast window');
ok(lib.shade(0, 1, { inkOnly: true }).join() === '255,255,255', 'ink only is raw');
const plain = lib.shade(0.4, 0, { gain: 0.15, lo: 0, hi: 1, tint: false }), inked = lib.shade(0.4, 1, { gain: 0.15, lo: 0, hi: 1, tint: false });
ok(inked[0] < plain[0] && inked[2] < plain[2], 'ink darkens toward the page ink (ink on paper)');
ok(lib.shade(0, 0, { gain: 0.15, lo: 0.1, hi: 0.9, tint: false }).join() === '251,250,249', 'empty air is paper');
ok(lib.shade(1, 1, { gain: 0.15, lo: 0.1, hi: 0.9, tint: false }).join() === '25,35,142', 'full density is the ink colour');
const tinted = lib.shade(0.4, 1, { gain: 0.15, lo: 0, hi: 1, tint: true }); ok(tinted[0] > tinted[2] && tinted[0] > inked[0], 'tint is the warm accent');
const st = { u: 0.62, w0: 1880, d: 3, clean: true, inkOnly: false, tint: true, k: 70, zoom: 2.5, close: true, view: 'data' };
const h = lib.encodeHash(st); ok(/^[A-Za-z0-9._~-]+$/.test(h), 'hash charset ' + h);
const back = lib.decodeHash('#' + h, 8, G.L); ok(JSON.stringify(back) === JSON.stringify(st), 'hash roundtrip ' + JSON.stringify(back));
ok(lib.decodeHash('#junk', 8, G.L) === null, 'bad hash ignored');
ok(lib.decodeHash('#u1000.w1529.d3.c0.l0.t0.k35.z10.x0', 8, G.L).view === 'scene', 'older links (no view field) open the scene');
ok(lib.decodeHash('#' + lib.encodeHash({ ...st, view: 'scene' }), 8, G.L).view === 'scene', 'scene view round-trips');
ok(lib.fmtR(-0.00495) === '0.00' && lib.fmtR(0.71533) === '0.72' && lib.fmtR(0.98293) === '0.98', 'r formatting: two decimals, no -0.00');
ok(lib.decodeHash('#u5000.w99999.d77.c0.l0.t0.k400.z900.x0', 8, G.L).d === 8, 'hash clamps');
// the job ladder is sorted by damage and every job is real
const jobs = JSON.parse(html.split('const JOBS = ')[1].split(/;\r?\n/)[0]);
ok(jobs.length === 9, 'nine jobs');
for (let i = 1; i < jobs.length; i++) ok(jobs[i].off_ink >= jobs[i - 1].off_ink, 'ladder sorted');
for (const j of jobs) ok(/^[0-9a-f-]{36}$/.test(j.job_id) && fs.existsSync(path.join(here, 'web', j.img)), 'job ' + j.job_id);
console.log(`${n} checks passed`);
