// Highlight: Moth to Flame. Night Town (156 qubits on IBM ibm_fez, shot 1) fills the frame in big pixel art.
// The moth rests on its night flowers, takes off with a burst of flapping, and a lit street lamp grabs it:
// "a lamp has you", spinning stars, and it loops round the glow.
const PXS = 8, PXB = 4;          // screen px per sprite px; the canvas draws at PXB and is shown PXS/PXB times larger (crisp)
const CX = 5.2, CY = 1.65;       // town point (in squares) placed mid-frame: the flowers, the street and the lamp that catches the moth
module.exports = async (page, h) => {
  // one task: restyle (stage fills the 960x600 viewport), pick the level, set the lamp pull, freeze the camera on the whole town
  await page.evaluate(([pxs, pxb, cx, cy]) => {
    const dpr = pxb / pxs, Lv = LEVELS[2], s = pxb * 24, m = .3;
    const cw = Math.ceil((Lv.cols + 2 * m) * s) + 2, ch = Math.ceil((Lv.rows + 2 * m) * s) + 2;   // backing size: whole town at PXB
    const ox = Math.round((cw - Lv.cols * s) / 2), oy = Math.round((ch - Lv.rows * s) / 2);
    const left = Math.round(480 - (ox + cx * s) / dpr), top = Math.round(300 - (oy + cy * s) / dpr);
    Object.defineProperty(window, 'devicePixelRatio', {get: () => dpr, configurable: true});
    const st = document.createElement('style');
    st.textContent = `#stage{position:fixed!important;inset:0!important;z-index:50!important;border:0!important}
      #cv{position:absolute!important;width:${cw / dpr}px!important;height:${ch / dpr}px!important;left:${left}px!important;top:${top}px!important;max-height:none!important;aspect-ratio:auto!important}
      .corner,#overlay{display:none!important}`;
    document.head.appendChild(st);
    document.querySelectorAll('#levels button')[2].click();                    // L3 Night Town, shot 1
    const p = document.getElementById('pull'); p.value = '2'; p.dispatchEvent(new Event('input'));   // lamp pull 2.0x
    if (!ui.whole) document.getElementById('t-whole').click();                 // Whole town: the camera holds still
  }, [PXS, PXB, CX, CY]);
  await h.wait(400);                                                           // the moth rests on its flowers
  await page.evaluate(() => document.getElementById('go').click());           // Take off
  await page.keyboard.down('ArrowUp');                                         // flap hard out of the flowers
  await h.wait(600);
  await page.keyboard.up('ArrowUp');
  await h.wait(3600);                                                          // the lamp catches it: stars, loops
};
