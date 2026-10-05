// Highlight: Quantum Lenia. Fill the frame with the live dish, spray two bands of random soup, press Play (the soup
// crystallises into a Turing-style labyrinth of creatures with eyes), then swap in the Blur 1.0 kernel and watch life
// flood the dish as a quantum-blurred lattice.
module.exports = async (page, h) => {
  const T0 = Date.now(), log = m => console.error(((Date.now() - T0) / 1000).toFixed(2) + 's ' + m);
  const box = await page.evaluate(() => {
    const cv = document.getElementById('cv'), r0 = cv.getBoundingClientRect();
    scrollTo(0, r0.top + scrollY + (r0.height - innerHeight) / 2);   // the dish canvas fills the viewport
    const br = document.getElementById('br'); br.value = 40; br.dispatchEvent(new Event('input'));
    document.querySelector('[data-tool="soup"]').click();
    const r = cv.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const P = (fx, fy) => ({ x: box.x + box.w * fx, y: fy });   // x as a fraction of the dish, y in viewport px
  const stroke = async (pts, steps) => {
    await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y, { steps });
    await page.mouse.up();
  };
  await stroke([P(0.08, 160), P(0.50, 250), P(0.92, 140)], 3);
  await stroke([P(0.10, 450), P(0.52, 370), P(0.92, 470)], 3);
  log('painted');
  await page.mouse.move(8, 300);                                         // off the dish: no brush cursor
  await h.wait(300);                                                     // pre-roll: the recorder's clip starts about here
  await page.evaluate(() => document.getElementById('play').click());
  await h.wait(1800);
  log('blur');
  await page.evaluate(() => [...document.querySelectorAll('#g-set .lens')].find(b => b.textContent.includes('Blur 1.0')).click());
  await h.wait(1400);
  log('done');
};
