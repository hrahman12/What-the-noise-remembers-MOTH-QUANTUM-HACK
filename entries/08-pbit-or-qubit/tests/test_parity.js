// Checks that the JS recipe and exact enumeration (app/lib/ising.js) match the Python ones (problems.py).
const I = require('../app/lib/ising.js');
const ref = require('./py_reference.json');
let worst = 0, mismatches = 0;
for (const r of ref) {
  const ex = I.exactStats(r.edges, r.couplings);
  r.edge_zz.forEach((v, k) => worst = Math.max(worst, Math.abs(v - ex.edge_zz[k])));
  r.mag_hist.forEach((v, k) => worst = Math.max(worst, Math.abs(v - ex.mag_hist[k])));
  const p = I.graphv1Params(r.edges, r.edge_zz, 'emu', 20);
  if (JSON.stringify(p) !== JSON.stringify(r.params)) { mismatches++; console.log('params differ', r.graph, r.J); }
}
console.log('max |exact_js - exact_py| =', worst.toExponential(2), ' recipe mismatches:', mismatches);
if (worst > 1e-9 || mismatches) process.exit(1);
