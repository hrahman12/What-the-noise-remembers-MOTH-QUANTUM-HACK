// Demo clip for 07 Flavour (~9 s): send a neutrino through the Earth and watch which flavour lights Super-K.
// The frame holds the Source / Energy row and the whole engraved plate (Fig. 1 the source, Fig. 2 Super-Kamiokande
// cut away, Fig. 3 the event display with the inner wall unrolled, Fig. 4 the journey with its flavour bands).
//   1. The plate opens on the accelerator beam; pick Atmosphere, then 5 GeV: Fig. 1 redraws as a cosmic-ray air
//      shower over the Earth, the journey becomes 100 km (from overhead) to 12,757 km (from directly below).
//   2. Hold the A key: the synth starts (its Start button goes), the plate's neutrino trails flow while the note
//      sounds, and one neutrino is detected at the horizon (437 km): a sharp muon ring.
//   3. Grab the neutrino on the journey and drag it out through the Earth to 8,500 km: the orange path swings down
//      through the Earth in Fig. 1, the flavour bands and the e / mu / tau readout follow the measured curves.
//   4. On the way Enter detects one neutrino at a time (the page's own keyboard help): rings flash on the unrolled
//      wall and in the cut-away tank, fuzzy for an electron (766 km), several overlapping rings for a tau.
//   5. A click on the tank at the far end detects one more; the caption under Fig. 3 names each event.
// Page files are untouched; everything runs through the page's own handlers, driven by real mouse and key events.
// Each detection is the page's classical dice roll (Math.random). So the clip is the same every run, the recipe
// swaps in a seeded generator (mulberry32, seed 2116) just before the first detection; with the stops below it
// rolls muon (437 km), electron (766 km), tau (2,962 km), tau (8,532 km), tau: the muon neutrinos that crossed
// the Earth arrive as taus.
module.exports = async (page, h) => {
  // frame the Source / Energy row plus the full plate (the plate is 520 px tall at this width)
  await page.evaluate(() => {
    const y = document.getElementById('src-seg').getBoundingClientRect().top + scrollY - 8;
    window.scrollTo(0, y);
  });
  // the recorder's cut lands somewhere in here (its video starts a little after its clock)
  await h.wait(700);
  await page.click('#src-seg [data-src="2"]');          // Atmosphere: the air-shower figure and the Earth cut through
  await h.wait(550);
  await page.click('#e-seg [data-e="1"]');              // 5 GeV: muons and taus are both above threshold
  await h.wait(300);

  // where things are on screen, from the page's own plate geometry (whole pixels, so every run lands on the same L)
  const g = await page.evaluate(() => {
    const r = PL.svg.getBoundingClientRect(), k = r.width / PL.W, A = jAxis(), d = PL.box.det;
    return { x0: Math.round(r.left + A.x0 * k + 2), x1: Math.round(r.left + A.x1 * k - 2), y: Math.round(r.top + (A.yb - 30) * k),
      mx: Math.round(r.left + A.xOf(leOf(st.u) * eOf(st)) * k), dx: Math.round(r.left + (d.x + d.w / 2) * k), dy: Math.round(r.top + (d.y + d.h * 0.55) * k) };
  });
  await page.evaluate(() => {
    let a = 2116;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });

  await page.keyboard.down('a');                        // the synth starts, a note sounds, one neutrino is detected
  await h.wait(500);

  // grab the neutrino and drag it out through the Earth, detecting one at three distances on the way
  const slide = async (from, to, ms, n) => { for (let i = 1; i <= n; i++) { await page.mouse.move(Math.round(from + (to - from) * i / n), g.y); await h.wait(ms / n); } };
  await page.mouse.move(g.mx, g.y);
  await page.mouse.down();
  let at = g.mx;
  for (const [s, ms] of [[0.42, 350], [0.7, 600], [0.92, 500]]) {
    const to = Math.round(g.x0 + (g.x1 - g.x0) * s);
    await slide(at, to, ms, 10);
    at = to;
    await page.keyboard.press('Enter');
    await h.wait(450);
  }
  await page.mouse.up();
  await page.keyboard.up('a');

  // one more neutrino at 8,500 km: click the tank
  await page.mouse.move(g.dx, g.dy);
  await page.mouse.down(); await h.wait(150); await page.mouse.up();
  await h.wait(800);
};
