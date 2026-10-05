// Free check of the POST plumbing (auth header, URL, {params} body) without creating a job:
// the request deliberately breaks the schema (num_qubits 21 > max 20), so Atlas answers 422 before any job exists.
'use strict';
const atlas = require('../app/lib/atlas.js');
const p = atlas.buildParams('ring', 0.4, 'emu');
p.num_qubits = 21;
atlas._atlas('POST', '/engines/graph-v1/process', { params: p })
  .then(r => { console.log('UNEXPECTED: Atlas accepted the job', r); process.exitCode = 1; })
  .catch(e => {
    const ok = /-> 422/.test(e.message) && /num_qubits|maximum|21|schema/i.test(e.message);
    console.log(ok ? 'ok   POST reached Atlas with valid auth and was rejected by schema validation (422), no job created' : 'FAIL ' + e.message);
    console.log('     ' + e.message.slice(0, 240));
    process.exitCode = ok ? 0 : 1;
  });
