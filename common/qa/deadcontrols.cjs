// Dead-control detector: node common/qa/deadcontrols.cjs <entries/NN-slug | site> [port]
// Loads <dir>/web/index.html in headless Chromium and exercises every visible control (buttons, links that act
// in-page, sliders, selects, checkboxes, summaries, canvases). After each action it compares a fingerprint of the
// page (visible DOM text + attributes, canvas pixels, audio activity, location.hash, scroll position) with the
// one before. A control whose action changes nothing is reported as "dead". Writes <dir>/qa/deadcontrols.json.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2] || '.'), web = path.join(dir, 'web');
const port = +(process.argv[3] || 6100 + Math.floor(Math.random() * 800));
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); const f = path.join(web, u === '/' ? 'index.html' : u); if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

const INIT = () => {
  window.__dc = { snd: 0 };
  const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
  if (S) { const st = S.start; S.start = function (...a) { window.__dc.snd++; return st.apply(this, a); }; }
  document.addEventListener('playing', () => window.__dc.snd++, true);
};
const FP = () => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let s = document.body ? document.body.innerText : '';
  document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-valuenow],[aria-checked],[aria-selected],details,[hidden],input,select,textarea').forEach(e => {
    s += '|' + (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-expanded') || '') + (e.getAttribute('aria-valuenow') || '') + (e.getAttribute('aria-checked') || '') + (e.getAttribute('aria-selected') || '') + (e.open ? 'o' : '') + (e.hidden ? 'h' : '') + (e.value != null ? e.value : '') + (e.checked ? 'c' : '');
  });
  document.querySelectorAll('[style]').forEach(e => { s += '|' + e.getAttribute('style'); });
  document.querySelectorAll('[class]').forEach(e => { if (vis(e)) s += '|' + e.className; });
  document.querySelectorAll('canvas').forEach(c => { try { s += '|' + c.width + 'x' + c.height + ':' + c.toDataURL().length + ':' + c.toDataURL().slice(-200); } catch (e) { s += '|tainted'; } });
  document.querySelectorAll('img').forEach(i => { s += '|' + i.currentSrc; });
  document.querySelectorAll('video,audio').forEach(m => { s += '|' + m.currentSrc + (m.paused ? 'p' : 'P'); });
  s += '|' + location.hash + '|' + Math.round(scrollY) + '|' + (window.__dc ? window.__dc.snd : 0);
  return s;
};
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

(async () => {
  await new Promise(r => srv.listen(port, r));
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  p.on('dialog', d => d.dismiss());
  await p.addInitScript(INIT);
  await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(800);
  const sel = 'button, [role="button"], [role="slider"], [role="tab"], summary, input:not([type="hidden"]), select, a[href^="#"], canvas, [tabindex="0"]';
  const n = await p.$$eval(sel, els => els.length);
  const results = [];
  for (let k = 0; k < Math.min(n, 150); k++) {
    const h = (await p.$$(sel))[k];
    if (!h) continue;
    let info;
    try {
      if (!(await h.isVisible())) continue;
      info = await h.evaluate(e => ({ tag: e.tagName.toLowerCase(), type: e.type || '', role: e.getAttribute('role') || '', id: e.id || '', label: ((e.innerText || e.getAttribute('aria-label') || e.title || e.value || '').trim()).slice(0, 60) }));
      if (info.tag === 'a' && (info.label === '' )) continue;
      const before = hash(await p.evaluate(FP));
      const box = await h.boundingBox();
      if (info.tag === 'input' && info.type === 'range') {
        await h.focus(); await p.keyboard.press('End'); await p.waitForTimeout(250); await p.keyboard.press('Home');
      } else if (info.tag === 'input' && ['text', 'number', 'search'].includes(info.type)) {
        await h.fill('7');
      } else if (info.tag === 'input' && info.type === 'file') {
        continue;
      } else if (info.tag === 'select') {
        const opts = await h.$$eval('option', o => o.map(x => x.value));
        if (opts.length > 1) await h.selectOption(opts[opts.length - 1]);
      } else if (info.tag === 'canvas' && box) {
        await p.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
        await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 6 }); await p.mouse.up();
      } else if (info.role === 'slider' && box) {
        await p.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
      } else {
        await h.click({ timeout: 2500 });
      }
      await p.waitForTimeout(700);
      const after = hash(await p.evaluate(FP));
      results.push({ ...info, changed: before !== after });
    } catch (e) {
      results.push({ ...(info || {}), error: String(e.message || e).slice(0, 120) });
    }
  }
  const dead = results.filter(r => r.changed === false);
  const out = { dir: path.basename(dir), controls_tested: results.length, dead, errors: errors.slice(0, 10), failed_actions: results.filter(r => r.error) };
  fs.mkdirSync(path.join(dir, 'qa'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'qa', 'deadcontrols.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await b.close(); srv.close();
})();
