// Check an exported static site (docs/) the way GitHub Pages serves it: node common/qa/site_check.cjs <dir> [port]
// Loads the hub and every pieces/*/index.html in headless Chromium (desktop + 375 px), and reports console errors,
// failed or 4xx requests, horizontal overflow, and every internal link that points at a missing file.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || 'docs'), port = +(process.argv[3] || 6950);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gif': 'image/gif' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => srv.listen(port, r));
  const pages = ['index.html', ...fs.readdirSync(path.join(root, 'pieces')).map(s => `pieces/${s}/index.html`)];
  const b = await chromium.launch();
  const report = [];
  for (const pg of pages) {
    const res = { page: pg, errors: [], failed: [], overflow: 0, badLinks: [] };
    for (const [w, h] of [[1280, 900], [375, 812]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      p.on('pageerror', e => res.errors.push(String(e.message || e).slice(0, 160)));
      p.on('console', m => { if (m.type() === 'error') res.errors.push(m.text().slice(0, 160)); });
      p.on('response', r => { if (r.status() >= 400) res.failed.push(r.status() + ' ' + r.url().replace(`http://127.0.0.1:${port}/`, '')); });
      try { await p.goto(`http://127.0.0.1:${port}/${pg}`, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { res.errors.push('goto ' + e.message.slice(0, 100)); }
      await p.waitForTimeout(500);
      if (w === 375) res.overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (w === 1280) {
        const hrefs = await p.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
        for (const h of hrefs) {
          if (!h || /^(https?:|mailto:|#|javascript:|data:|blob:)/.test(h)) continue;
          const target = path.normalize(path.join(root, path.dirname(pg), h.split('#')[0].split('?')[0]));
          const t = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
          if (!fs.existsSync(t)) res.badLinks.push(h);
        }
      }
      await ctx.close();
    }
    res.errors = [...new Set(res.errors)]; res.failed = [...new Set(res.failed)]; res.badLinks = [...new Set(res.badLinks)];
    res.ok = !res.errors.length && !res.failed.length && res.overflow <= 1 && !res.badLinks.length;
    report.push(res);
    console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${pg}${res.ok ? '' : '  ' + JSON.stringify({ e: res.errors.slice(0, 2), f: res.failed.slice(0, 3), o: res.overflow, l: res.badLinks.slice(0, 3) })}`);
  }
  fs.writeFileSync(path.join(root, '..', 'site_check_report.json'), JSON.stringify(report, null, 1));
  console.log(`${report.filter(r => r.ok).length}/${report.length} pages OK`);
  await b.close(); srv.close();
})();
