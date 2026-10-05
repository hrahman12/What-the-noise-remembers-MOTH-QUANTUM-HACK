// End-to-end journey for Chirp Instrument: node entries/12-chirp-instrument/qa/e2e.cjs [port 6240-6249]
// Serves web/ locally, opens index.html in headless Chromium and walks the main user journey with real assertions:
// nothing sounds before a click; tapping the black holes in the scene and the pad steps through the real half-waves
// (and starts sound); Play / stop; the blur-reach scrub (and the snap-back from a stop that was never run); the loop
// presets and a dragged loop on the tape; the keyboard jam; muting a voice by tapping an observatory; the Data view;
// Hear the detector (start and stop); every render card (Play starts real audio, Stop stops it, the position slider
// seeks, "Show this MIDI on the roll" loads the take); every restored graph rendering (Figures 1-3, the stage roll and
// strain, the scene and the tape: screenshot pixels, not just the DOM); the six sections and the nav drawer; the
// share link restored after a reload; the prev / hub / next nav; and the numbers on the page against piece.json,
// out/jobs.csv and the engine cache. It also confirms the dead-control detector's false positives (an option that was
// already selected) by selecting another option first. Prints a JSON report and exits 1 if any step fails.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const PIECE = path.resolve(__dirname, '..'), WEB = path.join(PIECE, 'web'), ROOT = path.resolve(PIECE, '..', '..');
const port = +(process.argv[2] || 6240);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const piece = JSON.parse(fs.readFileSync(path.join(PIECE, 'piece.json'), 'utf8'));
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const jobsCsv = fs.readFileSync(path.join(PIECE, 'out', 'jobs.csv'), 'utf8').trim().split(/\r?\n/);
const head = jobsCsv[0].split(','), JOBS = jobsCsv.slice(1).map(l => Object.fromEntries(l.split(',').map((v, i) => [head[i], v])));
const DONE = JOBS.filter(j => j.status === 'completed');
const cacheText = fs.readdirSync(path.join(ROOT, 'cache', 'blur-midi-v1')).map(f => fs.readFileSync(path.join(ROOT, 'cache', 'blur-midi-v1', f), 'utf8')).join('\n');

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.js': 'text/javascript', '.mp3': 'audio/mpeg' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const st = fs.statSync(f), type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const range = q.headers.range && /bytes=(\d*)-(\d*)/.exec(q.headers.range);
  if (range) {   // media elements seek with byte ranges
    const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
  fs.createReadStream(f).pipe(r);
});

const INSTRUMENT = () => {   // as common/qa/qa_page.cjs: count Web Audio sources and media 'playing' events
  window.__qa = { sources: 0, media: 0, ctx: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { window.__qa.ctx++; return new AC(...a); }; W.prototype = AC.prototype;
    window.AudioContext = W; window.webkitAudioContext = W;
    // AudioBufferSourceNode declares its own start(when, offset, duration), so it is wrapped separately
    for (const P of [window.AudioScheduledSourceNode, window.AudioBufferSourceNode].filter(Boolean).map(C => C.prototype)) {
      if (!Object.prototype.hasOwnProperty.call(P, 'start')) continue;
      const st = P.start; P.start = function (...a) { window.__qa.sources++; return st.apply(this, a); };
    }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [];
let failed = false;
function check(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  // a media element cancels its own in-flight range request when it seeks or stops (net::ERR_ABORTED): that is not a
  // failure; anything else is
  const aborted = [];
  page.on('requestfailed', q => { const f = (q.failure() || {}).errorText || '';
    if (/ERR_ABORTED/.test(f) && q.resourceType() === 'media') aborted.push(path.basename(q.url())); else errors.push('requestfailed: ' + q.url() + ' ' + f); });
  await page.addInitScript(INSTRUMENT);

  const E = fn => page.evaluate(fn);
  const text = sel => page.$eval(sel, e => e.textContent.trim());
  const qa = () => E(() => ({ ...window.__qa }));
  const S = () => E(() => ({ ev: st.ev, ri: st.ri, si: st.si, pos: st.pos, now: posNow(), playing: st.playing, loop: st.loop,
    loopA: st.loopA, loopB: st.loopB, preset: st.preset, speed: st.speed, voices: [...st.voices], view, held: st.held.size }));
  const toastText = () => text('#toast');
  // a graph "renders" when its on-screen pixels (an element screenshot) hold real ink: many non-paper pixels and
  // several distinct colours, decoded in the page itself
  async function inked(sel) {
    const h = await page.$(sel); check(h, `${sel} missing`);
    await h.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
    const png = (await h.screenshot()).toString('base64');
    return page.evaluate(async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
      let ink = 0; const cols = new Set();
      for (let i = 0; i < d.length; i += 16) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; if (Math.abs(r - 251) + Math.abs(gg - 250) + Math.abs(bb - 249) > 24) ink++; cols.add((r >> 3) + ',' + (gg >> 3) + ',' + (bb >> 3)); }
      return { w: c.width, h: c.height, ink, inkFrac: +(ink / (d.length / 16)).toFixed(4), colours: cols.size };
    }, png);
  }
  async function step(name, fn) {
    try { const detail = await fn(); steps.push({ step: name, ok: true, ...(detail ? { detail } : {}) }); }
    catch (e) { failed = true; steps.push({ step: name, ok: false, error: String(e.message || e).slice(0, 400) }); }
  }

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  await step('page opens on the scene, silent, with the brand bar linking the hub', async () => {
    const t = await page.title(); check(t === 'Chirp Instrument', 'title ' + t);
    const bar = await page.$eval('.wtnr-bar a', a => a.href); check(bar === HUB, 'brand bar href ' + bar);
    const count = await text('.wtnr-bar .count'); check(count === 'Challenge 02', 'brand bar count ' + count);
    check(!/\bbonus\b|main entry/i.test(await E(() => document.body.innerText)), '"Bonus" / "Main entry" shown on the page');
    const s = await S(); check(s.view === 'scene' && !s.playing, 'not on the scene / already playing');
    const q = await qa(); check(q.sources === 0 && q.media === 0, 'sound before any click ' + JSON.stringify(q));
    const paused = await E(() => [...document.querySelectorAll('audio')].every(a => a.paused && a.preload === 'none'));
    check(paused, 'a render is playing or preloading before a click');
    return { title: t, brand: count, ...q };
  });

  await step('tap the black holes in the scene: the next real half-wave sounds and the playhead steps', async () => {
    await page.$eval('#scene', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const xy = await E(() => { const r = scn.getBoundingClientRect(), d = window.devicePixelRatio || 1; return [r.left + SC.L.px * U / d, r.top + SC.L.py * U / d]; });
    const before = await S(), q0 = await qa();
    await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(400);
    const a = await S(), q1 = await qa();
    check(a.pos > before.pos, `playhead did not step (${before.pos} -> ${a.pos})`);
    check(q1.sources > q0.sources, 'no Web Audio source started on the tap');
    await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(300);
    const b = await S(); check(b.pos > a.pos, 'second tap did not step');
    return { pos: [before.pos, a.pos, b.pos].map(x => +x.toFixed(3)), sources: q1.sources };
  });

  await step('tap the pad and press Z: each steps one half-wave', async () => {
    const p0 = (await S()).pos;
    await page.click('#pad'); await page.waitForTimeout(250);
    const p1 = (await S()).pos;
    await page.keyboard.press('z'); await page.waitForTimeout(250);
    const p2 = (await S()).pos;
    check(p1 > p0 && p2 > p1, `pad/Z did not step: ${p0} ${p1} ${p2}`);
    return { pos: [p0, p1, p2].map(x => +x.toFixed(3)) };
  });

  await step('Play runs the transport with sound, and Play again stops it', async () => {
    await page.click('#rewind'); await page.waitForTimeout(150);
    const q0 = await qa();
    await page.click('#play'); await page.waitForTimeout(1600);
    const a = await S(), q1 = await qa(), label = await text('#play');
    check(a.playing && a.now > 0.5, `transport not running (now ${a.now})`);
    check(q1.sources > q0.sources, 'Play started no sound');
    check(/pause|stop/i.test(label), 'Play button label while playing: ' + label);
    await page.click('#play'); await page.waitForTimeout(200);
    const b = await S(); check(!b.playing, 'did not stop');
    return { now: +a.now.toFixed(2), sources: q1.sources - q0.sources, label };
  });

  await step('scrub the blur reach: 0.5 loads its real job; reach 1 (never run) snaps back and says why', async () => {
    const r = await page.$('#reach');
    await r.focus(); await page.keyboard.press('Home'); await page.waitForTimeout(150);
    const off = [await text('#reach-val'), (await S()).ri];
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
    const s05 = await S(), v05 = await text('#reach-val'), job05 = await text('#r-job');
    const want = DONE.find(j => +j.reach === 0.5);
    check(s05.ri === 2, 'reach index ' + s05.ri);
    check(job05.includes(want.job_id), `readout job ${job05} is not ${want.job_id}`);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
    const s1 = await S(), t1 = await toastText();
    check(s1.ri !== 3, 'reach 1 accepted although it was never run');
    check(/No data/i.test(t1), 'no explanation toast: ' + t1);
    return { off, reach05: v05, job: job05, snapped_to: s1.ri, toast: t1.slice(0, 120) };
  });

  await step('loop presets: Merger loops the merger and plays inside it; Whole clears the loop', async () => {
    await page.click('[data-preset=merger]'); await page.waitForTimeout(150);
    const m = await S(), want = await E(() => EV().presets.merger);
    check(m.loop && Math.abs(m.loopA - want[0]) < 1e-6 && Math.abs(m.loopB - want[1]) < 1e-6, 'merger loop ' + JSON.stringify([m.loopA, m.loopB]));
    await page.click('#play'); await page.waitForTimeout(1500);
    const p = (await S()).now; await page.click('#play');
    check(p >= want[0] - 0.05 && p <= want[1] + 0.05, `playhead ${p} outside the merger loop ${want}`);
    check((await text('#loop')).match(/loop on/i), 'Loop button does not read Loop on');
    await page.click('[data-preset=whole]'); await page.waitForTimeout(150);
    const w = await S(); check(!w.loop && w.preset === 'whole', 'Whole did not clear the loop');
    return { merger: want, playhead_in_loop: +p.toFixed(2) };
  });

  await step('drag along the tape under the scene to set a loop', async () => {
    const box = await page.$eval('#track', e => { e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    await page.waitForTimeout(200);
    const y = box[1] + box[3] / 2;
    await page.mouse.move(box[0] + box[2] * 0.3, y); await page.mouse.down();
    await page.mouse.move(box[0] + box[2] * 0.45, y, { steps: 5 }); await page.mouse.move(box[0] + box[2] * 0.55, y, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(200);
    const s = await S(); check(s.loop && s.preset === 'custom' && s.loopB - s.loopA > 1, 'tape drag did not loop ' + JSON.stringify(s));
    return { loop: [s.loopA, s.loopB].map(x => +x.toFixed(2)) };
  });

  await step('jam: the A key holds a note with sound, released on key-up', async () => {
    await page.$eval('#keys', e => e.scrollIntoView({ block: 'center' }));
    await page.click('body', { position: { x: 5, y: 5 } }).catch(() => {});
    const q0 = await qa();
    await page.keyboard.down('a'); await page.waitForTimeout(200);
    const held = (await S()).held, q1 = await qa();
    await page.keyboard.up('a'); await page.waitForTimeout(200);
    const after = (await S()).held;
    check(held === 1 && after === 0 && q1.sources > q0.sources, `jam held ${held} -> ${after}, sources ${q0.sources} -> ${q1.sources}`);
    const k = await page.$('#keys [data-p]'); await k.click(); await page.waitForTimeout(150);
    return { held, released: after === 0 };
  });

  await step('tap an observatory in the scene to mute its voice; the H1 button unmutes it', async () => {
    await page.$eval('#scene', e => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250);
    const xy = await E(() => { const r = scn.getBoundingClientRect(), d = window.devicePixelRatio || 1, p = SC.L.plates.find(q => q.v === 0);
      return [r.left + (p.x + p.m.w / 2) * U / d, r.top + (p.y + p.m.h * 0.6) * U / d]; });
    await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(250);
    const s = await S(), t = await toastText(), pressed = await page.$eval('#v-0', b => b.getAttribute('aria-pressed'));
    check(s.voices[0] === false && pressed === 'false' && /muted/.test(t), `H1 not muted: ${s.voices} ${pressed} ${t}`);
    await page.click('#v-0'); await page.waitForTimeout(150);
    check((await S()).voices[0] === true, 'H1 button did not unmute');
    return { toast: t };
  });

  await step('Hear the detector plays the real strain and stops on the second click', async () => {
    const q0 = await qa();
    await page.click('#hear');   // the clip is 0.31 s long, so read and stop it straight away
    const lab = await text('#hear'), q1 = await qa();
    check(lab === 'Stop' && q1.sources > q0.sources, `hear: ${lab}, sources ${q0.sources}->${q1.sources}`);
    await page.click('#hear');
    const lab2 = await text('#hear'), q2 = await qa(); check(/Hear the detector/.test(lab2) && q2.sources === q1.sources, 'did not stop: ' + lab2);
    return { label: lab, then: lab2 };
  });

  await step('the renders: every card plays real audio, Stop stops it, the slider seeks, and it loads onto the roll', async () => {
    const n = await page.$$eval('#rgrid .rcard', c => c.length);
    const files = fs.readdirSync(path.join(WEB, 'audio')).filter(f => f.endsWith('.mp3'));
    check(n === files.length && n === 4, `${n} cards for ${files.length} mp3 files`);
    const out = [];
    for (let i = 0; i < n; i++) {
      const card = `#rgrid .rcard:nth-child(${i + 1})`;
      await page.$eval(card, e => e.scrollIntoView({ block: 'center' }));
      const m0 = (await qa()).media;
      await page.click(`${card} [data-act=play]`);
      await page.waitForFunction(c => { const a = document.querySelector(c + ' audio'); return a && !a.paused && a.currentTime > 0.3; }, card, { timeout: 15000 });
      const m1 = (await qa()).media, lab = await text(`${card} [data-act=play]`);
      check(m1 > m0 && lab === 'Pause', `card ${i}: media ${m0}->${m1}, label ${lab}`);
      // the position slider seeks the playing render
      const sl = await page.$(`${card} input[type=range]`), max = +(await sl.getAttribute('max'));
      await sl.evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, (max / 2).toFixed(1));
      await page.waitForTimeout(400);
      const t = await page.$eval(`${card} audio`, a => a.currentTime);
      check(Math.abs(t - max / 2) < 1.5, `card ${i}: slider to ${max / 2} left currentTime ${t}`);
      await page.click(`${card} [data-act=stop]`); await page.waitForTimeout(150);
      const st2 = await page.$eval(`${card} audio`, a => [a.paused, a.currentTime]), lab2 = await text(`${card} [data-act=play]`);
      check(st2[0] && st2[1] === 0 && lab2 === 'Play', `card ${i}: Stop left ${st2} ${lab2}`);
      const R = await page.evaluate(k => RENDERS[k], i);
      await page.click(`${card} [data-act=open]`); await page.waitForTimeout(500);
      const s = await S(), tt = await toastText();
      check(s.ev === R.ev && s.ri === R.ri && /^On the roll/.test(tt), `card ${i}: roll ev ${s.ev} ri ${s.ri} (want ${R.ev} ${R.ri}); toast ${tt}`);
      out.push({ src: R.src, seeked_to: +t.toFixed(1), loaded: [s.ev, s.ri] });
    }
    // the slider also sets where a render starts before it has loaded (preload none)
    const card = '#rgrid .rcard:nth-child(2)';
    await page.$eval(card + ' input[type=range]', e => { e.value = 10; e.dispatchEvent(new Event('input', { bubbles: true })); });
    const tl = await text(card + ' [data-t]'); check(tl.startsWith('0:10'), 'time label after seeking: ' + tl);
    return { cards: out, label_after_seek: tl };
  });

  await step('every restored graph renders: Figures 1, 2 and 3, the stage roll and strain, the scene and the tape', async () => {
    await page.click('#g-event button[data-i="0"]'); await page.waitForTimeout(200);
    const r = {};
    r.scene = await inked('#scene'); r.tape = await inked('#track');
    r.fig1 = await inked('#roll-fig'); r.fig2 = await inked('#strip-fig');
    const nt = await page.$$eval('#takes .take', b => b.length), want = await E(() => EVENTS.reduce((a, e) => a + e.sets.length, 0));
    check(nt === want && nt === 4, `${nt} takes in Figure 3, want ${want}`);
    r.fig3 = [];
    for (let i = 1; i <= nt; i++) r.fig3.push(await inked(`#takes .take:nth-child(${i}) canvas`));
    await page.$eval('.stage', e => e.scrollIntoView({ block: 'start' }));
    await page.click('#g-view [data-view=data]'); await page.waitForTimeout(400);
    r.stage_roll = await inked('#roll'); r.stage_strip = await inked('#strip');
    // the stage's strain strip scrubs like its roll (the dead-control detector drags it exactly as it dragged the
    // roll just before, so it lands on the same loop and reads as unchanged): a click at 30% moves the playhead there
    const sb = await page.$eval('#strip', e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    await page.mouse.click(sb[0] + sb[2] * 0.3, sb[1] + sb[3] / 2); await page.waitForTimeout(200);
    const sp = await S(), Tt = await E(() => EV().t_total);
    check(sp.pos > Tt * 0.15 && sp.pos < Tt * 0.4, `stage strain click moved the playhead to ${sp.pos} of ${Tt}`);
    await page.click('#g-view [data-view=scene]'); await page.waitForTimeout(200);
    for (const [k, v] of Object.entries(r)) for (const x of [].concat(v)) check(x.w > 50 && x.h > 20 && x.ink > 30 && x.colours > 3, `${k} looks empty: ${JSON.stringify(x)}`);
    const caps = await page.$$eval('#data figcaption, #data .cap', c => c.filter(x => x.textContent.trim().length > 40).length);
    check(caps >= 2, 'figure captions missing');
    return { ...r, stage_strip_click_pos: +sp.pos.toFixed(2) };
  });

  await step('Figure 1 and Figure 2 scrub: a click on the strain moves the playhead, a drag on the roll loops; Figure 3 loads a take', async () => {
    await page.click('[data-preset=whole]');
    const sb = await page.$eval('#strip-fig', e => { e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    await page.waitForTimeout(200);
    await page.mouse.click(sb[0] + sb[2] * 0.7, sb[1] + sb[3] / 2); await page.waitForTimeout(200);
    const s = await S(), T = await E(() => EV().t_total);
    check(s.pos > T * 0.5 && s.pos < T * 0.9, `strain click moved the playhead to ${s.pos} of ${T}`);
    const rb = await page.$eval('#roll-fig', e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
    await page.mouse.move(rb[0] + rb[2] * 0.2, rb[1] + rb[3] / 2); await page.mouse.down();
    await page.mouse.move(rb[0] + rb[2] * 0.35, rb[1] + rb[3] / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
    const l = await S(); check(l.loop && l.preset === 'custom', 'roll drag did not loop');
    await page.click('#play-fig'); await page.waitForTimeout(800);
    const pf = await S(); await page.click('#play-fig');
    check(pf.playing, 'Figure 1 Play did not start the transport');
    await page.click('#takes .take:nth-child(2)'); await page.waitForTimeout(300);
    const t = await S(), pressed = await page.$eval('#takes .take:nth-child(2)', b => b.getAttribute('aria-pressed'));
    check(t.ev === 0 && t.ri === 1 && pressed === 'true', `take 2 load: ev ${t.ev} ri ${t.ri} pressed ${pressed}`);
    return { strain_click_pos: +s.pos.toFixed(2), roll_loop: [l.loopA, l.loopB].map(x => +x.toFixed(2)) };
  });

  await step('GW170817: Figure 2 switches to along-track power, the no-blur note shows, Hear explains itself', async () => {
    await page.click('#g-event button[data-i="1"]'); await page.waitForTimeout(300);
    const s = await S(), h = await text('#fig-strip-h'), empty = await page.$eval('#empty-fig', e => [e.hidden, e.textContent]);
    check(s.ev === 1 && /along-track power/.test(h) && !empty[0] && empty[1].length > 20, `GW170817: ${s.ev} ${h} ${empty}`);
    await page.click('#hear'); await page.waitForTimeout(200);
    check(/No strain clip/.test(await toastText()), 'Hear on GW170817 gave no explanation');
    const r2 = await inked('#strip-fig'); check(r2.ink > 30, 'GW170817 Figure 2 empty');
    await page.click('#g-event button[data-i="0"]'); await page.waitForTimeout(200);
    return { fig2_title: h };
  });

  await step('dead-control false positives confirmed: GW150914 and Whole act once another option is selected', async () => {
    await page.click('#g-event button[data-i="1"]'); await page.waitForTimeout(150);
    await page.click('#g-event button[data-i="0"]'); await page.waitForTimeout(150);
    const a = await S(), p = await page.$eval('#g-event button[data-i="0"]', b => b.getAttribute('aria-pressed'));
    check(a.ev === 0 && p === 'true', 'GW150914 button did not switch back');
    await page.click('[data-preset=inspiral]'); await page.waitForTimeout(100);
    const i = await S(); check(i.loop && i.preset === 'inspiral', 'Inspiral did not loop');
    await page.click('[data-preset=whole]'); await page.waitForTimeout(100);
    const w = await S(), wp = await page.$eval('[data-preset=whole]', b => b.getAttribute('aria-pressed'));
    check(!w.loop && w.preset === 'whole' && wp === 'true', 'Whole did not clear the Inspiral loop');
    return { gw150914: 'switches back from GW170817', whole: 'clears the Inspiral loop', strip: 'the stage strain scrubs like the roll (see the graph step)', render_sliders: 'seek (renders step)' };
  });

  await step('the six sections and the nav drawer open; the section links scroll to them', async () => {
    const secs = await page.$$eval('.sec', s => s.map(x => ({ id: x.id, h: x.querySelector('h2').textContent.trim(), vis: x.getBoundingClientRect().height > 80 && !x.closest('[hidden]') })));
    const want = ['How to play', 'The data', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits'];
    check(JSON.stringify(secs.map(s => s.h)) === JSON.stringify(want), 'sections ' + secs.map(s => s.h).join(' | '));
    check(secs.every(s => s.vis), 'a section is hidden or empty');
    for (const s of secs) {
      await page.click(`.toc a[href="#${s.id}"]`); await page.waitForTimeout(600);
      const top = await page.$eval('#' + s.id, e => e.getBoundingClientRect().top);
      check(Math.abs(top) < 200, `section link #${s.id} left it at ${top}px`);
    }
    const rows = await page.$$eval('#jobs tr', r => r.length); check(rows === JOBS.length, `jobs table ${rows} rows, jobs.csv ${JOBS.length}`);
    const btns = await page.$$('#jobs button'); check(btns.length === DONE.length, 'Show on the roll buttons ' + btns.length);
    await btns[1].click(); await page.waitForTimeout(300); check((await S()).ri === 2, 'jobs-table button did not load reach 0.5');
    const det = await page.$('.wtnr-nav details'); check(det, 'nav drawer missing');
    await page.click('.wtnr-nav summary'); await page.waitForTimeout(200);
    const open = await det.evaluate(d => d.open), items = await page.$$eval('.wtnr-nav ol a', a => a.length);
    check(open && items === Object.keys(urls).length, `nav drawer open ${open}, ${items} items`);
    return { sections: want, jobs_rows: rows, nav_items: items };
  });

  await step('the prev / hub / next nav links point at the neighbours and the hub', async () => {
    const nav = await page.$eval('.wtnr-nav', n => ({ prev: n.querySelector('a[rel=prev]').href, next: n.querySelector('a[rel=next]').href, hub: n.querySelector('a.wn-hub').href,
      prevT: n.querySelector('a[rel=prev]').textContent, nextT: n.querySelector('a[rel=next]').textContent, cur: (n.querySelector('[aria-current=page]') || {}).href }));
    check(nav.prev === urls['11-maxwells-ribbon'] && nav.next === urls['13-moth-to-flame'] && nav.hub === HUB, JSON.stringify(nav));
    check(nav.cur === urls['12-chirp-instrument'], 'current piece link ' + nav.cur);
    const foot = await page.$eval('.wtnr-nav', n => n.nextElementSibling && n.nextElementSibling.className); check(foot === 'wtnr-foot', 'nav is not just before the footer');
    return nav;
  });

  let hash = '';
  await step('share link: a custom view goes into the hash, and a reload restores it', async () => {
    await page.click('#g-event button[data-i="0"]');
    await page.$eval('#reach', e => { e.value = 2; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.$eval('#speed', e => { e.value = 1.5; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#v-0');
    await page.click('[data-preset=merger]'); await page.waitForTimeout(150);
    const before = await S();
    await page.click('#share'); await page.waitForTimeout(300);
    hash = await E(() => location.hash);
    check(/^#e0_r2_s0_v150_m2_l[\d.]+-[\d.]+$/.test(hash), 'hash ' + hash);
    check(/Link copied|address bar/.test(await toastText()), 'no copy toast');
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('pageerror(reload): ' + e.message));
    await p2.goto(base + hash, { waitUntil: 'networkidle' }); await p2.waitForTimeout(800);
    const after = await p2.evaluate(() => ({ ev: st.ev, ri: st.ri, speed: st.speed, voices: [...st.voices], loop: st.loop, loopA: st.loopA, loopB: st.loopB,
      speedUI: document.getElementById('speed-val').textContent, reachUI: document.getElementById('reach-val').textContent, v0: document.getElementById('v-0').getAttribute('aria-pressed') }));
    await p2.close();
    check(after.ev === 0 && after.ri === 2 && after.speed === 1.5 && after.voices[0] === false && after.voices[1] === true && after.loop
      && Math.abs(after.loopA - before.loopA) < 0.01 && Math.abs(after.loopB - before.loopB) < 0.01, 'restored ' + JSON.stringify(after));
    check(after.speedUI.startsWith('1.50') && after.v0 === 'false', 'restored controls do not show the state ' + JSON.stringify(after));
    return { hash, restored: after };
  });

  await step('numbers on the page match piece.json, out/jobs.csv and the engine cache', async () => {
    await page.goto(base, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    const proof = await text('#proof'), body = await E(() => document.body.innerText);
    check(proof.includes(`${piece.qubits} qubits`), 'proof qubits: ' + proof);
    check(new RegExp(`\\b${piece.jobs} completed Atlas jobs`).test(proof), 'proof jobs: ' + proof);
    check(piece.jobs === DONE.length, `piece.json jobs ${piece.jobs} vs jobs.csv ${DONE.length}`);
    const failedIds = JOBS.flatMap(j => j.failed_job_ids.split(/\s+/).filter(Boolean));
    check(piece.credits_spent === DONE.length + failedIds.length, `credits ${piece.credits_spent} vs ${DONE.length}+${failedIds.length}`);
    const sum = await text('#jobs-sum'); check(sum.startsWith(`${DONE.length} completed · ${failedIds.length} failed attempts`), 'jobs summary ' + sum);
    for (const j of DONE) { check(body.includes(j.job_id), 'job id missing on page ' + j.job_id); check(cacheText.includes(j.job_id), 'job id not in cache ' + j.job_id); }
    for (const id of failedIds) check(body.includes(id), 'failed job id missing on page ' + id);
    check(/simulator/i.test(body) && !/\bQPU run\b|on quantum hardware\b(?! was)/i.test(proof), 'backend wording');
    const reg = await text('#r-reg'); check(reg.includes('20'), 'register readout ' + reg);
    return { proof, jobs: DONE.map(j => j.job_id), failed_attempts: failedIds.length, credits: piece.credits_spent, register: reg };
  });

  await step('no console errors, failed requests or page errors', async () => { check(errors.length === 0, errors.join(' | ')); return { errors: 0, media_range_requests_cancelled_by_seek_or_stop: aborted }; });

  console.log(JSON.stringify({ ok: !failed, steps }, null, 1));
  fs.writeFileSync(path.join(__dirname, 'e2e.json'), JSON.stringify({ ok: !failed, steps }, null, 1));
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
