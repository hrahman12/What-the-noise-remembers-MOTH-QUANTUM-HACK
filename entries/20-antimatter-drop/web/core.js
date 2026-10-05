/* Antimatter Drop: pure logic, no DOM. Inlined into the page by build_web.py and unit-tested by
   test_core.js. Everything here is CLASSICAL; the only quantum input is the bank of conditioned bytes
   from comet-qrng-v1, which this code reads 16 bits at a time as dice. */
(function (root) {
  'use strict';

  // Probability that an atom is counted escaping DOWN at a nominal bias, from Table 1 of
  // Anderson et al., Nature 621, 716-722 (2023): background-corrected event counts, clamped at 0.
  function pDown(nUp, nDn) {
    const u = Math.max(0, nUp), d = Math.max(0, nDn);
    return u + d > 0 ? d / (u + d) : 0.5;
  }
  // Integer threshold on a 16-bit word: an atom goes down when word < threshold(p).
  function threshold(p) {
    return Math.max(0, Math.min(65536, Math.round(p * 65536)));
  }
  function hexToBytes(hex) {
    const n = hex.length >> 1, out = new Uint8Array(n);
    for (let i = 0; i < n; i++) out[i] = parseInt(hex.substr(2 * i, 2), 16);
    return out;
  }
  function word16(bytes, off) {
    return (bytes[off] << 8) | bytes[off + 1];
  }
  // One atom's fate from one 16-bit word.
  function decide(word, p) {
    return word < threshold(p) ? 'dn' : 'up';
  }
  // Draw from a bank at a byte offset. Returns null when the bank is used up (never wraps silently).
  function drawFromBank(bytes, off, p) {
    if (off + 2 > bytes.length) return null;
    const w = word16(bytes, off);
    return { word: w, off: off, next: off + 2, t: threshold(p), dir: decide(w, p) };
  }
  // Escapes per trial and per bias series, as in Table 1 (rounded; used for the trap size).
  function seriesSize(row) {
    return Math.round(Math.max(0, row.n_up) + Math.max(0, row.n_dn));
  }
  function trialSize(row) {
    return Math.max(1, Math.round((Math.max(0, row.n_up) + Math.max(0, row.n_dn)) / row.trials));
  }

  // Cosmetic classical PRNG (motion, timing, vertex positions). Never used for an atom's fate.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Wilson score interval for k successes in n trials at z sigma.
  function wilson(k, n, z) {
    if (!(n > 0)) return null;
    z = z || 1;
    const p = k / n, z2 = z * z, den = 1 + z2 / n;
    const c = (p + z2 / (2 * n)) / den;
    const h = (z / den) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { p: p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
  }

  function logistic(b, b0, w) {
    return 1 / (1 + Math.exp(-(b - b0) / w));
  }
  // Maximum-likelihood logistic escape curve P_dn(b) = 1/(1+exp(-(b-b0)/w)) by grid search, with a
  // profile-likelihood 1-sigma interval on the balance point b0 (where P_dn = 0.5).
  // points: [{b, dn, up}] (counts may be fractional, e.g. Table 1). Returns null if under-determined.
  function fitLogistic(points) {
    const pts = points.filter(function (q) { return q.dn + q.up > 0; });
    const nb = new Set(pts.map(function (q) { return q.b; })).size;
    const tot = pts.reduce(function (s, q) { return s + q.dn + q.up; }, 0);
    const dn = pts.reduce(function (s, q) { return s + q.dn; }, 0);
    if (nb < 2 || tot < 10 || dn <= 0 || dn >= tot) return null;
    const B0 = [], W = [];
    for (let b = -4; b <= 4.0001; b += 0.02) B0.push(Math.round(b * 100) / 100);
    for (let w = 0.1; w <= 3.0001; w += 0.025) W.push(Math.round(w * 1000) / 1000);
    function ll(b0, w) {
      let s = 0;
      for (const q of pts) {
        const p = Math.min(1 - 1e-12, Math.max(1e-12, logistic(q.b, b0, w)));
        s += Math.max(0, q.dn) * Math.log(p) + Math.max(0, q.up) * Math.log(1 - p);
      }
      return s;
    }
    let best = { ll: -Infinity }, prof = [];
    for (const b0 of B0) {
      let m = -Infinity, mw = W[0];
      for (const w of W) { const v = ll(b0, w); if (v > m) { m = v; mw = w; } }
      prof.push([b0, m]);
      if (m > best.ll) best = { ll: m, b0: b0, w: mw };
    }
    const inside = prof.filter(function (r) { return 2 * (best.ll - r[1]) <= 1; }).map(function (r) { return r[0]; });
    const lo = Math.min.apply(null, inside), hi = Math.max.apply(null, inside);
    return { b0: best.b0, w: best.w, lo: lo, hi: hi, open: lo <= B0[0] || hi >= B0[B0.length - 1], n: tot };
  }

  // Shareable state in #token: letters, digits, . _ ~ - only.
  // v1_<src>_b<biasIndex>_f<fezOffset36>_e<emuOffset36>_t<up36.dn36~...>
  const SOURCES = ['fez', 'emu', 'cls'];
  function encodeToken(s) {
    const t = s.tally.map(function (r) { return r[0].toString(36) + '.' + r[1].toString(36); }).join('~');
    return ['v1', s.src, 'b' + s.bi, 'f' + s.off.fez.toString(36), 'e' + s.off.emu.toString(36), 't' + t].join('_');
  }
  function decodeToken(str, nBias, limits) {
    const m = /^v1_(fez|emu|cls)_b(\d{1,2})_f([0-9a-z]{1,6})_e([0-9a-z]{1,6})_t([0-9a-z.~]*)$/.exec(str || '');
    if (!m) return null;
    const bi = +m[2];
    if (bi < 0 || bi >= nBias) return null;
    const off = { fez: parseInt(m[3], 36), emu: parseInt(m[4], 36) };
    if (off.fez % 2 || off.emu % 2) return null;
    if (limits && (off.fez > limits.fez || off.emu > limits.emu)) return null;
    const parts = m[5] ? m[5].split('~') : [];
    if (parts.length !== nBias) return null;
    const tally = [];
    for (const p of parts) {
      const x = /^([0-9a-z]{1,5})\.([0-9a-z]{1,5})$/.exec(p);
      if (!x) return null;
      tally.push([parseInt(x[1], 36), parseInt(x[2], 36)]);
    }
    return { src: m[1], bi: bi, off: off, tally: tally };
  }

  const CORE = { pDown, threshold, hexToBytes, word16, decide, drawFromBank, seriesSize, trialSize,
    mulberry32, wilson, logistic, fitLogistic, encodeToken, decodeToken, SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
  else root.CORE = CORE;
})(typeof window !== 'undefined' ? window : this);
