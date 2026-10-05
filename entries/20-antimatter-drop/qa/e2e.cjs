// End-to-end journey for Antimatter Drop (classical test harness, headless Chromium via Playwright).
// Run from anywhere: node entries/20-antimatter-drop/qa/e2e.cjs [port 6600-6609]
// Serves web/ locally and walks the main user journey with real assertions:
//   load (no autoplay, real numbers) -> click the trap to stack -> Space to ramp -> the 19 escapes match the first
//   19 ibm_fez words -> step / refuse-backwards keys -> dump -> "Hear the dice" sound on (Web Audio sources start)
//   and off (no more sources) -> bias buttons, calibration row, sizes, speeds -> the titled sections, the escape
//   curve, |B| sketch and ruler always visible and drawn with content (not blank), other worlds, curve column click -> the whole campaign (pause, resume) reproduces out/replay.json exactly -> share link,
//   reload with the hash restores the curve -> exhausted bank and rewind (via a token) -> clear drops the hash ->
//   quiz (every one of the 24 options, after a reset) -> science drawers -> prev / hub / next nav -> 375 px layout. Writes qa/e2e.json; exit code 1 on failure.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6600);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

// sound instrumentation, as in common/qa/qa_page.cjs: count Web Audio sources and contexts
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, ctxs: [] };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; window.__qa.ctxs.push(c); return c; };
    Wrapped.prototype = AC.prototype;
    window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
};

// reference data straight from the deliverables
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const jobs = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'jobs.json'), 'utf8'));
const replay = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'replay.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const FEZ = Buffer.from(fs.readFileSync(path.join(PIECE, 'data', 'bank_fez_148p8.hex'), 'ascii').trim(), 'hex');
const EMU = Buffer.from(fs.readFileSync(path.join(PIECE, 'data', 'bank_emu_20p0.hex'), 'ascii').trim(), 'hex');
const word = (b, i) => (b[2 * i] << 8) | b[2 * i + 1];
const fezJob = jobs.find(j => j.name === 'fez_148p8'), emuJob = jobs.find(j => j.name === 'emu_20p0');
const sign = x => (x > 0 ? '+' : x < 0 ? '\u2212' : '') + Math.abs(x).toFixed(2);

const steps = [], fails = [];
function check(name, cond, detail) {
  steps.push({ step: name, ok: !!cond, detail: cond ? undefined : detail });
  if (!cond) fails.push(name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 300) : ''));
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${name}${cond ? '' : ' :: ' + JSON.stringify(detail).slice(0, 300)}`);
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(url, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
    await page.addInitScript(INSTRUMENT);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  const T = (p, id) => p.$eval('#' + id, e => e.textContent.trim());
  const qa = p => p.evaluate(() => ({ sources: window.__qa.sources, ctx: window.__qa.ctx, states: window.__qa.ctxs.map(c => c.state) }));
  const usedOf = async p => +(/([\d,]+) used/.exec(await T(p, 'r-bank'))[1].replace(/,/g, ''));
  const waitText = (p, id, re, ms) => p.waitForFunction(([i, s]) => new RegExp(s).test(document.getElementById(i).textContent), [id, re.source], { timeout: ms || 20000 });

  try {
    // ---------- 1. load ----------
    let { ctx, page: p } = await open(base);
    check('page title is the piece title', (await p.title()) === piece.title, await p.title());
    check('hook headline matches piece.json', (await p.$eval('h1', e => e.textContent.trim())) === piece.hook);
    check('trap starts empty at 0 g', (await T(p, 'hud-phase')) === 'Trap empty' && (await T(p, 'hud-bias')) === 'Bias 0 g');
    const proof = await p.$eval('.proof', e => e.textContent.replace(/\s+/g, ' '));
    check('proof chips carry the real numbers (qubits, jobs, backend, dice)',
      proof.includes(`${piece.qubits} qubits on ${piece.hardware}`) && proof.includes(`${piece.jobs} real Atlas jobs`) &&
      proof.includes(`${(fezJob.bytes >> 1).toLocaleString('en-US')} hardware dice`), proof);
    check('readout shows the ibm_fez job id from out/jobs.json', (await T(p, 'r-job')) === fezJob.job_id, await T(p, 'r-job'));
    check('readout shows 148 + 8 Bell = 156 qubits on ibm_fez', /IBM hardware ibm_fez · 148 \+ 8 Bell = 156 qubits/.test(await T(p, 'r-src')), await T(p, 'r-src'));
    check('nothing sounds on load (no autoplay)', (await qa(p)).sources === 0 && (await qa(p)).ctx === 0, await qa(p));
    check('brand bar reads "Challenge 11" and nothing on the page says Bonus',
      (await p.$eval('.wtnr-bar .count', e => e.textContent.trim())) === 'Challenge 11' && !/bonus/i.test(await p.evaluate(() => document.body.innerText)),
      await p.$eval('.wtnr-bar .count', e => e.textContent.trim()));
    const SECTIONS = ['How to play', 'Your results', 'The data', 'Test yourself', 'The science', 'How it was made', 'What this does not claim', 'Jobs and credits'];
    const bars = await p.$$eval('.ink-bar h2', hs => hs.map(h => h.textContent.trim()));
    check('every titled section is on the page, in order, below the scene', JSON.stringify(bars) === JSON.stringify(SECTIONS), bars);
    const vis = sel => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return r.width > 50 && r.height > 50 && !e.closest('[hidden], details:not([open])'); });
    check('both graphs and the ruler scene are visible without any toggle', (await vis('#curve')) && (await vis('#bfield')) && (await vis('#ruler')));
    check('the |B| sketch draws its profile with coils G and A', (await p.$$eval('#bfield path', x => x.length)) === 1 && /G/.test(await p.$eval('#bfield', e => e.textContent)) && /A/.test(await p.$eval('#bfield', e => e.textContent)));
    const bf0 = await p.$eval('#bfield path', e => e.getAttribute('d'));
    check('the jobs table lists both real Atlas jobs from out/jobs.json',
      (await p.$$eval('#jobs tbody tr', r => r.length)) === 2 && (await p.$eval('#jobs', e => e.textContent)).includes(fezJob.job_id) && (await p.$eval('#jobs', e => e.textContent)).includes(emuJob.job_id));
    check('the honesty notes are visible, not hidden in a drawer', await vis('#claims'));
    check('the trap canvas is drawn (not blank)', await p.$eval('#cv', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 120) ink++; return ink > 50; }));
    // every restored graph renders with content, not just a box
    const inkPx = sel => p.$eval(sel, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4 * 13) if (d[i + 3] > 0 && d[i] < 140) ink++; return ink; });
    check('the ruler scene canvas is drawn (ink pixels: host, ruler, signposts)', (await inkPx('#ruler')) > 50, await inkPx('#ruler'));
    const cv0 = await p.$eval('#curve', s => ({ cols: s.querySelectorAll('.col').length, rings: s.querySelectorAll('circle[fill="none"]').length, lines: s.querySelectorAll('line').length, txt: s.textContent }));
    check('the escape curve SVG renders its axes, 11 bias columns and the 11 Table 1 rings', cv0.cols === 11 && cv0.rings === 11 && cv0.lines >= 5 && /P\(escape down\)/.test(cv0.txt), cv0);
    const bfd = await p.$eval('#bfield path', e => (e.getAttribute('d') || '').length);
    check('the |B| sketch SVG renders a non-empty field profile', bfd > 100, bfd);

    // ---------- 2. main instrument: click the trap to stack, Space to ramp, to a real outcome ----------
    const cvb = await p.$('#cv').then(h => h.boundingBox());
    await p.click('#cv', { position: { x: cvb.width / 2, y: cvb.height * 0.3 } });
    check('clicking the trap stacks 19 atoms (Table 1, 0 g, one trial)', (await T(p, 'hud-phase')) === '19 of 19 atoms trapped', await T(p, 'hud-phase'));
    check('the stage button now offers Ramp', (await T(p, 'act')) === 'Ramp');
    check('bias is locked during a trial', await p.$eval('#g-bias button[data-bi="0"]', b => b.disabled));
    await p.keyboard.press('Space');
    check('Space on the trap starts the ramp (button shows Pause)', (await T(p, 'act')) === 'Pause', await T(p, 'act'));
    await waitText(p, 'hud-phase', /^Done: /);
    const dn0 = Array.from({ length: 19 }, (_, i) => word(FEZ, i)).filter(w => w < 47204).length;
    check('the 19 escapes are exactly the first 19 ibm_fez words vs threshold 47204', (await T(p, 'hud-phase')) === `Done: ${dn0} down · ${19 - dn0} up`, await T(p, 'hud-phase'));
    check('bank readout counts 19 dice used', (await usedOf(p)) === 19);
    check('stack button now says Stack again', (await T(p, 'stack')) === 'Stack again');
    check('escape counter shows 19 escapes', (await T(p, 'c-n')) === '19 escapes');
    const bf1 = await p.$eval('#bfield path', e => e.getAttribute('d'));
    check('the |B| sketch follows the ramp (lower barriers at 20 s)', bf1 !== bf0 && /ramp 20\.0 s/.test(await p.$eval('#bfield', e => e.textContent)));
    check('the dice log under the verdict lists the last comparisons', (await p.$$eval('#dice li', l => l.length)) === 8);

    // ---------- 3. keyboard stepping, one-way ramp, dump spends no dice ----------
    await p.click('#stack');
    await p.focus('#cv');
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
    check('ArrowRight steps the ramp forward (1.0 s)', (await T(p, 'm-t')) === '1.0', await T(p, 'm-t'));
    await p.keyboard.press('ArrowLeft');
    check('ArrowLeft cannot run the ramp backwards and says so', (await T(p, 'm-t')) === '1.0' && /only runs forward/.test(await T(p, 'toast')), await T(p, 'toast'));
    await p.$eval('#ramp', r => { r.value = '150'; r.dispatchEvent(new Event('input', { bubbles: true })); });   // drag the slider to 15 s
    await p.waitForTimeout(300);
    const usedMid = await usedOf(p), tMid = +(await T(p, 'm-t'));
    check('dragging/keying the slider advances the ramp and spends dice', tMid > 10 && usedMid > 19, { tMid, usedMid });
    await p.click('#dump');
    await p.waitForTimeout(200);
    check('Dump trap empties it and spends no dice for the atoms left', (await T(p, 'hud-phase')) === 'Trap empty' && (await usedOf(p)) === usedMid, { used: await usedOf(p), usedMid });

    // ---------- 4. sound: Hear the dice on, then mute ----------
    const s0 = await qa(p);
    await p.click('#snd');
    await p.waitForTimeout(300);
    const s1 = await qa(p);
    check('Hear the dice starts sound (Web Audio sources started)', s1.sources >= s0.sources + 2 && s1.states.includes('running'), { s0, s1 });
    check('the sound button now offers Mute the dice', (await T(p, 'snd')) === 'Mute the dice');
    await p.click('#g-bias button[data-bi="3"]');                       // -1 g
    check('choosing a bias updates the HUD', (await T(p, 'hud-bias')) === 'Bias \u22121 g', await T(p, 'hud-bias'));
    await p.click('#stack');
    await p.focus('#ramp'); await p.keyboard.press('End');
    await waitText(p, 'hud-phase', /^Done: /);
    const s2 = await qa(p);
    check('each die that lands plays a tone while sound is on', s2.sources > s1.sources, { s1, s2 });
    await p.click('#snd');
    await p.waitForTimeout(300);
    const s3 = await qa(p);
    check('Mute the dice stops the sound (context suspended)', (await T(p, 'snd')) === 'Hear the dice' && s3.states.every(s => s !== 'running'), s3);
    await p.click('#g-cal button[data-bi="12"]');                      // +10 g calibration
    await p.click('#stack'); await p.focus('#ramp'); await p.keyboard.press('End');
    await waitText(p, 'hud-phase', /^Done: /);
    const s4 = await qa(p);
    check('no tones while muted', s4.sources === s3.sources, { s3, s4 });
    check('the +10 g calibration sends every atom down', (await T(p, 'hud-phase')) === 'Done: 31 down · 0 up' && /\+10 g: 31 down \/ 0 up/.test(await T(p, 'cal-line')), await T(p, 'cal-line'));

    // ---------- 5. options that were already selected do work (false positives in the dead-control scan) ----------
    const biasLabels = [];
    for (const b of await p.$$('#g-bias button, #g-cal button')) { await b.click(); biasLabels.push(await T(p, 'hud-bias')); }
    check('every one of the 13 bias buttons sets its own bias (11 main + 2 calibration)',
      new Set(biasLabels).size === 13 && biasLabels[0] === 'Bias −3 g' && biasLabels[12] === 'Bias +10 g · calibration', biasLabels);
    await p.click('#g-bias button[data-bi="5"]');
    await p.click('#sz-series');
    check('Full series resizes the stack to the paper total (131 at 0 g)', (await p.getAttribute('#sz-series', 'aria-pressed')) === 'true');
    await p.click('#stack');
    check('a full series stacks 131 atoms', (await T(p, 'hud-phase')) === '131 of 131 atoms trapped', await T(p, 'hud-phase'));
    await p.click('#dump');
    await p.click('#sz-trial');
    check('1 trial is selectable again after Full series', (await p.getAttribute('#sz-trial', 'aria-pressed')) === 'true' && (await p.getAttribute('#sz-series', 'aria-pressed')) === 'false');
    await p.click('[data-speed="real"]');
    await p.click('#stack'); await p.click('#play'); await p.waitForTimeout(1000);
    const tReal = +(await T(p, 'm-t'));
    await p.click('#play');
    check('Real time ramps at 1 s per s', tReal > 0.5 && tReal < 1.6, tReal);
    await p.click('[data-speed="fast"]');
    const tA = +(await T(p, 'm-t')); await p.click('#play'); await p.waitForTimeout(1000); await p.click('#play');
    const tB = +(await T(p, 'm-t'));
    check('Fast (selected again) ramps at about 5 s per s', tB - tA > 3, { tA, tB });
    await p.click('#dump');

    // ---------- 6. The data: escape curve, other worlds, curve column, |B| sketch with the bias ----------
    const pts = await p.$$eval('#curve circle[fill="#19238E"]', c => c.length);
    check('the curve plots your measured biases', pts >= 2, pts);
    const paths0 = await p.$$eval('#curve path', c => c.length);
    await p.click('#worlds');
    const paths1 = await p.$$eval('#curve path', c => c.length);
    check('Show other worlds adds the three 1-D cartoon curves', paths1 === paths0 + 3 && !(await p.$eval('#lg-worlds', e => e.hidden)) && (await T(p, 'worlds')) === 'Hide other worlds', { paths0, paths1 });
    check('dice log lists the last eight comparisons', (await p.$$eval('#dice li', l => l.length)) === 8);
    await p.click('#curve .col[data-bi="9"] rect');
    check('clicking a curve column chooses that bias', (await T(p, 'hud-bias')) === 'Bias +2 g', await T(p, 'hud-bias'));
    check('the |B| sketch shows the chosen bias', /bias \+2 g/.test(await p.$eval('#bfield', e => e.textContent)), await p.$eval('#bfield', e => e.textContent));
    check('the ruler scene is drawn beside the verdict', await p.$eval('#ruler', c => c.width > 0 && c.getBoundingClientRect().height > 40));
    check('verdict finds a balance point from your trials', /Balance at|off the chart/.test(await T(p, 'verdict')), await T(p, 'verdict'));

    // ---------- 7. clear (also drops a shared hash) ----------
    await p.click('#clear');
    check('Clear my data empties the curve', (await T(p, 'c-n')) === '0 escapes' && /Not enough data/.test(await T(p, 'verdict')));
    await ctx.close();

    // ---------- 8. the whole campaign on a fresh page reproduces replay.py; pause and resume ----------
    ({ ctx, page: p } = await open(base));
    await p.click('#campaign');
    check('campaign starts and can be paused', (await T(p, 'campaign')) === 'Pause campaign');
    await p.waitForTimeout(700);
    await p.click('#campaign');
    const c0 = await T(p, 'm-t'); await p.waitForTimeout(600);
    check('Pause campaign freezes the ramp', (await T(p, 'campaign')) === 'Resume campaign' && (await T(p, 'm-t')) === c0, { c0, c1: await T(p, 'm-t') });
    await p.click('#campaign');
    await waitText(p, 'campaign', /^Run the whole campaign$/, 90000);
    check('campaign uses 1,721 escapes', (await T(p, 'c-n')) === '1,721 escapes', await T(p, 'c-n'));
    check('campaign used 1,721 ibm_fez dice, as replay.py', (await usedOf(p)) === replay.fez_148p8.words_used);
    const f = replay.fez_148p8.fit;
    check(`verdict balance ${sign(f.b0)} g equals replay.py`, (await T(p, 'verdict')).includes(`Balance at ${sign(f.b0)} g`), await T(p, 'verdict'));
    const cvC = await p.$eval('#curve', s => ({ dots: s.querySelectorAll('circle[fill="#19238E"]').length, paths: [...s.querySelectorAll('path')].filter(x => (x.getAttribute('d') || '').length > 40).length }));
    check('after the campaign the escape curve plots all 11 of your points and your fit line', cvC.dots === 11 && cvC.paths >= 1, cvC);

    // ---------- 9. share link, reload with the hash ----------
    await p.click('#share');
    await p.waitForTimeout(300);
    const href = await p.evaluate(() => location.href), tok = href.split('#')[1] || '';
    check('share writes a #token of allowed characters', /^[A-Za-z0-9._~-]+$/.test(tok), tok);
    const tal = tok.split('_t')[1].split('~').slice(0, 11).map(s => s.split('.').map(x => parseInt(x, 36)));
    check('token carries the campaign tallies of replay.py', replay.fez_148p8.tallies.every((t, i) => tal[i][0] === t.up && tal[i][1] === t.dn), tal);
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => null));
    check('share copies the link (or says it is in the address bar)', clip === href || /address bar/.test(await T(p, 'toast')), { clip, toast: await T(p, 'toast') });
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    check('reloading with the hash restores the curve', (await T(p, 'c-n')) === '1,721 escapes' && (await T(p, 'verdict')).includes(`Balance at ${sign(f.b0)} g`));
    check('reloading with the hash restores the bank position', (await usedOf(p)) === 1721);
    await p.click('#clear');
    check('Clear my data removes the shared hash', (await p.evaluate(() => location.hash)) === '');
    await ctx.close();

    // ---------- 10. exhausted bank and rewind (emulator, two dice from the end, via a token) ----------
    const start = (EMU.length & ~1) - 4;
    ({ ctx, page: p } = await open(`${base}#v1_emu_b5_f0_e${start.toString(36)}_t${Array(13).fill('0.0').join('~')}`));
    check('token restores the emulator dice source', (await p.getAttribute('[data-src="emu"]', 'aria-pressed')) === 'true' && (await T(p, 'r-job')) === emuJob.job_id, await T(p, 'r-job'));
    await p.click('#stack'); await p.focus('#ramp'); await p.keyboard.press('End'); await p.waitForTimeout(300);
    check('an exhausted bank stops the ramp and offers a rewind', !(await p.$eval('#exhausted', e => e.hidden)) && (await T(p, 'hud-phase')) === '17 of 19 atoms trapped', await T(p, 'hud-phase'));
    await p.click('#rewind');
    check('Rewind this bank resets the emulator bank', (await usedOf(p)) === 0 && (await p.$eval('#exhausted', e => e.hidden)));
    await p.click('#play'); await waitText(p, 'hud-phase', /^Done: /);
    check('the ramp resumes and the trial finishes after a rewind', /^Done: /.test(await T(p, 'hud-phase')));
    await p.click('[data-src="cls"]');
    check('browser dice switch the readout to classical', /crypto\.getRandomValues/.test(await T(p, 'r-src')) && (await T(p, 'r-job')) === '-');

    // ---------- 11. quiz ----------
    await p.click('#quiz .q:nth-child(1) .opts button:nth-child(1)');
    await p.click('#quiz .q:nth-child(2) .opts button:nth-child(1)');
    check('quiz scores and explains', /1 right of 2 answered/.test(await T(p, 'q-score')) && !(await p.$eval('#quiz .q:nth-child(2) .why', e => e.hidden)));
    // the dead-control scan reports the other options of an answered question as unclickable: they lock on purpose
    check('an answered question locks its other options (one answer each, Reset unlocks)',
      await p.$$eval('#quiz .q:nth-child(1) .opts button', bs => bs.every(b => b.disabled) && bs[0].classList.contains('right')));
    await p.click('#q-reset');
    check('Reset the quiz', /0 \/ 6 answered/.test(await T(p, 'q-score')) &&
      await p.$$eval('#quiz .opts button', bs => bs.every(b => !b.disabled)));
    // every option of every question does something once the quiz is reset (here: the last option of each)
    let quizOk = true;
    for (let i = 1; i <= 6; i++) {
      await p.click(`#quiz .q:nth-child(${i}) .opts button:last-child`);
      const r = await p.$eval(`#quiz .q:nth-child(${i})`, q => ({ why: !q.querySelector('.why').hidden && q.querySelector('.why').textContent, marked: !!q.querySelector('.opts button.right') }));
      if (!r.why || !r.marked) quizOk = false;
    }
    check('the last option of every question answers it, marks the right one and explains', quizOk && /of 6 answered/.test(await T(p, 'q-score')), await T(p, 'q-score'));
    await p.click('#q-reset');
    // every single option (all 24, including the 18 the dead-control scan finds locked) answers its question after a reset
    const nOpts = await p.$$eval('#quiz .q', qs => qs.map(q => q.querySelectorAll('.opts button').length));
    const deadOpts = [];
    for (let i = 1; i <= nOpts.length; i++) {
      for (let j = 1; j <= nOpts[i - 1]; j++) {
        await p.click('#q-reset');
        await p.click(`#quiz .q:nth-child(${i}) .opts button:nth-child(${j})`);
        const r = await p.$eval(`#quiz .q:nth-child(${i})`, (q, j) => {
          const b = q.querySelectorAll('.opts button')[j - 1];
          return { why: !q.querySelector('.why').hidden, mark: b.classList.contains('right') || b.classList.contains('wrong'), locked: [...q.querySelectorAll('.opts button')].every(x => x.disabled) };
        }, j);
        if (!(r.why && r.mark && r.locked) || !/1 answered|of 1 answered/.test(await T(p, 'q-score'))) deadOpts.push(`${i}.${j}`);
      }
    }
    check(`each of the ${nOpts.reduce((a, b) => a + b, 0)} quiz options answers its question (marks it, explains, locks the rest)`, deadOpts.length === 0 && nOpts.length === 6, { nOpts, deadOpts, score: await T(p, 'q-score') });
    await p.click('#q-reset');

    // ---------- 12. science drawers ----------
    const drawers = await p.$$('section.more details.drawer');
    for (const d of drawers) { await (await d.$('summary')).click(); }
    const opened = await p.$$eval('section.more details.drawer', ds => ds.map(d => d.open && d.querySelector('.body').getBoundingClientRect().height > 40));
    check('all three drawers (two science, one how-it-was-made) open with content', drawers.length === 3 && opened.every(Boolean), opened);
    check('Table 1 in the drawer lists 13 biases', (await p.$$eval('#t1 tbody tr', r => r.length)) === 13);
    check('the honesty notes label the sound as classical', /classical sonification/.test(await p.$eval('#claims', e => e.textContent)));

    // ---------- 13. navigation between pieces ----------
    const nav = await p.evaluate(() => ({
      brand: document.querySelector('.wtnr-bar a') && document.querySelector('.wtnr-bar a').href,
      prev: document.querySelector('.wtnr-nav a[rel="prev"]') && document.querySelector('.wtnr-nav a[rel="prev"]').href,
      next: document.querySelector('.wtnr-nav a[rel="next"]') && document.querySelector('.wtnr-nav a[rel="next"]').href,
      hub: document.querySelector('.wtnr-nav a.wn-hub') && document.querySelector('.wtnr-nav a.wn-hub').href,
      all: [...document.querySelectorAll('.wtnr-nav ol a')].map(a => a.href),
      current: (document.querySelector('.wtnr-nav ol a[aria-current="page"]') || {}).href,
      navBeforeFoot: !!document.querySelector('.wtnr-nav + .wtnr-foot')
    }));
    check('brand bar links to the hub', nav.brand === HUB, nav.brand);
    check('prev link goes to 19 Frog Chorus', nav.prev === urls['19-frog-chorus'], nav.prev);
    check('next link goes to 21 The Quantum Nose Test', nav.next === urls['21-quantum-nose'], nav.next);
    check('hub link goes to the hub', nav.hub === HUB, nav.hub);
    check('jump list holds all 22 pieces with this one current', nav.all.length === 22 && nav.current === urls['20-antimatter-drop'], nav.all.length);
    check('nav sits just before the footer', nav.navBeforeFoot);
    await p.click('.wtnr-nav summary');
    check('Jump to any piece opens', await p.$eval('.wtnr-nav details', d => d.open));
    await ctx.close();

    // ---------- 14. phone width ----------
    ({ ctx, page: p } = await open(base, { viewport: { width: 375, height: 812 } }));
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('no horizontal scroll at 375 px', ov <= 1, ov);
    const tb = await p.$('#cv').then(h => h.boundingBox());
    await p.tap('#cv', { position: { x: tb.width / 2, y: tb.height * 0.3 } }).catch(() => p.click('#cv', { position: { x: tb.width / 2, y: tb.height * 0.3 } }));
    check('tapping the trap stacks atoms on a phone', /atoms trapped/.test(await T(p, 'hud-phase')));
    check('the stage lets the page scroll (touch-action is not none)', (await p.$eval('#stage', e => getComputedStyle(e).touchAction)) !== 'none');
    await ctx.close();

    check('no console or page errors during the journey', errors.length === 0, errors);
  } catch (e) {
    check('journey ran without throwing', false, String(e && e.stack || e).slice(0, 400));
  }
  const out = { piece: path.basename(PIECE), ok: fails.length === 0, passed: steps.filter(s => s.ok).length, failed: fails, steps };
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(`\n${out.passed} / ${steps.length} steps passed${fails.length ? '; FAILED: ' + fails.join(' | ') : ''}`);
  await browser.close(); server.close();
  process.exit(fails.length ? 1 : 0);
})();
