/* p-bit or qubit? web app server. No dependencies: Node 18+ (uses the built-in fetch).

     node server.js            then open http://localhost:8008

   GET  /                     the front end (public/index.html, built by ../build_web.py)
   GET  /api/health           what the server allows (live runs, ibm_fez, jobs left)
   POST /api/graph            {graph, J, mode} -> builds the graph-v1 recipe, submits it to Atlas, returns {job_id}
   GET  /api/graph?job_id=..  job status; when done, the 20 shots and the engine's tomography

   The Atlas key stays on this server (MOTH_API_KEY env var, or the project-root .env). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const atlas = require('./lib/atlas.js');

const PORT = +(process.env.PORT || 8008);
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e4) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(Object.assign(new Error('body must be JSON'), { status: 400 })); } });
  });
}
async function handleApi(req, res, url) {
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, atlas.health());
    if (url.pathname === '/api/graph' && req.method === 'POST') return send(res, 200, await atlas.submit(await readBody(req)));
    if (url.pathname === '/api/graph' && req.method === 'GET') return send(res, 200, await atlas.poll(url.searchParams.get('job_id')));
    return send(res, 404, { error: 'unknown endpoint' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message });
  }
}
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  return serveStatic(req, res, url);
});
if (require.main === module) {
  server.listen(PORT, () => {
    const h = atlas.health();
    console.log(`p-bit or qubit? on http://localhost:${PORT}`);
    console.log(`  Atlas key: ${atlas.loadKey() ? 'found (stays on this server)' : 'MISSING: set MOTH_API_KEY'}; live: ${h.live ? 'on' : 'off (' + h.reason + ')'}; ibm_fez: ${h.qpu_allowed ? 'on' : 'off (ALLOW_QPU=1)'}`);
  });
}
module.exports = server;
