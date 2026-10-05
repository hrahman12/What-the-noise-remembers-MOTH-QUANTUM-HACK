// Unit tests for web/sim.js (the page's pure logic) + a playability check on the real levels.
// node test_sim.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Sim = require('./web/sim.js');
const LEVELS = JSON.parse(fs.readFileSync(path.join(__dirname, 'web', 'levels.json'), 'utf8'));
let pass = 0;
const ok = (c, m) => { assert.ok(c, m); pass++; };

// wrap
ok(Math.abs(Sim.wrap(3 * Math.PI) - Math.PI) < 1e-9 || Math.abs(Sim.wrap(3 * Math.PI) + Math.PI) < 1e-9, 'wrap 3pi');
ok(Math.abs(Sim.wrap(-0.5) + 0.5) < 1e-12, 'wrap small');
// share token round trip; only [A-Za-z0-9._~-]
for (const o of [{level: 'L1', shot: 0, pull: 1}, {level: 'L3', shot: 39, pull: 0}, {level: 'L2', shot: 7, pull: 2}]) {
  const t = Sim.encode(o); ok(/^[A-Za-z0-9._~-]+$/.test(t), 'token chars ' + t);
  const d = Sim.decode(t); ok(d.level === o.level && d.shot === o.shot && Math.abs(d.pull - o.pull) < 1e-9, 'roundtrip ' + t);
}
ok(Sim.decode('garbage') === null && Sim.decode('L0.s1.p10') === null && Sim.decode('') === null, 'bad tokens rejected');
ok(Sim.decode('L1.s3.p99').pull === 2, 'pull clamped');

// toy level: 2x2, one hedge between 0 and 1 (zz<0), lamp lit in room 1
const toy = {rows: 2, cols: 2, edges: [[0, 1, -1, -0.4], [0, 2, 1, 0.5], [1, 3, 1, 0.5], [2, 3, 1, 0.3]], start: 0, home: 3};
const W = Sim.build(toy, '0100');
ok(W.segs.length === 1 + 4, 'one hedge + 4 outer walls');
ok(W.lamps.length === 2 && W.lamps.every(l => l.i !== 0 && l.i !== 3), 'no posts on start/home');
ok(W.lamps.find(l => l.i === 1).lit && !W.lamps.find(l => l.i === 2).lit, 'bit 1 = lit');
const lamp1 = W.lamps.find(l => l.i === 1);
ok(!Sim.visible(W, 0.5, 0.5, lamp1), 'hedge blocks the view of the lamp');
ok(Sim.visible(W, lamp1.x, 1.6, lamp1), 'open side sees the lamp');
ok(Sim.light(W, 0.5, 0.5, Sim.params()).lamp === null, 'shaded square gets no light');
ok(Sim.build(toy, '0000').lamps.every(l => !l.lit), 'all-zero shot lights nothing');

// open field with one lamp: hands off -> trapped; pull 0 -> no orbit; fighting -> escape
function field(n) { const e = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c;
  if (c + 1 < n) e.push([i, i + 1, 1, .5]); if (r + 1 < n) e.push([i, i + n, 1, .5]); } return {rows: n, cols: n, edges: e, start: 0, home: n * n - 1}; }
const F = field(7), bits = '0'.repeat(24) + '1' + '0'.repeat(24);
function orbitRun(pull, fight) {
  const Wf = Sim.build(F, bits); Wf.lamps = Wf.lamps.filter(l => l.lit); const L = Wf.lamps[0];
  const P = Sim.params({pull}); const s = Sim.init(Wf, P); s.state = 'fly'; s.x = L.x - 2.2; s.y = L.y - .6; s.th = 0;
  for (let i = 0; i < 60 * 12 && s.state === 'fly'; i++) {
    let turn = 0; if (fight) { const a = Math.atan2(L.y - s.y, L.x - s.x); turn = Sim.wrap(a - s.th) > 0 ? -1 : 1; }
    Sim.step(Wf, s, {turn}, P, 1 / 60); }
  return {s, d: Math.hypot(L.x - s.x, L.y - s.y)};
}
ok(orbitRun(1, false).s.orbits >= 2, 'hands off: the reflex traps the moth');
ok(orbitRun(0, false).s.orbits === 0, 'pull 0: no orbit');
ok(orbitRun(1, true).d > 1.5, 'steering away escapes at pull 1');
// state machine
const s0 = Sim.init(W, Sim.params()); ok(s0.state === 'ready', 'starts ready');
Sim.step(W, s0, {turn: 1}, Sim.params(), 0.1); ok(s0.t === 0, 'no motion before take-off');

// playability: an autopilot following the BFS route, fighting lamps by flapping
function route(L) {
  const adj = {}; L.edges.forEach(([a, b, , zz]) => { if (zz >= 0) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } });
  const prev = {[L.start]: -1}, q = [L.start];
  while (q.length) { const u = q.shift(); for (const v of adj[u] || []) if (!(v in prev)) { prev[v] = u; q.push(v); } }
  const p = []; for (let u = L.home; u !== -1; u = prev[u]) p.unshift(u); return p;
}
// a careful-player stand-in: follows the route through each square, on the side away from its lit lamp
function autopilot(L, shot, pull) {
  const Wl = Sim.build(L, L.shotList[shot][0]), P = Sim.params({pull, drain: L.drain}), s = Sim.init(Wl, P), r = route(L);
  const wp = r.map(c => { let x = c % L.cols + .5, y = Math.floor(c / L.cols) + .5; const lp = Wl.lamps.find(l => l.i === c && l.lit);
    if (lp) { const dx = x - lp.x, dy = y - lp.y, d = Math.hypot(dx, dy) || 1; x += .22 * dx / d; y += .22 * dy / d; } return [x, y]; });
  s.state = 'fly'; let k = 1;
  for (let i = 0; i < 120 * 400 && s.state === 'fly'; i++) {
    const [tx, ty] = wp[Math.min(k, wp.length - 1)];
    if (Math.hypot(tx - s.x, ty - s.y) < .3 && k < r.length - 1) k++;
    const turn = Math.max(-1, Math.min(1, Sim.wrap(Math.atan2(ty - s.y, tx - s.x) - s.th) * 3));
    Sim.step(Wl, s, {turn, boost: Math.abs(s.dlr) > 1.2}, P, 1 / 120);
  }
  return s;
}
for (const L of LEVELS) {
  ok(route(L)[0] === L.start && route(L).slice(-1)[0] === L.home, `${L.id}: home reachable through measured streets`);
  const res = []; for (let sh = 0; sh < Math.min(10, L.shotList.length); sh++) res.push(autopilot(L, sh, 1));
  const won = res.filter(s => s.state === 'home');
  console.log(`${L.id} ${L.name}: autopilot reached home on ${won.length}/${res.length} shots at pull 1` +
    (won.length ? `, median ${won.map(s => s.t).sort((a, b) => a - b)[Math.floor(won.length / 2)].toFixed(1)} s, energy left ${won.map(s => s.energy.toFixed(0)).join(',')}` : '') +
    `; orbits ${res.map(s => s.orbits).join(',')}`);
  ok(won.length >= 1, `${L.id}: at least one shot is winnable by a simple autopilot at pull 1`);
  const easy = []; for (let sh = 0; sh < Math.min(10, L.shotList.length); sh++) easy.push(autopilot(L, sh, 0.5).state === 'home');
  console.log(`   pull 0.5: ${easy.filter(Boolean).length}/${easy.length}`);
  ok(easy.filter(Boolean).length >= easy.length * 0.8, `${L.id}: pull 0.5 is easy (>= 80% autopilot wins)`);
}
console.log(`${pass} checks passed`);
