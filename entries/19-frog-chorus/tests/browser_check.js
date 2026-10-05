// Drive web/index.html in a private headless Chrome over the DevTools protocol (no shared browser pane).
// Checks: no JS exceptions, no horizontal scroll at 375 px, Start makes frogs call, the coupling slider
// changes the meters, toggles work, and a shared #token reopens the same chorus. Saves screenshots.
// Run: node tests/browser_check.js <screenshot dir>
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file:///' + path.join(__dirname, '..', 'web', 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(OUT, 'profile')}`, '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch (e) { await sleep(200); } }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {}, errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + JSON.stringify(m.params.args.map(a => a.value)));
  });
  const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  const shot = async name => { const r = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64')); };
  const click = async sel => {
    await ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center'})`); await sleep(150);
    const b = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    for (const type of ['mousePressed', 'mouseReleased']) await cmd('Input.dispatchMouseEvent', { type, x: b[0], y: b[1], button: 'left', clickCount: 1 });
  };
  const results = []; const ok = (c, msg) => results.push([!!c, msg]);
  await cmd('Runtime.enable'); await cmd('Page.enable');

  // ---- phone: a 375 px layout viewport (what the published page's viewport meta gives a phone) ----
  await cmd('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: false });
  await cmd('Page.navigate', { url: PAGE }); await sleep(2500);
  const sw = await ev('[document.documentElement.scrollWidth, document.body.scrollWidth, innerWidth]');
  ok(sw[0] <= 375 && sw[1] <= 375, `no horizontal scroll at 375 px (scrollWidth ${sw.join('/')})`);
  const wide = await ev(`[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>376&&r.width>0}).slice(0,5).map(e=>e.tagName+'.'+e.className+'#'+e.id)`);
  ok(wide.length === 0, 'no element extends past 375 px: ' + JSON.stringify(wide));
  ok(await ev('document.getElementById("sizes").offsetParent===null||document.getElementById("sizes").children.length>0'), 'empty size group is hidden');
  await shot('phone_top.png');
  await click('#go'); await sleep(2500);
  ok(await ev('st.running'), 'Start sets running');
  const r1 = await ev('({simT:st.simT, ev:events.length, audio: ctx?ctx.state:"none"})');
  ok(r1.simT > 1 && r1.ev > 3, `frogs call after Start (simT ${r1.simT.toFixed(2)} s, ${r1.ev} calls, audio ${r1.audio})`);
  await shot('phone_running.png');
  await click('#go'); await sleep(300);
  ok(!(await ev('st.running')), 'Stop clears running');

  // ---- desktop ----
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: PAGE }); await sleep(2000);
  await click('#fill'); await sleep(100);
  ok(await ev('st.occ.every(v=>v===1)'), 'Seat all seats every pad');
  await click('[data-src="asked"]'); await click('[data-mode="sync"]'); await sleep(100);
  ok(await ev('st.src==="asked"&&st.mode==="sync"'), 'toggles switch to sync pond / asked couplings');
  await ev(`document.getElementById('k')._set(4)`);
  await click('#go'); await sleep(9000);
  const m1 = await ev('({R:+document.getElementById("n-r").textContent, t:+document.getElementById("n-t").textContent, lock:document.getElementById("n-l").textContent})');
  ok(m1.R > 0.9, `asked sync pond at K=4 locks in step in the browser (R ${m1.R}, ${m1.lock})`);
  // size toggle
  await click('[data-size="20"]'); await sleep(200); ok(await ev('ds().n===20&&st.occ.length===20'), 'size toggle switches to the 20-qubit pond');
  await click('[data-size="22"]'); await sleep(200);
  await ev('window.scrollTo(0,0)'); await sleep(200); await shot('desk_sync_asked.png');
  await click('[data-mode="alt"]'); await click('[data-src="engine"]'); await ev(`document.getElementById('k')._set(12)`); await sleep(9000);
  const m2 = await ev('({R:+document.getElementById("n-r").textContent, t:+document.getElementById("n-t").textContent, lock:document.getElementById("n-l").textContent})');
  ok(m2.t > 0.5, `engine alternating pond at K=12 takes turns (turns ${m2.t}, R ${m2.R}, ${m2.lock})`);
  await ev('window.scrollTo(0,0)'); await sleep(200); await shot('desk_alt_engine.png');
  await click('#night'); await sleep(100);
  ok(await ev('st.occ.join("")===ds().nights[st.night]'), 'Roll a measured night seats exactly that shot');
  // keyboard: focus pond, move, toggle
  await ev('document.getElementById("pond").focus()');
  const before = await ev('st.occ[1]');
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  ok((await ev('st.cursor')) === 1 && (await ev('st.occ[1]')) !== before, 'arrow + Enter toggles pad 1 from the keyboard');
  await click('#share'); await sleep(300);
  const hash = await ev('location.hash');
  ok(/^#v1\.alt22\.engine\.k120\./.test(hash), 'share writes the token: ' + hash);
  await click('#go');
  // drawers open
  await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(200);
  ok((await ev('document.querySelectorAll(".lockrow").length===ds().edges.length&&ds().n===22')), 'default pond is the 22-qubit one and the lock chart lists all its edges');
  ok((await ev('document.querySelectorAll("#examples audio").length')) === 4, 'four example players');
  ok(await ev('[...document.querySelectorAll("#examples audio")].every(a=>a.paused)'), 'example audio does not auto-play');
  await ev(`document.querySelector('details:nth-of-type(2)').scrollIntoView()`); await sleep(200); await shot('desk_engine_drawer.png');
  // restore from token in a fresh load
  await cmd('Page.navigate', { url: PAGE + hash }); await sleep(2000);
  const rs = await ev('({ds:dsName(),src:st.src,K:st.K,night:st.night,occ:st.occ.join("")})');
  ok(rs.ds === 'alt22' && rs.src === 'engine' && Math.abs(rs.K - 12) < 1e-9, 'token restores pond, source and coupling: ' + JSON.stringify(rs).slice(0, 120));
  ok((await ev('document.getElementById("witness-note").textContent')).includes('0–21'), 'witness note names the 0-21 pair');
  ok(errors.length === 0, 'no JS errors: ' + JSON.stringify(errors).slice(0, 400));

  for (const [c, m] of results) console.log((c ? 'PASS ' : 'FAIL ') + m);
  console.log(`${results.filter(r => r[0]).length}/${results.length} browser checks passed`);
  ws.close(); chrome.kill();
  process.exit(results.every(r => r[0]) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
