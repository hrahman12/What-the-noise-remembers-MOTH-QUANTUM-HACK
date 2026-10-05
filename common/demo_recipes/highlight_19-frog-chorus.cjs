// Highlight (~4.5 s visible): the pond fills the frame with the chorus already calling (throats puff,
// ripples spread, call pulses run along the hearing threads). Then every frog hops off its lily pad,
// and all 22 drop back on in a staggered cascade with landing ripples, and the chorus resumes.
// The recorder's video can start 0.2-1.3 s after the recipe does, so the setup runs first and every
// opening frame is already the full pond (either the first seating cascade or the chorus calling).
module.exports = async (page, h) => {
  await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    const r = $('pond').getBoundingClientRect();
    window.scrollTo({ top: r.top + scrollY - (innerHeight - r.height) / 2, behavior: 'instant' });
    $('k')._set(10);
    $('tempo')._set(3.5);
    $('fill').click();
    $('go').click();
  });
  await h.wait(1300);
  await page.evaluate(() => document.getElementById('clear').click());
  await h.wait(900);
  await page.evaluate(() => document.getElementById('fill').click());
  await h.wait(2000);
};
