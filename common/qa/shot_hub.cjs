const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const web=path.resolve('../../site/web');const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const s=http.createServer((q,r)=>{const f=path.join(web,decodeURIComponent(q.url.split('?')[0])==='/'?'index.html':decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(5994,async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});await p.goto('http://127.0.0.1:5994/index.html',{waitUntil:'networkidle'});
await p.click('#open-all');await p.evaluate(()=>document.getElementById('index').scrollIntoView());await p.waitForTimeout(500);
await p.screenshot({path:'../../site/qa/index.png'});await b.close();s.close();});
