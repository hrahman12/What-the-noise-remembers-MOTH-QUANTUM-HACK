// Headless-Chrome smoke test over the DevTools protocol (no npm deps; Node >= 22 for global WebSocket).
// Loads web/index.html from disk, records console errors/exceptions, drives the instrument, checks layout at
// 375 px, and writes screenshots. Usage: node tests/smoke_chrome.mjs <outdir>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(path.join(here, '..', 'web', 'index.html')).href;
const out = process.argv[2] || here;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const port = 9400 + Math.floor(Math.random() * 400);
const prof = path.join(out, 'prof-' + port);
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check', '--window-size=1366,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), errors = [], logs = [];
async function connect() {
  for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); const l = await r.json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {} await sleep(200); }
  throw new Error('chrome did not start');
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(out, name), Buffer.from(r.data, 'base64')); };
const key = async (k, code) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code, text: type === 'keyDown' && k.length === 1 ? k : undefined }); };
const mouse = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });

try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 500));
    if (d.method === 'Runtime.consoleAPICalled') { const t = d.params.args.map(a => a.value ?? a.description).join(' '); (d.params.type === 'error' ? errors : logs).push(d.params.type + ': ' + t); }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push('log: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: page }); await sleep(2500);
  const r = {};
  r.title = await ev('document.title');
  r.proof = await ev("document.getElementById('proof').textContent");
  r.reachVal = await ev("document.getElementById('reach-val').textContent");
  r.job = await ev("document.getElementById('r-job').textContent");
  await shot('desktop_initial.png');
  // play for 2 s
  await ev("document.getElementById('play').click()"); await sleep(2000);
  r.posAfterPlay = await ev('posNow()'); r.playing = await ev('st.playing');
  r.audioState = await ev('ctx && ctx.state');
  await ev("document.getElementById('play').click()");
  // tap x5 via Z key
  await ev('seek(0)');
  for (let i = 0; i < 5; i++) { await key('z', 'KeyZ'); await sleep(120); }
  r.posAfterTaps = await ev('st.pos');
  // scrub reach to each stop, including unavailable ones
  r.reaches = [];
  for (const v of [0, 1, 2, 3]) { await ev(`(()=>{const e=document.getElementById('reach');e.value=${v};e.dispatchEvent(new Event('input'))})()`); await sleep(150); r.reaches.push([v, await ev('st.ri'), await ev("document.getElementById('reach-val').textContent")]); }
  r.toastReach1 = await ev("document.getElementById('toast').textContent");
  r.dMissing = await ev("document.getElementById('d-missing').textContent");
  await shot('desktop_reach.png');
  // play at the densest setting for 3 s, then check voices didn't run away
  await ev('seek(15)'); await ev("document.getElementById('play').click()"); await sleep(3000);
  r.voicesLiveDense = await ev('voicesLive'); await ev("document.getElementById('play').click()");
  // keyboard notes
  await key('a', 'KeyA'); await sleep(100); r.held = await ev('st.held.size');
  // drag a loop on the tape under the scene (the roll does the same in the Data view); bring it on screen first
  await ev("document.getElementById('track').scrollIntoView({block:'center'})"); await sleep(250);
  const box = await ev("(()=>{const b=document.getElementById('track').getBoundingClientRect();return [b.left,b.top,b.width,b.height]})()");
  const y = box[1] + box[3] / 2;
  await mouse('mousePressed', box[0] + box[2] * 0.55, y); await mouse('mouseMoved', box[0] + box[2] * 0.7, y); await mouse('mouseMoved', box[0] + box[2] * 0.8, y); await mouse('mouseReleased', box[0] + box[2] * 0.8, y);
  await sleep(200); r.loop = await ev('[st.loop, st.loopA, st.loopB]');
  await ev("document.querySelector('[data-preset=merger]').click()"); r.merger = await ev('[st.loop, st.loopA, st.loopB]');
  await ev("document.getElementById('play').click()"); await sleep(2500); r.posInLoop = await ev('posNow()'); await ev("document.getElementById('play').click()");
  await shot('desktop_loop.png');
  // the Data view: the roll and strain draw, and the scene comes back
  await ev("document.querySelector('#g-view [data-view=data]').click()"); await sleep(300);
  r.dataView = await ev("[view, document.getElementById('roll').width>0, document.getElementById('view-scene').hidden]");
  await shot('desktop_data.png');
  await ev("document.querySelector('#g-view [data-view=scene]').click()"); await sleep(200);
  r.sceneView = await ev("[view, SC.L&&SC.L.rips.length, document.getElementById('view-data').hidden]");
  // the restored sections: six titled sections, Figures 1-3 drawn, the jobs table, no "Bonus"
  r.sections = await ev("[...document.querySelectorAll('.sec > .ink-bar h2')].map(h=>h.textContent).join(' | ')");
  r.figures = await ev("[document.getElementById('roll-fig').width>0, document.getElementById('strip-fig').width>0, TAKES.filter(k=>k.geo).length, document.querySelectorAll('#jobs tr').length, /bonus/i.test(document.body.innerText), document.querySelector('.wtnr-bar .count').textContent]");
  // share token
  await ev("document.getElementById('share').click()"); await sleep(200); r.hash = await ev('location.hash');
  // hear the detector
  await ev("document.getElementById('hear').click()"); await sleep(400); r.hear = await ev("document.getElementById('hear').textContent");
  // switch event
  await ev("document.querySelector('#g-event button[data-i=\"1\"]').click()"); await sleep(400);
  r.ev2 = await ev('[EV().id, st.ri, document.getElementById("empty").hidden, document.getElementById("empty").textContent]');
  await shot('desktop_gw170817.png');
  // reload with the share hash (via about:blank so it is a real load)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300);
  await send('Page.navigate', { url: page + r.hash }); await sleep(2000);
  r.restored = await ev('[st.ev, st.ri, st.loop, st.loopA, st.loopB]');
  // mobile 375
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: page }); await sleep(1500);
  // the published artifact is wrapped in a skeleton with a viewport meta; add one for the local file
  await ev("(()=>{const m=document.createElement('meta');m.name='viewport';m.content='width=device-width,initial-scale=1';document.head.appendChild(m);window.dispatchEvent(new Event('resize'));})()"); await sleep(800);
  r.mobileScroll = await ev('[document.documentElement.scrollWidth, document.documentElement.clientWidth]');
  await shot('mobile_top.png');
  await ev("document.querySelector('.inst').scrollIntoView()"); await sleep(200); await shot('mobile_inst.png');
  fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify({ r, errors, logs }, null, 1));
  console.log(JSON.stringify(r, null, 1));
  console.log('errors:', errors.length ? errors : 'none');
} catch (e) { console.error('SMOKE FAILED', e); process.exitCode = 1; }
finally { try { ws && ws.close(); } catch (e) {} proc.kill(); }
