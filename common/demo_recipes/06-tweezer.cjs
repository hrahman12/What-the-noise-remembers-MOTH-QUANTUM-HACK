// Demo clip for 06 Tweezer, "Walk one atom array through a day" (~9.5 s).
// The frame holds the pixel lab and the stage card side by side (runtime restyle only, nothing in the piece is edited):
// on the left the lab (the lab clock, Tweezy's speech bubble with the stage's real numbers, Earlier / Later, and the
// serpentine path of 18 stations, six a row at this width, with Tweezy on it) and, under it, the card's own hop score
// (survival F against the chance mark) pinned there; on the right the stage card's pixel scene and its buttons.
//   1. 05:00 coin: a tap on the scene tosses the 144 coins again: the coin flips, the two jars fill to the real
//      ibm_fez totals (74 caught, 70 missed).
//   2. Later: Tweezy walks to 05:30 and the clock turns; "Load again" rains atoms into the 12 x 12 tweezer array
//      (one real IBM bitstring per attempt).
//   3. A tap on the 09:00 station: Tweezy walks the top row and round the bend while the clock sweeps to 09:00 (the
//      window turns from night to day) and arrives dizzy (that hop's F is within 0.06 of chance). "Run the moves":
//      eight atoms run in through the engine's open lanes; the target zone goes from 11 to 19 of 20 (as the camera
//      believes).
//   4. A tap on the 10:00 station: Tweezy walks on to the Rydberg atom; the glowing atoms are a measured blockade
//      pattern, sparks mark neighbours that clash; a tap on the scene shows the next most frequent pattern.
// A drawn pointer follows the real mouse events (the recorder does not draw the OS cursor), with a ring on each press.
// Everything runs through the page's own handlers (real pointer events on its buttons, stations and canvases).
// Timing: the browser's video starts a little after record_demo.cjs's clock (0.2-1.5 s), so the coin toss waits until
// 0.9 s and is seen whole either way; every later step sits at a fixed recipe time.
module.exports = async (page, h) => {
  const T0 = Date.now(), at = ms => h.wait(Math.max(0, T0 + ms - Date.now()));
  // 1) frame: lab on the left, stage card on the right, both pinned to the 960 x 600 viewport
  await page.evaluate(() => {
    document.querySelector('section.lab').scrollIntoView({ block: 'start', behavior: 'instant' });
    const css = document.createElement('style');
    css.textContent = `html,body{overflow:hidden!important}
      #demo-bg{position:fixed;inset:0;background:#FBFAF9;z-index:40}
      section.lab{position:fixed!important;left:8px;top:6px;width:478px;margin:0!important;z-index:50}
      section.lab .ink-bar{padding:.7rem .9rem!important}
      section.lab .labbox{padding:10px 12px 12px!important;gap:10px!important}
      section.lab .labbox>p.note{display:none!important}
      section.lab .labhead{grid-template-columns:auto minmax(0,1fr)!important;gap:8px 12px!important;align-items:start!important}
      section.lab .labnav{grid-column:1/-1;justify-content:flex-end}
      section.lab .labnav .btn{padding:.6rem 1rem!important;font-size:.86rem!important}
      section.lab .say{font-size:.84rem!important;line-height:1.38!important;padding:.45rem .7rem!important}
      section.inst{position:fixed!important;left:494px;top:6px;width:458px;margin:0!important;z-index:50;display:block!important}
      section.inst .rail{display:none!important}
      #card{padding:10px 16px 12px!important;gap:8px!important}
      #card .chead{grid-template-columns:auto minmax(0,1fr)!important;gap:6px 14px!important;align-items:center!important}
      #card .chead>div{display:contents}
      #card .clock{font-size:2.2rem!important}
      #card .chead h2{font-size:1.08rem!important}
      #card #c-chips{grid-column:1/-1;margin-top:0!important;flex-wrap:nowrap!important}
      #card .chip{font-size:.64rem!important;padding:.34rem .55rem!important}
      #card .vhead,#card .analogy,#card .role,#card .fez,#card .stepper{display:none!important}
      #view{gap:8px!important}
      #view .runsel,#view>p.note,#view>.label,#view>.patterns{display:none!important}
      #view .ctl{flex-wrap:nowrap!important;gap:.5rem!important}
      #view .ctl .btn{padding:.55rem .9rem!important;font-size:.84rem!important;flex:none}
      #view .ctl .seg{flex-wrap:nowrap!important}
      #view .ctl .seg button{padding:.45rem .6rem!important;font-size:.64rem!important}
      #view .ctl input[type=range]{min-width:4rem!important}
      #card .hop{position:fixed!important;left:8px;top:512px;width:478px;box-sizing:border-box;z-index:50;background:var(--panel);border:1px solid var(--ink);padding:8px 14px!important;gap:.2rem 1rem!important}
      #card .hop::before{content:'Survival F at this hop';grid-column:1/-1;font:500 .66rem/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}
      #card .hop .big{font-size:1.9rem!important}
      #card .hop .note{margin-top:.3rem!important;font-size:.68rem!important;line-height:1.35!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .toast{z-index:60!important}
      #demo-cursor{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;width:26px;height:26px;transform:translate(700px,330px)}
      #demo-cursor svg{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      #demo-cursor i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:3px solid #B4541A;background:rgba(180,84,26,.18);opacity:0;transform:scale(.5);transition:opacity .1s,transform .1s}
      #demo-cursor.down i{opacity:1;transform:scale(1)}`;
    document.head.appendChild(css);
    const bg = document.createElement('div'); bg.id = 'demo-bg'; document.body.appendChild(bg);
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<i></i><svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const mv = e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', mv, true);
    addEventListener('pointerdown', e => { mv(e); cur.classList.add('down'); }, true);
    addEventListener('pointerup', () => setTimeout(() => cur.classList.remove('down'), 110), true);
    // the page's own resize handler re-lays the path (6 stations a row at this width), the clock and the scene
    dispatchEvent(new Event('resize'));
  });
  await h.wait(200);

  // screen positions, read from the page's own layout
  const el = sel => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  const station = id => page.evaluate(id => { const b = PATHC.btns[CHAIN.findIndex(s => s.id === id)].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * .45 }; }, id);
  const btn = text => page.evaluate(t => { const b = [...document.querySelectorAll('#view .ctl button')].find(x => x.textContent.trim() === t).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, text);
  const sceneAt = (fx, fy) => page.evaluate(([fx, fy]) => { const b = document.querySelector('#view canvas.pix').getBoundingClientRect(); return { x: b.left + b.width * fx, y: b.top + b.height * fy }; }, [fx, fy]);
  let px = 700, py = 330;
  const glide = async (to, ms) => {                    // a hand-paced pointer move, timed by the clock
    const x0 = px, y0 = py, t0 = Date.now();
    for (;;) { const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      await page.mouse.move(x0 + (to.x - x0) * e, y0 + (to.y - y0) * e); if (t >= 1) break; await h.wait(16); }
    px = to.x; py = to.y;
  };
  const tap = async () => { await page.mouse.down(); await h.wait(70); await page.mouse.up(); };
  await page.mouse.move(px, py);

  // 2) 05:00: toss the 144 coins again (tap on the scene): the coin flips and the jars fill to 74 / 70
  await at(650);
  await glide(await sceneAt(.5, .62), 280); await tap();
  // 3) Later: Tweezy walks to 05:30; Load again rains one real IBM loading attempt into the tweezers
  await at(2650);
  await glide(await el('#lab-next'), 330); await tap();
  await at(3400);
  await glide(await btn('Load again'), 280); await tap();
  // 4) tap the 09:00 station: Tweezy walks the top row and round the bend while the clock sweeps to 09:00 and the
  //    card opens on the maze; Run the moves is pressed as Tweezy arrives
  await at(4450);
  await glide(await station('maze'), 380); await tap();
  await at(5400);
  await glide(await btn('Run the moves'), 330); await tap();
  // 5) tap the 10:00 station: on to the Rydberg atom; a tap on the scene shows the next most frequent pattern
  await at(7850);
  await glide(await station('graph'), 330); await tap();
  await at(8950);
  await glide(await sceneAt(.55, .55), 280); await tap();
  await at(9900);
};
