// Demo clip for 13 Moth to Flame (~9 s): one whole flight across Lamp Lane (L1, 20 qubits on IBM ibm_fez), from the
// start card to the cottage door.
// The pixel-art stage fills the 960x600 frame (runtime restyle only, nothing in the piece is edited): the town is
// drawn at the page's own integer zoom (5 screen px per art px), with the level chip, the Play / Sound buttons and the
// energy HUD over it. The start card shows over the dimmed town while the shot is stepped 1 -> 2 -> 3 (each real
// shot of the job lights a different set of street lamps, and the card's lamp count changes with it), then
// "Take off" is clicked. The moth leaves its night flowers, the lit lamp beside it grabs it (the dotted warm line,
// spinning stars, "a lamp has you" in the HUD) and swings it round a full loop; then the visitor drags toward the
// open street and flaps hard (fast wingbeats): it breaks free, runs down the street to the cottage, the door opens,
// hearts rise and the end card reads "Home in 4.5 s" with the loop and glare counts.
// Steering goes through the page's own input state (input.ptr = a drag target on the town, input.flap = the flap
// key), applied on every fixed 1/120 s sim step with the page's own pointer-steering rule, so the flight is the
// same on every run: shot 3 at the default lamp pull 1.0x -> 1 loop, home in 4.5 s with 87% energy left (end card: "1 loop and 2.7 s in the glare").
module.exports = async (page, h) => {
  const T0 = Date.now(), at = ms => h.wait(Math.max(0, T0 + ms - Date.now()));
  // 1) frame: the stage fills the viewport; the canvas is 24 px taller than the frame so the page's camera
  //    picks a 5x zoom for the 4 x 5 town (5 rows of art fit), centred, with the decoration ring at the edges
  await page.evaluate(() => {
    document.getElementById('stage').scrollIntoView({ block: 'start', behavior: 'instant' });
    const st = document.createElement('style');
    st.textContent = `html,body{overflow:hidden!important}
      #stage{position:fixed!important;inset:0!important;z-index:50!important;border:0!important;margin:0!important}
      #cv{position:absolute!important;left:0!important;top:-12px!important;width:960px!important;height:624px!important;max-height:none!important;aspect-ratio:auto!important}
      .toast{z-index:60!important}`;
    document.head.appendChild(st);
    window.dispatchEvent(new Event('resize'));
  });

  // 2) the visitor's hands: no steering while the moth first flies (the reflex takes it), then, once the lamp has
  //    spun it through a full loop, drag toward the next street corner and flap hard all the way home
  await page.evaluate(() => {
    const adj = {};
    L.edges.forEach(([a, b, , zz]) => { if (zz >= 0) { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); } });
    const route = () => {   // shortest run of open streets (measured <ZZ> >= 0) from START to HOME
      const prev = { [L.start]: -1 }, q = [L.start];
      while (q.length) { const u = q.shift(); for (const v of adj[u] || []) if (!(v in prev)) { prev[v] = u; q.push(v); } }
      const p = []; for (let u = L.home; u !== -1; u = prev[u]) p.unshift(u); return p;
    };
    let r = null, wp = null, k = 1, phase = 1;
    const step0 = Sim.step;
    Sim.step = (Wl, s, inp, Pp, dt) => {
      if (s.state === 'fly') {
        if (!r) {   // drag targets: through each square on the side away from its lit lamp
          r = route();
          wp = r.map(c => { let x = c % L.cols + .5, y = Math.floor(c / L.cols) + .5; const lp = Wl.lamps.find(l => l.i === c && l.lit);
            if (lp) { const dx = x - lp.x, dy = y - lp.y, d = Math.hypot(dx, dy) || 1; x += .22 * dx / d; y += .22 * dy / d; } return [x, y]; });
        }
        const [tx, ty] = wp[Math.min(k, wp.length - 1)];
        if (Math.hypot(tx - s.x, ty - s.y) < .3 && k < r.length - 1) k++;
        if (phase === 1 && (s.orbits >= 1 || s.t > 4)) phase = 2;
        if (phase === 2) { input.ptr = { x: tx, y: ty }; input.flap = true; } else { input.ptr = null; input.flap = false; }
        // the page's own pointer steering (currentInput), applied per step
        inp.turn = input.ptr ? Math.max(-1, Math.min(1, Sim.wrap(Math.atan2(ty - s.y, tx - s.x) - s.th) * 2.2)) : 0;
        inp.boost = input.flap; inp.handsOff = false;
      }
      const out = step0(Wl, s, inp, Pp, dt);
      if (s.state !== 'fly') { input.ptr = null; input.flap = false; }
      return out;
    };
  });

  // 3) the start card over Lamp Lane; step the shot twice: the town re-lights each time. The recorder's cut starts
  //    about 1 s after the recipe does (the browser's video lags its clock), so the card is held until then.
  await at(1450);
  await page.evaluate(() => document.getElementById('shot-next').click());   // shot 2
  await at(2050);
  await page.evaluate(() => document.getElementById('shot-next').click());   // shot 3: 11 lamps lit
  await at(2750);
  await page.click('#ov-go');                                                 // Take off

  // 4) the flight (~4.5 s): caught, one loop, flap free, home; then let the end card and hearts read
  await page.waitForFunction(() => S.state === 'home' || S.state === 'spent', null, { timeout: 15000 });
  await h.wait(800);   // plus the recorder's 0.5 s tail and the ~1 s video lag: ~2 s of end card in the clip
};
