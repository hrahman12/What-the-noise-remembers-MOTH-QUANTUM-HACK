// Demo (~9 s): Scroll Unroll, played on the pixel-art desk with the CT slice of the same scroll below it.
//  1. A pointer grabs the roll on the desk and pushes it left: the roll trundles across the table, the sheet
//     lies flat behind it, and the CT spiral below unspools into a long ribbon.
//  2. A tap on the sheet where the hidden line sits: the archaeologist moth flies there with its lantern.
//  3. Zoom on the reading window, tint the ink and raise the contrast (the page's own controls): the CT camera
//     dives onto the ribbon and the Greek letters glow warm through the damage.
//  4. Drag along the sheet: the moth reads its way along the line, the letters stream through the window,
//     "% read" climbs, and at 85 % the line counts as found: the moth cheers with sparkles, the chip inks in,
//     a dashed line marks the find and the toast announces it.
// A drawn pointer follows the mouse (headless recording shows no cursor), so the drags read as a real user's.
// The recorder can lose up to ~1.5 s at the start, so the opening is the pointer gliding to the roll.
module.exports = async (page, h) => {
  // frame the stage: the bottom of the CT slice on the bottom of the viewport, the desk's table above it
  await page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    window.scrollTo({ top: Math.round(r.top + scrollY + r.height - innerHeight), behavior: 'instant' });
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25.2 L13 16.8 L21 16.5 Z" fill="#fbfaf9" stroke="#19238e" stroke-width="2" stroke-linejoin="round"/></svg><span></span>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '26px', height: '30px', pointerEvents: 'none', zIndex: 99999, transform: 'translate(640px,420px)' });
    const ring = c.querySelector('span');
    Object.assign(ring.style, { position: 'absolute', left: '-11px', top: '-11px', width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #b4541a', opacity: '0', transition: 'opacity .12s' });
    document.body.appendChild(c);
    const mv = e => { c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; };
    // while a drag is on, hold the CT camera on its target (camInit=false skips the page's ease for that frame):
    // the recorder renders at ~10 fps, so the ease would otherwise trail the roll and lose the spiral off screen
    addEventListener('pointermove', e => { mv(e); if (window.__lockCam) camInit = false; }, true);
    addEventListener('pointerdown', e => { mv(e); ring.style.opacity = '1'; }, true);
    addEventListener('pointerup', () => { ring.style.opacity = '0'; }, true);
  });

  // screen position (viewport px) of a place on the desk: sheet position s (px of sheet) or a desk pixel x
  const geo = () => page.evaluate(() => {
    const r = desk.getBoundingClientRect(), sx = r.width / DK.bw, sy = r.height / BH, p = sp(), R = rollPx(p);
    return { left: r.left, top: r.top, sx, sy, rollX: r.left + (dS(p) + 0.5) * sx, rollY: r.top + (BOT + 1 - R) * sy,
      sheetY: r.top + ((TOP + BOT) / 2) * sy, kx: DK.kx, x0: DK.x0, L, T0: TEXT0, T1: TEXT1 };
  });
  const xOfS = (g, s) => g.left + (g.x0 + s * g.kx) * g.sx;
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let cur = { x: 640, y: 420 };
  const glide = async (to, ms, fn = ease) => {   // time-based mouse glide, so the drag lasts what it says
    const from = { ...cur }, t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / ms), e = fn(k);
      cur = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      await page.mouse.move(cur.x, cur.y);
      if (k >= 1) break;
      await page.waitForTimeout(30);
    }
  };

  let g = await geo();
  await page.mouse.move(cur.x, cur.y);
  // 1. glide to the roll, grab it and push it left across the desk
  await glide({ x: g.rollX, y: g.rollY }, 500);
  await page.evaluate(() => { window.__lockCam = true; });
  await page.mouse.down();
  await h.wait(60);
  await glide({ x: xOfS(g, g.L * (1 - 0.93)) + 0.5 * g.sx, y: g.rollY }, 1900, t => t < 0.15 ? t * t / 0.3 : 0.075 + (t - 0.15) / 0.85 * 0.925);
  await h.wait(60);
  await page.mouse.up();
  await page.evaluate(() => { window.__lockCam = false; });
  await h.wait(80);

  // 2. tap the sheet where the hidden line starts: the moth flies over with its lantern
  g = await geo();
  const c0 = g.T0 + 240, c1 = g.T1 - 140;   // reading-window centres: sweep the whole line
  await glide({ x: xOfS(g, c0), y: g.sheetY }, 300);
  await page.mouse.down();
  await page.mouse.up();

  // 3. zoom on the window, tint the ink, raise the contrast: the CT camera dives onto the Greek letters
  await page.evaluate(async () => {
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    document.getElementById('tint').click();
    const t0 = performance.now(), T = 850;
    await new Promise(res => {
      const step = now => {
        const k = Math.min(1, (now - t0) / T), e = k * k * (3 - 2 * k);
        set('z', Math.round(10 + 25 * e));
        set('k', Math.round(35 + 40 * e));
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  });
  await h.wait(150);

  // 4. drag along the sheet: the moth reads the line; at 85 % it is found and the moth cheers
  await page.evaluate(() => { window.__lockCam = true; });
  await page.mouse.down();
  await glide({ x: xOfS(g, c1), y: g.sheetY }, 2000, t => t);
  await page.mouse.up();
  await glide({ x: xOfS(g, c1) + 40, y: g.sheetY + 50 }, 250);
  await h.wait(1000);
};
