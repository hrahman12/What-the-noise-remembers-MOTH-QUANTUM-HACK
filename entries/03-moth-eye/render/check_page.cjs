// Headless check of web/index.html: console errors, meter values, 375 px layout, screenshots. Not part of the page.
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = require('url').pathToFileURL(path.resolve(__dirname, '..', 'web', 'index.html')).href + (process.argv[2] || '');
(async () => {
  const b = await puppeteer.launch({executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu']});
  const p = await b.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !/^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u)) errs.push('OFF-LIST REQUEST ' + u); });
  await p.setViewport({width: 1280, height: 1000});
  await p.goto(url, {waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 800));
  const info = await p.evaluate(() => ({big: document.getElementById('m-big').textContent, bars: document.getElementById('m-bars').innerText, job: document.getElementById('r-job').textContent, q: document.getElementById('r-qubits').textContent, verdict: document.getElementById('ch-verdict').textContent}));
  console.log(JSON.stringify(info, null, 1));
  await p.screenshot({path: path.join(__dirname, 'shot_desktop' + (process.argv[3] || '') + '.png'), fullPage: false});
  await p.setViewport({width: 375, height: 800});
  await new Promise(r => setTimeout(r, 600));
  const sw = await p.evaluate(() => ({scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth}));
  console.log('375px layout', JSON.stringify(sw));
  if (!process.argv[3]) await p.screenshot({path: path.join(__dirname, 'shot_mobile.png'), fullPage: true});
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await b.close();
})();
