// Unit tests for the page's pure chorus logic (the CORE block of web/index.html) against chorus.py.
// Run: node tests/test_core.js   (after python tests/make_ref.py and python build_web.py)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
const coreBlock = html.split('// CORE-BEGIN')[1].split('// CORE-END')[0];
const core = coreBlock.slice(coreBlock.indexOf(String.fromCharCode(10)) + 1);
const pondsSrc = html.split('const PONDS = ')[1].split(/;\r?\nconst EXAMPLES/)[0];
const api = new Function(core + '\nreturn {rates,pitch,couplings,step,order,initialPhases,occFromBits,occToHex,occFromHex,encodeToken,decodeToken,DT};')();
const PONDS = JSON.parse(pondsSrc), by = {}; PONDS.forEach(d => by[d.name] = d);
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
const close = (a, b, tol) => Math.abs(a - b) <= tol;

api.rates(20, 2.0, 0.04).forEach((v, i) => ok(close(v, ref.rates[i], 1e-12), 'rate ' + i));
for (let k = 0; k < 24; k++) ok(close(api.pitch(k), ref.pitch[k], 1e-9), 'pitch ' + k);
for (const r of ref.runs) {
  const ds = by[r.name];
  let th = api.initialPhases(ds), calls = 0;
  const w = api.rates(ds.n, 2.0, 0.04).map(f => 2 * Math.PI * f), E = api.couplings(ds, r.src), occ = api.occFromBits(ds.nights[r.night]);
  for (let s = 0; s < 480; s++) { const o = api.step(th, w, E, occ, r.K); th = o.theta; calls += o.calls.length; }
  const o = api.order(th, occ, E);
  ok(th.every((t, i) => close(t, r.theta[i], 1e-9)), `${r.name}/${r.src} trajectory matches chorus.py`);
  ok(calls === r.calls, `${r.name}/${r.src} call count ${calls} vs ${r.calls}`);
  ok(close(o.R, r.R, 1e-9) && close(o.turns, r.turns, 1e-9), `${r.name}/${r.src} order params`);
}
// couplings: engine = delivered L, asked = requested lock on every edge
const a = by.alt20;
ok(api.couplings(a, 'engine').every((e, i) => e[2] === a.edges[i].L), 'engine couplings are the delivered L');
ok(api.couplings(a, 'asked').every(e => e[2] === a.lock_request && e[2] < 0), 'asked couplings are the (negative) request');
ok(by.sync20.lock_request > 0, 'sync pond asks for a positive lock');
// no coupling, no occupancy -> no calls; uncoupled frogs keep their natural rates
{ const occ = new Array(20).fill(0); const o = api.step(api.initialPhases(a), api.rates(20, 2, 0.04).map(f => 2*Math.PI*f), api.couplings(a,'engine'), occ, 5);
  ok(o.calls.length === 0, 'empty pond is silent'); ok(api.order(o.theta, occ, []).R === 0, 'empty pond R = 0'); }
// sync converges with asked couplings (classical sanity check)
{ const ds = by.sync20, occ = new Array(20).fill(1); let th = api.initialPhases(ds); const w = api.rates(20, 2, 0.04).map(f => 2*Math.PI*f), E = api.couplings(ds, 'asked');
  for (let s = 0; s < 240*20; s++) th = api.step(th, w, E, occ, 3).theta; ok(api.order(th, occ, E).R > 0.95, 'asked sync pond reaches R > 0.95'); }
// occupancy hex + token round trip
for (const bits of a.nights.slice(0, 50)) { const occ = api.occFromBits(bits); ok(api.occFromHex(api.occToHex(occ), occ.length).join('') === occ.join(''), 'hex round trip'); }
{ const s = {ds:'alt20', src:'asked', K:7.3, f0:2.4, spread:0.09, night:17, occ:api.occFromBits(a.nights[17])};
  const tok = api.encodeToken(s); ok(/^[A-Za-z0-9._~-]+$/.test(tok), 'token uses allowed characters: ' + tok);
  const d = api.decodeToken('#' + tok, PONDS.map(p => p.name));
  ok(d && d.ds === 'alt20' && d.src === 'asked' && close(d.K, 7.3, 1e-9) && close(d.f0, 2.4, 1e-9) && close(d.spread, 0.09, 1e-9) && d.night === 17, 'token round trip');
  ok(api.decodeToken('#v1.bogus.engine.k1.t20.s4.n0.off', ['alt20']) === null, 'unknown pond rejected');
  ok(api.decodeToken('#v1.alt20.engine.k999.t20.s4.n0.off', ['alt20']).K === 16, 'K clamped to 16');
  ok(api.decodeToken('#garbage', ['alt20']) === null, 'garbage rejected'); }
// a shared ibm_fez night: the optional h<index> part round-trips, and Aer-night tokens carry none
{ const s = {ds:'alt20', src:'engine', K:3, f0:2, spread:0.04, night:5, occ:api.occFromBits(a.nights[5]), hw:7};
  const tok = api.encodeToken(s); ok(/\.h7$/.test(tok) && /^[A-Za-z0-9._~-]+$/.test(tok), 'ibm_fez night index is written into the token: ' + tok);
  const d = api.decodeToken('#' + tok, PONDS.map(p => p.name)); ok(d && d.hw === 7 && d.ds === 'alt20', 'ibm_fez night round trip');
  ok(api.decodeToken('#' + api.encodeToken({...s, hw:-1}), PONDS.map(p => p.name)).hw === null, 'Aer-night tokens carry no ibm_fez index'); }
// the inlined hardware data (out/hardware.json) is self-consistent: every count re-derives from the returned shots
{ const HW = JSON.parse(html.split('const HW = ')[1].split(/;\s*\/\/ the real-hardware/)[0]);
  const f = HW.runs.fez, E = HW.edges;
  ok(f.backend === 'ibm_fez' && f.mode === 'qpu' && f.n === 20 && f.nights.length === f.shots && f.shots === 20, 'hardware run is 20 qubits, 20 shots, on ibm_fez');
  ok(f.nights.every((b, i) => E.filter(([p, q]) => b[p] !== b[q]).length === f.turns[i]), 'every night\'s taking-turns count re-derives from its bitstring');
  ok(E.every(([p, q], e) => Math.abs(f.nights.filter(b => b[p] !== b[q]).length / f.shots - f.edge_turns[e]) < 1e-9), 'every edge fraction re-derives from the shots');
  ok(Math.abs(f.turns.reduce((x, y) => x + y, 0) / f.shots - f.turns_mean) < 1e-4, 'mean taking-turns count');
  ok(HW.runs.emu && HW.runs.emu.backend === 'aer' && HW.runs.emu.mode === 'emu', 'the baseline is labelled as the Aer emulator');
  ok(HW.max_turns === 22 && HW.random_turns === 13.5, 'best possible 22 of 27, coin flips 13.5'); }
console.log(`${n - fails}/${n} checks passed`);
process.exit(fails ? 1 : 0);
