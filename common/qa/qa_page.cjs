// Page QA for one piece: node common/qa/qa_page.cjs <entries/NN-slug> [port]
// Serves <piece>/web/ locally, opens index.html in headless Chromium at desktop and phone widths, and reports:
// console/page errors, failed or 4xx requests, horizontal overflow, external network hosts, every audio file
// decoding, and which buttons actually start sound (Web Audio sources or <audio>/<video> playing).
// Writes <piece>/qa/report.json + screenshots, and prints the JSON. Exit code 0 always; read "ok" and "problems".
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const piece = path.resolve(process.argv[2] || '.');
const web = path.join(piece, 'web');
const port = +(process.argv[3] || (5100 + Math.floor(Math.random() * 800)));
const outDir = path.join(piece, 'qa');
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mid': 'audio/midi', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.txt': 'text/plain', '.wif': 'text/plain' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  const f = path.join(web, u === '/' ? 'index.html' : u);
  if (!f.startsWith(web) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
});

const INSTRUMENT = () => {
  window.__qa = { sources: 0, ctx: 0, media: 0, mediaErr: 0, osc: 0 };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = function (...a) { const c = new AC(...a); window.__qa.ctx++; (window.__qa.ctxs ||= []).push(c); return c; };
    Wrapped.prototype = AC.prototype;
    window.AudioContext = Wrapped; window.webkitAudioContext = Wrapped;
    const S = window.AudioScheduledSourceNode && AudioScheduledSourceNode.prototype;
    if (S) { const st = S.start; S.start = function (...a) { window.__qa.sources++; if (this instanceof OscillatorNode) window.__qa.osc++; return st.apply(this, a); }; }
  }
  document.addEventListener('playing', () => window.__qa.media++, true);
  document.addEventListener('error', e => { if (e.target instanceof HTMLMediaElement) window.__qa.mediaErr++; }, true);
};

(async () => {
  await new Promise(r => server.listen(port, r));
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const report = { piece: path.basename(piece), problems: [], desktop: {}, mobile: {}, audio: {}, buttons: [] };
  const P = m => report.problems.push(m);
  if (!fs.existsSync(path.join(web, 'index.html'))) { P('web/index.html missing'); finish(); return; }

  async function open(width, height, label) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const errors = [], failed = [], external = new Set();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', e => errors.push('pageerror: ' + String(e.message || e).slice(0, 300)));
    page.on('requestfailed', r => { if (!r.url().startsWith('data:')) failed.push(r.url() + ' ' + (r.failure() || {}).errorText); });
    page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.add(u.hostname); });
    await page.addInitScript(INSTRUMENT);
    try { await page.goto(base + 'index.html', { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) { errors.push('goto: ' + e.message.slice(0, 200)); }
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: false });
    report[label] = { errors, failed, external: [...external], overflow_px: overflow };
    return { ctx, page, errors };
  }

  // phone width: layout only
  const m = await open(375, 812, 'mobile');
  if (report.mobile.overflow_px > 1) P(`horizontal overflow at 375px: ${report.mobile.overflow_px}px`);
  await m.ctx.close();

  // desktop: layout, audio decode, every button
  const d = await open(1280, 900, 'desktop');
  const page = d.page;
  const allowed = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com'];
  const bad = report.desktop.external.filter(h => !allowed.includes(h));
  if (bad.length) P('requests to disallowed hosts: ' + bad.join(', '));
  if (report.desktop.failed.length) P('failed requests: ' + report.desktop.failed.slice(0, 8).join(' | '));
  if (report.desktop.errors.length) P('console errors on load: ' + report.desktop.errors.slice(0, 5).join(' | '));

  // every audio file in web/ must decode in the browser
  const audioFiles = [];
  (function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(wav|mp3|ogg|m4a|webm)$/i.test(f)) audioFiles.push(path.relative(web, p).split(path.sep).join('/')); } })(web);
  report.audio.files = await page.evaluate(async files => {
    const out = [];
    const C = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
    for (const f of files) {
      try { const b = await (await fetch(f)).arrayBuffer(); const a = await C.decodeAudioData(b); out.push({ file: f, ok: true, seconds: +a.duration.toFixed(2) }); }
      catch (e) { out.push({ file: f, ok: false, err: String(e).slice(0, 120) }); }
    }
    return out;
  }, audioFiles);
  report.audio.files.filter(f => !f.ok).forEach(f => P(`audio file does not decode: ${f.file}`));

  // click every visible button / role=button / summary, record sound + new errors
  const handles = await page.$$('button, [role="button"], summary, input[type="checkbox"], input[type="radio"]');
  const before = await page.evaluate(() => ({ ...window.__qa }));
  let soundAny = before.sources > 0 || before.media > 0;
  if (soundAny) P('sound started before any user action (autoplay)');
  for (const h of handles.slice(0, 80)) {
    let label = '';
    try {
      if (!(await h.isVisible())) continue;
      label = ((await h.innerText()) || (await h.getAttribute('aria-label')) || (await h.getAttribute('id')) || '').trim().slice(0, 50);
      const q0 = await page.evaluate(() => ({ ...window.__qa }));
      const e0 = d.errors.length;
      await h.click({ timeout: 2000 });
      await page.waitForTimeout(700);
      const q1 = await page.evaluate(() => ({ ...window.__qa, running: (window.__qa.ctxs || []).some(c => c.state === 'running') }));
      const sound = q1.sources > q0.sources || q1.media > q0.media;
      if (sound) soundAny = true;
      const errs = d.errors.slice(e0);
      report.buttons.push({ label, sound, errors: errs });
      if (errs.length) P(`clicking "${label}" threw: ${errs[0]}`);
    } catch (e) { report.buttons.push({ label, error: String(e.message || e).slice(0, 120) }); }
  }
  const q = await page.evaluate(() => ({ ...window.__qa }));
  report.audio.sound_started = soundAny;
  report.audio.counters = { sources_started: q.sources, media_playing_events: q.media, media_errors: q.mediaErr, audio_contexts: q.ctx };
  if (q.mediaErr) P(`${q.mediaErr} media element error(s)`);
  if (audioFiles.length && !soundAny) P('page ships audio files but no control produced sound');
  await page.screenshot({ path: path.join(outDir, 'desktop-after-clicks.png'), fullPage: false });
  await d.ctx.close();
  finish();

  function finish() {
    report.ok = report.problems.length === 0;
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report, null, 1));
    browser.close().then(() => server.close());
  }
})();
