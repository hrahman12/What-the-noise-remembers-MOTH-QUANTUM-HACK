// Video take (~38 s) for the Challenge 01 demo video: Scroll Unroll, played start to finish by one pointer.
// Every state change goes through the page's own controls (desk drags and taps, buttons, sliders, the damage bars,
// the data chart). The only scripted things are the drawn pointer (headless recording shows no cursor), the smooth
// page scrolls between sections, and holding the CT camera on its target while a drag is on (the recorder renders
// at ~10 fps, so the page's camera ease would otherwise trail the pointer).
//  A  The scene (desk over the CT slice): the archaeologist moth perches on the roll asking "?". The pointer grabs
//     the roll and pushes it left: the roll trundles across the desk, the CT spiral unspools into a long ribbon.
//     A tap on the sheet where the hidden line starts sends the moth there with its lantern.
//  B  Down to the controls: "Tint the ink", contrast up, zoom on the window (classical display controls).
//  C  The reading window and the live readout: clean ink (the original) against the real blur-v1 jobs, picked on the
//     damage bars: job 4 (Gray-code blocks), job 6 (the line is gone), "Ink layer only" (the raw engine output),
//     job 9, clean ink again. The readout shows each job's ID, parameters, line kept r and ink moved.
//  D  The data: the nine jobs measured (line kept r vs ink moved); the pointer loads job 9, job 5 (the edge) and
//     job 1 from the chart.
//  E  Back up to the scene, zoomed and tinted: the pointer drags the moth along the hidden line, "% read" climbs,
//     the line is found, the moth cheers, the CT marks the line. Then down to the reveal: the Greek and its
//     translation.
module.exports = async (page, h) => {
  // ---- setup: drawn pointer, stage framed (bottom of the CT slice on the bottom of the viewport) ----
  await page.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    window.scrollTo({ top: Math.round(r.top + scrollY + r.height - innerHeight), behavior: 'instant' });
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25.2 L13 16.8 L21 16.5 Z" fill="#fbfaf9" stroke="#19238e" stroke-width="2" stroke-linejoin="round"/></svg><span></span>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '26px', height: '30px', pointerEvents: 'none', zIndex: 99999, transform: 'translate(820px,330px)' });
    const ring = c.querySelector('span');
    Object.assign(ring.style, { position: 'absolute', left: '-11px', top: '-11px', width: '22px', height: '22px', borderRadius: '50%', border: '2px solid #b4541a', opacity: '0', transition: 'opacity .12s' });
    document.body.appendChild(c);
    const mv = e => { c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; };
    addEventListener('pointermove', e => { mv(e); if (window.__lockCam) camInit = false; }, true);
    addEventListener('pointerdown', e => { mv(e); ring.style.opacity = '1'; }, true);
    addEventListener('pointerup', () => { ring.style.opacity = '0'; }, true);
  });

  // ---- helpers ----
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let cur = { x: 823, y: 332 };
  const glide = async (to, ms, fn = ease) => {   // time-based pointer glide
    const from = { ...cur }, t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / ms), e = fn(k);
      cur = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      await page.mouse.move(cur.x, cur.y);
      if (k >= 1) break;
      await page.waitForTimeout(30);
    }
  };
  const press = async (ms = 110) => { await page.mouse.down(); await h.wait(ms); await page.mouse.up(); };
  // viewport box of an element (after any scroll)
  const box = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
  const clickSel = async (sel, ms = 650, dy = 0) => { const b = await box(sel); await glide({ x: b.cx, y: b.cy + dy }, ms); await press(); };
  // smooth page scroll (eased, in the page's own frames); y = page y to bring to the top of the viewport
  const scrollToY = (y, ms) => page.evaluate(([y, ms]) => new Promise(res => {
    const y0 = scrollY, t0 = performance.now(), yy = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, y));
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo({ top: Math.round(y0 + (yy - y0) * e), behavior: 'instant' });
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  }), [y, ms]);
  const pageY = sel => page.evaluate(s => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
  const stageY = async () => page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return Math.round(r.top + scrollY + r.height - innerHeight); });
  // desk geometry: screen x of sheet position s, the roll, the sheet's mid line
  const geo = () => page.evaluate(() => {
    const r = desk.getBoundingClientRect(), sx = r.width / DK.bw, sy = r.height / BH, p = sp(), R = rollPx(p);
    return { left: r.left, top: r.top, sx, sy, rollX: r.left + (dS(p) + 0.5) * sx, rollY: r.top + (BOT + 1 - R) * sy,
      sheetY: r.top + ((TOP + BOT) / 2) * sy, kx: DK.kx, x0: DK.x0, L, T0: TEXT0, T1: TEXT1 };
  });
  const xOfS = (g, s) => g.left + (g.x0 + s * g.kx) * g.sx;
  // drag a range input's thumb from its current value to value v
  const slide = async (sel, v, ms) => {
    const q = await page.evaluate(s => { const el = document.querySelector(s), r = el.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, min: +el.min, max: +el.max, v: +el.value }; }, sel);
    const xOf = val => q.x + 8 + (val - q.min) / (q.max - q.min) * (q.w - 16);
    await glide({ x: xOf(q.v), y: q.y }, 320);
    await page.mouse.down();
    await glide({ x: xOf(v), y: q.y }, ms);
    await h.wait(60);
    await page.mouse.up();
  };

  // ==== A. the scene: push the roll, tap the sheet ====
  let g = await geo();
  await page.mouse.move(cur.x, cur.y);
  await h.wait(450);                                       // the moth perches on the roll and asks "?"
  await glide({ x: g.rollX, y: g.rollY }, 750);
  await page.evaluate(() => { window.__lockCam = true; });
  await page.mouse.down();
  await h.wait(120);
  // a slow, steady push: the roll trundles left, the CT spiral unspools into a ribbon
  await glide({ x: xOfS(g, g.L * (1 - 0.93)) + 0.5 * g.sx, y: g.rollY }, 2900, t => t < 0.12 ? t * t / 0.24 : 0.06 + (t - 0.12) / 0.88 * 0.94);
  await h.wait(120);
  await page.mouse.up();
  await page.evaluate(() => { window.__lockCam = false; });
  await h.wait(350);
  // tap the sheet where the hidden line starts: the moth flies over with its lantern
  g = await geo();
  const sTap = g.T0 + 300;                                 // window = [line start, line start + 600 px]
  await glide({ x: xOfS(g, sTap), y: g.sheetY }, 650);
  await press(120);
  await glide({ x: xOfS(g, sTap) + 70, y: g.sheetY + 120 }, 450);   // move off, so the moth and the CT read clearly
  await h.wait(700);

  // ==== B. the display controls: tint, contrast, zoom ====
  const yTint = await pageY('#tint');
  await scrollToY(yTint + 42 + 14 - 600, 1050);            // tint button just above the bottom edge
  await clickSel('#tint', 500);
  await slide('#k', 75, 600);
  await slide('#z', 35, 600);
  await h.wait(100);

  // ==== C. the reading window and the live readout: clean ink vs the real blur-v1 jobs ====
  const yReader = await pageY('.reader');
  await scrollToY(yReader - 8, 550);
  await h.wait(150);
  await clickSel('[data-ink="clean"]', 550);               // the original: the ink as written
  await h.wait(700);
  const bar = async i => {                                 // the damage bars: one per job, height = ink moved
    const b = await box(`#ladder button[data-d="${i}"]`);
    await glide({ x: b.cx, y: b.y + b.h - 3 }, 500);
    await press();
  };
  await bar(3); await h.wait(700);                         // job 4: strength 1, reach 0 -> Gray-code blocks
  await bar(5); await h.wait(700);                         // job 6: strength 0.25, reach 1 -> the line is gone
  await clickSel('[data-layer="ink"]', 550); await h.wait(750);   // the raw engine output, white ink on black
  await bar(8); await h.wait(700);                         // job 9: strength 1, reach 1
  await clickSel('[data-ink="clean"]', 550); await h.wait(750);   // the clean ink layer, for comparison
  await clickSel('[data-layer="scan"]', 500); await h.wait(300);

  // ==== D. the data: the nine jobs, measured ====
  const yData = await pageY('#data-sec');
  await scrollToY(yData - 14, 1100);
  await h.wait(150);
  const pt = v => page.evaluate(v => { const r = chart.getBoundingClientRect(), q = chartPts.find(o => o.v === v); return { x: r.left + q.x * r.width / chartVB[0], y: r.top + q.y * r.height / chartVB[1] }; }, v);
  for (const v of ['8', '4', '0']) {                       // job 9, job 5 (the edge), job 1
    const q = await pt(v);
    await glide({ x: q.x, y: q.y }, 600);
    await press();
    await glide({ x: q.x + 26, y: q.y + 34 }, 250);
    await h.wait(600);
  }

  // ==== E. back to the scene: read the hidden line ====
  await scrollToY(await stageY(), 1300);
  await h.wait(200);
  g = await geo();
  await glide({ x: xOfS(g, sTap), y: g.sheetY }, 550);
  await page.evaluate(() => { window.__lockCam = true; });
  await page.mouse.down();
  await glide({ x: xOfS(g, g.T1 - 200), y: g.sheetY }, 3000, t => t);   // the moth reads its way along the line
  await page.mouse.up();
  await page.evaluate(() => { window.__lockCam = false; });
  await glide({ x: xOfS(g, g.T1 - 200) + 60, y: g.sheetY + 150 }, 400);
  await h.wait(1500);                                      // the moth cheers; the CT marks the line
  // down to the reveal: the Greek line and its translation
  const yRev = await page.evaluate(() => { const r = document.getElementById('reveal').getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
  await scrollToY(yRev - 300, 1200);
  await glide({ x: 900, y: 560 }, 400);
  await h.wait(1900);
};
