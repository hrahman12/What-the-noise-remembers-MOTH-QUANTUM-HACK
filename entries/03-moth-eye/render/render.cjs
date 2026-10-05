// Offline film: drives render/render.html in headless Chrome frame by frame and pipes PNGs into ffmpeg.
// Usage: node render.cjs [out.mp4] [--every N]   (CLASSICAL rendering of the cached engine LUTs; no Atlas calls)
const puppeteer = require('puppeteer-core');
const path = require('path');
const {spawn, execFileSync} = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve(__dirname, '..', process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'moth_eye.mp4');
const every = process.argv.includes('--every') ? +process.argv[process.argv.indexOf('--every') + 1] : 1;
const ffmpeg = execFileSync('python', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
(async () => {
  const b = await puppeteer.launch({executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--allow-file-access-from-files']});
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setViewport({width: 1280, height: 720, deviceScaleFactor: 1});
  await p.goto(require('url').pathToFileURL(path.join(__dirname, 'render.html')).href, {waitUntil: 'networkidle0'});
  await p.evaluate(() => document.fonts.ready);
  const info = await p.evaluate(() => ({ok: window.FILM && window.FILM.ok, frames: window.FILM && window.FILM.frames, fps: window.FILM && window.FILM.fps}));
  if (!info.ok) throw new Error('WebGL2 viewer failed: ' + errs.join(' | '));
  const fps = info.fps / every;
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', out], {stdio: ['pipe', 'inherit', 'inherit']});
  const log = [];
  const t0 = Date.now();
  for (let i = 0; i < info.frames; i += every) {
    const r = await p.evaluate((i) => window.FILM.frame(i), i);
    if (i % (info.fps * 5) === 0) { log.push(r); console.log(`frame ${i}/${info.frames}  t=${r.t.toFixed(1)}s  layers=${r.layers}  eye=${r.eye.toFixed(3)}  slab=${r.slab.toFixed(3)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    const png = await p.screenshot({type: 'png', clip: {x: 0, y: 0, width: 1280, height: 720}});
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  if (errs.length) console.log('page errors:', errs.join('\n'));
  console.log('wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
