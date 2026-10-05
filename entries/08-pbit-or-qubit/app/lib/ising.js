/* ising.js: pure logic shared by the web app server (Node require) and the page (inlined by build_web.py).
   No DOM, no network. Everything here is CLASSICAL.

   Conventions (same as graph-v1): a bitstring has qubit 0 LEFTMOST; bit '0' = Z = +1 = spin up.
   Ising energy with zero field: E(s) = -sum_edges J_ij s_i s_j, p(s) ~ exp(-E(s)). */
var Ising = (function () {
  'use strict';
  var N = 20;

  function bitsToSpins(str) {               // '0101...' -> Int8Array of +1/-1
    var s = new Int8Array(str.length);
    for (var i = 0; i < str.length; i++) s[i] = str.charCodeAt(i) === 48 ? 1 : -1;
    return s;
  }
  function intToBits(v, n) {                // integer -> bitstring, qubit 0 leftmost (most significant)
    n = n || N;
    var out = '';
    for (var i = n - 1; i >= 0; i--) out += ((v >>> i) & 1) ? '1' : '0';
    return out;
  }

  /* ---------- fingerprints from samples (arrays of Int8Array spins) ---------- */
  function edgeZZ(samples, edges) {
    var out = new Array(edges.length).fill(0), n = samples.length;
    if (!n) return out;
    for (var k = 0; k < edges.length; k++) {
      var a = edges[k][0], b = edges[k][1], acc = 0;
      for (var m = 0; m < n; m++) acc += samples[m][a] * samples[m][b];
      out[k] = acc / n;
    }
    return out;
  }
  function magHist(samples, n) {             // 21 bins: bin k <-> magnetisation 2k - 20, normalised
    n = n || N;
    var h = new Array(n + 1).fill(0);
    if (!samples.length) return h;
    for (var m = 0; m < samples.length; m++) {
      var up = 0;
      for (var i = 0; i < n; i++) if (samples[m][i] > 0) up++;
      h[up] += 1;                              // up spins = (M + n) / 2
    }
    for (var k = 0; k <= n; k++) h[k] /= samples.length;
    return h;
  }
  function h2(p) { return (p <= 0 || p >= 1) ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)); }
  function miPair(samples, a, b) {          // plug-in mutual information (bits) from a 2x2 table
    var c = [0, 0, 0, 0], n = samples.length;
    if (!n) return 0;
    for (var m = 0; m < n; m++) c[(samples[m][a] > 0 ? 0 : 2) + (samples[m][b] > 0 ? 0 : 1)]++;
    var pa = (c[0] + c[1]) / n, pb = (c[0] + c[2]) / n, mi = 0;
    var marg = [[pa, pb], [pa, 1 - pb], [1 - pa, pb], [1 - pa, 1 - pb]];
    for (var k = 0; k < 4; k++) {
      var p = c[k] / n, q = marg[k][0] * marg[k][1];
      if (p > 0 && q > 0) mi += p * Math.log2(p / q);
    }
    return Math.max(0, mi);
  }
  function miMatrix(samples, n) {
    n = n || N;
    var M = new Float64Array(n * n);
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) { var v = miPair(samples, a, b); M[a * n + b] = v; M[b * n + a] = v; }
    return M;
  }
  function meanSigned(zz, signs) {          // average edge correlation, signed by the coupling's sign
    var acc = 0;
    for (var k = 0; k < zz.length; k++) acc += zz[k] * (signs[k] < 0 ? -1 : 1);
    return zz.length ? acc / zz.length : 0;
  }
  function meanZ(samples) {
    var acc = 0, n = 0;
    for (var m = 0; m < samples.length; m++) for (var i = 0; i < samples[m].length; i++) { acc += samples[m][i]; n++; }
    return n ? acc / n : 0;
  }
  function frustration(sample, edges, signs) { // fraction of edges whose bond is unsatisfied
    var bad = 0;
    for (var k = 0; k < edges.length; k++) if (sample[edges[k][0]] * sample[edges[k][1]] * signs[k] < 0) bad++;
    return edges.length ? bad / edges.length : 0;
  }

  /* ---------- seeded randomness ---------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- statistics for the score ---------- */
  function binomTail(k, n) {                 // P(X >= k) for X ~ Binomial(n, 1/2): chance of doing this well by guessing
    if (n <= 0) return 1;
    var c = 1, tail = 0;                     // c = C(n, i)
    for (var i = 0; i <= n; i++) { if (i >= k) tail += c; c = c * (n - i) / (i + 1); }
    return tail / Math.pow(2, n);
  }

  /* ---------- exact Boltzmann statistics by enumeration (2^20 states) ---------- */
  function exactStats(edges, J, n) {
    n = n || N;
    var S = 1 << n, E = edges.length, w = new Float64Array(S), emin = Infinity, i, k;
    var ea = edges.map(function (e) { return n - 1 - e[0]; }), eb = edges.map(function (e) { return n - 1 - e[1]; });
    for (i = 0; i < S; i++) {                // bit (n-1-q) of i is qubit q (qubit 0 = most significant)
      var en = 0;
      for (k = 0; k < E; k++) en -= J[k] * ((((i >>> ea[k]) ^ (i >>> eb[k])) & 1) ? -1 : 1);
      w[i] = en; if (en < emin) emin = en;
    }
    var Z = 0, zz = new Float64Array(E), hist = new Float64Array(n + 1);
    for (i = 0; i < S; i++) {
      var p = Math.exp(-(w[i] - emin)); Z += p;
      for (k = 0; k < E; k++) zz[k] += ((((i >>> ea[k]) ^ (i >>> eb[k])) & 1) ? -p : p);
      var ones = 0, v = i; while (v) { v &= v - 1; ones++; }
      hist[n - ones] += p;
    }
    var out = { edge_zz: [], mag_hist: [] };
    for (k = 0; k < E; k++) out.edge_zz.push(zz[k] / Z);
    for (k = 0; k <= n; k++) out.mag_hist.push(hist[k] / Z);
    return out;
  }

  /* ---------- p-bits: chromatic block Gibbs (the update THRML runs), for live J in the web app ---------- */
  function greedyColoring(edges, n) {
    n = n || N;
    var nb = []; for (var i = 0; i < n; i++) nb.push([]);
    edges.forEach(function (e) { nb[e[0]].push(e[1]); nb[e[1]].push(e[0]); });
    var col = new Array(n).fill(-1);
    for (var v = 0; v < n; v++) {
      var used = {}; nb[v].forEach(function (u) { if (col[u] >= 0) used[col[u]] = 1; });
      var c = 0; while (used[c]) c++; col[v] = c;
    }
    return col;
  }
  function gibbsSample(edges, J, opts) {     // returns array of Int8Array spins
    opts = opts || {};
    var n = opts.n || N, chains = opts.chains || 16, perChain = opts.perChain || 16;
    var warm = opts.warmup || 400, steps = opts.steps || 10, rng = opts.rng || mulberry32(opts.seed || 1);
    var nb = []; for (var i = 0; i < n; i++) nb.push([]);
    edges.forEach(function (e, k) { nb[e[0]].push([e[1], J[k]]); nb[e[1]].push([e[0], J[k]]); });
    var col = greedyColoring(edges, n), ncol = Math.max.apply(null, col) + 1, out = [];
    function sweep(s) {
      for (var c = 0; c < ncol; c++) {        // one colour block at a time; nodes in a block update together
        var field = new Float64Array(n);
        for (var v = 0; v < n; v++) if (col[v] === c) { var g = 0; nb[v].forEach(function (p) { g += p[1] * s[p[0]]; }); field[v] = g; }
        for (var v2 = 0; v2 < n; v2++) if (col[v2] === c) s[v2] = (rng() < 1 / (1 + Math.exp(-2 * field[v2]))) ? 1 : -1;
      }
    }
    var states = [];
    for (var ch = 0; ch < chains; ch++) { var s0 = new Int8Array(n); for (var q = 0; q < n; q++) s0[q] = rng() < 0.5 ? 1 : -1; states.push(s0); }
    for (var w0 = 0; w0 < warm; w0++) states.forEach(sweep);
    for (var m = 0; m < perChain; m++) {
      for (var st = 0; st < steps; st++) states.forEach(sweep);
      states.forEach(function (s) { out.push(Int8Array.from(s)); });  // 16 consecutive samples = 16 different chains
    }
    return out;
  }

  /* ---------- the graph-v1 recipe (must match problems.py) ---------- */
  function graphv1Params(edges, targets, mode, shots, backend) {
    var ops = [];
    for (var q = 0; q < N; q++) ops.push({ type: 'bloch', qubit: q, paulis: { X: 1.0 } });
    edges.forEach(function (e, k) {
      var t = Math.round(targets[k] * 1e4) / 1e4;
      var f = Math.round(2 / Math.PI * Math.asin(Math.min(Math.abs(t), 1)) * 1e4) / 1e4;
      ops.push({ type: 'relationship', qubits: [e[0], e[1]], paulis: { ZZ: t }, fraction: f });
    });
    var p = { num_qubits: N, coupling_map: edges.map(function (e) { return [e[0], e[1]]; }), operations: ops, shots: shots || 20, mode: mode || 'emu' };
    if (p.mode === 'qpu') p.backend_name = backend || 'ibm_fez';
    return p;
  }

  /* ---------- shareable view token: letters, digits, . _ ~ - only ---------- */
  function encodeView(v) { return [v.graph, Number(v.J).toFixed(1).replace('.', 'p'), v.src, v.tile].join('.'); }
  function decodeView(tok, allowed) {
    var m = /^(ring|ladder|random)\.(\d+p\d+)\.(emu|qpu)\.(graph|bars)$/.exec(tok || '');
    if (!m) return null;
    var J = parseFloat(m[2].replace('p', '.'));
    if (allowed && allowed.indexOf(J) < 0) return null;
    return { graph: m[1], J: J, src: m[3], tile: m[4] };
  }

  return { N: N, bitsToSpins: bitsToSpins, intToBits: intToBits, edgeZZ: edgeZZ, magHist: magHist, miPair: miPair,
           miMatrix: miMatrix, meanSigned: meanSigned, meanZ: meanZ, frustration: frustration, h2: h2,
           mulberry32: mulberry32, shuffle: shuffle, binomTail: binomTail, exactStats: exactStats,
           greedyColoring: greedyColoring, gibbsSample: gibbsSample, graphv1Params: graphv1Params,
           encodeView: encodeView, decodeView: decodeView };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Ising;
