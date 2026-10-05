// ==== FLAVOUR: the plate (a real source, the journey, Super-Kamiokande), the synth and the controls ====
// Inlined into web/template.html at the SCENE marker by build_web.py. Pure ink-engraving SVG, drawn from published
// descriptions of the real objects (see CREDITS.md); no photograph is traced or embedded.
const SPR = /*SPRITES*/{};
const SP = {}; for (const k in SPR) SP[k] = InkSprite.make(SPR[k]);
const st = { chip: 0, src: 1, ei: 0, u: uOf(295 / 0.6), mix: 1, model: 3, flight: 0, attack: 0.02, release: 0.6, gain: 0.8 };
const $ = id => document.getElementById(id);
const TOK = (() => { const cs = getComputedStyle(document.documentElement), g = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
  return { paper: g('--paper', '#FBFAF9'), panel: g('--panel', '#FFFFFF'), rule: g('--rule', '#D3D3E6'), ink: g('--ink', '#19238E'), ink2: g('--ink-2', '#545BA9'), ink3: g('--ink-3', '#A1A4CE'), good: g('--good', '#1F7A4D'), warn: g('--warn', '#B4541A'), onink: g('--on-ink', '#FBFAF9') }; })();
const C = { K: '#19238E', B: '#545BA9', L: '#A1A4CE', T: '#D3D3E6', W: '#FBFAF9', O: '#B4541A', P: '#FFFFFF' };   // the shared sprite palette
const COL = [TOK.warn, TOK.ink, TOK.good];   // nu_e, nu_mu, nu_tau in The data section
const NAME = ['νe', 'νμ', 'ντ'], NAMEBAR = ['ν̄e', 'ν̄μ', 'ν̄τ'], FLN = ['electron', 'muon', 'tau'], LEP = ['e', 'μ', 'τ'];
const RINGN = ['fuzzy ring', 'sharp ring', 'several rings'];
const nm = f => (SRC[srcIdx(st)].anti ? NAMEBAR : NAME)[f];
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtL = L => L >= 1e6 ? (L / 1e6).toFixed(1) + ' million' : L < 10 ? L.toFixed(2) : L < 100 ? L.toFixed(1) : fmt(L);
const fmtE = e => e < 0.05 ? Math.round(e * 1000) + ' MeV' : e + ' GeV';
const nowS = () => performance.now() / 1000;
const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const sprURL = (name, scale) => { try { return InkSprite.toDataURL(SP[name], 0, scale || 2); } catch (e) { return ''; } };
const eBorn = () => SRC[srcIdx(st)].nu === 'e';
let ctx = null, master = null, voices = [], dirty = true, droneOn = false;

// where each source's journey is marked: real, published baselines (km)
const MARKS = {
  reactor: [[1.65, 'Daya Bay far hall 1.65 km', 'Daya Bay'], [52.5, 'JUNO 52.5 km', 'JUNO'], [180, 'KamLAND ~180 km', 'KamLAND']],
  accel: [[295, 'T2K: J-PARC to Super-K 295 km', 'T2K'], [735, 'MINOS 735 km', 'MINOS'], [810, 'NOvA 810 km', 'NOvA'], [1300, 'DUNE 1,300 km', 'DUNE']],
  atmo: [[15, 'from overhead ~15 km', 'overhead'], [437, 'from the horizon ~440 km', 'horizon'], [12757, 'from directly below 12,757 km', 'from below']],
  sun: [[6.96e5, "the Sun's surface", 'surface'], [5.79e7, 'Mercury 57.9 M km', 'Mercury'], [1.082e8, 'Venus 108.2 M km', 'Venus'], [1.496e8, 'Earth 1 AU = 149.6 M km', 'Earth']],
};
const HOME = { reactor: 52.5, accel: 295, atmo: 437, sun: 1.496e8 };   // where a source starts: JUNO, T2K, the horizon, 1 AU
const R_E = 6371, H_ATM = 15;
const cosZen = L => clamp(((R_E + H_ATM) ** 2 - R_E ** 2 - L * L) / (2 * R_E * L), -1, 1);   // atmospheric path length -> zenith angle
const chordDepth = L => R_E - Math.sqrt(Math.max(0, R_E * R_E - (L / 2) ** 2));             // deepest point of a straight path

// ---- proof chips (real numbers from the bundle) ----
(function () {
  const hw = D.machines.find(m => m.kind === 'qpu'), aer = D.machines.find(m => m.id === 'aer');
  const fakes = D.machines.filter(m => m.kind === 'emu').length;
  const chips = [];
  if (aer) chips.push(`<span class="hot"><b>${aer.values}</b>-value curves &middot; <b>${aer.qubits.rule}</b> qubits by the QPIXL rule</span>`);
  if (hw) chips.push(`<span class="hot"><b>${hw.backend}</b> real hardware &middot; <b>${hw.values}</b> values</span>`);
  chips.push(`<span><b>${D.machines.length}</b> completed Atlas jobs</span>`);
  chips.push(`<span><b>${fakes}</b> IBM noise models</span>`);
  $('proof').innerHTML = chips.join('');
})();

// ---- flavour tags (scene) and meters with waveforms (data) ----
const RING_ICON = ['ring_e', 'ring_mu', 'ring_tau'];
$('tags').innerHTML = FL.map((f, i) => `<div class="tag3"><img alt="" width="40" height="28" src="${sprURL(RING_ICON[i], 2)}"><span class="nm"><span id="tn-${f}">${NAME[i]}</span><span id="p-${f}">0%</span></span><span class="ds"><span>${RINGN[i]}</span><span class="fl"> &middot; ${FLN[i]}-like</span></span><span class="bar"><i id="pb-${f}"></i></span></div>`).join('');
$('meters').innerHTML = FL.map((f, i) => `<div class="meter f-${f}"><div class="top"><span class="nm">${NAME[i]}</span><span class="val" id="v-${f}">0.000</span></div><div class="bar"><i id="b-${f}"></i></div><canvas id="w-${f}" width="160" height="38" tabindex="0" role="button" aria-label="${NAME[i]} waveform: click or press Enter to hear this oscillator alone" title="Hear the ${NAME[i]} oscillator alone"></canvas></div>`).join('');

// ---- knobs ----
const KN = [
  { k: 'u', label: 'L/E', min: U0, max: U1, step: 0.001, show: v => SRC[srcIdx(st)].fixed ? '~10¹⁰ km/GeV' : fmt(leOf(v)) + ' km/GeV' },
  { k: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, show: v => v === 0 ? 'exact' : v === 1 ? 'measured' : Math.round(v * 100) + '% meas.' },
  { k: 'flight', label: 'Flight', min: 0, max: 0.5, step: 0.01, show: v => v === 0 ? 'off' : v.toFixed(2) + ' dec/s' },
  { k: 'attack', label: 'Attack', min: 0.002, max: 1.5, step: 0.001, show: v => (v * 1000 < 1000 ? Math.round(v * 1000) + ' ms' : v.toFixed(2) + ' s') },
  { k: 'release', label: 'Release', min: 0.02, max: 4, step: 0.01, show: v => v.toFixed(2) + ' s' },
  { k: 'gain', label: 'Gain', min: 0, max: 1, step: 0.01, show: v => Math.round(v * 100) + '%' },
];
$('knobs').innerHTML = KN.map(o => `<label class="knob"><span class="row"><span class="label">${o.label}</span><output id="o-${o.k}"></output></span><input type="range" id="k-${o.k}" min="${o.min}" max="${o.max}" step="${o.step}" aria-label="${o.label}"></label>`).join('');
KN.forEach(o => {
  const el = $('k-' + o.k);
  el.value = st[o.k];
  el.addEventListener('input', () => { if (o.k === 'u') { setUAnywhere(+el.value); return; } st[o.k] = +el.value; if (o.k === 'gain' && master) master.gain.setTargetAtTime(st.gain * 0.3, ctx.currentTime, 0.02); dirty = true; ui(); });
});
function syncKnobs() { KN.forEach(o => { $('k-' + o.k).value = st[o.k]; $('o-' + o.k).textContent = o.show(st[o.k]); }); }

// ---- chips: the machines that wrote the curves onto qubits; noise squares from each one's real rms error ----
const KIND_ICON = { qpu: 'chip_real', sim: 'chip_sim', emu: 'chip_model' };
const KIND_SHORT = { qpu: 'real IBM chip', sim: 'noiseless sim', emu: 'noise model' };
const rmsAvg = m => (m.rms[1] + m.rms[2] + m.rms[3]) / 3;
$('chip-seg').innerHTML = D.machines.map((m, i) => { const r = rmsAvg(m), pips = Math.max(1, Math.min(5, Math.ceil(r / 0.05)));
  return `<button type="button" class="kbtn${m.kind === 'qpu' ? ' hw' : ''}" data-chip="${i}" aria-pressed="false" title="${m.kind_label}; rms error vs exact ${r.toFixed(3)}"><img alt="" width="32" height="32" src="${sprURL(KIND_ICON[m.kind], 2)}"><b>${m.label}</b><small>${KIND_SHORT[m.kind]} <span class="pips" aria-label="noise ${pips} of 5">${'<i class="f"></i>'.repeat(pips)}${'<i></i>'.repeat(5 - pips)}</span></small></button>`; }).join('');
document.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { st.chip = +b.dataset.chip; dirty = true; ui(); }));
document.querySelectorAll('[data-model]').forEach(b => b.addEventListener('click', () => { st.model = +b.dataset.model; dirty = true; ui(); }));

// ---- source and energy: a new source starts at its landmark baseline; a new energy keeps L (clamped) ----
$('src-seg').innerHTML = SRC.map((s, i) => `<button type="button" data-src="${i}" aria-pressed="false">${s.label}</button>`).join('');
function setSource(i, ei, keepL) {
  const L0 = leOf(st.u) * eOf(st);
  st.src = i; st.ei = eIdx(i, ei || 0);
  const s = SRC[i], r = rangeL(i, st.ei), L = keepL ? clamp(L0, r[0], r[1]) : clamp(HOME[s.id], r[0], r[1]);
  st.u = s.fixed ? U1 : clamp(uOf(L / eOf(st)), U0, U1);
  tally.sig = ''; ev.cur = null;
  buildESeg(); PL.key = ''; plate(); dirty = true; ui();
}
document.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.src; if (i !== st.src) setSource(i, 0, false); }));
function buildESeg() {
  const s = SRC[srcIdx(st)];
  // a source with one energy gets a plain label, not a button that could never change anything
  if (s.es.length === 1) { $('e-seg').innerHTML = `<span class="e-only" title="${s.es[0].note}">${s.es[0].label} &middot; fixed</span>`; return; }
  $('e-seg').innerHTML = s.es.map((e, k) => `<button type="button" data-e="${k}" aria-pressed="${k === st.ei}" title="${e.note}">${e.label}</button>`).join('');
  $('e-seg').querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.e; if (k !== st.ei) setSource(srcIdx(st), k, true); }));
}

// ---- the job table (Jobs and credits): each machine's name is a button that puts that chip on the synth ----
(function () {
  const rows = D.machines.map((m, i) => `<tr><td><button type="button" class="jb" data-jobchip="${i}" aria-pressed="false" title="Play the curves measured on ${m.id}">${m.id}</button></td><td>${m.kind_label}</td><td>${m.values}</td><td>${m.n}</td><td>${m.rms[1].toFixed(3)} / ${m.rms[2].toFixed(3)} / ${m.rms[3].toFixed(3)}</td><td>${m.job_id}</td></tr>`).join('');
  $('jobs').innerHTML = `<tr><th>machine</th><th>where it ran</th><th>values</th><th>pts/curve</th><th>rms e / mu / tau</th><th>Atlas job</th></tr>` + rows;
  const hw = D.machines.find(m => m.kind === 'qpu'), aer = D.machines.find(m => m.id === 'aer');
  $('jobs-count').textContent = `${D.machines.length} Atlas jobs · sources`;
  $('jobs').querySelectorAll('[data-jobchip]').forEach(b => b.addEventListener('click', () => {
    st.chip = +b.dataset.jobchip; dirty = true; ui();
    toast(eBorn() ? `Chip: ${D.machines[st.chip].id} (${SRC[srcIdx(st)].id === 'sun' ? 'the Sun' : 'the reactor'} plays classical curves; pick the accelerator or the atmosphere to hear the chip)` : `Chip: ${D.machines[st.chip].id}`);
  }));
  $('engine-detail').innerHTML = `The noiseless simulator (aer) took all ${aer ? aer.values : 4096} values: 4 curves &times; 1024 points. 4096 = 2<sup>12</sup> addresses, which the documented QPIXL rule counts as 12 address qubits + 1 data qubit = 13. The engine actually splits them into data-qubit groups (its leftover scatter matches 16 values, or 4 address qubits, per data qubit). On IBM chips the engine itself reported the data-qubit capacity when we asked for 4096 values: 448 on fake_fez, 378 on fake_torino, 360 on fake_brisbane. The chips of the same families (fake_marrakesh, ibm_fez, and the other eight 127-qubit Eagle models) then took the same sizes. Each chip got 4 curves at the most points that fit.` + (hw ? ` The ibm_fez run is IBM job <code>${hw.ibm_job_id.join(', ')}</code> (${hw.qpu_seconds} s of QPU time, ${hw.shots} shots).` : '');
})();

// ---- demos: one <audio> each (no autoplay, nothing preloaded), play/pause, stop and a scrubber ----
const mmss = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); };
const DEMO_ICON = ['ring_tau', 'ring_mu', 'ring_e'];
$('demos').innerHTML = DEMOS.map((d, i) => `<div class="demo" id="demo-${i}"><h3><img alt="" width="40" height="28" src="${sprURL(DEMO_ICON[i % 3], 2)}">${d.title}</h3><p>${d.text}</p>`
  + `<audio preload="none" src="${d.file}"></audio>`
  + `<div class="player"><div class="row"><button type="button" class="btn" data-play="${i}" aria-pressed="false">Play</button>`
  + `<button type="button" class="btn ghost" data-stop="${i}">Stop</button><span class="time" id="dt-${i}">0:00 / ${mmss(d.seconds)}</span></div>`
  + `<input type="range" id="ds-${i}" min="0" max="${d.seconds || 30}" step="0.1" value="0" aria-label="${d.title} position">`
  + (d.cues ? `<div class="cues" role="group" aria-label="Jump to a machine">${d.cues.map((c, k) => `<button type="button" data-cue="${i}:${k}">${c.label}</button>`).join('')}</div>` : '')
  + `</div><p class="label">${d.settings}</p></div>`).join('');
const demoEls = DEMOS.map((d, i) => ({ d, au: $('demo-' + i).querySelector('audio'), play: $('demo-' + i).querySelector('[data-play]'), time: $('dt-' + i), seek: $('ds-' + i), cues: [...$('demo-' + i).querySelectorAll('[data-cue]')] }));
function demoSeek(p, t) {   // a seek the file can't take yet (preload="none") is kept and applied once it can
  const a = p.au; let ok = false;
  try { if (a.readyState >= 1) for (let i = 0; i < a.seekable.length; i++) if (t >= a.seekable.start(i) && t <= a.seekable.end(i)) ok = true; if (ok) a.currentTime = t; } catch (e) { ok = false; }
  p.pending = ok ? null : t;
}
function demoUI(p) {
  const t = p.pending != null ? p.pending : (p.au.currentTime || 0), dur = isFinite(p.au.duration) && p.au.duration > 0 ? p.au.duration : (p.d.seconds || 0), on = !p.au.paused && !p.au.ended;
  p.play.textContent = on ? 'Pause' : (t > 0 && !p.au.ended ? 'Resume' : 'Play'); p.play.setAttribute('aria-pressed', String(on));
  p.time.textContent = mmss(t) + ' / ' + mmss(dur); p.seek.max = dur || p.seek.max; if (!p.dragging) p.seek.value = t;
  if (p.d.cues) { let k = -1; p.d.cues.forEach((c, j) => { if (t >= c.t) k = j; }); p.cues.forEach((b, j) => b.classList.toggle('now', (on || t > 0) && j === k)); }
}
function demoPlay(p) {
  demoEls.forEach(q => { if (q !== p && !q.au.paused) q.au.pause(); });   // one demo at a time
  try { const r = p.au.play(); if (r && r.catch) r.catch(() => toast('This browser could not play the file')); } catch (e) { toast('This browser could not play the file'); }
}
demoEls.forEach(p => {
  p.play.addEventListener('click', () => { if (p.au.paused || p.au.ended) demoPlay(p); else p.au.pause(); });
  p.play.parentNode.querySelector('[data-stop]').addEventListener('click', () => { p.au.pause(); demoSeek(p, 0); demoUI(p); });
  p.seek.addEventListener('input', () => { p.dragging = true; demoSeek(p, +p.seek.value); p.time.textContent = mmss(+p.seek.value) + ' / ' + mmss(+p.seek.max); });
  p.seek.addEventListener('change', () => { p.dragging = false; demoUI(p); });
  p.cues.forEach((b, k) => b.addEventListener('click', () => { demoSeek(p, p.d.cues[k].t + 0.01); demoPlay(p); demoUI(p); }));
  ['loadedmetadata', 'progress', 'canplay', 'canplaythrough'].forEach(ev_ => p.au.addEventListener(ev_, () => { if (p.pending != null) demoSeek(p, p.pending); }));
  ['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata', 'seeked'].forEach(ev_ => p.au.addEventListener(ev_, () => demoUI(p)));
  // once it plays, a seek the server still can't take (no byte ranges) is dropped, so the time shown is the time heard
  p.au.addEventListener('playing', () => { if (p.pending == null) return; demoSeek(p, p.pending); if (p.pending != null) { p.pending = null; toast('This host cannot jump inside the file, so it plays from the start'); } demoUI(p); });
});

// ---- the keys: an A minor pentatonic, A2..G4; each key is a 50 cm photomultiplier tube ----
const RACK = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67];
const RACK_KEYS = 'asdfghjkl;'.split('');
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nn = n => NOTE_NAMES[n % 12] + (Math.floor(n / 12) - 1);
let octaveShift = 0;
(function () {
  const wrap = $('keys'), off = sprURL('pmt', 2), on = sprURL('pmt_lit', 2);
  wrap.innerHTML = RACK.map((n, i) => `<button type="button" data-note="${n}" aria-label="Detect a neutrino, note ${nn(n)}"><img alt="" width="24" height="36" src="${off}" data-on="${on}" data-off="${off}"><span>${nn(n)}</span><kbd>${RACK_KEYS[i].toUpperCase()}</kbd></button>`).join('');
  const held = new Map();
  wrap.addEventListener('pointerdown', e => { const b = e.target.closest('[data-note]'); if (!b) return; e.preventDefault(); try { wrap.setPointerCapture(e.pointerId); } catch (_) {} held.set(e.pointerId, +b.dataset.note); noteOn(+b.dataset.note); });
  wrap.addEventListener('pointermove', e => {
    if (!held.has(e.pointerId)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest && el.closest('[data-note]');
    if (b && +b.dataset.note !== held.get(e.pointerId)) { noteOff(held.get(e.pointerId)); held.set(e.pointerId, +b.dataset.note); noteOn(+b.dataset.note); }
  });
  const up = e => { if (held.has(e.pointerId)) { noteOff(held.get(e.pointerId)); held.delete(e.pointerId); } };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('keydown', e => { const b = e.target.closest('[data-note]'); if (b && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); noteOn(+b.dataset.note); } });
  wrap.addEventListener('keyup', e => { const b = e.target.closest('[data-note]'); if (b && (e.key === 'Enter' || e.key === ' ')) noteOff(+b.dataset.note); });
})();
const down = new Set();
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { octaveShift = Math.max(-2, octaveShift - 1); toast('Octave ' + (octaveShift >= 0 ? '+' : '') + octaveShift); return; }
  if (k === 'x') { octaveShift = Math.min(2, octaveShift + 1); toast('Octave ' + (octaveShift >= 0 ? '+' : '') + octaveShift); return; }
  const i = RACK_KEYS.indexOf(k); if (i < 0 || (t && t.closest && (t.closest('#keys') || t.id === 'scene'))) return;
  const n = RACK[i] + 12 * octaveShift; if (down.has(k)) return; down.add(k); noteOn(n, k);
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (!down.has(k)) return; down.delete(k); voices.filter(v => v.key === k && !v.rel).forEach(v => release(v)); light(); });

// ---- audio ----
function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { toast('This browser has no Web Audio'); return false; }
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = st.gain * 0.3; master.connect(ctx.destination);
  $('start').hidden = true;
  return true;
}
$('start-btn').addEventListener('click', () => { if (ensureAudio()) { toast('Synth on: play the keys, or click the detector'); light(); $('keys').querySelector('[data-note="57"]').focus({ preventScroll: true }); } });
function voiceU(v) { return Math.min(U1, st.u + st.flight * Math.max(0, ctx.currentTime - v.t0)); }
function noteOn(note, key, quiet) {
  if (!ensureAudio()) return;
  const live = voices.filter(v => !v.rel);
  if (live.length >= 8) release(live[0]);
  const now = ctx.currentTime, f0 = 440 * Math.pow(2, (note - 69) / 12);
  const v = { note, key, t0: now, rel: false, osc: [], g: [], env: ctx.createGain(), lastU: -99, lastSig: '' };
  v.env.gain.setValueAtTime(0, now);
  v.env.gain.linearRampToValueAtTime(0.8, now + Math.max(0.002, st.attack));
  v.env.connect(master);
  for (let f = 0; f < 3; f++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f0 * MULT[f]; g.gain.value = 0;
    o.connect(g); g.connect(v.env); o.start(now);
    v.osc.push(o); v.g.push(g);
  }
  voices.push(v); updateVoice(v, true); light();
  if (!quiet) detect(st.u, 1);
}
function release(v) {
  if (v.rel) return;
  v.rel = true;
  const now = ctx.currentTime, g = v.env.gain;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + st.release);
  v.osc.forEach(o => o.stop(now + st.release + 0.05));
  v.osc[0].onended = () => { v.env.disconnect(); voices = voices.filter(x => x !== v); };
}
function noteOff(note) { voices.filter(v => v.note === note && !v.rel && !v.drone).forEach(release); light(); }
function updateVoice(v, force) {
  const u = voiceU(v), sig = `${st.chip}|${st.mix}|${st.model}|${st.src}|${st.ei}`;
  if (!force && Math.abs(u - v.lastU) < 2e-4 && sig === v.lastSig) return;
  v.lastU = u; v.lastSig = sig;
  for (let f = 0; f < 3; f++) {
    const w = waveFor(st, f, u);
    v.osc[f].setPeriodicWave(ctx.createPeriodicWave(w.real, w.imag, { disableNormalization: true }));
    v.g[f].gain.setTargetAtTime(level(st, f, u), ctx.currentTime, 0.015);
  }
}
function light() {
  const live = voices.filter(v => !v.rel), on = new Set(live.map(v => v.note));
  document.querySelectorAll('#keys [data-note]').forEach(b => { const o = on.has(+b.dataset.note), im = b.querySelector('img'); b.classList.toggle('on', o); if (im) im.src = o ? im.dataset.on : im.dataset.off; });
  $('bar-state').textContent = live.length ? `Sounding · ${live.length} note${live.length > 1 ? 's' : ''}` : (ctx ? 'Ready · play a key' : 'Silent');
  if (PL.svg) PL.svg.classList.toggle('live', live.length > 0 && !REDUCED);
  dirty = true;   // the curves redraw their note markers
}
$('drone').addEventListener('click', () => {
  if (!droneOn) {
    if (!ensureAudio()) return;
    droneOn = true; noteOn(45); noteOn(52, null, true); voices.filter(v => v.note === 45 || v.note === 52).forEach(v => v.drone = true);
  } else { droneOn = false; voices.filter(v => v.drone).forEach(release); }
  syncDrone(); light();
});
function syncDrone() { $('drone').setAttribute('aria-pressed', String(droneOn)); $('drone').textContent = droneOn ? 'Stop the drone' : 'Hold a drone'; }
$('panic').addEventListener('click', () => {   // silences everything: synth voices, the drone and the demo players
  if (ctx) voices.filter(v => !v.rel).forEach(release);
  droneOn = false; down.clear(); syncDrone();
  demoEls.forEach(p => { if (!p.au.paused) p.au.pause(); });
  soloStop();
  light(); toast('All sound stopped');
});

// ---- The data: click a waveform (or focus it and press Enter) to hear that one oscillator alone for about a second ----
// It is the oscillator the A3 key plays for that flavour, with the waveform drawn above it at your L/E, at a fixed level
// so its shape is audible even where its probability (its loudness in the synth) is small. Not a detection.
let solo = null;
function soloStop() {
  if (solo) { try { solo.o.stop(); } catch (_) {} try { solo.g.disconnect(); } catch (_) {} }
  solo = null; document.querySelectorAll('#meters canvas').forEach(c => c.classList.remove('on'));
}
function soloPlay(f) {
  if (st.model === 2 && f === 2 && !eBorn()) { toast(`${NAME[2]} is off in the 2-flavour model`); return; }
  if (!ensureAudio()) return;
  soloStop();
  const now = ctx.currentTime, w = waveFor(st, f, st.u), o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = 220 * MULT[f];
  o.setPeriodicWave(ctx.createPeriodicWave(w.real, w.imag, { disableNormalization: true }));
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now + 0.02); g.gain.setValueAtTime(0.5, now + 0.9); g.gain.linearRampToValueAtTime(0, now + 1.1);
  o.connect(g); g.connect(master); o.start(now); o.stop(now + 1.15);
  const me = solo = { o, g, f }; $('w-' + FL[f]).classList.add('on');
  o.onended = () => { if (solo === me) soloStop(); };
  toast(`${nm(f)} oscillator alone: its waveform at L/E ${SRC[srcIdx(st)].fixed ? '~10¹⁰' : fmt(leOf(st.u))} km/GeV (probability there ${level(st, f, st.u).toFixed(3)}; played at a fixed level)`);
}
FL.forEach((fl, f) => {
  const c = $('w-' + fl);
  c.addEventListener('click', () => soloPlay(f));
  c.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); soloPlay(f); } });
});

// ---- detection: one neutrino interacts as ONE flavour, a classical draw weighted by the curves at your L ----
const tally = { n: [0, 0, 0], miss: 0, sig: '', last: null, evn: 0 };
const spotSig = () => [st.src, st.ei, st.chip, st.mix, st.model, Math.round(st.u * 100)].join('|');
function probsAt(u) { return [0, 1, 2].map(f => (st.model === 2 && f === 2 && !eBorn()) ? 0 : level(st, f, u)); }
function draw1(P) {
  const tot = P[0] + P[1] + P[2]; if (!(tot > 0)) return 1;
  let r = Math.random() * tot;
  for (let f = 0; f < 3; f++) { if (r < P[f]) return f; r -= P[f]; }
  return P[2] > 0 ? 2 : P[1] > 0 ? 1 : 0;
}
// can the detector see this flavour at this energy? (charged-current thresholds: a muon needs ~110 MeV, a tau ~3.5 GeV)
function seen(f) { const e = eOf(st); return f === 0 || (f === 1 && e >= MU_GEV) || (f === 2 && e >= TAU_GEV); }
function detect(u, n) {
  const sig = spotSig(); if (sig !== tally.sig) { tally.sig = sig; tally.n = [0, 0, 0]; tally.miss = 0; }
  const P = probsAt(u); let f = 1;
  for (let i = 0; i < n; i++) { f = draw1(P); tally.n[f]++; if (!seen(f)) tally.miss++; }
  tally.last = { f, seen: seen(f) }; tally.evn++;
  ev.cur = tally.last.seen ? makeEvent(f) : { f, miss: true, t: nowS() };
  drawEvent(); detectLog();
}
$('panel').addEventListener('click', () => { detect(st.u, 100); toast('100 neutrinos detected here'); });
function detectLog() {
  if (tally.sig !== spotSig()) { tally.sig = spotSig(); tally.n = [0, 0, 0]; tally.miss = 0; tally.last = null; }
  const P = probsAt(st.u), tot = (P[0] + P[1] + P[2]) || 1, n = tally.n[0] + tally.n[1] + tally.n[2];
  const pct = P.map(p => Math.round(100 * p / tot) + '%').join(' / ');
  let last = 'No neutrinos detected here yet. Play a key, click the detector, or detect 100 at once.';
  if (tally.last) {
    const f = tally.last.f, e = eOf(st);
    last = tally.last.seen ? (e < 0.05 ? `Last event: <b>${nm(f)}</b> &rarr; a few-MeV ${SRC[st.src].anti ? 'positron' : 'electron'}: a faint ring of ${ev.cur ? ev.cur.nh : 'a few dozen'} tubes.`
      : `Last event: <b>${nm(f)}</b> &rarr; ${f === 2 ? 'a tau, which decays at once: ' + RINGN[f] : 'a' + (f === 0 ? 'n electron' : ' muon') + ': a ' + RINGN[f]} (${LEP[f]}-like), ${ev.cur ? ev.cur.nh : ''} tubes lit.`)
      : `Last event: <b>${nm(f)}</b>, but at ${fmtE(e)} it is below the ${FLN[f]} threshold: no ring, seen only as a missing event.`;
  }
  const tl = n ? `Detected here: <b>${n}</b> &middot; ${nm(0)} ${tally.n[0]} &middot; ${nm(1)} ${tally.n[1]} &middot; ${nm(2)} ${tally.n[2]}${tally.miss ? ` (${tally.miss} below threshold)` : ''} &middot; curves say ${pct}` : `Curves say ${pct} (${nm(0)} / ${nm(1)} / ${nm(2)}) at this distance.`;
  $('tastelog').innerHTML = `<span>${last}</span><span>${tl}</span>`;
}

// ---- the event: Super-K's inner wall as a grid of PMTs; a Cherenkov cone (about 42 deg in water) lights a ring ----
// Geometry is real (inner detector 33.8 m wide, 36.2 m tall); the hit pattern is a simple sketch, not a detector simulation.
const SKR = 16.9, SKH = 18.1, NCOL = 72, NROW = 24, SPC = 2 * Math.PI * SKR / NCOL, TH_C = Math.acos(1 / 1.334);
const PMT = [];
for (let j = 0; j < NROW; j++) { const z = SKH - (j + 0.5) * (2 * SKH / NROW); for (let i = 0; i < NCOL; i++) { const a = (i + 0.5) / NCOL * 2 * Math.PI; PMT.push({ x: SKR * Math.cos(a), y: SKR * Math.sin(a), z, part: 0, a }); } }
for (const part of [1, 2]) { const kk = Math.floor(SKR / SPC); for (let gx = -kk; gx <= kk; gx++) for (let gy = -kk; gy <= kk; gy++) { const x = gx * SPC, y = gy * SPC; if (x * x + y * y <= (SKR - 0.7) ** 2) PMT.push({ x, y, z: part === 1 ? SKH : -SKH, part }); } }
const ev = { cur: null };
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const norm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
function angTo(p, o, d) { const x = p.x - o[0], y = p.y - o[1], z = p.z - o[2], n = Math.hypot(x, y, z) || 1; return Math.acos(clamp((x * d[0] + y * d[1] + z * d[2]) / n, -1, 1)); }
function smear(d, s) { return norm([d[0] + s * gauss(), d[1] + s * gauss(), d[2] + s * gauss()]); }
function exitT(o, d) {   // distance along d from o to the inner wall
  let t = 1e9; const a = d[0] * d[0] + d[1] * d[1];
  if (a > 1e-9) { const b = 2 * (o[0] * d[0] + o[1] * d[1]), c = o[0] * o[0] + o[1] * o[1] - SKR * SKR; t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); }
  if (d[2] > 1e-9) t = Math.min(t, (SKH - o[2]) / d[2]); else if (d[2] < -1e-9) t = Math.min(t, (-SKH - o[2]) / d[2]);
  return t;
}
// the lepton's direction: the beam enters from the left, into the page; atmospheric neutrinos arrive from the zenith
// angle their path length implies; azimuths are chosen so the ring faces the cut-away (an illustration choice)
function eventDir() {
  const s = SRC[srcIdx(st)], e = eOf(st), L = leOf(st.u) * e;
  if (s.id === 'accel') return smear(norm([0.72, 0.69, -0.02]), e < 1 ? 0.32 : 0.18);
  if (s.id === 'atmo') { const cz = cosZen(L), sz = Math.sqrt(1 - cz * cz), az = (0.25 + 0.5 * Math.random()) * Math.PI; return smear([sz * Math.cos(az), sz * Math.sin(az), -cz], e < 1 ? 0.35 : 0.15); }
  if (s.id === 'sun') return smear(norm([-0.35, 0.8, -0.5]), 0.25);   // electrons recoil away from the Sun
  return smear(norm([Math.random() - 0.5, 0.6 + Math.random(), Math.random() - 0.5]), 0.3);   // reactor positron: roughly isotropic
}
function makeEvent(f) {
  const e = eOf(st), r = 14.9 * Math.sqrt(Math.random()), a = Math.random() * 2 * Math.PI;
  const v = [r * Math.cos(a), r * Math.sin(a), (Math.random() * 2 - 1) * 16.1], d = eventDir();
  const q = new Float32Array(PMT.length);
  let kind, len = 0, exits = false, subs = [];
  if (e < 0.05) {   // few-MeV positron or electron: about six hits per MeV, spread round a faint ring, plus dark noise
    kind = 'low';
    const mev = SRC[st.src].id === 'sun' ? 4 + 5 * Math.random() : Math.max(1.5, e * 1000 - 0.8), want = Math.round(6 * mev);
    let got = 0, tries = 0;
    while (got < want && tries++ < 40000) { const i = Math.floor(Math.random() * PMT.length), w = Math.exp(-0.5 * ((angTo(PMT[i], v, d) - TH_C) / 0.32) ** 2); if (!q[i] && Math.random() < w) { q[i] = 0.6 + 0.6 * Math.random(); got++; } }
    len = 0.04;
  } else if (f === 1) {   // muon: a straight track; light from every point of it fills the ring out to a sharp outer edge
    kind = 'mu';
    const T = Math.max(0.05, 0.75 * e - 0.106), te = exitT(v, d); len = T / 0.22; if (len > te) { len = te; exits = true; }
    const end = [v[0] + len * d[0], v[1] + len * d[1], v[2] + len * d[2]];
    for (let i = 0; i < PMT.length; i++) { const av = angTo(PMT[i], v, d), ae = angTo(PMT[i], end, d); if (av <= TH_C + 0.012 && ae >= TH_C - 0.012) q[i] = (0.8 + 2.6 * Math.exp(-(TH_C - av) / 0.05)) * (0.75 + 0.5 * Math.random()); else if (Math.random() < 0.004) q[i] = 0.4; }
  } else {   // electron shower (fuzzy) or a tau's decay products (several rings)
    kind = f === 2 ? 'tau' : 'e';
    subs = f === 2 ? [0, 1, 2].map(k => ({ d: smear(d, 0.55), w: [1, 0.75, 0.5][k], s: 0.1 })) : [{ d, w: 1, s: 0.12 }];
    const Q = clamp(0.7 + e, 0.8, 2.2);
    for (let i = 0; i < PMT.length; i++) { let w = 0; for (const sb of subs) { const al = angTo(PMT[i], v, sb.d); w += sb.w * (Math.exp(-0.5 * ((al - TH_C) / sb.s) ** 2) + (al < TH_C ? 0.18 : 0)); }
      if (Math.random() < Math.min(0.95, w * 0.9)) q[i] = Q * w * (0.5 + Math.random()); else if (Math.random() < 0.006) q[i] = 0.4; }
    len = f === 2 ? 0.3 : 1.2 + e;
  }
  for (let k = 0; k < 6; k++) { const i = Math.floor(Math.random() * PMT.length); if (!q[i]) q[i] = 0.35; }   // dark-noise hits
  let nh = 0; for (let i = 0; i < q.length; i++) if (q[i] > 0) nh++;
  return { f, kind, v, d, len, exits, q, nh, subs, t: nowS(), n: tally.evn };
}

// ---- the plate: SVG drawn at the real pixel width, so text stays crisp and readable at any size ----
const PL = { svg: $('scene'), W: 0, H: 0, mode: '', key: '', box: {} };
const n1 = x => Math.round(x * 10) / 10;
const pth = (d, f, s, w, x) => `<path d="${d}" fill="${f || 'none'}"${s ? ` stroke="${s}" stroke-width="${w || 1}"` : ''}${x || ''}/>`;
const rct = (x, y, w, h, f, s, sw, x2) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${f || 'none'}"${s ? ` stroke="${s}" stroke-width="${sw || 1}"` : ''}${x2 || ''}/>`;
const cir = (cx, cy, r, f, s, sw, x2) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${f || 'none'}"${s ? ` stroke="${s}" stroke-width="${sw || 1}"` : ''}${x2 || ''}/>`;
const elp = (cx, cy, rx, ry, f, s, sw, x2) => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${f || 'none'}"${s ? ` stroke="${s}" stroke-width="${sw || 1}"` : ''}${x2 || ''}/>`;
const lin = (x1, y1, x2, y2, s, w, x3) => `<path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}" fill="none" stroke="${s || C.K}" stroke-width="${w || 1}"${x3 || ''}/>`;
const tx = (x, y, s, size, x2) => `<text x="${n1(x)}" y="${n1(y)}" font-size="${n1(size)}"${x2 && x2.includes('fill=') ? '' : ` fill="${C.K}"`}${x2 || ''}>${s}</text>`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// a numbered callout: a badge with a short leader to the part (sizes in screen px whatever the figure's scale s)
function badge(n, x, y, s, ax, ay) {
  const r = 7.5 / s; let o = '';
  if (ax != null) { const dx = ax - x, dy = ay - y, dd = Math.hypot(dx, dy) || 1; o += lin(x + dx / dd * r, y + dy / dd * r, ax, ay, C.K, 0.9) + cir(ax, ay, 1.5 / s, C.K); }
  return o + cir(x, y, r, C.P, C.K, 1) + tx(x, y, n, 9.5 / s, ` dy="0.36em" text-anchor="middle" font-weight="600"`);
}
// a cylinder's shading: hairlines crowding towards the shadowed right edge
function cylShade(x0, x1, y0, y1, w) { let o = ''; [0.55, 0.72, 0.84, 0.92, 0.97].forEach(t => { const x = x0 + (x1 - x0) * t; o += lin(x, y0, x, y1, C.B, w || 0.6); }); return o; }

const DEFS = `<defs>
<pattern id="pr" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M0 0V6" stroke="${C.L}" stroke-width="0.7"/></pattern>
<pattern id="pr2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)"><path d="M0 0V5" stroke="${C.B}" stroke-width="0.6"/></pattern>
<pattern id="pc" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0M-1 1L1 -1M4 6L6 4" stroke="${C.L}" stroke-width="0.6"/><circle cx="1.4" cy="1.6" r="0.55" fill="${C.B}"/></pattern>
<pattern id="ps" width="2.6" height="4" patternUnits="userSpaceOnUse"><path d="M0.6 0V4" stroke="${C.L}" stroke-width="0.55"/></pattern>
<pattern id="pd" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.5" fill="${C.L}"/><circle cx="3" cy="3" r="0.35" fill="${C.T}"/></pattern>
<pattern id="pw" width="9" height="4" patternUnits="userSpaceOnUse"><path d="M1 2h3.5" stroke="${C.T}" stroke-width="0.8"/></pattern>
<pattern id="be" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${C.P}"/><circle cx="1.25" cy="1.25" r="0.9" fill="${C.B}"/><circle cx="3.75" cy="3.75" r="0.9" fill="${C.B}"/></pattern>
<pattern id="bm" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3.5" height="3.5" fill="${C.T}"/><path d="M0 0V3.5" stroke="${C.K}" stroke-width="1.5"/></pattern>
<pattern id="bt" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${C.P}"/><path d="M0 1.5H6M0 4.5H6" stroke="${C.B}" stroke-width="0.9"/><path d="M1.5 0V6M4.5 0V6" stroke="${C.L}" stroke-width="0.7"/></pattern>
</defs>`;
const BANDF = ['url(#be)', 'url(#bm)', 'url(#bt)'];

// ---------- Fig. 1, the sources ----------
function figReactor(s) {   // a pressurized-water reactor, its containment cut open (natural size 400 x 300)
  const o = [], cx = 200, sp = 152;
  o.push(rct(0, 262, 400, 38, 'url(#pd)'), lin(0, 262, 400, 262, C.K, 1.2));
  // natural-draft cooling tower (a hyperboloid: waist two thirds of the way up), with its plume
  const hw = y => 28 * Math.sqrt(1 + ((y - 150) / 61.5) ** 2), tcx = 65;
  let L = '', R = '';
  for (let y = 116; y <= 262; y += 6) { L += (L ? 'L' : 'M') + n1(tcx - hw(y)) + ' ' + y; R = 'L' + n1(tcx + hw(y)) + ' ' + y + R; }
  o.push(pth(L + R.replace(/^L/, 'L') + 'Z', C.P, C.K, 1.2));
  [-0.85, -0.55, 0.3, 0.55, 0.72, 0.84, 0.92, 0.97].forEach(k => { let d = ''; for (let y = 117; y <= 258; y += 6) d += (d ? 'L' : 'M') + n1(tcx + hw(y) * k) + ' ' + y; o.push(pth(d, 0, k > 0 ? C.B : C.L, 0.6)); });
  o.push(elp(tcx, 116, hw(116), 3.5, C.P, C.K, 1));
  for (let x = tcx - hw(256) + 4; x < tcx + hw(256) - 2; x += 7) o.push(lin(x, 262, x + 3.5, 255, C.B, 0.7), lin(x + 3.5, 255, x + 7, 262, C.B, 0.7));
  ['M48 112C40 98 58 92 52 78C47 66 62 60 66 46', 'M62 110C58 96 74 90 72 76C70 64 84 58 90 48', 'M78 112C78 100 90 94 90 82C90 72 102 66 108 58', 'M40 108C30 98 40 88 34 76'].forEach((d, k) => o.push(pth(d, 0, k === 1 ? C.B : C.L, 0.8, ' stroke-dasharray="3 2.2"')));
  // turbine hall and the steam line from the containment
  o.push(rct(292, 206, 100, 56, C.P, C.K, 1.1), pth('M289 206L341 193L395 206', 0, C.K, 1.1));
  for (let x = 298; x < 388; x += 9) o.push(rct(x, 214, 5, 8, C.T, C.B, 0.6));
  o.push(rct(312, 236, 50, 20, 'url(#ps)', C.B, 0.7), cir(337, 246, 7, C.P, C.K, 0.8), lin(282, 224, 292, 224, C.K, 2.2));
  // basemat, the containment interior, then the cut wall + dome (prestressed concrete with a steel liner)
  o.push(rct(110, 262, 180, 14, 'url(#pc)', C.K, 1));
  o.push(pth(`M127 262V${sp}A73 63 0 0 1 273 ${sp}V262Z`, C.P));
  for (let y = 112; y < 262; y += 14) o.push(lin(128, y, 272, y, C.T, 0.5));
  o.push(pth(`M118 262V${sp}A82 72 0 0 1 282 ${sp}V262H273V${sp}A73 63 0 0 0 127 ${sp}V262Z`, 'url(#pc)', C.K, 1.2));
  o.push(pth(`M128.6 262V${sp}A71.4 61.4 0 0 1 271.4 ${sp}V262`, 0, C.K, 0.7));
  // operating floor, the primary shield round the vessel
  o.push(rct(128, 194, 144, 4, 'url(#pc)', C.K, 0.9), rct(175, 198, 10, 64, 'url(#pc)', C.K, 0.9), rct(215, 198, 10, 64, 'url(#pc)', C.K, 0.9));
  // steam generators (tall U-tube heat exchangers), left and right
  [150, 250].forEach(x => {
    o.push(pth(`M${x - 8} 246V170L${x - 11} 160V128A11 7 0 0 1 ${x + 11} 128V160L${x + 8} 170V246A8 6 0 0 1 ${x - 8} 246Z`, C.P, C.K, 1.1));
    o.push(cylShade(x - 8, x + 8, 171, 245), cylShade(x - 11, x + 11, 129, 159), lin(x - 11, 160, x + 11, 160, C.B, 0.6));
    for (let k = -5; k <= 5; k += 2.5) o.push(lin(x + k, 176, x + k, 236, C.L, 0.5));
  });
  // reactor coolant pumps, hot and cold legs
  o.push(lin(185, 230, 158, 230, C.K, 2.6), lin(185, 230, 158, 230, C.P, 1.1), lin(215, 230, 242, 230, C.K, 2.6), lin(215, 230, 242, 230, C.P, 1.1));
  o.push(rct(161, 238, 9, 12, C.P, C.K, 0.9), rct(162.5, 233, 6, 5, C.B), lin(170, 245, 189, 245, C.K, 2.2));
  o.push(rct(230, 238, 9, 12, C.P, C.K, 0.9), rct(231.5, 233, 6, 5, C.B), lin(230, 245, 211, 245, C.K, 2.2));
  // pressurizer
  o.push(pth('M221 147A5 5 0 0 1 231 147V187A5 5 0 0 1 221 187Z', C.P, C.K, 1), cylShade(221, 231, 147, 187, 0.5), pth('M226 192V206L236 214V230', 0, C.K, 0.8));
  // reactor pressure vessel, its control-rod drives, and the core (fuel assemblies) that glows
  o.push(rct(190, 183, 20, 3, C.B, C.K, 0.6));
  for (let x = 192.5; x <= 208; x += 3) o.push(lin(x, 186, x, 199, C.K, 0.8));
  o.push(pth('M189 206Q189 199 200 199Q211 199 211 206V250Q211 262 200 262Q189 262 189 250Z', 'url(#ps)', C.K, 1.2));
  o.push(`<rect class="core" x="192" y="226" width="16" height="24" fill="${C.O}" opacity="0.3"/>`);
  for (let x = 193.5; x <= 207; x += 2.6) o.push(lin(x, 227, x, 249, C.K, 0.7));
  // polar crane on its ring girder
  o.push(rct(129, 148, 142, 5, C.P, C.K, 0.9));
  let z = 'M130 152'; for (let x = 134; x <= 270; x += 4) z += `L${x} ${(x / 4) % 2 ? 149 : 152}`; o.push(pth(z, 0, C.B, 0.6));
  o.push(rct(194, 143, 12, 5, C.K), lin(200, 153, 200, 170, C.K, 0.8), pth('M200 170q-3 0-3 3q0 3 3 3', 0, C.K, 0.9));
  // antineutrinos leave the core in every direction (decoration; they animate while a note sounds)
  [-150, -118, -62, -30, 14, 40, 168].forEach(a => { const t = a * Math.PI / 180, c = Math.cos(t), sn_ = Math.sin(t), Lr = Math.min(168, c > 0 ? 196 / c : c < 0 ? -196 / c : 999, sn_ > 0 ? 58 / sn_ : sn_ < 0 ? -234 / sn_ : 999); o.push(lin(200 + 14 * c, 238 + 14 * sn_, 200 + Lr * c, 238 + Lr * sn_, C.B, 0.8, ' class="flow" stroke-dasharray="1.2 3.2"')); });
  o.push(tx(356, 140, 'ν̄e', 11 / s, ` font-style="italic" fill="${C.B}"`));
  o.push(badge(1, 141, 109, s), badge(2, 254, 150, s), badge(3, 150, 142, s), badge(4, 226, 122, s, 226, 152), badge(5, 166, 214, s, 190, 236), badge(6, 65, 196, s), badge(7, 341, 228, s));
  return { w: 400, h: 300, svg: o.join('') };
}
function figAccel(s) {   // a Fermilab NuMI-style beamline in section, with the target hall enlarged (natural size 400 x 300)
  const o = [], th = 9 * Math.PI / 180, ct = Math.cos(th), sn = Math.sin(th), O = [130, 98];
  const W = (x, y) => [O[0] + x * ct - y * sn, O[1] + x * sn + y * ct];
  o.push(rct(0, 40, 400, 44, 'url(#pd)'), rct(0, 84, 400, 216, 'url(#pr)'), lin(0, 84, 400, 84, C.L, 0.6, ' stroke-dasharray="5 3"'), lin(0, 40, 400, 40, C.K, 1.2));
  for (let x = 4; x < 400; x += 9) o.push(lin(x, 40, x + 2, 36.5, C.B, 0.6));
  o.push(tx(396, 80, 'glacial till', 8.5 / s, ` text-anchor="end" fill="${C.B}"`), tx(396, 294, 'dolomite rock', 8.5 / s, ` text-anchor="end" fill="${C.B}"`));
  // the Main Injector ring on the surface, and the proton line diving down towards the target hall
  o.push(elp(48, 33, 42, 6.5, 0, C.K, 1.2), elp(48, 33, 37, 4.6, 0, C.B, 0.6));
  const [tx0, ty0] = W(30, 0);
  const pl = `M86 36C98 52 ${n1(O[0] - 20 * ct)} ${n1(O[1] - 20 * sn)} ${O[0]} ${O[1]}L${n1(tx0)} ${n1(ty0)}`;
  o.push(pth(pl, 0, C.K, 2.6), pth(pl, 0, C.P, 1.1), pth(pl, 0, C.K, 1.6, ' class="flow pulse" pathLength="100" stroke-dasharray="5 105"'));
  [[100, 54], [111, 77]].forEach(([x, y]) => o.push(rct(x - 3.5, y - 3.5, 7, 7, C.B, C.K, 0.6)));
  // everything along the beam axis, in the beam's own frame
  const g = [];
  g.push(pth('M18 12V-14Q18 -26 41 -26Q64 -26 64 -14V12Z', C.P, C.K, 1.1));                    // the target hall cavern
  g.push(rct(22, -8, 40, 18, 'url(#pc)', C.K, 0.9), rct(22, -2.6, 40, 5.2, C.P));               // shielding pile, beam channel
  g.push(rct(25, -1.8, 1.6, 3.6, C.B), rct(28.5, -1, 6, 2, C.K), `<circle class="hitflash" cx="31.5" cy="0" r="3.2" fill="${C.O}" opacity="0"/>`);
  [[37, 46, 2.4], [49.5, 60, 2.6]].forEach(([a, b, h]) => g.push(rct(a, -h, b - a, 2 * h, C.P, C.K, 0.9), pth(`M${a} -0.5Q${(a + b) / 2} -${h - 0.6} ${b} -0.5M${a} 0.5Q${(a + b) / 2} ${h - 0.6} ${b} 0.5`, 0, C.B, 0.7)));
  g.push(lin(20, -21, 62, -21, C.B, 0.8), rct(36, -21, 6, 3, C.B));                               // crane rail and trolley
  g.push(rct(64, -8, 140, 16, 'url(#pc)', C.K, 0.9), rct(64, -3, 140, 6, 'url(#pd)', C.K, 0.9)); // decay pipe in its concrete
  [[86, -1], [128, 1], [168, -0.5]].forEach(([x, y]) => g.push(lin(x - 12, 0, x, y, C.K, 0.8), lin(x, y, x + 12, y + (y < 0 ? -1.6 : 1.6), C.B, 0.8, ' stroke-dasharray="2 1.5"'), lin(x, y, x + 14, y * 0.3, C.K, 0.6, ' stroke-dasharray="0.8 1.6"')));
  g.push(rct(204, -12, 13, 24, 'url(#pc)', C.K, 1), rct(206, -4, 9, 8, 'url(#ps)', C.K, 0.6));  // hadron absorber
  [221, 228, 235, 242].forEach((x, k) => g.push(rct(x, -6, 4, 12, C.P, C.K, 0.8), rct(x + 1, -1.5, 2, 3, k < 3 ? C.B : C.T)));   // muon alcoves
  g.push(lin(64, 0, 262, 0, C.K, 0.9, ' class="flow" stroke-dasharray="1.2 3.2"'), pth('M262 -2.6L268 0L262 2.6Z', C.K));
  g.push(cir(41, -6, 27, 0, C.K, 0.8, ' stroke-dasharray="3 2"'));                               // "detail A" ring round the hall
  o.push(`<g transform="translate(${O[0]} ${O[1]}) rotate(9)">${g.join('')}</g>`);
  o.push(tx(W(252, 13)[0], W(252, 13)[1] + 4, 'νμ', 11 / s, ` font-style="italic" fill="${C.K}"`));
  const [hx, hy] = W(41, -26);   // the surface building over the target hall, with its shaft
  o.push(rct(hx - 3.5, 40, 7, hy - 40, C.P, C.K, 0.8), rct(hx - 16, 24, 32, 16, C.P, C.K, 1), pth(`M${n1(hx - 18)} 24L${n1(hx)} 17L${n1(hx + 18)} 24`, 0, C.K, 1));
  // detail A: the target hall enlarged (baffle, segmented graphite target, two parabolic horns in their shielding)
  const ix = 8, iy = 196, iw = 270, ih = 98, ay = iy + 54;
  const [ax_, ay_] = W(41, 21);
  o.push(lin(ax_ - 8, ay_ - 2, ix + 150, iy, C.K, 0.8, ' stroke-dasharray="3 2"'));
  o.push(rct(ix, iy, iw, ih, C.P, C.K, 1.1), tx(ix + 6, iy + 12, 'DETAIL A · TARGET HALL, ENLARGED', 8.5 / s, ` letter-spacing="0.6" font-weight="600"`));
  o.push(rct(ix + 36, iy + 20, iw - 44, 16, 'url(#pc)', C.K, 0.8), rct(ix + 36, iy + ih - 12, iw - 44, 10, 'url(#pc)', C.K, 0.8));
  o.push(lin(ix + 6, ay, ix + iw - 4, ay, C.K, 0.6, ' stroke-dasharray="4 2 1 2"'), pth(`M${ix + 6} ${ay - 3}l9 3l-9 3Z`, C.K), tx(ix + 6, ay - 6, 'p 120 GeV', 8 / s));
  o.push(rct(ix + 40, ay - 7, 8, 14, 'url(#pc)', C.K, 0.8), rct(ix + 40, ay - 1.5, 8, 3, C.P));                                  // baffle
  o.push(rct(ix + 56, ay - 2.5, 52, 5, C.B, C.K, 0.8)); for (let x = ix + 60; x < ix + 108; x += 4) o.push(lin(x, ay - 2.5, x, ay + 2.5, C.P, 0.6));   // graphite segments
  o.push(`<rect class="hitflash" x="${ix + 54}" y="${ay - 5}" width="56" height="10" fill="${C.O}" opacity="0"/>`);
  [[ix + 120, ix + 182, 15, 1.4], [ix + 196, ix + 258, 19, 2.6]].forEach(([a, b, h, nk]) => {
    o.push(rct(a, ay - h, b - a, 2 * h, C.P, C.K, 1), pth(`M${a} ${ay - h + 3}Q${(a + b) / 2} ${ay - nk * 2 - 4} ${b} ${ay - h + 3}L${b} ${ay - h + 6}Q${(a + b) / 2} ${ay - nk} ${a} ${ay - h + 6}Z`, C.L, C.K, 0.7));
    o.push(pth(`M${a} ${ay + h - 3}Q${(a + b) / 2} ${ay + nk * 2 + 4} ${b} ${ay + h - 3}L${b} ${ay + h - 6}Q${(a + b) / 2} ${ay + nk} ${a} ${ay + h - 6}Z`, C.L, C.K, 0.7));
    o.push(rct((a + b) / 2 - 3, ay - h - 6, 6, 6, C.B, C.K, 0.6));   // stripline current feed
  });
  [[-1, 8], [1, 9], [-1, 13]].forEach(([sg, k]) => o.push(pth(`M${ix + 82} ${ay}Q${ix + 120} ${ay + sg * k} ${ix + 150} ${ay + sg * k * 0.7}T${ix + 262} ${ay + sg * 1.5}`, 0, C.K, 0.7, ' stroke-dasharray="2.5 1.5"')));
  o.push(tx(ix + 150, ay + 22, 'π⁺', 9 / s, ` font-style="italic" fill="${C.B}"`));
  const p = (x, y) => W(x, y);
  o.push(badge(1, 48, 33, s), badge(2, 97, 64, s, 104, 57), badge(3, ix + 82, iy + 76, s, ix + 82, ay + 2.5), badge(4, ix + 151, iy + 28, s, ix + 151, ay - 15), badge(5, ...p(134, 17), s, ...p(134, 3)), badge(6, ...p(210, 22), s, ...p(210, 12)), badge(7, ...p(240, -18), s, ...p(237, -6)));
  return { w: 400, h: 300, svg: o.join('') };
}
function figAtmo(s) {   // a cosmic-ray air shower over the Earth's surface, and the Earth cut through (natural 400 x 280)
  const o = [], gy = 244, km = y => gy - 6 * y;
  o.push(pth(`M0 ${gy}Q125 ${gy - 6} 250 ${gy}V280H0Z`, 'url(#pr)'), pth(`M0 ${gy}Q125 ${gy - 6} 250 ${gy}`, 0, C.K, 1.2));
  o.push(lin(16, km(40), 16, gy, C.K, 0.8));
  [10, 20, 30, 40].forEach(k => o.push(lin(16, km(k), 21, km(k), C.K, 0.8), lin(24, km(k), 236, km(k), C.T, 0.6, ' stroke-dasharray="3 4"'), tx(24, km(k) - 3, k + ' km', 8.5 / s, ` fill="${C.B}"`)));
  o.push(tx(236, km(12) - 3, s < 0.9 ? 'tropopause' : 'tropopause ~12 km', 8 / s, ` text-anchor="end" fill="${C.L}"`), lin(24, km(12), 236, km(12), C.L, 0.6, ' stroke-dasharray="1 3"'));
  const X0 = [126, km(17)];
  o.push(lin(117, 2, X0[0], X0[1] - 3, C.K, 1.8), pth(`M${X0[0] - 3.3} ${X0[1] - 10}L${X0[0]} ${X0[1] - 2}L${X0[0] + 2.4} ${X0[1] - 10.4}Z`, C.K));
  for (let k = 0; k < 10; k++) { const t = k / 10 * 2 * Math.PI; o.push(lin(X0[0] + 2 * Math.cos(t), X0[1] + 2 * Math.sin(t), X0[0] + 5.5 * Math.cos(t), X0[1] + 5.5 * Math.sin(t), C.K, 0.8)); }
  // the cascade: pi -> mu nu_mu, then mu -> e nu_e nu_mu; neutrinos (dotted) carry on into the ground
  const br = [[[106, 186], [98, 230]], [[150, 190], [161, 234]], [[134, 198], [139, 238]], [[90, 200], [80, 236]], [[168, 204], [184, 238]]];
  br.forEach(([a, b], k) => {
    o.push(lin(X0[0], X0[1], a[0], a[1], C.K, k < 2 ? 1.1 : 0.8));
    o.push(lin(a[0], a[1], b[0], b[1], C.B, 0.9, ' stroke-dasharray="3 2"'));
    o.push(lin(a[0], a[1], a[0] + (a[0] - X0[0]) * 2.3, 280, C.K, 0.7, ' class="flow" stroke-dasharray="1.2 3.2"'));
    o.push(lin(b[0], b[1], b[0] + (b[0] - a[0]) * 1.1, 280, C.B, 0.7, ' class="flow" stroke-dasharray="1.2 3.2"'), lin(b[0], b[1], b[0] - 5, b[1] + 6, C.B, 0.7));
    o.push(cir(a[0], a[1], 1.4, C.K), cir(b[0], b[1], 1.3, C.B));
  });
  [[-1, 0.9], [1, 0.7], [-0.3, 1.2]].forEach(([dx, sl], j) => {   // pi0 -> two photons -> electromagnetic sub-showers (e+ e- pairs)
    let x = X0[0], y = X0[1]; const pts = [];
    for (let k = 1; k <= 6; k++) { x += dx * 3 * sl + (k % 2 ? 2 : -2); y += 7; pts.push([x, y]); }
    o.push(pth('M' + X0.join(' ') + pts.map(q => 'L' + q.map(n1).join(' ')).join(''), 0, C.L, 0.7));
    pts.forEach((q, k) => { if (k % 2) o.push(lin(q[0], q[1], q[0] + (k % 4 ? 4 : -4), q[1] + 6, C.L, 0.6)); });
  });
  [[X0[0], X0[1], 70, 214], [X0[0], X0[1], 196, 222], [150, 190, 186, 226], [106, 186, 118, 226]].forEach(([a, b, c, d]) => o.push(lin(a, b, c, d, C.B, 0.6)));
  o.push(tx(108, 183, 'π', 10 / s, ` text-anchor="end" font-style="italic"`), tx(95, 222, 'μ', 10 / s, ` text-anchor="end" font-style="italic" fill="${C.B}"`), tx(103, 266, 'ν', 10 / s, ` text-anchor="end" font-style="italic"`));
  // the Earth, cut through: crust, mantle, liquid outer core, solid inner core (radii to scale)
  const ex = 326, ey = 150, er = 64;
  o.push(cir(ex, ey, er + 5, 0, C.L, 0.7, ' stroke-dasharray="2 2.5"'), cir(ex, ey, er, 'url(#pd)', C.K, 1.2), cir(ex, ey, er * 3480 / 6371, 'url(#pr2)', C.K, 0.8), cir(ex, ey, er * 1220 / 6371, 'url(#pc)', C.K, 0.8));
  o.push(cir(ex, ey, er - 1.6, 0, C.B, 0.5));
  o.push(lin(ex, ey - er, ex, ey + er, C.L, 0.7, ' stroke-dasharray="1 2.5"'), tx(ex + 4, ey + er + 14, '12,757 km from below', 8.5 / s, ` text-anchor="middle" fill="${C.B}"`));
  o.push(rct(ex - 3, ey - er - 3.5, 6, 7, C.K), tx(ex, ey - er - 10, 'detector', 8.5 / s, ` text-anchor="middle" fill="${C.B}"`));
  o.push('<g id="src-dyn"></g>');
  o.push(badge(1, 100, 34, s, 118, 30), badge(2, 152, 132, s, 128, 141), badge(3, 72, 176, s, 106, 186), badge(4, 66, 222, s, 98, 230), badge(5, ex + 26, ey + 30, s));
  return { w: 400, h: 280, svg: o.join(''), dyn: (s2) => atmoChord(ex, ey, er, s2) };
}
function atmoChord(ex, ey, er, s) {   // your current path: its zenith angle, drawn to scale through the Earth
  const L = leOf(st.u) * eOf(st), cz = cosZen(L), sz = Math.sqrt(1 - cz * cz), k = er / R_E;
  const D = [ex, ey - er], P = [D[0] + L * k * sz, D[1] - L * k * cz], A = [D[0] + 26 * sz, D[1] - 26 * cz];
  return lin(P[0], P[1], D[0], D[1], C.O, 1.6) + lin(A[0], A[1], D[0] + 6 * sz, D[1] - 6 * cz, C.K, 1.1) + cir(A[0], A[1], 2, C.K)
    + tx(D[0] - 6, D[1] - 22, `${Math.round(Math.acos(cz) * 180 / Math.PI)}° from overhead`, 8.5 / s, ` text-anchor="end"`);
}
function figSun(s) {   // the Sun cut open, and the Earth 1 AU away (not to scale) (natural 400 x 280)
  const o = [], cx = 140, cy = 140, R = 126, a0 = -38 * Math.PI / 180, a1 = 38 * Math.PI / 180, pt = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  o.push(cir(cx, cy, R, 'url(#pd)', C.K, 1.4));
  for (let r = R - 2.5; r > R * 0.82; r -= 2.6) o.push(cir(cx, cy, r, 0, C.L, 0.45));   // limb darkening, engraved
  [[62, 96, 3, 2.1], [69, 92, 1.8, 1.3], [57, 101, 1.4, 1], [66, 100, 1, 0.8], [104, 214, 2.4, 1.6], [109, 217, 1.2, 0.9]].forEach(([x, y, a, b]) => o.push(elp(x, y, a + 1.6, b + 1.2, C.T, C.B, 0.5), elp(x, y, a, b, C.K)));
  o.push(pth('M58 30Q52 4 74 6Q90 8 84 26', 0, C.O, 1, ' stroke-dasharray="2 1.6"'), pth('M30 196Q4 206 12 222', 0, C.O, 1, ' stroke-dasharray="2 1.6"'));
  // the cut-away wedge: core, radiative zone, convective zone, photosphere
  const [p0, p1] = [pt(R, a0), pt(R, a1)];
  o.push(pth(`M${cx} ${cy}L${n1(p0[0])} ${n1(p0[1])}A${R} ${R} 0 0 1 ${n1(p1[0])} ${n1(p1[1])}Z`, C.P, C.K, 1.2));
  const arc = r => { const [q0, q1] = [pt(r, a0), pt(r, a1)]; return `M${n1(q0[0])} ${n1(q0[1])}A${r} ${r} 0 0 1 ${n1(q1[0])} ${n1(q1[1])}`; };
  for (let r = 0.27 * R; r < 0.7 * R; r += 4) o.push(pth(arc(r), 0, C.T, 0.6));
  let rw = `M${n1(pt(0.25 * R, -0.1)[0])} ${n1(pt(0.25 * R, -0.1)[1])}`;
  for (let k = 1; k < 26; k++) { const r = 0.25 * R + k * 0.45 * R / 26, a = -0.1 + 0.33 * Math.sin(k * 1.9) * (k % 3 ? 1 : -0.6); const q = pt(r, a); rw += `L${n1(q[0])} ${n1(q[1])}`; }
  o.push(pth(rw, 0, C.B, 0.6));
  for (let k = 0; k < 5; k++) {   // convection cells: hot gas rises, cools at the surface and sinks again
    const a = a0 + (k + 0.5) * (a1 - a0) / 5, [qx, qy] = pt(0.845 * R, a), rr = 0.105 * R, sg = k % 2 ? 1 : -1;
    o.push(pth(`M${n1(qx + rr)} ${n1(qy)}A${n1(rr)} ${n1(rr)} 0 1 ${sg > 0 ? 1 : 0} ${n1(qx - rr * 0.5)} ${n1(qy - sg * rr * 0.866)}`, 0, C.B, 0.8, ` transform="rotate(${n1(a * 180 / Math.PI)} ${n1(qx)} ${n1(qy)})"`));
    const tx_ = qx + rr * Math.cos(a + sg * 2.1), ty_ = qy + rr * Math.sin(a + sg * 2.1), dx = -Math.sin(a + sg * 2.1) * sg, dy = Math.cos(a + sg * 2.1) * sg;
    o.push(pth(`M${n1(tx_ + 3.2 * dx)} ${n1(ty_ + 3.2 * dy)}L${n1(tx_ - 2 * dy)} ${n1(ty_ + 2 * dx)}L${n1(tx_ + 2 * dy)} ${n1(ty_ - 2 * dx)}Z`, C.B));
  }
  o.push(pth(arc(0.7 * R), 0, C.K, 0.9), pth(arc(R), 0, C.K, 2.2));
  o.push(pth(`M${cx} ${cy}L${n1(pt(0.25 * R, a0)[0])} ${n1(pt(0.25 * R, a0)[1])}A${0.25 * R} ${0.25 * R} 0 0 1 ${n1(pt(0.25 * R, a1)[0])} ${n1(pt(0.25 * R, a1)[1])}Z`, C.O, C.K, 0.9, ' class="core" opacity="0.4"'));
  o.push(cir(cx, cy, 0.25 * R, 0, C.K, 0.9, ' stroke-dasharray="2 2"'));
  // neutrinos fly straight out of the core, through everything, to the Earth
  [-0.09, 0, 0.09].forEach(a => o.push(lin(cx + 6 * Math.cos(a), cy + 6 * Math.sin(a), 312, cy + 172 * Math.sin(a), C.K, 0.8, ' class="flow" stroke-dasharray="1.2 3.2"')));
  o.push(lin(320, 128, 314, 152, C.K, 1), lin(326, 128, 320, 152, C.K, 1), lin(332, cy, 372, cy, C.K, 0.8, ' class="flow" stroke-dasharray="1.2 3.2"'));
  o.push(cir(381, cy, 6, 'url(#pd)', C.K, 1.1), cir(395, cy - 5, 1.6, C.L, C.K, 0.6), tx(381, cy + 22, 'Earth', 9 / s, ' text-anchor="middle"'), tx(352, cy - 14, '1 AU', 9 / s, ' text-anchor="middle"'));
  o.push(tx(300, cy - 8, 'νe', 11 / s, ` font-style="italic"`));
  o.push(badge(1, cx + 14, cy + 6, s), badge(2, ...pt(0.48 * R, -0.3), s), badge(3, ...pt(0.86 * R, 0.33), s), badge(4, 52, 120, s), badge(5, 381, cy - 26, s, 381, cy - 7));
  return { w: 400, h: 280, svg: o.join('') };
}
// ---------- Fig. 2, Super-Kamiokande cut away (natural 340 x 340); 1 m = 5.4 units ----------
const SK = { cx: 170, S: 5.4, R: 106, top: 100, bot: 323.6, e: 15 / 106 };
SK.cz = (SK.top + SK.bot) / 2;
const sk3 = (x, y, z) => [SK.cx + SK.S * x, SK.cz - SK.S * z - SK.S * SK.e * y];
function figDetector(s) {
  const o = [], { cx, R, top, bot, e } = SK, rid = SK.S * SKR, ry = e * R, iry = e * rid;
  // Mt. Ikeno and its rock; the cavern with a domed roof
  o.push(pth('M0 340V34L40 24L78 14L112 9L150 3L186 8L228 15L268 22L306 25L340 31V340Z', 'url(#pr)', C.K, 1.2));
  for (let k = 0; k < 9; k++) { const x = 16 + k * 37; o.push(lin(x, 30 - (k > 3 && k < 6 ? 16 : 6), x + 5, 30 - (k > 3 && k < 6 ? 12 : 2), C.B, 0.6)); }
  o.push(pth(`M48 340V104C48 48 292 48 292 104V340Z`, C.P, C.K, 1.2));
  o.push(lin(22, 30, 22, 58, C.K, 0.8), pth('M18 34L22 28L26 34', 0, C.K, 0.8), pth('M18 54L22 60L26 54', 0, C.K, 0.8), lin(17, 42, 27, 39, C.K, 0.8), lin(17, 46, 27, 43, C.K, 0.8), tx(29, 49, '1,000 m', 8.5 / s, ` fill="${C.K}"`));
  // inner back wall (water) between the cut edges, with its PMTs; the floor with its PMTs
  const [, ty] = sk3(0, 0, SKH), [, by] = sk3(0, 0, -SKH);
  o.push(pth(`M${cx - rid} ${n1(ty)}A${n1(rid)} ${n1(iry)} 0 0 1 ${cx + rid} ${n1(ty)}V${n1(by)}A${n1(rid)} ${n1(iry)} 0 0 1 ${cx - rid} ${n1(by)}Z`, C.T, 0, 0, ' opacity="0.55"'));
  let pm = '';
  PMT.forEach((p, i) => { if ((p.part === 0 && p.y >= 0) || (p.part === 2 && i % 2 === 0)) { const [x, y] = sk3(p.x, p.y, p.z), r = p.part === 2 ? 0.8 : 1.05; pm += `M${n1(x - r)} ${n1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; } });
  o.push(pth(pm, C.B), elp(cx, by, rid, iry, 0, C.K, 0.8));
  // the cut walls: steel tank, the outer-detector gap (water, outward-facing 20 cm PMTs), the inner-detector frame
  [[cx - R, cx - rid], [cx + rid, cx + R]].forEach(([a, b], k) => {
    o.push(rct(a, top, b - a, bot - top, 'url(#pw)'), lin(a, top, a, bot, C.K, 1.6), lin(b, top, b, bot, C.K, 1.1));
    for (let y = top + 10; y < bot - 4; y += 13) o.push(pth(k ? `M${n1(b + 1)} ${y - 2.2}a2.2 2.2 0 0 1 0 4.4Z` : `M${n1(a + (b - a) / 2 + 2)} ${y - 2.2}a2.2 2.2 0 0 0 0 4.4Z`, C.B));
  });
  o.push(pth(`M${cx - R} ${n1(bot)}A${R} ${n1(ry)} 0 0 0 ${cx + R} ${n1(bot)}`, 0, C.K, 1.4), rct(cx - R - 8, bot + ry + 0.5, 2 * R + 16, 3, 'url(#pc)', C.K, 0.6));
  // the lid, the four electronics huts on top
  o.push(elp(cx, top, R, ry, C.P, C.K, 1.4), elp(cx, top, rid, iry, 0, C.L, 0.7), pth(`M${cx - R} ${top}v4A${R} ${n1(ry)} 0 0 0 ${cx + R} ${top + 4}v-4`, 0, C.K, 1));
  [[-58, -4], [-20, -9], [20, -9], [58, -4]].forEach(([dx, dy]) => { const x = cx + dx, y = top + dy; o.push(pth(`M${x - 9} ${y}V${y - 9}L${x - 5} ${y - 12}H${x + 13}V${y - 3}L${x + 9} ${y}Z`, C.P, C.K, 0.9), lin(x - 9, y - 9, x + 9, y - 9, C.K, 0.6), lin(x + 9, y - 9, x + 13, y - 12, C.K, 0.6), lin(x + 9, y - 9, x + 9, y, C.K, 0.6), cylShade(x - 9, x + 9, y - 8, y - 1, 0.5)); });
  o.push('<g id="det-dyn"></g>');
  o.push(badge(1, 146, 30, s), badge(2, 274, 92, s, 280, 112), badge(3, cx - R - 14, 200, s, cx - R, 200), badge(4, cx - 22, sk3(0, SKR, 6)[1], s), badge(5, cx + R + 14, 238, s, cx + R - 7, 238), badge(6, cx + 20, top - 32, s, cx + 20, top - 18), badge(7, cx + 70, 286, s));
  return { w: 340, h: 340, svg: o.join('') };
}
// ---------- Fig. 3, the event display: the inner wall unrolled, top cap / barrel / bottom cap (natural 290 x 282) ----------
const ED = { s: 2.6, w: 290, h: 282 };
ED.bw = 2 * Math.PI * SKR * ED.s; ED.bh = 2 * SKH * ED.s; ED.cr = SKR * ED.s; ED.cx = ED.w / 2; ED.by = 2 * ED.cr + 4; ED.tcy = ED.by - ED.cr - 1; ED.bcy = ED.by + ED.bh + ED.cr + 1;
function edPos(p) {
  if (p.part === 0) { let du = Math.PI / 2 - p.a; while (du > Math.PI) du -= 2 * Math.PI; while (du < -Math.PI) du += 2 * Math.PI; return [ED.cx + du * SKR * ED.s, ED.by + (SKH - p.z) * ED.s]; }
  return p.part === 1 ? [ED.cx + p.x * ED.s, ED.tcy + p.y * ED.s] : [ED.cx + p.x * ED.s, ED.bcy - p.y * ED.s];
}
function figEvent(sc) {
  const o = [];
  o.push(rct(ED.cx - ED.bw / 2, ED.by, ED.bw, ED.bh, C.P, C.K, 1), cir(ED.cx, ED.tcy, ED.cr, C.P, C.K, 1), cir(ED.cx, ED.bcy, ED.cr, C.P, C.K, 1));
  let pm = ''; PMT.forEach(p => { const [x, y] = edPos(p); pm += `M${n1(x - 0.75)} ${n1(y)}h1.5`; });
  o.push(pth(pm, 0, C.L, n1(clamp(2.4 * (sc || 1), 0.8, 1.6))), '<g id="ed-dyn"></g>');
  return { w: ED.w, h: ED.h, svg: o.join('') };
}

// ---------- the key under the plate ----------
const KEY = {
  reactor: { t: 'A pressurized-water reactor, cut away', sh: 'Reactor, cut away', items: [
    'Containment: a prestressed-concrete cylinder and dome, about 40 to 50 m across and about 1 m thick, lined inside with steel plate.',
    'Polar crane, running on a ring girder round the base of the dome.',
    'Steam generators: hot reactor water, kept liquid, boils a second loop of water into steam.',
    'Pressurizer: heaters and sprays hold the reactor water at about 155 bar.',
    'Reactor vessel and core. Fission fragments beta-decay: about 6 ν̄e per fission, about 2&times;10<sup>20</sup> per second for each gigawatt of heat.',
    'Natural-draft cooling tower (many plants cool with sea or river water instead).',
    'Turbine hall: the steam drives the turbine and generator.'] },
  accel: { t: 'A Fermilab NuMI-style neutrino beamline, in section', sh: 'Beamline, in section', items: [
    'Main Injector: a ring that accelerates protons to 120 GeV.',
    'The proton line bends down 58 mrad (3.34&deg;) to aim through the Earth at the far detector; drawn steeper here.',
    'Target hall: a graphite target about 1 m long, buried in steel and concrete shielding.',
    'Two magnetic horns, pulsed at about 200 kA, focus the positive pions and kaons forward.',
    'Decay pipe, 675 m long and 2 m wide, filled with helium: π⁺ &rarr; μ⁺ νμ in flight.',
    'Hadron absorber: an aluminium core inside steel and concrete stops what has not decayed.',
    'Muon alcoves with monitors; about 240 m of dolomite then stops the muons. Only νμ go on: 1.04 km to the near detector, 735 km to the far one.'],
    note: 'T2K\'s beamline at J-PARC is built from the same parts (30 GeV protons, three horns, a ~100 m decay volume) and aims 2.5&deg; off-axis at Super-K, 295 km away.' },
  atmo: { t: 'A cosmic-ray air shower, and the Earth cut through', sh: 'Air shower', items: [
    'A primary cosmic ray, usually a proton, arrives from space.',
    'Its first collision with an oxygen or nitrogen nucleus, typically 15 to 20 km up.',
    'Pions and kaons decay in flight: π &rarr; μ νμ.',
    'Muons decay: μ &rarr; e νe νμ, so about two muon-type neutrinos arrive for each electron-type one.',
    'The Earth with its mantle, liquid outer core and solid inner core, to scale. Neutrinos from overhead travel about 15 km; from below they cross the whole planet, 12,757 km. The orange line is your path.'] },
  sun: { t: 'The Sun, cut away, and the Earth 1 AU away', sh: 'The Sun, cut away', items: [
    'Core, the inner fifth of the radius, about 15 million &deg;C: fusing hydrogen into helium makes νe. The rare <sup>8</sup>B branch gives the 5 to 15 MeV neutrinos Super-K sees.',
    'Radiative zone, out to about 70% of the radius: light takes over 100,000 years to cross it. Neutrinos fly straight out.',
    'Convective zone: hot gas rises and sinks in cells.',
    'Photosphere, the visible surface, about 5,500 &deg;C; the Sun\'s radius is 696,000 km.',
    'Earth, 1 AU = 149.6 million km away (147.1 to 152.1 over the year), not to scale: about 8.3 minutes for the neutrinos.'] },
};
const KEY_DET = ['Mt. Ikeno: 1,000 m of rock overhead cuts the cosmic-ray muons about 100,000-fold.', 'A cavern with a domed roof, deep in the Kamioka mine.',
  'Stainless-steel tank, 39.3 m wide and 41.4 m tall, holding 50,000 t of ultrapure water.', 'Inner detector: 11,129 PMTs of 50 cm (20 in) looking inward, covering 40% of the wall (drawn at about one in four).',
  'Outer detector: 1,885 PMTs of 20 cm (8 in) looking outward, a veto behind black sheet.', 'Four electronics huts on the tank top.',
  'A charged lepton faster than light in water throws a cone of Cherenkov light (about 42&deg;) that prints a ring on the wall.'];
function plateKey() {
  const s = SRC[srcIdx(st)], k = KEY[s.id], li = a => `<ol>${a.map((x, i) => `<li><i>${i + 1}</i><span>${x}</span></li>`).join('')}</ol>`;
  if (PL.keyOpen == null) PL.keyOpen = !(window.matchMedia && window.matchMedia('(max-width: 560px)').matches);
  $('plate-key').innerHTML = `<details id="pk"${PL.keyOpen ? ' open' : ''}><summary>Key to the plate <b>&middot; every numbered part, named</b></summary><div class="pk-grid"><div><h4>Fig. 1 &middot; ${k.t}</h4>${li(k.items)}</div><div><h4>Fig. 2 &middot; Super-Kamiokande, cut away</h4>${li(KEY_DET)}`
    + `<h4 style="margin-top:.7rem">Fig. 3 &middot; Event display</h4><p style="margin:0">The inner wall unrolled: top cap, barrel, bottom cap; each dot a PMT, lit ones sized by the light they caught. Sharp outer edge: muon-like. Fuzzy edge: electron-like. Several rings: a tau decaying.</p></div>`
    + `<p class="note">${k.note ? k.note + ' ' : ''}Original ink drawings made from published descriptions (see Credits); not to scale. Numbers on the plate come only from the curves on this page; ring shapes are an illustration, not a detector simulation.</p></div></details>`;
  $('pk').addEventListener('toggle', () => { PL.keyOpen = $('pk').open; });
}

// ---------- layout: three figures over the journey (wide), or stacked (narrow) ----------
function plate() {
  const W = Math.round(($('scenewrap').getBoundingClientRect().width || 0));
  if (W < 200) return;
  const s = SRC[srcIdx(st)], key = W + ':' + s.id + ':' + st.ei;
  if (key === PL.key) { plateDyn(); return; }
  PL.key = key; PL.W = W;
  const mode = W >= 860 ? 'wide' : W >= 560 ? 'mid' : 'narrow', pad = mode === 'narrow' ? 8 : 14, cap = 22;
  const F = { reactor: figReactor, accel: figAccel, atmo: figAtmo, sun: figSun }[s.id];
  const boxes = [];
  let y = 0;
  if (mode === 'wide') {
    const h = Math.round(clamp(W * 0.3, 300, 372)), w1 = W * 0.375, w2 = W * 0.335;
    boxes.push({ id: 'src', x: pad, y, w: w1 - pad, h }, { id: 'det', x: w1 + 8, y, w: w2 - 8, h }, { id: 'ed', x: w1 + w2 + 8, y, w: W - w1 - w2 - 8 - pad, h });
    y += h + 8;
  } else if (mode === 'mid') {
    const h = Math.round(W * 0.46);
    boxes.push({ id: 'src', x: pad, y, w: W * 0.56 - pad, h }, { id: 'det', x: W * 0.56 + 6, y, w: W * 0.44 - 6 - pad, h });
    y += h + 8;
  } else {
    const h = Math.round((W - 2 * pad) * 0.78) + cap;
    boxes.push({ id: 'src', x: pad, y, w: W - 2 * pad, h }); y += h + 6;
  }
  const J = { x: pad, y, w: W - 2 * pad, h: mode === 'narrow' ? 228 : 200 }; y += J.h + 8;
  if (mode === 'mid') { const h = Math.round(W * 0.42); boxes.push({ id: 'ed', x: W * 0.28, y, w: W * 0.44, h }); y += h + 6; }
  if (mode === 'narrow') { const h = Math.round((W - 2 * pad) / 2 * 1.14) + cap + 18; boxes.push({ id: 'det', x: pad, y, w: (W - 2 * pad) / 2 - 3, h }, { id: 'ed', x: W / 2 + 3, y, w: (W - 2 * pad) / 2 - 3, h }); y += h + 6; }
  const H = y + 4;
  PL.W = W; PL.H = H; PL.mode = mode; PL.J = J; PL.box = {};
  const caps = { src: [`Fig. 1 · ${KEY[s.id].t}`, `Fig. 1 · ${KEY[s.id].sh}`, 'Fig. 1'], det: ['Fig. 2 · Super-Kamiokande, cut away', 'Fig. 2 · Super-Kamiokande', 'Fig. 2 · Super-K'], ed: ['Fig. 3 · Event display, wall unrolled', 'Fig. 3 · Event display', 'Fig. 3 · Events'] };
  const fitCap = (a, w) => a.find(c => c.length * 7.1 <= w - 4) || a[a.length - 1];
  const out = [DEFS, rct(0, 0, W, H, C.W)];
  boxes.forEach(b => {
    const fig = b.id === 'src' ? F(1) : b.id === 'det' ? figDetector(1) : figEvent();
    const bh = b.h - cap - (b.id === 'ed' || (mode === 'narrow' && b.id === 'det') ? 18 : 0), sc = Math.min(b.w / fig.w, bh / fig.h);
    const fx = b.x + (b.w - fig.w * sc) / 2, fy = b.y + cap + (bh - fig.h * sc) / 2;
    const f2 = b.id === 'src' ? F(sc) : b.id === 'det' ? figDetector(sc) : figEvent(sc);   // redraw with badge sizes for this scale
    PL.box[b.id] = { ...b, sc, fx, fy, fig: f2 };
    const ct = fitCap(caps[b.id], b.w).toUpperCase();
    out.push(tx(b.x + 2, b.y + 13, esc(ct), 10, ` letter-spacing="1.1" font-weight="500"`), lin(b.x, b.y + cap - 4, b.x + b.w, b.y + cap - 4, C.T, 1));
    out.push(`<g class="art" transform="translate(${n1(fx)} ${n1(fy)}) scale(${sc.toFixed(4)})"${b.id === 'det' || b.id === 'ed' ? ' data-pick="det"' : ''}>${f2.svg}</g>`);
    if (b.id === 'det' || b.id === 'ed') out.push(`<rect data-pick="det" x="${n1(b.x)}" y="${n1(b.y + cap)}" width="${n1(b.w)}" height="${n1(b.h - cap)}" fill="transparent"/>`);
    if (b.id === 'ed') out.push(`<text id="ed-cap" x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h - 6)}" font-size="10" text-anchor="middle" fill="${C.B}"></text>`);
    if (b.id === 'det' && mode === 'narrow') out.push(`<text x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h - 6)}" font-size="10" text-anchor="middle" fill="${C.B}">tap to detect</text>`);
  });
  // the journey strip: static axis, ticks and landmarks; bands and the marker are drawn by plateDyn()
  out.push(journeyStatic(J), `<g id="j-dyn"></g>`, `<rect data-pick="road" x="${J.x}" y="${J.y + 22}" width="${J.w}" height="${J.h - 22}" fill="transparent"/>`);
  PL.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  PL.svg.setAttribute('height', H);
  PL.svg.innerHTML = out.join('');
  // the source figure's data-bound overlay (the atmospheric path) sits inside the figure's transform
  const sb = PL.box.src; if (sb && sb.fig.dyn) { const g = PL.svg.querySelector('#src-dyn'); if (g) g.setAttribute('data-sc', sb.sc); }
  light(); plateKey(); plateDyn(); drawEvent();
}
// journey axis geometry
function jAxis() {
  const s = SRC[srcIdx(st)], J = PL.J, x0 = J.x + (PL.mode === 'narrow' ? 34 : 50), x1 = J.x + J.w - 14;
  let l0, l1; if (s.fixed) { l0 = 3e5; l1 = 2.4e8; } else { const r = rangeL(srcIdx(st), st.ei); l0 = r[0]; l1 = r[1]; }
  const yb = J.y + (PL.mode === 'narrow' ? 152 : 142), bh = PL.mode === 'narrow' ? 78 : 82;
  return { x0, x1, l0, l1, yb, bh, xOf: L => x0 + (x1 - x0) * clamp((Math.log10(L) - Math.log10(l0)) / (Math.log10(l1) - Math.log10(l0)), 0, 1), LOf: x => Math.pow(10, Math.log10(l0) + clamp((x - x0) / (x1 - x0), 0, 1) * (Math.log10(l1) - Math.log10(l0))) };
}
function pack(items, x0, x1, gap) {   // place labels left to right with no overlaps, each as near its anchor as it can
  items.sort((p, q) => p.x - q.x);
  items.forEach(it => { it.l = it.x - it.w / 2; });
  for (let i = 0; i < items.length; i++) { items[i].l = clamp(items[i].l, x0, x1 - items[i].w); if (i) items[i].l = Math.max(items[i].l, items[i - 1].l + items[i - 1].w + gap); }
  for (let i = items.length - 1; i >= 0; i--) { if (i === items.length - 1) items[i].l = Math.min(items[i].l, x1 - items[i].w); else items[i].l = Math.min(items[i].l, items[i + 1].l - gap - items[i].w); }
  return items;
}
const textW = (s, size) => s.length * size * 0.6;   // IBM Plex Mono advance is 0.6 em
function journeyStatic(J) {
  const s = SRC[srcIdx(st)], A = jAxis(), o = [], nar = PL.mode === 'narrow';
  o.push(tx(J.x + 2, J.y + 13, nar ? 'FIG. 4 · THE JOURNEY, DISTANCE L' : 'FIG. 4 · THE JOURNEY: DISTANCE L FROM THE SOURCE (LOG SCALE)', 10, ` letter-spacing="1.1" font-weight="500"`), lin(J.x, J.y + 18, J.x + J.w, J.y + 18, C.T, 1));
  // the source at the left, a break in the axis (a log scale never reaches zero)
  const sy = A.yb, gx = J.x + (nar ? 12 : 18);
  const glyph = { reactor: `M${gx - 9} ${sy}V${sy - 11}A9 9 0 0 1 ${gx + 9} ${sy - 11}V${sy}Z`, accel: `M${gx - 10} ${sy - 3}h14l6 -3v6l-6 -3`, atmo: `M${gx - 8} ${sy - 22}L${gx} ${sy - 10}L${gx + 7} ${sy - 18}M${gx} ${sy - 10}V${sy - 2}`, sun: '' }[s.id];
  if (s.id === 'sun') o.push(cir(gx, sy - 9, 8, C.O, C.K, 1, ' opacity="0.8"'));
  else o.push(pth(glyph, s.id === 'reactor' ? 'url(#pc)' : 0, C.K, 1.1));
  o.push(lin(gx + 12, sy, A.x0 - 8, sy, C.K, 1.2), lin(A.x0 - 9, sy + 4, A.x0 - 5, sy - 4, C.K, 1), lin(A.x0 - 5, sy + 4, A.x0 - 1, sy - 4, C.K, 1), lin(A.x0, sy, A.x1, sy, C.K, 1.2));
  // decade ticks
  const ticks = [];
  for (let d = Math.ceil(Math.log10(A.l0) - 1e-9); d <= Math.log10(A.l1) + 1e-9; d++) {
    const L = Math.pow(10, d), x = A.xOf(L); o.push(lin(x, sy, x, sy + 5, C.K, 1));
    const lab = L >= 1e6 ? (L / 1e6) + 'M km' : (L < 1 ? L : fmt(L)) + ' km'; ticks.push({ x, w: textW(lab, 9.5), s: lab });
    for (let k = 2; k < 10; k++) { const xm = A.xOf(L * k); if (L * k < A.l1 && L * k > A.l0) o.push(lin(xm, sy, xm, sy + 2.5, C.B, 0.7)); }
  }
  pack(ticks, A.x0 - 20, A.x1 + 12, 8).forEach(it => o.push(tx(it.l, sy + 17, it.s, 9.5, ` fill="${C.B}"`)));
  // landmarks: real baselines
  const marks = MARKS[s.id].filter(m => m[0] >= A.l0 * 0.999 && m[0] <= A.l1 * 1.001).map(m => ({ x: A.xOf(m[0]), s: nar ? m[2] : m[1] }));
  marks.forEach(m => o.push(pth(`M${n1(m.x)} ${sy - 1}l-3.5 -6h7Z`, C.K), lin(m.x, sy, m.x, sy + 22, C.K, 0.7, ' stroke-dasharray="1.5 1.5"')));
  pack(marks.map(m => ({ ...m, w: textW(m.s, 10) })), A.x0 - 30, A.x1 + 12, 10).forEach(it => o.push(tx(it.l, sy + 33, esc(it.s), 10, ' font-weight="600"')));
  return o.join('');
}
// ---- data-bound layers: the flavour bands along the journey, the marker, notes in flight, the atmospheric path ----
function plateDyn() {
  if (!PL.J) return;
  const g = PL.svg.querySelector('#j-dyn'); if (!g) return;
  const s = SRC[srcIdx(st)], A = jAxis(), J = PL.J, e = eOf(st), o = [], nar = PL.mode === 'narrow';
  const top = A.yb - A.bh, unit = A.bh / 1.16;   // sum P = 1 sits at unit; measured curves may over-fill up to 1.16
  const n = Math.max(60, Math.round((A.x1 - A.x0) / 2)), xs = [], cum = [[], [], [], []];
  for (let i = 0; i <= n; i++) {
    const x = A.x0 + (A.x1 - A.x0) * i / n, L = A.LOf(x), u = s.fixed ? U1 : clamp(uOf(L / e), U0, U1);
    const P = probsAt(u); xs.push(x); cum[0].push(0); cum[1].push(P[0]); cum[2].push(P[0] + P[1]); cum[3].push(Math.min(1.16, P[0] + P[1] + P[2]));
  }
  const yv = v => A.yb - unit * v;
  for (let f = 0; f < 3; f++) {
    if (st.model === 2 && f === 2 && !eBorn()) continue;
    let d = ''; for (let i = 0; i <= n; i++) d += (i ? 'L' : 'M') + n1(xs[i]) + ' ' + n1(yv(cum[f + 1][i]));
    for (let i = n; i >= 0; i--) d += 'L' + n1(xs[i]) + ' ' + n1(yv(cum[f][i]));
    o.push(pth(d + 'Z', BANDF[f], C.K, 0.6));
  }
  o.push(lin(A.x0, yv(1), A.x1, yv(1), C.K, 1, ' stroke-dasharray="4 3"'), rct(A.x1 - 50, yv(1) - 15, 50, 12, C.P), tx(A.x1 - 2, yv(1) - 5, 'ΣP = 1', 9.5, ` text-anchor="end" fill="${C.B}"`));
  // band names where they have room, at the left end
  [0, 1, 2].forEach(f => { const mid = (cum[f][0] + cum[f + 1][0]) / 2, hgt = (cum[f + 1][0] - cum[f][0]) * unit; if (hgt > 13) { const lab = nm(f); o.push(rct(A.x0 + 3, yv(mid) - 7, textW(lab, 10.5) + 6, 13, C.P, C.K, 0.6), tx(A.x0 + 6, yv(mid) + 3.5, lab, 10.5, ' font-weight="600"')); } });
  if (s.fixed) { const fa = nar ? 'fully averaged' : 'fully averaged: oscillation length ≪ distance', fw = textW(fa, 9.5) + 8, fx = A.x0 + (A.x1 - A.x0) * 0.3; o.push(rct(fx, yv(0.62) - 9, fw, 13, C.P, C.K, 0.6), tx(fx + 4, yv(0.62) + 1, fa, 9.5, ` fill="${C.K}"`)); }
  // notes in flight: each held note's own distance (FLIGHT knob)
  if (ctx && !s.fixed) voices.filter(v => !v.rel).forEach(v => { const x = A.xOf(leOf(voiceU(v)) * e); o.push(lin(x, top, x, A.yb, C.K, 1.6, ' opacity="0.55"'), pth(`M${n1(x)} ${n1(top - 1)}l-3 -5h6Z`, C.K)); });
  // the marker: your detector's distance, and what arrives there
  const L = s.fixed ? s.fixed : leOf(st.u) * e, x = A.xOf(L), P = probsAt(st.u), tot = (P[0] + P[1] + P[2]) || 1;
  o.push(lin(x, top - 6, x, A.yb + 7, C.K, 2), cir(x, A.yb, 7.5, C.K), cir(x, A.yb, 3, C.P));
  const lab = `L ${fmtL(L)} km`, sub = [0, 1, 2].filter(f => !(st.model === 2 && f === 2 && !eBorn())).map(f => `${LEP[f]} ${Math.round(100 * P[f] / tot)}%`).join(' · ');
  const bw = Math.max(textW(lab, 11), textW(sub, 9.5)) + 12, bx = clamp(x - bw / 2, J.x, J.x + J.w - bw);
  o.push(rct(bx, top - 36, bw, 30, C.K), tx(bx + 6, top - 23, lab, 11, ` font-weight="600" fill="${C.P}"`), tx(bx + 6, top - 10, sub, 9.5, ` fill="${C.P}"`));
  // the header readout: L/E and what the path means
  const le = s.fixed ? Math.pow(10, U1) : leOf(st.u);
  const extra = s.id === 'atmo' ? `${Math.round(Math.acos(cosZen(L)) * 180 / Math.PI)}° from overhead` : s.fixed ? 'L/E far beyond the curves' : L > 60 ? `straight path dips ${chordDepth(L) < 10 ? chordDepth(L).toFixed(1) : Math.round(chordDepth(L))} km below ground` : '';
  const hdr = `E ${fmtE(e)} · L/E ${s.fixed ? '~10¹⁰' : fmt(le)} km/GeV` + (extra && !nar ? ' · ' + extra : '');
  if (nar) o.push(tx(J.x + 2, J.y + 31, hdr, 10, ` fill="${C.B}"`)); else o.push(tx(J.x + J.w - 2, J.y + 13, hdr, 10, ` text-anchor="end" fill="${C.B}"`));
  if (nar && extra) o.push(tx(J.x + J.w - 2, J.y + J.h - 4, extra, 9.5, ` text-anchor="end" fill="${C.B}"`));
  if (eBorn()) o.push(tx(J.x + 2, J.y + J.h - (nar && extra ? 18 : 4), nar ? 'classical curves (no chip measured νe)' : 'classical curves: no chip measured electron-born neutrinos', 9.5, ` fill="${C.O}"`));
  g.innerHTML = o.join('');
  // the atmospheric path through the Earth
  const sb = PL.box.src, sg = PL.svg.querySelector('#src-dyn');
  if (sb && sg && sb.fig.dyn) sg.innerHTML = sb.fig.dyn(sb.sc);
  const wrap = $('scenewrap'); if (wrap) wrap.setAttribute('aria-label', `Distance ${fmtL(L)} km; ${sub}`);
}
// ---- the event on the plate: hits on the unrolled wall (Fig. 3) and on the visible back wall and floor (Fig. 2) ----
function drawEvent() {
  const g1 = PL.svg.querySelector('#ed-dyn'), g2 = PL.svg.querySelector('#det-dyn'), cap = PL.svg.querySelector('#ed-cap');
  if (!g1 || !g2) return;
  const E = ev.cur, sd = PL.box.det ? PL.box.det.sc : 1, se = PL.box.ed ? PL.box.ed.sc : 1;
  const two = (a, b) => rct(ED.cx - 80, ED.by + ED.bh / 2 - 22 / se, 160, 34 / se, C.P) + tx(ED.cx, ED.by + ED.bh / 2 - 4 / se, a, 10.5 / se, ` text-anchor="middle" font-weight="600"`) + tx(ED.cx, ED.by + ED.bh / 2 + 9 / se, b, 9.5 / se, ` text-anchor="middle" fill="${C.B}"`);
  const nar = PL.mode === 'narrow';
  if (!E) { g1.innerHTML = two('no event yet', nar ? 'tap to detect' : 'click to detect one'); g2.innerHTML = ''; if (cap) cap.textContent = nar ? 'wall unrolled' : 'the inner wall, unrolled'; return; }
  if (E.miss) {
    g1.innerHTML = two('no ring', 'below threshold');
    g2.innerHTML = ''; if (cap) cap.textContent = `${nm(E.f)} · missing event`; return;
  }
  const r = q => n1(0.7 + 0.75 * Math.sqrt(Math.min(q, 5)));
  let a = '', b = '';
  for (let i = 0; i < PMT.length; i++) { const q = E.q[i]; if (!q) continue; const p = PMT[i], [x, y] = edPos(p); a += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${r(q)}"/>`;
    if ((p.part === 0 && p.y >= 0) || p.part === 2) { const [X, Y] = sk3(p.x, p.y, p.z); b += `<circle cx="${n1(X)}" cy="${n1(Y)}" r="${n1(+r(q) * 1.2)}"/>`; } }
  const fl = REDUCED ? '' : ' class="flash"';
  g1.innerHTML = `<g fill="${C.O}"${fl}>${a}</g>`;
  // in the cut-away: the incoming neutrino (dotted), the vertex, the lepton's track
  const v = E.v, d = E.d, inc = [v[0] - 40 * d[0], v[1] - 40 * d[1], v[2] - 40 * d[2]], t0 = exitT(v, [-d[0], -d[1], -d[2]]);
  const pin = sk3(v[0] - t0 * d[0], v[1] - t0 * d[1], v[2] - t0 * d[2]), pv = sk3(...v), pe = sk3(v[0] + E.len * d[0], v[1] + E.len * d[1], v[2] + E.len * d[2]);
  let tr = lin(pin[0], pin[1], pv[0], pv[1], C.K, 1, ' stroke-dasharray="1.5 2.5"') + cir(pv[0], pv[1], 2.2 / sd, C.K);
  if (E.kind === 'tau') E.subs.forEach(sb => { const q = sk3(v[0] + 2.5 * sb.d[0], v[1] + 2.5 * sb.d[1], v[2] + 2.5 * sb.d[2]); tr += lin(pv[0], pv[1], q[0], q[1], C.K, 1.4); });
  else tr += lin(pv[0], pv[1], pe[0], pe[1], C.K, E.kind === 'mu' ? 2 : 1.4);
  void inc;
  g2.innerHTML = `<g fill="${C.O}"${fl}>${b}</g>` + tr;
  const kindTxt = { low: `${E.nh} tubes · faint ring`, mu: `μ-like · sharp ring${E.exits ? ', exits' : ''} · ${E.nh} tubes`, e: `e-like · fuzzy ring · ${E.nh} tubes`, tau: `several rings · ${E.nh} tubes` }[E.kind];
  if (cap) cap.textContent = nar ? `${nm(E.f)} → ${{ low: 'faint ring', mu: 'μ-like', e: 'e-like', tau: 'τ: rings' }[E.kind]} · ${E.nh} lit` : `event ${E.n} · ${nm(E.f)} → ${kindTxt}`;
}

// ---- pointer and keys on the plate: drag along the journey; click the detector to detect one neutrino ----
function svgPt(e) { const r = PL.svg.getBoundingClientRect(); return { x: (e.clientX - r.left) * (PL.W / r.width), y: (e.clientY - r.top) * (PL.H / (r.height || 1)) }; }
const scH = { drag: false, hold: false };
function moveTo(u) { if (Math.abs(u - st.u) < 1e-6) return; st.u = u; dirty = true; ui(); }
function uFromX(x) { const A = jAxis(), r = srcRange(srcIdx(st), st.ei); return clamp(uOf(A.LOf(x) / eOf(st)), r[0], r[1]); }
const pickAt = e => { const t = e.target && e.target.closest ? e.target.closest('[data-pick]') : null; return t ? t.getAttribute('data-pick') : ''; };
PL.svg.addEventListener('pointerdown', e => {
  const k = pickAt(e); if (!k) return;
  try { PL.svg.setPointerCapture(e.pointerId); } catch (_) {}
  if (k === 'det') { scH.hold = true; noteOn(57); return; }
  if (SRC[srcIdx(st)].fixed) { toast('The Sun is fixed at 1 AU (147.1 to 152.1 million km over the year)'); return; }
  scH.drag = true; moveTo(uFromX(svgPt(e).x));
});
PL.svg.addEventListener('pointermove', e => {
  if (scH.drag) { moveTo(uFromX(svgPt(e).x)); return; }
  const k = pickAt(e); PL.svg.classList.toggle('on-road', k === 'road' && !SRC[srcIdx(st)].fixed); PL.svg.classList.toggle('on-det', k === 'det');
});
const scUp = () => { if (scH.hold) { scH.hold = false; noteOff(57); } scH.drag = false; };
PL.svg.addEventListener('pointerup', scUp); PL.svg.addEventListener('pointercancel', scUp);
PL.svg.addEventListener('keydown', e => {
  const r = srcRange(srcIdx(st), st.ei), step = (r[1] - r[0]) * (e.shiftKey ? 0.1 : 0.01);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); moveTo(clamp(st.u - step, r[0], r[1])); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); moveTo(clamp(st.u + step, r[0], r[1])); }
  else if (e.key === 'Home') { e.preventDefault(); moveTo(r[0]); } else if (e.key === 'End') { e.preventDefault(); moveTo(r[1]); }
  else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); scH.hold = true; noteOn(57); }
});
PL.svg.addEventListener('keyup', e => { if ((e.key === 'Enter' || e.key === ' ') && scH.hold) { scH.hold = false; noteOff(57); } });

// ---- The data section: the measured curves you can drag, always drawn (graph G1 of the earlier page) ----
const cv = $('plot'), g2 = cv.getContext('2d');
function size() { const r = cv.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, window.devicePixelRatio || 1); const w = Math.round(r.width * d), h = Math.round(r.height * d); if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; } drawPlot(); }
let rsT = 0;
const onResize = () => { clearTimeout(rsT); rsT = setTimeout(() => { size(); plate(); }, 60); };
addEventListener('resize', onResize);
if (window.ResizeObserver) { const ro = new ResizeObserver(onResize); ro.observe($('scenewrap')); ro.observe(cv); }
// redraw the curves only while they are on screen; a change made off screen is drawn when they scroll back in
let plotSeen = true;
if (window.IntersectionObserver) new IntersectionObserver(es => es.forEach(e => { plotSeen = e.isIntersecting; if (plotSeen) dirty = true; })).observe(cv);
function geom() { const d = cv.width / cv.getBoundingClientRect().width || 1; return { d, x0: 34 * d, x1: cv.width - 10 * d, y0: 12 * d, y1: cv.height - 22 * d }; }
const xOfU = (G, u) => G.x0 + (G.x1 - G.x0) * (u - U0) / (U1 - U0);
function curveVal(P, f, i) { if (st.model === 3) return P[f + 1][i]; if (f === 0) return P[0][i]; if (f === 1) return 1 - P[0][i]; return 0; }
function drawPlot() {
  if (!cv.width) return;
  const G = geom(), d = G.d, m = D.machines[st.chip], eb = eBorn(), s = SRC[srcIdx(st)];
  g2.fillStyle = TOK.panel; g2.fillRect(0, 0, cv.width, cv.height);
  g2.font = `500 ${11 * d}px IBM Plex Mono, monospace`; g2.textBaseline = 'middle';
  g2.fillStyle = TOK.rule; g2.fillRect(G.x0, G.y0, G.x1 - G.x0, d); g2.fillRect(G.x0, G.y1, G.x1 - G.x0, d); g2.fillRect(G.x0, G.y0, d, G.y1 - G.y0);
  const R = srcRange(srcIdx(st), st.ei); g2.fillStyle = TOK.rule; g2.globalAlpha = 0.45; g2.fillRect(xOfU(G, R[0]), G.y1 - 4 * d, Math.max(2 * d, xOfU(G, R[1]) - xOfU(G, R[0])), 4 * d); g2.globalAlpha = 1;
  for (let k = 2; k <= 4; k++) { const x = xOfU(G, k); g2.fillStyle = TOK.rule; g2.fillRect(x, G.y0, d, G.y1 - G.y0); g2.fillStyle = TOK.ink2; g2.textAlign = 'center'; g2.fillText(fmt(10 ** k), x, G.y1 + 11 * d); }
  g2.textAlign = 'right'; g2.fillStyle = TOK.ink2; g2.fillText('1', G.x0 - 6 * d, G.y0); g2.fillText('0', G.x0 - 6 * d, G.y1);
  const tw_ = s_ => { const mm = g2.measureText(s_); return (mm && mm.width) || s_.length * 6.7 * d; };
  const title = 'L/E km/GeV', tw = tw_(title), x4 = xOfU(G, 4), hw4 = tw_(fmt(1e4)) / 2;
  if (x4 + hw4 + 8 * d < G.x1 - tw) { g2.textAlign = 'right'; g2.fillText(title, G.x1, G.y1 + 11 * d); }
  else { g2.textAlign = 'left'; g2.fillStyle = TOK.panel; g2.fillRect(G.x0 + 4 * d, G.y0 + 2 * d, tw + 6 * d, 13 * d); g2.fillStyle = TOK.ink2; g2.fillText(title, G.x0 + 7 * d, G.y0 + 9 * d); }
  [['T2K', 295 / 0.6], ['NOvA', 810 / 2]].forEach(([nm_, le], i) => { const x = xOfU(G, uOf(le)); g2.fillStyle = TOK.ink3; g2.fillRect(x, G.y1 - 6 * d, d, 6 * d); g2.fillStyle = TOK.ink2; g2.textAlign = 'center'; g2.fillText(nm_, x, G.y1 - (12 + 11 * i) * d); });
  const yOf = v => G.y1 - (G.y1 - G.y0) * clamp(v, 0, 1);
  for (let f = 0; f < 3; f++) {
    if (st.model === 2 && f === 2) continue;
    const E = D.exact.P, n = E[0].length, dim = eb ? 0.25 : 1;
    g2.strokeStyle = COL[f]; g2.globalAlpha = (0.35 + 0.5 * (1 - st.mix)) * dim; g2.lineWidth = 1.4 * d; g2.beginPath();
    for (let i = 0; i < n; i++) { const x = G.x0 + (G.x1 - G.x0) * i / (n - 1), y = yOf(curveVal(E, f, i)); i ? g2.lineTo(x, y) : g2.moveTo(x, y); }
    g2.stroke();
    const P = m.P, nm2 = P[0].length, r = (nm2 > 400 ? 1.1 : 2.2) * d;
    g2.fillStyle = COL[f]; g2.globalAlpha = (0.2 + 0.8 * st.mix) * dim;
    for (let i = 0; i < nm2; i++) { const x = G.x0 + (G.x1 - G.x0) * i / (nm2 - 1); g2.beginPath(); g2.arc(x, yOf(curveVal(P, f, i)), r, 0, 2 * Math.PI); g2.fill(); }
    g2.globalAlpha = 1; g2.textAlign = 'right'; g2.fillText(NAME[f], G.x1 - 6 * d, G.y0 + (8 + 14 * f) * d);
  }
  if (eb) {   // electron-born sources: their classical curves, drawn dashed over the faded measured ones
    g2.setLineDash([6 * d, 4 * d]); g2.lineWidth = 2 * d;
    for (let f = 0; f < 3; f++) { g2.strokeStyle = COL[f]; g2.beginPath(); const n = ER.P[f].length;
      for (let i = 0; i < n; i++) { const x = G.x0 + (G.x1 - G.x0) * i / (n - 1), y = yOf(s.fixed ? ER.sun[f] : ER.P[f][i]); i ? g2.lineTo(x, y) : g2.moveTo(x, y); } g2.stroke(); }
    g2.setLineDash([]);
  }
  const xk = xOfU(G, st.u);
  g2.strokeStyle = TOK.ink; g2.lineWidth = 1.5 * d; g2.setLineDash([5 * d, 4 * d]); g2.beginPath(); g2.moveTo(xk, G.y0); g2.lineTo(xk, G.y1); g2.stroke(); g2.setLineDash([]);
  if (ctx) voices.filter(v => !v.rel).forEach(v => { const x = xOfU(G, voiceU(v)); g2.globalAlpha = 0.85; g2.fillStyle = TOK.ink; g2.fillRect(x - d, G.y0, 2 * d, G.y1 - G.y0); g2.globalAlpha = 1; });
  g2.fillStyle = TOK.ink; g2.beginPath(); g2.arc(xk, G.y0 + 2 * d, 6 * d, 0, 2 * Math.PI); g2.fill();
  g2.strokeStyle = TOK.panel; g2.lineWidth = 2 * d; g2.beginPath(); g2.arc(xk, G.y0 + 2 * d, 3 * d, 0, 2 * Math.PI); g2.stroke();
}
function drawWave(f) {
  const c = $('w-' + FL[f]), x = c.getContext('2d'), w = c.width, h = c.height;
  x.clearRect(0, 0, w, h);
  if (st.model === 2 && f === 2 && !eBorn()) return;
  const cyc = waveFor(st, f, st.u).cyc, a = level(st, f, st.u);
  x.strokeStyle = COL[f]; x.lineWidth = 1.5; x.globalAlpha = 0.35 + 0.65 * a; x.beginPath();
  for (let t = 0; t < cyc.length; t++) { const px_ = w * t / (cyc.length - 1), py = h / 2 - (h / 2 - 3) * cyc[t]; t ? x.lineTo(px_, py) : x.moveTo(px_, py); }
  x.stroke(); x.globalAlpha = 1;
}
// a drag on the curves (or the L/E knob) may leave the current source's range: then move to a muon-neutrino source
// that reaches it; past every muon-neutrino baseline it stops at the end of the current source's range
function setUAnywhere(u) {
  u = clamp(u, U0, U1);
  const r = srcRange(srcIdx(st), st.ei);
  if (u < r[0] - 1e-9 || u > r[1] + 1e-9 || SRC[srcIdx(st)].fixed) {
    const f = srcFor(u); if (!f) { moveTo(clamp(u, r[0], r[1])); ui(); return; }
    const was = SRC[srcIdx(st)].label; st.src = f[0]; st.ei = f[1]; tally.sig = ''; ev.cur = null; buildESeg(); PL.key = '';
    toast(`That L/E is out of the ${was.toLowerCase()}'s range: switched to ${SRC[f[0]].label.toLowerCase()} at ${SRC[f[0]].es[f[1]].label}`);
  }
  moveTo(u);
}
let dragging = false;
function setUFromX(clientX) { const r = cv.getBoundingClientRect(), G = geom(); const x = (clientX - r.left) * G.d; setUAnywhere(U0 + (x - G.x0) / (G.x1 - G.x0) * (U1 - U0)); }
cv.addEventListener('pointerdown', e => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} setUFromX(e.clientX); });
cv.addEventListener('pointermove', e => { if (dragging) setUFromX(e.clientX); });
cv.addEventListener('pointerup', () => { dragging = false; }); cv.addEventListener('pointercancel', () => { dragging = false; });
cv.addEventListener('keydown', e => { const s = e.shiftKey ? 0.1 : 0.01; if (e.key === 'ArrowLeft') { e.preventDefault(); setUAnywhere(st.u - s); } if (e.key === 'ArrowRight') { e.preventDefault(); setUAnywhere(st.u + s); } });

// ---- every readout from the state ----
function ui() {
  syncKnobs();
  const s = SRC[srcIdx(st)], eb = eBorn(), e = eOf(st);
  document.querySelectorAll('[data-chip]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.chip === st.chip)));
  document.querySelectorAll('[data-model]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.model === st.model)));
  document.querySelectorAll('[data-src]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.src === srcIdx(st))));
  document.querySelectorAll('[data-e]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.e === st.ei)));
  document.querySelectorAll('[data-jobchip]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.jobchip === st.chip)));
  $('kitchens').classList.toggle('idle', eb);
  const cn = $('chipnote'); cn.hidden = !eb;
  if (eb) cn.textContent = `${s.label}: electron-born neutrinos, which no chip measured. The bands and the sound use classical curves; Chip and Mix change only the dots in The data section below${s.anti ? ' and the CPT comparison in the readout' : ''}.`;
  const P = probsAt(st.u), sum = P[0] + P[1] + P[2], tot = sum || 1;
  FL.forEach((f, i) => {
    const a = P[i], off = st.model === 2 && i === 2 && !eb;
    $('v-' + f).textContent = a.toFixed(3); $('b-' + f).style.width = (100 * a) + '%';
    $('tn-' + f).textContent = nm(i);
    $('p-' + f).textContent = off ? 'off' : Math.round(100 * a / tot) + '%'; $('pb-' + f).style.width = (100 * a / tot) + '%';
    drawWave(i);
  });
  const le = leOf(st.u), L = s.fixed ? s.fixed : le * e;
  $('le-line').innerHTML = `<b>${s.label}</b> &middot; ${s.born} at ${fmtE(e)} &middot; L <b>${fmtL(L)} km</b> &middot; L/E <b>${s.fixed ? '~10<sup>10</sup>' : fmt(le)} km/GeV</b>`;
  $('sum-line').innerHTML = `&Sigma;P <b>${sum.toFixed(3)}</b>` + (st.mix > 0 && !eb ? ' (exact: 1)' : '');
  $('le-read').textContent = s.fixed ? `L/E about 10¹⁰ km/GeV, past the right-hand end of the curves  (${s.label}: L ${fmtL(L)} km at ${fmtE(e)})`
    : `L/E ${fmt(le)} km/GeV  (e.g. ${fmt(le)} km at 1 GeV; ${s.label}: L ${fmtL(L)} km at ${fmtE(e)})`;
  $('sum-read').textContent = `Σ P = ${sum.toFixed(3)}` + (st.mix > 0 && !eb ? '  (exact: 1)' : '');
  const m = D.machines[st.chip], kind = m.kind === 'qpu' ? `<span class="tag hw">IBM hardware</span>` : m.kind === 'sim' ? `<span class="tag">noiseless simulator</span>` : `<span class="tag">noise model &middot; emulator</span>`;
  let cpt = '';
  if (s.anti) { const cl = interp(ER.P[1], st.u), me = interp(m.P[1], st.u); cpt = `<dt>CPT check</dt><dd>classical P(ν̄e&rarr;ν̄μ) <b>${cl.toFixed(3)}</b> = P(νμ&rarr;νe), which ${m.id} measured as <b>${me.toFixed(3)}</b> here</dd>`; }
  $('readout').innerHTML = `<dt>Chip</dt><dd><b>${m.id}</b> ${kind}</dd>`
    + `<dt>Encoded</dt><dd><b>${m.values} values</b> = 4 curves &times; ${m.n} points &middot; ${m.shots} shots</dd>`
    + `<dt>Source</dt><dd><b>${s.what}</b>, born ${s.born} at ${fmtE(e)} (${s.es[eIdx(srcIdx(st), st.ei)].note})</dd>`
    + `<dt>Journey</dt><dd>L <b>${fmtL(L)} km</b> &rarr; L/E <b>${s.fixed ? 'about 10<sup>10</sup> (averaged)' : fmt(le)} km/GeV</b></dd>`
    + `<dt>Curves</dt><dd>${eb ? '<b>classical</b> (physics.py, NuFIT 6.0, vacuum); never on a chip' : `<b>mix ${Math.round(st.mix * 100)}% measured</b> (${m.id}'s values, crossfaded with the exact curves)`}</dd>`
    + cpt
    + `<dt>Qubits</dt><dd><b>${m.qubits.address} address + 1 data = ${m.qubits.rule}</b> (QPIXL rule for ${m.values} values); ${m.qubits.how}</dd>`
    + `<dt>Atlas job</dt><dd><b>${m.job_id}</b></dd>`
    + (m.kind === 'qpu' ? `<dt>IBM job</dt><dd><b>${m.ibm_job_id.join(', ')}</b> &middot; ${m.qpu_seconds} s QPU</dd>` : '')
    + `<dt>vs exact</dt><dd><b>rms ${m.rms[1].toFixed(3)} / ${m.rms[2].toFixed(3)} / ${m.rms[3].toFixed(3)}</b> (e / mu / tau)</dd>`
    + `<dt>Physics</dt><dd>classical (NuFIT 6.0, vacuum)</dd>`;
  detectLog();
  dirty = true;
  plateDyn();
}
let lastDyn = 0;
function loop(ts) {
  if (ctx) voices.forEach(v => { if (!v.rel) updateVoice(v, false); });
  const flying = !!ctx && st.flight > 0 && voices.some(v => !v.rel);
  if (plotSeen && (dirty || flying)) { drawPlot(); dirty = false; }
  if (flying && ts - lastDyn > 50) { lastDyn = ts; plateDyn(); }
  requestAnimationFrame(loop);
}

// ---- share ----
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200); };
$('share').addEventListener('click', async () => {
  history.replaceState(null, '', '#' + encodeToken(st));
  try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch (e) { toast('Copy failed: the link is in your address bar'); }
});
(function () { const s = decodeToken(location.hash); if (s) Object.assign(st, s); })();
// a shared link opened in a tab that already shows this page changes only the #token (no reload): apply it the same way
addEventListener('hashchange', () => {
  const s = decodeToken(location.hash); if (!s) return;
  Object.assign(st, s); tally.sig = ''; ev.cur = null;
  buildESeg(); PL.key = ''; plate(); dirty = true; ui(); toast('Opened the shared view');
});
buildESeg(); ui(); plate(); size(); requestAnimationFrame(loop);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { PL.key = ''; plate(); size(); });
