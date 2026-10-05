// Demo clip for 18 Oldest Light (~8 s): the WMAP sky fills the left of the frame with Mapper the satellite riding
// the wipe line (original sky on its left, the 18-qubit quantum blur on its right) and the blur controls beside it.
// You tap a hot spot and point at a cold one, and Mapper turns its dishes there and catches their photons (orange =
// warmer, lilac = colder), then "Plant galaxy seeds" sprouts galaxies on the 56 hottest
// spots (Mapper cheers); dragging Mapper left wilts the galaxies the blur loses and pops up the phantoms it invents;
// the blur slider goes up to 1.0 (Mapper squints, the telescope eye goes fuzzy, more phantoms); dragging Mapper back
// right brings the original sky and its galaxies back. The census and Mapper's speech give the counts.
// Presentation only: the stage is widened to 560 px (so the cast draws at its large pixel scale), the intro copy is
// hidden, the stage bar, census and speech box are shown beside the sky above the blur slider, and the hover
// temperature readout is hidden so it does not cover the cast. Nothing in the piece's own code is changed.
module.exports = async (page, h) => {
  const T0 = Date.now(), log = m => console.error(((Date.now() - T0) / 1000).toFixed(2) + 's ' + m);
  await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = [
      'body{padding-inline:14px!important}',
      '.hero{grid-template-columns:560px minmax(0,1fr)!important;grid-template-areas:"stage panel"!important;grid-template-rows:auto!important;gap:0 16px!important;padding-block:10px!important}',
      '.hero>.copy{display:none!important}',
      '.panel{align-self:start!important;gap:.7rem!important;padding:.9rem 1rem!important}',
      '.panel .say{margin:0!important}',
      '#probe{display:none!important}',
    ].join('\n');
    document.head.appendChild(css);
    const $ = id => document.getElementById(id), panel = document.querySelector('.panel');
    const tail = [$('lvl-desc'), ...panel.querySelectorAll(':scope > .row:not(.split)'), panel.querySelector('.readout')];
    panel.prepend(document.querySelector('.stagebar'), $('census'), $('say-box'));
    tail.forEach(el => el && panel.appendChild(el));             // view / blur / cold-spot rows and the readout go below the fold
    st.wipe = 0.5; cast.hy = 0.42;
    dispatchEvent(new Event('resize'));
    draw();
    const r = $('stage').getBoundingClientRect();
    scrollTo({ top: r.top + scrollY - 10, behavior: 'instant' });
  });
  await h.wait(200);
  const cv = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const P = (fx, fy) => ({ x: cv.x + cv.w * fx, y: cv.y + cv.h * fy });
  const glide = async (pts, steps) => { for (const p of pts) await page.mouse.move(p.x, p.y, { steps }); };

  // a hot spot on the original side and the coldest spot on the blurred side, as fractions of the sky canvas
  const spots = await page.evaluate(() => {
    let hot = null, cold = null, best = 1e9, lo = 1e9;
    for (const p of roots()){
      const c = toCanvas(p.j + 0.5, p.i + 0.5), d = Math.hypot(c.X / W - 0.25, c.Y / W - 0.25);
      if (c.X < 0.42 * W && c.X > 0.08 * W && c.Y > 0.12 * W && c.Y < 0.8 * W && d < best){ best = d; hot = {fx: c.X / W, fy: c.Y / W}; }
    }
    for (let fx = 0.62; fx <= 0.9; fx += 0.02) for (let fy = 0.55; fy <= 0.88; fy += 0.02){
      const v = valueAt(fx * W, fy * W); if (v < lo){ lo = v; cold = {fx, fy}; }
    }
    return {hot: hot || {fx: 0.25, fy: 0.3}, cold};
  });
  log('setup');
  // 1) tap a hot spot: Mapper turns its dishes there and catches its photons (the clip starts about here)
  await page.mouse.move(P(0.80, 0.22).x, P(0.80, 0.22).y);
  await glide([P(0.62, 0.30), P(spots.hot.fx, spots.hot.fy)], 4);
  await page.mouse.down(); await page.mouse.up();
  await h.wait(500);
  await glide([P(0.45, 0.70), P(spots.cold.fx, spots.cold.fy)], 4);   // pointing on the blurred side: lilac photons
  await h.wait(250);
  log('tapped');
  // 2) plant galaxy seeds: galaxies sprout on the hottest spots, the blur side wilts some and invents phantoms
  await page.click('#seeds');
  log('planted');
  await h.wait(1200);
  // 3) drag Mapper left: more of the sky goes through its blurry eye
  const m = P(0.5, 0.42);
  await page.mouse.move(m.x, m.y, { steps: 2 });
  await page.mouse.down();
  await glide([P(0.14, 0.50)], 5);
  await page.mouse.up();
  log('dragged left');
  await h.wait(200);
  // 4) slide the blur up to strength 1.0: Mapper squints, the eye goes fuzzy, phantoms pop up
  const s = await page.evaluate(() => { const r = document.getElementById('lvl').getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; });
  const thumb = v => s.x + 8 + (s.w - 16) * v / 6;
  await page.mouse.move(thumb(4), s.y, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(thumb(5), s.y, { steps: 2 });
  await h.wait(350);
  await page.mouse.move(thumb(6), s.y, { steps: 2 });
  await page.mouse.up();
  log('slid');
  await h.wait(650);
  // 5) drag Mapper back right: the original sky and its galaxies return
  const m2 = P(0.14, 0.50);
  await page.mouse.move(m2.x, m2.y, { steps: 3 });
  await page.mouse.down();
  await glide([P(0.80, 0.40)], 6);
  await page.mouse.up();
  log('dragged right');
  // 6) tap a spot on the blurred side: Mapper turns round and catches its photons
  await glide([P(0.90, 0.58), P(0.88, 0.70)], 3);
  await page.mouse.down(); await page.mouse.up();
  await h.wait(400);
  log('end');
};
