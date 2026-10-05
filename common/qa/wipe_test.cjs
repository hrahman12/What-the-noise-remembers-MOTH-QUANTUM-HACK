const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const web=path.resolve('../../site/web');const T={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const s=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(web,u==='/'?'index.html':u);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(5997,async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});await p.goto('http://127.0.0.1:5997/index.html',{waitUntil:'networkidle'});
const w=await p.$('#wipe');const box=await w.boundingBox();
const v0=await p.$eval('#wipe',e=>e.getAttribute('aria-valuenow')+' '+e.style.cssText);
await p.mouse.click(box.x+box.width*0.8,box.y+box.height/2);
const v1=await p.$eval('#wipe',e=>e.getAttribute('aria-valuenow')+' '+e.style.cssText);
await p.mouse.move(box.x+box.width*0.2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width*0.3,box.y+box.height/2,{steps:4});await p.mouse.up();
const v2=await p.$eval('#wipe',e=>e.getAttribute('aria-valuenow')+' '+e.style.cssText);
await w.focus();await p.keyboard.press('ArrowLeft');
const v3=await p.$eval('#wipe',e=>e.getAttribute('aria-valuenow'));
console.log({v0,v1,v2,v3});await b.close();s.close();});
