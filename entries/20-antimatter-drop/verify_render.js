// Render checks of the built page in headless Chromium (verification only, no network beyond Google Fonts):
// no console errors, no requests to disallowed hosts, pause really freezes time, reduced motion skips animation,
// and at 375 px (with the viewport meta the artifact platform adds) there is no horizontal scroll.
// Writes screenshot.png (desktop, mid-ramp at -1 g) and out/render/*.png from the current web/index.html.
// Run: node verify_render.js   (uses the project's shared Playwright in common/qa/node_modules;
//      set PLAYWRIGHT_PATH=<dir containing node_modules/playwright> to use another copy)
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), {pathToFileURL} = require('url');
const HERE = __dirname, OUT = path.join(HERE, 'out', 'render');
const PW = process.env.PLAYWRIGHT_PATH ? path.join(process.env.PLAYWRIGHT_PATH, 'node_modules', 'playwright')
  : path.join(HERE, '..', '..', 'common', 'qa', 'node_modules', 'playwright');
const {chromium} = require(PW);
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, {recursive: true});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'am20-'));
const wrapped = path.join(tmp, 'wrapped.html');
fs.writeFileSync(wrapped, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>' +
  fs.readFileSync(path.join(HERE, 'web/index.html'), 'ascii') + '</body></html>');
const URL = pathToFileURL(wrapped).href;
const fails = [];
const check = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) fails.push(msg); };

(async () => {
  const b = await chromium.launch();
  const errs = [], bad = [];
  const open = async (opts) => {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('request', r => { if (!/^(file:|data:|blob:|https:\/\/fonts\.(googleapis|gstatic)\.com\/)/.test(r.url())) bad.push(r.url()); });
    await p.goto(URL, {waitUntil: 'networkidle'});
    await sleep(300);
    return {ctx, p};
  };

  let {ctx, p} = await open({viewport: {width: 1280, height: 1000}});
  check(await p.$eval('#hud-phase', e => e.textContent) === 'Trap empty' && await p.$eval('#m-t', e => e.textContent) === '0.0',
    'loads idle with an empty trap');
  await p.click('#g-bias button[data-bi="3"]'); await p.click('#sz-series'); await p.click('#act'); await p.click('#act');
  await sleep(2400);
  await p.click('#act');                                   // pause mid-ramp (about 12 s of 20), then take the picture
  const t1 = await p.$eval('#m-t', e => e.textContent);
  await p.screenshot({path: path.join(HERE, 'screenshot.png')});
  await sleep(600);
  check(+t1 > 5 && +t1 < 20 && t1 === await p.$eval('#m-t', e => e.textContent) && await p.$eval('#act', e => e.textContent) === 'Resume',
    `pause freezes the ramp mid-way (t = ${t1} s)`);
  await ctx.close();
  ({ctx, p} = await open({viewport: {width: 1280, height: 1000}}));   // a fresh page: the campaign alone, as replay.py
  await p.click('#campaign');
  for (let i = 0; i < 120; i++) { await sleep(500); if ((await p.$eval('#campaign', e => e.textContent)) === 'Run the whole campaign') break; }
  await p.click('#worlds');
  await sleep(2600);                                       // let the 'campaign complete' toast fade
  check(await p.$eval('#c-n', e => e.textContent) === '1,721 escapes', 'the campaign alone gives 1,721 escapes');
  await (await p.$('section[aria-labelledby="data-h"]')).screenshot({path: path.join(OUT, 'lab.png')});   // The data: escape curve + |B| sketch
  const fit = JSON.parse(fs.readFileSync(path.join(HERE, 'out', 'replay.json'), 'utf8')).fez_148p8.fit;
  const want = `Balance at ${fit.b0 < 0 ? '−' : '+'}${Math.abs(fit.b0).toFixed(2)} g`;
  check((await p.$eval('#verdict', e => e.textContent)).includes(want), `campaign fills the curve and the verdict (${want}, as out/replay.json)`);
  await ctx.close();

  ({ctx, p} = await open({viewport: {width: 375, height: 812}, deviceScaleFactor: 2, isMobile: true, hasTouch: true}));
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw[0] <= sw[1], `375 px: no horizontal scroll (${sw[0]} <= ${sw[1]})`);
  await p.click('#act'); await p.click('#act'); await sleep(1800);
  await (await p.$('#stage')).screenshot({path: path.join(OUT, 'mobile_stage.png')});
  await p.evaluate(() => scrollTo(0, 0)); await sleep(200);
  await p.screenshot({path: path.join(OUT, 'mobile_top.png')});
  await ctx.close();

  ({ctx, p} = await open({viewport: {width: 1280, height: 1000}, reducedMotion: 'reduce'}));
  await p.click('#act'); await p.click('#act'); await sleep(50);
  check(/^Done: /.test(await p.$eval('#hud-phase', e => e.textContent)), 'reduced motion completes the ramp at once');
  await ctx.close();
  check(errs.length === 0, 'no console or page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  check(bad.length === 0, 'no requests beyond the page and Google Fonts' + (bad.length ? ': ' + bad.join(' ') : ''));
  await b.close();
  fs.rmSync(tmp, {recursive: true, force: true});
  console.log(fails.length ? `${fails.length} render check(s) failed` : 'all render checks passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
