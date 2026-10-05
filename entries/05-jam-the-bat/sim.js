// The bat tournament, CLASSICAL simulation: the same game rule (web/core.js), the same autopilot moth and
// the same bat noise for every source (noise seed 1000 + round); only the click-jitter source changes.
// Bank sources read slots in order from slot 0 and never reuse one unless the bank runs out (reported).
//   node sim.js [rounds=500] [--long 4000] [--json out/tournament.json]
// The page's "Run the tournament" button runs the identical code, so its 500-round numbers match these.
const fs = require('fs');
const path = require('path');
const J = require('./web/core.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 500);
const NLONG = +arg('--long', 0);
const outPath = arg('--json', null);
const SEED = 0x5EED2009;                    // the PRNG seed the page shows (leaked); round r uses SEED + r

const jobs = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'jobs.json'), 'utf8'));
const banks = {};
for (const j of jobs) {
  if (j.status !== 'completed' || !j.bytes) continue;
  const o = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', j.name + '.json'), 'utf8')).output;
  banks[j.name] = J.slotsFromBytes(Buffer.from(o.random.hex, 'hex'));
}
const ID = { emu_20p0: 'emu', fez_148p8: 'fez', mar_148p8: 'mar' };

function sources(only) {
  const L = [
    { id: 'none', label: 'Metronome (no jitter)', mk: () => J.makeSource('none'), seed: false },
    { id: 'prng_leaked', label: 'PRNG, seed leaked to the bat', mk: r => J.makeSource('prng', { seed: (SEED + r) >>> 0 }), seed: true },
    { id: 'prng_hidden', label: 'PRNG, seed kept secret', mk: r => J.makeSource('prng', { seed: (SEED + r) >>> 0 }), seed: false },
  ];
  for (const name of Object.keys(banks)) {
    const src = J.makeSource('bank', { slots: banks[name], id: ID[name] });
    L.push({ id: ID[name], label: name, mk: () => src, seed: false, src, slots: banks[name].length });
  }
  return only ? L.filter(s => only.includes(s.id)) : L;
}

function tournament(n, only) {
  const rows = [];
  for (const s of sources(only)) {
    let surv = 0, clicks = 0, hits = 0, caught = 0;
    for (let r = 0; r < n; r++) {
      const res = J.simRound(s.mk(r), { seedKnown: s.seed, noiseSeed: 1000 + r });
      if (res.result === 'escaped') surv++; else if (res.result === 'caught') caught++;
      clicks += res.clicks; hits += res.hits;
    }
    const ci = J.wilson(surv, n);
    rows.push({ id: s.id, label: s.label, n, surv, caught, survival: +(surv / n).toFixed(4), ci95: ci.map(x => +x.toFixed(4)),
      clicks, hits, bat_hit_rate: +(hits / Math.max(1, clicks)).toFixed(4),
      bank_slots_used: s.src ? s.src.used : null, bank_slots: s.slots || null, wrapped: s.src ? s.src.wrapped : null });
    console.log(`${s.label.padEnd(30)} survived ${String(surv).padStart(5)}/${n}  ${(100 * surv / n).toFixed(1).padStart(5)}%  (95% CI ${ci.map(x => (100 * x).toFixed(1)).join('-')}%)  bat guessed ${(100 * hits / Math.max(1, clicks)).toFixed(1)}% of ${clicks} clicks${s.src ? `  [${s.src.used}/${s.slots} slots${s.src.wrapped ? ', WRAPPED' : ''}]` : ''}`);
  }
  const rand = rows.filter(r => !['none', 'prng_leaked'].includes(r.id));
  const h = J.homogeneity(rand);
  console.log(`  unpredictable sources (${rand.map(r => r.id).join(', ')}): chi2 = ${h.chi2.toFixed(2)}, df ${h.df}, p = ${h.p.toFixed(3)}\n`);
  return { rounds: n, rows, homogeneity: { sources: rand.map(r => r.id), chi2: +h.chi2.toFixed(3), df: h.df, p: +h.p.toFixed(4) } };
}

const out = { seed: SEED, noise_seed: '1000 + round', short: tournament(N) };
if (NLONG) out.long = tournament(NLONG, ['prng_hidden', 'fez', 'mar']);
if (outPath) fs.writeFileSync(path.join(__dirname, outPath), JSON.stringify(out, null, 1));
