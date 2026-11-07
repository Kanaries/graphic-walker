const {chromium}=require('@playwright/test');
const fs=require('node:fs/promises');
(async()=>{
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await p.addInitScript(()=>{const C=CanvasRenderingContext2D.prototype;window._draw=[];let clear=C.clearRect,save=C.save;C.clearRect=function(...a){window._draw=[];return clear.apply(this,a)};C.save=function(){window._draw.push({calls:[]});return save.call(this)};for(const n of ['rect','fillRect','strokeRect','arc','moveTo','lineTo','fillText']){let old=C[n];C[n]=function(...args){let e=window._draw.at(-1);if(e)e.calls.push({n,args});return old.apply(this,args)}}});
let output=[];
for(const example of ['long-bilingual-labels']){
 await p.goto('http://127.0.0.1:4191/semantic-long.html');await p.waitForFunction(()=>window.semantic);await p.selectOption('#fixture',example);await p.waitForTimeout(100);
 const canvas=await p.evaluate(()=>({draw:window._draw,frame:window.semantic.view.getViewState().frame}));
 await p.selectOption('#backend','svg');await p.waitForTimeout(100);
 const svg=await p.evaluate(()=>{let v=window.semantic.view.getViewState(),nodes=[...document.querySelectorAll('#worksheet svg [data-command]')];return {hits:v.frame.hits.map(h=>h.id),nodes:nodes.map(n=>{let m=n.getCTM(),id=n.getAttribute('clip-path')?.match(/#([^)]*)/)[1],clip=id&&document.getElementById(id)?.querySelector('rect');let chain=[];for(let x=n;x&&x.tagName!=='svg';x=x.parentElement){let z=x.getAttribute('clip-path')?.match(/#([^)]*)/)[1],r=z&&document.getElementById(z)?.querySelector('rect'),t=x.getCTM?.();if(r&&t)chain.push([+r.getAttribute('x')*t.a+t.e,+r.getAttribute('y')*t.d+t.f,+r.getAttribute('width')*t.a,+r.getAttribute('height')*t.d])}return {id:n.getAttribute('data-command'),tag:n.tagName,attrs:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),m:[m.a,m.b,m.c,m.d,m.e,m.f],text:n.textContent,clip:clip?['x','y','width','height'].map(k=>+clip.getAttribute(k)):null,chain}})}});
 const map=new Map(svg.nodes.map(n=>[n.id,n]));let diffs=[],errors=[],current='';let comp=(name,a,b)=>{if(!Number.isFinite(a)||!Number.isFinite(b)){errors.push(`${name} non-finite ${a} ${b}`);return}diffs.push({d:Math.abs(a-b),name,a,b,current})};
 canvas.frame.commands.forEach((c,i)=>{current=c.id;let calls=canvas.draw[i]?.calls||[],node=map.get(c.id),p=c.primitive;if(!node){errors.push('missing svg '+c.id);return}let m=node.m,attr=node.attrs,tx=x=>m[0]*x+m[4],ty=y=>m[3]*y+m[5],call=n=>calls.find(x=>x.n===n)?.args,clip=call('rect');if(!clip||!node.clip){errors.push('missing clip '+c.id);return}let sc=node.chain.reduce((a,b)=>{let x=Math.max(a[0],b[0]),y=Math.max(a[1],b[1]),r=Math.min(a[0]+a[2],b[0]+b[2]),t=Math.min(a[1]+a[3],b[1]+b[3]);return [x,y,Math.max(0,r-x),Math.max(0,t-y)]});clip.forEach((v,k)=>comp('clip',v,sc[k]));
 let values=[],other=[];
 if(p.kind==='rect'){values=call('fillRect')||[];other=[tx(+attr.x),ty(+attr.y),+attr.width*m[0],+attr.height*m[3]]}
 if(p.kind==='circle'){values=(call('arc')||[]).slice(0,3);other=[tx(+attr.cx),ty(+attr.cy),+attr.r*m[0]]}
 if(p.kind==='line'){values=[...(call('moveTo')||[]),...(call('lineTo')||[])];other=[tx(+attr.x1),ty(+attr.y1),tx(+attr.x2),ty(+attr.y2)]}
 if(p.kind==='text'){let t=call('fillText')||[];if(t[0]!==node.text)errors.push('text mismatch '+c.id);values=t.slice(1,3);other=[tx(+attr.x),ty(+attr.y)]}
 if(p.kind==='path'){values=calls.filter(x=>x.n==='moveTo'||x.n==='lineTo').flatMap(x=>x.args);let nums=(attr.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(Number);other=nums.map((v,k)=>k%2?ty(v):tx(v))}
 if(values.length!==other.length||!values.length)errors.push(`geometry arity ${p.kind} ${values.length}/${other.length}`); else values.forEach((v,k)=>comp(p.kind,v,other[k]));});
 output.push({example,commands:canvas.frame.commands.length,canvasDraw:canvas.draw.length,svgNodes:svg.nodes.length,canvasHits:canvas.frame.hits.length,svgHits:svg.hits.length,sameHits:JSON.stringify(canvas.frame.hits.map(h=>h.id))===JSON.stringify(svg.hits),compared:diffs.length,maxError:Math.max(...diffs.map(x=>x.d),0),worst:diffs.sort((a,b)=>b.d-a.d).slice(0,2),errors:errors.slice(0,8),errorCount:errors.length});
}
await fs.writeFile('work/geometry-long-result.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));await b.close();})().catch(e=>{console.error(e);process.exitCode=1});
