// Highlight: 03 Moth Eye. Frame the engraved plate and swing the live 3D nanopillar facet in the loupe between a front
// three-quarter view and side-on from above; each time it turns side-on the bat on its arc spots the shine and swoops
// in ("Spotted!"), then drops back as the facet turns away.
// Driven in-page on a clock through the piece's own state and redraw (the same update the loupe drag makes), one synced
// WebGL draw per frame: headless Chromium renders WebGL in software and otherwise drops or reorders canvas frames.
// The video's first ~0.5-1.6 s is lost to screencast start-up lag, so the motion is periodic: whatever window is kept
// holds a full swing and a "Spotted!", and the clip ends on the second one.
module.exports = async (page, h) => {
  await page.evaluate(() => {
    const box = document.getElementById('scenebox');
    window.scrollTo(0, Math.round(box.getBoundingClientRect().top + window.scrollY));
  });
  await page.evaluate(() => new Promise(done => {
    const gl = V.renderer.getContext(), px = new Uint8Array(4);
    const az0 = st.az, el0 = st.el, az1 = 128, el1 = 28, P = 2.9, END = 4.35;  // 1.5 swings: out, back, out (ends side-on)
    const T0 = performance.now();
    const frame = now => {
      const t = Math.min(END, (now - T0) / 1000), w = 2 * Math.PI * t / P, u = (1 - Math.cos(w)) / 2;
      st.az = az0 + (az1 - az0) * u;
      st.el = el0 + (el1 - el0) * u + 18 * Math.sin(w);                 // out over the top, back underneath
      render(false); draw();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);        // wait for the software GL frame to land
      if (t < END) requestAnimationFrame(frame); else done();
    };
    requestAnimationFrame(frame);
  }));
  await h.wait(150);   // the recorder adds 0.5 s live (the bat's swoop) and the video ends on a held frame of it
};
