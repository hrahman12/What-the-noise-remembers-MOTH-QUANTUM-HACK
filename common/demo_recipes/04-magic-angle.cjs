// Demo clip, 04 Magic Angle (~6.5 s). The twist turntable fills the frame. A real mouse drag turns the rim grip
// from 0.3 to 4 degrees on the Original layers: Ay and Bee strain and tilt apart, the single ink blob on the record
// splits into a moire crystal that keeps shrinking, Lec wakes up and starts hopping between AA spots. A click on
// "Quantum morph" scrambles the record, then the grip is dragged back up to the 1.1-degree magic angle: the FFT
// needle skips, the register's Echo ghost appears, Ay and Bee get puzzled, Lec goes dizzy, and the readout says
// "magic angle zone - not resolved". A poke on Bee makes it jump.
// Page files are untouched: the layout is restyled in the browser only for the recording (turntable 667x600 on the
// left, readout column on the right), and a small pointer overlay shows where the mouse is.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const firstPaint = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `
      html,body{overflow:hidden!important}
      #stage{position:fixed!important;inset:0;z-index:60;display:grid!important;grid-template-columns:667px minmax(0,1fr);border:0!important;background:var(--paper)!important;margin:0}
      #v-scene{grid-column:1;grid-row:1;width:667px;height:600px}
      #scene{width:667px!important;height:600px!important;aspect-ratio:auto!important}
      #stage .meter{grid-column:2;grid-row:1;border-top:0!important;border-left:1px solid var(--ink);display:flex!important;flex-direction:column;justify-content:flex-start;gap:1rem;padding:4.2rem 1.2rem 1.4rem!important}
      #stage .mrow{flex-direction:column;align-items:flex-start;gap:.8rem}
      #stage .meter .ang{font-size:4.4rem!important;line-height:.95}
      #stage .badge{display:inline-block!important;visibility:hidden;margin:.7rem 0 0!important}
      #stage .badge.on{visibility:visible}
      #stage .meter .per{text-align:left!important;margin-left:0!important;font-size:.82rem!important;line-height:1.6}
      #stage .say{font-size:.9rem!important;line-height:1.45;min-height:7.9em}
      #stage .dm-kicker{margin:0;font:500 .72rem/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
      #stage .dm-title{margin:0;font:400 1.85rem/1.02 var(--display);letter-spacing:-.02em;color:var(--ink)}
      #stage .seg{align-self:flex-start}
      .toast{display:none!important}
      #dm-cursor{position:fixed;left:0;top:0;z-index:999;pointer-events:none;width:26px;height:26px;transform:translate(-200px,-200px);transition:none}
      #dm-cursor svg{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      #dm-cursor i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #19238E;background:rgba(25,35,142,.15);opacity:0;transform:scale(.6);transition:opacity .12s,transform .12s}
      #dm-cursor.down i{opacity:1;transform:scale(1)}`;
    document.head.appendChild(css);
    // the readout column: a title, the Source toggle, then the live angle and the needle's reading
    const meter = document.querySelector('#stage .meter');
    const k = document.createElement('p'); k.className = 'dm-kicker'; k.textContent = 'Challenge 04 · Magic angle';
    const t = document.createElement('p'); t.className = 'dm-title'; t.textContent = 'Twist two honeycombs.';
    meter.prepend(k, t);
    meter.insertBefore(document.querySelector('[aria-label="Source"]'), meter.querySelector('.mrow'));
    // a visible pointer that follows the real mouse events (the recorder does not draw the OS cursor)
    const cur = document.createElement('div'); cur.id = 'dm-cursor';
    cur.innerHTML = '<i></i><svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const at = e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', at, true);
    addEventListener('pointerdown', e => { at(e); cur.classList.add('down'); }, true);
    addEventListener('pointerup', () => cur.classList.remove('down'), true);
    document.getElementById('stage').scrollIntoView({ block: 'start' });
    stop(); setSrc('orig'); go(nearestIndex(0.3)); sizeScene(); kick();
    const p = (performance.getEntriesByType ? performance.getEntriesByType('paint') : []).find(e => e.name === 'first-paint');
    return p ? p.startTime : 0;
  });
  // make sure every frame is fetched (the page starts this itself 1.5 s after load), so the drag never lands on a
  // "loading" record
  await page.evaluate(() => Promise.all(FR.flatMap(f => [img(f.mapin), img(f.map)]).map(im =>
    im.complete ? 0 : new Promise(res => { im.addEventListener('load', res); im.addEventListener('error', res); }))));

  // turntable geometry in page pixels: the grip rides at the middle of the rim band
  const g = await page.evaluate(() => { const r = scv.getBoundingClientRect(), u = r.width / 100; return { x: r.left + DIAL.cx * u, y: r.top + DIAL.cy * u, R: (DIAL.rr + DIAL.r0) / 2 * u }; });
  const rim = th => { const a = (-156 + th * 60) * Math.PI / 180; return { x: g.x + g.R * Math.cos(a), y: g.y + g.R * Math.sin(a) }; };
  // the pointer glides to a target in a straight line, eased, over about ms
  let at = { x: 600, y: 470 };
  const glide = async (to, ms) => {
    const from = at, t0 = Date.now();
    for (;;) {
      const s = Math.min(1, (Date.now() - t0) / ms), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
      at = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }; await page.mouse.move(at.x, at.y);
      if (s >= 1) break;
      await h.wait(14);
    }
  };
  // a real drag around the rim, from twist th0 to th1, eased over D ms
  const rimDrag = async (th0, th1, D) => {
    const p0 = rim(th0); await page.mouse.move(p0.x, p0.y); await page.mouse.down();
    const t0 = Date.now();
    for (;;) {
      const s = Math.min(1, (Date.now() - t0) / D), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
      const p = rim(th0 + (th1 - th0) * e); at = p; await page.mouse.move(p.x, p.y);
      if (s >= 1) break;
      await h.wait(14);
    }
    await page.mouse.up();
  };

  // the cursor drifts in from the right while the 0.3-degree blob sits on the record (Lec asleep)
  await page.mouse.move(at.x, at.y);
  // the recorder's video starts at the page's first paint, so the clip opens about that long into this recipe:
  // hold the 0.3-degree blob for a beat after that, then reach for the grip
  await h.wait(Math.max(100, Math.min(2500, firstPaint + 80) - (Date.now() - r0)));
  await glide(rim(0.3), 360);
  await h.wait(60);
  // 0.3 -> 4 degrees on the Original layers: the blob splits into a shrinking moire crystal, Lec wakes and hops
  await rimDrag(0.3, 4.0, 1400);
  await h.wait(150);
  // flip the record to the quantum morph
  const btn = await h.center('[data-src="morph"]');
  await glide(btn, 280);
  await page.mouse.down(); await h.wait(70); await page.mouse.up();
  await h.wait(330);
  // back up to the magic angle: the needle skips on the register's echo, Lec gets dizzy
  await glide(rim(4.0), 260);
  await rimDrag(4.0, 1.1, 800);
  await h.wait(120);
  // poke Bee, who jumps (still puzzled)
  const bee = await page.evaluate(() => { const r = scv.getBoundingClientRect(), u = r.width / 100; return { x: r.left + 90.4 * u, y: r.top + (DIAL.cy - SHEET_DY) * u }; });
  await glide(bee, 240);
  await page.mouse.down(); await h.wait(60); await page.mouse.up();
  await h.wait(400);
};
