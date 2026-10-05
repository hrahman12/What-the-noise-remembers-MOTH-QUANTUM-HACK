// Unit tests for the page's pure logic, run against the BUILT page (web/index.html), not the source file.
//   node tests/test_page.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const scripts = html.split('<script>').slice(1).map(s => s.split('</script>')[0]);
const I = new Function(scripts[0] + '\nreturn Ising;')();
const data = JSON.parse(/const DATA = (\{.*?\});\r?\nconst LIVE/s.exec(scripts[1])[1]);
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('  ok', m); };
const close = (a, b, tol) => Math.abs(a - b) <= tol;

// bit conventions: qubit 0 leftmost, '0' = spin +1
ok(I.intToBits(1) === '00000000000000000001' && I.intToBits(1 << 19)[0] === '1', 'intToBits puts qubit 0 leftmost');
ok(Array.from(I.bitsToSpins('0110')).join() === '1,-1,-1,1', "bitsToSpins maps '0' to +1 and '1' to -1");
for (const v of [0, 1, 12345, 1048575]) assert.strictEqual(parseInt(I.intToBits(v), 2), v);
ok(true, 'intToBits round-trips through parseInt');

// fingerprints on hand-made samples
const up = I.bitsToSpins('0'.repeat(20)), dn = I.bitsToSpins('1'.repeat(20)), alt = I.bitsToSpins('01'.repeat(10));
ok(I.edgeZZ([up, dn], [[0, 1], [0, 19]]).every(v => v === 1), 'edgeZZ = +1 for aligned samples');
ok(I.edgeZZ([alt], [[0, 1]])[0] === -1, 'edgeZZ = -1 for an alternating sample');
const h = I.magHist([up, dn, alt, alt]);
ok(h.length === 21 && close(h.reduce((a, b) => a + b, 0), 1, 1e-12) && h[20] === 0.25 && h[0] === 0.25 && h[10] === 0.5, 'magHist: 21 normalised bins, +20 at the top');
ok(close(I.miPair([up, dn, up, dn], 0, 1), 1, 1e-12), 'mutual information of two copied fair bits = 1 bit');
const indep = []; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const s = new Int8Array(20).fill(1); s[0] = a ? -1 : 1; s[1] = b ? -1 : 1; indep.push(s); }
ok(close(I.miPair(indep, 0, 1), 0, 1e-12), 'mutual information of independent bits = 0');
ok(I.meanSigned([0.5, -0.5], [1, -1]) === 0.5, 'meanSigned flips antiferromagnetic edges');

// score statistics
ok(I.binomTail(0, 10) === 1 && close(I.binomTail(10, 10), 1 / 1024, 1e-15) && close(I.binomTail(15, 20), 0.020694732666015625, 1e-12), 'binomTail matches exact binomial tails');

// shareable token: only letters, digits, . _ ~ -
const v = { graph: 'random', J: 0.4, src: 'qpu', tile: 'bars' };
const tok = I.encodeView(v);
ok(/^[A-Za-z0-9._~-]+$/.test(tok) && JSON.stringify(I.decodeView(tok, [0.4, 1])) === JSON.stringify(v), `view token ${tok} round-trips with allowed characters only`);
ok(I.encodeView({graph: 'ring', J: 1, src: 'emu', tile: 'graph'}) === 'ring.1p0.emu.graph' && I.decodeView('ring.1p0.emu.graph', [0.4, 1]).J === 1, 'J = 1 encodes as 1p0 and decodes back');
ok(I.decodeView('ring.0p7.emu.graph', [0.4, 1]) === null && I.decodeView('<script>', null) === null, 'bad or unknown view tokens are ignored');

// seeded RNG is deterministic; shuffle keeps elements
const r1 = I.mulberry32(5), r2 = I.mulberry32(5);
ok([1, 2, 3].every(() => r1() === r2()), 'mulberry32 is deterministic');
ok(I.shuffle([...Array(20).keys()], I.mulberry32(1)).sort((a, b) => a - b).join() === [...Array(20).keys()].join(), 'shuffle is a permutation');

// embedded data is internally consistent
ok(data.configs.length === 6 && data.configs.every(c => c.pbit.states.length === 4096), '6 problems, 4096 THRML samples each');
ok(data.configs.every(c => c.emu && c.emu.bitstrings.length === 20 && c.emu.bitstrings.every(b => /^[01]{20}$/.test(b))), 'every problem has an emulator job with 20 shots of 20 bits');
ok(data.configs.every(c => !c.qpu || (c.qpu.bitstrings.length === 20 && c.qpu.backend === 'ibm_fez')), 'every hardware job has 20 shots and reports ibm_fez');
ok(data.configs.every(c => c.exact.edge_zz.length === data.graphs[c.graph].edges.length), 'exact targets line up with the edges');

// p-bit sample statistics agree with the exact answer; the JS Gibbs port agrees too
for (const c of data.configs) {
  const g = data.graphs[c.graph], sp = c.pbit.states.map(x => I.bitsToSpins(I.intToBits(x)));
  const zz = I.edgeZZ(sp, g.edges);
  const err = Math.max(...zz.map((z, k) => Math.abs(z - c.exact.edge_zz[k])));
  assert.ok(err < 0.06, `THRML ${c.graph} ${c.J}: ${err}`);
}
ok(true, 'embedded THRML samples match exact edge correlations within 0.06 on every edge');
const ring = data.graphs.ring, cpl = ring.signs.map(s => s * 1.0);
const js = I.gibbsSample(ring.edges, cpl, { chains: 64, perChain: 32, warmup: 200, steps: 5, seed: 3 });
const ex = I.exactStats(ring.edges, cpl);
const m1 = I.meanSigned(I.edgeZZ(js, ring.edges), ring.signs), m0 = I.meanSigned(ex.edge_zz, ring.signs);
ok(close(m1, m0, 0.03), `JS block-Gibbs port: ring J=1 mean edge correlation ${m1.toFixed(3)} vs exact ${m0.toFixed(3)}`);
const rnd = data.graphs.random, col = I.greedyColoring(rnd.edges);
ok(rnd.edges.every(([a, b]) => col[a] !== col[b]), 'greedy colouring never puts neighbours in one block');

console.log(`${n} checks passed`);
