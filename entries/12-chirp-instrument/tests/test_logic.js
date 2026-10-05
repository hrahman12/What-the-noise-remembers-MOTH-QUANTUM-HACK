// Unit tests for the page's pure logic (the first <script> in web/index.html). Run: node tests/test_logic.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];
const api = new Function(src + `;return {EVENTS,REACHES,STRENGTHS,midiName,setFor,availability,nearestAvailable,strengthsWithData,
  lowerBound,sounding,lerpMap,clampLoop,velGain,usage,keyLayout,encodeHash,decodeHash,KEYMAP,tapGrid,tapWindow,missing,missReason,missingSentence,emptyNote,
  rippleList,fracIndex,orbitAngle,freqAt,separation,rippleSpeed,mergeTime,lastOnset,startsIn,SOURCE,kepler,shadowKm};`)();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const E = api.EVENTS, g15 = E.find(e => e.id === 'GW150914'), g17 = E.find(e => e.id === 'GW170817');
ok(E.length === 2 && g15 && g17, 'two events');
// data integrity: every note sorted, valid MIDI, voice 0/1
for (const e of E) for (const s of e.sets) {
  for (let i = 1; i < s.notes.length; i++) ok(s.notes[i][0] >= s.notes[i - 1][0], `${e.id} ${s.key} sorted`);
  ok(s.notes.every(x => x[2] >= 0 && x[2] <= 127 && x[3] >= 1 && x[3] <= 127 && (x[4] === 0 || x[4] === 1) && x[1] >= 0), `${e.id} ${s.key} valid`);
  if (s.job) ok(/^[0-9a-f-]{36}$/.test(s.job), 'job id format');
}
ok(g15.sets[0].notes.length === 42 && g17.sets[0].notes.length === 144, 'unblurred note counts (21x2, 72x2)');
ok(g15.roll.every(r => r.qubits === 20) && g17.roll.every(r => r.qubits === 20), '20-qubit roll per track');

// set lookup & availability reflect only completed jobs
const av = api.availability(g15, 0.5);
ok(av[0] === true, 'unblurred always available');
ok(av[1] === !!g15.sets.find(s => s.reach === 0 && s.strength === 0.5), 'reach 0 matches data');
ok(api.availability(g17, 0.5).slice(1).every(x => x === !!g17.sets.find(s => s.strength === 0.5 && s.reach !== null && x)), 'GW170817 availability consistent');
ok(api.setFor(g15, 0.5, 0) === g15.sets[0], 'ri 0 -> unblurred');
ok(api.nearestAvailable(g17, 0.5, 3) === 0 || api.availability(g17, 0.5)[api.nearestAvailable(g17, 0.5, 3)], 'nearest available is available');
const nr = api.nearestAvailable(g15, 0.5, 3); ok(api.availability(g15, 0.5)[nr], 'GW150914 reach 1 snaps to an available stop');
ok(api.strengthsWithData(g17).length === g17.sets.filter(s => s.job).map(s => s.strength).filter((v, i, a) => a.indexOf(v) === i).length, 'strengths with data');

// missing-setting accounting: 'submitted, engine timeout' vs 'never submitted (cap)' comes from plan[].failed
const m15 = api.missing(g15), m17 = api.missing(g17);
ok(JSON.stringify(m15.done) === '["s0.5/r0","s0.5/r0.5"]', 'GW150914 completed settings');
ok(JSON.stringify(m15.timedOut) === '[{"label":"s1/r0","n":3},{"label":"s1/r1","n":3}]', 'GW150914 timed-out settings, 3 attempts each');
ok(JSON.stringify(m15.never) === '["s0.5/r1","s1/r0.5"]', 'GW150914 never-submitted settings');
ok(m17.done.length === 0 && JSON.stringify(m17.timedOut) === '[{"label":"s0.5/r0.5","n":3}]' && JSON.stringify(m17.never) === '["s0.5/r0","s0.5/r1"]', 'GW170817 accounting');
const nFailed = E.reduce((a, e) => a + e.plan.reduce((b, p) => b + p.failed.length, 0), 0);
ok(nFailed === 9, '9 failed attempts in total (ledger: 2 completed + 9 failed = 11)');
ok(/never submitted/.test(api.missReason(g15, 0.5, 1)) && !/timeout/.test(api.missReason(g15, 0.5, 1)), 'GW150914 s0.5 r1 reason: never submitted');
ok(/submitted 3 times/.test(api.missReason(g17, 0.5, 0.5)), 'GW170817 r0.5 reason: timed out');
ok(/never submitted/.test(api.missReason(g17, 0.5, 0)) && api.missReason(g15, 0.5, 0.5) === '', 'other reasons');
ok(api.emptyNote(g15) === '', 'no empty-state note when blurs exist');
const en = api.emptyNote(g17);
ok(/s0\.5\/r0\.5 was submitted 3 times/.test(en) && /s0\.5\/r0 and s0\.5\/r1 were never submitted/.test(en) && !/3 planned/.test(en), 'GW170817 empty-state note is exact');
ok(/never submitted \(credit cap reached\): s0\.5\/r1, s1\/r0\.5/.test(api.missingSentence(g15)), 'drawer sentence separates never-submitted');

// tap windows
const notes = [[1, .5, 60, 100, 0], [1.01, .5, 61, 50, 1], [2, .5, 62, 90, 0], [3, .5, 63, 80, 1]];
const grid = api.tapGrid(g15.sets[0].notes, [true, true]);
ok(grid.length >= 21 && grid.length <= 42, 'tap grid ~ one entry per half-wave per voice');
let w = api.tapWindow(grid, g15.sets[0].notes, 0, [true, true], 0, g15.t_total, 16);
ok(w.t === grid[0] && w.notes.length >= 1, 'first tap = first half-wave');
let pos = 0, steps = 0; const seen = new Set();
while (steps < 100) { w = api.tapWindow(grid, g15.sets[0].notes, pos, [true, true], 0, g15.t_total, 16); if (seen.has(w.k)) break; seen.add(w.k); pos = w.t; steps++; }
ok(steps === grid.length, 'tapping walks every half-wave once, then wraps');
w = api.tapWindow(grid, g15.sets[0].notes, 5, [true, true], 10, 15, 16); ok(w.t >= 10 && w.t < 15, 'tap respects loop start');
w = api.tapWindow(grid, g15.sets[0].notes, 14.99, [true, true], 10, 15, 16); ok(w.t >= 10 && w.t < 15, 'tap wraps inside loop');
for (const s of g15.sets) { const x = api.tapWindow(grid, s.notes, 0, [true, true], 0, g15.t_total, 16); ok(x.notes.length <= 16, `cap 16 (${s.key})`); }

// helpers
ok(api.lowerBound(notes, 2) === 2 && api.lowerBound(notes, 0) === 0 && api.lowerBound(notes, 9) === 4, 'lowerBound');
ok(api.sounding(notes, 1.2, [true, true]).length === 2 && api.sounding(notes, 1.6, [true, true]).length === 0, 'sounding');
const r = api.lerpMap(g15.map, g15.map[5][0]); ok(Math.abs(r[0] - g15.map[5][1]) < 1e-9, 'lerpMap at a knot');
ok(api.lerpMap(g15.map, -5) === null, 'lerpMap outside');
const mid = (g15.map[10][0] + g15.map[11][0]) / 2, rm = api.lerpMap(g15.map, mid);
ok(rm[0] > Math.min(g15.map[10][1], g15.map[11][1]) - 1e-9 && rm[0] < Math.max(g15.map[10][1], g15.map[11][1]) + 1e-9, 'lerpMap between knots');
ok(JSON.stringify(api.clampLoop(5, 2, 10)) === '[2,5]' && api.clampLoop(3, 3.05, 10)[1] === 3.2 && api.clampLoop(-1, 20, 10)[1] === 10, 'clampLoop');
ok(api.midiName(60) === 'C4' && api.midiName(69) === 'A4' && api.midiName(47) === 'B2', 'midiName');
ok(Math.abs(api.velGain(127) - 0.22) < 1e-12 && api.velGain(1) < 0.001, 'velGain');
const u = api.usage(notes); ok(u[60] === 1 && u[61] < 1, 'usage normalised');
const kl = api.keyLayout(45, 80); ok(kl.lo === 36 && kl.hi === 83 && kl.keys.length === 48 && kl.whites === 28, 'keyLayout spans whole octaves');
ok(Object.keys(api.KEYMAP).length === 17 && api.KEYMAP.k === 12, 'DAW keymap');

// share token round trip and allowed characters
const s0 = {ev: 1, ri: 2, si: 0, speed: 1.25, voices: [true, false], loop: true, loopA: 12.3, loopB: 20.1};
const h = api.encodeHash(s0); ok(/^[A-Za-z0-9._~-]+$/.test(h), 'token charset');
const d = api.decodeHash('#' + h); ok(d.ev === 1 && d.ri === 2 && d.speed === 1.25 && d.voices[0] && !d.voices[1] && d.loop && d.loopA === 12.3 && d.loopB === 20.1, 'hash round trip');
const d2 = api.decodeHash(api.encodeHash({...s0, loop: false})); ok(d2 && d2.loop === false, 'hash without loop');
ok(api.decodeHash('#junk') === null && api.decodeHash('') === null, 'bad hash rejected');
ok(api.decodeHash('#e0_r1_s0_v900_m3').speed === 2, 'speed clamped');

// the scene's bookkeeping: ripples come from the real half-waves, and every scene motion that looks like data is data
const r15 = api.rippleList(g15), r17 = api.rippleList(g17);
ok(r15.length === 21 && r17.length === 72, 'one ripple per half-wave (GW150914) / per note (GW170817)');
ok(r15.every(r => Math.abs((r.tH - r.tL) - 0.7324) < 0.002), 'GW150914 ripples reach L1 0.73 s (music) before H1');
ok(r15.every(r => r.vH > 0 && r.vL > 0) && r15[19].vH === 127, 'ripple strain from the unblurred notes (half-wave 19 is the loudest in H1)');
ok(r17.every(r => r.tH === r.tL), 'GW170817 voices are simultaneous');
const sg = [1, 2, 4, 5];
ok(api.fracIndex(sg, 1) === 0 && api.fracIndex(sg, 3) === 1.5 && api.fracIndex(sg, 6) === 4 && api.fracIndex(sg, 0) === -1, 'fracIndex interpolates and extrapolates');
ok(Math.abs(api.orbitAngle(sg, 4) - Math.PI) < 1e-12, 'a quarter orbit per half-wave');
ok(api.separation(30, 30) === 1 && Math.abs(api.separation(240, 30) - 0.25) < 1e-12 && api.separation(60, 30) < 0.64 && api.separation(60, 30) > 0.62, 'Kepler separation f^-2/3');
ok(api.freqAt(r15, r15.map(r => r.tL), 0) === r15[0].f && api.freqAt(r15, r15.map(r => r.tL), 99) === r15[20].f, 'frequency held outside the track');
ok(Math.abs(api.rippleSpeed(90, 150, 0.7324) - 60 / 0.7324) < 1e-9 && api.rippleSpeed(100, 100, 0) === 100, 'ripple speed fits the canon on screen');
ok(Math.abs(api.mergeTime(g15) - 23.76) < 0.01 && api.mergeTime(g15) > r15[19].tH && api.mergeTime(g15) < r15[20].tH, 'GW150914 merger at the measured peak, between half-waves 19 and 20');
ok(Math.abs(api.mergeTime(g17) - (g17.map[71][0] + 0.3)) < 1e-9, 'GW170817 merger at the end of the model track');
const lo = api.lastOnset(g15.sets[0].notes, r15[3].tH + 0.1, 0); ok(lo && Math.abs(lo.age - 0.1) < 0.005 && lo.n[4] === 0, 'lastOnset per voice');
ok(api.startsIn(g15.sets[0].notes, -1, 99, [true, true]) === 42 && api.startsIn(g15.sets[0].notes, -1, 99, [true, false]) === 21, 'startsIn counts by voice');
// the scene's sizes and readouts: shadows in proportion to mass, Newtonian Kepler from the wave frequency
ok(Math.abs(api.shadowKm(36) - 276.2) < 0.5 && Math.abs(api.shadowKm(29) / api.shadowKm(36) - 29 / 36) < 1e-12, 'shadow radius sqrt(27) GM/c^2, 36 : 29 by mass');
const S15 = api.SOURCE.GW150914, k0 = api.kepler(r15[0].f, 65, S15.z), kP = api.kepler(150, 65, S15.z);
ok(Math.abs(k0.km - 923) < 3, 'GW150914 at the first half-wave (30.6 Hz): about 920 km apart (Newtonian)');
ok(Math.abs(kP.km - 320) < 5 && kP.v > 0.5 && kP.v < 0.6, 'at 150 Hz: about 320 km apart at about half the speed of light (cf. PRL 116, 061102)');
ok(Math.abs(api.kepler(60, 65, S15.z).km / k0.km - api.separation(60, r15[0].f)) < 1e-9, 'the drawn separation follows the same f^-2/3 law');
ok(S15.m[0] + S15.m[1] - S15.mf === 3 && S15.fq === 251 && S15.tq === 0.004, 'GW150914: 3 Msun radiated; ringdown 251 Hz, 4 ms');
console.log(`${n} checks passed`);
