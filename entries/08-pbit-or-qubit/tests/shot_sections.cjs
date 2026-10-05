// Screenshots of every titled section below the arena (desktop and phone), for reading the restored layout.
//   node tests/shot_sections.cjs        writes qa/sec-*.png
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
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h, tag] of [[1280, 900, 'desk'], [375, 812, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(tag + ': ' + String(e.message || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(tag + ': ' + m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
      return { toData: r('#to-data'), overflow: document.documentElement.scrollWidth - innerWidth, miP: r('#c-mi-p'), edge: r('#c-edge'), tiles: r('#tiles') };
    });
    console.log(tag, JSON.stringify(m));
    for (const id of ['how-to-play', 'data', 'classic', 'cards-sec', 'made', 'science', 'claims', 'jobs']) {
      const el = await page.$('#' + id);
      await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      await el.screenshot({ path: path.join(out, `sec-${tag}-${id}.png`) });
    }
    if (tag === 'desk') {
      // classic board: guess, then show the bits style
      await page.click('#cl-pbit'); await page.waitForTimeout(200);
      await (await page.$('#classic')).screenshot({ path: path.join(out, 'sec-desk-classic-guessed.png') });
      console.log('classic verdict:', await page.$eval('#cl-verdict', e => e.textContent), '|', await page.$eval('#sc-chance', e => e.textContent), '|', await page.$eval('#cl-batch', e => e.textContent));
      await page.click('#cl-tile button[data-v="bars"]'); await page.waitForTimeout(150);
      await page.click('#cl-next'); await page.waitForTimeout(150);
      await (await page.$('#classic')).screenshot({ path: path.join(out, 'sec-desk-classic-bits.png') });
      // data: spin glass, J 0.4, all p-bit samples, tomography on
      await page.click('#d-graph button[data-v="random"]'); await page.waitForTimeout(150);
      await page.click('#d-J button[data-v="0.4"]'); await page.waitForTimeout(150);
      await page.click('#g-n button[data-v="4096"]'); await page.waitForTimeout(300);
      await page.check('#t-tomo'); await page.waitForTimeout(200);
      await (await page.$('#data')).screenshot({ path: path.join(out, 'sec-desk-data-random04.png') });
      console.log('after data picks: st', await page.evaluate(() => JSON.stringify({ g: st.graph, J: st.J, src: st.src, cl: CL.round.graph + CL.round.J, dial: document.querySelector('#j-val').textContent, prob: document.querySelector('#r-prob').textContent })));
      // jobs: Show the ladder hardware job
      await page.click('.jobshow[data-g="ladder"][data-m="qpu"]'); await page.waitForTimeout(900);
      console.log('after Show:', await page.evaluate(() => JSON.stringify({ g: st.graph, J: st.J, src: st.src, title: document.querySelector('#fp-title').textContent, cl: CL.round.src })));
    }
    await ctx.close();
  }
  console.log(errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no page errors');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
