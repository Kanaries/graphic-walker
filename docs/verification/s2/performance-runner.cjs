// Run from repository root. BENCH_URL selects the frozen server, OUT_DIR selects the report directory.
// One browser/process at a time; save individual reports before the next case.
const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const [which = 'B2', mode = 'reference'] = process.argv.slice(2);
  const stress = which === 'B5-stress';
  const id = stress ? 'B5' : which;
  const browser = await chromium.launch({ headless: true, args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const url = process.env.BENCH_URL || 'http://127.0.0.1:4189/';
  const outDir = process.env.OUT_DIR || 'docs/verification/s3';
  await page.goto(url);
  await page.waitForFunction(() => !!window.worksheetBenchmark);
  const meta = await page.evaluate(() => ({ ua: navigator.userAgent, dpr: devicePixelRatio, gc: typeof window.gc }));
  const result = mode === 'end-to-end'
    ? await page.evaluate(() => window.worksheetBenchmark.runEndToEnd('B3', { samples: 30, backend: 'canvas' }))
    : await page.evaluate(async ({ id, stress }) => {
        await window.worksheetBenchmark.prepare(id, { backend: id === 'B5' ? 'svg' : 'canvas', svgStress: stress });
        return window.worksheetBenchmark.run({ profile: 'reference', lifecycle: true, ...(stress ? { trajectory: 'pixels', maxPixelOffset: 20 } : {}) });
      }, { id, stress });
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `performance-${which}-${mode}.json`), JSON.stringify({ url, meta, result }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
