// Demo clip for 17 Quantum Lenia (~9 s). The live petri dish on the left, Orbi, Play and the kernel lenses on the right.
// 1) Two Orbium are dropped with the pipette (press, drag to aim: the aim arrow, the squeeze, sparkles, new eyes).
// 2) Play: all seven Orbium glide off, their eyes looking the way each blob actually moves; Orbi hops.
// 3) The Blur 1.0 lens is swapped in (the real quantum-blurred kernel): the creatures swell, ghosts rise as each
//    one stops counting, life floods the dish, the fate strip replays the measured flood and Orbi turns dizzy.
// Layout is changed only at runtime (injected CSS + fixed positions): the dish is pinned to the left of the
// 960x600 viewport and the intro (Orbi + headline), the transport and the kernel lab are shown at 70 % on the right.
module.exports = async (page, h) => {
  const r0 = Date.now(), log = m => console.error(((Date.now() - r0) / 1000).toFixed(2) + 's ' + m);
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    #demo-bg{position:fixed;inset:0;background:var(--paper,#FBFAF9);z-index:40}
    #stage{position:fixed!important;left:10px;top:8px;width:568px;box-sizing:border-box;margin:0!important;z-index:50}
    .intro,.transport,#lab{position:fixed!important;left:598px;width:500px;box-sizing:border-box;transform:scale(.7);transform-origin:0 0;z-index:50;margin:0!important}
    .intro .sub,.intro .proof,.transport .hint,.transport .legend,#lab .readout,#lab #growth,#lab .row.split,#lab #share,#lab .fate small{display:none!important}
    #lab>.row:last-child{display:none!important}
    .hero{width:900px!important}   /* a width change, so the page's ResizeObserver refits the dish, lenses and strip */
    .toast{z-index:60!important}` });
  await page.evaluate(() => {
    const bg = document.createElement('div'); bg.id = 'demo-bg'; document.body.appendChild(bg);
    scrollTo(0, 0);
  });
  await h.wait(200);   // let the ResizeObserver refit the dish canvas, the lenses and the fate strip
  await page.evaluate(() => {
    let y = 8;
    for (const sel of ['.intro', '.transport', '#lab']) { const e = document.querySelector(sel); e.style.top = y + 'px'; y += e.offsetHeight * 0.7 + 8; }
  });
  const box = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const C = (cy, cx) => ({ x: box.x + (cx + 0.5) / 256 * box.w, y: box.y + (cy + 0.5) / 256 * box.h });   // cell -> screen
  await h.wait(Math.max(150, Math.min(2500, fp) + 150 - (Date.now() - r0)));
  log('start');

  const drop = async (a, b) => {   // press at a, drag towards b to aim, release: the pipette drops an Orbium heading a->b
    const p = C(...a), q = C(...b);
    await page.mouse.move(p.x + 40, p.y + 30); await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.down();
    await page.mouse.move(q.x, q.y, { steps: 8 });
    await h.wait(200);
    await page.mouse.up();
    await h.wait(120);
  };
  await drop([40, 214], [62, 192]);   // top right, heading down-left (clear of the toolbar)
  log('drop1');
  await drop([222, 100], [200, 84]);  // bottom, heading up-left
  log('drop2');
  await page.mouse.move(box.x + box.w + 8, box.y + box.h / 2);   // off the dish: no tool cursor
  await h.wait(250);
  await page.evaluate(() => document.getElementById('play').click());
  log('play');
  await h.wait(1500);
  await page.evaluate(() => [...document.querySelectorAll('#g-set .lens')].find(b => b.textContent.includes('Blur 1.0')).click());
  log('blur 1.0');
  await h.wait(5200);   // ~120 steps of the blurred kernel: lattices swell, ghosts rise, Orbi gasps
  log('done');
};
