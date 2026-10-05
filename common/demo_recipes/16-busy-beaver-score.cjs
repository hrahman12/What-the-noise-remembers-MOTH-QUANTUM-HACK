// Demo clip for 16-busy-beaver-score (~8.5 s): the scene stage fills the 960x600 frame (the 720x450 canvas at 3 px per
// art pixel, scaled 4/3, so every art pixel is exactly 4x4 screen px). The tour a visitor takes:
//   1. paused on note 1: the beaver in its hard hat, the speech bubble ("State A, reads water ...");
//      two clicks on the beaver make it slap its tail (splash). The recorder's clip starts ~1-1.7 s into the recipe
//      (the warm-up run below loads the page), so the opening hold is long enough to keep the bubble and the slaps in;
//   2. Play: phrase 1 then phrase 2 ("an empty river", "a solid block of 6 logs"), the beaver hops placing logs;
//   3. Quantum blur, strength 0.5: the beaver shivers and the echo pool smears out into echoes;
//   4. Phrase >> while playing, up to phrase 9: a time-lapse phrase, the beaver dives along a block of 564 logs;
//   5. tempo to 40 notes/s and the coda: the turn at the tape's right end, the last sweep back across 12,289 cells, the halt at step 47,176,870,
//      "Dam complete!", the hat throw and sparks, then the flag on the lodge.
// The clip is silent, so the live synth is muted and the page's audio clock reads wall time (a fresh AudioContext
// sits at 0 for ~0.5 s in headless Chromium and the page animates on the audio clock; voicing the blur's many notes
// also starves the audio thread). The page re-runs all 47,176,870 steps on load to build its seek checkpoints;
// the long jumps wait for that.
module.exports = async (page, h) => {
  const t0 = Date.now(), el = () => (Date.now() - t0) / 1000, lg = m => process.env.BB_DEBUG && console.log(el().toFixed(2), m);
  await page.addStyleTag({ content: `
    #stage{position:fixed!important;left:0!important;top:0!important;width:720px!important;margin:0!important;border:0!important;
      transform:scale(1.333334);transform-origin:0 0;z-index:2147483000}
    #warm{display:none!important}
    html,body{overflow:hidden!important}` });
  await page.evaluate(() => {
    window.voice = () => {};                                // silent take; the visuals never read the synth
    audio();                                                // the page's AudioContext, created now so its clock can be set
    const base = performance.now() / 1000;
    Object.defineProperty(AC, 'currentTime', { configurable: true, get: () => performance.now() / 1000 - base });
    window.dispatchEvent(new Event('resize'));              // the scene re-sizes its canvas to the new 720 px stage
  });
  lg('styled');
  if (process.env.BB_CLOCK) await page.evaluate(() => {   // debug only: a recipe clock in the corner, to line the clip up
    const d = document.createElement('div'), t0 = performance.now();
    d.style.cssText = 'position:fixed;right:4px;bottom:4px;z-index:2147483647;background:#f00;color:#fff;font:bold 28px monospace;padding:2px 6px';
    document.body.appendChild(d); setInterval(() => { d.textContent = ((performance.now() - t0) / 1000).toFixed(2); }, 16);
  });
  // 1) poke the beaver: the stage is scaled by CSS, so the click is placed in the canvas's own (unscaled) pixels
  const pokeBeaver = () => page.evaluate(() => {
    const r = scv.getBoundingClientRect();
    const x = r.left + (OX + beaverArtX * S) / DPR, y = r.top + (WL - 14) * S / DPR;
    scv.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  });
  await h.wait(1300);                                       // the opening: paused on note 1, the speech bubble
  await pokeBeaver();
  lg('slap 1');
  await h.wait(450);
  await pokeBeaver();                                       // and again
  lg('slap 2');
  await h.wait(550);
  // 2) Play from note 1 at 15 notes/s
  await page.evaluate(() => document.getElementById('play').click());
  lg('play');
  await h.wait(1000);
  // 3) the quantum blur, strength 0.5 (reach 1, global): the echo pool spreads out
  await page.evaluate(() => { const s = document.querySelector('#g-strength [data-strength="0.5"]'); if (s) s.click(); });
  lg('blur on');
  await h.wait(750);
  // 4) skip ahead phrase by phrase to a time-lapse phrase (needs the checkpoints)
  await page.waitForFunction(() => verified === true, null, { timeout: 8000, polling: 30 }).catch(() => {});
  lg('verified');
  await page.evaluate(() => {                               // Phrase >> until phrase 9 (a block of 564 logs, ~770 steps a hop)
    for (let i = 0; i < 12 && phraseOf(curCol()) < 8; i++) document.getElementById('next').click();
  });
  lg('phrase ' + await page.evaluate(() => phraseOf(curCol()) + 1));
  await h.wait(750);
  // 5) the tempo slider to its 40 notes/s maximum, and the coda to the halt
  await page.evaluate(() => {
    const t = document.getElementById('tempo'); t.value = 40; t.dispatchEvent(new Event('input'));
    seekCol(HALT_COL - 48);
  });
  lg('coda');
  await page.waitForFunction(() => wasHalted === true, null, { timeout: 6000, polling: 30 }).catch(() => {});
  lg('halted');
  await h.wait(1000);                                       // "Dam complete!", the hat throw, sparks
  await page.evaluate(() => document.getElementById('scene').click());   // skip the rest of it: the flag goes up
  lg('skipped');   // the recorder keeps ~0.5 s more: the flag on the lodge, "dam complete: 4,098 logs"
};
