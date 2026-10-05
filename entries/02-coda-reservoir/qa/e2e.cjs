// End-to-end journey for 02 Coda Reservoir: node entries/02-coda-reservoir/qa/e2e.cjs [port 6240-6249]
// Serves web/ locally (with HTTP Range support, like a static host, so the <audio> element can seek), then walks
// the main journey in headless Chromium with real assertions: no autoplay, the brand bar and prev / hub / next nav,
// proof chips against piece.json, play / pause the instrument (sound counted by instrumenting Web Audio, as
// common/qa/qa_page.cjs does), hearing the reservoir take over in the handoff, every track picker against the job
// IDs in PARAMS.md, tapping whales and open water in the scene, the sea and every restored graph drawn (non-empty canvases), The data section (always visible, its own Play, timeline tap
// and drag, the histogram readout), every titled section and the Challenge 02 brand bar, the drawers, the jobs
// table's Listen buttons, the share link restored on reload and on a pasted hash, and the submitted-WAV
// player (play, one-sound-at-a-time, seek, stop). Writes qa/e2e.json; exits 1 on the first failed assertion.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);

const HERE = path.resolve(__dirname, '..'), web = path.join(HERE, 'web');
const port = +(process.argv[2] || 6240);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const ROOT = path.resolve(HERE, '..', '..');
const urls = JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'urls.json'), 'utf8'));
const piece = JSON.parse(fs.readFileSync(path.join(HERE, 'piece.json'), 'utf8'));
// job IDs straight from PARAMS.md: generation rows are "| key | variation | seed | length | warm-up | `id` |"
const params = fs.readFileSync(path.join(HERE, 'PARAMS.md'), 'utf8');
const JOB = {};
for (const m of params.matchAll(/^\| (var_[0-9.]+(?:_s2)?|handoff) \|.*`([0-9a-f-]{36})` \|$/gm)) JOB[m[1]] = m[2];
JOB.train = /\| job_id \| `([0-9a-f-]{36})` \|/.exec(params)[1];

const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || '');
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], size - 1) : size - 1;
    r.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' });
    return fs.createReadStream(f, { start: a, end: b }).pipe(r);
  }
  r.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(r);
});

const INSTRUMENT = () => {
  window.__qa = { sources: 0, media: 0, ctxs: [] };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const W = function (...a) { const c = new AC(...a); window.__qa.ctxs.push(c); return c; };
    W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W;
    // AudioBufferSourceNode has its own start() (with offset / duration) that shadows the base class one in
    // Chromium, so wrap every source class that owns a start()
    for (const C of [window.AudioScheduledSourceNode, window.AudioBufferSourceNode, window.OscillatorNode, window.ConstantSourceNode]) {
      if (!C || !Object.prototype.hasOwnProperty.call(C.prototype, 'start')) continue;
      const st = C.prototype.start;
      C.prototype.start = function (...a) { window.__qa.sources++; return st.apply(this, a); };
    }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
};

const steps = [], out = { piece: piece.slug, port, ok: false, steps };
function check(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }
async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); steps.push({ step: name, ok: true, ms: Date.now() - t0 }); console.log('ok   ' + name); }
  catch (e) { steps.push({ step: name, ok: false, error: String(e.message || e).slice(0, 400) }); console.log('FAIL ' + name + '\n     ' + e.message); throw e; }
}

(async () => {
  await new Promise(r => srv.listen(port, r));
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` }); } catch (e) {}
  const p = await ctx.newPage();
  const errors = [], failed = [], mp3 = [];
  p.on('pageerror', e => errors.push(String(e.message || e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  p.on('request', r => { if (r.url().endsWith('.mp3')) mp3.push(r.url()); });
  await p.addInitScript(INSTRUMENT);
  const base = `http://127.0.0.1:${port}/index.html`;
  const text = sel => p.$eval(sel, e => e.textContent.trim());
  const pressed = sel => p.$eval(sel, e => e.getAttribute('aria-pressed'));
  const clock = async (sel = '#clock') => parseFloat((await text(sel)).split('/')[0]);
  const qa = () => p.evaluate(() => ({ sources: window.__qa.sources, media: window.__qa.media, running: window.__qa.ctxs.some(c => c.state === 'running') }));
  const setRange = (sel, v) => p.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const visible = sel => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.width > 0 && r.height > 0; });
  // how much of a canvas is drawn: its size, the share of pixels that differ from the corner (background) pixel,
  // and how many distinct colours appear (sampled on a grid, so it stays fast on big canvases)
  const ink = sel => p.$eval(sel, c => {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, bg = d.slice(0, 4).join();
    let drawn = 0, n = 0; const cols = new Set();
    const step = Math.max(1, Math.floor(Math.sqrt(c.width * c.height / 40000)));
    for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
      const i = (y * c.width + x) * 4, k = d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ',' + d[i + 3];
      n++; if (k !== bg) drawn++; if (cols.size < 64) cols.add(k);
    }
    return { w: c.width, h: c.height, drawn: drawn / n, colours: cols.size, url: c.toDataURL().length };
  });
  const snap = sel => p.$eval(sel, c => c.toDataURL());

  try {
    await step('load: page renders and nothing sounds or loads audio before a click', async () => {
      await p.goto(base, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      const q = await qa();
      check(q.sources === 0 && q.media === 0, 'autoplay: ' + JSON.stringify(q));
      check(mp3.length === 0, 'the MP3 was requested before Play: ' + mp3.join(', '));
      check((await p.title()) === 'Coda Reservoir', 'title');
      check(/Press play/.test(await text('#now')), 'idle prompt');
    });

    await step('graphs: the sea and every restored graph render (non-empty canvases)', async () => {
      const G = { '#scene': 'the sea', '#tl': 'click timeline (G1)', '#hist': 'token histogram (G2)', '#wavstrip': 'submitted-WAV click strip (G3)' };
      out.graphs = {};
      for (const [sel, name] of Object.entries(G)) {
        await p.$eval(sel, e => e.scrollIntoView({ block: 'center' }));
        await p.waitForTimeout(150);
        check(await visible(sel), name + ' is visible');
        const m = await ink(sel); out.graphs[sel] = m;
        check(m.w > 100 && m.h > 40, `${name} has a real size: ${m.w}x${m.h}`);
        check(m.drawn > 0.01 && m.colours >= 3, `${name} is drawn, not blank: ${JSON.stringify(m)}`);
      }
      check(await p.$$eval('#metrics tr', r => r.length) === 17, 'comparison table (T1) has its header and 16 rows');
      check(/Real corpus/.test(await text('#data .legend')), 'histogram legend (E13) is there');
      check((await text('#stats')).length > 20, 'live stats (E14) have text: ' + (await text('#stats')));
      await p.evaluate(() => scrollTo(0, 0));
    });

    await step('connect: brand bar to the hub, prev / hub / next nav and the jump list', async () => {
      check((await p.$eval('.wtnr-bar a', a => a.href)) === HUB, 'brand bar link is the hub');
      const nav = await p.$eval('nav.wtnr-nav', n => ({
        prev: n.querySelector('a[rel=prev]').href, next: n.querySelector('a[rel=next]').href, hub: n.querySelector('a.wn-hub').href,
        prevT: n.querySelector('a[rel=prev]').textContent, nextT: n.querySelector('a[rel=next]').textContent,
        items: n.querySelectorAll('ol a').length, cur: (n.querySelector('ol a[aria-current=page]') || {}).href }));
      check(nav.prev === urls['01-penrose-hole'] && /01/.test(nav.prevT), 'prev -> 01: ' + nav.prev);
      check(nav.next === urls['03-moth-eye'] && /03/.test(nav.nextT), 'next -> 03: ' + nav.next);
      check(nav.hub === HUB, 'hub button');
      check(nav.items === Object.keys(urls).length, `jump list has ${nav.items} pieces`);
      check(nav.cur === urls['02-coda-reservoir'], 'this piece is marked current in the jump list');
      await p.click('nav.wtnr-nav summary');
      check(await p.$eval('nav.wtnr-nav details', d => d.open), 'jump list opens');
      check(await p.isVisible('nav.wtnr-nav ol a[rel], nav.wtnr-nav ol a') , 'jump list links visible');
      check(await p.$eval('.wtnr-foot', e => /independent entry/.test(e.textContent)), 'footer disclaimer');
    });

    await step('data: proof chips and readout match piece.json and PARAMS.md', async () => {
      const proof = await text('#proof');
      check(proof.includes(`${piece.qubits} qubits`), 'qubits chip: ' + proof);
      check(proof.includes(`${piece.jobs} real Atlas jobs`), 'jobs chip: ' + proof);
      check(/simulator/.test(proof) && piece.hardware === null, 'simulator chip, no hardware');
      check(Object.keys(JOB).length === 14, 'PARAMS.md lists 14 jobs, got ' + Object.keys(JOB).length);
      check((await text('#r-job')).startsWith(JOB.handoff), 'default track shows the handoff job');
      check(/12 reservoir qubits/.test(await text('#r-qubits')), 'qubit readout');
      check(/simulator/.test(await text('#r-where')), 'ran-on readout');
      check((await text('#d-loss')).includes(JOB.train), 'training drawer names the training job');
    });

    await step('instrument: Play starts real clicks, the clock runs, Pause stops it', async () => {
      await p.click('#play');
      await p.waitForFunction(() => parseFloat(document.getElementById('clock').textContent) > 1.0, null, { timeout: 8000 });
      const q = await qa();
      check(q.sources > 0 && q.running, 'Web Audio clicks started: ' + JSON.stringify(q));
      check((await text('#play-txt')) === 'Pause', 'play button turns into Pause');
      await p.click('#play');
      const c0 = await clock(); await p.waitForTimeout(600);
      check(Math.abs((await clock()) - c0) < 0.05, 'clock stops on pause');
      check((await text('#play-txt')) === 'Play', 'button back to Play');
    });

    await step('outcome: in the handoff, the reservoir takes over at the real split time', async () => {
      await setRange('#seek', 37.5);
      check(Math.abs((await clock()) - 37.5) < 0.05, 'position slider moved the clock');
      const s0 = (await qa()).sources;
      await p.click('#play');
      await p.waitForFunction(() => parseFloat(document.getElementById('clock').textContent) > 39.3, null, { timeout: 8000 });
      await p.waitForFunction(() => /Reservoir/.test(document.getElementById('now').textContent), null, { timeout: 4000 });
      check(/token prototype/.test(await text('#now')), 'reservoir coda is labelled as played from the token prototype');
      check((await qa()).sources > s0, 'reservoir clicks sounded');
      await p.click('#play');
      await p.click('#restart');
      check((await clock()) === 0, 'Back to start');
      await p.click('[data-speed="0.5"]');
      check((await pressed('[data-speed="0.5"]')) === 'true', 'half speed selected');
      await p.click('[data-speed="1"]');
    });

    await step('pickers: every track control loads the right job (PARAMS.md)', async () => {
      await p.click('[data-mode="res"]');
      check(await visible('#row-var') && await visible('#row-take') && !(await visible('#row-whale')), 'reservoir rows shown');
      check((await text('#r-job')) === JOB['var_1.0'], 'variation 1 take 1');
      for (const v of ['0.25', '0.5', '1', '2', '4', '16', '64']) {
        await p.click(`[data-var="${v}"]`);
        const k1 = 'var_' + (Number.isInteger(+v) ? (+v).toFixed(1) : v);     // PARAMS.md keys: var_0.25, var_1.0, ...
        check(JOB[k1] && (await text('#r-job')) === JOB[k1], `variation ${v}: ${await text('#r-job')} vs ${JOB[k1]}`);
        const t2 = await p.$eval('[data-take="2"]', b => b.disabled);
        check(t2 === (+v > 4), `take 2 ${+v > 4 ? 'disabled' : 'enabled'} at variation ${v}`);
        if (!t2) {
          await p.click('[data-take="2"]');
          check((await text('#r-job')) === JOB[k1 + '_s2'], `variation ${v} take 2`);
          await p.click('[data-take="1"]');
        }
      }
      await p.click('[data-mode="real"]');
      check(await visible('#row-whale') && !(await visible('#row-var')), 'whale row shown for real codas');
      check((await text('#r-job')) === '\u2013' && /your browser/.test(await text('#r-where')), 'real codas are labelled as recorded data');
      for (const w of ['1', '2', '3', '4']) {
        await p.click(`[data-whale="${w}"]`);
        check(new RegExp('caller label ' + w).test(await text('#r-track')), 'whale ' + w);
      }
      await p.click('[data-whale="all"]');
      check(/all whales/.test(await text('#r-track')), 'all whales');
      await p.click('[data-mode="handoff"]');
      check((await text('#r-job')).startsWith(JOB.handoff), 'back to the handoff');
    });

    await step('scene: tapping a whale plays only that caller; open water plays or pauses; keys pick the reservoir', async () => {
      check(await visible('#scene'), 'scene is the default view');
      const b = await (await p.$('#scene')).boundingBox(), s0 = (await qa()).sources;
      await p.mouse.click(b.x + b.width * 0.20, b.y + b.height * 0.63);      // whale 3 in the wide layout
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Pause', null, { timeout: 4000 });
      check((await pressed('[data-mode="real"]')) === 'true' && (await pressed('[data-whale="3"]')) === 'true', 'whale 3 selected');
      await p.waitForFunction(n => window.__qa.sources > n, s0, { timeout: 8000 });
      await p.click('#play');                                                    // pause, then tap open water
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Play', null, { timeout: 3000 });
      const w = await (await p.$('#scene')).boundingBox();
      await p.mouse.click(w.x + w.width * 0.50, w.y + w.height * 0.47);      // open water between whales 1, 2 and 4
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Pause', null, { timeout: 3000 });
      check((await pressed('[data-whale="3"]')) === 'true', 'open water plays the same track, it does not change it');
      await p.mouse.click(w.x + w.width * 0.50, w.y + w.height * 0.47);
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Play', null, { timeout: 3000 });
      check(/open water to play or pause/.test(await text('#tip')), 'the sea hint says what open water does');
      await p.focus('#scene'); await p.keyboard.press('r');
      check((await pressed('[data-mode="res"]')) === 'true', 'R picks the reservoir');
      await p.keyboard.press('h');
      check((await pressed('[data-mode="handoff"]')) === 'true', 'H picks the submitted track');
      await p.keyboard.press('Space');
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Play', null, { timeout: 3000 });
    });

    await step('data: the timeline and histogram sit in a visible titled section, live with the instrument', async () => {
      check(await visible('#scene') && await visible('#tl') && await visible('#hist'), 'scene, timeline and histogram all visible at once (no toggle)');
      check((await p.$$('[data-view]')).length === 0, 'the old Scene / Data toggle is gone');
      check(/The data/.test(await text('#h-data')) && /Click timeline/.test(await text('#h-tl')) && /Token histogram/.test(await text('#h-hist')), 'section and figure titles');
      check(await p.$$eval('#data figcaption', f => f.length) === 2, 'both graphs carry a caption');
      check((await text('#d-track')) === (await text('#r-track')), 'The data names the same track as the readout');
      await p.$eval('#play2', e => e.scrollIntoView({ block: 'center' }));
      const tl0 = await snap('#tl'), hi0 = await snap('#hist');
      await p.click('#play2');
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Pause' && document.getElementById('play2-txt').textContent === 'Pause', null, { timeout: 4000 });
      await p.waitForTimeout(700);
      check(await p.evaluate(() => document.getElementById('clock2').textContent === document.getElementById('clock').textContent), 'the stage and The data show one clock');
      check(parseFloat(await text('#clock2')) > 0, 'The data clock runs');
      check((await snap('#tl')) !== tl0, 'the click timeline redraws as the track plays');
      check((await snap('#hist')) !== hi0, 'the token histogram fills as the track plays');
      await p.click('#play2');
      check((await text('#play-txt')) === 'Play' && (await text('#play2-txt')) === 'Play', 'one pause stops both');
    });

    await step('view: timeline tap and drag, histogram readout', async () => {
      await p.click('#restart');
      await p.$eval('#tl', e => e.scrollIntoView({ block: 'center' }));
      let tb = await (await p.$('#tl')).boundingBox();
      await p.mouse.click(tb.x + tb.width * 0.92, tb.y + tb.height * 0.5);    // tap right of the playhead: jump ahead
      const c1 = await clock();
      check(c1 > 1 && c1 < 6, 'tap jumped ahead to ' + c1);
      await p.mouse.move(tb.x + tb.width * 0.7, tb.y + tb.height * 0.4); await p.mouse.down();
      await p.mouse.move(tb.x + tb.width * 0.3, tb.y + tb.height * 0.4, { steps: 8 }); await p.mouse.up();
      check((await clock()) > c1 + 2, 'drag left scrubbed forward');
      await p.click('#restart');
      await p.$eval('#tl', e => e.scrollIntoView({ block: 'center' }));
      tb = await (await p.$('#tl')).boundingBox();
      await p.mouse.move(tb.x + tb.width * 0.4, tb.y + tb.height * 0.4); await p.mouse.down();
      await p.mouse.move(tb.x + tb.width * 0.6, tb.y + tb.height * 0.4, { steps: 6 }); await p.mouse.up();
      check(/Start of the track/.test(await text('#toast')), 'dragging back past 0 s says so');
      await p.$eval('#hist', e => e.scrollIntoView({ block: 'center' }));
      const hb = await (await p.$('#hist')).boundingBox();
      await p.mouse.click(hb.x + 8 + (hb.width - 16) / 30 * 0.5, hb.y + hb.height * 0.3);   // the first bar: the commonest token
      const pick = await text('#hist-pick');
      check(/^Token 5A/.test(pick) && /2,047 of 3,840 codas/.test(pick), 'first bar reads 5A from the corpus: ' + pick);
      await p.focus('#hist'); await p.keyboard.press('ArrowRight');
      check(!/^Token 5A /.test(await text('#hist-pick')), 'arrow key moves to the next token');
      await p.keyboard.press('Escape');
      check(/Tap a bar/.test(await text('#hist-pick')), 'Escape clears the readout');
    });

    await step('sections: every titled section is on the page, with its earlier words', async () => {
      const h2 = await p.$$eval('section h2', e => e.map(x => x.textContent.trim()));
      for (const t of ['How to play', 'The data', 'The submitted audio', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits'])
        check(h2.includes(t), 'section "' + t + '" in ' + JSON.stringify(h2));
      check(/Clicks light up on the timeline as they sound\./.test(await text('#how-to-play')), 'step 3 keeps its earlier sentence');
      check(/Why sperm-whale codas\?/.test(await text('#science')) && /simple, reproducible stand-in/.test(await text('#science')), 'the science is visible');
      check(/Nothing here translates, decodes or speaks whale\./.test(await text('#claims')), 'the claims section is visible');
      const bar = await text('.wtnr-bar .count');
      check(/^Challenge 02$/.test(bar) && !/bonus|\/ ?11/i.test(bar), 'brand bar reads Challenge 02: ' + bar);
      check(!/\bbonus\b|main entry/i.test(await p.evaluate(() => document.body.innerText)), 'no Bonus / Main entry wording anywhere');
    });

    await step('science: every drawer opens with real content', async () => {
      const n = await p.$$eval('details.drawer', d => d.length);
      check(n === 2, n + ' drawers');
      for (let i = 0; i < n; i++) {
        const s = (await p.$$('details.drawer summary'))[i];
        await s.click();
        const st = await p.$$eval('details.drawer', (d, i) => ({ open: d[i].open, len: d[i].querySelector('.body').innerText.length }), i);
        check(st.open && st.len > 120, 'drawer ' + i + ' ' + JSON.stringify(st));
      }
      check(await p.$$eval('#metrics tr', r => r.length) === 17, 'metrics table: header + 16 rows (PARAMS.md comparison table)');
      check(await visible('#metrics'), 'the numbers table is visible, not behind a drawer');
    });

    await step('jobs: the jobs table lists all 14 Atlas jobs from PARAMS.md and Listen plays each one', async () => {
      const ids = await p.$$eval('#jobs-t code', c => c.map(x => x.textContent.trim()));
      check(ids.length === 14, ids.length + ' job IDs');
      for (const [k, id] of Object.entries(JOB)) check(ids.includes(id), 'job ' + k + ' listed');
      check(/14 Atlas jobs/.test(await text('#jobs-n')) && /18 credits/.test(await text('#jobs-spend')), 'job count and spend');
      check(await p.$$eval('[data-listen]', b => b.length) === 13, '13 Listen buttons (every generation job)');
      const s0 = (await qa()).sources;
      await p.click('[data-listen="var_16"]');
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Pause', null, { timeout: 4000 });
      check((await text('#r-job')) === JOB['var_16.0'] && (await pressed('[data-var="16"]')) === 'true', 'Listen loaded variation 16');
      await p.waitForFunction(n => window.__qa.sources > n, s0, { timeout: 8000 });
      await p.click('#play');
      await p.click('[data-listen="handoff"]');
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Pause', null, { timeout: 4000 });
      check((await text('#r-job')).startsWith(JOB.handoff) && (await pressed('[data-mode="handoff"]')) === 'true', 'Listen loaded the handoff');
      await p.click('#play');
      await p.click('#restart');
    });

    await step('share: copy link to this moment, reload with the hash, state restored', async () => {
      await p.click('[data-mode="res"]'); await p.click('[data-var="16"]');
      await setRange('#seek', 30);
      await p.click('#share');
      const hash = await p.evaluate(() => location.hash);
      check(hash === '#res-v16-k1-t30.0', 'hash ' + hash);
      const toastTxt = await text('#toast'), clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => null));
      out.share = { hash, toast: toastTxt, clipboard: clip };
      if (toastTxt === 'Link copied') check(clip === null || clip.endsWith(hash), 'clipboard holds the link: ' + clip);
      else check(/address bar/.test(toastTxt), 'copy failure says where the link is: ' + toastTxt);
      await p.reload({ waitUntil: 'networkidle' });
      check((await pressed('[data-mode="res"]')) === 'true' && (await pressed('[data-var="16"]')) === 'true', 'track restored');
      check(Math.abs((await clock()) - 30) < 0.05, 'position restored');
      check((await text('#r-job')) === JOB['var_16.0'], 'job restored');
      check((await qa()).sources === 0, 'reload with a hash still does not autoplay');
      await p.evaluate(() => { location.hash = 'real-w4-t12.0'; });
      await p.waitForFunction(() => document.querySelector('[data-whale="4"]').getAttribute('aria-pressed') === 'true', null, { timeout: 3000 });
      check(Math.abs((await clock()) - 12) < 0.05, 'a pasted hash applies without reload');
    });

    await step('submitted WAV: play, one sound at a time, seek, stop', async () => {
      await p.$eval('#wav-play', e => e.scrollIntoView({ block: 'center' }));
      await p.click('#wav-play');
      await p.waitForFunction(() => window.__qa.media > 0 && !document.getElementById('wav').paused, null, { timeout: 8000 });
      await p.waitForFunction(() => document.getElementById('wav').currentTime > 0.5, null, { timeout: 8000 });
      check(mp3.length > 0, 'MP3 requested only now');
      check((await text('#wav-txt')) === 'Pause the WAV', 'WAV button turns into Pause the WAV');
      await p.click('#play');                                                  // the instrument takes over
      await p.waitForFunction(() => document.getElementById('wav').paused, null, { timeout: 3000 });
      check((await text('#wav-txt')) === 'Resume the WAV', 'WAV paused when the instrument plays');
      await p.click('#wav-play');                                              // and the WAV takes it back
      await p.waitForFunction(() => document.getElementById('play-txt').textContent === 'Play' && !document.getElementById('wav').paused, null, { timeout: 4000 });
      const sb = await (await p.$('#wavstrip')).boundingBox();
      await p.mouse.click(sb.x + 8 + (sb.width - 16) * 0.5, sb.y + sb.height / 2);
      await p.waitForFunction(() => Math.abs(document.getElementById('wav').currentTime - 42) < 1.5, null, { timeout: 4000 });
      await p.click('#wav-play');                                              // pause
      await p.focus('#wav-seek'); await p.keyboard.press('Home');
      await p.waitForFunction(() => document.getElementById('wav').currentTime < 0.2, null, { timeout: 3000 });
      for (let i = 0; i < 5; i++) await p.keyboard.press('PageUp');
      await p.waitForFunction(() => document.getElementById('wav').currentTime > 1, null, { timeout: 3000 });
      check((await clock('#wav-clock')) > 1, 'the WAV slider moves the clock');
      await p.click('#wav-stop');
      check(await p.$eval('#wav', a => a.paused && a.currentTime === 0), 'Stop rewinds');
      check((await text('#wav-txt')) === 'Play the WAV', 'label back to Play the WAV');
    });

    await step('clean: no page errors, no failed requests', async () => {
      check(errors.length === 0, 'errors: ' + errors.slice(0, 3).join(' | '));
      check(failed.length === 0, 'failed: ' + failed.slice(0, 3).join(' | '));
    });
    out.ok = true;
  } catch (e) {
    out.error = String(e.message || e).slice(0, 400);
    try { await p.screenshot({ path: path.join(__dirname, 'e2e-fail.png') }); } catch (err) {}
  }
  out.errors = errors.slice(0, 10);
  fs.writeFileSync(path.join(__dirname, 'e2e.json'), JSON.stringify(out, null, 1));
  console.log(out.ok ? `e2e ok: ${steps.length} steps` : 'e2e FAILED');
  await browser.close(); srv.close();
  process.exit(out.ok ? 0 : 1);
})();
