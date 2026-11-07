// Independent browser probe: actual GW computation and native renderer, host-supplied raw rows.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async()=>{
 const base=process.env.GW_URL||'http://127.0.0.1:4194', out={};
 const b=await chromium.launch({headless:true}),p=await b.newPage({viewport:{width:1440,height:1050}});
 await p.goto(`${base}/tests/e2e/native-worksheet.html?sample=boxplot`);
 const native=p.locator('[data-renderer=native]'); await native.locator('svg').waitFor();
 const before=await p.evaluate(()=>window.__nativeWorksheet.queryCount());
 await p.evaluate(()=>{
  const api=window.__nativeWorksheet, chart=api.getChart(), region=chart.encodings.dimensions.find(x=>x.fid==='Region');
  chart.config.limit=5;chart.encodings.filters=[{...region,rule:{type:'one of',value:['East']}}];
  const rows=Array.from({length:12050},(_,i)=>({Region:'East',Category:'Bulk',Value:i<12000?1:100,__datumKey:`e${i}`}));
  rows.push(...[1,2,3,100].map((v,i)=>({Region:'East',Category:'Small',Value:v,__datumKey:`s${i}`})),{Region:'East',Category:'Empty',Value:null,__datumKey:'empty'},{Region:'West',Category:'Hidden',Value:777,__datumKey:'w'});
  api.setChart(chart);api.setData(rows);
 });
 await p.waitForFunction(n=>window.__nativeWorksheet.results().some(r=>r.queryIndex>=n&&r.rows.length===12055),before,{timeout:90000});
 await native.locator('svg').waitFor();await p.waitForTimeout(250);
 out.filtered=await p.evaluate(()=>{const api=window.__nativeWorksheet,r=api.results().findLast(r=>r.rows.length===12055);return {rows:r.rows.length,query:api.queries()[r.queryIndex],lastBulk:r.rows.filter(x=>x.Category==='Bulk').slice(-2),categories:[...new Set(r.rows.map(x=>x.Category))]}});
 assert.equal(out.filtered.rows,12055);assert(out.filtered.query.limit==null,JSON.stringify(out.filtered.query));assert.deepEqual(out.filtered.categories.sort(),['Bulk','Empty','Small']);
 out.filtered.svgText=await native.locator('svg').textContent();
 await p.screenshot({path:'docs/verification/s4/box-filtered.png'});
 // A tiny isolated distribution makes the finite sample whisker geometry and event values readable.
 const q=await p.evaluate(()=>window.__nativeWorksheet.queryCount());
 await p.evaluate(()=>{const api=window.__nativeWorksheet;api.setData([{Region:'East',Category:'Small',Value:1},{Region:'East',Category:'Small',Value:2},{Region:'East',Category:'Small',Value:3},{Region:'East',Category:'Small',Value:100},{Region:'East',Category:'Empty',Value:null}])});
 await p.waitForFunction(n=>window.__nativeWorksheet.results().some(r=>r.queryIndex>=n&&r.rows.length===5),q,{timeout:30000});
 await p.waitForTimeout(400);
 out.small=await native.evaluate(root=>{const svg=root.querySelector('svg');const items=[...svg.querySelectorAll('[data-command]')].filter(e=>e.getAttribute('data-command').startsWith('[\"boxplot\"'));const commands=items.map(e=>{const r=e.getBoundingClientRect();return {id:e.getAttribute('data-command'),tag:e.tagName,fill:e.getAttribute('fill'),stroke:e.getAttribute('stroke'),bounds:{x:r.x,y:r.y,w:r.width,h:r.height}}});return {texts:[...svg.querySelectorAll('text')].map(x=>x.textContent),commands}});
 const box=out.small.commands.find(x=>x.id.endsWith(':box'));assert(box,'no box geometry');
 const point={x:box.bounds.x+box.bounds.w/2,y:box.bounds.y+box.bounds.h/2};
 await p.mouse.move(point.x,point.y);await native.getByRole('tooltip').waitFor();await p.mouse.click(point.x,point.y);await p.waitForFunction(()=>window.__nativeWorksheet.events().length>0);
 out.small.event=await p.evaluate(()=>window.__nativeWorksheet.events().at(-1));out.small.tooltip=await native.getByRole('tooltip').innerText().catch(()=>null);
 out.small.after=await native.evaluate(root=>[...root.querySelectorAll('svg [data-command]')].filter(e=>e.getAttribute('data-command').startsWith('["boxplot"')).map(e=>({id:e.getAttribute('data-command'),tag:e.tagName,fill:e.getAttribute('fill'),stroke:e.getAttribute('stroke')})));
 await p.screenshot({path:'docs/verification/s4/box-small-selected.png'});
 out.small.selectedValues=out.small.event.targets[0].values.filter(x=>x.field.fid==='Value').map(x=>x.value);
 assert.deepEqual(out.small.selectedValues,[1,1.75,2.5,27.25,3]);
 assert(out.small.texts.includes('Empty'));assert(out.small.texts.includes('Small'));
 assert.equal(out.small.commands.length,10);assert.equal(out.small.after.length,10);
 assert(out.small.commands.every(x=>(x.tag==='rect'?x.fill:x.stroke)==='#2563eb'));
 assert(out.small.after.every(x=>(x.tag==='rect'?x.fill:x.stroke)==='#ea580c')); 
 await fs.writeFile('docs/verification/s4/box-independent.json',JSON.stringify(out,null,2));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
