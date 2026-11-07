// Run from the repository root with the frozen 4178 demo already running.
// HEADLESS=1 avoids changing the foreground; the recorded run was headed.
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADLESS === '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:4178/');
  const environment = await page.evaluate(async () => { const ts=[]; for (let i=0;i<181;i++) ts.push(await new Promise(requestAnimationFrame)); const intervals=ts.slice(1).map((x,i)=>x-ts[i]).sort((a,b)=>a-b); return { ua:navigator.userAgent, dpr:devicePixelRatio, width:innerWidth, height:innerHeight, rafP50:intervals[90], rafP95:intervals[170] }; });
  await page.evaluate(async () => {
    const demo = window.worksheetDemo;
    await demo.setExample('controlled');
    const view = demo.view, update = view.update;
    window.timing = { commits: [], waits: [] };
    view.update = async (...args) => {
      const start = performance.now(), result = await update(...args);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.timing.commits.push({ ms: performance.now() - start, status: result.status });
      return result;
    };
    document.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key.toLowerCase() === 's') window.lastTimingKey = { key: event.key, at: performance.now() };
    }, true);
    new MutationObserver(() => {
      const state = [...document.querySelectorAll('[role=status]')].find(element => !element.hidden && element.textContent.includes('Waiting for host'));
      const key = window.lastTimingKey;
      if (state && key && !window.timing.waits.some(record => record.at === key.at))
        window.timing.waits.push({ ...key, ms: performance.now() - key.at, text: state.textContent });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const proxy = page.locator('[role=button][tabindex="0"]');
  await proxy.focus();
  await proxy.press('h');
  for (const key of ['Enter', 's']) for (let i = 0; i < 12; i++) {
    const count = await page.evaluate(() => window.timing.commits.length);
    await proxy.press(key);
    await page.waitForFunction(count => window.timing.commits.length > count, count);
  }
  process.stdout.write(JSON.stringify({ url:process.env.DEMO_URL || 'http://127.0.0.1:4178/', environment, timing:await page.evaluate(() => window.timing) }, null, 2) + '\n');
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
