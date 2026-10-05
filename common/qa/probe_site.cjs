const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
try{await p.goto(process.argv[2],{waitUntil:'networkidle',timeout:45000});}catch(e){console.log('goto',e.message)}
const r=await p.evaluate(()=>{const pick=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);return {sel:s,font:c.fontFamily,size:c.fontSize,weight:c.fontWeight,color:c.color,bg:c.backgroundColor,ls:c.letterSpacing,tt:c.textTransform,radius:c.borderRadius,border:c.border}};
 const fonts=new Set();document.querySelectorAll('*').forEach(e=>fonts.add(getComputedStyle(e).fontFamily));
 const links=[...document.querySelectorAll('link[rel=stylesheet],link[href*=font]')].map(l=>l.href).slice(0,10);
 return {title:document.title,fonts:[...fonts].slice(0,12),links,body:pick('body'),h1:pick('h1'),h2:pick('h2'),a:pick('a'),button:pick('button'),nav:pick('nav')}});
console.log(JSON.stringify(r,null,1));await p.screenshot({path:'site.png'});await b.close();})();
