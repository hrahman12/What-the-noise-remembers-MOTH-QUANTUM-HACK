// Demo clip for 19 Frog Chorus (~8 s): the pixel pond fills the left of the frame (720 px, so the sprites draw at
// their 2x art scale) with the headline, the transport, the Coupling slider and the three meters beside it.
// 1) The 20-frog pond (the size that ran on the chip) starts empty, every frog waiting on the log. "Roll an ibm_fez
//    night" seats the frogs heard calling in one shot measured on IBM's real ibm_fez chip: they hop onto their pads in
//    a staggered cascade, mostly on every other pad (the chip kept most of the "take turns" we asked for), and the
//    toast and the Tonight line give the count and the job.
// 2) "Start the chorus": throats puff on each call and ripples spread. A frog is dragged from the log onto an empty
//    pad (it rides in the hand), then "Seat all" brings the rest of the log in.
// 3) The Coupling slider is dragged up: call pulses run along the hearing threads, the frogs lock into taking turns,
//    and Taking turns and Rhythm locked climb while In step falls.
// Presentation only (nothing in the piece is edited): the intro copy, readout panel, pond toggles, the other sliders
// and the sections below the hero are hidden; the transport, Coupling slider and meters sit in a column beside the
// pond and the Tonight readout under it. The ibm_fez roll is pinned to night #5 so every recording seats the same shot.
module.exports = async (page, h) => {
  const T0 = Date.now(), log = m => console.error(((Date.now() - T0) / 1000).toFixed(2) + 's ' + m);
  // The recorder's video has started 0.8-1.6 s after the recipe in practice, so the timeline runs from B = 1.3 s and
  // every earlier frame is already the framed, empty pond.
  const B = 1300, at = ms => h.wait(Math.max(0, T0 + B + ms - Date.now()));
  await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `
      html,body{overflow:hidden!important}
      body{padding-inline:10px!important}
      .wrap{max-width:none!important}
      .wrap>:not(.hero),.hero>.copy,.hero>.side,.pondctl,.legend .tip,.legend .jump{display:none!important}
      .hero{display:block!important;padding-block:14px 0!important}
      .inst{grid-template-columns:722px minmax(0,1fr)!important;column-gap:14px!important;align-items:start!important}
      .stage{grid-column:1;grid-row:1}
      #demo-night{grid-column:1;grid-row:2}
      #demo-col{grid-column:2;grid-row:1/span 2;display:flex;flex-direction:column;gap:12px;min-width:0}
      #demo-col>*{grid-area:auto!important;margin:0!important}
      #demo-col .lede{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;align-items:end}
      #demo-col .kicker{font-size:.6rem!important;letter-spacing:.1em!important}
      #demo-col h1{font-size:1.32rem!important;line-height:1.08!important}
      #demo-col .mascot canvas{width:44px!important;height:44px!important}
      #demo-col .transport{display:grid!important;gap:8px!important}
      #demo-col .transport .btn{justify-content:center;width:100%;min-width:0!important;padding:.62rem .6rem!important;font-size:.84rem!important}
      #demo-col .transport #night,#demo-col .transport #reset,#demo-col .transport #clear{display:none!important}
      #demo-col .panel{padding:.75rem .8rem!important;gap:.7rem!important}
      #demo-col .sliders{grid-template-columns:minmax(0,1fr)!important}
      #demo-col .sl:not(:first-child){display:none!important}
      #demo-col .meters{grid-template-columns:minmax(0,1fr)!important;gap:.55rem!important;padding-top:.7rem!important}
      #demo-col .meter .num{font-size:.66rem!important}
      #demo-col .label{font-size:.6rem!important}
      #demo-night{font:400 .7rem/1.4 var(--mono);color:var(--ink-2);margin:-4px 0 0;white-space:nowrap;overflow:hidden}
      #demo-night b{color:var(--ink);font-weight:500}
      .toast{bottom:auto!important;top:500px!important;left:371px!important;font-size:.78rem!important;max-width:690px!important}`;
    document.head.appendChild(css);
    const $ = id => document.getElementById(id), inst = document.querySelector('.inst');
    const col = document.createElement('div'); col.id = 'demo-col';
    const night = document.createElement('p'); night.id = 'demo-night'; night.append('Tonight: ', $('r-night'));
    col.append(document.querySelector('.lede'), document.querySelector('.transport'), document.querySelector('.inst .panel'));
    inst.append(night, col);
    // the 20-frog pond (the size that ran on ibm_fez), every frog on the log
    document.querySelector('#sizes button[data-size="20"]').click();
    st.occ = st.occ.map(() => 0); readouts(); meters();
    dispatchEvent(new Event('resize'));
    scrollTo({ top: 0, behavior: 'instant' });
  });
  log('setup');
  const click = async sel => { const c = await h.center(sel); await page.mouse.move(c.x, c.y, { steps: 3 }); await page.mouse.click(c.x, c.y); };
  const pond = await page.evaluate(() => { const r = document.getElementById('pond').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const L = (lx, ly) => ({ x: pond.x + lx / 1000 * pond.w, y: pond.y + ly / 620 * pond.h });   // logical pond coords -> screen
  // "Roll an ibm_fez night" picks one of the 20 chip shots at random; pin the pick for this one click
  const rollFez = async i => {
    await page.evaluate(i => { const r = Math.random; Math.random = () => (i + 0.5) / 20;
      document.getElementById('hwnight').addEventListener('click', () => { Math.random = r; }, { once: true }); }, i);
    await click('#hwnight');
  };

  // 1) a night heard on IBM ibm_fez: the frogs the chip heard calling hop onto their pads
  await at(500);
  await rollFez(4);            // night #5: 10 frogs calling, 21 of 27 pairs taking turns (no night can beat 22)
  log('fez night');
  // 2) start the chorus: throats puff on every call, ripples spread
  await at(1700);
  await click('#go');
  log('go');
  // 3) drag a frog from the log onto an empty pad at the bottom of the bank
  const lg = await page.evaluate(() => { const b = logBox(); return [b.x, b.y]; });
  const empty = await page.evaluate(() => [6, 5, 8, 3, 11, 13, 14, 16, 18, 0].find(k => !st.occ[k]));
  const dest = await page.evaluate(k => P(k), empty);
  const from = L(lg[0] - 30, lg[1] - 8), to = L(dest[0], dest[1] - 6);
  await at(2100);
  await page.mouse.move(from.x, from.y, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 6, { steps: 2 });
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2 - 30, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  log('dragged to pad ' + empty);
  // 4) seat the rest of the log
  await at(3200);
  await click('#fill');
  log('seat all');
  // 5) raise the coupling: pulses run along the hearing threads and the frogs lock into taking turns
  await at(3800);
  const k = await page.evaluate(() => { const r = document.getElementById('k').getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; });
  const kx = v => k.x + 8 + (k.w - 16) * v / 16;
  await page.mouse.move(kx(0), k.y, { steps: 2 });
  await page.mouse.down();
  for (let v = 1; v <= 12; v++) { await page.mouse.move(kx(v), k.y, { steps: 2 }); await at(3800 + v * 80); }
  await page.mouse.up();
  log('coupling ' + await page.evaluate(() => document.getElementById('k').value));
  const m = () => page.evaluate(() => ['n-r', 'n-t', 'n-l'].map(id => document.getElementById(id).textContent).join(' | '));
  await at(5000); log('meters ' + await m());
  await at(5900); log('meters ' + await m());
};
