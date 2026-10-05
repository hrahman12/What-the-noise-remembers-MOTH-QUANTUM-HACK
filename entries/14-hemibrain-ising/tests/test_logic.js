// Unit tests for the page's pure logic and the server's parameter/caching logic.  Run: node tests/test_logic.js
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HERE = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(HERE, 'web', 'index.html'), 'utf8');
const pure = html.split('/*PURE-START*/')[1].split('/*PURE-END*/')[0];
const L = new Function(pure + '; return {NQ, PAIRS, pairIndex, spinsOf, agreeCount, upCount, corrFromPatterns, meanAbsDiff, edgeMean, betaKey, makeToken, parseToken, colorFor, moodFor, chimeSemis, bfs, hopPath, sqrtScale};')();
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('pairIndex covers every pair once, symmetric', () => {
  assert.strictEqual(L.PAIRS.length, 190);
  L.PAIRS.forEach(([i, j], k) => { assert.strictEqual(L.pairIndex(i, j), k); assert.strictEqual(L.pairIndex(j, i), k); });
});
t('bit convention: 0 is spin up', () => { assert.deepStrictEqual(L.spinsOf('0110'), [1, -1, -1, 1]); assert.strictEqual(L.upCount('0110'), 2); });
t('agreeCount counts bonds whose ends match', () => {
  const edges = [{i: 0, j: 1}, {i: 1, j: 2}, {i: 0, j: 3}];
  assert.strictEqual(L.agreeCount('0011', edges), 1);
  assert.strictEqual(L.agreeCount('1111', edges), 3);
});
t('corrFromPatterns: aligned pair +1, anti-aligned -1, mixed 0', () => {
  const a = '0'.repeat(20), b = '1'.repeat(20), c = '01' + '0'.repeat(18);
  let cr = L.corrFromPatterns([{b: a, w: 3}, {b: b, w: 1}]);
  assert(cr.every(v => Math.abs(v - 1) < 1e-12));
  cr = L.corrFromPatterns([{b: c, w: 1}]);
  assert.strictEqual(cr[L.pairIndex(0, 1)], -1);
  cr = L.corrFromPatterns([{b: a, w: 1}, {b: c, w: 1}]);
  assert.strictEqual(cr[L.pairIndex(0, 1)], 0);
  assert.deepStrictEqual(L.corrFromPatterns([]), new Array(190).fill(0));
});
t('share token round-trips and only uses allowed characters', () => {
  const st = {circuit: 'memory', sampler: 'fez', beta: 0.7, pat: 12, neuron: 19};
  const tok = L.makeToken(st);
  assert(/^[A-Za-z0-9._~-]+$/.test(tok), tok);
  assert.deepStrictEqual(L.parseToken('#' + tok, ['compass', 'memory', 'smell'], ['gibbs', 'emu', 'fez', 'exact']), st);
  assert.deepStrictEqual(L.parseToken('#c.evil.s.<x>.b.99.p.-1.n.400', ['compass'], ['gibbs']), {});
});
t('betaKey matches thrml.json keys', () => { assert.strictEqual(L.betaKey(0.7000000001), '0.7'); assert.strictEqual(L.betaKey(1.5), '1.5'); });
t('colour scale endpoints', () => {
  assert.strictEqual(L.colorFor(0), 'rgb(251,250,249)');  // paper
  assert.strictEqual(L.colorFor(1), 'rgb(25,35,142)');    // ink
  assert.strictEqual(L.colorFor(-5), 'rgb(180,84,26)');    // rust (warn), clamped
});

t('decoration rules: the fly mood and the chime follow the lines in step', () => {
  assert.strictEqual(L.moodFor(30, 30), 'buzz'); assert.strictEqual(L.moodFor(29, 30), 'buzz');
  assert.strictEqual(L.moodFor(28, 30), 'stand'); assert.strictEqual(L.moodFor(23, 30), 'stand');
  assert.strictEqual(L.moodFor(22, 30), 'groom'); assert.strictEqual(L.moodFor(0, 30), 'groom');
  assert.strictEqual(L.chimeSemis(30, 30), 7); assert.strictEqual(L.chimeSemis(0, 30), 1);
  for (let a = 1; a <= 30; a++) assert(L.chimeSemis(a, 30) >= L.chimeSemis(a - 1, 30));
});
t('train routing: bfs hops and paths over the bonds', () => {
  const edges = [{i: 0, j: 1}, {i: 1, j: 2}, {i: 2, j: 3}, {i: 0, j: 3}];
  const {dist, prev} = L.bfs(5, edges, 0);
  assert.deepStrictEqual(dist, [0, 1, 2, 1, -1]);
  const p = L.hopPath(prev, 2); assert.strictEqual(p.length, 2); assert.strictEqual(p[p.length - 1].to, 2); assert.strictEqual(p[0].from, 0);
  assert.deepStrictEqual(L.hopPath(prev, 0), []);
  assert.strictEqual(L.sqrtScale(4, 4, 16), 0); assert.strictEqual(L.sqrtScale(16, 4, 16), 1); assert.strictEqual(L.sqrtScale(9, 4, 16), 0.5);
});

// data embedded in the page
const D = JSON.parse(html.split('const D = ')[1].split(/;\r?\nconst LIVE/)[0]);
t('page data: every circuit has 20 neurons and 30 bonds; THRML has every beta', () => {
  for (const c of D.circuits) {
    assert.strictEqual(c.neurons.length, 20); assert.strictEqual(c.edges.length, 30);
    for (const b of D.thrml.betas) { const k = b.toFixed(1), x = D.thrml.circuits[c.id].betas[k]; assert(x, k); assert.strictEqual(x.corr.length, 190); assert.strictEqual(x.trace.length, 160); }
  }
});
t('page data: the transit map is octilinear, one route per bond, unique stations and names', () => {
  for (const c of D.circuits) {
    const Lc = D.layout[c.id];
    assert.strictEqual(Lc.pos.length, 20); assert.strictEqual(Lc.routes.length, c.edges.length);
    assert.strictEqual(new Set(Lc.pos.map(p => p.join(','))).size, 20);
    assert(Lc.pos.every(([x, y]) => x >= 0 && y >= 0 && x < Lc.cols && y < Lc.rows));
    c.edges.forEach((e, k) => {
      const r = Lc.routes[k]; assert.deepStrictEqual(r[0], Lc.pos[e.i]); assert.deepStrictEqual(r[r.length - 1], Lc.pos[e.j]); assert(r.length <= 3);
      for (let q = 0; q + 1 < r.length; q++) { const dx = Math.abs(r[q + 1][0] - r[q][0]), dy = Math.abs(r[q + 1][1] - r[q][1]); assert(dx === 0 || dy === 0 || dx === dy, c.id + ' route ' + k); }
      // no line runs through another station
      for (let q = 0; q + 1 < r.length; q++) {
        const [x1, y1] = r[q], [x2, y2] = r[q + 1], n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let u = 1; u < n; u++) { const x = x1 + (x2 - x1) * u / n, y = y1 + (y2 - y1) * u / n, hit = Lc.pos.findIndex(p => p[0] === x && p[1] === y); assert(hit < 0 || hit === e.i || hit === e.j, c.id + ' route ' + k + ' passes station ' + hit); }
      }
    });
    assert.strictEqual(new Set(c.neurons.map(n => n.label)).size, 20);
  }
});
t('page data: sprites use only the shared ink palette', () => {
  const SPR = JSON.parse(html.split('const SPR = ')[1].split(/;\r?\n/)[0]);
  for (const k of ['fly', 'flyIcon', 'signal', 'steam', 'maglev', 'blueprint', 'lampOn', 'lampOff', 'puff', 'spark']) assert(SPR[k], k);
  for (const [k, sp] of Object.entries(SPR)) for (const f of sp.frames) for (const row of f) assert(/^[.KBLTWOG]*$/.test(row), k + ': ' + row);
  assert(SPR.fly.frames[0].length >= 64, 'the realistic fly is high-resolution pixel art');
  // warm accent only where there is light: the signal's lamp (lit frames only), not the fly
  assert(!SPR.fly.frames.flat().join('').includes('O') && !SPR.flyIcon.frames.flat().join('').includes('O'));
  assert(!SPR.signal.frames[0].join('').includes('O') && SPR.signal.frames[3].join('').includes('O'));
});
const inPoly = (p, P) => { let hit = false; for (let a = 0, b = P.length - 1; a < P.length; b = a++) { const [x1, y1] = P[a], [x2, y2] = P[b]; if ((y1 > p[1]) !== (y2 > p[1]) && p[0] < x1 + (p[1] - y1) * (x2 - x1) / (y2 - y1)) hit = !hit; } return hit; };
t('page data: brain plate, home regions from the ROI table, stations in or near them', () => {
  const P = D.plate, ids = new Set(P.shapes.map(s => s.id));
  for (const s of P.shapes) for (const [x, y] of s.pts) assert(x >= P.bbox[0] - 1 && x <= P.bbox[2] + 1 && y >= P.bbox[1] - 1 && y <= P.bbox[3] + 1, s.id);
  for (const c of D.circuits) {
    const z = P.zoom[c.id], Lc = D.layout[c.id], A = P.anchors[c.id];
    assert.strictEqual(z.cols, Lc.cols); assert.strictEqual(z.rows, Lc.rows); assert.strictEqual(A.length, 20);
    let inside = 0, near = 0;
    A.forEach((a, i) => {
      assert(ids.has(a.shape), c.id + ' ' + a.shape);
      assert(a.pct > 0 && a.pct <= 100 && a.top[0][0] === a.roi && a.top[0][1] === a.pct, c.id + ' ' + i);
      const p = [z.x0 + Lc.pos[i][0] * z.c, z.y1 - Lc.pos[i][1] * z.c], poly = P.shapes.find(s => s.id === a.shape).pts;
      const seg = (a, b) => { const ax = b[0] - a[0], ay = b[1] - a[1], L = ax * ax + ay * ay, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * ax + (p[1] - a[1]) * ay) / L)); return Math.hypot(p[0] - a[0] - u * ax, p[1] - a[1] - u * ay); };
      const d = inPoly(p, poly) ? 0 : Math.min(...poly.map((q, k) => seg(q, poly[(k + 1) % poly.length])));
      if (d <= 6) inside++; if (d <= 2.6 * z.c) near++;
    });
    assert(inside >= 10, c.id + ' inside or on the edge (6 um): ' + inside);   // the rest sit within 2.6 grid steps of the outline
    assert.strictEqual(near, 20, c.id + ' near ' + near);
  }
});
t('page data: quantum runs are 20-qubit, completed, and their correlations stay in [-1, 1]', () => {
  for (const r of D.runs.filter(r => r.status === 'completed')) {
    assert.strictEqual(r.num_qubits, 20); assert.strictEqual(r.top20.length, 20);
    const cr = L.corrFromPatterns(r.top20.map(m => ({b: m.b, w: m.count})));
    assert(cr.every(v => v >= -1 && v <= 1));
  }
});

// server
const S = require(path.join(HERE, 'app', 'server.js'));
t('server pyDumps writes Python floats and sorted keys', () => {
  assert.strictEqual(S.pyDumps({b: {__float: 1}, a: [1, 2], c: {__float: 0.6549}}), '{"a": [1, 2], "b": 1.0, "c": 0.6549}');
});
t('server cache keys equal the Python client keys of the completed runs', () => {
  const runs = JSON.parse(fs.readFileSync(path.join(HERE, 'out', 'runs.json'), 'utf8')).filter(r => r.status === 'completed');
  for (const r of runs) assert.strictEqual(S.cacheKey(S.buildParams(S.CIRCUITS[r.circuit], r.mode, 0.7)), r.cache_key, r.circuit + '/' + r.mode);
});
console.log(`${n} tests passed`);
