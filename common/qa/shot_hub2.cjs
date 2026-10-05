const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const web=path.resolve('../../site/web');const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(web,u==='/'?'index.html':u);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(5996,async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1280,height:1700}});await p.goto('http://127.0.0.1:5996/index.html',{waitUntil:'networkidle'});
await p.hover('#parade a:nth-child(5)');await p.waitForTimeout(400);await p.screenshot({path:'../../site/qa/hero-desktop.png'});
const m=await b.newPage({viewport:{width:375,height:1500}});await m.goto('http://127.0.0.1:5996/index.html',{waitUntil:'networkidle'});await m.screenshot({path:'../../site/qa/hero-mobile.png'});
await b.close();s.close();});
