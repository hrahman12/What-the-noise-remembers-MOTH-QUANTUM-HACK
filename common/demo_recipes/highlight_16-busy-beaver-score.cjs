// Highlight reel clip for 16-busy-beaver-score (~4.5 s): the scene stage fills the 960x600 frame
// (720x450 canvas at 3 px per art pixel, scaled 4/3, so every art pixel is exactly 4x4 screen px).
// The page re-runs all 47,176,870 steps on load to build its seek checkpoints (~1 s, longer while recording); meanwhile
// the run plays from the start (phrase 1: the beaver hops along an empty river placing logs). Then it jumps to the coda
// at 30 notes/s with the strong quantum blur on: the beaver runs to the tape's right end, turns and sweeps back across
// all 12,289 cells gnawing logs away (solid river -> the 1 0 0 pattern, the far dam re-patterns, the echo pool smears),
// hits the halt at step 47,176,870 ("Dam complete!", hat throw, sparks, final chord in the pool), then the flag goes up.
// The clip is silent, so for the take the live synth is muted and the page's audio clock reads wall time: a fresh
// AudioContext sits at 0 for ~0.5 s in headless Chromium, and voicing the ~120k-note strength-0.5 blur at 30 notes/s
// starves the audio thread, either of which freezes or slows the scene (the page animates on the audio clock).
module.exports = async (page, h) => {
  const t0 = Date.now(), el = () => (Date.now() - t0) / 1000, lg = m => process.env.BB_DEBUG && console.log(el().toFixed(2), m);
  await page.addStyleTag({ content: `
    #stage{position:fixed!important;left:0!important;top:0!important;width:720px!important;margin:0!important;border:0!important;
      transform:scale(1.333334);transform-origin:0 0;z-index:2147483000}
    #warm{display:none!important}
    html,body{overflow:hidden!important}` });
  await page.evaluate(() => {
    window.voice = () => {};                                // silent take (see above); the visuals never read the synth
    audio();                                                // the page's AudioContext, created now so its clock can be set
    const base = performance.now() / 1000;
    Object.defineProperty(AC, 'currentTime', { configurable: true, get: () => performance.now() / 1000 - base });
    window.dispatchEvent(new Event('resize'));              // the scene re-sizes its canvas to the new 720 px stage
    const s = document.querySelector('#g-strength [data-strength="0.5"]');
    if (s) s.click();                                       // quantum blur, strength 0.5, reach 1: the echo pool spreads
    document.getElementById('play').click();                // play from note 1 while the page finishes its warm-up run
  });
  lg('styled+playing');
  await page.waitForFunction(() => verified === true, null, { timeout: 8000, polling: 30 }).catch(() => {});
  // the recorder's clip starts a little after this recipe does, so most of the warm-up wait never shows; only a long
  // one (phrase 1 still playing on screen) trims the coda, to the turnaround at the tape's right end (48 notes from the halt)
  const late = el() > 1.8;
  const back = late ? 46 : 52;
  lg('verified, late ' + late + ', coda notes ' + back);
  await page.evaluate(back => {
    const t = document.getElementById('tempo'); t.value = 30; t.dispatchEvent(new Event('input'));
    seekCol(HALT_COL - back);
  }, back);
  await page.waitForFunction(() => wasHalted === true, null, { timeout: 6000, polling: 30 }).catch(() => {});
  lg('halted');
  await h.wait(late ? 1300 : 1600);                   // "Dam complete!", the hat throw, sparks, the final chord
  await page.evaluate(() => document.getElementById('scene').click());   // skip the rest of it: flag up, "dam complete"
  lg('skipped');   // the recorder keeps ~0.5 s more: the flag on the lodge, "dam complete: 4,098 logs"
};
