// Demo clip for 20 Antimatter Drop (~9 s): the ALPHA-g trap fills the frame's height, with the headline and the
// controls beside it. Trial 1 at 0 g bias: click the trap to stack 19 antihydrogen atoms (they pop in), then pull the
// one-way ramp slider. The mirror coils fade, the atoms turn nervous, the quantum die rolls once per atom and each atom
// shoots up or down to annihilate on the wall (poof, pion tracks, warm detector pads, the UP/DOWN counters hop).
// The host pops up: "13 down · 6 up, mostly down!". Trial 2: press the -3 g bias (tips the trap to push atoms up),
// press Stack atoms, pull the ramp again, and this time the host says "mostly up!".
// Runtime restyle only (nothing in the piece is edited): the copy block under the headline is hidden so the
// controls panel sits beside the trap, and the trap is sized to the 600 px viewport height.
// Steps run on a fixed schedule (ms from the recipe's start) and the ramp is pulled in-page on animation frames
// (value + 'input' event, exactly what a slider drag sends), so a busy machine cannot stretch the clip.
module.exports = async (page, h) => {
  const T0 = Date.now(), at = ms => h.wait(Math.max(0, T0 + ms - Date.now()));
  // 1) frame first, so the earliest frames are the trap, not the page header
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = `.wrap{max-width:none!important}
      .hero{grid-template-columns:398px minmax(0,1fr)!important;grid-template-areas:"stage head" "stage panel"!important;grid-template-rows:auto 1fr!important;padding-block:0!important;column-gap:28px!important;row-gap:14px!important}
      .hero>.rest{display:none!important}
      .stage{max-width:none!important}
      .stage-cell{position:static!important}
      .hero>.panel{margin-top:0!important}
      .hero h1{font-size:2.6rem!important}`;
    document.head.appendChild(s);
    window.dispatchEvent(new Event('resize'));
    document.getElementById('stage').scrollIntoView({ block: 'start', behavior: 'instant' });
  });

  // pull the ramp slider forward along timed [fromValue, toValue, ms] segments (value 0..200 = ramp 0..20 s)
  const ramp = segs => page.evaluate(segs => new Promise(done => {
    const el = document.getElementById('ramp'), t0 = performance.now();
    const step = now => {
      let t = now - t0, v = segs[segs.length - 1][1];
      for (const [a, b, ms] of segs) { if (t < ms) { v = a + (b - a) * t / ms; break; } t -= ms; }
      el.value = String(Math.round(v)); el.dispatchEvent(new Event('input', { bubbles: true }));
      if (v >= 200) done(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), segs);
  const click = async sel => { const c = await h.center(sel); await page.mouse.click(c.x, c.y); };

  // 2) trial 1 at 0 g: the host waves from the empty trap (held 1.3 s; the recorder's video starts 0-2 s late, so on a busy machine the clip opens mid-ramp instead),
  //    then tap the trap to stack and lower the mirrors
  await at(1300);
  await click('#cv');                                    // the trap itself is the big button: Stack
  await at(1850);                                        // 19 atoms pop in and bob
  await ramp([[0, 96, 400], [96, 200, 1550]]);           // quick through the quiet first half, slow through the 10-20 s escape window
  await at(5150);                                        // last atoms annihilate; the host: "13 down · 6 up, mostly down!"

  // 3) trial 2: tip the trap with -3 g (pushes atoms up), stack, ramp again
  await click('#g-bias button[data-bi="0"]');            // the -3 g bias button
  await at(5350);
  await click('#stack');
  await at(5850);
  await ramp([[0, 96, 300], [96, 200, 1400]]);
  await at(8700);                                        // the host: "2 down · 22 up, mostly up!"
};
