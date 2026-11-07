import { expect, test, type Page } from '@playwright/test';
import type {} from './native-worksheet.fixture';

async function ready(page: Page, sample: string) {
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet?.currentSample())).toBe(sample);
    await expect
        .poll(() =>
            page.evaluate(async () => {
                try {
                    const result = await window.__nativeWorksheet.export('svg');
                    return Array.isArray(result) ? result[0] : result.combinedData;
                } catch {
                    return '';
                }
            }),
        )
        .toContain(sample === 'bin' ? 'Amount' : 'Revenue');
}

for (const mode of ['editor', 'viewer']) {
    test.describe(mode, () => {
        test('sample switch does not report a superseded bin query against fold data', async ({ page }, info) => {
            const errors: string[] = [];
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });
            await page.goto(`/tests/e2e/native-worksheet.html?mode=${mode}`);
            await expect.poll(() => page.evaluate(() => Boolean(window.__nativeWorksheet))).toBe(true);
            await page.evaluate(() => window.__nativeWorksheet.setSample('bin'));
            await ready(page, 'bin');
            const start = await page.evaluate(() => window.__nativeWorksheet.queryCount());
            await page.evaluate(() => window.__nativeWorksheet.setSample('same-name-fold'));
            await ready(page, 'same-name-fold');
            const evidence = await page.evaluate(
                (start) => ({
                    queries: window.__nativeWorksheet.queries().slice(start),
                    results: window.__nativeWorksheet.results().filter((item) => item.queryIndex >= start),
                    errors: window.__nativeWorksheet.importErrors(),
                    status: window.__nativeWorksheet.renderStatus(),
                    modal: window.__nativeWorksheet.getStore()?.showErrorResolutionPanel,
                }),
                start,
            );
            await info.attach('computation-switch.json', {
                body: JSON.stringify({ start, ...evidence, consoleErrors: errors }, null, 2),
                contentType: 'application/json',
            });
            expect(evidence.errors).toEqual([]);
            expect(evidence.modal).toBe(0);
        });

        test('an already running old computation cannot report over a newer completed chart', async ({ page }) => {
            await page.goto(`/tests/e2e/native-worksheet.html?mode=${mode}&sample=bin`);
            await ready(page, 'bin');
            await page.evaluate(() => {
                const api = window.__nativeWorksheet;
                api.setQueryMode('hold');
                api.setData([...api.getData(), { Amount: 50 }]);
            });
            await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.pendingCount())).toBeGreaterThan(0);
            await page.evaluate(() => window.__nativeWorksheet.setSample('same-name-fold'));
            await ready(page, 'same-name-fold');
            await page.evaluate(async () => {
                const api = window.__nativeWorksheet;
                while (api.pendingCount()) api.reject();
                await new Promise(requestAnimationFrame);
            });
            expect(await page.evaluate(() => window.__nativeWorksheet.importErrors())).toEqual([]);
            expect(await page.evaluate(() => window.__nativeWorksheet.getStore()?.showErrorResolutionPanel)).toBe(0);
        });

        test('the current computation error remains reportable after a display-only chart update', async ({ page }) => {
            await page.goto(`/tests/e2e/native-worksheet.html?mode=${mode}&sample=bin`);
            await ready(page, 'bin');
            await page.evaluate(() => {
                const api = window.__nativeWorksheet;
                api.setQueryMode('hold');
                api.setData([...api.getData(), { Amount: 50 }]);
            });
            await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.pendingCount())).toBeGreaterThan(0);
            const count = await page.evaluate(() => window.__nativeWorksheet.queryCount());
            await page.evaluate(async () => {
                const api = window.__nativeWorksheet,
                    chart = api.getChart();
                chart.layout.primaryColor = '#ff0000';
                chart.layout.useSvg = !chart.layout.useSvg;
                api.setChart(chart);
                await new Promise(requestAnimationFrame);
            });
            expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(count);
            await page.evaluate(() => {
                const api = window.__nativeWorksheet;
                while (api.pendingCount()) api.reject();
            });
            await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getStore()?.showErrorResolutionPanel)).toBe(501);
            expect(await page.evaluate(() => window.__nativeWorksheet.importErrors())).toEqual(
                expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining('Fixture deferred query failure') })]),
            );
            await expect(page.locator('[data-renderer="native"]').getByRole('alert')).toContainText('Fixture deferred query failure');
        });
    });
}
