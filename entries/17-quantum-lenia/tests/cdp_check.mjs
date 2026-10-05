// Headless Chrome check of web/index.html via the DevTools protocol (node tests/cdp_check.mjs <outdir>).
// Loads the built page, records exceptions, plays/steps/paints/switches kernels, screenshots desktop and 375 px.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const OUT = process.argv[2]; mkdirSync(OUT, {recursive: true});
const PAGE = pathToFileURL(path.resolve('web/index.html')).href;
const PORT = 9417;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/prof`, '--no-first-run', '--window-size=1280,900', 'about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const logs = [];
async function connect() {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); const t = (await r.json()).find(x => x.type === 'page'); if (t) return t.webSocketDebuggerUrl; } catch {} await sleep(200); }
  throw new Error('no chrome');
}
const send = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const ev = async expr => (await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true})).result?.result?.value;
async function shot(name, w, h, full) {
  await send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false});
  await sleep(800);
  const m = await send('Page.getLayoutMetrics');
  const ch = full ? Math.ceil(m.result.cssContentSize.height) : h;
  const r = await send('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 0, width: w, height: Math.min(ch, 5000), scale: 1}, captureBeyondViewport: true});
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
}
async function mouse(type, x, y) { await send('Input.dispatchMouseEvent', {type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'mouse'}); }
const txt = id => `document.getElementById('${id}').textContent`;
try {
  ws = new WebSocket(await connect()); await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 500));
    if (d.method === 'Runtime.consoleAPICalled') logs.push('CONSOLE ' + d.params.type + ' ' + d.params.args.map(a => a.value).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') logs.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || '')); };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: PAGE}); await sleep(2500);
  const r = {};
  r.initial = await ev(`({t: ${txt('l-t')}, blobs: ${txt('l-c')}, play: ${txt('play')}, fate: ${txt('fate')}, job: ${txt('r-job')}})`);
  await shot('desktop_initial', 1280, 900, true);
  await ev(`document.getElementById('play').click()`); await sleep(2000);
  r.playing = await ev(`({t: +${txt('l-t')}, rate: ${txt('l-r')}})`);
  await ev(`document.getElementById('play').click()`); await sleep(300);
  r.paused = await ev(`({t: +${txt('l-t')}, rate: ${txt('l-r')}, blobs: ${txt('l-c')}})`);
  await sleep(500); r.pausedLater = await ev(`+${txt('l-t')}`);
  await ev(`document.getElementById('stepb').click()`); r.afterStep = await ev(`+${txt('l-t')}`);
  await ev(`document.getElementById('reset').click()`); r.afterReset = await ev(`+${txt('l-t')}`);
  const box = await ev(`(()=>{const b=document.getElementById('cv').getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height}})()`);
  const before = await ev(`+${txt('l-c')}`);
  await mouse('mouseMoved', box.x + box.w * 0.5, box.y + box.h * 0.82); await mouse('mousePressed', box.x + box.w * 0.5, box.y + box.h * 0.82);
  await mouse('mouseMoved', box.x + box.w * 0.62, box.y + box.h * 0.82); await mouse('mouseReleased', box.x + box.w * 0.62, box.y + box.h * 0.82);
  await sleep(300); r.blobsAfterStamp = [before, await ev(`+${txt('l-c')}`)];
  await ev(`[...document.querySelectorAll('#g-set button')].find(b=>b.textContent==='Blur 0.5').click()`);
  r.kernel = await ev(`({name: ${txt('k-name')}, job: ${txt('r-job')}, fate: ${txt('fate')}, q: ${txt('r-q')}})`);
  await ev(`[...document.querySelectorAll('#g-shell button')].find(b=>b.textContent==='Gaussian').click()`);
  r.kernelBell = await ev(txt('fate'));
  await ev(`[...document.querySelectorAll('#g-shell button')].find(b=>b.textContent==='Ring').click()`);
  await ev(`document.getElementById('play').click()`); await sleep(1500); await ev(`document.getElementById('play').click()`);
  await shot('desktop_blur05', 1280, 900, false);
  await ev(`document.querySelectorAll('.tile')[2].click()`); await sleep(600);
  r.seed = await ev(`({t: ${txt('l-t')}, pressed: document.querySelectorAll('.tile')[2].getAttribute('aria-pressed'), toast: ${txt('toast')}})`);
  await ev(`window.scrollTo(0,0)`); await shot('desktop_seed', 1280, 900, false);
  await ev(`document.getElementById('share').click()`); await sleep(300); r.hash = await ev(`location.hash`);
  // 375 px: the artifact host adds a width=device-width viewport, so emulate a 375 px layout viewport directly
  await send('Page.navigate', {url: 'about:blank'}); await sleep(300);
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 812, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: PAGE + '#ring.q100.m150.g150.nq25'}); await sleep(2000);
  r.mobile = await ev(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, set: ${txt('k-name')}, tile: document.querySelectorAll('.tile')[1].getAttribute('aria-pressed')})`);
  await shot('mobile_full', 375, 812, true);
  async function shot375(name){ await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 812, deviceScaleFactor: 1, mobile: false}); await sleep(500);
    const m = await send('Page.getLayoutMetrics'); const ch = Math.ceil(m.result.cssContentSize.height);
    const r = await send('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 0, width: 375, height: Math.min(ch, 5000), scale: 1}, captureBeyondViewport: true});
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); }
  await shot375('mobile_full');
  console.log(JSON.stringify(r, null, 1)); console.log(logs.length ? logs.join('\n') : 'no exceptions / console errors');
} finally { try { ws && ws.close(); } catch {} chrome.kill(); }
