// Unit tests for the page's pure logic (no DOM). Run: node tests/test_page.js   (after python build_web.py)
// They check the game against the cached data: the target peak, the score caps from the real measured widths,
// the claims written on the achievements, the control-room clock, and the chirp model behind the source view.
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'index.html'), 'utf8');
const blocks = html.split('<script>').slice(1).map(s => s.split('</script>')[0]);
const api = new Function(blocks[0] + blocks[1] + `
return {META, GRIDS, decodeGrid, timeOf, freqOf, cellOfTime, cellOfFreq, profileT, profileF, median, momentWidth, cutWidths,
  audioTime, lut, divLut, formatToken, parseToken, RATIO_KEYS, fitChirp, chirpTop, chirpF, phaseTable, phaseAt, timeAtPhase,
  separation, ridgePower, loudness, TAU, DIAL, DIAL_ANG, gridKey, versionOf, peakOf, TOL_WIDTHS, sharpKept, smearOf, axisScore,
  maxScores, scoreRound, ACH, recordRound, freshState, dayClock, clockCDT, clockUTC, gpsText, nearestDetent};`)();
const SPR = new Function(blocks[2] + '\nreturn SPRITES;')();
const vec = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors.json'), 'utf8'));
const M = api.META;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);

// ---- the grids decode to the values sent to Atlas (x10 fixed point)
const g = api.decodeGrid(api.GRIDS.original), g4 = api.decodeGrid(api.GRIDS.r4);
ok(g.length === M.nt * M.nf, 'grid length');
for (const [i, j, v] of vec.cells) ok(g[i * M.nf + j] / M.scale === v, `cell ${i},${j}`);
ok(api.RATIO_KEYS.every(k => api.GRIDS[k]), 'all five ratios present');
for (let i = 0; i < M.nt; i += 17) ok(api.cellOfTime(api.timeOf(i, M), M) === i, 'time round trip ' + i);
for (let j = 0; j < M.nf; j += 17) ok(api.cellOfFreq(api.freqOf(j, M), M) === j, 'freq round trip ' + j);

// ---- the width rule matches Python's chirp._moment_width (the data room's cut readouts)
for (const c of vec.time_cuts) {
  near(api.momentWidth(api.profileT(g, c.j, M), c.c, M.half_t)[0], c.orig, 1e-9, 'time cut orig ' + c.j);
  near(api.momentWidth(api.profileT(g4, c.j, M), c.c, M.half_t)[0], c.r4, 1e-6, 'time cut r4 ' + c.j);
}
for (const c of vec.freq_cuts) {
  near(api.momentWidth(api.profileF(g, c.i, M), c.c, M.half_f)[0], c.orig, 1e-9, 'freq cut orig ' + c.i);
  near(api.momentWidth(api.profileF(g4, c.i, M), c.c, M.half_f)[0], c.r4, 1e-6, 'freq cut r4 ' + c.i);
}
ok(api.median([3, 1, 2]) === 2 && api.median([4, 1, 2, 3]) === 2.5, 'median');
ok(api.cutWidths(new Float64Array(10), new Float64Array(10), 3, 1) === null, 'a cut that misses the ridge');

// ---- the measured widths shipped in META follow the trade
const V = k => M.versions.find(v => v.key === k), O = V('original');
const vs = api.RATIO_KEYS.map(V);
for (let k = 1; k < vs.length; k++) { ok(vs[k].tw > vs[k - 1].tw, 'time-width rises with r'); ok(vs[k].fw < vs[k - 1].fw, 'freq-width falls with r'); }
ok(vs.every(v => /^[0-9a-f-]{36}$/.test(v.job_id)), 'every ratio has a job id');
ok(/^[0-9a-f-]{36}$/.test(M.iso.job_id) && M.iso.maxdiff === 0, 'the isotropic control equals r = 1 exactly');

// ---- the game's target: the chirp peak, measured in the original grid with the same rule as build_web.peak_of
const pk = api.peakOf(g, M, M.peak_win);
near(pk.t, M.peak.t, 2e-5, 'peak time matches the build (page axis is linear, the build uses axes.json)'); near(pk.f, M.peak.f, 0.05, 'peak frequency matches the build');
ok(pk.t > -0.02 && pk.t < 0.005, 'the peak is within a few ms of merger: ' + pk.t);
ok(pk.f > 60 && pk.f < 160, 'the peak frequency is in the loud part of the chirp: ' + pk.f);
ok(M.peak.t >= M.audio.t0 && M.peak.t <= M.audio.t1, 'the peak is inside the audio');

// ---- dial: six detents, the ISO position plays r = 1's grid and carries the control job's own widths
ok(api.DIAL.length === 6 && api.DIAL[5] === 'iso' && api.gridKey('iso') === 'r1', 'dial positions');
{ const iso = api.versionOf('iso', M); ok(iso.job_id === M.iso.job_id && iso.tw === M.iso.tw && iso.fw === M.iso.fw && iso.scalar, 'ISO version'); }
api.DIAL_ANG.forEach((a, i) => ok(api.nearestDetent(a) === i && api.nearestDetent(a + 12) === i, 'detent ' + i));

// ---- scoring is built only from the real widths
const caps = {}; api.DIAL.forEach(k => caps[k] = api.maxScores(api.versionOf(k, M), O));
for (const k of api.DIAL) {
  const v = api.versionOf(k, M), c = caps[k];
  ok(c.timing === Math.round(1000 * (O.tw / v.tw) ** 2) && c.pitch === Math.round(1000 * (O.fw / v.fw) ** 2), 'cap formula ' + k);
  ok(api.axisScore(0, v.tw, O.tw) === c.timing && api.axisScore(0, v.fw, O.fw) === c.pitch, 'a perfect aim scores the cap ' + k);
  ok(api.axisScore(2 * v.tw, v.tw, O.tw) === Math.round(1000 * (O.tw / v.tw) ** 2 * Math.exp(-0.5)), 'one tolerance off costs e^-1/2 ' + k);
  ok(api.axisScore(null, v.tw, O.tw) === 0, 'no press scores 0');
  const r = api.scoreRound(k, v, O, 0.9 * api.TOL_WIDTHS * v.tw, 0);
  ok(r.caught && r.tolT === api.TOL_WIDTHS * v.tw && r.tolF === api.TOL_WIDTHS * v.fw, 'inside the window is a catch ' + k);
  ok(!api.scoreRound(k, v, O, 1.1 * api.TOL_WIDTHS * v.tw, 0).caught, 'outside the window is not ' + k);
}
// the trade by feel: the time-sharpest setting has the best timing cap, the pitch-sharpest the best pitch cap
const ratios = api.RATIO_KEYS;
ok(ratios.every((k, i) => i === 0 || caps[k].timing < caps[ratios[i - 1]].timing), 'timing caps fall with r');
ok(ratios.every((k, i) => i === 0 || caps[k].pitch > caps[ratios[i - 1]].pitch), 'pitch caps rise with r');
ok(!ratios.some(k => caps[k].timing === caps.r0p25.timing && caps[k].pitch === caps.r4.pitch), 'no setting maxes both');
ok(ratios.reduce((b, k) => caps[k].total > caps[b].total ? k : b, 'r0p25') === 'r1', 'the best possible total is at r = 1 (the smallest width product)');

// ---- every achievement's written claim is true of the real caps
const A = id => api.ACH.find(a => a.id === id);
const allow = (id, k) => A(id).test({key: k, ...caps[k], caught: true}, {best: {}}); // best possible round at k
ok(ratios.filter(k => allow('stopwatch', k)).join() === 'r0p25,r0p5', 'Stopwatch: only r = 1/4, 1/2');
ok(ratios.filter(k => allow('pitch', k)).join() === 'r2,r4', 'Perfect pitch: only r = 2, 4');
ok(ratios.filter(k => allow('heisenberg', k)).join() === 'r0p5,r1,r2' && !allow('heisenberg', 'r0p25') && !allow('heisenberg', 'r4'), "Heisenberg's choice: only the balanced middle");
ok(/1\/4, 1\/2/.test(A('stopwatch').rule) && /2, 4/.test(A('pitch').rule), 'rules name the right settings');
ok(ratios.every(k => allow('gold', k)), 'Gold-plated is possible everywhere');
{ const S = api.freshState(); ratios.forEach(k => api.recordRound(S, api.scoreRound(k, api.versionOf(k, M), O, 0, 0)));
  ok(S.ach.sweep && S.rounds === 5 && S.best.r1.total === caps.r1.total, 'full sweep after five ratios, bests kept');
  const before = S.best.r1.total; api.recordRound(S, api.scoreRound('r1', api.versionOf('r1', M), O, 50, 50));
  ok(S.best.r1.total === before && S.rounds === 6, 'a worse round does not lower the best'); }

// ---- the control-room clock: GPS 1126259462.4 is 09:50:45.4 UTC = 04:50:45.4 CDT (published: 09:50:45 UTC)
ok(api.clockUTC(0, M).startsWith('09:50:45.') && api.clockCDT(0, M).startsWith('04:50:45.'), 'merger clock ' + api.clockUTC(0, M));
ok(api.gpsText(0, M).startsWith('1126259462.4'), 'GPS of merger');

// ---- the chirp model behind the source view and the mirrors (fitted to the measured ridge)
const ridge = M.track_f.map(([i, j]) => [api.timeOf(i, M), api.freqOf(j, M)]);
const C = api.fitChirp(ridge);
ok(C && C.tc > Math.max(...ridge.map(q => q[0])) && C.tc > -0.005 && C.tc < 0.01, 'fitted coalescence near the data merger: ' + C.tc);
const top = api.chirpTop(C);
ok(top > 120 && top < 260, 'GW frequency at merger is plausible: ' + top.toFixed(1));
{ let worst = 0; for (const [t, f] of ridge) worst = Math.max(worst, Math.abs(Math.log(api.chirpF(t, C) / f))); ok(worst < 0.12, 'fit within 12 % of every ridge point: ' + worst.toFixed(3)); }
const PT = api.phaseTable(C, -0.4, 0.2, 0.00025);
for (const t of [-0.2, -0.1, -0.03, -0.004, 0.02]) near(api.timeAtPhase(PT, api.phaseAt(PT, t)), t, 1e-6, 'phase inverse at ' + t);
ok(Math.abs(api.separation(top, top) - 1) < 1e-12 && Math.abs(api.separation(top / 8, top) - 4) < 1e-12, 'Kepler separation');
const rp = api.ridgePower(g, M, 25, 350);
{ let best = -1, bt = 0; for (let t = -0.16; t < 0.06; t += 0.001) { const a = api.loudness(rp, t, M, 110, 999); if (a > best) { best = a; bt = t; } } ok(best > 0.95 && Math.abs(bt) < 0.02, 'loudest within 20 ms of merger: ' + bt.toFixed(3)); }

// ---- share token, colour maps
for (const s of [{v: 'r0p5', mode: 'change', zoom: 'full', f: 152, t: -48, ridge: true, view: 'data'},
                 {v: 'r4', mode: 'blurred', zoom: 'chirp', f: 150, t: -50, ridge: false, view: 'scene'}]) {
  const tok = api.formatToken(s);
  ok(/^[A-Za-z0-9._~-]+$/.test(tok) && JSON.stringify(api.parseToken('#' + tok)) === JSON.stringify(s), 'token round trip ' + tok);
}
ok(api.parseToken('#r9_b_c_f1_t1') === null && api.parseToken('#<script>') === null && api.parseToken('') === null, 'bad tokens');
ok(api.lut(0).join() === '251,250,249' && api.divLut(-1).join() === '180,84,26', 'colour map ends');

// ---- sprites: the realistic black holes, shared palette only, square portholes
for (const name of ['bh_pair', 'bh_final']) {
  const fr = SPR[name].frames[0];
  ok(fr.length === fr[0].length && fr.every(r => r.length === fr[0].length), 'square sprite ' + name);
  ok(fr.every(r => /^[.KBLTW]+$/.test(r)), 'palette ' + name + ' (no warm accent: no accretion disc)');
  ok(fr.join('').includes('W') && fr.join('').includes('K'), 'photon rings and shadows present ' + name);
}
ok(SPR._meta.masses_msun.primary === 36 && SPR._meta.masses_msun.secondary === 29 && SPR._meta.masses_msun.final === 62, 'published masses');
console.log(`ok: ${n} checks passed`);
