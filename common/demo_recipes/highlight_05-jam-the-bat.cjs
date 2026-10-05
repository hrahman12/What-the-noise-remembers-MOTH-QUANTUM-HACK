// Highlight clip for 05 Jam the Bat (~4.5-5 s): the night sky fills the frame and a flight starts muted on the
// IBM ibm_fez bank. The bat dives in from above while the moth holds a click train: broken orange sonar arcs,
// orange zaps on the moth, the bat goes dizzy and reels right through the moth, the "Jammed: the bat broke off
// its attack" call-out and the first pass pip, then the next bat comes in from the left and gets jammed too.
// The moth is flown in-page by the piece's own tournament autopilot (J.autopilot, unchanged: steer across the
// bat's path, hold clicks once the bat is within 330 px). Flight 26's bat noise seed is used because its first
// pass brings the bat closest to the moth on screen (st.round = 25, then start() makes it round 26).
module.exports = async (page, h) => {
  // 1) frame the stage first so the earliest frames are the night sky, not the headline
  await page.evaluate(() => {
    document.body.style.paddingInline = '0';                 // let the 16:9 stage span the full 960 px width
    window.dispatchEvent(new Event('resize'));                // the page refits its canvas on resize
    document.getElementById('ov-start').hidden = true;        // start() hides this card anyway
    const r = document.getElementById('stage').getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY, behavior: 'instant' });
  });
  // 2) "Start muted" and let the autopilot fly
  await page.evaluate(() => {
    st.round = 25;
    start(true);
    // skip the first 0.6 s of flight (the bat is still off screen): the same autopilot steps the frame loop would run
    for (let i = 0; i < 60; i++) J.advance(g, 10, J.autopilot(g));
    const drive = () => {
      if (g && !g.over) { const a = J.autopilot(g); st.pointer = a.target; st.holdKey = a.hold; }
      requestAnimationFrame(drive);
    };
    drive();
  });
  await h.wait(4000);
};
