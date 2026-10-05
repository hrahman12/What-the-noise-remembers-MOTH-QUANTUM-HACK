// Moth to Flame: level geometry + the moth's flight model. CLASSICAL, simplified, pure (no DOM).
// Units: one town square = 1. Screen y points down, so a positive turn is clockwise.
// The flight rule is a 2D cartoon of the dorsal-light response (Fabian et al., Nat Commun 2024):
// the moth banks its back toward the brightest light it can see, which in a top-down view swings
// its heading until the lamp sits abeam, so it circles instead of flying on.
var Sim = (function () {
  var TAU = Math.PI * 2;
  function wrap(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  var DEFAULTS = {
    speed: 1.15,      // squares per second, cruising
    boostMul: 1.6,    // wingbeat harder
    turnMax: 3.3,     // rad/s the player can command
    gain: 4.0,        // DLR turn rate at saturating brightness (rad/s)
    I0: 0.25,         // brightness at which the DLR is half-saturated
    pull: 1,          // user slider, 0..2
    inward: 0.75,     // rad: the lamp sits ahead of abeam, so orbits close in (radius ~0.4)
    range: 3.2,       // squares: lamps further than this are ignored
    glowI: 3,         // brightness above which the glare exhausts the moth (about 0.55 squares out)
    glowDrain: 6,     // energy/s at full glare
    drain: 1.2,       // energy/s just flying (set per level)
    boostDrain: 0.6,  // extra energy/s while flapping hard
    radius: 0.07,     // moth body
    post: 0.06,       // lamp post
    homeR: 0.3
  };

  function hash(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  // level: {rows, cols, edges:[[a,b,planSign,zz]], start, home}; bits: '0101...' (qubit 0 leftmost)
  function build(level, bits) {
    var rows = level.rows, cols = level.cols, segs = [], lamps = [];
    level.edges.forEach(function (e) {
      var a = e[0], b = e[1], zz = e[3];
      if (!(zz < 0)) return;                       // measured <ZZ> >= 0: open street
      var ra = Math.floor(a / cols), ca = a % cols, rb = Math.floor(b / cols), cb = b % cols;
      var s = ra === rb ? { x1: Math.max(ca, cb), y1: ra, x2: Math.max(ca, cb), y2: ra + 1 }
                        : { x1: ca, y1: Math.max(ra, rb), x2: ca + 1, y2: Math.max(ra, rb) };
      s.w = Math.min(1, Math.abs(zz)); s.a = a; s.b = b; s.plan = e[2];
      segs.push(s);
    });
    [[0, 0, cols, 0], [cols, 0, cols, rows], [0, rows, cols, rows], [0, 0, 0, rows]].forEach(function (q) {
      segs.push({ x1: q[0], y1: q[1], x2: q[2], y2: q[3], w: 1, outer: true });
    });
    for (var i = 0; i < rows * cols; i++) {
      if (i === level.start || i === level.home) continue;   // no lamp post on the start or home square
      var r = Math.floor(i / cols), c = i % cols;
      // the post stands toward one corner of its square, like a lamp at the edge of a small plaza
      var sx = hash(i) < 0.5 ? -1 : 1, sy = hash(i + 99) < 0.5 ? -1 : 1;
      lamps.push({ i: i, x: c + 0.5 + sx * (0.26 + 0.06 * hash(i + 7)), y: r + 0.5 + sy * (0.26 + 0.06 * hash(i + 13)),
                   lit: bits ? bits.charAt(i) === '1' : false });
    }
    var hr = Math.floor(level.home / cols), hc = level.home % cols;
    var sr = Math.floor(level.start / cols), sc = level.start % cols;
    return { rows: rows, cols: cols, segs: segs, lamps: lamps,
             home: { x: hc + 0.5, y: hr + 0.5 }, start: { x: sc + 0.5, y: sr + 0.5 } };
  }

  // do segments p->q and a->b properly cross?
  function cross(px, py, qx, qy, s) {
    function o(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
    var d1 = o(px, py, qx, qy, s.x1, s.y1), d2 = o(px, py, qx, qy, s.x2, s.y2);
    var d3 = o(s.x1, s.y1, s.x2, s.y2, px, py), d4 = o(s.x1, s.y1, s.x2, s.y2, qx, qy);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function visible(W, x, y, L) {
    var lox = Math.min(x, L.x), hix = Math.max(x, L.x), loy = Math.min(y, L.y), hiy = Math.max(y, L.y);
    for (var k = 0; k < W.segs.length; k++) {
      var s = W.segs[k];
      if (Math.max(s.x1, s.x2) < lox || Math.min(s.x1, s.x2) > hix || Math.max(s.y1, s.y2) < loy || Math.min(s.y1, s.y2) > hiy) continue;
      if (cross(x, y, L.x, L.y, s)) return false;
    }
    return true;
  }

  // brightest visible lit lamp: hedges shade the moth
  function light(W, x, y, P) {
    var best = null, bestI = 0, total = 0;
    for (var k = 0; k < W.lamps.length; k++) {
      var L = W.lamps[k];
      if (!L.lit) continue;
      var dx = L.x - x, dy = L.y - y;
      if (Math.abs(dx) > P.range || Math.abs(dy) > P.range) continue;
      var d2 = dx * dx + dy * dy;
      if (d2 > P.range * P.range || !visible(W, x, y, L)) continue;
      var I = 1 / (d2 + 0.05);
      total += I;
      if (I > bestI) { bestI = I; best = L; }
    }
    return { lamp: best, I: bestI, total: total };
  }

  function init(W, P) {
    return { x: W.start.x, y: W.start.y, th: Math.atan2(W.home.y - W.start.y, W.home.x - W.start.x),
             energy: 100, t: 0, glare: 0, orbits: 0, spin: 0, bank: 0, dlr: 0, I: 0,
             state: 'ready', trail: [[W.start.x, W.start.y]], trailT: 0, events: [], dist: 0 };
  }

  // one fixed time step. inp: {turn:-1..1, boost:bool, handsOff:bool}
  function step(W, s, inp, P, dt) {
    if (s.state !== 'fly') return s;
    var lt = light(W, s.x, s.y, P), wd = 0;
    if (lt.lamp) {
      var ang = Math.atan2(lt.lamp.y - s.y, lt.lamp.x - s.x);
      var side = wrap(ang - s.th) > 0 ? 1 : -1;                 // +1: lamp on the moth's right
      var target = ang - side * (Math.PI / 2 - P.inward);       // keep the lamp abeam, slightly ahead
      wd = P.gain * P.pull * (lt.I / (lt.I + P.I0)) * Math.sin(wrap(target - s.th));
    }
    var turn = inp.handsOff ? 0 : clamp(inp.turn || 0, -1, 1);
    var boost = !inp.handsOff && !!inp.boost;
    var w = turn * P.turnMax + wd;
    s.th = wrap(s.th + w * dt);
    s.dlr = wd; s.I = lt.I; s.bank = clamp(w / 6, -1, 1);
    var v = P.speed * (boost ? P.boostMul : 1);
    var nx = s.x + Math.cos(s.th) * v * dt, ny = s.y + Math.sin(s.th) * v * dt;
    // hedges: push out and reflect the heading
    var R = P.radius;
    for (var k = 0; k < W.segs.length; k++) {
      var g = W.segs[k], rr = R + 0.03 + 0.05 * g.w;
      var ex = g.x2 - g.x1, ey = g.y2 - g.y1, len2 = ex * ex + ey * ey;
      var u = clamp(((nx - g.x1) * ex + (ny - g.y1) * ey) / len2, 0, 1);
      var cx = g.x1 + u * ex, cy = g.y1 + u * ey, dx = nx - cx, dy = ny - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < rr) {
        if (d < 1e-9) { dx = -Math.cos(s.th); dy = -Math.sin(s.th); d = 1; }
        var nxn = dx / d, nyn = dy / d;
        nx = cx + nxn * rr; ny = cy + nyn * rr;
        var vx = Math.cos(s.th), vy = Math.sin(s.th), dot = vx * nxn + vy * nyn;
        if (dot < 0) { vx -= 2 * dot * nxn; vy -= 2 * dot * nyn; s.th = Math.atan2(vy, vx); s.events.push('hedge'); }
      }
    }
    // lit bulbs are solid: bumping the hot glass bounces the moth and costs energy (dark posts are scenery)
    for (k = 0; k < W.lamps.length; k++) {
      var L = W.lamps[k];
      if (!L.lit) continue;
      var lx = nx - L.x, ly = ny - L.y, ld = Math.sqrt(lx * lx + ly * ly), lr = R + P.post;
      if (ld < lr && ld > 1e-9) {
        nx = L.x + lx / ld * lr; ny = L.y + ly / ld * lr;
        s.th = Math.atan2(ly, lx); s.energy -= 2; s.events.push('bulb');
      }
    }
    s.dist += Math.hypot(nx - s.x, ny - s.y);
    s.x = nx; s.y = ny; s.t += dt;
    // loop counter: full 360-degree turns of the moth's own heading while it is in a lamp's light
    // (bounces off hedges and posts are not counted; leaving the light resets the count in progress)
    if (lt.I > 1) {
      s.spin += w * dt;
      if (Math.abs(s.spin) >= TAU) { s.orbits++; s.spin -= (s.spin > 0 ? 1 : -1) * TAU; s.events.push('orbit'); }
    } else { s.spin = 0; }
    if (lt.I > P.glowI) s.glare += dt;
    // energy
    s.energy -= dt * (P.drain + (boost ? P.boostDrain : 0) + P.glowDrain * clamp((lt.I - P.glowI) / 6, 0, 1));
    s.trailT += dt;
    if (s.trailT >= 0.05) { s.trailT = 0; if (s.trail.length < 8000) s.trail.push([s.x, s.y]); }
    if (Math.hypot(W.home.x - s.x, W.home.y - s.y) < P.homeR) { s.state = 'home'; s.events.push('home'); }
    else if (s.energy <= 0) { s.energy = 0; s.state = 'spent'; s.events.push('spent'); }
    return s;
  }

  function params(over) { var P = {}, k; for (k in DEFAULTS) P[k] = DEFAULTS[k]; for (k in over || {}) P[k] = over[k]; return P; }

  // shareable state token: L3.s12.p10.  letters, digits and dots only
  function encode(o) { return o.level + '.s' + o.shot + '.p' + Math.round(o.pull * 10); }
  function decode(tok) {
    var m = /^L(\d{1,2})\.s(\d{1,4})\.p(\d{1,2})$/.exec(tok || '');
    if (!m || +m[1] < 1) return null;
    return { level: 'L' + (+m[1]), shot: +m[2], pull: clamp(+m[3] / 10, 0, 2) };
  }

  return { wrap: wrap, build: build, light: light, visible: visible, init: init, step: step,
           params: params, encode: encode, decode: decode, DEFAULTS: DEFAULTS };
})();
if (typeof module !== 'undefined') module.exports = Sim;
