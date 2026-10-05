// Demo clip, 09 Syndrome Loom (~9 s). The whole illustrated loom fills the left of the frame (head, punch cards,
// heddles, the cloth, the red-flag post, Inspector Hamming on his lift and Ada the weaver moth on her bench); the
// page's own controls and meter sit in a column on the right.
//   1. Turn the noise dial to p = 0.01: the cloth flashes where threads changed and Ada sighs "the code hurts here...".
//   2. "Weave from the top": the shuttle runs pick by pick, sparks fly where noise flipped a thread, the inspector rides
//      his lift down the fell and flags each row that caught a flip ("+n caught"), red flags stack up the post.
//   3. The cloth is done: Ada's verdict ("65 pixels slipped through"), the inspector's count, the toast.
//   4. Move the noise to "Only the thread": the cloth flashes again and Ada cheers "the code helps here!".
// Page files are untouched: the layout is restyled in the browser only for the recording (the stage is pinned at
// 580 px wide, where the page's own layout draws the full scene 597 px tall at 3 px per art pixel), and existing
// controls are moved into the right column and clicked in-page (element.click(), so their real handlers run; a
// Playwright click costs ~0.5 s of round trips while the recorder runs). The page paces a full weave at ~12 s
// (12000 ms / picks, clamped 35-110 ms a pick); the clip sets 24 ms a pick right after the click so the whole
// moth is woven in ~4 s. Everything else is the page's own behaviour.
module.exports = async (page, h) => {
  const r0 = Date.now();
  const fp = await page.evaluate(() => { const e = performance.getEntriesByType('paint').find(e => e.name === 'first-paint'); return e ? e.startTime : 0; });
  await page.addStyleTag({ content: `
    html,body{overflow:hidden!important}
    .stage{position:fixed!important;left:0!important;top:0!important;width:580px!important;height:600px!important;z-index:50!important;border:0!important;border-right:1px solid var(--ink)!important;background:var(--paper)!important;display:flex!important;align-items:center}
    #hl{position:fixed;left:580px;top:0;width:380px;height:600px;z-index:50;background:var(--paper);box-sizing:border-box;padding:22px 22px 18px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
    #hl .kicker{margin:0;font:500 .72rem/1.3 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
    #hl .hl-title{margin:0;font:400 1.75rem/1.04 var(--display);letter-spacing:-.02em;color:var(--ink)}
    #hl .scrub{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:.55rem .75rem!important}
    #hl .scrub #weave{grid-column:1;grid-row:1}
    #hl .scrub output{grid-column:2;grid-row:1;justify-self:end;font-size:.82rem!important}
    #hl .scrub input{grid-column:1/-1;grid-row:2;width:100%}
    #hl .scrub #sound{display:none!important}
    #hl .meter{flex-direction:column;align-items:flex-start;gap:.45rem!important;font-size:.8rem!important;padding:.7rem .9rem!important}
    #hl .meter b{font-size:1.05rem}
    #hl .dial{gap:.3rem}
    #hl .ticks{font-size:.8rem}
    #hl .row.split{gap:.45rem}
    #hl .scenekey{font-size:.68rem;line-height:1.45;margin-top:auto}
    .toast{z-index:60!important;left:770px!important;bottom:20px!important;max-width:350px!important;font-size:.8rem!important}` });
  await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    const col = document.createElement('div'); col.id = 'hl';
    const k = document.createElement('p'); k.className = 'kicker'; k.textContent = 'Challenge 09 · Syndrome Loom';
    const t = document.createElement('p'); t.className = 'hl-title'; t.textContent = 'Weave a picture through a noisy quantum code.';
    const prof = document.querySelector('[data-prof]').closest('.row');
    col.append(k, t, $('scrub'), document.querySelector('.meter'), document.querySelector('.dial'), prof, $('scene-key'));
    document.body.appendChild(col);
    window.scrollTo(0, 0);
    layout(); kick();
  });
  // hold the finished default cloth briefly; a slow first paint is cut from the clip's start, so wait it out
  await h.wait(Math.max(250, Math.min(3000, fp) + 350 - (Date.now() - r0)));

  // 1) dial to the highest noise: changed threads flash, Ada sighs
  await page.evaluate(() => document.querySelector('#ticks button[data-p="0.01"]').click());
  await h.wait(700);

  // 2) weave the moth from the top (sparks, flags, the inspector's lift and "+n caught" bubbles)
  await page.evaluate(() => { document.getElementById('weave').click(); anim.pickMs = 24; anim.lastPickT = performance.now(); });
  await page.waitForFunction(() => st.woven === null && !anim.weaving, null, { timeout: 15000, polling: 50 });

  // 3) Ada's verdict and the inspector's count
  await h.wait(1200);

  // 4) noise only in the thread: the code helps, Ada cheers
  await page.evaluate(() => document.querySelector('[data-prof="thread"]').click());
  await h.wait(1000);
};
