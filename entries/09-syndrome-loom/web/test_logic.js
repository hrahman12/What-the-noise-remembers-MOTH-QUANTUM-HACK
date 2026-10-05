// Unit-test the page's pure logic with node: node web/test_logic.js web/index.html cases.json
// cases.json = [{p, profile, seed, view, codewords, width, wif}] where wif is a draft written by the Python CLI
// for the demo moth with the same settings. The page must reproduce each draft byte for byte.
const fs = require('fs');
const assert = require('assert');
const [, , htmlPath, casesPath] = process.argv;
const html = fs.readFileSync(htmlPath, 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const m = script.match(/const CAL = (.*);\r?\nconst DEMO = (.*);\r?\n\/\*LOGIC\*\/([\s\S]*)\/\*END LOGIC\*\//);
assert(m, 'LOGIC block or data not found');
const CAL = JSON.parse(m[1]), DEMO = JSON.parse(m[2]);
assert.deepStrictEqual(DEMO.widths['32'], DEMO.bits, 'the 32-wide moth must be the default demo');
const api = new Function(m[3] + '\nreturn {mulberry32,syndrome,flip,correct,parity,EVEN,ODD,codeword,levelOf,ratesOf,sample,drawdown,counts,toWif,wifNotes,otsu,binarise,BAND};')();

// prng twin
const r = api.mulberry32(1);
assert.deepStrictEqual([r(), r(), r()], [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
// code tables
assert.strictEqual(api.EVEN.length, 8); assert.deepStrictEqual(api.EVEN[0], [0, 0, 0, 0, 0, 0, 0]);
assert.deepStrictEqual(api.ODD[0], [1, 1, 1, 1, 1, 1, 1]);
for (let pos = 1; pos <= 7; pos++) for (const w of api.EVEN.concat(api.ODD)) {
  const [c, s] = api.correct(api.flip(w, pos)); assert.strictEqual(s, pos); assert.deepStrictEqual(c, w);
}
// state transitions: turning up p only adds events (same seed)
const bits = DEMO.bits;
const lo = api.sample(bits, {L0: 0.01, L1: 0.01, s: 0.1}, 7, 'plain'), hi = api.sample(bits, {L0: 0.1, L1: 0.1, s: 0.6}, 7, 'plain');
lo.forEach((row, y) => row.forEach((b, x) => { if (b.flagged) assert(hi[y][x].flagged && hi[y][x].pos === b.pos); if (b.failed) assert(hi[y][x].failed); }));
// drawdown geometry
const dd = api.drawdown(lo, 'received');
assert.strictEqual(dd.cells.length, bits.length * api.BAND);
assert.strictEqual(dd.cells[0].length, bits[0].length * 7);
// otsu on a two-level image splits it
const g = new Float64Array(100).map((_, i) => i < 50 ? 20 : 220);
assert.deepStrictEqual(api.binarise(g, 10, 10, false).flat().reduce((a, b) => a + b, 0), 50);

// byte-for-byte parity with the Python CLI
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
for (const c of cases) {
  const lv = api.levelOf(CAL, c.profile, c.p);
  const bitsW = c.width && c.width !== 32 ? DEMO.widths[String(c.width)] : DEMO.bits; // the page's Width control
  assert(bitsW, 'no demo bits for width ' + c.width);
  const blocks = api.sample(bitsW, api.ratesOf(lv), c.seed, c.codewords);
  const d = api.drawdown(blocks, c.view);
  const notes = api.wifNotes({name: DEMO.name, p: lv.p, profile: c.profile, seed: c.seed, view: c.view, codewords: c.codewords,
    engine: CAL.engine, job: lv.se.job_id, simulator: CAL.simulator, c: api.counts(blocks)});
  const text = api.toWif(d.cells, d.weft, 'Syndrome Loom: ' + DEMO.stem + ', p=' + lv.p, notes);
  const ref = fs.readFileSync(c.wif, 'latin1');
  assert.strictEqual(text, ref, 'WIF mismatch for ' + JSON.stringify(c));
}
console.log('page logic OK: ' + cases.length + ' WIF drafts identical to the Python CLI');
