// Review screenshots of web/index.html (headless Chromium via the shared QA playwright install).
// Usage: node render/shots.cjs [port] [hash]  -> qa/shot-desktop.png, qa/shot-desktop-full.png, qa/shot-mobile.png, qa/shot-mobile-full.png
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../../common/qa/node_modules/playwright'));
const web = path.resolve(__dirname, '../web'), out = path.resolve(__dirname, '../qa');
const port = +(process.argv[2] || 5741), hash = process.argv[3] || '';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' };
const server = http.createServer((q, r) => {
  const f = path.join(web, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(r => server.listen(port, r));
  const b = await chromium.launch();
  for (const [label, w, h, dpr] of [['desktop', 1280, 900, 1], ['mobile', 375, 812, 2]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await p.goto(`http://127.0.0.1:${port}/index.html${hash}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, `shot-${label}.png`) });
    await p.screenshot({ path: path.join(out, `shot-${label}-full.png`), fullPage: true });
    const info = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, meter: document.getElementById('m-big').textContent, mood: document.getElementById('m-mood').textContent }));
    console.log(label, JSON.stringify(info), errs.join(' | '));
    await ctx.close();
  }
  await b.close(); server.close();
})();
