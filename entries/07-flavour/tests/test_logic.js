// Browser-logic tests: parity with synth.py, #token round trip, exact unitarity.
// usage: python tests/make_cases.py && node tests/test_logic.js
const fs=require('fs'), path=require('path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','web','index.html'),'utf8');
const s=h.split('<script>')[1].split('</script>')[0];
const L=new Function(s+';return {waveFor,level,encodeToken,decodeToken,D,U0,U1,flavourCurve};')();
const cases=JSON.parse(fs.readFileSync(process.argv[3]||path.join(__dirname,'py_cases.json'),'utf8'));
let maxL=0,maxT=0;
for(const c of cases){
  const st={chip:c.chip,mix:c.mix,model:c.model};
  const lv=L.level(st,c.f,c.u); maxL=Math.max(maxL,Math.abs(lv-c.level));
  const w=L.waveFor(st,c.f,c.u);
  // evaluate PeriodicWave series at the same 32 points (every 8th of 256)
  for(let k=0;k<32;k++){const t=k*8/256;let x=0;for(let hh=1;hh<=63;hh++)x+=w.real[hh]*Math.cos(2*Math.PI*hh*t)+w.imag[hh]*Math.sin(2*Math.PI*hh*t);maxT=Math.max(maxT,Math.abs(x-c.tab[k]));}
}
console.log('cases',cases.length,'max level diff',maxL.toExponential(2),'max wave diff',maxT.toExponential(2));
if(maxL>1e-6||maxT>1e-4){console.error('PARITY FAIL');process.exit(1);}
// token round trip
const st={chip:L.D.machines.length-1,u:Math.log10(1234),mix:0.37,model:2,flight:0.12};
const tok=L.encodeToken(st), back=L.decodeToken('#'+tok);
console.log('token',tok, JSON.stringify(back));
if(!/^[A-Za-z0-9._~-]+$/.test(tok)) {console.error('token has bad chars');process.exit(1);}
if(back.chip!==st.chip||back.model!==2||Math.abs(back.mix-0.37)>1e-9||Math.abs(10**back.u-1234)>0.6||Math.abs(back.flight-0.12)>1e-9){console.error('token mismatch');process.exit(1);}
for(const bad of ['', '#x~1~2', '#nochip~100~50~3~0', '#aer~-5~50~3~0', '#aer~100~50~4~0']) if(L.decodeToken(bad)!==null){console.error('accepted bad token',bad);process.exit(1);}
// unitarity of exact curves at mix 0
let worst=0; for(let u=L.U0;u<=L.U1;u+=0.01){let s=0;for(let f=0;f<3;f++)s+=L.flavourCurve({chip:0,mix:0,model:3},f,u);worst=Math.max(worst,Math.abs(s-1));}
console.log('exact sum |P-1| max',worst.toExponential(2)); if(worst>1e-3){process.exit(1);}
console.log('ALL LOGIC TESTS PASSED');
