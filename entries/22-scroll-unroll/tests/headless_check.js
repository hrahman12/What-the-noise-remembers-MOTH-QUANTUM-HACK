// Drive the built page in headless Chrome over the DevTools protocol and check it end to end.
// Usage: serve web/ on http://127.0.0.1:8722 (python -m http.server 8722 --bind 127.0.0.1 in web/), then
//   node tests/headless_check.js <scratch-dir> [page-port 8722] [devtools-port 9333]
// (qa/e2e.cjs is the fuller journey, with its own server; this one drives the system Chrome directly.)
// Checks: no script errors, WebGL path active, no horizontal scroll at 375 px, unroll + reading-window scan
// finds the hidden line, the share link round-trips, and screenshots of key states land in <scratch-dir>.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '.';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = +(process.argv[3] || 8722), CDP = +(process.argv[4] || 9333);
const URL0 = `http://127.0.0.1:${PORT}/index.html`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const prof = path.join(OUT, 'cdp-prof');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${CDP}`, `--user-data-dir=${prof}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); break; } catch (e) { await sleep(200); } }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const waiters = {}, errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiters[m.id]) { waiters[m.id](m); delete waiters[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; waiters[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(expr + ' -> ' + JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
  const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  const frames = `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`;
  const results = [];
  const check = (cond, msg) => { results.push((cond ? 'PASS ' : 'FAIL ') + msg); };

  await send('Runtime.enable'); await send('Page.enable');
  for (const [w, h, label] of [[1300, 1500, 'desktop'], [375, 900, 'mobile']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: URL0 + '?' + label });
    await sleep(3500);
    check(await ev('glOK'), `${label}: WebGL path active`);
    check(await ev('!!(pix["img/base.webp"]&&pix[inkSrc()])'), `${label}: scan and ink decoded`);
    const sw = await ev('document.documentElement.scrollWidth'), iw = await ev('innerWidth');
    check(sw <= iw, `${label}: no horizontal scroll (${sw} <= ${iw})`);
    await shot(`cdp_${label}_rolled`);
    // unroll halfway with the slider
    await ev(`(()=>{const u=$('u');u.value=500;u.dispatchEvent(new Event('input'));})()`); await ev(frames);
    check(Math.abs(await ev('st.u') - 0.5) < 1e-9, `${label}: unroll slider drives state`);
    await ev(`window.scrollTo(0,0)`); await shot(`cdp_${label}_half`);
    // reading the line while it is still rolled does not count
    await ev(`(()=>{const w=$('w');w.value=${'SCROLL.text_s[0]'};w.dispatchEvent(new Event('input'));})()`); await ev(frames);
    check(!(await ev('st.found')), `${label}: line not found while still rolled`);
    // unroll fully; a sweep under heavy damage (r < 0.8) does not count as reading it
    await ev(`(()=>{const u=$('u');u.value=1000;u.dispatchEvent(new Event('input'));const e=$('d');e.value=5;e.dispatchEvent(new Event('input'));})()`);
    await ev(`loadGrey(inkSrc())`); await ev(frames);
    await ev(`(async()=>{for(let s=SCROLL.text_s[0]-50;s<SCROLL.text_s[1];s+=150){const w=$('w');w.value=s;w.dispatchEvent(new Event('input'));await ${frames};}})()`);
    check(!(await ev('st.found')), `${label}: sweeping under heavy damage does not count`);
    await ev(`window.scrollTo(0,0)`); await shot(`cdp_${label}_heavy`);
    // then sweep the reading window across the line under clean ink
    await ev(`(()=>{const u=$('u');u.value=1000;u.dispatchEvent(new Event('input'));document.querySelector('[data-ink="clean"]').click();})()`); await ev(frames);
    await ev(`(async()=>{for(let s=SCROLL.text_s[0]-50;s<SCROLL.text_s[1];s+=150){const w=$('w');w.value=s;w.dispatchEvent(new Event('input'));await ${frames};}})()`);
    check(await ev('st.found'), `${label}: sweeping the flat line finds it`);
    check(await ev(`!$('reveal').hidden`), `${label}: translation revealed`);
    await ev(`(()=>{const w=$('w');w.value=Math.round(SCROLL.text_s[0]-20);w.dispatchEvent(new Event('input'));})()`); await ev(frames);
    await ev(`window.scrollTo(0,0)`); await shot(`cdp_${label}_found_clean`);
    // damage ladder: every rung loads, and the readout shows its job id
    for (let d = 0; d < 9; d++) {
      await ev(`(()=>{const e=$('d');e.value=${d};e.dispatchEvent(new Event('input'));})()`);
      await ev(`loadGrey(inkSrc())`); await ev(frames);
      const jobOK = await ev(`$('r-job').textContent===JOBS[${d}].job_id && tex.iSrc===JOBS[${d}].img`);
      check(jobOK, `${label}: damage rung ${d} shows job ${await ev(`JOBS[${d}].job_id.slice(0,8)`)}`);
    }
    await ev(`(()=>{const e=$('d');e.value=3;e.dispatchEvent(new Event('input'));})()`); await ev(`loadGrey(inkSrc())`); await ev(frames);
    const rdTop = await ev(`$('rd').getBoundingClientRect().top+scrollY-120`);
    await ev('window.scrollTo(0,' + Math.round(rdTop) + ')'); await ev(frames); await shot(`cdp_${label}_reader_d3`);
    // share link round trip
    await ev(`$('share').click()`); await sleep(300);
    const hash = await ev('location.hash');
    check(/^#u1000\.w\d+\.d3\.c0/.test(hash), `${label}: share hash ${hash}`);
    await send('Page.navigate', { url: URL0 + '?' + label + '2' + hash }); await sleep(3000);
    check(await ev('st.u===1&&st.d===3&&!st.clean'), `${label}: shared view restores`);
    // tap on the sheet moves the window; drag pushes the roll
    await ev(`(()=>{const u=$('u');u.value=0;u.dispatchEvent(new Event('input'));})()`); await ev(frames);
    const tapS = await ev(`(()=>{const r=ov.getBoundingClientRect(),p=sp(),fr=GEO.frame(p),w=GEO.world(fr,p,6000,0),q=toScreen(w);
      const x=r.left+q[0]/glc.width*r.width,y=r.top+q[1]/glc.height*r.height;
      ov.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,pointerId:1,bubbles:true}));
      ov.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,pointerId:1,bubbles:true}));return st.w0+winW()/2;})()`);
    check(Math.abs(tapS - 6000) < 30, `${label}: tap on the roll centres the window at s=${Math.round(tapS)} (want 6000)`);
    const du = await ev(`(()=>{const r=ov.getBoundingClientRect(),x=r.left+r.width*0.6,y=r.top+r.height*0.5;
      ov.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,pointerId:1,bubbles:true}));
      ov.dispatchEvent(new PointerEvent('pointermove',{clientX:x-r.width*0.3,clientY:y,pointerId:1,bubbles:true}));
      ov.dispatchEvent(new PointerEvent('pointerup',{clientX:x-r.width*0.3,clientY:y,pointerId:1,bubbles:true}));return st.u;})()`);
    check(du > 0.02, `${label}: dragging the roll left unrolls it (u=${du.toFixed(3)})`);
  }
  check(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(results.join('\n'));
  ws.close(); ch.kill();
  process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
