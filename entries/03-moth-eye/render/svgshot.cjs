// Preview helper for make_plates.py: screenshot SVG files (or one HTML file) in headless Chromium.
// Usage: node render/svgshot.cjs <out.png> <width> <file.svg|file.html> [more.svg ...]
// SVGs are laid out in a column on a tint ground, each at <width> CSS px wide (device scale 2).
const fs = require('fs'), path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../../common/qa/node_modules/playwright'));
(async () => {
  const [out, width, ...files] = process.argv.slice(2);
  const w = +width || 600;
  let html;
  if (files.length === 1 && files[0].endsWith('.html')) html = fs.readFileSync(files[0], 'utf8');
  else html = `<style>body{margin:0;background:#D3D3E6;font-family:monospace}div{width:${w}px;margin:8px}svg{width:100%;height:auto;display:block}</style>` +
    files.map(f => `<div>${fs.readFileSync(f, 'utf8')}</div>`).join('');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w + 16, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log(out);
})();
