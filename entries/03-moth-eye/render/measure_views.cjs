// GPU meter at fixed viewpoints (the same off-screen pass the page uses), written to out/view_sweep.json.
// CLASSICAL: averages the cached engine LUTs over the pixels of each geometry. No Atlas calls.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const b = await puppeteer.launch({executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--allow-file-access-from-files']});
  const p = await b.newPage();
  await p.setViewport({width: 1280, height: 720});
  await p.goto(require('url').pathToFileURL(path.join(__dirname, 'render.html')).href, {waitUntil: 'load'});
  const res = await p.evaluate(() => {
    const out = {float_target: null, elevations: [], runs: {}};
    for (let el = 0; el <= 85; el += 5) out.elevations.push(el);
    for (const tag of Object.keys(LUTS)) {
      const L = LUTS[tag], rows = [];
      for (const el of out.elevations) {
        const m = window.MEASURE({layers: L.layers, inter: L.interaction, geo: 'eye', mode: 0, az: 0, el, dist: 40, lx: 0, ly: 0.5, th: 500});
        rows.push({el, eye: m.eye.R, dome: m.dome.R, slab: m.slab.R, px: [m.eye.px, m.dome.px, m.slab.px]});
      }
      out.runs[tag] = {layers: L.layers, interaction: L.interaction, job_id: L.job_id, rows};
    }
    return out;
  });
  res.note = 'Mean luminance of the engine shader R over covered pixels, 128x128 off-screen target, perspective camera (fov 32 deg, distance 40), azimuth 0, uThickness 500 nm.';
  fs.writeFileSync(path.join(__dirname, '..', 'out', 'view_sweep.json'), JSON.stringify(res, null, 1));
  const six = res.runs['L6_R6'].rows;
  for (const r of six) console.log(`el ${String(r.el).padStart(2)}  eye ${r.eye.toFixed(3)}  dome ${r.dome.toFixed(3)}  slab ${r.slab.toFixed(3)}`);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
