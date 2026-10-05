// End-to-end journey for LIGO Night Shift: node entries/10-squeezed-chirp/qa/e2e.cjs [port]
// Serves web/ locally and plays a real round in headless Chromium: turn the dial, START (3-2-1), hit MERGER! at
// the chirp peak by the audio clock, set the pitch, lock, check the score, the alert, the saved best and an
// achievement, replay with sound, reset, the scrubbable source view, the plate keys, every restored graph (non-empty
// canvases and SVGs), the data room (play/stop a WAV, share link with the full view state, reload from the hash),
// every drawer and section link, the media files and the prev / hub / next nav. Exits 1 on the first failed assertion.
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require(String.raw`C:\Users\Rahma\OneDrive\Desktop\MOTH QUANTUM\common\qa\node_modules\playwright`);
const web = path.join(__dirname, '..', 'web');
const port = +(process.argv[2] || 6210);
const HUB = 'https://claude.ai/artifact/UTchAtGeAarh4D9Sw57UWa';
const URLS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'site', 'urls.json'), 'utf8'));
const T = {'.html': 'text/html; charset=utf-8', '.wav': 'audio/wav', '.png': 'image/png', '.json': 'application/json'};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]), f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res);
});
const INIT = () => { window.__snd = 0; document.addEventListener('playing', e => { if (!e.target.muted) window.__snd++; }, true); };
const steps = [];
const step = (m) => { steps.push(m); console.log('  ok  ' + m); };

(async () => {
  await new Promise(r => server.listen(port, r));
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.addInitScript(INIT);
  try {
    await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    assert.strictEqual(await p.evaluate(() => window.__snd), 0, 'nothing plays on load'); step('loads silent, no errors');
    assert.strictEqual(await p.getAttribute('.wtnr-bar a', 'href'), HUB); step('brand bar links to the hub');

    // every graph on the page renders: canvases have real pixels, SVG charts have their marks
    const cvs = await p.evaluate(() => ['#spec', '#lens', '#cv', '#pt', '#pf', '#six .pan canvas'].map(sel => [...document.querySelectorAll(sel)].map(c => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, set = new Set(); let ink = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (d[i] < 200) ink++; }
      return {sel, w: c.width, h: c.height, colors: set.size, ink};
    })).flat());
    assert.strictEqual(cvs.length, 11, 'eleven canvases');
    for (const c of cvs) assert.ok(c.w > 0 && c.h > 0 && c.colors >= 8 && c.ink > 50, `canvas ${c.sel} is drawn (${c.colors} colours, ${c.ink} ink px)`);
    step('canvases drawn: game spectrogram, source view, data-room spectrogram, both profiles, the six hero panels');
    const svgs = await p.evaluate(() => Object.fromEntries(['#dial', '#ellip', '#tms', '#ell', '#trade', '#wr-t', '#wr-f', '#site', '#plan', '#sect', '#optics', '#quad'].map(s => [s, document.querySelectorAll(s + ' *').length])));
    for (const [k, n] of Object.entries(svgs)) assert.ok(n >= 4, `${k} has ${n} marks`);
    assert.strictEqual(await p.locator('#trade .pt').count(), 5); assert.strictEqual(await p.locator('#wr-t .pt').count(), 5); assert.strictEqual(await p.locator('#wr-f .pt').count(), 5);
    assert.strictEqual(await p.locator('#six .pan').count(), 6); assert.strictEqual(await p.locator('#ell ellipse').count(), 1);
    step('SVG graphs drawn: dial, squeeze ellipse, test masses, ridge spread, trade chart, both widths-vs-ratio charts, three plates');
    assert.strictEqual(await p.locator('#jobs-b tr').count(), 8); assert.strictEqual(await p.locator('#jobs-b tr.fail').count(), 2);
    assert.match(await p.textContent('#jobs-sum'), /6 completed · 2 failed · 8 credits/); step('job table lists all eight paid jobs (6 completed, 2 failed)');
    assert.ok(await p.isDisabled('#stop')); step('Stop is disabled while nothing plays');

    // 1. set the squeezer: keyboard on the dial, then a click on a detent
    await p.focus('#dial'); await p.keyboard.press('ArrowRight');
    assert.match(await p.textContent('#setline'), /r = 2/); step('dial: arrow key turns to r = 2');
    await p.click('#dial .det[data-i="0"]'); assert.match(await p.textContent('#setline'), /r = 1\/4/);
    assert.match(await p.textContent('#setcap'), /timing 934 · pitch 765/); step('dial: detent click picks r = 1/4; caps 934 / 765 shown');
    await p.click('#dial .det[data-i="2"]'); assert.match(await p.textContent('#setline'), /r = 1 /); step('back to r = 1');

    // 2. listen: the count, then the real audio; the dial locks
    await p.click('#start');
    assert.strictEqual(await p.textContent('#phase-name'), 'get ready'); step('START RUN counts 3-2-1');
    await p.waitForFunction(() => document.getElementById('phase-name').textContent === 'listening', null, { timeout: 4000 });
    // 3. timing: press MERGER! (inside the page, at the exact audio-clock moment of the true peak)
    const target = await p.evaluate(() => { const A = META.audio; return (META.peak.t - A.t0) / (A.t1 - A.t0); });
    await p.waitForFunction(f => { const a = [...document.querySelectorAll('audio')].find(x => !x.paused && x.duration);
      if (a && a.currentTime / a.duration >= f) { document.getElementById('merger').click(); return true; } return false; }, target, { timeout: 4000, polling: 'raf' });
    assert.match(await p.textContent('#merger-sub'), /logged at/); step('MERGER! logged at the peak by the audio clock');
    assert.ok(await p.evaluate(() => window.__snd > 0)); step('the real audio is playing');
    await p.focus('#dial'); await p.keyboard.press('ArrowRight');
    assert.match(await p.textContent('#setline'), /r = 1 /); step('the dial is locked during the run');

    // 4. pitch: the line starts at 200 Hz; move it to ~131 Hz with the keys and lock
    await p.waitForFunction(() => document.getElementById('phase-name').textContent === 'pitch', null, { timeout: 4000 });
    await p.focus('#spec'); for (let k = 0; k < 7; k++) await p.keyboard.press('Shift+ArrowDown');
    await p.keyboard.press('ArrowUp');
    await p.click('#lock'); await p.waitForTimeout(200);
    const tot = +(await p.textContent('#s-all')), tim = +(await p.textContent('#s-t')), pit = +(await p.textContent('#s-f'));
    assert.ok(tim > 780 && pit > 850 && tot === tim + pit, `scored ${tim} + ${pit} = ${tot}`); step(`scored timing ${tim}, pitch ${pit}, total ${tot}`);
    assert.ok(await p.isVisible('#alert')); assert.match(await p.textContent('#alert'), /Event candidate/); step('event-candidate alert card shown');
    const got = await p.evaluate(() => [...document.querySelectorAll('#ach li.got b')].map(b => b.textContent));
    assert.deepStrictEqual(got.sort(), ['First catch', 'Gold-plated', "Heisenberg's choice"].sort(), 'balanced r = 1 round unlocks ' + got);
    step("achievements: First catch, Heisenberg's choice, Gold-plated");
    const store = await p.evaluate(() => JSON.parse(localStorage.getItem('wtnr10-nightshift-v1')));
    assert.ok(store && store.best.r1 && store.best.r1.total === tot && store.ach.first, 'best saved'); step('best per setting and achievement saved locally');

    // replay plays again; next round; reset scores (double press)
    const s0 = await p.evaluate(() => window.__snd); await p.click('#replay'); await p.waitForTimeout(400);
    assert.ok(await p.evaluate(n => window.__snd > n, s0)); assert.match(await p.textContent('#spec-state'), /replay/); step('replay plays the real audio with the true peak shown');
    await p.click('#replay'); await p.click('#next'); assert.strictEqual(await p.textContent('#phase-name'), 'ready'); step('next round resets the deck');
    await p.click('#wipe'); assert.match(await p.textContent('#wipe'), /again/); await p.click('#wipe');
    assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('wtnr10-nightshift-v1')).rounds), 0); step('reset scores wipes after a second press');

    // pause and abort
    await p.click('#start'); await p.waitForFunction(() => document.getElementById('phase-name').textContent === 'listening', null, { timeout: 4000 });
    await p.click('#pause'); assert.strictEqual(await p.textContent('#phase-name'), 'paused');
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))); step('pause stops the sound');
    await p.click('#abort'); assert.strictEqual(await p.textContent('#phase-name'), 'ready'); step('abort returns to ready');

    // the source view scrubs between rounds
    const t0 = await p.textContent('#src-t'); const box = await p.locator('#lens').boundingBox();
    await p.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 5 }); await p.mouse.up();
    assert.notStrictEqual(await p.textContent('#src-t'), t0); assert.match(await p.textContent('#src-cap'), /62 suns/); step('drag scrubs the black holes to the merged hole');

    // plate keys find their parts
    await p.click('.key button[data-k="opt-14"]');
    assert.ok(await p.evaluate(() => document.querySelector('.co[data-part="opt-14"]').classList.contains('hl'))); step('plate key highlights its part');
    await p.locator('#site .co[data-part="site-1"] text').click();
    assert.strictEqual(await p.getAttribute('.key button[data-k="site-1"]', 'aria-pressed'), 'true'); step('a number on Plate I highlights its key');

    // the data room is a visible section under the game, and it follows the dial (and the dial follows it)
    await p.click('#to-data'); assert.ok(await p.isVisible('#dataroom')); assert.ok(await p.isVisible('#trade')); step('data room and its graphs are on the page');
    await p.focus('#dial'); await p.keyboard.press('ArrowRight');
    assert.match(await p.textContent('#r-val'), /^r = 2 /); step('turning the dial to r = 2 loads r = 2 in the data room');
    await p.click('#ticks button[aria-label="Select r = 1/2"]');
    assert.match(await p.textContent('#setline'), /r = 1\/2/); step('a slider stop in the data room turns the dial');
    await p.click('#six .pan[data-k="r4"]'); assert.match(await p.textContent('#setline'), /r = 4/);
    assert.strictEqual(await p.getAttribute('#six .pan[data-k="r4"]', 'aria-pressed'), 'true'); step('a hero-figure panel loads its grid and turns the dial');
    await p.click('#wr-f .pt[data-k="r0p25"]'); assert.match(await p.textContent('#r-val'), /^r = 1\/4 /); step('a point on the widths-vs-ratio chart selects it');
    await p.click('#jobs-b .jb[data-k="iso"]'); assert.match(await p.textContent('#setline'), /ISO control/);
    assert.strictEqual(await p.getAttribute('#jobs-b tr[data-k="iso"]', 'aria-current'), 'true'); step('a job-table row turns the dial to its job');
    await p.click('#trade .pt[data-k="r2"]'); assert.match(await p.textContent('#r-val'), /^r = 2 /); assert.match(await p.textContent('#setline'), /r = 2/); step('a point on the trade chart selects it and turns the dial');
    { await p.locator('#cv').scrollIntoViewIfNeeded(); const f0 = await p.textContent('#c-f'), t0 = await p.textContent('#c-t'), bx = await p.locator('#cv').boundingBox();
      await p.mouse.move(bx.x + bx.width * 0.7, bx.y + bx.height * 0.3); await p.mouse.down(); await p.mouse.move(bx.x + bx.width * 0.75, bx.y + bx.height * 0.35, { steps: 4 }); await p.mouse.up();
      assert.notStrictEqual(await p.textContent('#c-f'), f0); assert.notStrictEqual(await p.textContent('#c-t'), t0); step('dragging on the spectrogram moves both cuts'); }
    { await p.locator('#pt').scrollIntoViewIfNeeded(); const t0 = await p.textContent('#c-t'), bx = await p.locator('#pt').boundingBox();
      await p.mouse.click(bx.x + bx.width * 0.3, bx.y + bx.height * 0.5); assert.notStrictEqual(await p.textContent('#c-t'), t0);
      const f0 = await p.textContent('#c-f'), by = await p.locator('#pf').boundingBox(); await p.mouse.click(by.x + by.width * 0.6, by.y + by.height * 0.5);
      assert.notStrictEqual(await p.textContent('#c-f'), f0); step('clicking along a profile moves its cut'); }
    assert.match(await p.getAttribute('#ell', 'aria-label'), /Ridge spread/); assert.ok(await p.evaluate(() => document.querySelectorAll('#ell ellipse').length === 1)); step('ridge-spread glyph drawn');
    const s1 = await p.evaluate(() => window.__snd); await p.click('.pb[data-key="r4"]'); await p.waitForTimeout(400);
    assert.ok(await p.evaluate(n => window.__snd > n, s1)); assert.match(await p.textContent('#setline'), /r = 4/);
    assert.strictEqual(await p.getAttribute('.pb[data-key="r4"]', 'aria-pressed'), 'true'); assert.ok(await p.isEnabled('#stop'));
    await p.click('#stop');
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))); assert.ok(await p.isDisabled('#stop'));
    assert.strictEqual(await p.getAttribute('.pb[data-key="r4"]', 'aria-pressed'), 'false'); step('a WAV plays in the data room (the dial follows) and Stop stops it');
    // set a full view (Change, Full grid, ridge on, a moved cut), copy its link, reload from the hash
    await p.click('[data-mode="change"]'); await p.click('[data-zoom="full"]'); await p.click('#ridge');
    assert.match(await p.textContent('#ridge'), /Hide measured ridge/); assert.match(await p.textContent('#tag'), /minus original/); step('Change view, full grid and the measured ridge switch on');
    await p.focus('#cv'); for (let k = 0; k < 3; k++) await p.keyboard.press('Shift+ArrowLeft');
    const view0 = { cf: await p.textContent('#c-f'), ct: await p.textContent('#c-t') };
    await p.click('#share'); await p.waitForTimeout(100);
    const hash = await p.evaluate(() => location.hash); assert.match(hash, /^#r4_c_f_f\d+_t-?\d+_k_d$/); assert.match(await p.textContent('#toast'), /Link copied|Copy failed/); step('copy link writes the view token ' + hash);
    // a real reload in a fresh page (a goto to the same URL would only be a same-document hash change)
    await p.goto('about:blank'); assert.strictEqual(await p.evaluate(() => window.__snd), 0);
    await p.goto(`http://127.0.0.1:${port}/index.html${hash}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    assert.strictEqual(await p.evaluate(() => performance.getEntriesByType('navigation')[0].type), 'navigate');
    assert.ok(await p.isVisible('#dataroom')); assert.strictEqual(await p.getAttribute('#ticks button[aria-label="Select r = 4"]', 'aria-pressed'), 'true');
    assert.strictEqual(await p.getAttribute('[data-mode="change"]', 'aria-pressed'), 'true'); assert.strictEqual(await p.getAttribute('[data-zoom="full"]', 'aria-pressed'), 'true');
    assert.strictEqual(await p.getAttribute('#ridge', 'aria-pressed'), 'true');
    assert.strictEqual(await p.textContent('#c-f'), view0.cf); assert.strictEqual(await p.textContent('#c-t'), view0.ct);
    assert.ok(await p.evaluate(() => Math.abs(document.getElementById('data').getBoundingClientRect().top) < 40), 'reload scrolls to The data');
    assert.match(await p.textContent('#setline'), /r = 4/); step('share link restores r = 4, Change, Full grid, the ridge and both cuts, scrolled to The data, dial included');
    await p.click('#start'); await p.waitForFunction(() => document.getElementById('phase-name').textContent === 'listening', null, { timeout: 4000 });
    await p.click('.pb[data-key="r0p5"]'); await p.waitForTimeout(300);
    assert.strictEqual(await p.textContent('#phase-name'), 'ready'); assert.strictEqual(await p.getAttribute('.pb[data-key="r0p5"]', 'aria-pressed'), 'true');
    assert.match(await p.textContent('#setline'), /r = 1\/2/); step('playing a data-room version mid-run ends the run cleanly and turns the dial');
    await p.click('#stop'); assert.ok(await p.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused)));
    await p.click('#start'); await p.waitForFunction(() => document.getElementById('phase-name').textContent === 'listening', null, { timeout: 4000 });
    await p.click('#stop'); assert.strictEqual(await p.textContent('#phase-name'), 'ready');
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused))); step('Stop in the data room also stops a run');
    await p.click('#to-game'); assert.ok(await p.isVisible('#game')); step('back to the night shift');

    // every drawer opens and shows its text
    const nd = await p.locator('details.drawer').count(); assert.strictEqual(nd, 6, 'six drawers');
    for (let k = 0; k < nd; k++) { const d = p.locator('details.drawer').nth(k); await d.locator('summary').click(); assert.ok(await d.evaluate(e => e.open)); assert.ok(await d.locator('.body').isVisible()); }
    step('all six drawers open and show their text');
    const secs = await p.evaluate(() => [...document.querySelectorAll('section.sec > .ink-bar h2')].map(h => h.textContent));
    assert.deepStrictEqual(secs, ['How to play', 'The data', 'How it was made', 'The science', 'What this does not claim', 'Jobs and credits']); step('titled sections: ' + secs.join(', '));
    const toc = await p.evaluate(() => [...document.querySelectorAll('.toc a')].map(a => a.getAttribute('href')));
    assert.strictEqual(toc.length, 7);
    for (const h of toc) {
      await p.click(`.toc a[href="${h}"]`); await p.waitForTimeout(150);
      assert.ok(await p.evaluate(id => { const e = document.getElementById(id); return !!e && Math.abs(e.getBoundingClientRect().top) < 60; }, h.slice(1)), 'section link ' + h + ' lands on its section');
    }
    step('the seven section links each land on their section');
    // media and the notebook are served
    const codes = await p.evaluate(async () => Promise.all(['notebook.html', 'audio/original.wav', 'audio/r0p25.wav', 'audio/r0p5.wav', 'audio/r1.wav', 'audio/r2.wav', 'audio/r4.wav', 'img/mascot.png'].map(u => fetch(u).then(r => r.status))));
    assert.ok(codes.every(x => x === 200), 'media ' + codes); step('notebook, six WAVs and the mascot are served');
    // prev / hub / next and the jump list
    const nav = await p.evaluate(() => {
      const q = s => document.querySelector(s);
      if (!q('.wtnr-nav')) return null;
      return { prev: [q('.wtnr-nav a[rel="prev"]').href, q('.wtnr-nav a[rel="prev"]').textContent],
               next: [q('.wtnr-nav a[rel="next"]').href, q('.wtnr-nav a[rel="next"]').textContent],
               hub: q('.wtnr-nav a.wn-hub').href, all: document.querySelectorAll('.wtnr-nav ol a').length,
               cur: (q('.wtnr-nav ol a[aria-current="page"]') || {}).textContent };
    });
    assert.ok(nav, 'nav present');
    assert.strictEqual(nav.prev[0], URLS['09-syndrome-loom']); assert.match(nav.prev[1], /09 Syndrome Loom/);
    assert.strictEqual(nav.next[0], URLS['11-maxwells-ribbon']); assert.match(nav.next[1], /11 Maxwell/);
    assert.strictEqual(nav.hub, HUB); assert.strictEqual(nav.all, 22); assert.match(nav.cur, /10\s*Squeezed Chirp/);
    await p.click('.wtnr-nav summary'); assert.ok(await p.evaluate(() => document.querySelector('.wtnr-nav details').open));
    step("nav: prev 09 Syndrome Loom, the hub, next 11 Maxwell's Ribbon, and a jump list of all 22 pieces with this one marked");
    assert.deepStrictEqual(errors, []); step('no console errors');
    console.log(JSON.stringify({ ok: true, steps: steps.length }));
  } catch (e) {
    console.error('FAIL:', e.message); console.log(JSON.stringify({ ok: false, failed_after: steps[steps.length - 1] || null, errors }));
    process.exitCode = 1;
  } finally { await b.close(); server.close(); }
})();
