// Demo: 03 Moth Eye. Frame the engraved plate, grab the hanging lamp and swing it over the loupe and down its right side
// (the rays, the light on the 3D facet and the glint on the moth's eye follow it), then drag the live nanopillar facet round
// until it is side-on: the bat climbs its arc to your viewpoint, the shine it sees crosses 50% and it swoops in
// ("Spotted!"). Ends by scrolling down to the bat meter under the scene: its eyelid open, the real reflectance number and
// the eye / dome / slab bars.
// Every move is a real pointer drag. Headless Chromium renders WebGL in software (~0.1-0.3 s a frame, slower under load),
// so each drag runs on a clock (slow machine: fewer, larger steps, same length) and after each move the recipe waits for
// the GL frame to land (a 1-pixel readPixels) so the video gets the frames in order.
module.exports = async (page, h) => {
  await page.evaluate(() => {
    const box = document.getElementById('scenebox');
    window.scrollTo(0, Math.round(box.getBoundingClientRect().top + window.scrollY));
  });
  const sync = () => page.evaluate(() => {
    try { const gl = V.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); } catch (e) {}
  });
  const ease = u => (1 - Math.cos(Math.PI * u)) / 2;
  const stroke = async (path, T) => {   // press at path(0), follow the path for T ms, release
    const p0 = path(0);
    await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await sync();
    const t0 = Date.now();
    for (;;) {
      const u = Math.min(1, (Date.now() - t0) / T), p = path(ease(u));
      await page.mouse.move(p.x, p.y); await sync();
      if (u >= 1) break;
    }
    await page.mouse.up();
  };
  await h.wait(1000);   // the first ~0.5-2 s of video are lost to screencast start-up: hold the plate still

  // scene geometry in viewport px: the plate's reference frame (800 x 700 units) scaled to the scenebox
  const sb = await page.evaluate(() => { const r = document.getElementById('scenebox').getBoundingClientRect(); return {x: r.x, y: r.y, k: r.width / S.RW, lx: S.loupe.x, ly: S.loupe.y, lr: S.loupe.r, bx: S.lamp.x, by: S.lamp.y}; });
  const L = {x: sb.x + sb.lx * sb.k, y: sb.y + sb.ly * sb.k}, R = 1.2 * sb.lr * sb.k;

  // 1. grab the bulb and swing it over the top of the loupe and down its right side (clear of the bat's arc)
  const bulb = {x: sb.x + sb.bx * sb.k, y: sb.y + sb.by * sb.k};
  const a0 = Math.atan2(-(sb.by - sb.ly), sb.bx - sb.lx), a1 = -0.3;
  await stroke(u => u === 0 ? bulb : {x: L.x + R * Math.cos(a0 + (a1 - a0) * u), y: L.y - R * Math.sin(a0 + (a1 - a0) * u)}, 1400);
  await h.wait(150);

  // 2. orbit the facet in the loupe: drag left (and a little down) to turn it side-on; the bat follows and spots it
  const c = await h.center('#cv'), from = {x: c.x + 125, y: c.y - 10}, to = {x: c.x - 170, y: c.y + 12};
  await stroke(u => ({x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u}), 2000);
  await h.wait(1000);   // the swoop and the "Spotted!" bubble

  // 3. the result: scroll (in three quick wheel-like steps) down to the bat meter under the scene
  const dy = await page.evaluate(() => Math.round(document.querySelector('.meter').getBoundingClientRect().bottom - window.innerHeight + 12));
  for (let i = 1, done = 0; i <= 3; i++) {
    const to = Math.round(dy * ease(i / 3));
    await page.evaluate(d => window.scrollBy(0, d), to - done); done = to;
    await h.wait(70);
  }
  await h.wait(700);
};
