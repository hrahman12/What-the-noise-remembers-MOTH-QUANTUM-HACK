/* Jam the Bat: the game rule. CLASSICAL game logic, a cartoon of sonar jamming, not a sonar model.
   Pure logic: no DOM, no wall clock, no Math.random. The page inlines this file verbatim (build_web.py),
   and node runs the same file for tests (test_core.js) and the README tournament numbers (sim.js).

   Rule in one paragraph: holding "click" fires a train of clicks whose gaps are base + slot*step ms,
   where slot (0..7, 3 bits) comes from the chosen jitter source. The bat hears every gap, turns it into
   a symbol (8 in-train slots + 4 pause lengths) and predicts the next symbol with an order-3 n-gram.
   A click the bat predicted is tuned out; a click it mispredicted jams its echoes for jamHold ms.
   Clean echoes tell the bat where you are and tighten its lock; jammed echoes leave it chasing a
   stale guess. In the terminal buzz it strikes at its guess (caught if you are there) or aborts when
   its lock collapses. Survive three passes. */
(function (root) {
  'use strict';
  const W = 960, H = 540;
  const R = {
    base: 70, step: 12, slots: 8,           // in-train gap = base + slot*step ms (70..154 ms)
    pause: [166, 300, 600, 1200],           // gaps >= 166 ms are pauses: symbols 8..11
    nsym: 12, order: 3, alpha: 0.5, minCtx: 4,
    jamHold: 160,                           // ms a mispredicted click masks the bat's echoes
    clickCost: 3, regen: 9, regenDelay: 250, energyMax: 100, restartEnergy: 15,
    mothSpeed: 130, mothAccel: 1100,
    speed: { search: 165, approach: 205, buzz: 235 },
    turn: { search: 2.4, approach: 3.6, buzz: 4.6 },
    ival: { search: 260, approachFar: 200, approachNear: 80, buzz: 35 },
    dSearch: 280, dBuzz: 110,
    strike: 16, capture: 24,
    lockGain: { search: 0.05, approach: 0.12, buzz: 0.16 }, lockLoss: 0.2, abortLock: 0.2,
    passes: 3, passTimeout: 14000, breakoff: 1100, estNoise: 5, dt: 2,
  };

  // ---------- randomness sources ----------
  function mulberry32(seed) {               // classical PRNG (public algorithm)
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  // 3-bit slots from engine bytes, MSB first: a classical bit-slicing step, no reshaping.
  function slotsFromBytes(bytes) {
    const out = new Uint8Array(Math.floor(bytes.length * 8 / 3));
    let acc = 0, nb = 0, k = 0;
    for (let i = 0; i < bytes.length && k < out.length; i++) {
      acc = ((acc << 8) | bytes[i]) & 0xffff; nb += 8;
      while (nb >= 3 && k < out.length) { nb -= 3; out[k++] = (acc >> nb) & 7; }
    }
    return out;
  }
  function makeSource(kind, opt) {
    // kind: 'none' (metronome), 'prng' (seeded, seed shown), 'bank' (engine output slots)
    if (kind === 'none') return { kind, next: () => 0, used: 0 };
    if (kind === 'prng') {                  // top 3 bits of each mulberry32 output
      const g = mulberry32(opt.seed), s = { kind, seed: opt.seed >>> 0, used: 0 }; let buf = null;
      s.peek = () => { if (buf === null) buf = g() >>> 29; return buf; };
      s.next = () => { const v = s.peek(); buf = null; s.used++; return v; };
      return s;
    }
    const slots = opt.slots, s = { kind, id: opt.id, used: 0, cursor: opt.cursor || 0, wrapped: false };
    s.next = () => { if (s.cursor >= slots.length) { s.cursor = 0; s.wrapped = true; } s.used++; return slots[s.cursor++]; };
    return s;
  }

  // ---------- the bat's ear: order-3 n-gram with back-off ----------
  function symOf(gap) {
    if (!(gap < R.pause[0])) { let s = 8; for (let i = 1; i < R.pause.length; i++) if (gap >= R.pause[i]) s = 8 + i; return s; }
    return Math.max(0, Math.min(R.slots - 1, Math.round((gap - R.base) / R.step)));
  }
  function NGram() { this.t = new Map(); this.hist = []; }
  NGram.prototype.dist = function () {
    for (let n = Math.min(R.order, this.hist.length); n >= 0; n--) {
      const c = this.t.get(n + ':' + this.hist.slice(this.hist.length - n).join(','));
      if (n > 0 && (!c || c.total < R.minCtx)) continue;
      const p = new Array(R.nsym).fill(R.alpha); let tot = R.alpha * R.nsym;
      if (c) { for (let s = 0; s < R.nsym; s++) p[s] += c.n[s]; tot += c.total; }
      return { p: p.map(x => x / tot), order: n };
    }
  };
  NGram.prototype.observe = function (sym) {
    for (let n = 0; n <= Math.min(R.order, this.hist.length); n++) {
      const key = n + ':' + this.hist.slice(this.hist.length - n).join(',');
      let c = this.t.get(key);
      if (!c) { c = { n: new Array(R.nsym).fill(0), total: 0 }; this.t.set(key, c); }
      c.n[sym]++; c.total++;
    }
    this.hist.push(sym); if (this.hist.length > R.order) this.hist.shift();
  };
  function argmax(p) { let b = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[b]) b = i; return b; }

  // The bat's prediction for the next click. With the PRNG seed leaked, it replays your stream (it has
  // the seed and counts your clicks), so it knows the next jitter slot exactly and only has to guess
  // whether you keep holding. `up` is the next click if one is already scheduled.
  function predict(g, up) {
    const d = g.ngram.dist(); let p = d.p, mode = 'n-gram, order ' + d.order;
    const src = up ? up.src : g.source;
    if (src.kind === 'prng' && g.seedKnown) {
      const j = up ? up.slot : src.peek();
      let pin = 0; for (let s = 0; s < R.slots; s++) pin += p[s];
      p = p.map((x, s) => (s < R.slots ? (s === j ? pin : 0) : x)); mode = 'leaked seed';
    }
    const s = argmax(p);
    return { sym: s, conf: p[s], mode };
  }

  // ---------- one round ----------
  function newGame(opt) {
    // opt: {source, seedKnown, noiseSeed}; noiseSeed drives the bat's spawn and sensing noise (classical, shared by all sources)
    const noise = mulberry32(opt.noiseSeed >>> 0), u = () => noise() / 4294967296;
    const g = {
      t: 0, source: opt.source, seedKnown: !!opt.seedKnown, rng: u,
      moth: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, energy: R.energyMax,
      holding: false, pending: null, lastClickAt: -1e9, lastClickEnd: -1e9,
      clicks: [], jams: [], pulses: [], ngram: new NGram(), next: null,
      bat: null, pass: 0, survived: 0, over: false, result: null, log: [],
    };
    g.next = predict(g, null);
    spawnBat(g);
    return g;
  }
  function spawnBat(g) {
    const side = Math.floor(g.rng() * 4), f = 0.15 + 0.7 * g.rng();
    const p = [[f * W, -110], [W + 110, f * H], [f * W, H + 110], [-110, f * H]][side];   // off-screen, so you hear it first
    const est = { x: g.moth.x + (g.rng() - 0.5) * 300, y: g.moth.y + (g.rng() - 0.5) * 200, vx: 0, vy: 0 };
    g.bat = { x: p[0], y: p[1], h: Math.atan2(H / 2 - p[1], W / 2 - p[0]), phase: 'search', lock: 0, est,
      nextPulse: g.t + 300, passStart: g.t, breakUntil: 0, seen: false };
    g.pass++;
  }
  function phaseOf(d) { return d > R.dSearch ? 'search' : d > R.dBuzz ? 'approach' : 'buzz'; }
  function ivalOf(phase, d) {
    if (phase === 'search') return R.ival.search;
    if (phase === 'buzz') return R.ival.buzz;
    const f = (d - R.dBuzz) / (R.dSearch - R.dBuzz);
    return R.ival.approachNear + f * (R.ival.approachFar - R.ival.approachNear);
  }

  function schedule(g, first) {             // pre-pay so every drawn slot becomes a heard click
    if (g.energy < R.clickCost) { g.pending = null; return; }
    const src = g.source, j = src.next(); g.energy -= R.clickCost;
    const at = first ? g.t + j * R.step : g.lastClickAt + R.base + j * R.step;
    g.pending = { at: Math.max(at, g.t), slot: j, first, src };
    g.next = predict(g, g.pending);
  }
  function setSource(g, src) { g.source = src; g.next = predict(g, g.pending); }
  function setHold(g, on) {                 // releasing never cancels a click already scheduled (it is paid for)
    if (g.over) return;
    if (on && !g.holding && !g.pending && g.energy >= R.clickCost) schedule(g, true);
    g.holding = on;
  }

  function fireClick(g) {
    const c = g.pending; g.pending = null;
    const gap = g.clicks.length ? c.at - g.lastClickAt : Infinity;
    const sym = symOf(gap), pred = predict(g, c), hit = pred.sym === sym;
    g.clicks.push({ t: c.at, slot: c.slot, sym, pred: pred.sym, conf: pred.conf, hit, mode: pred.mode, src: c.src.id || c.src.kind });
    if (!hit) g.jams.push(c.at);
    g.ngram.observe(sym);
    g.lastClickAt = c.at; g.lastClickEnd = c.at;
    g.log.push({ type: 'click', t: c.at, hit, x: g.moth.x, y: g.moth.y });
    if (g.holding) schedule(g, false);
    if (!g.pending) g.next = predict(g, null);
  }

  function jammedAt(g, t) {
    for (let i = g.jams.length - 1; i >= 0; i--) { const dt = t - g.jams[i]; if (dt >= 0 && dt <= R.jamHold) return true; if (dt > R.jamHold) break; }
    return false;
  }

  function endPass(g, why) {
    g.log.push({ type: 'pass', t: g.t, why });
    if (why === 'caught') { g.over = true; g.result = 'caught'; return; }
    g.survived++;
    if (g.survived >= R.passes) { g.over = true; g.result = 'escaped'; return; }
    g.bat.breakUntil = g.t + R.breakoff; g.bat.phase = 'breakoff';
  }

  function pulse(g) {
    const b = g.bat, m = g.moth;
    const dEst = Math.hypot(b.est.x - b.x, b.est.y - b.y);
    b.phase = phaseOf(dEst);
    const jam = jammedAt(g, g.t);
    g.pulses.push({ t: g.t, x: b.x, y: b.y, jam, phase: b.phase });
    if (g.pulses.length > 80) g.pulses.shift();
    if (jam) {
      b.lock = Math.max(0, b.lock - R.lockLoss);
    } else {
      const n = R.estNoise * (1 - b.lock * 0.6);
      b.est = { x: m.x + (g.rng() - 0.5) * 2 * n, y: m.y + (g.rng() - 0.5) * 2 * n, vx: m.vx, vy: m.vy };
      b.lock = Math.min(1, b.lock + R.lockGain[b.phase]); b.seen = true;
    }
    b.nextPulse = g.t + ivalOf(b.phase, dEst);
    if (b.phase === 'buzz' && b.lock < R.abortLock && b.seen) endPass(g, 'jammed');
  }

  function stepBat(g, dt) {
    const b = g.bat, s = dt / 1000;
    if (b.phase === 'breakoff') {
      b.x += Math.cos(b.h) * R.speed.search * s; b.y += Math.sin(b.h) * R.speed.search * s;
      if (g.t >= b.breakUntil) spawnBat(g);
      return;
    }
    b.est.x += b.est.vx * s; b.est.y += b.est.vy * s;     // dead reckoning between clean echoes
    b.est.x = Math.max(-60, Math.min(W + 60, b.est.x)); b.est.y = Math.max(-60, Math.min(H + 60, b.est.y));
    const tx = b.est.x - b.x, ty = b.est.y - b.y, d = Math.hypot(tx, ty);
    const ph = b.phase in R.speed ? b.phase : 'search';
    let dh = Math.atan2(ty, tx) - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    const mx = R.turn[ph] * s; b.h += Math.max(-mx, Math.min(mx, dh));
    b.x += Math.cos(b.h) * R.speed[ph] * s; b.y += Math.sin(b.h) * R.speed[ph] * s;
    if (g.t >= b.nextPulse) pulse(g);
    if (g.over || b.phase === 'breakoff') return;
    if (b.phase === 'buzz' && d < R.strike) {
      const dm = Math.hypot(g.moth.x - b.x, g.moth.y - b.y);
      endPass(g, dm < R.capture ? 'caught' : 'missed');
    } else if (g.t - b.passStart > R.passTimeout) endPass(g, 'gave up');
  }

  function stepMoth(g, dt, target) {
    const m = g.moth, s = dt / 1000;
    let vx = 0, vy = 0;
    if (target) {
      const dx = target.x - m.x, dy = target.y - m.y, d = Math.hypot(dx, dy);
      const sp = Math.min(R.mothSpeed, d * 6);
      if (d > 0.5) { vx = dx / d * sp; vy = dy / d * sp; }
    }
    const ax = vx - m.vx, ay = vy - m.vy, a = Math.hypot(ax, ay), amax = R.mothAccel * s;
    const k = a > amax ? amax / a : 1;
    m.vx += ax * k; m.vy += ay * k;
    m.x = Math.max(16, Math.min(W - 16, m.x + m.vx * s)); m.y = Math.max(16, Math.min(H - 16, m.y + m.vy * s));
  }

  // advance the world by ms (fixed 2 ms sub-steps, events fire at their exact times)
  function advance(g, ms, input) {
    const end = g.t + ms;
    while (!g.over && g.t < end) {
      const dt = Math.min(R.dt, end - g.t);
      if (g.pending && g.pending.at <= g.t + dt) { g.t = g.pending.at; fireClick(g); continue; }
      g.t += dt;
      if (input && input.hold !== undefined && input.hold !== g.holding) setHold(g, input.hold);
      if (g.holding && !g.pending && g.energy >= R.restartEnergy) schedule(g, true);
      if (g.t - g.lastClickEnd > R.regenDelay) g.energy = Math.min(R.energyMax, g.energy + R.regen * dt / 1000);
      stepMoth(g, dt, input && input.target);
      stepBat(g, dt);
    }
    return g;
  }

  // ---------- the tournament autopilot (same for every source) ----------
  function autopilot(g) {
    const b = g.bat, m = g.moth, dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy) || 1;
    const hold = b.phase !== 'breakoff' && d < 330;
    let side = ((g.pass + Math.floor(g.t / 4000)) % 2) ? 1 : -1;
    if (d < 90) side = -side;                                  // late dive across the bat's path
    let tx = m.x + (-dy / d * side + dx / d * 0.35) * 120, ty = m.y + (dx / d * side + dy / d * 0.35) * 120;
    if (tx < 60 || tx > W - 60 || ty < 60 || ty > H - 60) { tx = W / 2; ty = H / 2; }
    return { hold, target: { x: tx, y: ty } };
  }
  function simRound(source, opt) {
    const g = newGame({ source, seedKnown: opt.seedKnown, noiseSeed: opt.noiseSeed });
    let guard = 0;
    while (!g.over && guard++ < 20000) advance(g, 10, autopilot(g));
    const n = g.clicks.length, hits = g.clicks.filter(c => c.hit).length;
    return { result: g.result || 'timeout', clicks: n, hits, passes: g.survived, t: g.t };
  }
  function wilson(k, n) {
    if (!n) return [0, 0];
    const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), w = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - w) / d, (c + w) / d];
  }

  // chi-square test that k sources share one survival rate (homogeneity), and its upper-tail p-value
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let ser = 1.000000000190015;
    for (const k of c) ser += k / ++y;
    return -t + Math.log(2.5066282746310005 * ser / x);
  }
  function chi2sf(x, k) {
    const a = k / 2, z = x / 2; if (!(z > 0)) return 1;
    const lead = Math.exp(-z + a * Math.log(z) - lgamma(a));
    if (z < a + 1) { let term = 1 / a, sum = term; for (let n = 1; n < 500; n++) { term *= z / (a + n); sum += term; if (term < sum * 1e-14) break; } return Math.max(0, 1 - sum * lead); }
    let b = z + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (let i = 1; i < 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
    return lead * h;
  }
  function homogeneity(rows) {           // rows: [{surv, n}]
    const S = rows.reduce((a, r) => a + r.surv, 0), N = rows.reduce((a, r) => a + r.n, 0), p = S / N;
    let x = 0;
    for (const r of rows) { const es = r.n * p, ef = r.n * (1 - p); if (es > 0) x += (r.surv - es) ** 2 / es; if (ef > 0) x += (r.n - r.surv - ef) ** 2 / ef; }
    return { chi2: x, df: rows.length - 1, p: chi2sf(x, rows.length - 1) };
  }

  const api = { chi2sf, homogeneity, W, H, R, mulberry32, slotsFromBytes, makeSource, symOf, NGram, predict, newGame, setHold, setSource, advance, autopilot, simRound, wilson, jammedAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.JTB = api;
})(typeof window !== 'undefined' ? window : globalThis);
