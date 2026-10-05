// End-to-end journey for Jam the Bat: node entries/05-jam-the-bat/qa/e2e.cjs [port 6300-6309]
// Serves web/ locally and walks the main journey in headless Chromium with real input (mouse + keys):
//   load (no sound yet) -> pick the ibm_fez chip -> Start flight (sound on) -> sound starts -> mute stops new
//   sound, unmute brings it back -> pause freezes the game, resume continues -> switch noise-maker mid-flight
//   -> fly a whole round to its end (escaped or caught) -> tape, legend, readout and cast visible, read a click
//   off the tape -> Copy link to this run -> reload with the hash: source, seed and run are restored -> run the
//   500-round tournament and match it to out/tournament.json -> chip map and run switch -> PRNG seed + "bat
//   ignores the seed" share link restored after reload -> every titled section visible, graphs visible, earlier
//   words in place, no "bonus" wording -> prev / hub / next nav links.
// Exits 1 and prints the failed assertion if anything breaks. Writes qa/e2e.json.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6300);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const JOBS = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'jobs.json'), 'utf8')).filter(j => j.status === 'completed');
const TOUR = JSON.parse(fs.readFileSync(path.join(PIECE, 'out', 'tournament.json'), 'utf8'));
const FEZ = JOBS.find(j => j.name === 'fez_148p8');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});

// the same audio instrumentation as common/qa/qa_page.cjs: count every Web Audio source that starts
const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, media: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; return c; };
    Wrapped.prototype = AC.prototype; window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [];
function ok(cond, msg, detail) { if (!cond) { const e = new Error('ASSERTION FAILED: ' + msg + (detail !== undefined ? ' | ' + JSON.stringify(detail) : '')); e.assert = true; throw e; } }
function step(name) { steps.push(name); console.log('ok  ' + name); }

(async () => {
  await new Promise(r => srv.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` }); } catch (e) { /* older chromium */ }
  const p = await ctx.newPage();
  const errors = [], external = new Set();
  p.on('pageerror', e => errors.push(String(e.message || e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('request', r => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.add(u.hostname); });
  await p.addInitScript(INSTRUMENT);
  let result = { ok: false };
  const q = () => p.evaluate(() => window.__qa.sources);
  const S = fn => p.evaluate(fn);
  async function stageXY(wx, wy) { const r = await p.locator('#cv').boundingBox(); return [r.x + wx / 960 * r.width, r.y + wy / 540 * r.height]; }
  // fly with real mouse input: hover steers, holding the button clicks. Strategy = the page's own autopilot rule.
  let held = false;
  async function fly(ms, opts = {}) {
    await p.locator('#stage').scrollIntoViewIfNeeded();   // buttons may have scrolled the page: keep the sky under the mouse
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await S(() => g && !g.over && st.started && !st.paused ? { a: JTB.autopilot(g) } : null);
      if (!s) break;
      const [x, y] = await stageXY(s.a.target.x, s.a.target.y);
      await p.mouse.move(x, y);
      const want = opts.hold !== undefined ? opts.hold : s.a.hold;
      if (want && !held) { await p.mouse.down(); held = true; } else if (!want && held) { await p.mouse.up(); held = false; }
      await p.waitForTimeout(60);
    }
    if (held) { await p.mouse.up(); held = false; }
  }
  // a graph "renders" when its canvas holds real marks: several colours and a share of pixels unlike the corner (background)
  const canvasInk = sel => p.evaluate(s => {
    const c = document.querySelector(s), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    const bg = d.slice(0, 4).join(), cols = new Set(); let ink = 0;
    for (let i = 0; i < d.length; i += 16) { const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3]; cols.add(k); if (k !== bg) ink++; }
    return { colours: cols.size, inkShare: ink / (d.length / 16) };
  }, sel);
  async function ensureLive() {   // if the bat caught us during a check, start the next round (Fly again)
    if (await S(() => g && g.over)) { await p.waitForSelector('#ov-end:not([hidden])', { timeout: 5000 }); await p.click('#again'); await p.waitForTimeout(200); }
  }

  try {
    // 1. load: brand bar, proof chips, nothing moving or sounding yet
    await p.goto(base, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    ok((await p.title()) === 'Jam the Bat', 'page title');
    ok((await p.getAttribute('.wtnr-bar a', 'href')) === HUB, 'brand bar links the hub');
    const proof = await p.textContent('#proof');
    ok(proof.includes('156 qubits on ibm_fez') && proof.includes(`${JOBS.length} real Atlas jobs`), 'proof chips', proof);
    ok(await q() === 0, 'no sound before any user action');
    ok(!(await p.isVisible('#pause')), 'Pause is not offered before the first flight');
    ok((await p.textContent('#restart')).trim() === 'Start flight', 'Restart button says Start flight before the first flight');
    step('loaded: hub link, proof chips (156 qubits on ibm_fez, 4 jobs), silent, control row labelled for pre-flight');

    // 2. pick the IBM chip as the noise-maker
    await p.click('#src-seg button[data-src="fez"]');
    ok((await p.getAttribute('#src-seg button[data-src="fez"]', 'aria-pressed')) === 'true', 'fez picker pressed');
    const note = await p.textContent('#src-note');
    ok(note.includes('ibm_fez') && note.includes('148 + 8 = 156 qubits'), 'source note names the chip and its qubits', note);
    step('picked the ibm_fez chip: 148 + 8 = 156 qubits');

    // 3. start with sound: the stage overlay goes, the game runs, sound starts
    await p.click('#go');
    ok(await p.isHidden('#ov-start'), 'start overlay hidden');
    ok(await p.isVisible('#pause') && (await p.textContent('#restart')).trim() === 'Restart', 'Pause appears and Restart is labelled Restart once flying');
    await fly(1500);
    await ensureLive();
    const s1 = await q();
    ok(s1 > 0, 'sound started after Start flight (sound on)', s1);
    ok(await S(() => g.t > 0 && st.started), 'game clock advancing');
    step(`started a flight with sound: ${s1} Web Audio sources started`);

    // 4. stop and restart the sound: Mute stops new sound while the game keeps running, unmute brings it back
    await p.click('#mute');
    ok((await p.textContent('#mute')).trim() === 'Sound off: unmute', 'mute label');
    const m0 = await q(), gt0 = await S(() => g.t);
    await fly(1500);
    ok(await q() === m0, 'muted: no new sound sources', { m0, now: await q() });
    ok(await S(() => g.t) > gt0 || await S(() => g.over), 'game kept running while muted');
    await ensureLive();
    await p.click('#mute');
    ok((await p.textContent('#mute')).trim() === 'Mute sound', 'unmute label');
    const u0 = await q();
    await fly(1500);
    await ensureLive(); await fly(800);
    ok(await q() > u0, 'unmuted: sound sources start again', { u0, now: await q() });
    step('muted (no new sound while flying) and unmuted (sound back)');

    // 5. pause freezes the game, resume continues it
    await ensureLive();
    await p.click('#pause');
    ok(await p.isVisible('#ov-pause'), 'pause overlay');
    const pt0 = await S(() => g.t), ps0 = await q();
    await p.waitForTimeout(700);
    ok(await S(() => g.t) === pt0 && await q() === ps0, 'paused: game clock and sound frozen');
    await p.click('#resume');
    await fly(600);
    ok(await S(() => g.t) > pt0 || await S(() => g.over), 'resumed: clock advances');
    step('paused (clock and sound frozen) and resumed');

    // 6. switch noise-maker mid-flight and back: clicks carry the source they came from
    await ensureLive();
    for (let k = 0; k < 20 && await S(() => !g.over && g.energy < 25); k++) await fly(300, { hold: false });   // get some breath back first
    await ensureLive();
    await p.click('#src-seg button[data-src="mar"]');
    await fly(900, { hold: true });
    await p.click('#src-seg button[data-src="fez"]');
    const srcs = await S(() => [...new Set(g.clicks.map(c => c.src))]);
    ok(srcs.includes('mar') || await S(() => g.over), 'a click came from ibm_marrakesh after the mid-flight switch', srcs);
    step(`switched noise-maker mid-flight (clicks from: ${srcs.join(', ')})`);

    // 7. fly the round to its end
    await ensureLive();
    await p.click('#src-seg button[data-src="fez"]');
    const t0 = Date.now();
    while (!(await S(() => g.over)) && Date.now() - t0 < 120000) await fly(4000);
    ok(await S(() => g.over), 'round reached an outcome within 2 minutes');
    await p.waitForSelector('#ov-end:not([hidden])', { timeout: 5000 });
    const end = await S(() => ({ result: g.result, survived: g.survived, n: g.clicks.length, hits: g.clicks.filter(c => c.hit).length,
      lastSrc: g.clicks.length ? g.clicks[g.clicks.length - 1].src : null, cursor: live.fez ? live.fez.cursor : 0 }));
    const endH = (await p.textContent('#end-h')).trim(), endP = (await p.textContent('#end-p')).trim();
    ok(end.result === 'escaped' ? endH === 'You escaped.' : endH === `Caught on pass ${end.survived + 1}.`, 'end headline matches the result', { end, endH });
    ok(endP.startsWith(`${end.n} clicks from the ibm_fez source. The bat guessed ${end.hits} of them`), 'end text matches the game state', { endP, end });
    ok(end.n > 0 && end.cursor > 0, 'clicks were fired and fez bank slots consumed', end);
    const fezClicks = await S(() => g.clicks.filter(c => c.src === 'fez').length);
    ok(end.cursor >= fezClicks, 'every fez click drew a fresh bank slot (the cursor never lags the clicks)', { cursor: end.cursor, fezClicks });
    ok(!(await p.isVisible('#pause')), 'Pause is withdrawn once the round is over');
    const pips = await p.$$eval('#h-pass i.on', e => e.length);
    ok(pips === end.survived, 'pass pips show passes survived', { pips, end });
    step(`flew a full round on the ibm_fez bank: ${endH} ${end.n} clicks, bat guessed ${end.hits}, ${end.cursor} bank slots used`);

    // 8. the tape, its legend, the job readout and the cast are all visible under the stage; read one click off the tape
    ok(await p.isVisible('#v-scene') && (await p.$$eval('#cast li', e => e.length)) === 8, 'cast list with the 8-part cast');
    ok((await p.textContent('#cast')).includes('ibm_fez'), 'cast names the current noise-maker');
    ok(await p.isVisible('#v-data') && await p.isVisible('#tape'), 'tape and job readout visible without a toggle');
    ok((await p.textContent('#tape-label')).includes('job behind them'), 'tape block is titled');
    const leg = await p.textContent('#legend');
    ok(['You, the moth', 'The bat', 'Clean echo', 'Jammed echo or click', 'Where the bat thinks you are'].every(t => leg.includes(t)) &&
       (await p.$$eval('#legend img.px', e => e.length)) === 4, 'legend restored with its five keys (four sprite icons)', leg);
    ok((await p.textContent('#r-job')).trim() === FEZ.job_id, 'readout shows the fez Atlas job id', await p.textContent('#r-job'));
    ok((await p.textContent('#r-engine')).includes('ibm_fez (IBM hardware)') && (await p.textContent('#r-engine')).includes('148+8 = 156 qubits'), 'engine readout');
    ok((await p.textContent('#r-bank')).startsWith(`slot ${end.cursor.toLocaleString('en-US')} of 243,586`), 'bank readout = slots used', await p.textContent('#r-bank'));
    const tb = await p.locator('#tape').boundingBox();
    await p.mouse.click(tb.x + tb.width - 30, tb.y + tb.height / 2);
    const tr1 = await p.textContent('#tape-read');
    ok(new RegExp(`^Click \\d+ of ${end.n} \\(`).test(tr1) && /The bat guessed .* confidence/.test(tr1), 'clicking the tape reads that click', tr1);
    await p.keyboard.press('ArrowLeft');
    const tr2 = await p.textContent('#tape-read');
    ok(tr2 !== tr1 && tr2.startsWith('Click '), 'arrow keys move along the tape', tr2);
    const sel = await S(() => { const c = g.clicks[tapeSel]; return { i: tapeSel, hit: c.hit }; });
    ok(tr2.startsWith(`Click ${sel.i + 1} of`) && tr2.includes(sel.hit ? 'tuned that click out' : 'jammed for 160 ms'), 'tape readout matches the click record', { tr2, sel });
    const tapeInk = await canvasInk('#tape'), skyInk = await canvasInk('#cv');
    ok(tapeInk.colours >= 4 && tapeInk.inkShare > 0.05, 'click tape graph is drawn (non-empty canvas)', tapeInk);
    ok(skyInk.colours >= 4 && skyInk.inkShare > 0.05, 'stage canvas is drawn (non-empty)', skyInk);
    ok((await p.$$eval('#cast li img, #cast li canvas', e => e.length)) >= 8, 'cast list shows its sprites');
    step(`tape, legend, job readout (fez job id) and cast all visible; tape graph drawn (${tapeInk.colours} colours, ${(100 * tapeInk.inkShare).toFixed(0)}% marked); read clicks off the tape by pointer and keyboard`);

    // 9. share this run, reload with the hash, and check the state comes back
    await p.click('#share-run');
    await p.waitForTimeout(300);
    const hash = await S(() => location.hash);
    ok(hash === `#fez-5eed2009-1-x${end.survived}.${end.n}.${end.hits}`, 'share hash encodes source, seed, seed-known and the run', hash);
    const toastTxt = (await p.textContent('#toast')).trim();
    ok(toastTxt === 'Link copied' || toastTxt.startsWith('Copy failed'), 'share gives feedback', toastTxt);
    if (toastTxt === 'Link copied') ok((await S(() => navigator.clipboard.readText())) === await S(() => location.href), 'clipboard holds the link');
    // Fly again: a fresh round starts at once (end card gone, no clicks yet, Pause offered again)
    const round0 = await S(() => st.round);
    await p.click('#again');
    ok(await p.isHidden('#ov-end') && await S(() => !g.over && g.clicks.length === 0) && await S(() => st.round) === round0 + 1, 'Fly again starts a fresh round');
    ok(await p.isVisible('#pause'), 'Pause is offered again in the new round');
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    ok((await p.getAttribute('#src-seg button[data-src="fez"]', 'aria-pressed')) === 'true', 'restored source fez');
    const shared = (await p.textContent('#shared')).trim();
    ok(await p.isVisible('#shared') && shared.includes(`with ${end.n} clicks from ibm_fez, and the bat guessed ${end.hits}`) &&
       shared.includes(end.survived >= 3 ? 'escaped all 3 passes' : `survived ${end.survived} of 3 passes`), 'shared-run note restored', shared);
    ok((await p.inputValue('#seed')) === '0x5EED2009' && (await p.getAttribute('#seedknown', 'aria-pressed')) === 'true', 'seed state restored');
    ok(await q() === 0, 'reload is silent until the user acts');
    step(`copied the run link (${hash}) and reloaded: source, seed and run restored`);

    // 10. the tournament (classical simulation): 500 rounds per source, same numbers as sim.js / out/tournament.json
    await p.click('#n-seg button:has-text("100")');
    ok((await p.getAttribute('#n-seg button:has-text("100")', 'aria-pressed')) === 'true', 'round count selectable');
    // Run, then Stop part-way: the button comes back and the partial counts stay on the bars
    await p.click('#tour-run');
    await p.waitForFunction(() => parseFloat(document.getElementById('tour-prog').style.width) > 0, null, { timeout: 10000 });
    ok((await p.textContent('#tour-run')).trim() === 'Stop', 'tournament running (100 rounds), button offers Stop');
    await p.click('#tour-run');
    await p.waitForFunction(() => document.getElementById('tour-run').textContent === 'Run the tournament', null, { timeout: 10000 });
    const partial = await S(() => parseFloat(document.getElementById('tour-prog').style.width));
    ok(partial > 0 && partial < 100, 'Stop halts the tournament part-way', partial);
    step(`ran the tournament at 100 rounds and stopped it part-way (${partial.toFixed(0)}% done)`);
    await p.click('#n-seg button:has-text("500")');
    await p.click('#tour-run');
    ok((await p.textContent('#tour-run')).trim() === 'Stop', 'tournament running, button offers Stop');
    await p.waitForFunction(() => document.getElementById('tour-run').textContent === 'Run the tournament', null, { timeout: 180000 });
    const rows = await p.$$eval('#tour .trow:not(.head)', rs => rs.map(r => ({ pct: r.querySelector('.pct').textContent, hit: r.querySelector('.hit').textContent })));
    const want = TOUR.short.rows;
    ok(rows.length === want.length, 'one row per source', rows.length);
    want.forEach((w, i) => {
      ok(rows[i].pct === (100 * w.surv / w.n).toFixed(1) + '%', `tournament survival matches sim.js for ${w.id}`, { page: rows[i].pct, sim: w.surv / w.n });
      ok(rows[i].hit.includes(`of ${w.clicks.toLocaleString('en-US')} clicks`), `tournament clicks match sim.js for ${w.id}`, { page: rows[i].hit, sim: w.clicks });
    });
    const bars = await p.$$eval('#tour .trow:not(.head) .track', ts => ts.map(t => ({ w: t.querySelector('i').getBoundingClientRect().width, whisk: !!t.querySelector('b') })));
    want.forEach((w, i) => ok(bars[i].whisk && (w.surv === 0 ? bars[i].w === 0 : bars[i].w > 10), `tournament bar + whisker drawn for ${w.id}`, bars[i]));
    const tt = await p.textContent('#tour-test');
    ok(tt.includes(`p = ${TOUR.short.homogeneity.p.toFixed(2)}`), 'homogeneity p matches sim.js', tt);
    step(`ran the 500-round tournament: ${rows.map(r => r.pct).join(' / ')}, identical to out/tournament.json (p = ${TOUR.short.homogeneity.p.toFixed(2)})`);

    // 11. what came off the chip: switch run, inspect a qubit
    ok((await p.$$eval('#grid rect[data-q]', e => e.length)) === 156, '156 qubit cells for ibm_fez');
    const fills = await p.$$eval('#grid rect[data-q]', e => new Set(e.map(r => r.getAttribute('fill'))).size);
    ok(fills >= 10, 'P(1) chip map shades its cells from the job data (many distinct fills)', fills);
    const PM = String.fromCharCode(0xB1);   // the plus-minus sign the gauge prints
    const PIECEJ = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
    const gt = await p.textContent('#gauge');
    ok((await p.$$eval('#gauge circle', e => e.length)) === 3, 'CHSH gauge draws three S points (fez, marrakesh, emulator)');
    for (const [k, [sv, se]] of Object.entries(PIECEJ.chsh_S)) ok(gt.includes(`${sv.toFixed(3)} ${PM} ${se.toFixed(3)}`), `gauge shows S for ${k} as in piece.json`, gt);
    await p.click('#hw-seg button:has-text("ibm_marrakesh")');
    ok((await p.textContent('#grid-label')).includes('ibm_marrakesh: 148 register'), 'chip map switched to ibm_marrakesh');
    await p.focus('#qsel'); await p.keyboard.press('ArrowRight');
    ok((await p.textContent('#qread')).startsWith('Circuit qubit 1 on physical qubit'), 'slider inspects a qubit', await p.textContent('#qread'));
    const jt = await p.textContent('#jobs');
    for (const j of JOBS) ok(jt.includes(j.job_id), 'jobs table lists ' + j.name);
    const sel0 = await p.inputValue('#qsel');
    const cell = p.locator('#grid rect[data-q="40"]'); await cell.hover();
    ok((await p.inputValue('#qsel')) === '40' && (await p.textContent('#qread')).startsWith('Circuit qubit 40'), 'pointing at a chip cell inspects it', { sel0 });
    step('chip map (156 shaded cells) and CHSH gauge (3 S values = piece.json) drawn; switched to ibm_marrakesh, inspected qubits by slider and by pointer; the job table lists all 4 job ids');

    // 12. leaked seed: change the seed, tell the bat to ignore it, share, reload, restored
    await p.click('#src-seg button[data-src="prng"]');
    ok(await p.isVisible('#seedrow'), 'seed row appears for the PRNG');
    await p.fill('#seed', '0x1234abcd'); await p.press('#seed', 'Tab');
    ok((await p.inputValue('#seed')) === '0x1234ABCD', 'seed normalised', await p.inputValue('#seed'));
    await p.click('#seedknown');
    ok((await p.textContent('#seedknown')).trim() === 'Bat ignores the seed' && (await p.getAttribute('#seedknown', 'aria-pressed')) === 'false', 'seed-known toggle');
    ok((await p.textContent('#src-note')).includes('0x1234ABCD') && (await p.textContent('#src-note')).includes('sealed'), 'note shows the seed and the sealed packet');
    await p.click('#share');
    await p.waitForTimeout(200);
    ok((await S(() => location.hash)) === '#prng-1234abcd-0', 'share hash for the PRNG view', await S(() => location.hash));
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300);
    ok((await p.getAttribute('#src-seg button[data-src="prng"]', 'aria-pressed')) === 'true' && await p.isVisible('#seedrow'), 'PRNG restored');
    ok((await p.inputValue('#seed')) === '0x1234ABCD' && (await p.textContent('#seedknown')).trim() === 'Bat ignores the seed', 'seed and toggle restored');
    ok(await p.isHidden('#shared'), 'no shared-run note without a run in the link');
    step('set seed 0x1234ABCD with the bat ignoring it, shared, reloaded: restored');

    // 12b. the other ways in: Start muted, the click pad, Restart from the pause card, and the keyboard start on the sky
    await p.goto(base, { waitUntil: 'networkidle' }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300);
    ok(!(await S(() => location.hash)), 'fresh load without a hash');
    await p.click('#go-mute');
    ok(await p.isHidden('#ov-start') && await S(() => st.started && st.muted), 'Start muted starts a flight with sound off');
    ok((await p.textContent('#mute')).trim() === 'Sound off: unmute', 'mute button says the sound is off');
    const pb = await p.locator('#pad').boundingBox();
    const c0 = await S(() => g.clicks.length);
    await p.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await p.mouse.down();
    await p.waitForTimeout(150);
    ok((await p.getAttribute('#pad', 'aria-pressed')) === 'true', 'the click pad shows it is held');
    await p.waitForTimeout(650); await p.mouse.up();
    ok(await S(() => g.clicks.length) > c0 || await S(() => g.over), 'holding the click pad fires clicks', { c0, now: await S(() => g.clicks.length) });
    ok(await q() === 0, 'Start muted: no sound at all', await q());
    await ensureLive();
    await p.click('#pause');
    const rr0 = await S(() => st.round);
    await p.click('#restart2');
    ok(await p.isHidden('#ov-pause') && await p.evaluate(r => !st.paused && g.clicks.length === 0 && st.round === r + 1, rr0), 'Restart on the pause card starts a fresh round');
    await p.click('#restart');
    ok(await p.evaluate(r => st.round === r + 2 && g.clicks.length === 0, rr0), 'Restart in the control row starts a fresh round');
    await p.goto(base + '#emu-5eed2009-1', { waitUntil: 'networkidle' }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300);
    ok((await p.getAttribute('#src-seg button[data-src="emu"]', 'aria-pressed')) === 'true', 'a hand-typed link picks the emulator');
    await p.focus('#cv'); await p.keyboard.press('Enter');
    ok(await S(() => st.started) && await p.isHidden('#ov-start'), 'Enter on the focused sky starts a flight');
    await p.waitForTimeout(400);
    await p.keyboard.press('KeyP');
    ok(await S(() => st.paused) && await p.isVisible('#ov-pause'), 'P pauses');
    await p.keyboard.press('KeyP');
    ok(await S(() => !st.paused), 'P resumes');
    step('Start muted (silent), held the click pad (clicks fired), Restart from the pause card and the control row, a hand-typed emulator link, Enter to start and P to pause on the sky');

    // 13. the titled sections below the game: each one visible, the earlier words in place
    const SECTIONS = { 'how-to-play': 'The game rule', tournament: 'The bat tournament', chip: 'What came off the chip', made: 'What the quantum engine did',
      science: 'Why a tiger moth?', claims: 'What this does not claim', 'jobs-credits': 'Jobs and credits' };
    for (const [id, h] of Object.entries(SECTIONS)) {
      ok(await p.isVisible(`#${id}`) && (await p.textContent(`#${id} h2`)).trim() === h, `section ${id} visible and titled "${h}"`);
    }
    for (const id of ['tape', 'tour', 'grid', 'gauge', 'jobs']) ok(await p.isVisible('#' + id), `graph/table #${id} visible`);
    const body = await p.textContent('#engine-body');
    ok(body.includes('148 register qubits + 8 Bell-witness qubits = 156'), 'engine section states the qubit count');
    ok((await p.textContent('#rule-body')).includes('Jammed echoes leave it flying at a stale guess (the dashed ring).'), 'game rule restored verbatim');
    ok((await p.textContent('#no-claim-s')).startsWith('The CHSH value does not certify the 148 register qubits.'), 'honesty note filled');
    ok(!/bonus/i.test(await p.textContent('body')), 'no "bonus" wording anywhere');
    ok((await p.textContent('.wtnr-bar .count')).includes('Challenge 05'), 'brand bar reads Challenge 05');
    step(`seven titled sections visible: ${Object.values(SECTIONS).join(' | ')}; graphs and job table visible`);

    // 14. the set: prev / hub / next and the jump list
    const prev = await p.getAttribute('nav.wtnr-nav a[rel="prev"]', 'href'), next = await p.getAttribute('nav.wtnr-nav a[rel="next"]', 'href');
    ok(prev === URLS['04-magic-angle'] && next === URLS['06-tweezer'], 'prev/next point at 04 and 06', { prev, next });
    ok((await p.getAttribute('nav.wtnr-nav a.wn-hub', 'href')) === HUB, 'nav hub link');
    ok((await p.textContent('nav.wtnr-nav a[rel="prev"]')).includes('04') && (await p.textContent('nav.wtnr-nav a[rel="next"]')).includes('06'), 'prev/next labels name the pieces');
    await p.click('nav.wtnr-nav summary');
    const jl = await p.$$eval('nav.wtnr-nav ol a', a => a.map(x => ({ href: x.getAttribute('href'), cur: x.getAttribute('aria-current') })));
    ok(jl.length === Object.keys(URLS).length && jl.every(x => Object.values(URLS).includes(x.href)), 'jump list links every published piece', jl.length);
    ok(jl.filter(x => x.cur === 'page').map(x => x.href).join() === URLS['05-jam-the-bat'], 'this piece is marked current');
    step(`nav: prev 04, hub, next 06, and a ${jl.length}-piece jump list`);

    const bad = [...external].filter(h => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(h));
    ok(!bad.length, 'no requests to other hosts', bad);
    ok(!errors.length, 'no page errors', errors.slice(0, 5));
    step('no page errors; no external requests beyond Google Fonts');
    result = { ok: true, steps };
  } catch (e) {
    result = { ok: false, steps, failed: String(e.message || e).slice(0, 600), errors: errors.slice(0, 5) };
    try { await p.screenshot({ path: path.join(PIECE, 'qa', 'e2e-fail.png') }); } catch (_) {}
  }
  fs.writeFileSync(path.join(PIECE, 'qa', 'e2e.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
  await browser.close(); srv.close();
  process.exit(result.ok ? 0 : 1);
})();
