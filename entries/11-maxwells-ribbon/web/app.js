// Maxwell's Ribbon: page logic. Inlined into index.html by build_web.py after ball.js and the data.
// Every colour shown as "rebuilt" was rebuilt classically (extract.py) from a cached qpixl-v1 output: JOBS[].sw / .swv / .rib.
const $ = id => document.getElementById(id);
const SHOTS = [16, 128, 1024];
const MACH = META.machines;                    // [{id,label,short,kind}]
// page chrome palette (common/brand.css): paper ground, one ultramarine ink. Data colours are drawn as they are.
const INK = {ink: 0x19238E, panel: 0xFFFFFF, css: '#19238E', paper: '#FBFAF9', paperA: 'rgba(251,250,249,.95)'};
const kindText = {sim:'Atlas simulator, noiseless (aer)', noise: 'Atlas simulator with a noise model', hw: 'real IBM quantum hardware'};

// ---------- data ----------
const decode = s => { const o = []; for (let i = 0; i < s.length; i += 6) o.push([0, 2, 4].map(k => parseInt(s.substr(i + k, 2), 16))); return o; };
const clip = v => { const r = Math.hypot(...v); return r > 1 ? v.map(x => x / r) : v; };
JOBS.forEach(j => { j.swPix = decode(j.sw); j.swVec = j.swv.map(clip); j.ribPix = decode(j.rib); });
const ORIG = {}; Object.keys(RIB0).forEach(n => { ORIG[n] = decode(RIB0[n]); });   // ribbon crops exactly as sent
SW.forEach(s => { s.v = BALL.toVec(BALL.rgbToBall(s.rgb)); });
const RIB_BIG = Math.max(...Object.keys(ORIG).map(Number));
const meanVec = vs => [0, 1, 2].map(k => vs.reduce((a, v) => a + v[k], 0) / vs.length);
const vecOf = rgb => BALL.toVec(BALL.rgbToBall(rgb));
const rgbOfVec = v => { const b = BALL.fromVec(v); return BALL.ballToRgb(b.r, b.theta, b.phi); };
const dv = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const jobFor = (m, s) => JOBS.find(j => j.machine === m && (j.kind === 'hw' || j.shots === s));

// ---------- state ----------
const st = {machine: 'aer', shots: 1024, pick: BALL.unhex('#c0306a'), src: {type: 'free'}, drift: false, view: 'scene'};
if (!jobFor(st.machine, st.shots) && JOBS.length) { st.machine = JOBS[0].machine; st.shots = JOBS[0].shots; }
const cur = () => jobFor(st.machine, st.shots);
const ribCell = (src, n) => ({x: Math.min(n - 1, Math.floor((src.x + .5) * n / src.n)), y: Math.min(n - 1, Math.floor((src.y + .5) * n / src.n))});

// what the user picked and what the engine gave back for it.
// plates: for X, Y and Z, the number sent (s) and the number the engine measured back (m), both in 0..1.
// For a test colour, m is the engine's own output; for a ribbon pixel only the rebuilt colour was kept, so m is
// read back from that colour (exact: false, and the page says so).
const plateOf = v => (v + 1) / 2;
function result() {
  const j = cur();
  if (st.src.type === 'ribbon' && j && j.rib_n) {
    const n = j.rib_n, c = ribCell(st.src, n), k = c.y * n + c.x, sent = ORIG[n][k], vs = vecOf(sent), vr = vecOf(j.ribPix[k]);
    return {truth: st.pick, sent, vs, rebuilt: [{rgb: j.ribPix[k], v: vr}], exact: false,
      plates: [0, 1, 2].map(a => ({s: plateOf(vs[a]), m: plateOf(vr[a])})),
      label: n === st.src.n ? `ribbon pixel (${c.x}, ${c.y}) of ${n}×${n}, sent to the engine as-is`
        : `ribbon pixel (${c.x}, ${c.y}) of this run's ${n}×${n} ribbon (the chip had room for no more)`};
  }
  const n = BALL.nearest(st.pick, SW), s = SW[n.i];
  const rb = j ? [{rgb: j.swPix[n.i], v: j.swVec[n.i]}] : [];
  const raw = j ? j.swv[n.i] : [0, 0, 0];
  const label = st.src.type === 'ribbon' ? `this run had no room for the ribbon, so: nearest of ${SW.length} test colours (${BALL.hex(s.rgb)}), ${n.d.toFixed(2)} away`
    : st.src.type === 'swatch' ? `test colour ${n.i + 1} of ${SW.length}, sent to the engine as-is`
    : `nearest of ${SW.length} test colours (${BALL.hex(s.rgb)}), ${n.d.toFixed(2)} away in the ball`;
  return {truth: st.pick, sent: s.rgb, vs: s.v, rebuilt: rb, label, sw: n.i, exact: true,
    plates: [0, 1, 2].map(a => ({s: plateOf(s.v[a]), m: plateOf(raw[a])}))};
}

// ---------- Maxwell's studio (the scene): what it shows comes from result() ----------
const MNAME = {aer: 'The perfect simulator', fake_fez: 'The Fez noise model', fake_brisbane: 'The Brisbane noise model', ibm_fez: 'The real ibm_fez chip'};
const PLAQUE = {aer: 'AER SIM', fake_fez: 'FAKE FEZ', fake_brisbane: 'FAKE BRIS', ibm_fez: 'IBM FEZ'};
// Maxwell's line after a shoot: driven by the real miss, the arrow lengths and the plates
function sayText(res, j, vr, miss) {
  const off = `Off by ${miss.toFixed(2)}`, where = `${j.shots} shots on ${j.kind === 'hw' ? 'the real chip' : j.kind === 'sim' ? 'the perfect simulator' : 'a noise model'}`;
  const ends = res.plates.filter(p => p.m <= 0.005 || p.m >= 0.995).length;
  const ls = Math.hypot(...res.vs), lr = Math.hypot(...vr), greyer = lr < ls - 0.08 && j.kind !== 'sim';
  if (miss < 0.15) return `${off}. Splendid! Three plates, one colour, and it came back (${where}).`;
  if (j.shots <= 16) return `${off}${miss >= 0.5 ? '!' : '.'} With only ${j.shots} shots each number got a couple of clicks, so ${ends === 3 ? 'all three plates' : ends ? `${ends} of the three plates` : 'no plate'} came out pure black or white${ends ? '' : ', but they are still mostly noise'}.`;
  if (greyer) return `${off}, and greyer than it sat: noise pulled the arrow ${Math.round(100 * (1 - lr / Math.max(ls, 1e-6)))}% of the way to the grey centre (${where}).`;
  if (miss < 0.5) return `${off}. Close, but ${j.shots} shots still leave some scatter in each plate (${where}).`;
  return `${off}. That one came back badly (${where}).`;
}
function sceneModel(res) {
  const j = cur(); if (!j || !res.rebuilt.length) return null;
  const vr = res.rebuilt[0].v, miss = Math.round(100 * dv(res.vs, vr)) / 100;   // as shown, so mood and words agree
  return {sent: res.sent, vs: res.vs, rebuilt: res.rebuilt[0].rgb, vr, miss, plates: res.plates, kind: j.kind, shots: j.shots,
    plaque: PLAQUE[j.machine] || j.machine.toUpperCase(), machineName: MNAME[j.machine] || j.label,
    say: sayText(res, j, vr, miss) + (res.exact ? '' : ' (For a ribbon pixel the plates are read back from its rebuilt colour.)')};
}

// ---------- three.js ball ----------
// The ball is drawn in two places that always show the same state and the same angle: the Data view at the top (in
// place of the scene, started the first time it is opened) and "The data" section under the hero (always visible).
const ROT0 = {x: .38, y: -.65}, ROT = {x: ROT0.x, y: ROT0.y};   // shared angle: turn one ball and the other follows
const BALLS = [{cv: $('sphere'), tags: $('tags'), wrap: $('data-view'), R3: null, failed: false},
  {cv: $('sphere-d'), tags: $('tags-d'), wrap: $('ball-d'), R3: null, failed: false}];
function initThree(cv) {
  if (!window.THREE) throw new Error('three.js did not load');
  const renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(INK.panel, 0);   // transparent: the paper-white stage shows through
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);
  const world = new THREE.Group(); scene.add(world);
  const P = v => new THREE.Vector3(v[0], v[2], -v[1]);   // ball (x,y,z up) -> three (x, y up, z)
  const lineMat = new THREE.LineBasicMaterial({color: INK.ink, transparent: true, opacity: .16});
  const circle = (fn, n = 96) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(2 * Math.PI * i / n)); return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat); };
  [0, Math.PI / 4, -Math.PI / 4].forEach(lat => world.add(circle(a => P([Math.cos(lat) * Math.cos(a), Math.cos(lat) * Math.sin(a), Math.sin(lat)]))));
  for (let k = 0; k < 6; k++) { const ph = k * Math.PI / 6; world.add(circle(a => P([Math.sin(a) * Math.cos(ph), Math.sin(a) * Math.sin(ph), Math.cos(a)]))); }
  const axMat = new THREE.LineBasicMaterial({color: INK.ink, transparent: true, opacity: .6});
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(a => world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(a.map(x => -1.08 * x)), P(a.map(x => 1.08 * x))]), axMat)));
  world.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({color: INK.ink, transparent: true, opacity: .035, depthWrite: false})));
  // the 112 test colours (data colours), each with a thin ink rim so pale ones stay visible on paper
  const dotGeo = new THREE.SphereGeometry(.03, 12, 8), rimGeo = new THREE.SphereGeometry(.037, 12, 8);
  const rimMat = new THREE.MeshBasicMaterial({color: INK.ink, side: THREE.BackSide, transparent: true, opacity: .45});
  const dots = SW.map((s, i) => { const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({color: new THREE.Color(BALL.hex(s.rgb)), transparent: true, opacity: .9})); m.add(new THREE.Mesh(rimGeo, rimMat)); m.position.copy(P(s.v)); m.userData.i = i; world.add(m); return m; });
  // arrows: coloured by the colour they stand for, outlined in ink so white and pale arrows still read
  function arrow(opacity) {
    const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: opacity < 1, opacity});
    const edge = new THREE.MeshBasicMaterial({color: INK.ink, side: THREE.BackSide, transparent: opacity < 1, opacity});
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1, 12), mat), head = new THREE.Mesh(new THREE.ConeGeometry(.055, .14, 16), mat);
    shaft.add(new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, 1, 12), edge));
    head.add(new THREE.Mesh(new THREE.ConeGeometry(.07, .17, 16), edge));
    g.add(shaft, head); g.userData = {shaft, head, mat}; world.add(g); return g;
  }
  function setArrow(a, v, hex) {
    const p = P(v), len = p.length();
    a.visible = len > .06; if (!a.visible) return;
    a.userData.mat.color.set(hex);
    const sl = Math.max(.001, len - .13);
    a.userData.shaft.scale.set(1, sl, 1); a.userData.shaft.position.set(0, sl / 2, 0); a.userData.head.position.set(0, sl + .065, 0);
    a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  }
  const aTrue = arrow(1), aReb = arrow(.55);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.065, .009, 8, 32), new THREE.MeshBasicMaterial({color: INK.ink})); world.add(ring);
  const smpGeo = new THREE.SphereGeometry(.045, 14, 10), smp = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(smpGeo, new THREE.MeshBasicMaterial({color: 0xffffff})); const o = new THREE.Mesh(new THREE.SphereGeometry(.058, 14, 10), new THREE.MeshBasicMaterial({color: INK.ink, side: THREE.BackSide})); m.add(o); world.add(m); smp.push(m); }
  const errLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({color: INK.ink}));
  world.add(errLine);
  const driftGeo = new THREE.BufferGeometry(), drift = new THREE.LineSegments(driftGeo, new THREE.LineBasicMaterial({color: INK.ink, transparent: true, opacity: .45}));
  world.add(drift);
  const endGeo = new THREE.BufferGeometry(), ends = new THREE.Points(endGeo, new THREE.PointsMaterial({size: 5, sizeAttenuation: false, vertexColors: true}));
  world.add(ends);
  world.rotation.set(ROT.x, ROT.y, 0);
  return {renderer, scene, camera, world, P, dots, aTrue, aReb, ring, smp, errLine, drift, driftGeo, ends, endGeo, setArrow};
}

// floating labels (one set per ball)
const TAGS = [{t: 'white · |0⟩', v: [0, 0, 1.2]}, {t: 'black · |1⟩', v: [0, 0, -1.2]}, {t: 'grey = centre', v: [0, 0, -.1], dim: 1},
  ...['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'].map((t, k) => ({t, v: [1.18 * Math.cos(k * Math.PI / 3), 1.18 * Math.sin(k * Math.PI / 3), 0], dim: 1})),
  {t: 'X', v: [1.32, 0, 0]}, {t: 'Y', v: [0, 1.32, 0]}, {t: 'Z', v: [0, 0, 1.38]}];
BALLS.forEach(B => { B.tagEls = TAGS.map(g => { const e = document.createElement('span'); e.className = 'tag' + (g.dim ? ' dim' : ''); e.textContent = g.t; B.tags.appendChild(e); return e; }); });

function render(B) {
  const R3 = B.R3, cv = B.cv;
  if (!R3) return;
  const w = cv.clientWidth, h = cv.clientHeight, ox = cv.offsetLeft, oy = cv.offsetTop;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * R3.renderer.getPixelRatio()) || cv.height !== Math.round(h * R3.renderer.getPixelRatio())) {
    R3.renderer.setSize(w, h, false); R3.camera.aspect = w / h; R3.camera.updateProjectionMatrix();
  }
  R3.renderer.render(R3.scene, R3.camera);
  R3.world.updateMatrixWorld();
  TAGS.forEach((g, i) => {
    const p = R3.P(g.v).applyMatrix4(R3.world.matrixWorld).project(R3.camera), x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    B.tagEls[i].style.left = (ox + x) + 'px'; B.tagEls[i].style.top = (oy + y) + 'px'; B.tagEls[i].hidden = x < 8 || y < 8 || x > w - 8 || y > h - 8;
  });
}

function drawBall(res) {
  const vt = vecOf(res.truth), vs = vecOf(res.sent), j = cur();
  const vr = res.rebuilt.length ? meanVec(res.rebuilt.map(r => r.v)) : null;
  BALLS.forEach(B => {
    const R3 = B.R3;
    if (!R3) return;
    R3.world.rotation.set(ROT.x, ROT.y, 0); R3.world.updateMatrixWorld();
    R3.setArrow(R3.aTrue, vt, BALL.hex(res.truth));
    if (vr) R3.setArrow(R3.aReb, vr, BALL.hex(rgbOfVec(vr))); else R3.aReb.visible = false;
    R3.ring.position.copy(R3.P(vs)); R3.ring.lookAt(R3.camera.position.clone().applyMatrix4(new THREE.Matrix4().copy(R3.world.matrixWorld).invert()));
    R3.smp.forEach((m, i) => { const c = res.rebuilt[i]; m.visible = !!c; if (c) { m.position.copy(R3.P(c.v)); m.material.color.set(BALL.hex(c.rgb)); } });
    R3.errLine.visible = !!vr; if (vr) R3.errLine.geometry.setFromPoints([R3.P(vs), R3.P(vr)]);
    R3.dots.forEach((d, i) => { d.material.opacity = res.sw === i ? 1 : (st.drift ? .35 : .8); });
    if (st.drift && j) {
      const pts = [], endPts = [], cols = [];
      SW.forEach((s, i) => { pts.push(R3.P(s.v), R3.P(j.swVec[i])); endPts.push(R3.P(j.swVec[i])); const c = j.swPix[i]; cols.push(c[0] / 255, c[1] / 255, c[2] / 255); });
      R3.driftGeo.setFromPoints(pts); R3.endGeo.setFromPoints(endPts); R3.endGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      R3.drift.visible = R3.ends.visible = true;
    } else R3.drift.visible = R3.ends.visible = false;
    render(B);
  });
}

// drag / keys / click-to-pick, on either ball (both share the angle in ROT)
const clampX = x => Math.max(-1.4, Math.min(1.4, x));
BALLS.forEach(B => {
  const cv = B.cv;
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, moved: 0}; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ } });
  cv.addEventListener('pointermove', e => {
    if (!drag || !B.R3) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
    ROT.y += dx * .01; ROT.x = clampX(ROT.x + dy * .01); drawBall(result());
  });
  cv.addEventListener('pointerup', e => {
    if (drag && drag.moved < 5 && B.R3) {
      const r = cv.getBoundingClientRect(), ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), B.R3.camera);
      const hit = ray.intersectObjects(B.R3.dots)[0];
      if (hit) { const s = SW[hit.object.userData.i]; st.pick = s.rgb.slice(); st.src = {type: 'swatch'}; $('pick').value = BALL.hex(s.rgb); update(); }
    }
    drag = null;
  });
  cv.addEventListener('pointercancel', () => { drag = null; });   // a phone scrolling the page past the lower ball
  cv.addEventListener('keydown', e => {
    const m = {ArrowLeft: [0, -.12], ArrowRight: [0, .12], ArrowUp: [-.12, 0], ArrowDown: [.12, 0]}[e.key];
    if (m && B.R3) { e.preventDefault(); ROT.x = clampX(ROT.x + m[0]); ROT.y += m[1]; drawBall(result()); }
  });
});
$('reset-view').addEventListener('click', () => {   // shows the ball (if the Scene was up) and turns both balls back; says so either way
  setView('data');
  if (BALLS.some(B => B.R3)) { ROT.x = ROT0.x; ROT.y = ROT0.y; drawBall(result()); toast('Colour ball turned back to its starting angle'); }
  else toast('The 3D ball needs WebGL, which is not available here');
});

// ---------- views: the scene (default) or the data (the 3D colour ball, started the first time it is opened) ----------
function ensureThree(B) {
  if (B.R3 || B.failed) return;
  try { B.R3 = initThree(B.cv); } catch (e) {
    B.failed = true; B.tags.innerHTML = ''; const p = document.createElement('p'); p.className = 'note'; p.style.cssText = 'position:absolute;inset:40% 1rem auto;text-align:center';
    p.textContent = 'The 3D ball needs WebGL, which is not available here. The colours, numbers and job IDs below still work.'; B.wrap.appendChild(p);
  }
}
function setView(v) {
  st.view = v;
  $('scene-view').hidden = v !== 'scene'; $('data-view').hidden = v !== 'data';
  document.querySelectorAll('#g-view button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  if (v === 'data') { ensureThree(BALLS[0]); update('view'); } else SCENE.resize();
}
document.querySelectorAll('#g-view button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

// ---------- controls ----------
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800); };
MACH.forEach(m => {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.m = m.id;
  b.innerHTML = `${m.label}<small>${m.short}</small>`;
  if (!JOBS.some(j => j.machine === m.id)) { b.disabled = true; b.title = 'This run did not complete'; }
  b.addEventListener('click', () => { st.machine = m.id; const j = JOBS.find(x => x.machine === m.id && x.kind === 'hw'); if (j) st.shots = j.shots; else if (!cur()) st.shots = (JOBS.find(x => x.machine === m.id) || {}).shots || st.shots; update(); });
  $('g-machine').appendChild(b);
});
$('pick').addEventListener('input', () => { st.pick = BALL.unhex($('pick').value); st.src = {type: 'free'}; update(); });
$('rand').addEventListener('click', () => { st.pick = [0, 0, 0].map(() => Math.floor(Math.random() * 256)); st.src = {type: 'free'}; $('pick').value = BALL.hex(st.pick); update(); });
$('shots').addEventListener('input', () => { const s = SHOTS[+$('shots').value]; if (jobFor(st.machine, s)) { st.shots = s; } update(); });
$('drift').addEventListener('click', () => { st.drift = !st.drift; if (st.drift) setView('data'); update('view'); });
$('drift-d').addEventListener('click', () => { st.drift = !st.drift; update('view'); });   // the same switch, next to the ball in "The data"
// "See it on the ball": scroll up to the ball in "The data" (it already shows this colour) and hand it the keyboard
$('c-top').addEventListener('click', () => { $('data').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'}); BALLS[1].cv.focus({preventScroll: true}); });

function token() {   // flags at the end: d = drift lines on (shown on the ball), b = the colour ball (Data view) is open
  const s = st.src.type === 'ribbon' ? `r.${st.src.n}.${st.src.x}.${st.src.y}` : `c.${BALL.hex(st.pick).slice(1)}`;
  return `${st.machine}.${st.shots}.${s}${st.drift ? '.d' : st.view === 'data' ? '.b' : ''}`;
}
$('share').addEventListener('click', async () => {
  history.replaceState(null, '', '#' + token());
  try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch (e) { toast('Copy failed: the link is in your address bar'); }
});
function restore(hash) {   // #<machine>.<shots>.c.<hex>[.d|.b]  or  #<machine>.<shots>.r.<n>.<x>.<y>[.d|.b]
  const m = String(hash).replace(/^#/, '').split('.');
  if (m.length < 4 || !MACH.some(x => x.id === m[0])) return false;
  const j = jobFor(m[0], +m[1]); if (!j) return false;
  st.machine = m[0]; st.shots = j.kind === 'hw' ? j.shots : +m[1];
  const n = +m[3], x = +m[4], y = +m[5];
  if (m[2] === 'r' && ORIG[n] && x >= 0 && x < n && y >= 0 && y < n) { st.src = {type: 'ribbon', n, x, y}; st.pick = ORIG[n][y * n + x].slice(); }
  else if (m[2] === 'c' && /^[0-9a-f]{6}$/i.test(m[3])) {
    st.pick = BALL.unhex('#' + m[3]);
    st.src = SW.some(s => BALL.hex(s.rgb) === BALL.hex(st.pick)) ? {type: 'swatch'} : {type: 'free'};   // a test colour stays a test colour
  }
  const flags = m.slice(m[2] === 'r' ? 6 : 4);
  st.drift = flags.includes('d');
  st.view = st.drift || flags.includes('b') ? 'data' : 'scene';
  return true;
}
restore(location.hash);
addEventListener('hashchange', () => { if (restore(location.hash)) { $('pick').value = BALL.hex(st.pick); setView(st.view); update(); } });

// ---------- chapter 1: three filters (classical) ----------
const F = {on: [true, true, true], data: null};
(function () {
  const im = new Image();
  im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 288; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 288, 288); F.data = x.getImageData(0, 0, 288, 288); drawFilters(); };
  im.src = CROP_URI;
})();
const FN = ['red', 'green', 'blue'];
function drawFilters() {
  const ctx = $('filters').getContext('2d'), on = F.on.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (!F.data) return;
  const out = ctx.createImageData(288, 288), d = F.data.data, o = out.data;
  for (let p = 0; p < d.length; p += 4) {
    if (on.length === 1) { const g = d[p + on[0]]; o[p] = o[p + 1] = o[p + 2] = g; }
    else for (let k = 0; k < 3; k++) o[p + k] = F.on[k] ? d[p + k] : 0;
    o[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  $('filters-cap').textContent = on.length === 0 ? 'No filters, no light: nothing on the screen.'
    : on.length === 1 ? `Only the ${FN[on[0]]}-filter plate: a grey photo. Bright where ${FN[on[0]]} light got through. One measurement, no colour.`
    : on.length === 2 ? `Two plates projected through ${FN[on[0]]} and ${FN[on[1]]} filters: some colour, but wrong. One number is still missing.`
    : 'All three plates projected together: the colour comes back. Three measurements make one colour.';
}
document.querySelectorAll('#g-filters button').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.f; F.on[k] = !F.on[k]; b.setAttribute('aria-pressed', String(F.on[k])); drawFilters(); }));
// clicking the picture steps through the plates one at a time: red only, green only, blue only, then all three
function stepFilters() {
  const on = F.on.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const next = on.length === 1 ? (on[0] < 2 ? [on[0] + 1] : [0, 1, 2]) : [0];
  F.on = [0, 1, 2].map(k => next.includes(k));
  document.querySelectorAll('#g-filters button').forEach(b => b.setAttribute('aria-pressed', String(F.on[+b.dataset.f])));
  drawFilters();
}
$('filters').addEventListener('click', stepFilters);
$('filters').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepFilters(); } });

// ---------- small pixel canvases (integer scale, no smoothing) ----------
function fitPixel(c, w, h) {
  const box = c.parentElement, dpr = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.floor(Math.min(box.clientWidth, box.clientHeight || box.clientWidth) * dpr / Math.max(w, h)));
  if (c.width !== w * k || c.height !== h * k) { c.width = w * k; c.height = h * k; }
  c.style.width = (w * k / dpr) + 'px'; c.style.height = (h * k / dpr) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return {x, k};
}
const SPRITE = {}; Object.keys(SPR).forEach(n => { SPRITE[n] = InkSprite.make(SPR[n]); });
const icon = (name, scale, alt) => { const im = new Image(); im.src = InkSprite.toDataURL(SPRITE[name], 0, scale); im.className = 'ico'; im.alt = alt || ''; im.width = SPRITE[name].w * scale; im.height = SPRITE[name].h * scale; return im; };

// ---------- chapter 2: the hidden-arrow game (classical toy) ----------
// The hidden colour sits behind a velvet curtain; your rebuild is a second Bloch character in your estimated colour.
const G = {anim: 0};
const gArt = document.createElement('canvas'); gArt.width = gArt.height = 32;
const gx = gArt.getContext('2d');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function gameCanvas(id, rgb, v, frame, curtainUp) {
  const c = $(id), o = fitPixel(c, 32, 32);
  gx.clearRect(0, 0, 32, 32);
  gx.fillStyle = InkSprite.PALETTE.W; gx.fillRect(0, 0, 32, 32);
  gx.fillStyle = InkSprite.PALETTE.T; gx.fillRect(0, 28, 32, 4); gx.fillStyle = InkSprite.PALETTE.K; gx.fillRect(0, 28, 32, 1);
  if (rgb) GAMEDRAW.bloch(gx, rgb, v, 4, 3, frame);
  if (curtainUp != null && curtainUp < 32) InkSprite.draw(gx, SPRITE.curtain, 0, 16, 16 - curtainUp, 1);
  o.x.drawImage(gArt, 0, 0, c.width, c.height);
}
const GAMEDRAW = {bloch: (c, rgb, v, x, y, f) => SCENE.drawBloch(c, rgb, v, x, y, f)};
function drawGameArt(blinkGuess) {
  const e = BALL.estimate(G.t), len = Math.hypot(...e), v = len > 1 ? e.map(x => x / len) : e;
  const up = G.shown ? Math.min(32, Math.round(32 * (G.anim ? Math.min(1, (performance.now() - G.anim) / 450) : 1))) : 0;
  const err = dv(e, G.v);
  gameCanvas('g-hidden', rgbOfVec(G.v), G.v, G.shown && up >= 32 ? (err < 0.35 ? 3 : 4) : 0, up);
  gameCanvas('g-guess', rgbOfVec(v), v, blinkGuess ? 1 : 0, null);
  if (G.shown && up < 32 && !reducedMotion()) requestAnimationFrame(() => drawGameArt(false));
}
function newGame() {
  const z = 2 * Math.random() - 1, a = 2 * Math.PI * Math.random(), s = Math.sqrt(1 - z * z);
  G.v = [s * Math.cos(a), s * Math.sin(a), z]; G.t = {x: [0, 0], y: [0, 0], z: [0, 0]}; G.shown = false; G.anim = 0; $('g-hidden').classList.add('peek'); drawGame();
  $('g-msg').textContent = 'Start by measuring Z ten times. Then try only Z, 100 times. Can you get the colour without X and Y?';
}
function drawGame(blink) {
  const e = BALL.estimate(G.t), n = G.t.x[1] + G.t.y[1] + G.t.z[1];
  drawGameArt(blink);
  if (blink) setTimeout(() => drawGameArt(false), 140);
  $('g-count').textContent = `${n} clicks`;
  $('g-bars').innerHTML = ['x', 'y', 'z'].map((a, k) => {
    const [p, t] = G.t[a], val = t ? (2 * p - t) / t : 0;
    const bar = t ? `<span style="left:${Math.min(50, 50 + 50 * val)}%;width:${Math.abs(50 * val)}%"></span>` : '';
    const truth = G.shown ? `<span class="hidden" style="left:${50 + 50 * G.v[k] - .6}%;width:3px"></span>` : '';
    return `<span>${a.toUpperCase()}</span><i title="estimate along ${a.toUpperCase()}">${bar}${truth}</i><span>${t ? `${p}/${t}` : '–'}</span>`;
  }).join('');
}
document.querySelectorAll('#game [data-m]').forEach(b => b.addEventListener('click', () => {
  const ax = +b.dataset.m, key = 'xyz'[ax], plus = BALL.measure(G.v, ax, 10, Math.random);
  G.t[key][0] += plus; G.t[key][1] += 10; drawGame(true);
  const done = ['x', 'y', 'z'].filter(a => G.t[a][1]);
  $('g-msg').textContent = done.length === 1 && done[0] === 'z' ? `Z only: you know how light or dark it is (${G.t.z[0]} of ${G.t.z[1]} clicks said 0), but not its hue. Try X and Y.`
    : done.length < 3 ? 'Getting closer. You still need all three directions to pin the arrow down.'
    : 'All three directions measured: that is tomography. More clicks give a better rebuild. Press Reveal when you are ready.';
}));
function reveal() {
  if (!G.shown) G.anim = performance.now(); G.shown = true; drawGame(); $('g-hidden').classList.remove('peek');
  const e = BALL.estimate(G.t); $('g-msg').textContent = `The hidden arrow is revealed. Your rebuild was off by ${dv(e, G.v).toFixed(2)} (0 is perfect, 2 is the opposite side of the ball).`;
}
$('g-reveal').addEventListener('click', reveal);
$('g-hidden').addEventListener('click', () => { if (!G.shown) reveal(); });
// your rebuild can go up to Maxwell's studio: the sitter takes its colour and you see what the real runs gave back for it
function sendGuess() {
  const e = BALL.estimate(G.t), len = Math.hypot(...e), v = len > 1 ? e.map(x => x / len) : e;
  st.pick = rgbOfVec(v); st.src = {type: 'free'}; $('pick').value = BALL.hex(st.pick); update();
  toast(st.view === 'data' ? 'Your rebuild sent to the colour ball, at the top' : "Your rebuild sent to Maxwell's studio, at the top");
}
$('g-guess').addEventListener('click', sendGuess);
$('g-guess').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sendGuess(); } });
$('g-new').addEventListener('click', newGame);

// ---------- chapter 4: all runs ----------
function buildRuns() {
  const max = Math.max(...JOBS.map(j => j.err), .01);
  const cell = (m, s) => {
    const j = jobFor(m.id, s);
    if (!j) return `<td><button type="button" disabled title="did not complete">failed</button></td>`;
    return `<td><button type="button" data-m="${m.id}" data-s="${j.shots}" aria-label="Load the ${m.label} run (${m.short}) at ${j.shots} shots: average miss ${j.err.toFixed(3)}" title="Load this run at the top of the page"><span>${j.err.toFixed(3)}</span><i style="width:${Math.max(4, 100 * j.err / max)}%"></i></button></td>`;
  };
  let h = `<tr><th></th>${SHOTS.map(s => `<th>${s} shots</th>`).join('')}</tr>`;
  const ico = m => `<span data-ico="${m.kind === 'hw' ? 'chip' : m.kind === 'noise' ? 'simNoisy' : 'sim'}"></span>`;
  MACH.filter(m => m.kind !== 'hw').forEach(m => { h += `<tr><th>${ico(m)}${m.label}<br><small>${m.short}</small></th>${SHOTS.map(s => cell(m, s)).join('')}</tr>`; });
  MACH.filter(m => m.kind === 'hw').forEach(m => {
    const j = JOBS.find(x => x.machine === m.id);
    h += `<tr><th>${ico(m)}${m.label}<br><small>${m.short}</small></th>` + (j ? SHOTS.map(s => s === j.shots ? cell(m, s) : '<td></td>').join('') : `<td colspan="3"><button type="button" disabled>did not complete</button></td>`) + '</tr>';
  });
  $('runs').innerHTML = h;
  $('runs').querySelectorAll('[data-ico]').forEach(e => e.replaceWith(icon(e.dataset.ico, 1, '')));
  $('runs').querySelectorAll('button[data-m]').forEach(b => b.addEventListener('click', () => { st.machine = b.dataset.m; st.shots = +b.dataset.s; update(); }));
}

// ---------- Jobs and credits: every cached job, straight from the job data; Load puts that run everywhere ----------
function buildJobs() {
  const mach = id => MACH.find(m => m.id === id) || {label: id, short: id};
  $('jobs-table').innerHTML = '<thead><tr><th>Machine</th><th>Shots</th><th>Where it ran</th><th>Atlas job</th><th>Miss</th><th></th></tr></thead><tbody>' +
    JOBS.map(j => { const m = mach(j.machine); return `<tr><td><b>${m.label}</b><br>${m.short}</td><td data-l="Shots">${j.shots}</td><td data-l="Where it ran">${kindText[j.kind]}</td>` +
      `<td data-l="Atlas job"><code>${j.job_id}</code>${j.ibm_job_id ? `<br>IBM job <code>${j.ibm_job_id}</code>` : ''}</td><td data-l="Miss">${j.err.toFixed(3)}</td>` +
      `<td class="go"><button type="button" class="btn ghost" data-m="${j.machine}" data-s="${j.shots}" aria-pressed="false" aria-label="Load the ${m.label} run (${m.short}) at ${j.shots} shots">Load</button></td></tr>`; }).join('') + '</tbody>';
  $('jobs-table').querySelectorAll('button[data-m]').forEach(b => b.addEventListener('click', () => {
    st.machine = b.dataset.m; st.shots = +b.dataset.s; update();
    const m = mach(st.machine); toast(`Loaded ${m.label} at ${st.shots} shots: the studio, the ball, the table and the ribbon all show it`);
  }));
  const hw = JOBS.filter(j => j.kind === 'hw').length;
  $('jobs-note').textContent = `${JOBS.length} completed qpixl-v1 jobs (${hw} on real IBM hardware). Every plate, rebuilt colour and ribbon pixel on this page comes from one of them; nothing is computed live. Miss is the average distance of the 112 test colours, as in chapter 4.`;
  const t = META.tessa_jobs || [];
  $('jobs-tessa').textContent = t.length ? `tessa-image-v1, the engine the brief names, was tried ${t.length} times and every job failed with engine_timeout, so none of its output appears here: ${t.join(', ')}.` : '';
}

// ---------- chapter 5: ribbon compare ----------
const rc = $('rib'), rx = rc.getContext('2d');
const ribN = () => { const j = cur(); return j && j.rib_n ? j.rib_n : RIB_BIG; };
function drawRib() {
  const j = cur(), n = ribN(), has = !!(j && j.rib_n), cs = rc.width / n, wipe = (has ? +$('wipe').value / 100 : 1) * rc.width;
  rx.clearRect(0, 0, rc.width, rc.height);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = y * n + x, left = (x + .5) * cs < wipe;
    rx.fillStyle = BALL.hex(left ? ORIG[n][k] : j.ribPix[k]); rx.fillRect(Math.floor(x * cs), Math.floor(y * cs), Math.ceil(cs) + 1, Math.ceil(cs) + 1);
  }
  rx.font = '500 14px "IBM Plex Mono", monospace'; rx.textBaseline = 'middle';
  const tagBox = (txt, x, w) => { rx.fillStyle = INK.paperA; rx.fillRect(x, 8, w, 24); rx.strokeStyle = INK.css; rx.lineWidth = 1; rx.strokeRect(x + .5, 8.5, w - 1, 23); rx.fillStyle = INK.css; rx.fillText(txt, x + 8, 20.5); };
  if (has) {
    rx.fillStyle = INK.paper; rx.fillRect(wipe - 3, 0, 6, rc.height);
    rx.fillStyle = INK.css; rx.fillRect(wipe - 1, 0, 2, rc.height);
    rx.beginPath(); rx.arc(wipe, rc.height / 2, 11, 0, 2 * Math.PI); rx.fill();
    tagBox('SENT IN', 8, 80); tagBox('REBUILT', rc.width - 88, 80);
  } else {
    rx.fillStyle = INK.paperA; rx.fillRect(0, rc.height / 2 - 36, rc.width, 72);
    rx.fillStyle = INK.css; rx.fillRect(0, rc.height / 2 - 36, rc.width, 1); rx.fillRect(0, rc.height / 2 + 35, rc.width, 1);
    rx.textAlign = 'center';
    rx.fillText('No room for the ribbon on this machine:', rc.width / 2, rc.height / 2 - 11);
    rx.fillText('only the 112 test colours fitted.', rc.width / 2, rc.height / 2 + 11); rx.textAlign = 'start';
  }
  if (st.src.type === 'ribbon') {
    const c = ribCell(st.src, n);
    rx.strokeStyle = INK.paper; rx.lineWidth = 5; rx.strokeRect(c.x * cs + 2.5, c.y * cs + 2.5, cs - 5, cs - 5);
    rx.strokeStyle = INK.css; rx.lineWidth = 2.5; rx.strokeRect(c.x * cs + 1.25, c.y * cs + 1.25, cs - 2.5, cs - 2.5);
  }
  $('wipe').disabled = !has;
  $('rib-cap').textContent = !j ? 'This run did not complete.' : has
    ? `${n}×${n} ribbon. Right of the divider: ${j.label}, ${kindText[j.kind]}. Job ${j.job_id}.`
    : `${j.label}: this machine holds ${j.n_values} numbers, just enough for the 112 test colours, so the ribbon was not sent. Showing the ribbon as sent to the perfect simulator.`;
}
function pickRib(x, y) {
  const n = ribN(); st.src = {type: 'ribbon', n, x, y}; st.pick = ORIG[n][y * n + x].slice(); $('pick').value = BALL.hex(st.pick); update();
}
rc.addEventListener('click', e => {
  const n = ribN(), r = rc.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n);
  if (x < 0 || y < 0 || x >= n || y >= n) return;
  pickRib(x, y); toast("Pixel sent to the ball and to Maxwell's studio");
});
rc.addEventListener('keydown', e => {
  const m = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key]; if (!m) return; e.preventDefault();
  const n = ribN(), p = st.src.type === 'ribbon' ? ribCell(st.src, n) : {x: n >> 1, y: n >> 1};
  pickRib(Math.max(0, Math.min(n - 1, p.x + m[0])), Math.max(0, Math.min(n - 1, p.y + m[1])));
});
$('wipe').addEventListener('input', drawRib);

// ---------- quiz ----------
const QUIZ = META.quiz;
const answered = {};
function buildQuiz() {
  $('q-form').innerHTML = QUIZ.map((q, i) => `<fieldset><legend>${i + 1}. ${q.q}</legend>${q.a.map((a, k) => `<label><input type="radio" name="q${i}" value="${k}"> <span>${a}</span></label>`).join('')}<p class="fb" id="fb${i}" aria-live="polite"></p></fieldset>`).join('');
  $('q-form').querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
    const i = +inp.name.slice(1), k = +inp.value, q = QUIZ[i], ok = k === q.right;
    answered[i] = ok; const fb = $('fb' + i); fb.className = 'fb ' + (ok ? 'right' : 'wrong');
    fb.textContent = (ok ? 'Right. ' : 'Not quite. ') + q.why[k];
    $('q-score').textContent = `${Object.values(answered).filter(Boolean).length} / ${QUIZ.length}`;
    $('q-reset').hidden = false;   // "Start again" appears once there is an answer to clear
  }));
}
$('q-reset').addEventListener('click', () => {
  Object.keys(answered).forEach(k => delete answered[k]); buildQuiz(); $('q-score').textContent = `0 / ${QUIZ.length}`;
  $('q-reset').hidden = true; $('q-form').querySelector('input').focus({preventScroll: true});   // keyboard focus goes back to question 1
});

// ---------- render everything ----------
function update(why) {
  why = why || 'change';
  const j = cur(), res = result();
  // controls
  document.querySelectorAll('#g-machine button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === st.machine)));
  const hw = j && j.kind === 'hw';
  $('shots').value = SHOTS.indexOf(st.shots); $('shots').disabled = hw;
  $('shots-val').textContent = `${st.shots} shots`;
  document.querySelectorAll('.ticks span').forEach(s => { s.setAttribute('aria-current', String(+s.textContent === st.shots)); s.style.opacity = jobFor(st.machine, +s.textContent) ? 1 : .35; });
  $('shots-note').textContent = hw ? `There is one real-hardware run, at ${j.shots} shots, so the slider is fixed here.`
    : st.shots === 16 ? `Very few shots: each number gets a couple of clicks${j && j.extremes != null ? `, so ${Math.round(100 * j.extremes)}% came back as exactly 0 or 1` : ''}. The rebuild is mostly noise.`
    : st.shots === 128 ? 'More clicks per pixel, so the odds are measured more sharply.' : 'Lots of clicks: the odds are pinned down well. What is left is the machine\'s own noise.';
  ['drift', 'drift-d'].forEach(id => { $(id).setAttribute('aria-pressed', String(st.drift)); $(id).textContent = st.drift ? 'Hide the drift' : 'Show every colour\'s drift'; });
  // meter + readouts
  $('m-true').style.background = BALL.hex(res.truth);
  const same = BALL.hex(res.truth) === BALL.hex(res.sent);
  $('m-sent-wrap').hidden = same; $('m-sent').style.background = BALL.hex(res.sent);
  $('m-rebuilt').innerHTML = res.rebuilt.map(c => `<span class="chip" style="background:${BALL.hex(c.rgb)}" title="${BALL.hex(c.rgb)}"></span>`).join('') || '–';
  const vr = res.rebuilt.length ? meanVec(res.rebuilt.map(r => r.v)) : null;
  $('m-err').textContent = vr ? `off by ${dv(vecOf(res.sent), vr).toFixed(2)}` : '';
  $('r-where').innerHTML = j ? `<span class="where${hw ? ' hw' : ''}">${kindText[j.kind]}${j.backend && j.kind !== 'sim' ? ' · ' + j.backend : ''}</span> · ${j.shots} shots` : 'did not complete';
  $('r-qubits').textContent = j ? j.qubits_text : '–';
  $('r-src').textContent = res.label;
  $('r-plates').textContent = res.plates.map((q, a) => `${'XYZ'[a]} ${q.s.toFixed(2)} \u2192 ${q.m.toFixed(2)}`).join(' \u00b7 ') +
    (res.exact ? ' (sent \u2192 measured)' : ' (sent \u2192 read back from the rebuilt pixel)');
  $('r-job').textContent = j ? j.job_id + (j.ibm_job_id ? ` (IBM job ${j.ibm_job_id})` : '') : '–';
  // The data: the same pick and run, next to the always-visible ball
  $('d-true').style.background = BALL.hex(res.truth);
  $('d-reb').style.background = vr ? BALL.hex(rgbOfVec(vr)) : 'transparent';
  $('d-err').textContent = vr ? `off by ${dv(vecOf(res.sent), vr).toFixed(2)}` : '';
  const mm = j && MACH.find(x => x.id === j.machine);
  $('d-run').textContent = j ? `Showing the ${mm ? mm.label : j.machine} run: ${kindText[j.kind]}${j.kind !== 'sim' ? ` (${j.backend})` : ''}, ${j.shots} shots. ` +
    `Change it with the machine and shots controls at the top, or load any run in chapter 4. Colour: ${res.label}.` : 'This run did not complete.';
  $('jobs-table').querySelectorAll('button[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === st.machine && +x.dataset.s === st.shots)));
  // chapters
  const b = BALL.rgbToBall(res.truth), v = vecOf(res.truth);
  $('c-bars').innerHTML = [['Z: light–dark', v[2]], ['X lean', v[0]], ['Y lean', v[1]], ['away from grey', b.r]].map(([n, x]) =>
    `<span>${n}</span><i><span style="left:${n === 'away from grey' ? 0 : Math.min(50, 50 + 50 * x)}%;width:${n === 'away from grey' ? 100 * x : Math.abs(50 * x)}%"></span></i><span>${x.toFixed(2)}</span>`).join('');
  $('c-msg').textContent = `${BALL.hex(res.truth)} sits ${b.r.toFixed(2)} of the way from the grey centre to the edge, ${v[2] > .15 ? 'above the equator (paler)' : v[2] < -.15 ? 'below the equator (darker)' : 'near the equator'}, hue ${Math.round((b.phi * 180 / Math.PI + 360) % 360)}°.`;
  $('runs').querySelectorAll('button[data-m]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.m === st.machine && +x.dataset.s === st.shots)));
  drawRib();
  drawBall(res);   // both balls (the one at the top only once its Data view has been opened)
  const sm = sceneModel(res);
  if (sm && why !== 'view') SCENE.set(sm, why === 'load' ? 'load' : 'change');
}

// ---------- static copy from META ----------
$('proof').innerHTML = META.proof.map(p => `<span class="${p.hot ? 'hot' : ''}"><b>${p.b}</b> ${p.t}</span>`).join('');
$('ch4-honesty').textContent = META.ch4_honesty;
$('ch4-find').innerHTML = META.findings;
$('runs-cap').textContent = META.runs_cap;
$('ch5-note').textContent = META.ch5_note;
$('ch3-noise').textContent = META.ch3_noise;
$('r-engine-note').textContent = META.engine_note;
$('drawer-engine').innerHTML = META.drawer_engine.map(p => `<p>${p}</p>`).join('');
$('drawer-honest').innerHTML = META.drawer_honest.map(p => `<p class="honesty">${p}</p>`).join('');

// ---------- the scene: Maxwell speaks, the shoot button, clicks on the picture ----------
const faceCv = $('say-face'), faceX = faceCv.getContext('2d');
const MOOD_FRAME = {idle: 0, happy: 1, hmm: 2, oops: 3};
function say(o) {
  faceX.clearRect(0, 0, faceCv.width, faceCv.height); faceX.imageSmoothingEnabled = false;
  InkSprite.draw(faceX, SPRITE.mxFace, MOOD_FRAME[o.mood] || 0, faceCv.width / 2, faceCv.height / 2, 2);
  const t = $('say-text'); t.setAttribute('aria-live', o.live ? 'polite' : 'off'); t.textContent = o.text;
}
function playing(on) { $('shoot').textContent = on ? 'Skip to the result' : 'Take the three photos'; }
function sceneClick(what) {
  if (what === 'camera') SCENE.shoot();
  else if (what === 'top') SCENE.spinTop();
  else if (what === 'sitter') {   // a new test colour sits down
    let i = Math.floor(Math.random() * SW.length); if (st.src.type === 'swatch' && BALL.hex(SW[i].rgb) === BALL.hex(st.pick)) i = (i + 1) % SW.length;
    st.pick = SW[i].rgb.slice(); st.src = {type: 'swatch'}; $('pick').value = BALL.hex(st.pick); update(); SCENE.hop();
  }
}
$('shoot').addEventListener('click', () => { if (st.view !== 'scene') setView('scene'); SCENE.shoot(); });
SCENE.mount($('scene'), {say, state: playing, click: sceneClick});
if (window.ResizeObserver) BALLS.forEach(B => new ResizeObserver(() => render(B)).observe(B.wrap));
ensureThree(BALLS[1]);   // the ball in "The data" is always on show
// chapter 1: the filter buttons carry Maxwell's filters
document.querySelectorAll('#g-filters button').forEach(b => b.prepend(icon('filter' + 'RGB'[+b.dataset.f], 2, '')));
if (window.ResizeObserver) new ResizeObserver(() => drawGameArt(false)).observe($('game'));
buildRuns(); buildJobs(); buildQuiz(); newGame(); $('pick').value = BALL.hex(st.pick);
if (st.view === 'data') setView('data');
update('load');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawRib);   // canvas labels in IBM Plex Mono once it has loaded
