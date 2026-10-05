// Highlight: the scroll unrolls. Desk (pixel roll + archaeologist moth) over the CT slice, both in frame.
// The CT spiral (clean ink, tinted so the Greek line glows warm) unspools while the roll trundles left
// across the desk; part-way the view flips to the raw "ink layer only" (a black disc with white Greek
// letters) and keeps unrolling into a long ribbon.
// Timing note: the recorded video loses a variable 0.5-1.7 s at the start of the recipe (page still busy),
// so the unroll is one continuous motion that starts gently and speeds up: wherever the clip begins, it moves.
// The loop runs in the page, so it keeps unrolling through the recorder's 0.5 s tail as well.
module.exports = async (page, h) => {
  await page.evaluate(async () => {
    const ct = document.getElementById('gl').getBoundingClientRect();
    scrollTo(0, Math.round(ct.bottom + scrollY - innerHeight + 1));   // CT slice fully in, desk above it
    Object.assign(st, { u: 0.08, clean: true, tint: true, k: 100, inkOnly: false, focus: 'roll', zoom: 1 });
    camInit = false; need(); render();
    await Promise.all([loadGrey('img/base.webp'), loadGrey('img/ink_clean.webp')]);
    camInit = false; render();
  });
  await page.evaluate(() => new Promise(res => {
    const T = 5000, t1 = performance.now();
    const step = now => {
      const x = (now - t1) / T;                               // 0..1 over the recipe, a little past 1 in the tail
      st.u = Math.min(0.7, 0.08 + 0.5 * (x + 1.5 * x * x) / 2.5);   // gentle start, accelerating unroll
      if (!st.inkOnly && st.u > 0.31) st.inkOnly = true;     // the big flip: raw ink layer, white letters on black
      camInit = false;                                       // camera locks to the roll (no glide lag while recording)
      render();
      if (x >= 1) res();
      if (x < 1.25) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
};
