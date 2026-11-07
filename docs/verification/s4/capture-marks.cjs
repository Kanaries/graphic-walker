// Independent visual capture of the real GW production fixture; run from repository root.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
(async () => {
  const base=process.env.GW_URL||'http://127.0.0.1:4194';
  const names=['circle','tick','auto-tick','area','trail','pie','donut','pie-size','bar-normalize','bar-center','area-normalize','area-center','boxplot'];
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  const out=[];
  for(const name of names){
    await page.goto(`${base}/tests/e2e/native-worksheet.html?sample=${name}`);
    await page.locator('[data-renderer=native][aria-busy=false]').waitFor();
    await page.waitForFunction(async()=>{try{await window.__nativeWorksheet.export('svg');return true}catch{return false}});
    const svg=await page.locator('[data-renderer=native]').evaluate(n=>{return {summary:n.querySelector('[aria-live=polite]')?.textContent,svg:n.querySelectorAll('svg').length,canvas:n.querySelectorAll('canvas').length,panes:n.querySelectorAll('[data-pane]').length,commands:n.querySelectorAll('[data-command]').length,alerts:[...n.querySelectorAll('[role=alert]')].map(x=>x.textContent)}});
    await page.screenshot({path:`docs/verification/s4/${name}-svg.png`});
    await page.evaluate(()=>window.__nativeWorksheet.setBackend(false));
    await page.locator('[data-renderer=native][aria-busy=false] canvas').waitFor();
    await page.waitForFunction(async()=>{try{await window.__nativeWorksheet.export('svg');return true}catch{return false}});
    const canvas=await page.locator('[data-renderer=native]').evaluate(n=>{return {summary:n.querySelector('[aria-live=polite]')?.textContent,svg:n.querySelectorAll('svg').length,canvas:n.querySelectorAll('canvas').length,alerts:[...n.querySelectorAll('[role=alert]')].map(x=>x.textContent)}});
    await page.screenshot({path:`docs/verification/s4/${name}-canvas.png`});
    out.push({name,svg,canvas});
  }
  await fs.writeFile('docs/verification/s4/capture-marks.json',JSON.stringify(out,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
