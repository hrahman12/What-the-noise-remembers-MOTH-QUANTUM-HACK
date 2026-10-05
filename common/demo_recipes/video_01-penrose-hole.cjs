// Video take (~37 s) for the Challenge 01 demo video: 01 The Hole in the Penrose, played start to finish by one user.
//   0  The scene: the Penrose tiling with the 20-qubit blur-v1 hole (hero setting, hole at (512, 512)), the nibbler on
//      the rim, the headline beside it. A pointer glides in; over the tiling the mender moth becomes the cursor.
//   1  Paint: three unhurried strokes with the repair brush (80 px). Tiles pop back with sparkles, the meter climbs,
//      the nibbler startles and sweats. The column on the right scrolls to the "Paint / Move / Compare" steps.
//   2  "Restore the rest": the column scrolls to the control panel and readout; the button is clicked and the
//      remaining tiles drop back from the rim inward; toast, sparkles, the nibbler flees.
//   3  Move hole: the tool is picked and the hole dragged right; it snaps to (724, 512), a different engine job fills
//      it (readout: hole and job ID change), and the nibbler flies back to chomp.
//   4  Compare: the wipe line is dragged across the hole (original on its left) and settles mid-hole: original on the
//      left, engine output on the right.
//   5  The 12-job sweep: "Show the 12-job sweep" puts the hole at (580, 440) with the hero job (c868dccb...), then
//      strength 0.3, reach 0 and gate ry are picked in turn: four real jobs, each with its params and job ID in the
//      readout and the nibbler's measured belly.
//   6  Data: the view is switched to Data (the moths leave the canvas; the hole shows the job exactly as downloaded),
//      the page scrolls to Figure 1 (hero.png drawn live: intact / erased by blur-v1 / rebuilt) and Figure 2 (the
//      sweep), and the strength 0.6 rx reach 0.0 cell is clicked: it loads in the scene and the page scrolls back.
// Framing: runtime CSS only (nothing on disk): the scene column is 596 px wide so the canvas fills the 600 px height,
// and the stage is position:sticky, so the page scrolls the right-hand column (headline, steps, panel, readout)
// beside a pinned scene, the way a reader scrolls it. The toast is centred over the stage. A drawn arrow pointer
// (an overlay added at runtime, since headless video shows no cursor) marks what is clicked; it hides over the
// tiling while the repair brush is the tool, because there the mender moth is the page's own cursor.
// Everything is driven in-page and timed by the clock (Playwright mouse round-trips take 100-350 ms each while
// recording and headless rAF runs at ~10-20 fps): pointer events are sub-stepped on the canvas, buttons are clicked
// with element.click(), so every effect is the page's own code. The one exception is "Restore the rest", whose own
// loop adds 6 tiles per frame (several seconds at headless frame rates): as in 01-penrose-hole.cjs it is replayed by
// the clock with the page's addTile / sparkleAt / checkDone and its "auto running" state, over 1.3 s.
// Lead-in: the recorder trims from its own clock, so the clip opens at recipe time ~(first-paint - 170 ms); we wait
// that out plus 0.4 s so the clip always opens on the prepared scene.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `
    .hero{grid-template-columns:596px minmax(0,1fr)!important}
    .stage{position:sticky!important;top:2px!important}
    .side{padding-bottom:24px!important}
    html{scroll-behavior:auto!important}
    #vcur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:24px;height:32px;transition:opacity .12s;will-change:transform}
    #vcur svg{display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}
    .vrip{position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2.5px solid #19238E;background:rgba(25,35,142,.12)}` });
  await page.evaluate(() => {
    POS.forEach(p => img(p.file)); SWEEP.forEach(p => img(p.file));     // every job crop preloaded: no grey disc
    if (typeof loadSheet === 'function') loadSheet();
    const b = document.getElementById('brush'); b.value = 80; b.dispatchEvent(new Event('input'));
    window.dispatchEvent(new Event('resize'));
    const stage = document.getElementById('stage');
    scrollTo(0, stage.getBoundingClientRect().top + scrollY - 2);
    const r = stage.getBoundingClientRect(), t = document.getElementById('toast');
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.bottom = (innerHeight - r.bottom + 64) + 'px';
    const c = document.createElement('div'); c.id = 'vcur';
    c.innerHTML = '<svg width="24" height="32" viewBox="0 0 24 32"><path d="M2 2 L2 24.5 L7.6 19.4 L11.4 28.2 L15.2 26.6 L11.5 18 L19.4 18 Z" fill="#FBFAF9" stroke="#18161A" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    c.style.transform = 'translate(818px,318px)';
  });
  // wait for every job image and both figures' images to be decoded
  await page.waitForFunction(() => Object.values(imgs).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
  await h.wait(Math.max(150, Math.max(0, Math.min(2500, fp) - 170) + 400 - (Date.now() - r0)));

  await page.evaluate(() => (async () => {
    const $ = id => document.getElementById(id), cv = $('cv'), cur = $('vcur');
    const clock = () => performance.now(), sleep = ms => new Promise(r => setTimeout(r, ms)), nextFrame = () => new Promise(r => requestAnimationFrame(r));
    const easeIO = a => a < .5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
    const easeS = a => a < .5 ? 2 * a * a : 1 - 2 * (1 - a) * (1 - a);
    const tween = async (D, f, e = easeIO) => { const t0 = clock(); for (;;) { const lin = Math.min(1, (clock() - t0) / D); f(e(lin), lin); if (lin >= 1) return; await nextFrame(); } };
    const S = (x, y) => { const R = cv.getBoundingClientRect(), k = R.width / 1024; return [R.left + x * k, R.top + y * k]; };   // canvas units -> client px
    const docTop = sel => document.querySelector(sel).getBoundingClientRect().top + scrollY;
    const docBot = sel => document.querySelector(sel).getBoundingClientRect().bottom + scrollY;
    const pinMax = () => docBot('.hero') - 598;            // the furthest scroll at which the stage stays pinned at top 2 px

    // ---- the pointer: an overlay arrow plus the pointer events the page listens to ----
    const C = { x: 818, y: 318, down: false, over: false, press: false };
    const place = () => {
      cur.style.transform = `translate(${C.x - 2}px,${C.y - 2}px) scale(${C.press ? .84 : 1})`;
      cur.style.opacity = (C.over && st.tool === 'brush' && st.view === 'scene') ? 0 : 1;   // the mender is the brush cursor
    };
    const fire = (type, x, y, buttons, bubbles = true) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles, button: 0, buttons }));
    const feed = () => {
      const el = document.elementFromPoint(C.x, C.y), over = el === cv;
      if (over || C.down) fire('pointermove', C.x, C.y, C.down ? 1 : 0);
      else if (C.over) fire('pointerleave', C.x, C.y, 0, false);
      C.over = over; place();
    };
    // travel a polyline (client px) over D ms, by the clock; sub-stepped every ~9 px so a brush swath has no gaps
    const travel = async (pts, D, e = easeIO) => {
      const L = [0]; for (let j = 1; j < pts.length; j++) L.push(L[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
      const tot = L[L.length - 1] || 1;
      const at = a => { const d = a * tot; let j = 1; while (j < pts.length - 1 && L[j] < d) j++;
        const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1); return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]; };
      let last = 0;
      await tween(D, a => {
        const n = C.down ? Math.max(1, Math.ceil(Math.abs(a - last) * tot / 9)) : 1;
        for (let i = 1; i <= n; i++) { const p = at(last + (a - last) * i / n); C.x = p[0]; C.y = p[1]; feed(); }
        last = a;
      }, e);
    };
    // a hand-like glide: a gentle arc from where the pointer is to (x, y)
    const glide = (x, y, D) => {
      const x0 = C.x, y0 = C.y, dx = x - x0, dy = y - y0, bend = .1 * (Math.hypot(dx, dy) > 40 ? 1 : 0);
      const mx = x0 + dx / 2 - dy * bend, my = y0 + dy / 2 + dx * bend, pts = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y]); }
      return travel(pts, D);
    };
    const ripple = () => { const r = document.createElement('div'); r.className = 'vrip'; r.style.left = C.x + 'px'; r.style.top = C.y + 'px'; document.body.appendChild(r);
      r.animate([{ transform: 'scale(.35)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => r.remove(); };
    const centre = el => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const click = async (el, D = 600) => {
      const [x, y] = centre(el); await glide(x, y, D);
      C.press = true; place(); ripple(); await sleep(90); el.click(); C.press = false; place(); await sleep(60);
    };
    const down = () => { C.down = true; fire('pointerdown', C.x, C.y, 1); };
    const up = () => { fire('pointerup', C.x, C.y, 0); C.down = false; feed(); };
    const scrollToY = (y, D) => { const y0 = scrollY; return tween(D, a => { scrollTo(0, y0 + (y - y0) * a); if (!C.down) place(); }); };
    const stroke = async (pts, D) => { const P = pts.map(p => S(...p)); await glide(P[0][0], P[0][1], 320); down(); await travel(P, D, easeS); up(); };

    // 0) the scene: the scrambled hole, the nibbler on the rim, the headline beside it
    await sleep(900);
    // 1) the pointer glides into the hole while the column scrolls to the steps; three brush strokes
    await Promise.all([scrollToY(docTop('.steps') - 34, 1300), glide(...S(300, 340), 1300)]);
    await stroke([[300, 340], [700, 320], [360, 440]], 1400);
    await stroke([[330, 520], [720, 500], [380, 620]], 1400);
    await stroke([[430, 705], [650, 712]], 800);
    await sleep(250);
    // 2) to the panel; "Restore the rest": the remaining tiles drop back from the rim inward, by the clock
    await Promise.all([scrollToY(Math.min(docTop('.panel') - 12, pinMax()), 1100), glide(860, 250, 1000)]);
    await click($('auto'), 600);
    await new Promise(done => {
      st.cursor = null;
      const c = hole(), rest = tilesFor(c).filter(i => !st.restored.has(i))
        .sort((a, b) => Math.hypot(TILES[b].cx - c.x, TILES[b].cy - c.y) - Math.hypot(TILES[a].cx - c.x, TILES[a].cy - c.y));
      const W = 1300, total = rest.length, t0 = clock(); let q = 0;
      anim = -1; $('auto').textContent = 'Pause';         // the page's "auto running" state: the mender flies the front
      const tick = () => {
        const a = Math.min(1, (clock() - t0) / W), goal = Math.round(a * total);
        let sx = 0, sy = 0, n = 0;
        while (q < goal) { const i = rest[q++]; addTile(i); sx += TILES[i].cx; sy += TILES[i].cy; n++; }
        if (n) { M.ax = sx / n; M.ay = sy / n; sparkleAt(M.ax, M.ay); }
        draw();
        if (a < 1) return requestAnimationFrame(tick);
        anim = null; $('auto').textContent = 'Restore the rest';
        checkDone(true); done();                            // toast, sparkles, the mender hops, the nibbler flees
      };
      requestAnimationFrame(tick);
    });
    await sleep(1100);
    // 3) Move hole: drag it right; it snaps to (724, 512) and a different engine job fills it
    await click($('t-move'), 700);
    $('toast').classList.remove('on');
    await glide(...S(512, 512), 550);
    down(); await travel([S(512, 512), S(625, 503), S(735, 515)], 1100); up();
    await sleep(1000);
    // 4) Compare: the wipe line peels the blur off, then settles mid-hole (original left, engine output right)
    await click($('t-wipe'), 650);
    await glide(...S(512, 512), 500);
    down(); await travel([S(512, 512), S(985, 512)], 1150); await sleep(200); await travel([S(985, 512), S(724, 512)], 850); up();
    await sleep(1100);
    await click($('t-brush'), 600);
    // 5) the 12-job sweep at the original hole (580, 440): hero job, then strength 0.3, reach 0, gate ry
    await Promise.all([scrollToY(Math.min(docTop('#tune-toggle') - 110, pinMax()), 900), glide(860, 230, 900)]);
    await click($('tune-toggle'), 450);
    await sleep(250);
    await scrollToY(Math.min(docBot('.readout') - 600 + 14, pinMax()), 700);
    for (const id of ['t-strength-0_3', 't-reach-0', 't-style-ry']) { await click($(id), 550); await sleep(850); }
    // 6) Data: the cast leaves the canvas; then the two live figures; pick a sweep cell and it loads in the scene
    await scrollToY(docTop('#g-view') - 230, 1000);
    await click(document.querySelector('#g-view [data-view="data"]'), 550);
    await sleep(1300);
    await scrollToY(docTop('#fig-tri') - 6, 1300);
    await sleep(2100);
    await scrollToY(docTop('#fig-sweep') - 6, 1100);
    await sleep(500);
    await click([...document.querySelectorAll('#sheet .sj')].find(b => b.dataset.k === 't6rx0'), 800);   // strength 0.6 rx reach 0.0
    await sleep(1100);                                       // the page's smooth scroll back to the scene
    await glide(880, 300, 700);
    await sleep(1200);
  })());
};
