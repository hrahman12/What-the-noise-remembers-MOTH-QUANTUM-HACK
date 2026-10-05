// Demo clip, 10 Squeezed Chirp / LIGO Night Shift (~9 s). One full round of the night shift, as a visitor plays it:
//   0. the page's own title card ("Catch the first black-hole merger ever heard.") for a beat;
//   1. the LLO control-room console fills the frame: the spectrogram monitor and the lensed black holes on top, the
//      squeezer dial, the MERGER! deck and the shift log below. The squeezer knob is dragged round to r = 4 and back to
//      r = 1 (the readout under it follows);
//   2. START RUN: the 3, 2, 1 count on the screen and on the MERGER! button;
//   3. the real GW150914 chirp plays (2.1 s, 8x slow): the blurred spectrogram scrolls in behind the NOW line, the two
//      black holes spiral in and merge, the end test masses swing, the control-room clock ticks;
//   4. MERGER! pressed at the loudest moment (the button greys to "logged at ... ms", the white line on the screen);
//   5. the pitch line is dragged on the spectrogram up, then down to the ridge's peak, and locked;
//   6. the result: TRUE PEAK circle and window on the screen, the EVENT CANDIDATE card with the merged-hole badge, the
//      Candidate lamp, the timing / pitch / total score and the achievements toast.
// Page files are untouched. For the recording only, the console is restyled in the browser into one 960x600 frame
// (the page's own layout stacks it ~1100 px tall at this width): the "what this setting allows" unit, the note row and
// the best/achievement lists are hidden, the deck puts MERGER! beside its prompt and buttons, and the event card is laid
// over the dial and deck once it appears. Every press is a real mouse event on the page's own controls, except that the
// MERGER! click is fired in the page on the audio clock's peak (see step 4) so the catch lands in the window every take;
// a drawn pointer follows the mouse (the recorder does not draw the OS cursor). The clip is silent; headless Chromium
// still plays the real audio element, whose clock drives the whole round.
module.exports = async (page, h) => {
  // 0) the page's own title card, held briefly. The recorder's video starts at the page's first frame, which on this page
  // (six real grids decoded at load) comes 1-2.3 s after navigation, while the cut is timed from navigation, so the
  // clip opens that long after this recipe starts (measured with an on-page timer: ~first-paint ms when the browser
  // reports first-paint, up to ~2.3 s when it does not). Hold the title through it so the clip opens on the title.
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : null; });
  await h.wait(Math.max(300, (fp ? Math.min(3000, fp) + 550 : 2700) - (Date.now() - r0)));

  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    #console{position:fixed!important;left:0!important;top:0!important;width:960px!important;height:600px!important;z-index:50!important;border:0!important;display:flex!important;flex-direction:column;box-sizing:border-box}
    #console .cbar{flex:none;flex-wrap:nowrap!important;padding:.5rem .8rem!important;font-size:.62rem!important;letter-spacing:.08em!important}
    #console .cbar .site,#console .lamps{flex-wrap:nowrap!important;white-space:nowrap}
    #console .cgrid{flex:1;min-height:0;grid-template-columns:200px 352px minmax(0,1fr)!important;grid-template-rows:330px minmax(0,1fr)!important;grid-template-areas:"spec spec src" "sq deck score"!important;gap:8px!important;padding:8px!important}
    #console .spec .screen{aspect-ratio:auto!important;flex:1}
    #console .src .screen{min-height:0!important;flex:1}
    #console .tm-strip svg{max-height:58px}
    #console .mon-f{padding:.35rem .65rem}
    #console .desk{display:contents!important}
    #console .u-allow,#console .note,#console .score .sc-b,#console .score .sc-c,#console .setcap{display:none!important}
    #console .u-sq,#console .deck{border:1px solid var(--rule);background:var(--panel-2);padding:7px 10px;min-height:0;overflow:hidden}
    #console .u-sq{grid-area:sq!important;gap:4px}
    #console #dial{max-width:150px!important;-webkit-user-select:none;user-select:none;outline:none!important}
    #console #dial *{-webkit-user-select:none;user-select:none}
    #console .setline{font-size:.68rem}
    #console .deck{grid-area:deck!important;grid-column:auto;display:grid!important;grid-template-columns:124px minmax(0,1fr);grid-template-rows:auto auto 1fr;column-gap:14px;row-gap:8px;align-content:start;justify-items:stretch}
    #console .deck .unit-h{grid-column:1/-1}
    #console .merger{grid-column:1;grid-row:2/4;width:116px;height:116px;margin:6px 0 0 4px;font-size:1.02rem}
    #console .prompt{grid-column:2;grid-row:2;text-align:left;min-height:0;margin:0;font-size:.7rem}
    #console .deck .btns{grid-column:2;grid-row:3;justify-content:flex-start;align-self:start}
    #console .score{grid-area:score!important;display:block!important;padding:7px 10px!important;overflow:hidden}
    #console .score .sc-a{display:grid;gap:8px}
    #console .tot b{font-size:1.45rem}
    #console .formula{font-size:.6rem;line-height:1.45}
    #console .alert{align-content:center;align-items:center!important;grid-area:auto!important;grid-column:1/3!important;grid-row:2!important;z-index:5;grid-template-columns:72px minmax(0,1fr)!important;gap:.3rem 1rem!important;padding:.6rem .8rem!important;overflow:hidden;box-shadow:0 0 0 8px var(--panel)}
    #console .alert .badge{width:72px;height:72px}
    #console .alert .pub,#console .alert p{display:none!important}
    #console .alert h3{margin-bottom:.25rem;font-size:.78rem}
    #console .alert dl{font-size:.66rem;line-height:1.4;gap:.1rem .7rem}
    .toast{z-index:70!important;bottom:14px!important}
    #demo-cursor{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;width:26px;height:26px;transform:translate(-200px,-200px)}
    #demo-cursor svg{position:absolute;left:0;top:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
    #demo-cursor i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:3px solid #E8622A;background:rgba(232,98,42,.18);opacity:0;transform:scale(.5);transition:opacity .1s,transform .1s}
    #demo-cursor.down i{opacity:1;transform:scale(1)}` });
  const g = await page.evaluate(() => {
    const cur = document.createElement('div'); cur.id = 'demo-cursor';
    cur.innerHTML = '<i></i><svg width="22" height="30" viewBox="0 0 22 30"><path d="M1 1 L1 24 L7 18.5 L11 28 L15 26.3 L11 17 L19 17 Z" fill="#fff" stroke="#19238E" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const at = e => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; };
    addEventListener('pointermove', at, true);
    addEventListener('pointerdown', e => { at(e); cur.classList.add('down'); }, true);
    addEventListener('pointerup', () => setTimeout(() => cur.classList.remove('down'), 90), true);
    LZ.lastT = null; updateAll();                             // redraw the canvases at their new sizes
    const c = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const m = dial.getScreenCTM(), knob = a => { const p = dial.createSVGPoint(); p.x = DC[0] + 52 * Math.sin(a * Math.PI / 180); p.y = DC[1] - 52 * Math.cos(a * Math.PI / 180); const q = p.matrixTransform(m); return { x: q.x, y: q.y }; };
    return { knob: [50, 70, 90, 100, 85, 65, 45, 25, 8, 0].map(knob), start: c(document.getElementById('start')), merger: c(document.getElementById('merger')),
             lens: c(document.getElementById('lens')) };
  });
  await page.mouse.move(g.lens.x - 40, g.lens.y + 150);
  await h.wait(200);

  // 1) set the squeezer: drag the knob round to r = 4 and back to r = 1
  await page.mouse.move(g.knob[0].x, g.knob[0].y, { steps: 7 });
  await page.mouse.down();
  for (const p of g.knob.slice(1)) await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.up();
  await h.wait(150);

  // 2) START RUN, then the 3-2-1 count (1.65 s)
  await page.mouse.move(g.start.x, g.start.y, { steps: 7 });
  await page.mouse.down(); await h.wait(60); await page.mouse.up();
  await h.wait(300);
  await page.mouse.move(g.merger.x + 6, g.merger.y + 10, { steps: 14 });

  // 3-4) the chirp plays; MERGER! at the loudest moment. The button is pressed (a real mouse-down) just before the peak;
  // the click itself is fired in the page the moment the audio clock reaches the peak, through the button's own
  // handler (a mouse-up sent from here lands 30-130 ms of wall clock late, i.e. 4-16 ms of chirp time, round to round).
  await page.waitForFunction(() => game.phase === 'listen' && playT !== null && playT >= PEAK.t - 0.03, null, { timeout: 15000, polling: 'raf' });
  await page.mouse.down();
  await page.evaluate(() => new Promise(res => {
    const a = players[gridKey(dialKey())];
    const f = () => {
      if (game.phase !== 'listen') return res();
      const T = a && a.duration ? audioTime(a.currentTime / a.duration, M.audio) : playT;   // the page's own clock
      if (T !== null && T >= PEAK.t - 0.0015) { document.getElementById('merger').click(); return res(); }
      setTimeout(f, 4);
    }; f();
  }));
  await page.mouse.up();

  // 5) the chirp ends; drag the pitch line on the screen: up past the ridge, then down onto its peak
  await page.waitForFunction(() => game.phase === 'pitch', null, { timeout: 15000, polling: 50 });
  const s = await page.evaluate(() => {
    const r = specC.getBoundingClientRect(), b = specBox, k = r.height / specC.height, x = r.left + b.X(0.012) * r.width / specC.width;
    const y = f => r.top + b.Y(f) * k;
    const lk = document.getElementById('lock').getBoundingClientRect();
    return { x, y200: y(200), y235: y(235), y112: y(112), yPeak: y(PEAK.f + 0.4), lock: { x: lk.left + lk.width / 2, y: lk.top + lk.height / 2 } };
  });
  await page.mouse.move(s.x, s.y200, { steps: 7 });
  await page.mouse.down();
  await page.mouse.move(s.x - 8, s.y235, { steps: 8 });
  await page.mouse.move(s.x - 16, s.y112, { steps: 12 });
  await page.mouse.move(s.x - 18, s.yPeak, { steps: 6 });
  await page.mouse.up();
  await h.wait(200);

  // 6) lock it: the true peak, the event card, the score and the toast
  await page.mouse.move(s.lock.x, s.lock.y, { steps: 7 });
  await page.mouse.down(); await h.wait(60); await page.mouse.up();
  await page.mouse.move(s.lock.x + 470, s.lock.y - 330, { steps: 8 });
  await h.wait(900);
};
