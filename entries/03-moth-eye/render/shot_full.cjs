const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const b = await puppeteer.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
  const p = await b.newPage(); await p.setViewport({width: +process.argv[2] || 1280, height: 900});
  await p.goto(require('url').pathToFileURL(path.resolve(__dirname, '..', 'web', 'index.html')).href + (process.argv[4] || ''), {waitUntil: 'networkidle0'});
  if (process.argv[5] === 'open') await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  await new Promise(r => setTimeout(r, 700));
  await p.screenshot({path: path.join(__dirname, process.argv[3] || 'full.png'), fullPage: true});
  await b.close();
})();
