// Highlight clip, 04 Magic Angle: the twist turntable fills the frame. Drag the rim from 0.3 to 5 degrees on the
// Original layers (one ink blob splits into a shrinking moire crystal, Ay and Bee strain, Lec hops), flip to the
// Quantum morph (the crystal scrambles into speckle), then back to the clean layers and down to 2.4 degrees.
// Page files are untouched: the layout is restyled in the browser only for the recording, and the sweeps run in the
// page's own frame loop so they stay smooth.
module.exports = async (page, h) => {
  const r0 = Date.now();
  // setup: the stage becomes a fixed 960x600 layout, turntable (667x600) left, readout column right
  const firstPaint = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `
      html,body{overflow:hidden!important}
      #stage{position:fixed!important;inset:0;z-index:60;display:grid!important;grid-template-columns:667px minmax(0,1fr);border:0!important;background:var(--paper)!important;margin:0}
      #v-scene{grid-column:1;grid-row:1;width:667px;height:600px}
      #scene{width:667px!important;height:600px!important;aspect-ratio:auto!important}
      #stage .meter{grid-column:2;grid-row:1;border-top:0!important;border-left:1px solid var(--ink);display:flex!important;flex-direction:column;justify-content:center;gap:1.1rem;padding:1.4rem 1.3rem!important}
      #stage .mrow{flex-direction:column;align-items:flex-start;gap:.9rem}
      #stage .meter .ang{font-size:4.6rem!important;line-height:.95}
      #stage .badge{margin:.7rem 0 0!important}
      #stage .meter .per{text-align:left!important;margin-left:0!important;font-size:.84rem!important;line-height:1.6}
      #stage .say{font-size:.92rem!important;line-height:1.45}
      #stage .hl-kicker{margin:0;font:500 .74rem/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
      #stage .hl-title{margin:0;font:400 1.9rem/1.02 var(--display);letter-spacing:-.02em;color:var(--ink)}
      #stage .seg{align-self:flex-start}
      .toast{display:none!important}`;
    document.head.appendChild(css);
    const meter = document.querySelector('#stage .meter');
    const k = document.createElement('p'); k.className = 'hl-kicker'; k.textContent = 'Challenge 04 · Magic angle';
    const t = document.createElement('p'); t.className = 'hl-title'; t.textContent = 'Twist two honeycombs.';
    meter.prepend(k, t);
    meter.insertBefore(document.querySelector('[aria-label="Source"]'), meter.querySelector('.mrow'));
    scrollTo(0, 0);
    stop(); setSrc('orig'); go(nearestIndex(0.3)); sizeScene(); kick();
    // start fetching every Original frame (and the 5-degree morph) now; the sweep only steps onto loaded frames
    FR.forEach(f => { const im = img(f.mapin); if (im.decode) im.decode().catch(() => 0); });
    img(FR[FR.length - 1].map);
    // the recorder's video only starts at the page's first paint, so its clip opens about that long into this recipe
    const p = (performance.getEntriesByType ? performance.getEntriesByType('paint') : []).find(e => e.name === 'first-paint');
    return p ? p.startTime : 0;
  });
  // hold the 0.3-degree blob until the clip has opened (plus a beat), then sweep
  await h.wait(Math.max(250, Math.min(2500, firstPaint + 50) - (Date.now() - r0)));

  // the rim grip is dragged around the dial (Ay and Bee strain while it turns), timed by the clock with an ease
  const sweep = (th0, th1, D) => page.evaluate(([th0, th1, D]) => new Promise(res => {
    const t0 = performance.now();
    stop(); drag.on = true; scv.classList.add('grabbing');
    const step = now => {
      const s = Math.min(1, (now - t0) / D), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
      let i = nearestIndex(th0 + (th1 - th0) * (0.2 * s + 0.8 * e));
      while (i !== st.i && !ready(img(FR[i].mapin))) i += i > st.i ? -1 : 1;   // never step onto a frame still loading
      if (i !== st.i) go(i); else kick();
      if (s < 1) requestAnimationFrame(step);
      else { drag.on = false; scv.classList.remove('grabbing'); kick(); res(); }
    };
    requestAnimationFrame(step);
  }), [th0, th1, D]);

  // 0.3 -> 5 degrees: one ink blob splits into a moire crystal that keeps shrinking
  await sweep(0.3, 5.0, 2600);
  await h.wait(250);
  // the quantum morph scrambles the crystal into speckle
  await page.evaluate(() => document.querySelector('[data-src="morph"]').click());
  await h.wait(700);
  // back to the clean layers, and the crystal grows again as the twist comes back down
  await page.evaluate(() => document.querySelector('[data-src="orig"]').click());
  await sweep(5.0, 2.4, 1000);
};
