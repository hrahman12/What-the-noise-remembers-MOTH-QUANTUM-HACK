// Demo clip for 02 Coda Reservoir (~6 s of motion, then the result holds): the pixel-art sea fills the frame.
// Tap the research boat to play the submitted track: the real sperm whales click in turn (heads light, sonar rings
// go out, coda bubbles fill dot by dot) while the dotted 12-qubit reservoir whale sleeps and counts its warm-up ("WARM-UP: n OF 31 REAL CODAS").
// Arrow keys on the focused sea skip ahead 5 s at a time to just before the real split, where the reservoir wakes:
// "THE RESERVOIR TAKES OVER", its qubit dots flicker and it answers with its own generated 5A coda.
module.exports = async (page, h) => {
  // frame the sea: canvas top just under the viewport edge, the "Now" line and transport visible below it
  const r = await page.evaluate(() => {
    const c = document.getElementById('scene');
    const r0 = c.getBoundingClientRect();
    window.scrollTo({ top: r0.top + window.scrollY - 6, behavior: 'instant' });
    const b = c.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  await page.mouse.move(r.x + r.w * 0.5, r.y + r.h * 0.97);
  await h.wait(200);
  // tap the research boat: the submitted track (real codas, then the reservoir) plays from the start
  await page.mouse.click(r.x + r.w * 0.072, r.y + r.h * 0.085);
  await h.wait(2400);                       // whales 3, 4 and 1 call in turn; the reservoir counts 1, 2, 3 of 31
  // skip ahead along the recording (the sea keeps focus after the tap): the warm-up counter races to 31 of 31
  for (let i = 0; i < 7; i++) { await page.keyboard.press('ArrowRight'); await h.wait(70); }
  // the reservoir wakes at the real split time and answers with its own 5A coda; the clip ends (and its last
  // frame holds) on the "THE RESERVOIR TAKES OVER" banner with the coda bubble filled
  await h.wait(2600);
};
