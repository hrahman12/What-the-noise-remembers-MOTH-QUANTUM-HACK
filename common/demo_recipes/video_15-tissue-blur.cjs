// Demo-video take for 15 Tissue Blur (~38 s), for the Challenge 01 submission video. One continuous play-through by
// a visible pointer, every action a real input on the page (Playwright mouse), every number shown by the page itself.
// Layout is changed at runtime only (injected CSS, nothing in the page files is edited):
//   top strip    the page's own controls, pinned in one row: Move lens / Wipe compare, Hold: measured, Scene / Data,
//                Gene set (Three territories / Folds and tracts) and Reach (0 local / 0.5 wider);
//   middle       the slide (stage) at 1024:640, as large as fits;
//   bottom strip the page's own pixel probe (measured -> blurred values under the pointer, or a caught ghost's pixel).
// A small ink arrow follows the real pointer (headless video draws no cursor), with a ring on each press.
// Beats (approximate clip times):
//   0-2 s    Three territories, all three genes, front lens (job 13e5e885): the lab mouse holds the lens, ghosts bob.
//   2-7 s    the lens is dragged to the centre (job 5ca1cb97) and on to the back (job 48faa7e1): the mouse walks along.
//   7-11 s   two ghosts are caught: hover (boo), tap (poof, the mouse gasps); the probe shows the ghost's pixel.
//   11-16 s  Wipe compare: the divider is dragged across: measured on the left (no ghosts), blur on the right.
//   16-21 s  Reach 0.5: the page switches to the one reach-0.5 job (8c8d7053, toast says so): plaid, dizzy mouse, ghost swarm.
//   21-24 s  back to reach 0, then Folds and tracts (job 331c8bd0): Fezf2 / C1ql2 / Mog.
//   24-31 s  Data view: plain engine output with the dashed mask, the probe reads pixels; Hold: measured.
//   31-38 s  cut to The data: Figure 1 (measured | blurred side by side, probe in both) and the per-gene table.
// The recipe also runs under common/qa/record_demo.cjs (setup is called if the recorder did not call it), but that
// recorder caps clips at 20 s: record with submission/challenge-01/video_work/record_long.cjs.

const PIN_CSS = `
  html{scrollbar-width:none} ::-webkit-scrollbar{display:none}
  html.vpin,html.vpin body{overflow:hidden!important}
  html.vpin .vback{position:fixed;inset:0;background:#FBFAF9;z-index:48}
  html.vpin .vstrip{position:fixed;left:0;top:0;width:960px;height:42px;background:#FBFAF9;border-bottom:1px solid #19238E;z-index:49}
  html.vpin .bar{position:fixed!important;left:10px;top:4px;z-index:51;gap:.35rem!important;margin:0!important;width:auto!important;flex-wrap:nowrap!important}
  html.vpin .bar #g-view{margin-left:0!important}
  html.vpin #g-set,html.vpin #g-reach{position:fixed!important;top:4px;z-index:51;margin:0!important;flex-wrap:nowrap!important}
  html.vpin #g-set{gap:.3rem!important}
  html.vpin .bar .seg button,html.vpin .bar .btn,html.vpin #g-set button,html.vpin #g-reach button{font-size:var(--vfs,.7rem)!important;padding:.4rem .62rem!important;line-height:1.2!important;white-space:nowrap!important}
  html.vpin #stage{position:fixed!important;top:42px!important;z-index:50!important;border:0!important;margin:0!important}
  html.vpin #cv{width:100%!important;height:100%!important}
  html.vpin #probe{position:fixed!important;left:0!important;bottom:0!important;width:960px!important;height:30px!important;box-sizing:border-box!important;margin:0!important;
    padding:0 12px!important;border-top:1px solid #19238E!important;border-bottom:0!important;background:#FBFAF9!important;z-index:51!important;
    flex-wrap:nowrap!important;align-items:center!important;gap:0 .9rem!important;overflow:hidden!important;white-space:nowrap!important;font-size:.72rem!important;min-height:0!important}
  html.vpin .toast{z-index:60!important;bottom:44px!important}
  #vptr{position:fixed;left:0;top:0;width:22px;height:28px;pointer-events:none;z-index:2147483646;will-change:transform}
  .vring{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border:2.5px solid #19238E;border-radius:50%;pointer-events:none;z-index:2147483645;
    animation:vring .42s ease-out forwards}
  @keyframes vring{from{transform:scale(.35);opacity:.95}to{transform:scale(1.15);opacity:0}}`;

async function setup(page, h){
  await page.evaluate(async (css) => {
    window.__vsetup = true;
    const s = document.createElement('style'); s.id = 'vcss'; s.textContent = css; document.head.appendChild(s);
    document.documentElement.classList.add('vpin');
    for (const c of ['vback', 'vstrip']){ const d = document.createElement('div'); d.className = c; document.body.appendChild(d); }
    // the visible pointer: an ink arrow on a paper edge, plus a ring on every press
    const p = document.createElement('div'); p.id = 'vptr';
    p.innerHTML = '<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22 L7.2 17.2 L10.6 25.4 L14.2 23.9 L10.9 15.9 L18 15.9 Z" fill="#19238E" stroke="#FBFAF9" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.body.appendChild(p);
    window.addEventListener('pointermove', e => { p.style.transform = `translate(${e.clientX - 2}px,${e.clientY - 2}px)`; }, true);
    window.addEventListener('pointerdown', e => { const r = document.createElement('div'); r.className = 'vring'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 480); }, true);
    // lay out the control strip: shrink the type until bar + gene set + reach fit in one row
    const bar = document.querySelector('.bar'), gs = document.getElementById('g-set'), gr = document.getElementById('g-reach');
    for (const fs of [.72, .7, .68, .66, .64, .62, .6]){
      document.documentElement.style.setProperty('--vfs', fs + 'rem');
      const w = bar.getBoundingClientRect().width + gs.getBoundingClientRect().width + gr.getBoundingClientRect().width;
      if (w + 20 + 2 * 22 <= 960) break;
    }
    const wb = bar.getBoundingClientRect().width, wg = gs.getBoundingClientRect().width, wr = gr.getBoundingClientRect().width;
    const gap = (960 - 20 - wb - wg - wr) / 2;
    gs.style.left = (10 + wb + gap) + 'px'; gr.style.left = (10 + wb + gap + wg + gap) + 'px';
    // the stage: 1024:640, between the strips (42 px top, 30 px probe at the bottom), centred
    const H = 600 - 42 - 30, W = Math.round(H * 1.6), st = document.getElementById('stage');
    st.style.setProperty('width', W + 'px', 'important'); st.style.setProperty('height', H + 'px', 'important');
    st.style.setProperty('left', Math.round((960 - W) / 2) + 'px', 'important');
    window.dispatchEvent(new Event('resize'));
    // preload every job image and the measured maps (the page also does this after 0.8 s)
    await Promise.all([...new Set([D.tissue, ...D.jobs.map(j => j.file), ...Object.values(D.composites).map(c => c.measured)])].map(src =>
      new Promise(res => { const i = new Image(); i.onload = i.onerror = res; i.src = src; })));
  }, PIN_CSS);
  // warm the page's pixel and colour caches for every view the take visits (so no view shows "Loading"), then the start view
  for (const tok of ['A.all.lens_512.plaid.w50.wipe', 'B.all.lens_512.echo.w50.move.data', 'A.all.lens_742.echo.w72.move', 'A.all.lens_512.echo.w50.move', 'A.all.lens_282.echo.w28.move']){
    await page.evaluate(t => { location.hash = t; }, tok);
    await h.wait(250);
  }
  await page.evaluate(() => { document.getElementById('toast').classList.remove('on'); });
  await page.mouse.move(925, 520);
  await h.wait(400);
}

module.exports = async (page, h) => {
  if (!(await page.evaluate(() => !!window.__vsetup))) await setup(page, h);
  const cvr = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; });
  const C = (x, y) => ({x: cvr.x + x * cvr.w / 1024, y: cvr.y + y * cvr.h / 640});        // canvas px -> screen px
  const box = async sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; }, sel);
  let P = {x: 925, y: 520};
  const T0 = Date.now(), mark = what => { if (process.env.VLOG) console.log(`[beat] ${((Date.now() - T0) / 1000).toFixed(2)} s  ${what}`); };
  // a hand-paced pointer move: smooth ease, a slight arc, timed by the clock (each move is a real mouse event)
  const glide = async (to, ms, arc = .06) => {
    const x0 = P.x, y0 = P.y, dx = to.x - x0, dy = to.y - y0, L = Math.hypot(dx, dy) || 1, t0 = Date.now();
    for (;;){
      const t = Math.min(1, (Date.now() - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, b = Math.sin(Math.PI * e) * arc * L;
      P = {x: x0 + dx * e - dy / L * b, y: y0 + dy * e + dx / L * b};
      await page.mouse.move(P.x, P.y);
      if (t >= 1) break;
      await h.wait(6);
    }
  };
  const tap = async (hold = 90) => { await page.mouse.down(); await h.wait(hold); await page.mouse.up(); };
  const clickEl = async (sel, ms = 750, settle = 380) => { await glide(await box(sel), ms, .1); await h.wait(140); await tap(); await h.wait(settle); };
  const hovering = () => page.evaluate(() => document.getElementById('stage').dataset.hover === 'ghost');
  const ghostTargets = () => page.evaluate(() => {   // the page's own ghost placement for the view on the slide
    const tok = decodeToken(location.hash) || {set: 'A', mask: 'lens_742', setting: 'echo', gene: -1};
    const j = findJob(D.jobs, tok.set, tok.mask, tok.setting), cv = document.getElementById('cv'), c = cv.getBoundingClientRect();
    const t = document.getElementById('tag-r').getBoundingClientRect(), f = 1024 / c.width, kg = Math.max(2, Math.max(2, Math.min(4, Math.round(c.width / 200))) - 1);
    const gs = 12 * kg * f, x0 = (t.left - c.left) * f - gs / 2, y1 = (t.bottom - c.top) * f + gs * 1.3;
    const gh = placeGhosts(j, tok.gene < 0 ? [0, 1, 2] : [tok.gene], gs * .8, (x, y) => t.width > 0 && x > x0 && y < y1);
    return gh.map(g => ({gene: g.gene, x: g.x, y: g.y - 8 * kg * f}));
  });

  mark('opening view: front lens');
  // 0) the opening view: front lens, Three territories, all three genes; the pointer drifts in towards the lens
  await h.wait(700);
  await glide(C(300, 360), 1300, .12);
  await h.wait(250);
  mark('grab the lens');
  // 1) drag the lens by its glass to the centre: the mouse walks with it, the lens snaps to the centre job
  await page.mouse.down();
  await glide(C(522, 372), 1700, .03);
  await h.wait(160); await page.mouse.up();
  await h.wait(1000);
  mark('centre lens snapped (job 2)');
  // 2) ...and on to the back lens
  await page.mouse.down();
  await glide(C(752, 372), 1500, .03);
  await h.wait(160); await page.mouse.up();
  await h.wait(900);
  // the slide's address now names the back lens; keep the page's share hash in step for ghost placement
  await page.evaluate(() => history.replaceState(null, '', '#A.all.lens_742.echo.w72.move'));
  mark('back lens snapped (job 4)');
  // 3) catch two ghosts: hover (boo), tap (poof, gasp); the probe strip shows the ghost's real pixel
  const ghosts = await ghostTargets(), used = new Set();
  for (const [wx, wy] of [[640, 470], [760, 200]]){
    const cand = ghosts.map((g, i) => ({g, i, d: Math.hypot(g.x - wx, g.y - wy)})).filter(o => !used.has(o.i)).sort((a, b) => a.d - b.d);
    for (const {g, i} of cand.slice(0, 4)){
      await glide(C(g.x, g.y), 750, .08); await h.wait(80);
      if (await hovering()){ used.add(i); mark('ghost boo'); await h.wait(420); await tap(); mark('ghost caught'); await h.wait(950); break; }
    }
  }
  mark('to Wipe compare');
  // 4) Wipe compare: the divider splits measured (left, no ghosts) from the blur (right)
  await clickEl('button[data-tool="wipe"]', 900, 450);
  const wx0 = await page.evaluate(() => D.masks.lens_742.x);
  await glide(C(wx0, 330), 800, .05);
  await page.mouse.down();
  await glide(C(470, 330), 1300, 0);
  await glide(C(990, 330), 1700, 0);
  await glide(C(700, 330), 900, 0);
  await page.mouse.up();
  await h.wait(500);
  mark('to Reach 0.5');
  // 5) Reach 0.5: only the centre lens of Three territories was run at 0.5, and the page says so; the plaid swarm
  await clickEl('#g-reach [data-setting="plaid"]', 1000, 900);
  mark('plaid on screen');
  await glide(C(512, 330), 900, .06);
  await page.mouse.down();
  await glide(C(230, 330), 1300, 0);
  await page.mouse.up();
  await h.wait(1100);
  mark('plaid wiped open');
  // 6) back to reach 0 (the plaid resolves into local blocks), then the second gene set
  await clickEl('#g-reach [data-setting="echo"]', 950, 1000);
  mark('reach 0 back');
  await clickEl('#g-set button[data-set="B"]', 800, 1000);
  mark('Folds and tracts on (job 5)');
  // 7) Data view: the plain engine output with the dashed mask; read pixels with the probe, then Hold: measured
  await clickEl('button[data-tool="move"]', 900, 300);
  await clickEl('button[data-view="data"]', 750, 600);
  mark('Data view on');
  await glide(C(470, 250), 1000, .08);
  await glide(C(560, 330), 1100, .1);
  await glide(C(600, 420), 900, .1);
  await h.wait(400);
  await glide(await box('#peek'), 1000, .1);
  await h.wait(150);
  await page.mouse.down(); mark('Hold: measured'); await h.wait(1500); await page.mouse.up(); mark('released');
  await h.wait(900);
  mark('cut to The data');
  // 8) cut to The data: Figure 1 side by side (probe in both maps), then the per-gene table for this job
  await page.evaluate(() => {
    document.documentElement.classList.remove('vpin');
    const sg = document.getElementById('stage'); ['width', 'height', 'left'].forEach(k => sg.style.removeProperty(k));
    const d = document.getElementById('data'); scrollTo(0, d.getBoundingClientRect().top + scrollY - 14);
    window.dispatchEvent(new Event('resize'));
  });
  await h.wait(500);
  const fb = await page.evaluate(() => { const r = document.getElementById('fig-b').getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; });
  const F = (x, y) => ({x: fb.x + x * fb.w / 1024, y: fb.y + y * fb.h / 640});
  await glide(F(560, 230), 900, .08);
  await glide(F(520, 300), 900, .1);
  await h.wait(500);
  await glide({x: 935, y: 470}, 700, .08);
  mark('scroll to the per-gene table');
  await page.evaluate(() => new Promise(res => {   // a slow scroll down to the table, by the clock
    const y0 = scrollY, t = document.getElementById('stats').closest('figure').getBoundingClientRect();
    const y1 = Math.min(document.documentElement.scrollHeight - innerHeight, y0 + t.bottom - innerHeight + 24), t0 = performance.now(), D = 1400;
    const step = now => { const a = Math.min(1, (now - t0) / D), e = a < .5 ? 2 * a * a : 1 - 2 * (1 - a) * (1 - a); scrollTo(0, y0 + (y1 - y0) * e); a < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  }));
  mark('table in view');
  await h.wait(2200);
  mark('end');
};
module.exports.setup = setup;
