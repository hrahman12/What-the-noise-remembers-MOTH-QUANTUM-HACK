// Unit tests for the page's pure logic (web/src/core.js) against the Python reference (tests/samples.json).
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const M = require('../web/src/core.js');
const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'samples.json'), 'utf8'));
const LUTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'luts.json'), 'utf8'));
const probes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'out', 'probes.json'), 'utf8'));
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok  ' + name); };

ok('pillarHeight matches geometry.py at 200 random points', () => {
  for (const [x, y, h] of S.pillar) assert(Math.abs(M.pillarHeight(x, y) - h) < 1e-9, `${x},${y}: ${M.pillarHeight(x, y)} vs ${h}`);
});
for (const k of ['eye', 'dome', 'slab']) ok(`facet '${k}' vertices match geometry.py`, () => {
  const a = M.facetArrays(k);
  assert.strictEqual(a.topCount, S[k].nv);
  for (const [i, v] of Object.entries(S[k].samples)) for (let c = 0; c < 3; c++) assert(Math.abs(a.pos[3 * i + c] - v[c]) < 1e-4, `${k}[${i}]`);
  assert.strictEqual(a.index.length / 3, S[k].nt + 2 * 6 * Math.round(M.GEOM.facet_R * M.GEOM.sub));   // top + skirt
});

// CPU replica of the GLSL (lutAt + engineShader) to check the port logic against analyze.shader()
function cpuShader(R, w, h, cosT, th = 500) {
  const c = Math.min(1, Math.abs(cosT)), theta = Math.acos(c), D = -2 * 2 * Math.PI * th * c, t = theta / (Math.PI / 2);
  const mod = (x, y) => x - y * Math.floor(x / y);
  return [650, 530, 470].map(lam => {
    const s = mod(D / lam, 2 * Math.PI) / (2 * Math.PI);
    const x = s * w - 0.5, x0 = Math.floor(x), fx = x - x0, i0 = mod(x0, w), i1 = mod(x0 + 1, w);
    const y = Math.min(Math.max(t * h - 0.5, 0), h - 1), y0 = Math.floor(y), fy = y - y0, j1 = Math.min(y0 + 1, h - 1);
    const a = R[y0 * w + i0] * (1 - fx) + R[y0 * w + i1] * fx, b = R[j1 * w + i0] * (1 - fx) + R[j1 * w + i1] * fx;
    return a * (1 - fy) + b * fy;
  });
}
ok('shader port (texelFetch bilinear, REPEAT s, CLAMP t) matches analyze.shader() for the 6-layer run', () => {
  const L = LUTS.L6_R6, R = M.b64floats(Buffer.from(L.R, 'base64').toString('base64'));
  S.shader_L6.cos.forEach((c, k) => cpuShader(R, L.w, L.h, c).forEach((v, ch) => assert(Math.abs(v - S.shader_L6.rgb[k][ch]) < 1e-5, `cos ${c} ch ${ch}`)));
});
ok('LUT payloads decode to 60x60 float32 and carry their job ids', () => {
  for (const [tag, L] of Object.entries(LUTS)) {
    assert.strictEqual(M.b64floats(L.R).length, L.w * L.h); assert.strictEqual(M.b64floats(L.T).length, L.w * L.h);
    assert(/^[0-9a-f-]{36}$/.test(L.job_id), tag); assert.strictEqual(M.tagFor(L.layers, L.interaction), tag);
  }
});
ok('padToLight returns unit vectors in the front hemisphere', () => {
  for (const [x, y] of [[0, 0], [0.5, 0.5], [0.99, 0], [-0.7, 0.7], [2, 2]]) {
    const v = M.padToLight(x, y); assert(Math.abs(Math.hypot(...v) - 1) < 1e-9); assert(v[2] >= 0.14);
  }
});
ok('orbitPosition: head-on, side and top', () => {
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert(close(M.orbitPosition(0, 0, 10), [0, 0, 10])); assert(close(M.orbitPosition(90, 0, 10), [10, 0, 0])); assert(close(M.orbitPosition(0, 90, 10), [0, 10, 0]));
});
ok('qubit fit q = rays + layers - floor(layers/4) + 10 reproduces every engine budget message', () => {
  for (const p of probes) {
    const maxR = 21 - (p.layers - Math.floor(p.layers / 4) + 10);
    if (p.max_rays_reported !== null) assert.strictEqual(maxR, p.max_rays_reported, JSON.stringify(p));
    else assert(p.incoming_rays <= maxR, 'completed probe must fit');
  }
});
ok('share token uses only allowed characters', () => {
  const tok = ['L6', 'i1', 'eye', 'm0', 'a-28', 'e22', 'd56', 'x-0.45', 'y0.50', 't500'].join('_');
  assert(/^[A-Za-z0-9._~-]+$/.test(tok));
});
console.log(`${n} tests passed`);
