// Runs web/index.html in headless Chromium (Playwright, from common/qa/node_modules) and drives the plate:
// hash restore (including old gelateria links), every source and energy, the journey drag and arrow keys, detections
// from the keys, the detector (click and Enter) and the computer keyboard, the 100-detection tally against the curves,
// thresholds, the event geometry, every chip, the model, all knobs (L/E included), the drone, the curves in The data
// section (always drawn; drag and arrows), the job-table chip buttons, the titled sections, the CPT readout, share and
// stop, at desktop and phone widths. Fails on any page error or console error.
// usage: node tests/test_page.js   (from entries/07-flavour)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'common', 'qa', 'node_modules', 'playwright'));
const web = path.join(__dirname, '..', 'web'), port = 5300 + Math.floor(Math.random() * 400);
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]), f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.mp3': 'audio/mpeg', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
(async () => {
  await new Promise(r => server.listen(port, r));
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror ' + e.message));
  // an old gelateria link ("sky") lands on the atmosphere at 0.3 GeV
  await p.goto(`http://127.0.0.1:${port}/index.html#fake_fez~800~50~3~10~sky`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  ok(await p.getAttribute('[data-chip="2"]', 'aria-pressed') === 'true', 'hash chip not restored');
  ok(await p.getAttribute('[data-src="2"]', 'aria-pressed') === 'true', 'legacy hash source not mapped to the atmosphere');
  ok((await p.textContent('#le-line')).includes('800 km/GeV'), 'hash L/E not restored');
  ok(await p.evaluate(() => Object.keys(SPR).length >= 9 && typeof InkSprite.draw === 'function'), 'sprites missing');
  ok(await p.evaluate(() => PL.W > 300 && PL.mode === 'wide' && document.querySelectorAll('#j-dyn path').length >= 3), 'plate or bands not drawn');
  ok(await p.evaluate(() => !!document.querySelector('#src-dyn') && document.querySelector('#src-dyn').innerHTML.includes('from overhead')), 'atmospheric path not drawn');
  // sources: each starts at its landmark; the Sun is fixed at the end of the curves; energies keep L
  for (const i of [0, 1, 2, 3]) { await p.click(`[data-src="${i}"]`); await p.waitForTimeout(60); ok(await p.evaluate(i => st.src === i && st.ei === 0, i), 'source ' + i); }
  ok(await p.evaluate(() => st.u === U1 && probsAt(st.u).every((v, f) => Math.abs(v - ER.sun[f]) < 1e-9)), 'the Sun is not the vacuum average');
  await p.click('[data-src="0"]');
  ok(await p.evaluate(() => Math.abs(leOf(st.u) * eOf(st) - 52.5) < 0.01 && Math.abs(level(st, 0, st.u) - interp(ER.P[0], st.u)) < 1e-9), 'reactor not at JUNO on classical curves');
  ok((await p.textContent('#readout')).includes('CPT check'), 'reactor CPT readout missing');
  await p.click('[data-src="1"]'); await p.click('[data-e="1"]'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => st.ei === 1 && Math.abs(leOf(st.u) * eOf(st) - 295) < 0.5), 'energy switch did not keep L');
  await p.click('[data-e="0"]');
  // drag along the journey, then the arrow keys
  await p.evaluate(() => window.scrollTo(0, PL.svg.getBoundingClientRect().top + scrollY + PL.J.y - 40));
  const J = await p.evaluate(() => { const r = PL.svg.getBoundingClientRect(), A = jAxis(), k = r.width / PL.W; return { x0: r.left + A.x0 * k, x1: r.left + A.x1 * k, y: r.top + (A.yb - 20) * k }; });
  await p.mouse.move(J.x0 + (J.x1 - J.x0) * 0.3, J.y); await p.mouse.down(); await p.mouse.move(J.x0 + (J.x1 - J.x0) * 0.8, J.y, { steps: 6 }); await p.mouse.up();
  const u1 = await p.evaluate(() => st.u);
  ok(await p.evaluate(() => { const L = leOf(st.u) * eOf(st); return L > 300 && L < 1300; }), 'journey drag did not move along the road');
  await p.focus('#scene'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Shift+ArrowLeft');
  ok(await p.evaluate(u1 => st.u < u1, u1), 'arrow keys did not move the neutrino');
  await p.keyboard.press('End'); ok(await p.evaluate(() => Math.abs(st.u - srcRange(st.src, st.ei)[1]) < 1e-9), 'End did not reach the end of the baseline');
  await p.evaluate(() => moveTo(uOf(295 / 0.6)));
  // detections: a key, the detector (click and Enter), a computer key
  await p.click('#start-btn');
  await p.click('#keys [data-note="57"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => tally.n.reduce((a, b) => a + b, 0) === 1 && !!ev.cur), 'key did not detect');
  await p.evaluate(() => window.scrollTo(0, PL.svg.getBoundingClientRect().top + scrollY - 20));
  const det = await p.evaluate(() => { const r = PL.svg.getBoundingClientRect(), bx = PL.box.det, k = r.width / PL.W; return { x: r.left + (bx.x + bx.w / 2) * k, y: r.top + (bx.y + bx.h / 2) * k }; });
  await p.mouse.move(det.x, det.y); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up();
  await p.focus('#scene'); await p.keyboard.down('Enter'); await p.waitForTimeout(80); await p.keyboard.up('Enter');
  await p.focus('#panel'); await p.keyboard.down('d'); await p.waitForTimeout(80); await p.keyboard.up('d');
  ok(await p.evaluate(() => tally.n.reduce((a, b) => a + b, 0) === 4), 'detector click / Enter / computer key not counted');
  // the 100-detection tally approaches the curves (classical draws weighted by the measured values)
  await p.click('[data-src="2"]'); await p.evaluate(() => { moveTo(uOf(500)); });
  for (let i = 0; i < 20; i++) await p.click('#panel');
  const conv = await p.evaluate(() => { const P = probsAt(st.u), t = P[0] + P[1] + P[2], n = tally.n.reduce((a, b) => a + b, 0); return { n, err: Math.max(...[0, 1, 2].map(f => Math.abs(tally.n[f] / n - P[f] / t))) }; });
  ok(conv.n === 2000 && conv.err < 0.05, 'tally does not approach the curves: ' + JSON.stringify(conv));
  // thresholds and the event sketch
  ok(await p.evaluate(() => { st.ei = 0; const a = !seen(2) && seen(1) && seen(0); st.ei = 1; const b2 = seen(2); st.ei = 0; return a && b2; }), 'tau threshold logic');
  const evs = await p.evaluate(() => { st.src = 1; st.ei = 0; const m = makeEvent(1), e = makeEvent(0); st.src = 0; const lo = makeEvent(0); st.src = 2; return { m: [m.kind, m.nh], e: [e.kind, e.nh], lo: [lo.kind, lo.nh] }; });
  ok(evs.m[0] === 'mu' && evs.m[1] > 10 && evs.e[0] === 'e' && evs.e[1] > 50 && evs.lo[0] === 'low' && evs.lo[1] >= 10 && evs.lo[1] < 80, 'event sketch: ' + JSON.stringify(evs));
  ok(await p.evaluate(() => { ev.cur = makeEvent(1); drawEvent(); return document.querySelectorAll('#ed-dyn circle').length > 10; }), 'event display not drawn');
  ok(await p.evaluate(() => { st.src = 1; return Math.abs(angTo({ x: 0, y: 0, z: 10 }, [0, 0, 0], [0, 0, 1])) < 1e-9 && Math.abs(TH_C * 180 / Math.PI - 41.4) < 0.3; }), 'Cherenkov geometry');
  // every chip, the model, all knobs, drone, data view, share, stop
  await p.click('[data-src="1"]');
  for (const h of await p.$$('[data-chip]')) await h.click();
  for (const h of await p.$$('[data-model]')) await h.click();
  for (const id of ['k-mix', 'k-flight', 'k-attack', 'k-release', 'k-gain']) await p.$eval('#' + id, el => { el.value = el.max; el.dispatchEvent(new Event('input')); el.value = el.min; el.dispatchEvent(new Event('input')); });
  await p.click('#drone'); await p.waitForTimeout(150); ok(await p.evaluate(() => voices.some(v => v.drone && !v.rel)), 'drone did not sound'); await p.click('#drone');
  await p.click('[data-src="0"]');
  await p.$eval('#plot', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  const pb = await p.$eval('#plot', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await p.mouse.click(pb.x + pb.w * 0.04, pb.y + pb.h * 0.5);
  ok(await p.evaluate(() => SRC[st.src].nu === 'mu'), 'a drag past the reactor range did not move to a muon-neutrino source');
  await p.focus('#plot'); await p.keyboard.press('ArrowRight');
  // the curves are drawn without any toggle: ink pixels on the canvas, and the meters' waveforms
  await p.click('[data-model="3"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => { const c = $('plot'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return c.width > 600 && n > 2000; }), 'curves not drawn in The data');
  ok(await p.evaluate(() => ['w-e', 'w-mu', 'w-tau'].every(id => { const c = $(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })), 'meter waveforms not drawn');
  // the L/E knob: inside the source's range it moves the neutrino; past it, it moves to a muon-neutrino source that reaches it
  await p.click('[data-src="1"]'); await p.click('[data-e="0"]');
  await p.$eval('#k-u', el => { el.value = Math.log10(800); el.dispatchEvent(new Event('input')); });
  ok(await p.evaluate(() => st.src === 1 && Math.abs(leOf(st.u) - 800) < 1), 'L/E knob did not move the neutrino');
  await p.$eval('#k-u', el => { el.value = 4.5; el.dispatchEvent(new Event('input')); });
  ok(await p.evaluate(() => st.src === 2 && Math.abs(st.u - 4.5) < 1e-3), 'L/E knob did not move to the atmosphere');
  await p.$eval('#k-u', el => { el.value = el.max; el.dispatchEvent(new Event('input')); });
  ok(await p.evaluate(() => { const r = srcRange(st.src, st.ei); return st.u <= r[1] + 1e-9 && Math.abs(+$('k-u').value - st.u) < 1e-3; }), 'L/E knob past every baseline did not stop at the end of the range');
  // the job table: each machine button puts that chip on the synth
  await p.click('#jobs [data-jobchip="0"]');
  ok(await p.evaluate(() => st.chip === 0 && document.querySelector('[data-chip="0"]').getAttribute('aria-pressed') === 'true'), 'job-table chip button');
  // the titled sections are there, each with its heading, and every graph sits in a visible section
  ok(await p.evaluate(() => ['play', 'data', 'demos-sec', 'plug-sec', 'made', 'science', 'claims', 'jobs-sec'].every(id => { const e = $(id); return e && e.querySelector('h2') && e.offsetHeight > 0; })), 'a titled section is missing');
  ok(await p.evaluate(() => $('plot').closest('section').id === 'data' && $('meters').closest('section').id === 'data' && !$('plot').closest('details')), 'graphs not in The data section');
  ok(!/Bonus/i.test(await p.textContent('body')) && (await p.textContent('.wtnr-bar .count')).includes('Challenge 07'), 'brand bar must read Challenge 07, no Bonus');
  await p.click('#share'); ok(/^#[A-Za-z0-9._~-]+$/.test(await p.evaluate(() => location.hash)), 'share token');
  await p.click('#panic');
  await p.waitForTimeout(300);
  console.log('detections', await p.evaluate(() => tally.n.join('/')), '| hash', await p.evaluate(() => location.hash), '| log:', (await p.textContent('#tastelog')).slice(0, 120));
  // phone width: the stacked plate, no overflow, the detector still clickable
  const m = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  m.on('pageerror', e => errs.push('pageerror(mobile) ' + e.message));
  await m.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' }); await m.waitForTimeout(300);
  ok(await m.evaluate(() => PL.mode === 'narrow' && document.documentElement.scrollWidth <= innerWidth + 1), 'phone layout');
  errs.forEach(e => fail.push('console: ' + e));
  await b.close(); server.close();
  if (fail.length) { console.error('FAIL\n' + fail.join('\n')); process.exit(1); }
  console.log('PAGE TEST PASSED');
})().catch(e => { console.error(e); process.exit(1); });
