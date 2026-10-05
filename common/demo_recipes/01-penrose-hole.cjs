// Demo (~8.5 s clip, GIF ~2.8 MB): 01 The Hole in the Penrose, the whole loop of the piece in one take.
//   1. The scrambled hole (20-qubit blur), the nibbler on the rim, the mender moth (your repair brush) poised.
//   2. Paint: the mender zigzags through the hole; tiles pop back with sparkles, the meter climbs, and the nibbler
//      startles and sweats as the brush comes near.
//   3. "Restore the rest": the remaining tiles drop back from the rim inward, the mender flying the front.
//   4. Restored: the toast, a burst of sparkles, the mender bounces and the nibbler flees.
//   5. Move hole: the tool is picked and the hole dragged right (dashed ring follows); it snaps to (724, 512), a new
//      engine job fills it, and the nibbler flies back to chomp.
//   6. Compare: the wipe line (the mender riding its handle) peels the blur off to show the original tiling beneath,
//      then settles mid-hole: original on the left, the engine output on the right.
// Framing: the page's own layout, scrolled to the stage, with one runtime tweak (injected CSS, nothing on disk):
// the scene column is widened to 596 px so the whole canvas fills the 600 px height, the sprites draw at the
// page's large size (3 px per sprite pixel), and the headline "Tear a hole in a pattern that never repeats."
// stays beside it. The toast is centred over the stage. A full-bleed canvas (as in highlight_01) costs ~0.55 MB/s
// of GIF here (VP8 re-quantises the dense tiling every few frames), this framing ~0.3 MB/s.
// Everything is driven in-page and timed by the clock: Playwright mouse round-trips take 100-350 ms each while
// recording and headless rAF runs at ~10-20 fps, so strokes are sub-stepped pointer events on the canvas and the
// toolbar buttons are clicked in-page. All effects (pops, sparkles, toast, nibbler moods, hole snap, wipe) are the
// page's own code: paint/move/wipe via its pointer handlers, the wave via addTile / sparkleAt / checkDone.
// Lead-in: the video starts at first paint but record_demo.cjs trims from its own clock, so the clip opens at
// recipe time ~(first-paint - 170 ms), measured. We wait that out plus 0.4 s so the clip always opens on the poised
// scrambled hole, whatever the first-paint time.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `.hero{grid-template-columns:596px minmax(0,1fr)!important}` });
  await page.evaluate(() => {
    const stage = document.getElementById('stage');
    stage.scrollIntoView({ block: 'center' });
    const r = stage.getBoundingClientRect(), t = document.getElementById('toast');
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.bottom = (innerHeight - r.bottom + 64) + 'px';
    POS.forEach(p => img(p.file));                         // every hole's blur preloaded: no grey disc on the move
    const b = document.getElementById('brush'); b.value = 100; b.dispatchEvent(new Event('input'));
    window.dispatchEvent(new Event('resize'));
  });
  await h.wait(60);
  await page.evaluate(() => {                              // the mender hovers at the top-left of the hole, brush ring on
    const cv = document.getElementById('cv'), R = cv.getBoundingClientRect(), k = R.width / 1024;
    cv.dispatchEvent(new PointerEvent('pointermove', { clientX: R.left + 330 * k, clientY: R.top + 360 * k, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true }));
  });
  await h.wait(Math.max(150, Math.max(0, Math.min(2500, fp) - 170) + 400 - (Date.now() - r0)));

  await page.evaluate(() => new Promise(done => {
    const cv = document.getElementById('cv'), clock = () => performance.now(), $ = id => document.getElementById(id);
    const R = cv.getBoundingClientRect(), k = R.width / 1024;
    const S = ([x, y]) => [R.left + x * k, R.top + y * k];   // canvas units -> client px
    const fire = (type, [x, y], buttons) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons }));
    const ease = a => a < .5 ? 2 * a * a : 1 - 2 * (1 - a) * (1 - a);
    const after = (ms, f) => setTimeout(f, ms);
    // a pointer drag along a polyline (canvas units) over D ms, by the clock, sub-stepped every ~22 canvas units so
    // a brush swath has no gaps at low fps; ends with pointerup
    const stroke = (pts, D, then, easeIt) => {
      const P = pts.map(S), L = [0];
      for (let j = 1; j < P.length; j++) L.push(L[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]));
      const at = a => { const d = a * L[L.length - 1]; let j = 1; while (j < P.length - 1 && L[j] < d) j++;
        const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1); return [P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f]; };
      const t0 = clock(); let last = 0;
      fire('pointermove', P[0], 0); fire('pointerdown', P[0], 1);
      const step = () => {
        const lin = Math.min(1, (clock() - t0) / D), a = easeIt ? ease(lin) : lin;
        const n = Math.max(1, Math.ceil(Math.abs(a - last) * L[L.length - 1] / (22 * k)));
        for (let i = 1; i <= n; i++) fire('pointermove', at(last + (a - last) * i / n), 1);
        last = a;
        if (lin < 1) return requestAnimationFrame(step);
        fire('pointerup', P[P.length - 1], 0);
        if (then) then();
      };
      requestAnimationFrame(step);
    };

    // 2) paint: a zigzag swath through the middle of the hole (centre 512,512, r 270)
    stroke([[330, 360], [690, 345], [350, 470], [700, 520], [345, 620], [690, 680]], 1400, () => {
      st.cursor = null;                                     // hand off to the wave: the mender flies the front
      // 3) "Restore the rest", by the clock: the remaining tiles pop back from the rim inward
      const c = hole(), rest = tilesFor(c).filter(i => !st.restored.has(i))
        .sort((a, b) => Math.hypot(TILES[b].cx - c.x, TILES[b].cy - c.y) - Math.hypot(TILES[a].cx - c.x, TILES[a].cy - c.y));
      const W = 900, total = rest.length, t0 = clock(); let q = 0;
      anim = -1; $('auto').textContent = 'Pause';           // the page's "auto running" state
      const tick = () => {
        const a = Math.min(1, (clock() - t0) / W), goal = Math.round(a * total);
        let sx = 0, sy = 0, n = 0;
        while (q < goal) { const i = rest[q++]; addTile(i); sx += TILES[i].cx; sy += TILES[i].cy; n++; }
        if (n) { M.ax = sx / n; M.ay = sy / n; sparkleAt(M.ax, M.ay); }
        draw();
        if (a < 1) return requestAnimationFrame(tick);
        anim = null; $('auto').textContent = 'Restore the rest';
        checkDone(true);                                    // 4) toast, sparkles, happy mender, the nibbler flees
        after(950, move);
      };
      requestAnimationFrame(tick);
    });

    // 5) Move hole: pick the tool, drag the hole right; it snaps to (724, 512), a new job fills it, the nibbler returns
    const move = () => {
      $('t-move').click();
      after(120, () => {
        $('toast').classList.remove('on');
        stroke([[512, 512], [610, 505], [735, 515]], 700, () => after(950, compare), true);
      });
    };
    // 6) Compare: the wipe line peels the blur off (original on its left), then settles mid-hole
    const compare = () => {
      st.wipe = .5; $('t-wipe').click();
      after(120, () => stroke([[512, 560], [905, 560]], 850, () =>
        after(80, () => stroke([[905, 560], [724, 560]], 450, () => after(250, done), true)), true));
    };
  }));
};
