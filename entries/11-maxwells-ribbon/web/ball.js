// Colour ball <-> RGB, the same formula as plate.py (OUR formula: grey centre, white pole theta=0,
// black pole theta=pi, hue = azimuth phi; the HSL bicone is stretched radially to fill the ball).
// Pure functions: inlined into the page by build_web.py and unit-tested with node (test_logic.js).
const BALL = (() => {
  function rgbToBall(rgb) {
    const [R, G, B] = rgb.map(v => v / 255);
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B), c = mx - mn, l = (mx + mn) / 2;
    let h = 0;
    if (c > 1e-9) {
      if (mx === R) h = 60 * (((G - B) / c) % 6);
      else if (mx === G) h = 60 * ((B - R) / c + 2);
      else h = 60 * ((R - G) / c + 4);
    }
    if (h < 0) h += 360;
    const z = 2 * l - 1, rb = Math.hypot(c, z);
    if (rb < 1e-9) return { r: 0, theta: Math.PI / 2, phi: h * Math.PI / 180 };
    const theta = Math.atan2(c, z);
    const r = Math.min(1, rb * (Math.sin(theta) + Math.abs(Math.cos(theta))));
    return { r, theta, phi: h * Math.PI / 180 };
  }
  function hslToRgb(hDeg, c, l) {
    const hp = (((hDeg % 360) + 360) % 360) / 60, x = c * (1 - Math.abs((hp % 2) - 1));
    const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(hp) % 6];
    const m = l - c / 2;
    return t.map(v => Math.round(255 * Math.min(1, Math.max(0, v + m))));
  }
  function ballToRgb(r, theta, phi) {
    const s = Math.sin(theta), co = Math.cos(theta), rb = Math.min(1, r) / (s + Math.abs(co));
    return hslToRgb(phi * 180 / Math.PI, rb * s, (rb * co + 1) / 2);
  }
  // ball point -> Bloch-style vector (x, y, z) with z = up (white), hue 0 (red) along +x
  function toVec(b) { return [b.r * Math.sin(b.theta) * Math.cos(b.phi), b.r * Math.sin(b.theta) * Math.sin(b.phi), b.r * Math.cos(b.theta)]; }
  function fromVec(v) {
    const r = Math.hypot(v[0], v[1], v[2]);
    if (r < 1e-9) return { r: 0, theta: Math.PI / 2, phi: 0 };
    return { r: Math.min(1, r), theta: Math.acos(Math.max(-1, Math.min(1, v[2] / r))), phi: Math.atan2(v[1], v[0]) };
  }
  const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  const unhex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const dist = (a, b) => { const p = toVec(rgbToBall(a)), q = toVec(rgbToBall(b)); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  // index of the swatch whose colour is nearest (in the ball) to rgb
  function nearest(rgb, swatches) {
    let best = 0, bd = Infinity;
    const p = toVec(rgbToBall(rgb));
    swatches.forEach((s, i) => { const q = toVec(rgbToBall(s.rgb)); const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < bd) { bd = d; best = i; } });
    return { i: best, d: bd };
  }
  // classical coin-flip measurement of a Bloch vector along one axis (0=x,1=y,2=z): +1 with prob (1+v)/2
  function measure(v, axis, n, rand) { let plus = 0; for (let k = 0; k < n; k++) if (rand() < (1 + v[axis]) / 2) plus++; return plus; }
  function estimate(t) { // t = {x:[plus,total], y:[...], z:[...]} -> vector, 0 for unmeasured axes
    return ['x', 'y', 'z'].map(a => t[a][1] ? (2 * t[a][0] - t[a][1]) / t[a][1] : 0);
  }
  return { rgbToBall, ballToRgb, hslToRgb, toVec, fromVec, hex, unhex, dist, nearest, measure, estimate };
})();
if (typeof module !== 'undefined') module.exports = BALL;
