// Unit tests for the page's pure logic. Run: node test_page.js   (after python build_web.py)
// Extracts the "pure helpers" block and the injected data from web/index.html and checks them.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/web/index.html', 'utf8');
const script = html.split('<script>').slice(1).map(x => x.split('</script>')[0]).find(x => x.includes('// ---------- pure helpers'));
const pre = script.split('// ---------- pure helpers')[0];
const helpers = script.split('// ---------- pure helpers')[1].split('// ---------- state')[0].split('\n').slice(1).join('\n');
const ctx = new Function(pre + helpers + `;return {ODOUR,molMass,MOLS,SETS,NOTES,META,ORDER,SPRITE_DATA,binHz,setKey,trackKey,binomTail,fmtP,semis,encodeView,decodeView,availableSet,newTrial,judge,molGeom,lineClass,gapMatch,meV};`)();
let n = 0; const ok = (c, m) => { assert(c, m); n++; };

// binomial tail
ok(Math.abs(ctx.binomTail(0, 10) - 1) < 1e-12, 'P(X>=0)=1');
ok(Math.abs(ctx.binomTail(10, 10) - 1 / 1024) < 1e-12, 'P(X>=10 of 10)');
ok(Math.abs(ctx.binomTail(9, 10) - 11 / 1024) < 1e-12, 'P(X>=9 of 10)');
ok(Math.abs(ctx.binomTail(5, 10) - 638 / 1024) < 1e-12, 'P(X>=5 of 10)');
ok(ctx.binomTail(119, 132) < 1e-20, "Gane et al. 119/132 is far from chance");
ok(ctx.binomTail(3, 0) === 1, 'no trials -> p=1');
// mapping
ok(ctx.binHz(100) === 700, 'bin 100 = 700 Hz (28 cm^-1 x 0.25 Hz)');
ok(Math.abs(ctx.semis(1 / 1.362) + 5.35) < 0.01, 'H->D factor is -5.35 semitones');
ok(ctx.setKey(null, 0) === 'clean' && ctx.setKey(0.5, 1) === 's0.5_r1', 'set keys');
// view tokens round-trip and reject junk
const v = { mol: 'exaltone', iso: 'D', set: 's1_r0', view: 'scene' };
const tok = ctx.encodeView(v);
ok(/^[A-Za-z0-9._~-]+$/.test(tok), 'token uses only allowed characters');
ok(JSON.stringify(ctx.decodeView('#' + tok)) === JSON.stringify(v), 'token round-trip');
const vd = { mol: 'muscone', iso: 'H', set: 's0.5_r0.5', view: 'data' }, tokd = ctx.encodeView(vd);
ok(/^[A-Za-z0-9._~-]+$/.test(tokd) && tokd.endsWith('~data'), 'data-view token');
ok(JSON.stringify(ctx.decodeView('#' + tokd)) === JSON.stringify(vd), 'data-view token round-trip');
ok(ctx.decodeView('#acetophenone~H~clean').view === 'scene', 'old three-part links still open (Scene view)');
ok(ctx.decodeView('#evil~X~y') === null && ctx.decodeView('') === null, 'bad tokens rejected');
// trials: deterministic with a fixed rng, disguise factors within +-25 %
let seq = [0.2, 0.0, 1.0]; let i = 0; const rng = () => seq[i++ % seq.length];
const t = ctx.newTrial(rng);
ok(t.dIsA === true && Math.abs(t.mulA - 0.8) < 1e-9 && Math.abs(t.mulB - 1.25) < 1e-9, 'trial from rng');
ok(ctx.judge(t, true) === true && t.answer === 'A', 'judge correct pick');
const t2 = ctx.newTrial(() => 0.9); ok(ctx.judge(t2, true) === false, 'judge wrong pick');
// data integrity
ok(ctx.SETS[0].key === 'clean', 'clean set first');
for (const s of ctx.SETS) {
  ok(ctx.availableSet(s.key), 'set available ' + s.key);
  for (const m of ctx.ORDER) for (const iso of ['H', 'D']) {
    const tr = ctx.NOTES[s.key][ctx.trackKey(m, iso)];
    ok(tr && Array.isArray(tr.n) && tr.g > 0, `track ${s.key} ${m} ${iso}`);
    for (const nt of tr.n) ok(nt[0] >= 0 && nt[1] >= nt[0] && nt[2] >= 0 && nt[2] <= 127 && nt[3] > 0 && nt[3] <= 127, 'note sane');
  }
}
// clean chords: every moved line glides down for H->D and up for D->H; heavy lines stay
for (const m of ctx.ORDER) {
  for (const nt of ctx.NOTES.clean[m + '_H'].n) ok(nt[5] ? nt[4] < nt[2] : nt[4] === nt[2], 'H glide target ' + m);
  for (const nt of ctx.NOTES.clean[m + '_D'].n) ok(nt[5] ? nt[4] > nt[2] : nt[4] === nt[2], 'D glide target ' + m);
}
ok(ctx.META.jobs === ctx.SETS.length - 1, 'job count matches sets');
// molecule sprites are built from the real structures: H count = formula, 1 oxygen, right number of carbons
const NC = { acetophenone: 8, exaltone: 15, muscone: 16 };
for (const m of ctx.ORDER) {
  const g = ctx.molGeom(m), el = e => g.A.filter(a => a.el === e).length;
  ok(el('H') === ctx.MOLS[m].n_h, `${m}: ${el('H')} H drawn = ${ctx.MOLS[m].n_h} in the formula`);
  ok(el('C') === NC[m] && el('O') === 1, `${m}: carbons and one oxygen`);
  for (const a of g.A) if (a.el === 'H') ok(g.A[a.par] && g.A[a.par].el === 'C', `${m}: every H sits on a carbon`);
  for (const b of g.B) ok(b.a !== b.b && g.A[b.a] && g.A[b.b], `${m}: bonds join two atoms`);
  // no two atoms drawn on top of each other (at least 0.55 bond lengths apart)
  for (let i = 0; i < g.A.length; i++) for (let j = i + 1; j < g.A.length; j++)
    ok(Math.hypot(g.A[i].x - g.A[j].x, g.A[i].y - g.A[j].y) > 0.55, `${m}: atoms ${i},${j} apart`);
}
// every line has a motion class; spot checks
for (const m of ctx.ORDER) for (const iso of ['H', 'D']) for (const l of ctx.MOLS[m].lines[iso]) ok(['XH', 'CO', 'RING', 'BEND'].includes(ctx.lineClass(l.label)), 'class ' + l.label);
ok(ctx.lineClass('C=O stretch') === 'CO' && ctx.lineClass('aromatic C-D stretch') === 'XH' && ctx.lineClass('CD2 asymmetric stretch') === 'XH', 'stretch classes');
ok(ctx.lineClass('ring C=C stretch') === 'RING' && ctx.lineClass('C-C(=O) stretch') === 'RING' && ctx.lineClass('ring out-of-plane bend') === 'RING', 'ring classes');
ok(ctx.lineClass('CD2 scissor bend') === 'BEND' && ctx.lineClass('aromatic C-H out-of-plane bend') === 'BEND', 'bend classes');
// Fig. d: a 372 meV gap matches acetophenone's aromatic C-H stretch (3060 cm^-1 = 379 meV) but nothing once deuterated
ok(Math.abs(ctx.meV(3060) - 379.4) < 0.1, '3060 cm^-1 = 379.4 meV');
ok(ctx.gapMatch(ctx.MOLS.acetophenone.lines.H, 372, 15).l.nu_h === 3060, 'gap matches C-H stretch');
ok(ctx.gapMatch(ctx.MOLS.acetophenone.lines.D, 372, 15) === null, 'deuterated: no match at 372 meV');
ok(ctx.gapMatch(ctx.MOLS.acetophenone.lines.D, 279, 15).l.nu_h === 3060, 'deuterated C-D stretch at 279 meV');
// sprites: rectangular frames, palette characters only, the cast is all there
for (const name of ['mascot', 'neutron', 'spike', 'atomC', 'atomO', 'atomH', 'atomD', 'miniH', 'miniD', 'miniO', 'electron', 'vial', 'vialOpen', 'letterH', 'letterD', 'letterQ', 'tick', 'cross']) {
  const sp = ctx.SPRITE_DATA[name]; ok(sp && sp.frames.length > 0, 'sprite ' + name);
  for (const f of sp.frames) { ok(f.every(r => r.length === f[0].length) && f.length === sp.frames[0].length, name + ' frame is rectangular');
    ok(f.every(r => /^[.KBLTWOG]+$/.test(r)), name + ' uses the ink palette only'); }
}
ok(ctx.SPRITE_DATA.atomH.frames[0].length === ctx.SPRITE_DATA.atomD.frames[0].length && ctx.SPRITE_DATA.atomH.frames[0][0].length === ctx.SPRITE_DATA.atomD.frames[0][0].length, 'H and D drawn the same size');
// the hub mascot is a cut-out: transparent in every corner of both frames, ink only inside
for (const f of ctx.SPRITE_DATA.mascot.frames) { const h = f.length, w = f[0].length;
  ok([f[0][0], f[0][w - 1], f[h - 1][0], f[h - 1][w - 1]].every(c => c === '.'), 'mascot corners are transparent');
  ok(f.join('').split('').filter(c => c === '.').length > 0.3 * w * h, 'mascot is a silhouette, not a tile'); }
// molar masses shown under the name and in the loupe caption (u = g/mol)
ok(Math.abs(ctx.molMass('C8H8O') - 120.15) < 0.02 && Math.abs(ctx.molMass('C8D8O') - 128.20) < 0.02, 'acetophenone and -d8 masses');
ok(Math.abs(ctx.molMass('C15H28O') - 224.39) < 0.03 && Math.abs(ctx.molMass('C16D30O') - 268.62) < 0.05, 'musk masses');
for (const m of ctx.ORDER) for (const iso of ['H', 'D']) ok(typeof ctx.ODOUR[m][iso] === 'string' && ctx.ODOUR[m][iso].length > 20, 'odour note ' + m + ' ' + iso);
console.log(`${n} checks passed`);
