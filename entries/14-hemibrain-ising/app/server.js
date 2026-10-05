// Fly Brain Metro: a small Node server that serves the page and proxies Atlas graph-v1 calls.
//
// Zero dependencies (Node >= 18 for global fetch). Run from the project root or this folder:
//     node entries/14-hemibrain-ising/app/server.js          # http://127.0.0.1:5814
//
// * The Atlas key is read on the server (MOTH_API_KEY env, or MOTH_API_KEY=... in the project .env).
//   It is only ever placed in the Authorization header of server-to-Atlas requests. No response,
//   log line or error message sent to the browser contains it.
// * The browser posts {circuit, mode, beta}. The server builds the graph-v1 parameters itself with the
//   same recipe as run_graph.py, so the browser cannot inject arbitrary engine parameters.
// * Every job is looked up in the shared cache (cache/graph-v1/<key>.json, same key as atlas/client.py).
//   Cached runs are served free. A NEW job is submitted only if ALLOW_NEW_JOBS=1 is set AND the piece's
//   ledgered spend (cache/ledger.jsonl) plus the engine price stays within CREDIT_CAP (default 40, as run_graph.py).
// * Hardware (mode qpu) targets IBM ibm_fez by default (MOTH_QPU_BACKEND env to override), the same as run_graph.py.
// * Binds to 127.0.0.1 only. Not deployed anywhere.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = __dirname;
const PIECE_DIR = path.resolve(APP, '..');
const ROOT = path.resolve(PIECE_DIR, '..', '..');
const CACHE = path.join(ROOT, 'cache');
const BASE = 'https://api.mothquantum.com/api/v1';
const ENGINE = 'graph-v1';
const PIECE = '14-hemibrain-ising';
const PORT = +(process.env.PORT || 5814);
const CAP = +(process.env.CREDIT_CAP || 40);
const ALLOW_NEW = process.env.ALLOW_NEW_JOBS === '1';
const N = 20, SHOTS = 4096, QPU_BACKEND = process.env.MOTH_QPU_BACKEND || 'ibm_fez';   // IBM Heron, 156 qubits

const CIRCUITS = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(PIECE_DIR, 'data', 'circuits.json'), 'utf8')).circuits.map(c => [c.id, c]));
const CURVE = JSON.parse(fs.readFileSync(path.join(PIECE_DIR, 'data', 'pair_curve_dense.json'), 'utf8'));
const ALL_PAIRS = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) ALL_PAIRS.push([i, j]);

function apiKey() {
  if (process.env.MOTH_API_KEY) return process.env.MOTH_API_KEY.trim();
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.trim().match(/^MOTH_API_KEY=(.*)$/);
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch (e) { /* no .env */ }
  return '';
}

// ---- parameters: a port of run_graph.params ------------------------------------------------------
function interp(x, xp, fp) {                       // numpy.interp for increasing xp
  if (x <= xp[0]) return fp[0];
  if (x >= xp[xp.length - 1]) return fp[fp.length - 1];
  let lo = 0, hi = xp.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xp[mid] <= x) lo = mid; else hi = mid; }
  return fp[lo] + (x - xp[lo]) * (fp[hi] - fp[lo]) / (xp[hi] - xp[lo]);
}
const fractionFor = c => Number(interp(c, CURVE.zz, CURVE.fraction).toFixed(4));
const F = v => ({__float: v});                    // marks a Python float for hashing
function buildParams(circuit, mode, beta) {
  const ops = [];
  for (let q = 0; q < N; q++) ops.push({type: 'bloch', qubit: q, paulis: {X: F(1)}});
  for (const e of circuit.edges) ops.push({type: 'relationship', qubits: [e.i, e.j], paulis: {ZZ: F(1)}, fraction: F(fractionFor(Math.tanh(beta * e.J)))});
  const p = {num_qubits: N, coupling_map: ALL_PAIRS, operations: ops, shots: SHOTS, mode};
  if (mode === 'qpu') p.backend_name = QPU_BACKEND;
  return p;
}
// json.dumps(obj, sort_keys=True) as Python writes it, so cache keys match atlas/client.py
function pyFloat(v) {
  if (Number.isInteger(v)) return v.toFixed(1);
  const s = String(v);
  return s.includes('e') ? s.replace(/e([+-])(\d)$/, 'e$10$2') : s;
}
function pyDumps(o) {
  if (o && typeof o === 'object' && '__float' in o) return pyFloat(o.__float);
  if (Array.isArray(o)) return '[' + o.map(pyDumps).join(', ') + ']';
  if (o === null) return 'null';
  if (typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ': ' + pyDumps(o[k])).join(', ') + '}';
  if (typeof o === 'number') return String(o);
  return JSON.stringify(o).replace(/[\u007f-￿]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
}
const plain = o => JSON.parse(pyDumps(o).replace(/: /g, ':').replace(/, /g, ','));
const cacheKey = p => crypto.createHash('sha256').update(pyDumps({e: ENGINE, p, f: {}})).digest('hex').slice(0, 16);

// ---- ledger and cache ---------------------------------------------------------------------------
function spent() {
  try {
    return fs.readFileSync(path.join(CACHE, 'ledger.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter(e => e && e.piece === PIECE).reduce((a, e) => a + (+e.credits || 0), 0);
  } catch (e) { return 0; }
}
function summarise(circuit, rec, mode) {
  const out = rec.response.result.output, edges = circuit.edges;
  const agree = b => edges.reduce((n, e) => n + (b[e.i] === b[e.j] ? 1 : 0), 0) / edges.length;
  return {circuit: circuit.id, mode, status: 'completed', job_id: rec.job_id, backend: out.backend, ibm_job_id: out.ibm_job_id || null,
    num_qubits: out.num_qubits, shots: out.shots, seconds: rec.seconds, beta: null, dominant_bitstring: out.dominant_bitstring,
    top20: out.measurements.map(m => ({b: m.bitstring, count: m.count, p: m.probability, agree: Math.round(agree(m.bitstring) * 1e4) / 1e4})),
    top20_mass: Math.round(out.measurements.reduce((a, m) => a + m.probability, 0) * 1e6) / 1e6};
}

// ---- Atlas (server side only) -------------------------------------------------------------------
async function atlas(method, p, body) {
  const key = apiKey();
  if (!key) throw new Error('Server has no MOTH_API_KEY configured.');
  const r = await fetch(BASE + p, {method, headers: {Authorization: 'Bearer ' + key, Accept: 'application/json', 'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined});
  const text = await r.text();
  if (!r.ok) throw new Error(`Atlas ${method} ${p.split('?')[0]} -> ${r.status}`);
  return JSON.parse(text);
}
let busy = false;
async function submit(params, key, timeoutMs) {
  const engine = await atlas('GET', `/engines/${ENGINE}`);
  const cost = +engine.credits_per_run || 0;
  if (spent() + cost > CAP) { const e = new Error(`Credit cap reached for ${PIECE}: ${spent()} of ${CAP} credits ledgered; a ${ENGINE} run costs ${cost}.`); e.status = 402; throw e; }
  const {job_id} = await atlas('POST', `/engines/${ENGINE}/process`, {params: plain(params)});
  fs.appendFileSync(path.join(CACHE, 'ledger.jsonl'), JSON.stringify({piece: PIECE, engine: ENGINE, job_id, credits: cost, key, t: Math.round(Date.now() / 1000), via: 'app/server.js'}) + '\n');
  const t0 = Date.now();
  for (let delay = 2000; ; delay = Math.min(delay * 1.3, 15000)) {
    const st = await atlas('GET', `/jobs/${job_id}/status`);
    if (['completed', 'succeeded', 'success'].includes(st.status)) break;
    if (['failed', 'cancelled', 'canceled'].includes(st.status)) { const e = new Error(`Atlas job ${job_id} ${st.status}: ${(st.error && st.error.type) || 'no detail'}`); e.status = 502; throw e; }
    if (Date.now() - t0 > timeoutMs) { const e = new Error(`Atlas job ${job_id} still ${st.status}; ask again later to resume.`); e.status = 504; throw e; }
    await new Promise(r => setTimeout(r, delay));
  }
  const res = await atlas('GET', `/jobs/${job_id}/result`);
  const rec = {engine: ENGINE, params: plain(params), input_files: {}, job_id, seconds: Math.round((Date.now() - t0) / 100) / 10, response: res};
  fs.mkdirSync(path.join(CACHE, ENGINE), {recursive: true});
  fs.writeFileSync(path.join(CACHE, ENGINE, key + '.json'), JSON.stringify(rec, null, 2));
  return rec;
}

// ---- HTTP ---------------------------------------------------------------------------------------
function send(res, status, obj, type = 'application/json; charset=utf-8') {
  const body = typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj);
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = ''; req.on('data', d => { s += d; if (s.length > 4096) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => resolve(s)); req.on('error', reject);
  });
}
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return send(res, 200, fs.readFileSync(path.join(APP, 'public', 'index.html')), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, {ok: true, piece: PIECE, engine: ENGINE, credit_cap: CAP, credits_ledgered: spent(), allow_new_jobs: ALLOW_NEW, key_configured: !!apiKey()});
  }
  if (req.method === 'POST' && url.pathname === '/api/sample') {
    let q;
    try { q = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, {error: 'Send JSON: {"circuit", "mode", "beta"}.'}); }
    const circuit = CIRCUITS[q.circuit], mode = q.mode, beta = Math.round(+q.beta * 10) / 10;
    if (!circuit) return send(res, 400, {error: `Unknown circuit. Use one of: ${Object.keys(CIRCUITS).join(', ')}.`});
    if (!['emu', 'qpu'].includes(mode)) return send(res, 400, {error: 'mode must be "emu" or "qpu".'});
    if (!(beta >= 0.1 && beta <= 1.5)) return send(res, 400, {error: 'beta must be between 0.1 and 1.5.'});
    const params = buildParams(circuit, mode, beta), key = cacheKey(params), file = path.join(CACHE, ENGINE, key + '.json');
    if (fs.existsSync(file)) {
      const run = summarise(circuit, JSON.parse(fs.readFileSync(file, 'utf8')), mode); run.beta = beta;
      return send(res, 200, {source: 'cache', cache_key: key, run});
    }
    if (!ALLOW_NEW) return send(res, 403, {error: `No cached run for ${circuit.id} / ${mode} / beta ${beta}. New Atlas jobs are switched off on this server (start it with ALLOW_NEW_JOBS=1; each graph-v1 run costs credits).`, cache_key: key});
    if (busy) return send(res, 429, {error: 'One Atlas job at a time: try again when the current one finishes.'});
    busy = true;
    try {
      const rec = await submit(params, key, mode === 'qpu' ? 3600e3 : 900e3);
      const run = summarise(circuit, rec, mode); run.beta = beta;
      return send(res, 200, {source: 'atlas', cache_key: key, run});
    } catch (e) {
      return send(res, e.status || 502, {error: e.message});
    } finally { busy = false; }
  }
  return send(res, 404, {error: 'Not found.'});
}

if (require.main === module) {
  http.createServer((req, res) => handle(req, res).catch(() => send(res, 500, {error: 'Server error.'})))
    .listen(PORT, '127.0.0.1', () => console.log(`Fly Brain Metro on http://127.0.0.1:${PORT}  (new Atlas jobs ${ALLOW_NEW ? 'ON' : 'off'}, cap ${CAP}, ledgered ${spent()})`));
}
module.exports = {buildParams, cacheKey, pyDumps, fractionFor, summarise, CIRCUITS};
