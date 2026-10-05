// Highlight (~4.7 s): the Penrose tiling fills the frame with the quantum-scrambled hole in the middle.
// The mender moth sweeps a big repair brush through the hole (tiles pop back with sparkles), the rest of the
// hole fills in a wave from the rim inward (the page's own "Restore the rest" behaviour), the nibbler flees
// ("Restored!") ... then the hole jumps left: a fresh scrambled blur, the nibbler flies back, and the mender
// is already sweeping the new hole when the clip ends (motion to the last frame, and it loops into the start).
// Layout is changed only at runtime (injected CSS): the stage is pinned to the 960x600 viewport and the
// square canvas is shown 960 px wide, shifted up 180 px so the full hole sits centred; toolbar + meter stay.
// Everything is driven in-page and timed by the clock, not by frames: Playwright mouse.move round-trips take
// 100-350 ms each while the recorder runs, and headless rAF drops to ~10-20 fps here, so the page's own
// 6-tiles-per-frame "Restore the rest" would crawl. The wave uses the page's own addTile / sparkleAt /
// mender (M) / checkDone / keyboard handler, so pops, sparkles, the celebration and the hole move are real.
// Lead-in: Playwright's video starts at the page's first paint, but record_demo.cjs trims from its own clock
// (time since newPage), so a slow first paint (1.5 s measured under load) cuts that much off the start of the
// recipe. We wait out the first-paint time before the action so the clip opens just before the stroke.
// The tail: the recorder keeps filming ~1 s after the recipe returns (its 0.5 s wait + context close), so the
// recipe returns right as the second sweep starts and the page carries on by itself.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    #stage{position:fixed!important;left:0!important;top:0!important;width:960px!important;height:600px!important;z-index:50!important;border:0!important;margin:0!important}
    .pad{margin-top:-180px!important;width:960px!important;height:960px!important}
    #cv{width:960px!important;height:960px!important}
    .toast{z-index:60!important;bottom:64px!important}` });
  await page.evaluate(() => {
    POS.forEach(p => img(p.file));                       // preload every hole's blur so the jump never shows a grey disc
    const b = document.getElementById('brush'); b.value = 104; b.dispatchEvent(new Event('input'));
    window.dispatchEvent(new Event('resize'));
    // hover the mender over the top-left of the hole, ready to paint (canvas 380,330 -> screen 356,129)
    document.getElementById('cv').dispatchEvent(new PointerEvent('pointermove', { clientX: 380 * .9375, clientY: 330 * .9375 - 180, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true }));
  });
  await h.wait(Math.max(150, Math.min(2500, fp) + 250 - (Date.now() - r0)));   // ~0.25 s of the scrambled hole on screen

  await page.evaluate(() => {
    const cv = document.getElementById('cv'), clock = () => performance.now();
    const fire = (type, [x, y], buttons) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, button: 0, buttons }));
    // a brush stroke along a polyline (canvas units), timed by the clock and sub-stepped so the swath has no gaps
    // at low fps. canvas unit -> screen: x*0.9375, y*0.9375-180 (hole centre 512,512 -> 480,300, radius ~253 px)
    const sweep = (pts, D, then) => {
      const P = pts.map(([x, y]) => [x * .9375, y * .9375 - 180]);
      const L = [0]; for (let k = 1; k < P.length; k++) L.push(L[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
      const at = a => { const d = a * L[L.length - 1]; let k = 1; while (k < P.length - 1 && L[k] < d) k++;
        const f = (d - L[k - 1]) / (L[k] - L[k - 1] || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f]; };
      const t0 = clock(); let last = 0;
      fire('pointermove', P[0], 0); fire('pointerdown', P[0], 1);
      const step = () => {
        const a = Math.min(1, (clock() - t0) / D), n = Math.max(1, Math.ceil((a - last) * L[L.length - 1] / 24));
        for (let i = 1; i <= n; i++) fire('pointermove', at(last + (a - last) * i / n), 1);
        last = a;
        if (a < 1) return requestAnimationFrame(step);
        fire('pointerup', P[P.length - 1], 0); st.cursor = null;
        if (then) then();
      };
      requestAnimationFrame(step);
    };
    // 2) "Restore the rest", by the clock: remaining tiles pop back from the rim inward, the mender flying the front
    const wave = () => {
      const c = hole(), rest = tilesFor(c).filter(i => !st.restored.has(i))
        .sort((a, b) => Math.hypot(TILES[b].cx - c.x, TILES[b].cy - c.y) - Math.hypot(TILES[a].cx - c.x, TILES[a].cy - c.y));
      const W = 1100, total = rest.length, t0 = clock(); let done = 0;
      anim = -1;                                          // the page's "auto running" flag: mender flies to M.ax/M.ay
      const tick = () => {
        const a = Math.min(1, (clock() - t0) / W), goal = Math.round(a * total);
        let sx = 0, sy = 0, n = 0;
        while (done < goal) { const i = rest[done++]; addTile(i); sx += TILES[i].cx; sy += TILES[i].cy; n++; }
        if (n) { M.ax = sx / n; M.ay = sy / n; sparkleAt(M.ax, M.ay); }
        draw();
        if (a < 1) return requestAnimationFrame(tick);
        anim = null; checkDone();                         // -> "Restored!" toast, sparkles, happy mender, the nibbler flees
        // 3) ...then the hole jumps left (arrow key): a new scrambled blur, the nibbler flies back to chomp it,
        // 4) and the mender sweeps into the new hole (centre 300,512) straight away
        setTimeout(() => { document.getElementById('toast').classList.remove('on');
          cv.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); }, 850);
        setTimeout(() => sweep([[120, 400], [450, 420], [150, 560], [470, 640], [200, 730]], 1500), 1250);
      };
      requestAnimationFrame(tick);
    };
    // 1) the first sweep: a zigzag through the hole, then the wave
    sweep([[380, 330], [700, 340], [380, 470], [720, 560], [420, 690], [650, 740]], 1000, wave);
  });
  await h.wait(3250);   // sweep 1.0 s + wave 1.1 s + celebration 0.85 s, jump; returns as the second sweep begins
};
