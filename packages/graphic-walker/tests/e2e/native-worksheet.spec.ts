import { expect, test, type Page } from '@playwright/test';
import type {} from './native-worksheet.fixture';

const fixtureUrl = process.env.NATIVE_WORKSHEET_URL ?? 'http://127.0.0.1:4186/tests/e2e/native-worksheet.html';
const native = (page: Page) => page.locator('[data-renderer="native"]');

async function ready(page: Page) {
    await expect(native(page)).toHaveCount(1);
    await expect(native(page)).toHaveAttribute('aria-busy', 'false');
    await expect(native(page).getByRole('alert')).toHaveCount(0);
    // Public ref exports wait for the complete current viewport. This checks a real
    // committed result rather than treating a mounted Canvas as readiness.
    await expect
        .poll(() =>
            page.evaluate(async () => {
                try {
                    await window.__nativeWorksheet.export('svg');
                    return true;
                } catch {
                    return false;
                }
            }),
        )
        .toBe(true);
}
async function open(page: Page, mode = 'pure') {
    await page.goto(`${fixtureUrl}?mode=${mode}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.__nativeWorksheet))).toBe(true);
    await ready(page);
}
async function svg(page: Page) {
    return page.evaluate(async () => {
        const result = await window.__nativeWorksheet.export('svg');
        return Array.isArray(result) ? result[0] : result.combinedData!;
    });
}
async function exportError(page: Page) {
    return page.evaluate(async () => {
        try {
            await window.__nativeWorksheet.export('svg');
            return '';
        } catch (error) {
            return error instanceof Error ? error.message : String(error);
        }
    });
}
async function simple(page: Page, label = 'Baseline') {
    await page.evaluate((label) => {
        const api = window.__nativeWorksheet,
            chart = api.getChart();
        chart.encodings.rows = [chart.encodings.dimensions.find((field) => field.fid === 'Region')!];
        chart.encodings.columns = [chart.encodings.measures.find((field) => field.fid === 'Sales')!];
        api.setChart(chart);
        api.setData([{ Region: label, Sales: 101 }]);
    }, label);
    await ready(page);
    await expect.poll(() => svg(page)).toContain(label);
}

test('PureRenderer exposes all four public export methods with actual SVG/PNG downloads', async ({ page }, testInfo) => {
    await open(page);
    expect(await page.evaluate(() => window.__nativeWorksheet.refMethods())).toEqual(
        expect.arrayContaining(['getSVGData', 'getCanvasData', 'downloadSVG', 'downloadPNG']),
    );
    const exports = await page.evaluate(async () => ({ svg: await window.__nativeWorksheet.export('svg'), png: await window.__nativeWorksheet.export('png') }));
    expect(Array.isArray(exports.svg) && exports.svg.length).toBe(1);
    expect(Array.isArray(exports.png) && exports.png.length).toBe(1);
    expect((exports.svg as string[])[0]).toMatch(/^<svg\b/);
    expect((exports.png as string[])[0]).toMatch(/^data:image\/png;base64,/);
    for (const format of ['svg', 'png'] as const) {
        const downloadEvent = page.waitForEvent('download');
        const result = await page.evaluate((format) => window.__nativeWorksheet.download(format), format);
        const download = await downloadEvent;
        expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
        expect(result).toHaveLength(1);
        expect(result[0]).toMatch(format === 'svg' ? /^<svg\b/ : /^data:image\/png;base64,/);
        await download.saveAs(testInfo.outputPath(`native-public-ref.${format}`));
    }
});

test('Canvas/SVG, theme and static color updates preserve the completed computation result', async ({ page }) => {
    await open(page);
    const initialChart = await page.evaluate(() => window.__nativeWorksheet.getChart());
    const count = await page.evaluate(() => window.__nativeWorksheet.queryCount());
    await expect(native(page).locator('canvas')).toHaveCount(1);
    await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            chart = api.getChart();
        chart.layout.useSvg = true;
        api.setChart(chart);
    });
    await ready(page);
    await expect(native(page).locator('svg')).toHaveCount(1);
    await expect(native(page).locator('canvas')).toHaveCount(0);
    const light = await svg(page);
    await page.evaluate(() => window.__nativeWorksheet.setDark(true));
    await ready(page);
    await expect.poll(() => svg(page)).not.toBe(light);
    await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            chart = api.getChart();
        chart.layout.primaryColor = '#ee1122';
        chart.layout.useSvg = false;
        api.setChart(chart);
    });
    await ready(page);
    await expect(native(page).locator('canvas')).toHaveCount(1);
    expect(await svg(page)).toContain('#ee1122');
    expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(count);
    const finalChart = await page.evaluate(() => window.__nativeWorksheet.getChart());
    expect(finalChart.encodings).toEqual(initialChart.encodings);
    expect(finalChart.config).toEqual(initialChart.config);
});

for (const renderer of ['vega-lite', 'observable-plot'] as const) {
    test(`deep ${renderer} input keeps every field and requires an explicit native choice`, async ({ page }) => {
        await open(page);
        const original = await page.evaluate(() => window.__nativeWorksheet.getChart());
        const count = await page.evaluate(() => window.__nativeWorksheet.queryCount());
        await page.evaluate((renderer) => {
            const api = window.__nativeWorksheet,
                chart = api.getChart();
            chart.layout.renderer = renderer;
            api.setChart(chart);
        }, renderer);
        await expect(page.getByRole('alert')).toContainText('cannot display all fields');
        await expect(native(page)).toHaveCount(0);
        expect((await page.evaluate(() => window.__nativeWorksheet.getChart())).layout.renderer).toBe(renderer);
        expect((await page.evaluate(() => window.__nativeWorksheet.getChart())).encodings).toEqual(original.encodings);
        await page.getByRole('button', { name: 'Use Native Worksheet', exact: true }).click();
        await ready(page);
        const restored = await page.evaluate(() => window.__nativeWorksheet.getChart());
        expect(restored.layout.renderer).toBe('native');
        expect(restored.encodings).toEqual(original.encodings);
        expect(restored.config).toEqual(original.config);
        expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(count);
    });
}

for (const sample of ['bin', 'binCount'] as const) {
    test(`real GW ${sample} sample computes standard ordinal fields before native rendering`, async ({ page }) => {
        await page.goto(`${fixtureUrl}?sample=${sample}`);
        await ready(page);
        await expect(page.getByLabel('Acceptance sample')).toHaveValue(sample);
        const actual = await page.evaluate(() => {
            const api = window.__nativeWorksheet,
                result = api.results().at(-1)!;
            return { chart: api.getChart(), data: api.getData(), rows: result.rows, query: api.queries()[result.queryIndex] };
        });
        expect(actual.chart.encodings.columns[0]).toMatchObject({
            semanticType: 'ordinal',
            analyticType: 'dimension',
            computed: true,
            expression: { op: sample, num: 4 },
        });
        expect(actual.data).toHaveLength(8);
        expect(actual.data.every((row) => row.AmountBucket === undefined)).toBe(true);
        expect(actual.query.workflow.find((step) => step.type === 'transform')).toMatchObject({
            transform: expect.arrayContaining([expect.objectContaining({ expression: expect.objectContaining({ op: sample, num: 4 }) })]),
        });
        expect(actual.rows.map((row) => row.AmountBucket)).toEqual(
            sample === 'bin'
                ? [
                      [0, 10],
                      [10, 20],
                      [20, 30],
                      [30, 40],
                  ]
                : [1, 2, 3, 4],
        );
        const count = actual.chart.encodings.rows[0];
        expect(actual.rows.map((row) => row[`${count.fid}_${count.aggName}`])).toEqual([2, 2, 2, 2]);
        await expect(native(page).locator('[aria-live="polite"]')).toContainText('4 visible chart items');
        const proxy = native(page).locator('[role="button"][tabindex="0"]');
        await proxy.focus();
        await proxy.press('Enter');
        const selected = await page.evaluate(() =>
            window.__nativeWorksheet
                .events()
                .at(-1)!
                .targets[0].values.find((value) => value.field.fid === 'AmountBucket'),
        );
        expect(selected?.raw).toEqual(sample === 'bin' ? [0, 10] : 1);
        expect(selected?.field.semanticType).toBe('ordinal');
        expect(await svg(page)).toMatch(/^<svg\b/);
    });
}

test('same-name measure fold sample uses real aggregate rows and keeps branch identities distinct', async ({ page }) => {
    await open(page);
    await page.getByLabel('Acceptance sample').selectOption('same-name-fold');
    await ready(page);
    const actual = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            result = api.results().at(-1)!;
        return { chart: api.getChart(), data: api.getData(), rows: result.rows, query: api.queries()[result.queryIndex] };
    });
    expect(actual.chart.config.folds).toEqual(['RevenueA', 'RevenueB']);
    expect(actual.chart.encodings.measures.slice(0, 2).map((field) => field.name)).toEqual(['Revenue', 'Revenue']);
    expect(actual.data).toHaveLength(3);
    expect(actual.rows).toEqual([
        { Category: 'Chair', RevenueA_sum: 12, RevenueB_sum: 15 },
        { Category: 'Paper', RevenueA_sum: 7, RevenueB_sum: 9 },
    ]);
    expect(actual.query.workflow.find((step) => step.type === 'view')).toMatchObject({
        query: [expect.objectContaining({ op: 'aggregate', groupBy: ['Category'] })],
    });
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('2 row positions, 1 column positions');
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('4 visible chart items');
    const proxy = native(page).locator('[role="button"][tabindex="0"]');
    await proxy.focus();
    for (let index = 0; index < 4; index++) {
        await proxy.press('Enter');
        if (index < 3) await proxy.press('ArrowRight');
    }
    const selected = await page.evaluate(() => window.__nativeWorksheet.events().at(-1)!.targets);
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map((target) => target.datumKeys[0])).size).toBe(4);
    const foldFid = actual.chart.encodings.rows[0].fid;
    const branches = selected.map((target) => target.values.find((value) => value.field.fid === foldFid)!);
    expect(new Set(branches.map((value) => value.value)).size).toBe(2);
    expect(new Set(branches.map((value) => value.raw))).toEqual(new Set(['sum(Revenue)']));
    expect(await svg(page)).toContain('sum(Revenue)');
});

test('temporal raw sample keeps source strings and null through GW with stable selected record identities', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.__nativeWorksheet.setSample('temporal-raw'));
    await ready(page);
    const actual = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            result = api.results().at(-1)!;
        return {
            chart: api.getChart(),
            data: api.getData(),
            rows: result.rows,
            query: api.queries()[result.queryIndex],
            localOffset: new Date().getTimezoneOffset(),
        };
    });
    expect(actual.chart.config.defaultAggregated).toBe(false);
    expect(actual.chart.config.timezoneDisplayOffset).toBe(0);
    expect(actual.query.workflow.find((step) => step.type === 'view')).toMatchObject({
        query: [expect.objectContaining({ op: 'raw', fields: expect.arrayContaining(['OccurredAt', 'Value', '__datumKey']) })],
    });
    expect(actual.rows.map((row) => row.OccurredAt)).toEqual(actual.data.map((row) => row.OccurredAt));
    expect(actual.rows.map((row) => row.OccurredAt)).toEqual(['2026-03-08T01:30:00-08:00', '2026-03-08T03:30:00-07:00', '2026-03-09', null]);
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('3 visible chart items');
    const proxy = native(page).locator('[role="button"][tabindex="0"]');
    await proxy.focus();
    for (let index = 0; index < 3; index++) {
        await proxy.press('Enter');
        if (index < 2) await proxy.press('ArrowRight');
    }
    const selected = await page.evaluate(() => window.__nativeWorksheet.events().at(-1)!.targets);
    expect(selected).toHaveLength(3);
    expect(new Set(selected.map((target) => target.datumKeys[0])).size).toBe(3);
    const values = selected.map((target) => target.values.find((value) => value.field.fid === 'OccurredAt')!);
    expect(values.map((value) => value.raw)).toEqual(actual.data.slice(0, 3).map((row) => row.OccurredAt));
    // Display offsets are applied per value; the original mixed representations
    // remain in the query snapshot and selection callback.
    const localShift = actual.localOffset * 60_000;
    expect(values.map((value) => value.value)).toEqual([
        Date.parse('2026-03-08T09:30:00Z') - localShift,
        Date.parse('2026-03-08T10:30:00Z') - localShift,
        Date.UTC(2026, 2, 9),
    ]);
    expect(values.every((value) => value.configRef === 'encodings.columns[0]')).toBe(true);
});

test('mixed temporal coordinates agree across actual native, Vega and Plot marks and Vega clicks retain raw values', async ({ page }) => {
    await page.goto(`${fixtureUrl}?mode=editor&sample=temporal-raw`);
    await ready(page);
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.setVisualLayout('useSvg', true));
    await ready(page);
    const queryCount = await page.evaluate(() => window.__nativeWorksheet.queryCount());
    const expected = await page.evaluate(() => {
        const shift = new Date().getTimezoneOffset() * 60_000;
        return 3_600_000 / (Date.UTC(2026, 2, 9) - (Date.parse('2026-03-08T09:30:00Z') - shift));
    });
    const ratios: number[] = [];
    for (const renderer of ['native', 'vega-lite', 'observable-plot'] as const) {
        await page.evaluate((renderer) => window.__nativeWorksheet.getStore()!.setVisualLayout('renderer', renderer), renderer);
        if (renderer === 'native') await ready(page);
        const selector =
            renderer === 'native'
                ? '[data-renderer="native"] [data-worksheet-layer="panes"] circle'
                : renderer === 'vega-lite'
                  ? '.vega-embed svg .mark-symbol.role-mark path'
                  : 'svg[class^="plot-"] [aria-label="dot"] circle';
        const marks = page.locator(selector);
        await expect(marks).toHaveCount(3);
        const points = await marks.evaluateAll((elements) =>
            elements
                .map((element) => {
                    const mark = element as SVGGraphicsElement,
                        box = mark.getBBox(),
                        matrix = mark.getScreenCTM()!;
                    const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(matrix);
                    return { x: point.x, y: point.y };
                })
                .sort((a, b) => b.y - a.y),
        );
        // Relative spacing cancels each backend's margins and affine scale range.
        // The old whole-column offset produced a different third-point distance.
        const ratio = (points[1].x - points[0].x) / (points[2].x - points[0].x);
        expect(ratio).toBeCloseTo(expected, 3);
        ratios.push(ratio);
        if (renderer === 'vega-lite') {
            await marks.first().click();
            await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getStore()!.selectedMarkObject.OccurredAt)).toBe('2026-03-08T01:30:00-08:00');
            expect(await page.evaluate(() => window.__nativeWorksheet.getStore()!.filters.OccurredAt)).toEqual(['2026-03-08T01:30:00-08:00']);
        }
        expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(queryCount);
    }
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.001);
});

test('held queries reject stale exports and an older completion cannot replace the latest input', async ({ page }) => {
    await open(page);
    await simple(page);
    await page.evaluate(() => {
        const api = window.__nativeWorksheet;
        api.setQueryMode('hold');
        api.setData([{ Region: 'Older result', Sales: 202 }]);
    });
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.pendingCount())).toBe(1);
    await expect(native(page)).toHaveAttribute('aria-busy', 'true');
    expect(await exportError(page)).toMatch(/computing|stale/i);
    await page.evaluate(() => window.__nativeWorksheet.setData([{ Region: 'Latest result', Sales: 303 }]));
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.pendingCount())).toBe(2);
    await page.evaluate(() => window.__nativeWorksheet.release(1));
    await ready(page);
    const latest = await svg(page);
    expect(latest).toContain('Latest result');
    expect(latest).not.toContain('Older result');
    await page.evaluate(() => window.__nativeWorksheet.release(0));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // Each export allocates fresh clip IDs. Preserve all frame/version/data evidence
    // while ignoring only that document-local serialization nonce.
    expect((await svg(page)).replace(/worksheet-export-\d+-/g, 'worksheet-export-N-')).toBe(latest.replace(/worksheet-export-\d+-/g, 'worksheet-export-N-'));
});

test('a failed replacement query cannot export the old viewport and a later success recovers', async ({ page }) => {
    await open(page);
    await simple(page);
    await page.evaluate(() => {
        const api = window.__nativeWorksheet;
        api.setQueryMode('reject');
        api.setData([{ Region: 'Failed input', Sales: 900 }]);
    });
    await expect(native(page).getByRole('alert')).toContainText('Fixture query failure');
    expect(await exportError(page)).toContain('Fixture query failure');
    await page.evaluate(() => {
        const api = window.__nativeWorksheet;
        api.setQueryMode('immediate');
        api.setData([{ Region: 'Recovered input', Sales: 404 }]);
    });
    await ready(page);
    const recovered = await svg(page);
    expect(recovered).toContain('Recovered input');
    expect(recovered).not.toContain('Baseline');
    expect(recovered).not.toContain('Failed input');
});

test('public native selection callbacks retain original field references and raw values', async ({ page }) => {
    await open(page);
    const proxy = native(page).locator('[role="button"][tabindex="0"]');
    await proxy.focus();
    await proxy.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.events().length)).toBeGreaterThan(0);
    const event = await page.evaluate(() => window.__nativeWorksheet.events().at(-1)!);
    expect(event.renderer).toBe('native');
    expect(event.source).toBe('keyboard');
    expect(event.targets).toHaveLength(1);
    expect(event.interaction).toBeUndefined();
    expect(event.targets[0].datumKeys).toHaveLength(1);
    expect(event.targets[0].endpoints).toHaveLength(1);
    const values = event.targets[0].values;
    expect(values.some((value) => value.field.fid === 'Region' && ['East', 'West'].includes(String(value.raw)))).toBe(true);
    expect(values.every((value) => value.configRef.startsWith('encodings.') && value.field.fid.length > 0)).toBe(true);
    expect(event.targets[0].endpoints[0].values.map((value) => value.raw)).toEqual(values.map((value) => value.raw));
});

test('real editor field/filter/history/save reload flow keeps deep IChart bindings and public export metadata', async ({ page }) => {
    await open(page, 'editor');
    const initialQueries = await page.evaluate(() => window.__nativeWorksheet.queryCount());
    await page.evaluate(() => {
        const store = window.__nativeWorksheet.getStore()!;
        const channel = store.currentVis.encodings.dimensions.findIndex((field) => field.fid === 'Channel');
        store.moveField('dimensions', channel, 'rows', store.currentVis.encodings.rows.length);
    });
    await expect
        .poll(() => page.evaluate(() => window.__nativeWorksheet.getChart().encodings.rows.map((field) => field.fid)))
        .toEqual(['Region', 'Category', 'Subcategory', 'Channel']);
    await ready(page);
    expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBeGreaterThan(initialQueries);
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.undo());
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getChart().encodings.rows.length)).toBe(3);
    await ready(page);
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.redo());
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getChart().encodings.rows.length)).toBe(4);
    await ready(page);
    await page.evaluate(() => {
        const store = window.__nativeWorksheet.getStore()!;
        const region = store.currentVis.encodings.dimensions.findIndex((field) => field.fid === 'Region');
        store.moveField('dimensions', region, 'filters', 0);
        store.writeFilter(0, { type: 'one of', value: ['East'] });
    });
    await ready(page);
    await expect.poll(() => svg(page)).not.toContain('West');
    expect(await svg(page)).toContain('East');
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('6 row positions');
    const saved = await page.evaluate(() => ({ history: window.__nativeWorksheet.getStore()!.exportAllCharts(), chart: window.__nativeWorksheet.getChart() }));
    expect(saved.history.join('')).not.toMatch(/domainPlanKey|gw-binding|RenderPlan/);
    expect(saved.chart.layout.renderer).toBe('native');
    expect(saved.chart.encodings.filters[0].rule).toEqual({ type: 'one of', value: ['East'] });
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.removeField('rows', 3));
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getChart().encodings.rows.length)).toBe(3);
    await page.evaluate((history) => window.__nativeWorksheet.getStore()!.importRaw(history), saved.history);
    await ready(page);
    expect((await page.evaluate(() => window.__nativeWorksheet.getChart())).encodings).toEqual(saved.chart.encodings);
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.undo());
    await ready(page);
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('12 row positions');
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.redo());
    await ready(page);
    await expect.poll(() => svg(page)).not.toContain('West');
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('6 row positions');
    const exported = await page.evaluate(() => window.__nativeWorksheet.export('svg'));
    expect(Array.isArray(exported)).toBe(false);
    if (Array.isArray(exported)) throw new Error('Editor must return IGWHandler export metadata');
    expect(exported.chartType).toBe('native');
    expect(exported.nRows).toBe(1);
    expect(exported.nCols).toBe(1);
    expect(exported.charts).toHaveLength(1);
    expect(exported.charts[0].data).toBe(exported.combinedData);
    expect(exported.containerConnected).toBe(true);
    expect(exported.charts[0].canvasConnected).toBe(true);
    expect(await page.evaluate(() => window.__nativeWorksheet.renderStatus())).toBe('idle');
});

for (const renderer of ['vega-lite', 'observable-plot'] as const) {
    test(`a mounted ${renderer} editor hands public app exports to native without stale cleanup`, async ({ page }) => {
        await open(page, 'editor');
        await page.evaluate((renderer) => {
            const api = window.__nativeWorksheet,
                chart = api.getChart();
            chart.encodings.rows = [chart.encodings.dimensions.find((field) => field.fid === 'Region')!];
            chart.encodings.columns = [chart.encodings.measures.find((field) => field.fid === 'Sales')!];
            chart.layout.renderer = renderer;
            chart.layout.useSvg = true;
            api.setChart(chart);
        }, renderer);
        await expect(native(page)).toHaveCount(0);
        if (renderer === 'vega-lite') {
            await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.renderStatus())).toBe('idle');
            await expect
                .poll(() =>
                    page.evaluate(async () => {
                        const result = await window.__nativeWorksheet.export('svg');
                        return (
                            !Array.isArray(result) &&
                            result.chartType === 'vega' &&
                            result.charts.length > 0 &&
                            result.charts.every((chart) => chart.canvasConnected) &&
                            Boolean(result.combinedData?.includes('<svg'))
                        );
                    }),
                )
                .toBe(true);
        } else {
            // Plot has no existing AppRoot export/status integration. Prove that
            // its real SVG and both marks mounted before checking the native handoff.
            const plot = page.locator('svg[class^="plot-"]');
            await expect(plot).toBeVisible();
            await expect(plot.locator('[aria-label="bar"] rect')).toHaveCount(2);
            await expect(plot).toContainText('East');
            await expect(plot).toContainText('West');
        }
        const queries = await page.evaluate(() => window.__nativeWorksheet.queryCount());
        await page.evaluate(() => window.__nativeWorksheet.getStore()!.setVisualLayout('renderer', 'native'));
        await ready(page);
        // Effects and the prior renderer's passive cleanup have both run by this frame.
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        const result = await page.evaluate(() => window.__nativeWorksheet.export('svg'));
        if (Array.isArray(result)) throw new Error('Expected app-level export metadata');
        expect(result.chartType).toBe('native');
        expect(result.nRows).toBe(1);
        expect(result.nCols).toBe(1);
        expect(result.charts).toHaveLength(1);
        expect(result.charts[0].canvasConnected).toBe(true);
        expect(result.combinedData).toMatch(/^<svg\b/);
        expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(queries);
    });
}

test('controlled Vega-Lite import succeeds and rejected transforms preserve the current chart and history', async ({ page }) => {
    await open(page, 'editor');
    await page.evaluate(() =>
        window.__nativeWorksheet.setVegaLiteSpec({
            title: 'Imported field chart',
            mark: 'bar',
            encoding: { x: { field: 'Category', type: 'nominal' }, y: { field: 'Sales', type: 'quantitative', aggregate: 'sum' } },
            config: { numberFormat: '.1f' },
        }),
    );
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.getChart().name)).toBe('Imported field chart');
    await page.evaluate(() => window.__nativeWorksheet.getStore()!.setVisualLayout('renderer', 'native'));
    await ready(page);
    const accepted = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            store = api.getStore()!;
        return {
            chart: api.getChart(),
            history: store.exportAllCharts(),
            canUndo: store.canUndo,
            canRedo: store.canRedo,
            queries: api.queryCount(),
            errors: api.importErrors(),
        };
    });
    expect(accepted.chart.encodings.columns.map((field) => field.fid)).toEqual(['Category']);
    expect(accepted.chart.encodings.rows[0]).toMatchObject({ fid: 'Sales', aggName: 'sum' });
    expect(accepted.chart.layout.format.numberFormat).toBe('.1f');
    expect(accepted.errors).toEqual([]);
    await page.evaluate(() =>
        window.__nativeWorksheet.setVegaLiteSpec({
            mark: 'point',
            transform: [{ calculate: 'datum.Sales * 2', as: 'Doubled' }],
            encoding: { x: { field: 'Category', type: 'nominal' }, y: { field: 'Doubled', type: 'quantitative' } },
        }),
    );
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.importErrors().length)).toBeGreaterThan(0);
    await expect(page.getByTestId('import-error')).toContainText('transform[0]');
    const rejected = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            store = api.getStore()!;
        return {
            chart: api.getChart(),
            history: store.exportAllCharts(),
            canUndo: store.canUndo,
            canRedo: store.canRedo,
            queries: api.queryCount(),
            errors: api.importErrors(),
        };
    });
    expect(rejected.chart).toEqual(accepted.chart);
    expect(rejected.history).toEqual(accepted.history);
    expect(rejected.canUndo).toBe(accepted.canUndo);
    expect(rejected.canRedo).toBe(accepted.canRedo);
    expect(rejected.queries).toBe(accepted.queries);
    expect(rejected.errors.at(-1)).toMatchObject({
        code: 'unsupported-vega-lite',
        diagnostics: expect.arrayContaining([expect.objectContaining({ configRef: 'transform[0]' })]),
    });
    await ready(page);
});
