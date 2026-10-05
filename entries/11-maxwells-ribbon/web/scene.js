// Maxwell's studio: the pixel-art scene at the top of the page. Inlined by build_web.py after common/inksprite.js
// and the cast (SPR, from web/sprites.json). It draws what the page's real data says and nothing else:
//   the sitter's colour   = the colour that was sent to the engine (a test colour or a ribbon pixel)
//   each plate's grey     = the number the engine measured back for X, Y or Z (0 = black, 1 = white)
//   the portrait          = the colour rebuilt from those three numbers (classical), and its arrow
//   Maxwell's mood        = the real miss distance for this colour on this run
// The flash, the flying plates, blinking lights, the spinning colour top and the light rays are decoration.
const SCENE = (() => {
  const H = 112, MINW = 160, MAXW = 250;
  const P = InkSprite.PALETTE;
  const S = {}; Object.keys(SPR).forEach(n => { S[n] = InkSprite.make(SPR[n]); });
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---- 3x5 pixel font (bit 4 = left column)
  const FONT = {A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
    F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5],
    L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3],
    R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5],
    X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7],
    3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7],
    9: [7, 5, 7, 1, 6], '.': [0, 0, 0, 0, 2], '?': [6, 1, 2, 0, 2], '-': [0, 0, 7, 0, 0], ':': [0, 2, 0, 2, 0], ' ': [0, 0, 0, 0, 0]};
  const textW = s => s.length * 4 - 1;
  function text(c, s, x, y, col, size) {
    const z = size || 1; c.fillStyle = col;
    [...String(s).toUpperCase()].forEach((ch, i) => (FONT[ch] || FONT['?']).forEach((bits, r) => {
      for (let b = 0; b < 3; b++) if (bits & (4 >> b)) c.fillRect(x + (i * 4 + b) * z, y + r * z, z, z);
    }));
  }

  // ---- the sitter: one sprite per colour (C = the colour, c = a readable ink on it)
  const lum = rgb => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  const hex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const blochCache = new Map();
  function blochFor(rgb) {
    const h = hex(rgb);
    if (!blochCache.has(h)) {
      if (blochCache.size > 40) blochCache.delete(blochCache.keys().next().value);
      blochCache.set(h, InkSprite.make({frames: SPR.bloch.frames, fps: 1, palette: {C: h, c: lum(rgb) < 0.42 ? P.W : P.K}}));
    }
    return blochCache.get(h);
  }

  // ---- canvases
  let cv = null, cx = null, art = null, ax = null, bg = null, W = MINW, k = 1;
  let model = null, seq = null, bounceAt = -9, topSpinAt = -9, moodAt = -9, raf = 0, visible = true, lastDraw = 0;
  let onSay = () => {}, onState = () => {};
  const now = () => performance.now() / 1000;

  // layout (art pixels), recomputed when the width changes
  const L = {};
  function layout() {
    L.stool = {x: 3, y: 86}; L.sitter = {x: 0, y: 61}; L.bow = {x: 5, y: 55};
    L.cam = {x: 26, y: 68}; L.tripod = {x: 31, y: 84}; L.lens = {x: 27, y: 75};
    L.mx = {x: 48, y: 56};
    L.scr = {x: W - 80, y: 5, w: 44, h: 52};
    L.mcx = W - 17;
    L.table = {x: L.scr.x + 13, y: 82}; L.top = {x: L.scr.x + 15, y: 70};
    const x0 = 3, x1 = L.scr.x - 4;
    L.line = {x0, x1, y: 4};
    L.plates = [0.17, 0.5, 0.83].map(f => ({x: Math.round(x0 + f * (x1 - x0)) - 9, y: 7, w: 18, h: 22}));
    L.machineIn = () => model && model.kind === 'hw' ? {x: L.mcx, y: 37} : {x: L.mcx, y: 66};
  }

  function paintBg() {
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const b = bg.getContext('2d');
    b.fillStyle = P.W; b.fillRect(0, 0, W, H);
    b.fillStyle = P.T;                                         // wallpaper: a sparse diamond grid
    for (let y = 10, r = 0; y < 70; y += 8, r++) for (let x = r % 2 ? 6 : 2; x < W; x += 8) { b.fillRect(x, y, 1, 1); }
    b.fillStyle = P.L; b.fillRect(0, 70, W, 1);                // picture rail
    b.fillStyle = P.K; b.fillRect(0, 76, W, 1);                // skirting board
    b.fillStyle = P.B; b.fillRect(0, 77, W, 3);
    b.fillStyle = P.K; b.fillRect(0, 80, W, 1);
    b.fillStyle = P.T; b.fillRect(0, 81, W, H - 81);           // floorboards: long planks, staggered joints
    b.fillStyle = P.L;
    for (let y = 86, i = 0; y < H; y += 6, i++) { b.fillRect(0, y, W, 1); for (let x = (i * 23) % 47 + 5; x < W; x += 47) b.fillRect(x, y - 5, 1, 5); }
    b.fillStyle = P.L;                                         // shadows
    [[L.stool.x + 1, 16, 100], [L.tripod.x, 18, 101], [L.mx.x + 8, 18, 100], [L.table.x + 2, 14, 96]].forEach(([x, w, y]) => b.fillRect(x, y, w, 1));
    // clothesline hooks and the line itself
    const ln = L.line;
    b.fillStyle = P.K; b.fillRect(ln.x0 - 1, ln.y - 1, 2, 3); b.fillRect(ln.x1, ln.y - 1, 2, 3);
    b.fillStyle = P.B;
    for (let x = ln.x0; x <= ln.x1; x++) { const t = (x - ln.x0) / (ln.x1 - ln.x0); b.fillRect(x, ln.y + Math.round(3 * Math.sin(Math.PI * t)), 1, 1); }
    // screen frame (the roller and the pull)
    const s = L.scr;
    b.fillStyle = P.K; b.fillRect(s.x - 2, s.y - 3, s.w + 4, 3); b.fillStyle = P.B; b.fillRect(s.x - 1, s.y - 2, s.w + 2, 1);
    b.fillStyle = P.K; b.fillRect(s.x - 1, s.y, 1, s.h); b.fillRect(s.x + s.w, s.y, 1, s.h);
    b.fillRect(s.x - 1, s.y + s.h, s.w + 2, 3); b.fillStyle = P.B; b.fillRect(s.x, s.y + s.h + 1, s.w, 1);
    b.fillStyle = P.K; const pc = s.x + (s.w >> 1); b.fillRect(pc, s.y + s.h + 3, 1, 3); b.fillRect(pc - 1, s.y + s.h + 6, 3, 1);
    // a framed sign on the wall: where and when
    const sg = 'LONDON 1861', sw = textW(sg) + 6, sx = Math.max(24, Math.min(L.scr.x - sw - 6, 30));
    b.fillStyle = P.K; b.fillRect(sx, 45, sw, 11); b.fillStyle = P.L; b.fillRect(sx + 1, 46, sw - 2, 9);
    b.fillStyle = P.W; b.fillRect(sx + 2, 47, sw - 4, 7); text(b, sg, sx + 3, 48, P.K);
    b.fillStyle = P.B; b.fillRect(sx + (sw >> 1), 42, 1, 3); b.fillStyle = P.K; b.fillRect(sx + (sw >> 1) - 1, 41, 3, 1);
    // still life: the table, the stool, the tripod
    spr(b, S.table, 0, L.table.x, L.table.y);
    spr(b, S.stool, 0, L.stool.x, L.stool.y);
    spr(b, S.tripod, 0, L.tripod.x, L.tripod.y);
  }

  function spr(c, sp, f, x, y, o) { InkSprite.draw(c, sp, f, x + sp.w / 2, y + sp.h / 2, 1, o); }
  const grey = v => { const g = Math.round(255 * Math.max(0, Math.min(1, v))); return `rgb(${g},${g},${g})`; };
  const fmt = v => (Math.round(100 * v) / 100).toFixed(2);

  // a Bresenham line (dotted when step > 1)
  function line(c, x0, y0, x1, y1, col, step) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0; c.fillStyle = col;
    for (;;) {
      if (!step || n % step === 0) c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } n++;
    }
  }

  // a Bloch-ball character at (x, y) top-left, in colour rgb, with its arrow v (x, y, z; length <= 1)
  function drawBloch(c, rgb, v, x, y, frame, alpha) {
    const sp = blochFor(rgb), cx0 = x + 11.5, cy0 = y + 11.5;
    c.save(); if (alpha != null) c.globalAlpha = alpha;
    spr(c, sp, frame, x, y);
    if (v) {   // the arrow, seen from a little to one side: +X (red) to the right, +Z (white) up, +Y receding
      const sx = 0.92 * v[0] - 0.38 * v[1], sy = v[2] - 0.3 * v[1], len = Math.hypot(sx, sy);
      const ink = lum(rgb) < 0.42 ? P.W : P.K;
      if (len > 0.08) {
        const tx = cx0 + 9 * sx, ty = cy0 - 9 * sy, steep = Math.abs(sy) > Math.abs(sx);
        line(c, cx0, cy0, tx, ty, ink); line(c, cx0 + (steep ? 1 : 0), cy0 + (steep ? 0 : 1), tx + (steep ? 1 : 0), ty + (steep ? 0 : 1), ink);
        c.fillStyle = ink; c.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
      }
      c.fillStyle = ink; c.fillRect(Math.round(cx0), Math.round(cy0), 1, 1);
      // keep the face on top of the arrow
      c.save(); c.beginPath(); c.rect(x + 7, y + 7, 10, 3); c.rect(x + 9, y + 11, 6, 3); c.clip(); spr(c, sp, frame, x, y); c.restore();
    }
    c.restore();
  }

  function drawPlate(c, p, val, label, dy) {
    const x = p.x, y = p.y + (dy || 0);
    c.fillStyle = P.K; c.fillRect(x, y, p.w, p.h);
    c.fillStyle = P.B; c.fillRect(x + 1, y + 1, p.w - 2, p.h - 2);
    c.fillStyle = grey(val); c.fillRect(x + 2, y + 2, p.w - 4, p.h - 4);
    c.fillStyle = P.K; c.fillRect(x + (p.w >> 1) - 1, y - 3, 3, 5);   // peg
    c.fillStyle = P.L; c.fillRect(x + (p.w >> 1), y - 2, 1, 3);
    // the letter on a tab in the corner, the measured number underneath
    c.fillStyle = P.K; c.fillRect(x + 2, y + 2, 5, 7); text(c, label, x + 3, y + 3, P.W);
    const t = fmt(val); text(c, t, x + (p.w >> 1) - (textW(t) >> 1), y + p.h + 2, P.K);
  }

  function miniPlate(c, x, y, val) {
    c.fillStyle = P.K; c.fillRect(Math.round(x) - 4, Math.round(y) - 5, 8, 10);
    c.fillStyle = grey(val); c.fillRect(Math.round(x) - 3, Math.round(y) - 4, 6, 8);
  }

  const bez = (a, b, h, t) => { const mx = (a.x + b.x) / 2, my = Math.max(2, Math.min(a.y, b.y) - h); const u = 1 - t; return {x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y}; };
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

  // ---- the shoot sequence timeline (seconds)
  const SHOT = [0.25, 1.5, 2.75], DONE = 4.7;
  function seqState(t) {
    const st = {landed: [false, false, false], flying: null, flash: false, shootPose: false, flinch: false, filter: null,
      filterY: 0, busy: false, lit: 0, step: null};
    SHOT.forEach((b, i) => {
      if (t >= b + 1.45) st.landed[i] = true;
      if (t >= b - 0.25 && t < b + 0.65) st.step = {k: i, phase: 'shoot'};
      if (t >= b + 0.65 && t < b + 1.45) st.step = {k: i, phase: 'machine'};
      if (t >= b && t < b + 0.18) st.flash = true;
      if (t >= b - 0.1 && t < b + 0.35) st.shootPose = true;
      if (t >= b && t < b + 0.3) st.flinch = true;
      if (t >= b + 0.15 && t < b + 0.65) st.flying = {k: i, out: true, u: (t - b - 0.15) / 0.5};
      if (t >= b + 0.65 && t < b + 0.95) st.busy = true;
      if (t >= b + 0.95 && t < b + 1.45) st.flying = {k: i, out: false, u: (t - b - 0.95) / 0.5};
      if (t >= b - 0.25 && t < b + 0.6) { st.filter = i; st.filterY = Math.round(16 * (1 - ease((t - b + 0.25) / 0.2))); }
    });
    if (t >= 4.2) { st.lit = Math.min(1, (t - 4.2) / 0.4); st.step = {phase: 'rebuild'}; }
    return st;
  }

  function mood() {
    if (!model) return 'idle';
    return model.miss < 0.15 ? 'happy' : model.miss < 0.5 ? 'hmm' : 'oops';
  }

  function draw(t) {
    if (!ax || !model) return;
    const T = now(), sq = seq ? seqState(T - seq.t0) : null, rm = reduced();
    ax.drawImage(bg, 0, 0);
    const m = model;
    // light rays from the plates to the screen, behind everything (decoration)
    const lit = sq ? sq.lit : 1;
    if (lit > 0) {
      ax.save(); ax.globalAlpha = 0.55 * lit;
      L.plates.forEach(p => line(ax, p.x + p.w, p.y + 11, L.scr.x, L.scr.y + 24, P.O, 2));
      ax.restore();
    }
    // the plates on the line
    const dyB = !rm && T - bounceAt < 0.35 ? -Math.round(2 * Math.sin(Math.PI * (T - bounceAt) / 0.35)) : 0;
    L.plates.forEach((p, i) => { if (!sq || sq.landed[i]) drawPlate(ax, p, m.plates[i].m, 'XYZ'[i], dyB); });
    // the screen and the rebuilt portrait
    const s = L.scr;
    ax.fillStyle = lit >= 1 ? P.W : P.T; ax.fillRect(s.x, s.y, s.w, s.h);
    if (lit > 0) {
      const pf = m.miss < 0.15 ? 3 : m.miss >= 0.5 ? 4 : 0;
      drawBloch(ax, m.rebuilt, m.vr, s.x + 10, s.y + 6, pf, lit);
      ax.save(); ax.globalAlpha = lit; text(ax, 'REBUILT', s.x + (s.w >> 1) - (textW('REBUILT') >> 1), s.y + s.h - 8, P.K); ax.restore();
    } else text(ax, '?', s.x + (s.w >> 1) - 3, s.y + (s.h >> 1) - 5, P.L, 2);
    // the colour top (click it to spin)
    const spin = !rm && T - topSpinAt < 1.6;
    spr(ax, S.colourTop, spin ? Math.floor(T * 10) % 2 : 0, L.top.x, L.top.y);
    // the machine that stores and measures the numbers
    const busy = sq && sq.busy, fr = rm ? 0 : Math.floor(T * (busy ? 12 : 2));
    if (m.kind === 'hw') {
      ax.fillStyle = P.K; ax.fillRect(L.mcx - 15, 0, 30, 1);
      spr(ax, S.fridge, fr % 2, L.mcx - 13, 1);
      spr(ax, S.chip, (busy ? fr : Math.floor(fr / 2)) % 2, L.mcx - 8, 30);
      ax.fillStyle = P.B; ax.fillRect(L.mcx - 3, 46, 1, 44); ax.fillRect(L.mcx + 2, 46, 1, 44);   // coax down to the rack
      ax.fillStyle = P.K; ax.fillRect(L.mcx - 7, 88, 14, 9); ax.fillStyle = P.L; ax.fillRect(L.mcx - 6, 89, 12, 7);
      ax.fillStyle = P.B; for (let i = 0; i < 3; i++) ax.fillRect(L.mcx - 4 + i * 4, 91, 2, 2);
    } else {
      spr(ax, S.table, 0, L.mcx - 9, 82); ax.fillStyle = P.L; ax.fillRect(L.mcx - 7, 96, 14, 1);
      spr(ax, m.kind === 'noise' ? S.simNoisy : S.sim, m.kind === 'noise' ? Math.floor(T * (busy ? 12 : 3)) % 2 : fr % 2, L.mcx - 12, 57);
    }
    if (busy && !rm) {   // a decorative "working" glint
      const q = L.machineIn(); ax.fillStyle = P.O; ax.fillRect(q.x - 1 + (fr % 3) - 1, q.y - 1, 2, 2);
    }
    // plaque: which machine, how many shots
    const l1 = m.plaque, l2 = `${m.shots} SHOTS`, pw = Math.max(textW(l1), textW(l2)) + 6, px = W - 2 - pw;
    ax.fillStyle = P.K; ax.fillRect(px, 98, pw, 14); ax.fillStyle = P.W; ax.fillRect(px + 1, 99, pw - 2, 13);
    text(ax, l1, px + 3, 100, P.K); text(ax, l2, px + 3, 106, P.B);
    // the sitter on its stool, wearing Maxwell's tartan ribbon
    const blink = !rm && (T % 5.3) < 0.14;
    const sf = sq && sq.flinch ? 2 : (!sq && model.miss < 0.15 && T - moodAt < 2.5 && !rm) ? 3 : blink ? 1 : 0;
    const hop = !rm && T - bounceAt < 0.3 ? -Math.round(3 * Math.sin(Math.PI * (T - bounceAt) / 0.3)) : 0;
    drawBloch(ax, m.sent, m.vs, L.sitter.x, L.sitter.y + hop, sf);
    spr(ax, S.bow, 0, L.bow.x, L.bow.y + hop);
    // the camera, its filter and the flash
    spr(ax, S.camera, sq && sq.flash ? 1 : 0, L.cam.x, L.cam.y);
    if (sq && sq.filter != null) spr(ax, S['filter' + 'XYZ'[sq.filter]], 0, L.lens.x - 5, L.lens.y - 6 - sq.filterY);
    if (sq && sq.flash) spr(ax, S.flash, Math.floor(T * 20) % 2, L.lens.x - 12, L.lens.y - 5);
    // Maxwell
    const md = mood(), mb = !rm && (T % 4.1) < 0.15;
    let ms = S.mxIdle, mf = mb ? 1 : 0, holds = true;
    if (sq && sq.shootPose) { ms = S.mxShoot; mf = sq.flash ? 1 : 0; }
    else if (!sq && md !== 'idle' && model.react) {
      ms = md === 'happy' ? S.mxHappy : md === 'hmm' ? S.mxHmm : S.mxOops;
      const fresh = !rm && T - moodAt < 1.8;
      mf = md === 'happy' ? (fresh ? Math.floor(T * 3) % 2 : 1) : (fresh ? Math.floor(T * 2) % 2 : mb ? 1 : 0);
      holds = md === 'happy' && mf === 1;
    }
    // the shutter bulb on its tube: in his hand, or dangling from the camera
    ax.fillStyle = P.B;
    if (ms === S.mxShoot) line(ax, L.mx.x + 6, L.mx.y + 30, L.cam.x + 26, L.cam.y + 14, P.B);
    else if (holds) line(ax, L.mx.x + 2, L.mx.y + 37, L.cam.x + 25, L.cam.y + 15, P.B);
    else { line(ax, L.cam.x + 25, L.cam.y + 15, L.cam.x + 24, L.cam.y + 22, P.B); ax.fillStyle = P.K; ax.fillRect(L.cam.x + 22, L.cam.y + 22, 4, 4); ax.fillStyle = P.B; ax.fillRect(L.cam.x + 23, L.cam.y + 23, 2, 2); }
    spr(ax, ms, mf, L.mx.x, L.mx.y);
    // a plate in flight: the number going in, then the number that came back
    if (sq && sq.flying) {
      const f = sq.flying, a = f.out ? {x: L.cam.x + 27, y: L.cam.y + 4} : L.machineIn(), p = L.plates[f.k];
      const b = f.out ? L.machineIn() : {x: p.x + (p.w >> 1), y: p.y + (p.h >> 1)};
      const q = bez(a, b, 26, ease(f.u));
      miniPlate(ax, q.x, q.y, f.out ? m.plates[f.k].s : m.plates[f.k].m);
    }
    // up-scale by a whole number, no smoothing
    cx.imageSmoothingEnabled = false;
    cx.drawImage(art, 0, 0, W * k, H * k);
    lastDraw = T;
    if (sq) narrate(sq, T - seq.t0);
  }

  let lastLine = '';
  function narrate(sq, t) {
    let line_ = '';
    const m = model, st = sq.step;
    if (!st) line_ = 'Ready. Three photos coming up, through three filters.';
    else if (st.phase === 'shoot') line_ = `Photo ${st.k + 1} of 3, through the ${'XYZ'[st.k]} filter: the plate holds how far the arrow points along ${'XYZ'[st.k]}, ${fmt(m.plates[st.k].s)}.`;
    else if (st.phase === 'machine') line_ = `${m.machineName} stores ${fmt(m.plates[st.k].s)} on qubits and measures it back, ${m.shots} shots: it came back ${fmt(m.plates[st.k].m)}.`;
    else line_ = 'Three plates, one colour: putting the colour back together from the three numbers (classical).';
    if (line_ !== lastLine) { lastLine = line_; onSay({mood: 'idle', text: line_, live: false}); }
  }

  function finish() {
    seq = null; moodAt = now(); bounceAt = now(); model.react = true; lastLine = '';
    onSay({mood: mood(), text: model.say, live: true}); onState(false);
  }

  function loop() {
    raf = 0;
    if (!ax) return;
    const T = now();
    if (seq && T - seq.t0 >= DONE) finish();
    const busy = !!seq || T - bounceAt < 0.5 || T - moodAt < 2 || T - topSpinAt < 1.7;
    if (busy || (!reduced() && T - lastDraw > 0.09)) draw();
    if (visible && !document.hidden && (busy || !reduced())) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && ax) raf = requestAnimationFrame(loop); };

  function resize() {
    if (!cv) return;
    const wrap = cv.parentElement, dpr = window.devicePixelRatio || 1, avail = Math.max(MINW, Math.floor(wrap.clientWidth * dpr));
    const k2 = Math.max(1, Math.floor(avail / MINW)), W2 = Math.max(MINW, Math.min(MAXW, Math.floor(avail / k2)));
    if (k2 !== k || W2 !== W || !art) {
      k = k2; W = W2; layout();
      art = document.createElement('canvas'); art.width = W; art.height = H; ax = art.getContext('2d'); ax.imageSmoothingEnabled = false;
      cv.width = W * k; cv.height = H * k; cx = cv.getContext('2d');
      paintBg();
    }
    cv.style.width = (W * k / dpr) + 'px'; cv.style.height = (H * k / dpr) + 'px';
    draw();
  }

  // hit regions (art pixels) for clicks on the canvas
  function hit(e) {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (x >= L.cam.x - 4 && x < L.mx.x + 32 && y >= L.cam.y - 14 && y < 100) return 'camera';
    if (x >= 0 && x < 25 && y >= 52 && y < 100) return 'sitter';
    if (x >= L.top.x - 2 && x < L.top.x + 16 && y >= L.top.y - 2 && y < L.top.y + 26) return 'top';
    return null;
  }

  return {
    mount(canvas, handlers) {
      cv = canvas; onSay = handlers.say || onSay; onState = handlers.state || onState;
      cv.addEventListener('click', e => { const h = hit(e); if (h && handlers.click) handlers.click(h); });
      cv.addEventListener('pointermove', e => { cv.style.cursor = hit(e) ? 'pointer' : 'default'; });
      if (window.ResizeObserver) new ResizeObserver(resize).observe(cv.parentElement);
      if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(cv);
      document.addEventListener('visibilitychange', kick);
      resize();
    },
    set(m, why) {      // why: 'load' | 'change'
      model = Object.assign({}, m);
      if (why === 'change') { bounceAt = now(); if (!seq) { moodAt = now(); model.react = true; } }
      else model.react = true;
      if (!seq) onSay({mood: mood(), text: model.say, live: why === 'change'});
      draw(); kick();
    },
    shoot() {
      if (!model) return;
      if (seq || reduced()) { if (seq) finish(); else { moodAt = now(); onSay({mood: mood(), text: model.say, live: true}); } draw(); kick(); return; }
      seq = {t0: now()}; lastLine = ''; onState(true); kick();
    },
    spinTop() { topSpinAt = now(); kick(); },
    hop() { bounceAt = now(); kick(); },
    playing: () => !!seq,
    resize,
    drawBloch,
    // for tests
    _seqState: seqState, _text: text, _font: FONT,
  };
})();
