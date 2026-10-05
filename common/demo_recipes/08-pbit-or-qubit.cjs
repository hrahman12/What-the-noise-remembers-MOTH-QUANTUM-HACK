// Demo clip, 08 Call the noise: sauna or fridge? (~6.5 s). The arcade fills the 960x600 frame: the sauna's p-bit
// (the stochastic MTJ, its free layer flipping on heat alone) on the left, the dilution fridge as a level map on the
// right, and between them the HUD (stage, score, combo, the descent pills, the envelope pips, the 15 s clock), the
// magnet board, the envelope tape and the two call buttons.
//   1. The title: the versus card, Sauna (p-bit, ~300 K) against Fridge (qubits, 10-20 mK), "Press start".
//   2. "Press start": "Stage 1 · 50 K plate" pops, the first envelope of 16 real samples flips past on the magnet
//      board while the clock runs down.
//   3. The visitor calls it: "Sizzling!" (a THRML p-bit envelope: sparks, the board shakes, steam rises, the SAUNA
//      stamp, a lab-card toast), then the next envelope flips past and the second call lands "Double!" on a fridge
//      envelope (frost falls, the FRIDGE stamp, combo x2). Score, combo, pips and the verdict update after each call.
// Page files are untouched: the layout is restyled in the browser only for the recording (the arena is pinned to the
// frame, the graph toolbar, transport row, source chip and chance meter are hidden while playing, the clock and tape
// are a little shorter, and the hit shake moves the centre column instead of the whole play area: two full-frame
// shakes of the dense side drawings pushed the GIF past 3 MB), and the page's own buttons are clicked in-page
// (element.click(), so their real handlers run;
// a Playwright click costs ~0.5 s of round trips while the recorder runs). Which fighter sent each envelope is the
// page's coin flip; the clip fixes it to sauna, then fridge (the dealt batch is redrawn with the page's own
// drawBatch, so every sample shown is real data) so both fighters' reactions appear, and the visitor calls each one
// right. Everything else (timing, playback, callouts, particles, scoring, lab-card toasts) is the page's own behaviour.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    #arena{position:fixed!important;left:0!important;top:0!important;width:960px!important;height:600px!important;box-sizing:border-box!important;z-index:50!important;overflow:hidden!important;margin:0!important;padding:10px 12px!important;align-content:start}
    #arena:has(#play:not([hidden])) .toolbar{display:none!important}
    #play{grid-template-columns:minmax(0,238px) minmax(0,1fr) minmax(0,238px)!important;gap:12px!important}
    #play .center{gap:8px!important}
    #play .srcchip,#play .transport,#play .meter,#play .tapecap,#b-sound{display:none!important}
    #play.shake,#play.thud{animation:none!important}
    #play.shake .center{animation:shake .34s cubic-bezier(.36,.07,.19,.97)}
    #play.thud .center{animation:thud .3s ease-out}
    #play .hud{padding:.45rem .65rem!important;gap:.35rem .7rem!important}
    #play .descent{gap:.14rem!important;letter-spacing:.04em!important;flex-wrap:nowrap!important}
    #play .descent i{padding:.24rem .3rem!important;white-space:nowrap}
    #tape{height:54px!important}
    #play .gbtn{min-height:54px!important}
    #play .nextrow{flex-wrap:nowrap!important;min-height:2.6rem!important;gap:.6rem!important}
    #verdict{font-size:.8rem!important;line-height:1.3!important;min-width:0}
    #b-next{flex:none;padding:.5rem .85rem!important;font-size:.8rem!important}
    .toast{z-index:70!important;top:auto!important;bottom:16px!important;left:829px!important;max-width:230px!important;border-radius:14px!important;line-height:1.35!important;font-size:.76rem!important}` });
  await page.evaluate(() => {
    // the coin flips for the two envelopes in the clip: sauna, then fridge (real batches from drawBatch)
    const want = ['pbit', 'qubit']; let n = 0;
    const orig = deal;
    window.deal = function () {
      orig();
      const w = want[n++], r = GM.round;
      if (w && r && r.truth !== w) {
        const b = drawBatch(cfg(), r.src, w);
        Object.assign(r, { truth: w, samples: b.samples, info: b.info });
        BOARD.last = null; showSample(0, false);
      }
    };
    window.scrollTo(0, 0);
  });
  // the title card; a slow first paint is cut from the clip's start, so wait it out
  await h.wait(Math.max(1000, Math.min(3000, fp) + 600 - (Date.now() - r0)));

  const click = id => page.evaluate(i => document.getElementById(i).click(), id);
  const call = () => page.evaluate(() => document.getElementById(GM.round.truth === 'pbit' ? 'b-pbit' : 'b-qubit').click());

  // 1) press start: stage 1 pops and the first envelope flips past
  await click('b-start');
  await h.wait(900);
  // 2) call it: Sizzling! on the sauna's envelope (sparks, shake, steam, the SAUNA stamp, score and pip)
  await call();
  await h.wait(1100);
  // 3) the next envelope flips past; call it: Double! on the fridge's (frost, the FRIDGE stamp, combo x2)
  await click('b-next');
  await h.wait(950);
  await call();
  await h.wait(1050);
};
