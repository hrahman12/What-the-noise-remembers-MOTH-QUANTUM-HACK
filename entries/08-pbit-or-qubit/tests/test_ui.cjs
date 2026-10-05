// UI test for the built arcade page (web/index.html), driven in headless Chromium with Playwright.
//   node tests/test_ui.cjs            (uses the playwright install in common/qa/node_modules)
// Plays a whole game: title card, every stage, the boss round with the real ibm_fez batches, the final card,
// the data section, the classic board, the jobs table, pause, the clock, a time-out, and the phone layout.
// Writes screenshots to qa/ui-*.png.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'common', 'qa', 'node_modules', 'playwright'));
const web = path.join(__dirname, '..', 'web'), out = path.join(__dirname, '..', 'qa');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((q, r) => {
  const f = path.join(web, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(web) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const errors = [];
  async function open(w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  const shot = async (page, name, sel) => { const el = sel ? await page.$(sel) : null; await (el || page).screenshot({ path: path.join(out, name) }); };

  // ---------------- desktop ----------------
  let { ctx, page } = await open(1280, 900);
  const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0; }, sel);
  const text = sel => page.$eval(sel, e => e.textContent);
  ok(await vis('#vs') && !(await vis('#play')), 'title: the versus card shows, the game is hidden');
  ok(/Challenge 08/.test(await text('.wtnr-bar .count')) && !/Bonus|\/ 11/.test(await text('.wtnr-bar')), 'the brand bar reads Challenge 08 (all entries equal)');
  // the restored sections are on the page, titled and visible without any toggle
  for (const [id, h] of [['how-to-play', 'How to play'], ['data', 'The data'], ['classic', 'The classic board'], ['cards-sec', 'Lab cards'], ['made', 'How it was made'], ['science', 'The science'], ['claims', 'What this does not claim'], ['jobs', 'Jobs and credits']])
    ok(await vis('#' + id) && (await text(`#${id} .ink-bar h2`)) === h, `section "${h}" is visible with its title`);
  ok(await vis('#c-edge') && await vis('#c-mag') && await vis('#c-mi-p') && await vis('#c-mi-q'), 'all four fingerprint canvases are visible on load (no toggle)');
  const inked = id => page.evaluate(i => { const c = document.getElementById(i), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 120 && d[k + 3] > 0) n++; return n; }, id);
  ok(await inked('c-mi-p') > 200 && await inked('c-mi-q') > 200 && await inked('c-edge') > 50 && await inked('c-mag') > 50, 'the edge, magnetisation and mutual-information charts are drawn in ink');
  ok(/darkest = [\d.]+ bits/.test(await text('#mi-cap')), 'the mutual-information caption gives its scale');
  ok(await page.$$eval('#tiles .tile', e => e.length) === 16 && await page.$$eval('#tiles canvas', cs => cs.every(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let k = 0; k < d.length; k += 4) if (d[k] < 120) return true; return false; })), 'the classic board draws 16 tiles');
  ok(await page.evaluate(() => CL.round && CL.round.graph === st.graph && CL.round.J === st.J && CL.round.samples.length === 16), 'the classic board holds 16 real samples of the page problem');
  await page.focus('#cl-pbit'); await page.keyboard.press('q'); await page.waitForTimeout(150);
  ok(/These were (p-bits|qubits \()/.test(await text('#cl-verdict')) && /^[01] \/ 1$/.test(await text('#sc-num')) && /a coin does this well/.test(await text('#sc-chance')), 'P/Q on the classic board guesses and scores against a coin');
  ok(!/hidden/.test(await text('#cl-batch')), 'the classic readout names the batch after a guess');
  await page.click('#cl-next'); await page.waitForTimeout(100);
  await page.click('#cl-graph button[data-v="ring"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => st.graph === 'ring' && CL.round.graph === 'ring' && /^ring/.test(document.querySelector('#r-prob').textContent) && /ring/.test(document.querySelector('#fp-title').textContent)), 'a pick on the classic board moves the readout, the data and the arcade');
  await page.click('#d-J button[data-v="0.4"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => st.J === 0.4 && CL.round.J === 0.4 && /0\.4/.test(document.querySelector('#j-val').textContent)), 'a pick in The data turns the J dial and re-deals the classic board');
  await page.click('.jobshow[data-g="ladder"][data-j="1"][data-m="qpu"]'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => st.graph === 'ladder' && st.J === 1 && st.src === 'qpu' && CL.round.src === 'qpu'), 'Show in Jobs and credits puts that hardware job on the boards and in the data');
  ok(await page.$$eval('#jobs-t tr', e => e.length) === 13, 'the jobs table lists all 12 graph-v1 submissions');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  ok(await page.$$eval('.eng', e => e.length) === 6, 'six engravings mounted (versus card, game, anatomy drawer)');
  ok(await page.$$eval('#vs .eng text', e => e.some(t => /MgO/.test(t.textContent))) && await page.$$eval('#vs .eng text', e => e.some(t => /mix\. chamber/.test(t.textContent))), 'the junction and the fridge carry labelled parts');
  ok(await page.evaluate(() => { const ch = chain0(); return document.querySelector('#vs .fl').classList.contains('dn') === (ch[FL.i % ch.length] < 0); }), 'the free layer arrow follows spin 0 of THRML chain 0');
  ok(await page.$$eval('#vs .eng text', e => e.some(t => /PtMn/.test(t.textContent)) && e.some(t => /in plane/.test(t.textContent))), 'the junction is the in-plane p-bit stack (PtMn-pinned)');
  await shot(page, 'ui-desktop-title.png', '#arena');
  await page.click('#b-start');
  await page.waitForTimeout(300);
  ok(await vis('#play') && !(await vis('#vs')), 'start opens the game');
  ok(await page.$$eval('#board .mg', e => e.length) === 20, 'the magnet board has 20 magnets');
  ok(/Stage 1/.test(await text('#hud-stage')) && /50 K plate/.test(await text('#hud-stage')), 'stage 1 is the 50 K plate');
  ok(/Atlas emulator/.test(await text('#srcchip')), 'plates 1-4 are labelled as the emulator');
  ok(await page.evaluate(() => GM.cards.has('mtj')), 'starting unlocks the first lab card');
  // the board shows the real sample: down magnets = bits that are 1
  const match = await page.evaluate(() => { const s = GM.round.samples[PB.k]; return [...document.querySelectorAll('#board .mg')].every((m, i) => m.classList.contains('dn') === (s[i] < 0)); });
  ok(match, 'every magnet matches the sample on show');
  await page.waitForTimeout(1500);
  const s1 = parseFloat(await text('#secs'));
  await page.waitForTimeout(700);
  ok(parseFloat(await text('#secs')) < s1, 'the clock counts down');
  ok(await page.evaluate(() => PB.k) > 0, 'the batch plays through its samples');
  await shot(page, 'ui-desktop-play.png', '#arena');
  ok(/hidden/.test(await text('#r-batch')), 'the source stays hidden before the call');
  await page.keyboard.press('s');
  await page.waitForTimeout(350);
  ok(/These were from/.test(await text('#verdict')) && !(/hidden/.test(await text('#r-batch'))), 'a call reveals the answer and its job');
  ok(await vis('#stamp') && await vis('#b-next'), 'the stamp and the next button appear');
  ok(/1 right|0 of 1 right/.test(await text('#m-count')) || /of 1 right/.test(await text('#m-count')), 'the chance meter counts the call');
  await shot(page, 'ui-desktop-reveal.png', '#arena');
  // pause and the clock
  await page.keyboard.press('n'); await page.waitForTimeout(200);
  await page.click('#b-pause');
  ok(/paused/.test(await text('#secs')) && await page.$eval('#b-pbit', b => b.disabled), 'pause stops the clock and locks the calls');
  await page.click('#b-pause');
  ok(!(await page.$eval('#b-pbit', b => b.disabled)), 'resume unlocks the calls');
  // a time-out: not counted as a call
  const callsBefore = await page.evaluate(() => GM.calls.length);
  await page.evaluate(() => { GM.left = 0.05; GM.graceUntil = 0; });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => GM.phase === 'reveal' && GM.round.guessed === 'timeout'), 'the clock running out ends the envelope');
  ok(await page.evaluate(() => GM.calls.length) === callsBefore, 'a time-out is not counted as a call in the chance meter');
  // play out the stage
  async function playStage() {
    for (let k = 0; k < 8; k++) {
      const ph = await page.evaluate(() => GM.phase);
      if (ph === 'over' || await vis('#ovl')) break;
      if (ph === 'guess') await page.keyboard.press(Math.random() < .5 ? 's' : 'f');
      await page.waitForTimeout(120);
      if (await page.evaluate(() => GM.phase) === 'reveal') await page.keyboard.press('n');
      await page.waitForTimeout(120);
    }
  }
  await playStage();
  ok(await vis('#ovl') && /Stage (clear|failed)/.test(await text('#ovl')), 'five envelopes end the stage with a result card');
  ok(/standard errors/.test(await text('#ovl')), 'the stage card says how different the two sources really are');
  await shot(page, 'ui-desktop-stage.png', '#arena');
  for (let s = 1; s <= 4; s++) {
    const btn = (await page.$('#o-down')) || (await page.$('#o-skip'));
    await btn.click(); await page.waitForTimeout(250);
    if (s < 4) { ok(new RegExp(['', '4 K plate', 'Still', 'Cold plate'][s]).test(await text('#hud-stage')), `stage ${s + 1} is the ${['', '4 K plate', 'still', 'cold plate'][s]}`); await playStage(); }
  }
  ok(/Mixing chamber/.test(await text('#hud-stage')) && /ibm_fez/.test(await text('#srcchip')), 'the boss is the mixing chamber, with ibm_fez batches');
  ok(await vis('#ovl') && /Boss: ibm_fez/.test(await text('#ovl')) && /real shots/.test(await text('#ovl')) && await page.evaluate(() => GM.phase === 'intro'), 'the boss waits behind its title card (no clock running)');
  await page.waitForTimeout(300);
  await shot(page, 'ui-desktop-bosscard.png', '#arena');
  await page.click('#o-fight'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => GM.phase === 'guess') && await vis('#hud-hpbox') && await page.$$eval('#hud-hp i', e => e.length) === 4, 'Fight deals the first boss envelope; the boss shows 4 HP');
  ok(await page.$eval('#j-dial', b => b.disabled) && await vis('#lockline'), 'the boss locks the dial');
  ok(await page.$$eval('#cl-graph button, #d-graph button', e => e.filter(b => b.getAttribute('aria-pressed') !== 'true').every(b => b.disabled)) && await vis('#lock-d'), 'the boss locks the problem pickers in The data and on the classic board too');
  ok(await page.evaluate(() => CONFIGS.some(c => c.qpu && c.graph === GM.round.graph && c.J === GM.round.J) && GM.round.src === 'qpu'), 'boss envelopes use a problem with real hardware shots');
  await page.waitForTimeout(900);
  await shot(page, 'ui-desktop-boss.png', '#arena');
  // force a fridge envelope to check the hardware label in the reveal
  await page.evaluate(() => { const c = cfg(); GM.round.truth = 'qubit'; GM.round.samples = c.qpu.spins.slice(0, 16); GM.round.info = 'graph-v1 on ibm_fez, real IBM hardware: test'; });
  await page.keyboard.press('f'); await page.waitForTimeout(300);
  ok(/ibm_fez/.test(await text('#st-small')) && /real ibm_fez shots/.test(await text('#verdict')), 'a boss fridge envelope is labelled as real ibm_fez hardware');
  await page.keyboard.press('n'); await page.waitForTimeout(150);
  await playStage();
  ok(await vis('#ovl') && /Boss down|The boss holds/.test(await text('#ovl')) && /p =/.test(await text('#ovl')), 'the boss ends in a final card with honest p-values');
  ok(await page.evaluate(() => GM.cards.has('fez') && GM.cards.has('k50') && GM.cards.has('mxc')), 'lab cards unlock on the way down');
  ok(await page.evaluate(() => document.querySelector('#hud-hp').querySelectorAll('i.gone').length === Math.min(4, GM.hits)), 'boss HP drops with every right call');
  await shot(page, 'ui-desktop-final.png', '#arena');
  await page.click('#o-data'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => { const b = document.getElementById('data').getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; }), 'Open the data scrolls to The data');
  await shot(page, 'ui-desktop-data.png', '#data');
  ok(await vis('#fp') && await page.$$eval('#fstats .stat', e => e.length) === 5 && (await text('#why')).length > 200, 'The data shows the fingerprints of the boss problem');
  await page.click('#o-again'); await page.waitForTimeout(250);
  ok(/Stage 1/.test(await text('#hud-stage')) && await page.evaluate(() => GM.score === 0 && GM.calls.length === 0), 'play again restarts from the top');
  // turning the dial between envelopes deals the new problem
  await page.click('#g-graph button[data-v="ring"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => GM.round.graph === 'ring' && st.graph === 'ring'), 'picking a graph deals an envelope of that problem');
  await page.click('#g-timer button[data-v="off"]').catch(() => {});
  await page.click('#b-reset'); await page.waitForTimeout(200);
  ok(await vis('#vs'), 'reset goes back to the title card');
  await page.click('#g-timer button[data-v="off"]');
  await page.click('#b-start'); await page.waitForTimeout(300);
  ok(/no clock/.test(await text('#secs')), 'no-clock mode');
  await ctx.close();

  // ---------------- phone ----------------
  ({ ctx, page } = await open(375, 812));
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(await over() <= 0, 'no horizontal scroll at 375 px (title)');
  await shot(page, 'ui-mobile-title.png', '#arena');
  await page.click('#b-start'); await page.waitForTimeout(1600);
  ok(await over() <= 0, 'no horizontal scroll at 375 px (game)');
  const gb = await page.$eval('#b-pbit', b => b.getBoundingClientRect().height);
  ok(gb >= 56, `big tap targets on the phone (${Math.round(gb)} px tall)`);
  await shot(page, 'ui-mobile-play.png', '#center');
  await page.click('#b-qubit'); await page.waitForTimeout(400);
  await shot(page, 'ui-mobile-reveal.png', '#center');
  await page.evaluate(() => document.querySelector('.side.fridge').scrollIntoView());
  await shot(page, 'ui-mobile-sides.png', '#play');
  await ctx.close();

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  await browser.close(); server.close();
  console.log(`${n - fails} of ${n} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
