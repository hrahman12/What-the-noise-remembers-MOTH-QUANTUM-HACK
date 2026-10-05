// Render a Slides deck's own files (project/deck.json + project/slides/*.html) to a 1920x1080-per-page PDF.
// node deck_pdf.cjs <deck_root> <blobmap.json> <out.pdf>
// blobmap.json maps "/_blob/<id>" -> local image path. The deck's custom elements (x-shape, x-icon, x-connector)
// are drawn with plain HTML/SVG approximations; <aside> speaker notes are hidden.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), url = require('url');
const [root, mapFile, out] = process.argv.slice(2);
const deck = JSON.parse(fs.readFileSync(path.join(root, 'project', 'deck.json'), 'utf8'));
const blobs = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
const faces = Object.values(deck.faces || {}).filter(f => f.href).map(f => `<link rel="stylesheet" href="${f.href}">`).join('\n');
let body = '';
for (const id of deck.order) {
  const f = path.join(root, 'project', 'slides', id + '.html');
  if (!fs.existsSync(f)) { console.error('missing slide', id); continue; }
  let h = fs.readFileSync(f, 'utf8');
  h = h.replace(/\/_blob\/[0-9a-f]{32}/g, m => blobs[m] ? url.pathToFileURL(blobs[m]).href : m);
  body += h + '\n';
}
const html = `<!doctype html><html><head><meta charset="utf-8">${faces}
<style>
@page { size: 1920px 1080px; margin: 0 }
* { margin: 0; padding: 0; box-sizing: border-box }
html, body { background: #FBFAF9 }
section { width: 1920px; height: 1080px; position: relative; overflow: hidden; page-break-after: always; break-after: page; font-size: 32px; line-height: 1.4 }
h1 { font-size: 96px; font-weight: 600; line-height: 1.1 } h2 { font-size: 64px; font-weight: 600; line-height: 1.15 }
h3 { font-size: 44px; font-weight: 600; line-height: 1.2 } p { font-size: 32px; line-height: 1.4 }
ul, ol { padding-left: 1.2em } li { line-height: 1.4 }
img { display: block } aside { display: none !important }
table { border-collapse: collapse; width: 100% } th, td { padding: 0.35em 0.6em; border-bottom: 1px solid #D3D3E6; text-align: left; vertical-align: top } th { font-weight: 600 }
x-shape, x-icon { display: block } x-connector { display: block; height: 32px; flex: none }
</style></head><body>${body}
<script>
for (const el of document.querySelectorAll('section, div')) {
  if (!el.style.display) { el.style.display = 'flex'; if (!el.style.flexDirection) el.style.flexDirection = 'column'; }
}
const poly = { 'arrow-right': 'polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)', 'arrow-left': 'polygon(100% 30%,40% 30%,40% 0,0 50%,40% 100%,40% 70%,100% 70%)',
  'arrow-up': 'polygon(30% 100%,30% 40%,0 40%,50% 0,100% 40%,70% 40%,70% 100%)', 'arrow-down': 'polygon(30% 0,30% 60%,0 60%,50% 100%,100% 60%,70% 60%,70% 0)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' };
for (const el of document.querySelectorAll('x-shape')) {
  const k = el.getAttribute('kind') || 'rect';
  if (k === 'ellipse') el.style.borderRadius = '50%';
  if (k === 'rounded') el.style.borderRadius = el.style.borderRadius || '24px';
  if (poly[k]) el.style.clipPath = poly[k];
  if (k === 'line') { el.style.background = 'transparent'; if (!el.style.borderTop) el.style.borderTop = '2px solid #19238E'; el.style.height = el.style.height || '0px'; }
}
for (const el of document.querySelectorAll('x-icon')) {
  const c = el.style.color || '#19238E', w = parseInt(el.style.width) || 48;
  el.style.width = w + 'px'; el.style.height = (parseInt(el.style.height) || w) + 'px';
  el.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="9" fill="none" stroke="' + c + '" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="' + c + '"/></svg>';
}
function arrow(x1, y1, x2, y2, col, w, head) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 14 + w * 2;
  const hx = x2 - L * Math.cos(a), hy = y2 - L * Math.sin(a);
  const p1 = [hx + L * 0.5 * Math.sin(a), hy - L * 0.5 * Math.cos(a)], p2 = [hx - L * 0.5 * Math.sin(a), hy + L * 0.5 * Math.cos(a)];
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + (head ? hx : x2) + '" y2="' + (head ? hy : y2) + '" stroke="' + col + '" stroke-width="' + w + '"/>' +
    (head ? '<polygon points="' + x2 + ',' + y2 + ' ' + p1.join(',') + ' ' + p2.join(',') + '" fill="' + col + '"/>' : '');
}
for (const el of document.querySelectorAll('x-connector')) {
  const col = el.style.color || '#19238E', w = parseInt(el.style.borderWidth) || 2, head = (el.getAttribute('head') || 'end') !== 'none';
  if (el.hasAttribute('x1')) {
    const n = v => parseFloat(v), sec = el.closest('section');
    const box = el.parentElement.closest('div[style*="relative"]') || sec;
    const x1 = n(el.getAttribute('x1')), y1 = n(el.getAttribute('y1')), x2 = n(el.getAttribute('x2')), y2 = n(el.getAttribute('y2'));
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('width', box.offsetWidth || 1920); s.setAttribute('height', box.offsetHeight || 1080);
    s.style.position = 'absolute'; s.style.left = '0'; s.style.top = '0'; s.style.pointerEvents = 'none'; s.style.overflow = 'visible';
    s.innerHTML = arrow(x1, y1, x2, y2, col, w, head);
    box.appendChild(s); el.remove();
  } else {
    const W = el.offsetWidth || parseInt(el.style.width) || 96, H = Math.max(el.offsetHeight, 32);
    el.innerHTML = '<svg width="' + W + '" height="' + H + '">' + arrow(4, H / 2, W - 4, H / 2, col, w, head) + '</svg>';
    el.style.alignSelf = 'center';
  }
}
</script></body></html>`;
(async () => {
  const tmp = path.join(path.dirname(out), '_deck_render.html');
  fs.writeFileSync(tmp, html);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(url.pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.pdf({ path: out, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  await b.close();
  fs.unlinkSync(tmp);
  console.log('wrote', out, deck.order.length, 'slides');
})();
