// Demo clip for 15 Tissue Blur (~9.5 s): the slide fills the 960x600 frame. The lab mouse starts on the front lens
// (cortex), then the lens is dragged right by hand: the mouse walks along with it and it snaps to the centre lens.
// Reach 0.5 is switched on: the lens turns to plaid, the mouse goes dizzy (stars) and a swarm of ghosts appears.
// Three ghosts are caught (hover: "boo", tap: poof, the mouse gasps), then the wipe is dragged across the slide:
// left of the divider is the measured map (no ghosts), right of it the quantum blur.
module.exports = async (page, h) => {
  const S = 960 / 1024;                                         // screen px per canvas px (the stage is 960x600 for a 1024x640 slide)
  const glide = async (x0, y0, x1, y1, ms) => {                 // a hand-paced pointer move, timed by the clock (each move redraws the slide)
    const t0 = Date.now();
    for (;;){ const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      await page.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); if (t >= 1) break; await h.wait(12); }
  };
  // 1) the stage fills the viewport, opened on the front lens via the page's own share link
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = `#stage{position:fixed!important;left:0!important;top:0!important;width:960px!important;height:600px!important;z-index:50!important;border:0!important}
      #cv{width:960px!important;height:600px!important}`;
    document.head.appendChild(s);
    location.hash = 'A.all.lens_282.echo.w28.move';
  });
  await h.wait(850);                                           // the mouse rests on the front lens (the clip may start part-way into this)
  // 2) drag the lens (by its glass) from the front lens to the right: the mouse walks with it, then it snaps to the centre
  let px = 282 * S, py = 300;
  await page.mouse.move(px, py); await page.mouse.down();
  await glide(px, py, 530 * S, 312, 1200);
  await h.wait(120); await page.mouse.up();
  px = 530 * S; py = 312;
  await h.wait(400);
  // 3) Reach 0.5: the plaid blur, a dizzy mouse and a swarm of ghosts
  await page.evaluate(() => document.querySelector('#g-reach [data-setting="plaid"]').click());
  await h.wait(800);
  // 4) catch three ghosts: same placement rule as the page (strongest ghost pixels, kept off the corner label)
  const targets = await page.evaluate(() => {
    const j = findJob(D.jobs, 'A', 'lens_512', 'plaid'), cv = document.getElementById('cv'), c = cv.getBoundingClientRect();
    const t = document.getElementById('tag-r').getBoundingClientRect(), f = 1024 / c.width, gs = 12 * 3 / (c.width / 1024);
    const x0 = (t.left - c.left) * f - gs / 2, y1 = (t.bottom - c.top) * f + gs * 1.3;
    const gh = placeGhosts(j, [0, 1, 2], gs * .8, (x, y) => t.width > 0 && x > x0 && y < y1);
    return gh.map(g => ({gene: g.gene, x: g.x, y: g.y - 25.6}));
  });
  const want = [[700, 470], [560, 200], [330, 330]];           // pick ghosts near these canvas spots: one by the mouse, then across the lens
  const used = new Set();
  for (const [wx, wy] of want){
    const cand = targets.map((g, i) => ({g, i, d: Math.hypot(g.x - wx, g.y - wy)})).filter(o => !used.has(o.i)).sort((a, b) => a.d - b.d);
    for (const {g, i} of cand.slice(0, 5)){
      const tx = g.x * S, ty = g.y * S;
      await glide(px, py, tx, ty, 320); px = tx; py = ty;
      await h.wait(60);
      if (await page.evaluate(() => document.getElementById('stage').dataset.hover === 'ghost')){
        used.add(i);
        await h.wait(180);                                     // the ghost says boo
        await page.mouse.down(); await page.mouse.up();        // poof, the mouse gasps
        await h.wait(340);
        break;
      }
    }
  }
  // 5) Wipe compare: drag the divider across: measured map on the left, the blur (and its ghosts) on the right
  await page.evaluate(() => document.querySelector('button[data-tool="wipe"]').click());
  await glide(px, py, 480, 585, 250);
  await page.mouse.down();
  await glide(480, 585, 130, 585, 700);
  await glide(130, 585, 600, 585, 900);
  await page.mouse.up();
  await h.wait(250);
};
