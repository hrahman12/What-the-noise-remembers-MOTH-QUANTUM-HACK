// Tests the web app server without spending credits: it never sends a valid POST /api/graph.
// The one live Atlas call is a read-only GET of an already-completed job.
//   node tests/test_app.js
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
delete process.env.ALLOW_QPU;
const server = require('../app/server.js');
const atlas = require('../app/lib/atlas.js');
const jobs = require('../out/jobs.json');
const ref = require('./py_reference.json');

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const key = atlas.loadKey();
  const get = async (p, opt) => { const r = await fetch(base + p, opt); return { status: r.status, text: await r.text() }; };
  let n = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); n++; console.log('  ok', msg); };

  const home = await get('/');
  ok(home.status === 200 && home.text.includes('<title>Sauna vs Fridge</title>'), 'GET / serves the page');
  ok(home.text.includes('const LIVE = true'), 'web app build has the live panel switched on');
  ok(!key || !home.text.includes(key), 'page does not contain the API key');

  const h = await get('/api/health');
  const hj = JSON.parse(h.text);
  ok(h.status === 200 && hj.engine === 'graph-v1' && hj.qubits === 20 && hj.qpu_allowed === false, 'GET /api/health reports graph-v1, 20 qubits, ibm_fez off by default');
  ok(!key || !h.text.includes(key), 'health does not leak the key');

  const bad = await get('/api/graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: 'torus', J: 1, mode: 'emu' }) });
  ok(bad.status === 400, 'POST with an unknown graph is rejected (400), nothing submitted');
  const badJ = await get('/api/graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: 'ring', J: 9, mode: 'emu' }) });
  ok(badJ.status === 400, 'POST with J out of range is rejected (400)');
  const qpu = await get('/api/graph', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ graph: 'ring', J: 1, mode: 'qpu' }) });
  ok(qpu.status === 403, 'POST mode=qpu without ALLOW_QPU=1 is refused (403)');
  const junk = await get('/api/graph', { method: 'POST', body: 'not json' });
  ok(junk.status === 400, 'POST with a non-JSON body is rejected (400)');
  const badId = await get('/api/graph?job_id=../../keys');
  ok(badId.status === 400, 'GET with a malformed job_id is rejected (400)');
  const trav = await get('/..%2f..%2f..%2f..%2f.env');
  ok(trav.status === 403 || trav.status === 404, 'path traversal to .env is blocked');
  ok(!key || !trav.text.includes(key), 'traversal response does not contain the key');

  // read-only replay of a real completed emulator job through the same code path the page uses
  const j = jobs.find(x => x.mode === 'emu');
  const live = await get('/api/graph?job_id=' + j.job_id);
  const lj = JSON.parse(live.text);
  ok(live.status === 200 && lj.status === 'completed', `GET /api/graph?job_id=${j.job_id.slice(0, 8)} returns the completed job from Atlas`);
  ok(JSON.stringify(lj.result.bitstrings) === JSON.stringify(j.bitstrings), 'its 20 shots match the cached Python record exactly');
  ok(lj.result.num_qubits === 20 && lj.result.backend === j.backend, 'num_qubits 20 and backend echo through');
  ok(lj.result.tomo_edge_zz.every((v, k) => Math.abs(v - j.tomo_edge_zz[k]) < 1e-12), 'engine tomography mapped to the same edges as the Python summary');

  // the server builds exactly the recipe the Python runs used
  for (const r of ref) {
    const p = atlas.buildParams(r.graph, r.J, 'emu');
    assert.strictEqual(JSON.stringify(p), JSON.stringify(r.params), `recipe mismatch ${r.graph} ${r.J}`);
  }
  ok(true, 'server recipe == Python recipe for all 6 problems');
  const pq = atlas.buildParams('ring', 1.0, 'qpu');
  ok(pq.mode === 'qpu' && pq.backend_name === 'ibm_fez' && pq.shots === 20 && pq.num_qubits === 20, 'qpu recipe targets ibm_fez with 20 shots on 20 qubits');

  server.close();
  console.log(`${n} checks passed`);
})().catch(e => { console.error('FAIL', e.message); server.close(); process.exitCode = 1; });
