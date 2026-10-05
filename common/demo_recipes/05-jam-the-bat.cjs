// Demo clip for 05 Jam the Bat (~10 s): one whole three-pass flight, from "Start muted" to "You escaped."
// The stage and the dash under it (bat prediction confidence, bat's fix, breath, the Hold-to-click pad) fill the
// 960x600 frame. The start card shows briefly, then "Start muted" is clicked like a visitor would. The moth is flown
// by the piece's own tournament autopilot (J.autopilot, unchanged: steer across the bat's path, hold clicks once the
// bat is within 330 px), fed through the page's own input state (st.pointer / st.holdKey, so the Hold-to-click pad
// lights up while the moth clicks). Three bats come in on the IBM ibm_fez bank: orange jamming arcs, the bat goes
// dizzy, "Jammed: the bat broke off its attack", a pass pip fills, and after the third pass the end card reads
// "You escaped." with the click count and how many the bat guessed.
// Game time runs at 1x while the bat is on screen; while it is off screen (before each pass) it runs 4x so the clip
// keeps no dead air. Steps are fixed at 10 ms like the tournament's simRound, so the flight is the same every run:
// flight 120's bat noise seed (st.round = 119, start() makes it 120) gives three jammed passes and a 9 px near miss.
module.exports = async (page, h) => {
  // 1) frame the stage plus the meters under it
  await page.evaluate(() => {
    document.getElementById('stage').scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy(0, 2);
  });
  // the start card over the idle night sky. The recorder's cut can start up to ~2 s late (the browser's video starts
  // after its clock, more so on a busy machine), so this card may be trimmed off; the flight reads fine either way.
  await h.wait(1000);

  // 2) the "visitor": the autopilot steers and holds clicks through the page's own input state
  await page.evaluate(() => {
    st.round = 119;
    const step = J.advance, A = J.autopilot;
    const onScreen = b => b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10;
    let acc = 0, last = 0;
    J.advance = (g, dt) => {
      // game time follows the wall clock (the page caps a slow frame at 50 ms, which would lag under recording load)
      const now = performance.now(); if (last) dt = Math.min(120, now - last); last = now;
      acc += dt * (onScreen(g.bat) ? 1 : 4);
      while (acc >= 10 && !g.over) {
        const a = A(g);
        st.pointer = a.target; st.holdKey = a.hold;              // what the pointer and the click pad are doing
        step(g, 10, a);
        acc -= 10;
      }
      if (g.over) st.holdKey = false;
      return g;
    };
  });
  await page.click('#go-mute');                                 // "Start muted" (no audio is captured anyway)

  // 3) fly until the end card, then let it read
  await page.waitForSelector('#ov-end:not([hidden])', { timeout: 20000 });
  await h.wait(900);
};
