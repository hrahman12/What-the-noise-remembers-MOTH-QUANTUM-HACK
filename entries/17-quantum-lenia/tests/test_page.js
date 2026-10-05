// Unit tests for the page's pure logic (node tests/test_page.js). Runs the inline script of web/index.html
// with no DOM, then checks the Lenia step against Python (lenia.py) and the helper functions.
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
const scripts = html.split("<script>").slice(1).map(s => s.split("</script>")[0]);
for (const s of scripts) new Function(s)();            // parse + run (document is undefined -> no DOM code)
const Q = globalThis.__QL, N = Q.N;
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

// 1. Lenia step matches Python to float precision
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, "ref.json"), "utf8"));
const R = new Float64Array(Uint8Array.from(Buffer.from(ref.A20_ring_q50, "base64")).buffer);
const w = Q.makeWorld(); Q.seedScene(w.A); w.K = Q.kernelFFT(Q.kernelBlock("ring", "q50"));
const t0 = Date.now(); for (let i = 0; i < 20; i++) Q.lstep(w); const ms = (Date.now() - t0) / 20;
let md = 0; for (let i = 0; i < N * N; i++) md = Math.max(md, Math.abs(w.A[i] - R[i]));
ok(md < 1e-9, `20 steps (ring, blur 0.5) match Python: max |diff| = ${md.toExponential(2)}`);
console.log(`     ${ms.toFixed(1)} ms per step in node`);
ok(w.t === 20, "step counter");

// 2. scene and blob counter
const s = Q.makeWorld(); Q.seedScene(s.A); ok(Q.blobs(s.A) === 5, "default scene has 5 Orbium-sized blobs");
// 3. kernel blocks are the engine outputs: blur keeps mass inside the block, original ring is hollow
const ko = Q.kernelBlock("ring", "o"), kq = Q.kernelBlock("ring", "q50");
ok(ko.length === 1024 && kq.length === 1024, "32x32 kernel blocks");
ok(ko[16 * 32 + 16] === 0 && kq[16 * 32 + 16] > 0, "original ring is hollow at the centre, blurred one is not");
const po = Q.profile(ko); ok(po.indexOf(Math.max(...po)) >= 6 && po.indexOf(Math.max(...po)) <= 7, "original ring peaks at r = 6-7 (R/2)");
// 4. tokens
const tk = {shell: "poly", set: "q25", mu: 0.15, sigma: 0.015, seed: "nq50"};
ok(JSON.stringify(Q.parseToken("#" + Q.token(tk))) === JSON.stringify(tk), "share token round-trips: " + Q.token(tk));
ok(/^[A-Za-z0-9._~-]+$/.test(Q.token(tk)), "token uses allowed characters only");
ok(Q.parseToken("#ring.q75.m150.g150.d") === null && Q.parseToken("#evil") === null && Q.parseToken("#ring.o.m900.g150.d") === null, "bad tokens rejected");
// 5. aim: dragging along a stamp's measured heading picks that stamp
let allAim = true;
const STAMPS = scripts.join("").match(/const STAMPS = (\[.*?\]);/s); const st = JSON.parse(STAMPS[1]);
for (let t = 0; t < 8; t++) if (Q.aim(st[t].heading[0], st[t].heading[1]) !== t) allAim = false;
ok(allAim, "aim() picks the orientation whose measured heading matches the drag");
// 6. snapshot seed lands centred and is the blurred output
const sw = Q.makeWorld(); Q.seedSnap(sw.A, "q50"); let m = 0, outside = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = sw.A[y * N + x]; m += v; if ((y < 64 || y >= 192 || x < 64 || x >= 192) && v) outside++; }
ok(outside === 0 && m > 300, `snapshot seed sits in [64,192)^2, mass ${m.toFixed(1)}`);
// 7. fate text comes from measured data
ok(/0\.29/.test(Q.fateText("ring", "q50")) && /floods/.test(Q.fateText("ring", "q100")) && /breaks up/.test(Q.fateText("bell", "q50")), "fate texts reflect dynamics.json");
// 8. brush and stamp wrap on the torus
const bw = Q.makeWorld(); Q.stamp(bw.A, 0, 0, 0); let wrapped = 0; for (let i = 0; i < N * N; i++) if (bw.A[i]) wrapped++;
ok(wrapped > 100 && bw.A[(N - 5) * N + (N - 5)] >= 0, "stamp at the corner wraps around the torus");
Q.brush(bw.A, 10, 10, 6, "erase", Math.random); ok(bw.A[10 * N + 10] === 0, "erase clears cells");
const lut = Q.lut(); ok(lut.length === 3072 && lut[0] === 251 && lut[1] === 250 && lut[2] === 249 && lut[3069] === 25 && lut[3070] === 35 && lut[3071] === 142, "colour map runs from brand paper (empty) to brand ink (full)");
let mono = true; for (let i = 3; i < 3072; i += 3) if (lut[i] + lut[i + 1] + lut[i + 2] > lut[i - 3] + lut[i - 2] + lut[i - 1]) mono = false; ok(mono, "colour map darkens monotonically with value");
console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
