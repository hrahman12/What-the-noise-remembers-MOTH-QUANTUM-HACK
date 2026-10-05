// Demo clip for 11 Maxwell's Ribbon (~9.5 s): Maxwell's pixel-art studio fills the frame, with Maxwell's speech line and
// the machine row under it. A visible pointer does what a visitor would:
//   1) clicks the sitter: a new test colour (an amber Bloch ball, test colour 68 of 112) hops onto the stool and
//      Maxwell beams, because the perfect simulator gives it back almost exactly ("Off by 0.01. Splendid!");
//   2) clicks "Real chip": the simulator on the right becomes the ibm_fez fridge and chip, the plaque reads IBM FEZ;
//   3) clicks the camera: the page's own shoot sequence (X, Y and Z filters drop, three flashes, the sitter flinches,
//      each plate flies to the chip and back onto the line, the screen lights up with the REBUILT portrait), then
//      Maxwell clutches his head at the real hardware result: the amber ball came back magenta, off by 0.94.
// Page code is not changed. For the clip only, the hero is laid out in one 800 px column so the scene draws at 4x
// (796 x 448 px) and fills the 960 x 600 frame, and Math.random is pinned for the one sitter click so the colour is
// the same on every recording.
// Timing: record_demo.cjs trims the video at a wall-clock offset, but Playwright's video only starts at the page's
// first painted frame, so the clip opens 0.6-2.6 s into this recipe depending on the run. Measured over six runs,
// the clip starts at (first-paint since navigation) - 0.05 s of recipe time (or performance.now() - 0.15 s when no
// paint entry exists), so the recipe idles until 0.25 s after that and every action lands inside the clip.
module.exports = async (page, h) => {
  const R0 = Date.now();
  // frame the studio first, so the opening frames are the scene and not the headline
  const firstFrame = await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = '.hero{grid-template-columns:minmax(0,1fr)!important}.instrument{width:800px;margin-inline:auto}' +
      '.say{min-height:87px}' +   // the speech line keeps one height, so the machine row never jumps
      '#demo-cursor{position:fixed;left:-40px;top:-40px;width:26px;height:26px;z-index:99;pointer-events:none;transform:translate(-3px,-2px)}' +
      '#demo-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border:3px solid #ff7a1a;border-radius:50%;z-index:98;pointer-events:none;opacity:0}' +
      '#demo-ring.on{animation:demoRing .45s ease-out}@keyframes demoRing{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(1.25)}}';
    document.head.appendChild(css);
    SCENE.resize();
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<svg viewBox="0 0 26 26" width="26" height="26"><path d="M3 2 L3 21 L8 16.5 L11.5 24 L15 22.5 L11.6 15 L18 15 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    const ring = document.createElement('div'); ring.id = 'demo-ring';
    document.body.append(cur, ring);
    document.addEventListener('mousemove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', e => {
      ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
    }, true);
    const r = document.getElementById('scene').getBoundingClientRect();
    window.scrollTo({ top: r.top + scrollY + 8, behavior: 'instant' });
    const fp = performance.getEntriesByName('first-paint')[0];
    return fp ? fp.startTime : performance.now() - 100;   // ms since navigation start
  });
  // hit regions are in art pixels (scene.js); the canvas draws each art pixel as u x u screen pixels
  const sc = await h.center('#scene'), u = sc.box.height / 112;          // the art is 112 px tall
  const art = (x, y) => ({ x: sc.box.x + x * u, y: sc.box.y + y * u });
  let pos = art(118, 96);                                                 // park the pointer on the empty floor
  await page.mouse.move(pos.x, pos.y);
  const glide = async (to, ms) => {                                       // an eased pointer move, timed by the clock
    const a = pos, t0 = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - t0) / ms), e = t * t * (3 - 2 * t);
      await page.mouse.move(a.x + (to.x - a.x) * e, a.y + (to.y - a.y) * e);
      if (t >= 1) break;
      await h.wait(12);
    }
    pos = to;
  };
  const click = async () => { await page.mouse.down(); await h.wait(60); await page.mouse.up(); };
  // idle (Maxwell blinks, the simulator ticks) until the clip is surely rolling
  const lead = Math.min(3200, Math.max(300, firstFrame - 50 + 250));
  await h.wait(Math.max(0, lead - (Date.now() - R0)));

  // 1) a new sitter: pin the random pick to test colour 68 (amber) for this one click
  await glide(art(12, 78), 300);
  await page.evaluate(() => { const o = Math.random; Math.random = () => 67.5 / 112; setTimeout(() => { Math.random = o; }, 400); });
  await click();
  await h.wait(600);

  // 2) switch the machine to the real IBM chip
  await glide(await h.center('#g-machine button[data-m="ibm_fez"]'), 350);
  await click();
  await h.wait(550);

  // 3) click the camera: three photos, three plates, the quantum chip measures each one back, the colour is rebuilt
  await glide(art(36, 74), 350);
  await click();
  const shot = Date.now();
  await glide(art(118, 98), 400);                                         // step aside onto the empty floor
  await h.wait(Math.max(0, 4700 + 700 - (Date.now() - shot)));            // the 4.7 s sequence, then Maxwell's reaction
};
