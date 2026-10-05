// Record a short demo clip of one page: node common/qa/record_demo.cjs <site_dir> <page_path> <recipe.cjs> <out_stem> [port]
//   site_dir   the exported static site (docs/), served like GitHub Pages
//   page_path  e.g. pieces/05-jam-the-bat/index.html  or  index.html
//   recipe.cjs module.exports = async (page, h) => { ... }  where h = { wait(ms), drag(sel|box, from, to), clickText(text), center(sel) }
//              The recipe performs the piece's most delightful interaction in ~8-14 s (clicks start sound/animation).
//   out_stem   writes <out_stem>.mp4 (H.264), <out_stem>.gif (640 px, 12 fps, palette) and <out_stem>.png (poster)
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const [siteDir, pagePath, recipePath, outStem, portArg] = process.argv.slice(2);
const root = path.resolve(siteDir), port = +(portArg || 7100 + Math.floor(Math.random() * 800));
const FFMPEG = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (u.endsWith('/')) u += 'index.html'; const f = path.join(root, u); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });

(async () => {
  await new Promise(r => srv.listen(port, r));
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'demo-'));
  const W = 960, H = 600;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } }, deviceScaleFactor: 1 });
  const t0 = Date.now();
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/${pagePath}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const start = (Date.now() - t0) / 1000;
  const h = {
    wait: ms => page.waitForTimeout(ms),
    center: async sel => { const bx = await (await page.$(sel)).boundingBox(); return { x: bx.x + bx.width / 2, y: bx.y + bx.height / 2, box: bx }; },
    drag: async (from, to, steps = 25) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps }); await page.mouse.up(); },
    clickText: async text => page.getByText(text, { exact: false }).first().click(),
  };
  const recipe = require(path.resolve(recipePath));
  let err = null;
  try { await recipe(page, h); } catch (e) { err = String(e.message || e).slice(0, 300); }
  await page.waitForTimeout(500);
  const dur = (Date.now() - t0) / 1000 - start;
  await ctx.close(); await b.close(); srv.close();
  const webm = fs.readdirSync(tmp).filter(f => f.endsWith('.webm')).map(f => path.join(tmp, f))[0];
  fs.mkdirSync(path.dirname(path.resolve(outStem)), { recursive: true });
  const ss = Math.max(0, start - 0.2).toFixed(2), t = Math.min(dur + 0.2, 20).toFixed(2);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', ss, '-t', t, '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', '-an', outStem + '.mp4']);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', ss, '-t', t, '-i', webm, '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', outStem + '.gif']);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', (+ss + Math.min(2, +t / 2)).toFixed(2), '-i', webm, '-frames:v', '1', '-vf', 'scale=640:-1', outStem + '.png']);
  const sz = f => (fs.statSync(f).size / 1e6).toFixed(2) + ' MB';
  console.log(JSON.stringify({ page: pagePath, seconds: +t, mp4: sz(outStem + '.mp4'), gif: sz(outStem + '.gif'), recipe_error: err }));
  fs.rmSync(tmp, { recursive: true, force: true });
})();
