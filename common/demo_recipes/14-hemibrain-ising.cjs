// Demo clip for 14 Hemibrain Ising, "Ride the metro inside a fly's head" (~8 s).
// The scene canvas fills the frame (runtime restyle only, nothing in the piece is edited): the stage is laid out at
// 782 px wide so FIG. 1C (the memory network's metro map of 20 real hemibrain neurons) is drawn large beside the fly,
// with the status line and the conductor (signal, Depart, route) in a narrow column on the right.
//   1. Depart on the IBM train: real ibm_fez hardware samples arrive one per second and the station lamps switch in a
//      wave that spreads from the train; the status line counts the lines in step and the fly's mood follows.
//   2. A tap on MBON35 at the top of the map: the IBM train rides the lines up there while samples keep arriving.
//   3. A tap on the Gibbs steam train in the depot switches sampler mid-ride (the steam train finishes the trip).
//   4. Journey 160 + Depart: consecutive classical Gibbs samples flicker through the lamps (one every 0.26 s), the
//      status line counts the lines in step, and the fly buzzes its wings when they fall into step (29 of 30 or more).
//   5. A tap on MBON12-1 sends the steam train puffing down across the map while the journey keeps running.
// A drawn pointer follows the real mouse events (the recorder does not draw the OS cursor), with a ring on each press.
// Timing: the browser's video starts after record_demo.cjs's clock, by a varying 0.2-1.5 s (measured over three takes),
// so the cut opens anywhere in the first ~1.5 s of the recipe. Depart is pressed at once, so the clip opens either on
// the press or on the hardware samples already running; everything after that sits at fixed recipe times from 1.7 s.
module.exports = async (page, h) => {
  const T0 = Date.now(), at = ms => h.wait(Math.max(0, T0 + ms - Date.now()));
  // 1) frame: the stage fills the viewport (the canvas lays itself out at 782 px: 613 px tall, its 16 px pads trimmed)
  await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `html,body{overflow:hidden!important}
      #demo-bg{position:fixed;inset:0;background:#FBFAF9;z-index:40}
      #stage{position:fixed!important;left:0!important;top:0!important;width:782px!important;height:600px!important;overflow:hidden!important;z-index:50!important;margin:0!important;border-width:0 1px 0 0!important}
      #scene{margin-top:-6px!important}
      #status,.conductor{position:fixed!important;left:790px!important;width:164px!important;z-index:50!important;margin:0!important;box-sizing:border-box}
      #status{display:grid!important;gap:.4rem!important;justify-items:start}
      #status .moodbox{flex-wrap:wrap}
      .conductor{grid-template-columns:minmax(0,1fr)!important;grid-template-areas:'who' 'go' 'slide' 'route' 'cap'!important}
      .conductor #play{min-width:0!important}
      .conductor .route{display:grid!important}
      .toast{z-index:60!important}
      #demo-cursor{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;width:26px;height:26px;transform:translate(870px,250px)}
      #demo-cursor svg{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      #demo-cursor i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:3px solid #B4541A;background:rgba(180,84,26,.18);opacity:0;transform:scale(.5);transition:opacity .1s,transform .1s}
      #demo-cursor.down i{opacity:1;transform:scale(1)}`;
    document.head.appendChild(css);
    const bg = document.createElement('div'); bg.id = 'demo-bg'; document.body.appendChild(bg);
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<i></i><svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const mv = e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', mv, true);
    addEventListener('pointerdown', e => { mv(e); cur.classList.add('down'); }, true);
    addEventListener('pointerup', () => setTimeout(() => cur.classList.remove('down'), 110), true);
    layoutScene(); drawScene();
    let y = 6; for (const s of ['#status', '.conductor']) { const e = document.querySelector(s); e.style.top = y + 'px'; y += e.getBoundingClientRect().height + 8; }
  });
  // screen positions, read from the page's own layout
  const stationAt = i => page.evaluate(i => { const r = document.getElementById('scene').getBoundingClientRect(), k = r.width / LAY.w, [x, y] = SP_XY(i); return {x: r.left + x * k, y: r.top + y * k}; }, i);
  const depot = id => page.evaluate(id => { const r = document.getElementById('scene').getBoundingClientRect(), k = r.width / LAY.w, o = depotSlots().find(s => s.id === id); return {x: r.left + o.x * k, y: r.top + o.y * k}; }, id);
  const el = sel => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top + b.height / 2}; }, sel);
  let px = 870, py = 250;
  const glide = async (to, ms) => {                    // a hand-paced pointer move, timed by the clock
    const x0 = px, y0 = py, t0 = Date.now();
    for (;;) { const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      await page.mouse.move(x0 + (to.x - x0) * e, y0 + (to.y - y0) * e); if (t >= 1) break; await h.wait(16); }
    px = to.x; py = to.y;
  };
  const tap = async () => { await page.mouse.down(); await h.wait(70); await page.mouse.up(); };
  await page.mouse.move(px, py);

  // 2) Depart on the IBM train: ibm_fez hardware samples switch the lamps in a wave from the train (one per second)
  await h.wait(250);
  await glide(await el('#play'), 300); await tap();
  // 3) tap MBON35 at the top of the map: the train rides the lines up there while the samples keep arriving
  await at(1700);
  await glide(await stationAt(13), 450); await tap();
  // 4) the Gibbs steam train from the depot takes over mid-ride (switching train holds the samples)
  await at(3300);
  await glide(await depot('gibbs'), 450); await tap();
  // 5) Journey 160 + Depart: consecutive Gibbs samples flicker through the lamps, the fly's mood follows the lines
  await at(4050);
  await glide(await el('#seg-route button[data-r="chain"]'), 400); await tap();
  await h.wait(80);
  await glide(await el('#play'), 220); await tap();
  // 6) tap MBON12-1: the steam train puffs down across the map while the journey's samples keep switching the lamps
  await at(5050);
  await glide(await stationAt(8), 420); await tap();
  await glide({x: px + 40, y: py + 70}, 300);
  await at(7600);
};
