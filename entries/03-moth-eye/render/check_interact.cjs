// Headless interaction test: drag-orbit, keyboard, layer slider, interaction toggle, light pad, tilt sweep, share link.
const puppeteer = require('puppeteer-core'); const path = require('path'); const assert = require('assert');
(async () => {
  const b = await puppeteer.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({width: 1280, height: 1000});
  await p.goto(require('url').pathToFileURL(path.resolve(__dirname, '..', 'web', 'index.html')).href, {waitUntil: 'networkidle0'});
  const big = () => p.$eval('#m-big', e => e.textContent);
  const job = () => p.$eval('#r-job', e => e.textContent);
  const m0 = await big();
  // orbit by drag
  const box = await (await p.$('#cv')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 60, {steps: 8}); await p.mouse.up();
  await new Promise(r => setTimeout(r, 200));
  const m1 = await big(); console.log('drag orbit: meter', m0, '->', m1); assert.notStrictEqual(m0, m1);
  // keyboard orbit
  await p.focus('#cv'); for (let k = 0; k < 6; k++) await p.keyboard.press('ArrowUp'); await new Promise(r => setTimeout(r, 200));
  console.log('arrow keys: meter', await big());
  // layers slider via keyboard
  const j6 = await job(); await p.focus('#layers'); for (let k = 0; k < 5; k++) await p.keyboard.press('ArrowLeft'); await new Promise(r => setTimeout(r, 200));
  const j1 = await job(); console.log('layers 6 -> 1: job', j6.slice(0, 8), '->', j1.slice(0, 8)); assert.notStrictEqual(j6, j1);
  // interaction off (available at 1 layer)
  await p.click('[data-int="0"]'); await new Promise(r => setTimeout(r, 200)); const ji = await job(); console.log('interaction off: job', ji.slice(0, 8)); assert.notStrictEqual(ji, j1);
  await p.focus('#layers'); await p.keyboard.press('ArrowRight'); await new Promise(r => setTimeout(r, 200));
  const dis = await p.$eval('[data-int="0"]', e => e.disabled); console.log('at 2 layers the off button is disabled:', dis); assert(dis);
  // light pad keyboard
  const pv0 = await p.$eval('#pad-val', e => e.textContent); await p.focus('#pad'); for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowRight');
  const pv1 = await p.$eval('#pad-val', e => e.textContent); console.log('lamp:', pv0, '->', pv1); assert.notStrictEqual(pv0, pv1);
  // tilt sweep: starts on click, pauses on second click
  await p.click('#headon'); await p.click('#sweep'); await new Promise(r => setTimeout(r, 900)); await p.click('#sweep');
  const tl = await p.$eval('#tilt', e => e.getAttribute('aria-label')); console.log('after sweep+pause:', tl);
  const lbl = await p.$eval('#sweep', e => e.textContent); assert(lbl.startsWith('Sweep'));
  // geometry + mode buttons
  await p.click('[data-geo="both"]'); await p.click('[data-mode="1"]'); await new Promise(r => setTimeout(r, 200));
  // share
  await p.click('#share'); await new Promise(r => setTimeout(r, 200));
  const hash = await p.evaluate(() => location.hash); console.log('share hash', hash); assert(/^#[A-Za-z0-9._~-]+$/.test(hash));
  // reload from the hash reproduces the state
  const before = await job(); await p.reload({waitUntil: 'networkidle0'}); const after = await job();
  const geo = await p.$eval('[data-geo="both"]', e => e.getAttribute('aria-pressed')); console.log('restored from link:', after.slice(0, 8), 'both pressed', geo);
  assert.strictEqual(before, after); assert.strictEqual(geo, 'true');
  // reduced motion: sweep jumps instead of animating
  await p.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  await p.click('#sweep'); const lbl2 = await p.$eval('#sweep', e => e.textContent); console.log('reduced motion sweep label:', lbl2); assert(lbl2.startsWith('Sweep'));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
