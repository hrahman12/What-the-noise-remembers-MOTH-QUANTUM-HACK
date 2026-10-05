// GPU check: the page's WebGL2 port of the engine shader, read back at the centre of a head-on flat slab
// ("Raw R" mode, theta = 0), must equal the Python port's normal-incidence RGB for the same run.
const puppeteer = require('puppeteer-core'); const path = require('path'); const fs = require('fs');
const rep = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'out', 'reflectance.json'), 'utf8'));
(async () => {
  const b = await puppeteer.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
  const p = await b.newPage(); await p.setViewport({width: 1280, height: 900});
  let worst = 0;
  for (const r of rep.results) {
    const L = r.layers, i = r.interaction;
    await p.goto(require('url').pathToFileURL(path.resolve(__dirname, '..', 'web', 'index.html')).href + `?run=${r.tag}#L${L}_i${i}_slab_m1_a0_e0_d56_x0.00_y0.50_t500`, {waitUntil: 'networkidle0'});
    await new Promise(r => setTimeout(r, 300));
    const px = await p.evaluate(() => { const c = document.getElementById('cv'), t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const g = t.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(c.width / 2 - 2, c.height / 2 - 2, 4, 4).data;
      const s = [0, 0, 0]; for (let k = 0; k < d.length; k += 4) for (let ch = 0; ch < 3; ch++) s[ch] += d[k + ch] / 16; return s; });
    const exp = r.normal_R_rgb.map(v => 255 * Math.pow(Math.min(1, v * 0.75), 1 / 2.2));
    const err = Math.max(...px.map((v, k) => Math.abs(v - exp[k]))); worst = Math.max(worst, err);
    console.log(`${r.tag.padEnd(11)} GPU ${px.map(v => v.toFixed(1)).join(',')}  python ${exp.map(v => v.toFixed(1)).join(',')}  max diff ${err.toFixed(2)} /255`);
  }
  await b.close();
  console.log(worst <= 2.5 ? `PASS (worst ${worst.toFixed(2)}/255)` : `FAIL (worst ${worst.toFixed(2)}/255)`);
  process.exit(worst <= 2.5 ? 0 : 1);
})();
