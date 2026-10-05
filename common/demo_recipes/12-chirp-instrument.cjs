// Demo clip for 12 Chirp Instrument (~8 s): the stage (the pixel plate of GW150914's two black holes over the two LIGO
// observatories, the tape under it) fills the 960x600 frame. The tour a visitor takes:
//   1. the plate at rest: the two shadows with their photon rings bending the starlight, Hanford and Livingston below;
//   2. "Merger" in the toolbar: the playhead jumps to the last stretch and the loop is set on it;
//   3. six taps on the black holes, faster and faster: each tap sends out the next real half-wave as a ripple across
//      the sky, the orbit turns a quarter turn, the ripple lands on Livingston first, then Hanford (light runs down
//      the arms, the photodetector flashes), and the readout climbs (half-wave count, ridge Hz, km apart, fraction of c);
//   4. a tap on the quantum blur cloud steps its reach from 0 to 0.5 (toast: every dot is a real blurred note);
//   5. Play: the pair spirals in and merges ("MERGED: ONE 62 MSUN HOLE", "ringing down at 251 Hz"), the last ripples
//      pour out, and the blur cloud throws its grains as the blurred notes start.
// A drawn pointer follows the real mouse events (the recorder does not draw the OS cursor), with a ring on each press.
// The clip is silent, so the page's synth is a no-op (the scene never reads it; the transport still runs on the
// page's own AudioContext clock). Nothing in the piece's own code is changed.
// GIF size: the ray-traced sky and the ripples change most of the frame, so the recorder's own GIF (96 colours, Bayer
// dither) comes out at ~4.7 MB and drops the orange laser light. The shipped GIF is re-encoded from the MP4 at the same
// 640 px and 12 fps with no dither and a 32-colour palette (28 from palettegen stats_mode=diff, plus the ink palette's
// orange #B4541A, the pointer ring #E8622A and two blends), via paletteuse=dither=none:diff_mode=rectangle: ~2.2 MB.
module.exports = async (page, h) => {
  await page.evaluate(() => {
    const css = document.createElement('style');
    css.textContent = `
      #demo-cursor{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;width:26px;height:26px;transform:translate(-200px,-200px)}
      #demo-cursor svg{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      #demo-cursor i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:3px solid #E8622A;background:rgba(232,98,42,.18);opacity:0;transform:scale(.5);transition:opacity .1s,transform .1s}
      #demo-cursor.down i{opacity:1;transform:scale(1)}
      html{scroll-behavior:auto!important}`;
    document.head.appendChild(css);
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<i></i><svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const at = e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', at, true);
    addEventListener('pointerdown', e => { at(e); cur.classList.add('down'); }, true);
    addEventListener('pointerup', () => setTimeout(() => cur.classList.remove('down'), 90), true);
    window.voice = () => null;                                   // silent take
    const s = document.querySelector('.stage').getBoundingClientRect();
    scrollTo(0, s.top + scrollY - Math.max(0, (innerHeight - s.height) / 2));
  });
  await h.wait(150);
  // scene geometry in page pixels: the pair, the blur cloud, the Merger button
  const g = await page.evaluate(() => {
    const r = document.getElementById('scene').getBoundingClientRect(), L = SC.L, k = r.width / AW, B = L.blur;
    const m = document.querySelector('#g-preset [data-preset="merger"]').getBoundingClientRect();
    return { pair: { x: r.left + L.px * k, y: r.top + L.py * k }, blur: { x: r.left + (B.x + B.w / 2) * k, y: r.top + (B.y + B.h / 2) * k },
             merger: { x: m.left + m.width / 2, y: m.top + m.height / 2 } };
  });
  const press = async (p, hold = 70) => { await page.mouse.move(p.x, p.y); await page.mouse.down(); await h.wait(hold); await page.mouse.up(); };
  await page.mouse.move(g.pair.x + 220, g.pair.y + 40);
  // 1) the plate at rest (the recorder's cut starts somewhere in here)
  await h.wait(1500);
  // 2) Merger: the loop and the playhead go to the last stretch
  await page.mouse.move(g.merger.x, g.merger.y, { steps: 10 });
  await press(g.merger);
  await h.wait(300);
  // 3) tap the black holes, speeding up into the merger: one real half-wave per tap
  await page.mouse.move(g.pair.x + 6, g.pair.y + 4, { steps: 10 });
  for (const gap of [440, 390, 340, 300, 270, 250]) { await press({ x: g.pair.x + 6, y: g.pair.y + 4 }); await h.wait(gap); }
  // 4) the blur cloud: reach 0 -> 0.5
  await page.mouse.move(g.blur.x, g.blur.y, { steps: 10 });
  await press(g.blur);
  await h.wait(400);
  // 5) Play (the deck's Play button, below the frame): through the merger and the ringdown
  await page.evaluate(() => document.getElementById('play').click());
  await page.mouse.move(g.blur.x + 390, g.blur.y + 205, { steps: 14 });
  await h.wait(2100);                                          // the merger 1.1 s in, then the ringdown
};
