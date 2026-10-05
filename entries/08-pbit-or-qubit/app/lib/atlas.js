/* Server-side Atlas calls for the web app. The API key is read here and never sent to the browser.

   Key: MOTH_API_KEY from the environment, else from the nearest .env walking up from this folder
   (the project-root .env when run inside the Moth Hack repo).
   Guards, so a public page can't drain credits:
     - live runs only when ALLOW_LIVE is not "0" locally, and only when ALLOW_LIVE=1 on Vercel
     - ibm_fez (mode qpu) only when ALLOW_QPU=1
     - MAX_LIVE_JOBS per server process (default 3), shots fixed at 20, num_qubits fixed at 20
     - inside the project tree, every job is appended to cache/ledger.jsonl under this piece and
       refused if it would take the piece past CREDIT_CAP (default 60), like the Python client */
'use strict';
const fs = require('fs');
const path = require('path');
const Ising = require('./ising.js');
const PROBLEMS = require('./problems.json');

const BASE = 'https://api.mothquantum.com/api/v1';
const ENGINE = 'graph-v1';
const CREDITS_PER_RUN = 5;            // graph-v1's credits_per_run, read from GET /engines/graph-v1
const PIECE = '08-pbit-or-qubit';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let jobsThisProcess = 0;

function findUp(name, start) {
  let dir = start || __dirname;
  for (let i = 0; i < 6; i++) {
    const f = path.join(dir, name);
    if (fs.existsSync(f)) return f;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
function loadKey() {
  if (process.env.MOTH_API_KEY) return process.env.MOTH_API_KEY.trim();
  const f = findUp('.env');
  if (!f) return '';
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*MOTH_API_KEY\s*=\s*(.*)$/.exec(line);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}
function ledgerPath() {
  const f = findUp(path.join('cache', 'ledger.jsonl'));
  if (f) return f;
  const atlas = findUp('atlas');                 // project tree without a ledger yet
  return atlas ? path.join(path.dirname(atlas), 'cache', 'ledger.jsonl') : null;
}
function spent() {
  const f = ledgerPath();
  if (!f || !fs.existsSync(f)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    try { const e = JSON.parse(line); if (e.piece === PIECE) total += +e.credits || 0; } catch (_) { /* skip */ }
  }
  return total;
}
function liveState() {
  const onVercel = !!process.env.VERCEL;
  const maxJobs = +(process.env.MAX_LIVE_JOBS || 3);
  const cap = +(process.env.CREDIT_CAP || 60);
  const led = ledgerPath();
  if (!loadKey()) return { live: false, reason: 'no MOTH_API_KEY on the server' };
  if (onVercel ? process.env.ALLOW_LIVE !== '1' : process.env.ALLOW_LIVE === '0') return { live: false, reason: 'live runs are switched off (ALLOW_LIVE)' };
  if (jobsThisProcess >= maxJobs) return { live: false, reason: `this server already ran its ${maxJobs} live jobs (MAX_LIVE_JOBS)` };
  if (led && spent() + CREDITS_PER_RUN > cap) return { live: false, reason: `the piece's ledgered spend would pass its ${cap}-credit cap` };
  return { live: true, jobs_left: maxJobs - jobsThisProcess, ledger: !!led };
}

async function atlas(method, p, body) {
  const key = loadKey();
  if (!key) throw Object.assign(new Error('MOTH_API_KEY is not set on the server'), { status: 500 });
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await fetch(BASE + p, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'pbit-or-qubit/1.0' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (![429, 500, 502, 503, 504].includes(r.status)) break;
    await new Promise(res => setTimeout(res, 1000 * 2 ** attempt));
  }
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(`Atlas ${method} ${p.split('?')[0]} -> ${r.status}: ${text.slice(0, 300)}`), { status: 502 });
  return JSON.parse(text);
}

function buildParams(graph, J, mode) {
  const g = PROBLEMS[graph];
  const couplings = g.signs.map(s => s * J);
  const targets = Ising.exactStats(g.edges, couplings).edge_zz;   // exact Boltzmann edge correlations (2^20 states)
  return Ising.graphv1Params(g.edges, targets, mode, 20, 'ibm_fez');
}

async function submit(body) {
  const graph = String(body.graph || '');
  const mode = body.mode === 'qpu' ? 'qpu' : 'emu';
  let J = Number(body.J);
  if (!PROBLEMS[graph]) throw Object.assign(new Error('graph must be ring, ladder or random'), { status: 400 });
  if (!Number.isFinite(J) || J < 0.1 || J > 1.5) throw Object.assign(new Error('J must be between 0.1 and 1.5'), { status: 400 });
  J = Math.round(J * 10) / 10;
  if (mode === 'qpu' && process.env.ALLOW_QPU !== '1') throw Object.assign(new Error('ibm_fez runs are off: start the server with ALLOW_QPU=1'), { status: 403 });
  const ls = liveState();
  if (!ls.live) throw Object.assign(new Error(ls.reason), { status: 403 });
  const params = buildParams(graph, J, mode);
  jobsThisProcess++;                             // count before the call so a burst of clicks can't overshoot
  const out = await atlas('POST', `/engines/${ENGINE}/process`, { params });
  const led = ledgerPath();
  if (led) {
    fs.mkdirSync(path.dirname(led), { recursive: true });
    fs.appendFileSync(led, JSON.stringify({ piece: PIECE, engine: ENGINE, job_id: out.job_id, credits: CREDITS_PER_RUN,
      key: 'webapp', t: Math.round(Date.now() / 1000), source: 'app/server.js', graph, J, mode }) + '\n');
  }
  return { job_id: out.job_id, graph, J, mode, num_qubits: 20, shots: 20, operations: params.operations.length };
}

function summarise(output) {
  const bitstrings = [];
  for (const m of output.measurements || []) for (let k = 0; k < m.count; k++) bitstrings.push(m.bitstring);
  const rel = (output.tomography || {}).relationships || {};
  const edges = output.coupling_map || [];
  return {
    backend: output.backend, mode: output.mode, ibm_job_id: output.ibm_job_id || null, num_qubits: output.num_qubits,
    shots: output.shots, bitstrings: bitstrings.sort(),
    tomo_edge_zz: edges.map(([a, b]) => { const r = rel[`${Math.min(a, b)},${Math.max(a, b)}`]; return r ? r.ZZ : null; }),
    dominant_bitstring: output.dominant_bitstring, edge_agreement_score: output.edge_agreement_score
  };
}

async function poll(jobId) {
  if (!UUID.test(String(jobId || ''))) throw Object.assign(new Error('job_id must be a UUID'), { status: 400 });
  const s = await atlas('GET', `/jobs/${jobId}/status`);
  if (s.engine_id && s.engine_id !== ENGINE) throw Object.assign(new Error('not a graph-v1 job'), { status: 400 });
  const status = s.status;
  if (!['completed', 'succeeded', 'success'].includes(status)) {
    return { job_id: jobId, status, progress: s.progress ? [s.progress.step, s.progress.detail].filter(Boolean).join(': ') : '' };
  }
  const r = await atlas('GET', `/jobs/${jobId}/result`);
  return { job_id: jobId, status: 'completed', result: Object.assign({ job_id: jobId }, summarise(r.result.output)) };
}

function health() {
  const ls = liveState();
  return Object.assign({ engine: ENGINE, qubits: 20, shots: 20, qpu_allowed: process.env.ALLOW_QPU === '1' }, ls);
}

module.exports = { submit, poll, health, buildParams, summarise, loadKey, _atlas: atlas, _reset: () => { jobsThisProcess = 0; } };
