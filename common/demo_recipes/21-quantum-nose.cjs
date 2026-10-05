// Demo clip for 21 The Quantum Nose Test (~7 s of clip). Plate I (the nose in section, with the detail loupe) on the left;
// the instrument's controls and Plate II, Fig. d (the vibration-theory HYPOTHESIS: inelastic electron tunnelling) on the right.
// 1) Muscone is picked: five pixel puffs of it ride the dashed sniff up the nose and dock on the olfactory epithelium;
//    in the loupe one drops onto the mucus, magnified ~1e7 times.
// 2) Play: the vibrational chord sounds, the atoms wobble with the notes, Fig. d's rungs light up and the electron
//    tunnels, handing the odorant "+1 quantum, hw = 366 meV".
// 3) Swap H <-> D: 30 neutrons fly into the 30 hydrogens in the loupe (muscone -> muscone-d30, 238.4 u -> 268.6 u),
//    the C-H notes glide down 5.35 semitones, Fig. d's C-H rungs drop out of the gap and the electron has nowhere to go.
// 4) Data view: the spectrum roll shows the deuterated chord under the dashed hydrogen lines; then the 20-qubit
//    quantum blur (strength 0.5, then reach Global, a real Atlas blur-midi-v1 job) scrambles it while it plays.
// Layout is changed only at runtime (injected CSS + fixed positions); nothing in the piece is edited. The stage is
// 626 px wide (and the roll's wrap has no side padding) so the roll canvas is at least 620 px wide and keeps its wide
// (760 px tall) drawing, which fits the 600 px viewport.
// The recorder's clip begins about (first paint - 0.1 s) after the recipe starts (measured: 0.06-0.15 s less than first
// paint over three runs), so the schedule's 0 is put there (the paint entry is polled for, since it can be missing for a
// moment after load). The swap waits for the loupe's odorant to land; every other step runs on fixed times, so a busy
// machine cannot stretch the clip. Steps after the swap are packed tight: the plate's hatching and tints make every
// second of scene cost ~0.4 MB of GIF, and the clip must stay under 3 MB (this cut: 7.2 s, 2.92 MB GIF).
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => new Promise(done => {
    const t1 = performance.now(), poll = () => {
      const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint' || e.name === 'first-contentful-paint');
      if (e) done(e.startTime); else if (performance.now() - t1 > 1500) done(1600); else setTimeout(poll, 30);
    };
    poll();
  }));
  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    #demo-bg{position:fixed;inset:0;background:var(--paper,#FBFAF9);z-index:40}
    .stage{position:fixed!important;left:6px;top:5px;width:626px;box-sizing:border-box;margin:0!important;z-index:50}
    .stage .platebar,.stage figcaption.cap,#v-key{display:none!important}
    .stage-top{padding:.5rem .7rem .4rem!important;flex-wrap:nowrap!important}
    .molname{min-width:0;flex:1 1 auto}
    #g-mol{flex:none!important;flex-wrap:nowrap!important}
    #g-mol button{padding:.4rem .62rem!important}
    .lp-read{padding:.4rem .7rem 0!important}
    .canvas-wrap{padding:.3rem 0 0!important}
    .stage .controls{position:fixed!important;left:640px;top:5px;width:432px;box-sizing:border-box;transform:scale(.727);transform-origin:0 0;z-index:51;border:1px solid var(--ink)!important;margin:0!important}
    .stage .controls .ctl-row:nth-child(4){display:none!important}
    #fig-d{position:fixed!important;left:640px;width:432px;box-sizing:border-box;transform:scale(.727);transform-origin:0 0;z-index:51;background:var(--paper,#FBFAF9);border:1px solid var(--ink)!important;margin:0!important}
    #fig-d figcaption{display:none!important}
    .toast{z-index:60!important}` });
  await page.evaluate(() => {
    const bg = document.createElement('div'); bg.id = 'demo-bg'; document.body.appendChild(bg);
    scrollTo(0, 0); window.dispatchEvent(new Event('resize'));
  });
  await h.wait(120);
  await page.evaluate(() => {   // stack Fig. d under the scaled controls
    const c = document.querySelector('.stage .controls'), d = document.getElementById('fig-d');
    d.style.top = (5 + c.offsetHeight * 0.727 + 8) + 'px';
  });
  const T0 = r0 + Math.max(150, Math.min(3000, fp) - 100), at = ms => h.wait(Math.max(0, T0 + ms - Date.now()));
  const click = async sel => { const c = await h.center(sel); await page.mouse.click(c.x, c.y); };

  // the sniff takes ~3 s to land, so muscone is picked up to 0.8 s before the clip opens: it opens on puffs in flight
  await at(-800);
  await click('#g-mol button[data-mol="muscone"]');   // a sniff: puffs of muscone ride the airflow up to the olfactory cleft
  await at(600);
  await click('#play');                                // the chord sounds; atoms wobble, Fig. d's electron tunnels
  // swap as the loupe's odorant drops onto the mucus (the drop lasts 0.7 s), so its neutrons fly in while it lands
  await page.waitForFunction(() => { const d = docked.find(q => q.li === 1); return !!d && performance.now() - d.t > 100; }, null, { timeout: 6000, polling: 100 }).catch(() => {});
  const t1 = Date.now(), after = ms => h.wait(Math.max(0, t1 + ms - Date.now()));
  await click('#swap');                                // H -> D: 30 neutrons fly into the hydrogens, the notes glide down
  await after(950);
  await page.evaluate(() => document.querySelector('#g-view button[data-view="data"]').click());   // the result: the spectrum roll (its Scene/Data bar is hidden in this layout)
  await after(1250);
  await click('#g-str button[data-str="0.5"]');        // quantum blur, strength 0.5 (local reach)
  await after(1550);
  await click('#g-reach button[data-reach="1"]');      // reach Global: the 20-qubit blur scrambles the chord
  await after(1600);   // the recorder holds ~1.2 s more (0.5 s wait + closing), so the scrambled roll stays on screen
};
