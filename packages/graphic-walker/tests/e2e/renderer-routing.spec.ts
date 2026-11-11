import { expect, test, type Page } from '@playwright/test';
import type { ChartRequest } from './native-renderer.fixture';

// How a chart finds its renderer, in the mounted editor: an ordinary chart is drawn by the renderer it
// names or not at all, maps and tables keep their own components, and the host is told the truth.

const bars: ChartRequest = { name: 'Bars', renderer: 'native', rows: ['Region'], columns: ['Sales'] };
const levels: ChartRequest = { name: 'Levels', renderer: 'native', rows: ['Region', 'Category', 'Subcategory'], columns: ['f_ratio'] };
const betweenMeasures: ChartRequest = { name: 'Between measures', renderer: 'native', geom: 'bar', rows: ['Sales'], columns: ['Cost'] };
const renderers = ['vega-lite', 'observable-plot', 'native'] as const;

async function open(page: Page, charts: ChartRequest[]) {
    await page.goto('/tests/e2e/native-renderer.html');
    await expect(page.locator('body')).toHaveAttribute('data-fixture-ready', 'true');
    await page.evaluate((list) => window.gw.load(list), charts);
}
const sheet = (page: Page) => page.getByTestId('worksheet-scroll');
const notice = (page: Page) => page.getByTestId('chart-notice');
const vega = (page: Page) => page.locator('.vega-embed');
const plot = (page: Page) => page.locator('svg[class^="plot-"], figure[class^="plot-"]');
const map = (page: Page) => page.locator('.leaflet-container');
const status = (page: Page) => page.evaluate(() => window.gw.host.status());
const saved = (page: Page) => page.evaluate(() => window.gw.saved());
const shelves = (chart: Awaited<ReturnType<typeof saved>>[number]) => ({ rows: chart.encodings.rows.map((f) => f.fid), columns: chart.encodings.columns.map((f) => f.fid) });
/** The editor reports every failed query in a dialog of its own, over the chart area. */
async function dismissErrorDialog(page: Page) {
    const dialog = page.getByRole('dialog').filter({ hasText: 'Computation service' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).first().click();
    await expect(dialog).toHaveCount(0);
}
/** No renderer other than the notice has anything on screen. */
async function nothingDrawn(page: Page) {
    await expect(sheet(page)).toHaveCount(0);
    await expect(vega(page)).toHaveCount(0);
    await expect(plot(page)).toHaveCount(0);
    await expect(map(page)).toHaveCount(0);
}

test('R1: a chart the worksheet renderer cannot draw says why and is not drawn by another renderer', async ({ page }) => {
    await open(page, [betweenMeasures]);
    await expect(notice(page)).toHaveAttribute('data-state', 'unsupported');
    await expect(page.getByTestId('chart-notice-reason')).toContainText('Bar marks need one measure axis');
    await nothingDrawn(page);
    const [chart] = await saved(page);
    expect(chart.layout.renderer).toBe('native');
    expect(chart.config.geoms).toEqual(['bar']);
    expect(shelves(chart)).toEqual({ rows: ['Sales'], columns: ['Cost'] });
    await expect.poll(() => status(page)).toBe('error');
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ images: 0 });
    // The same shelves under a mark type it draws: the notice goes and the sheet comes, with no reload.
    await page.evaluate(() => window.gw.setGeom('point'));
    await expect(sheet(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await expect.poll(() => status(page)).toBe('idle');
});

test('R2: a failed query shows the error, no other renderer takes over, and trying again or changing the chart recovers', async ({ page }) => {
    await open(page, [bars, { ...bars, name: 'By category', rows: ['Category'] }]);
    await expect(sheet(page)).toBeVisible();
    await expect.poll(() => status(page)).toBe('idle');
    const first = await page.evaluate(() => window.gw.host.exportChart());
    expect(first).toMatchObject({ title: 'Bars', chartType: 'worksheet', images: 1 });
    expect(first.data).toContain('<svg');

    // The second chart is opened while the data source is down.
    await page.evaluate(() => { window.gw.failQueries(true); window.gw.host.openChart(1); });
    await expect(notice(page)).toHaveAttribute('data-state', 'failed');
    await expect(page.getByTestId('chart-notice-reason')).toHaveText('The data source is offline.');
    await nothingDrawn(page);
    await expect.poll(() => status(page)).toBe('error');
    // The host gets no image, in particular not the one of the chart drawn before.
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ images: 0, data: '' });
    let [, chart] = await saved(page);
    expect(chart.layout.renderer).toBe('native');
    expect(shelves(chart)).toEqual({ rows: ['Category'], columns: ['Sales'] });
    // Trying again while it is still down fails again, in the same place.
    await dismissErrorDialog(page);
    await page.getByTestId('chart-notice-retry').click();
    await dismissErrorDialog(page);
    await expect(notice(page)).toHaveAttribute('data-state', 'failed');
    await nothingDrawn(page);

    await page.evaluate(() => window.gw.failQueries(false));
    await page.getByTestId('chart-notice-retry').click();
    await expect(sheet(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
    await expect.poll(() => status(page)).toBe('idle');
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ title: 'By category', chartType: 'worksheet', images: 1 });

    // A failure also clears when the chart itself is changed.
    await page.evaluate(() => { window.gw.failQueries(true); window.gw.load([{ name: 'Costs', renderer: 'native', rows: ['Region'], columns: ['Cost'] }]); });
    await expect(notice(page)).toHaveAttribute('data-state', 'failed');
    await dismissErrorDialog(page);
    await page.evaluate(() => { window.gw.failQueries(false); window.gw.setGeom('point'); });
    await expect(sheet(page)).toBeVisible();
    [chart] = await saved(page);
    expect(chart.layout.renderer).toBe('native');
});

test('R4: only the user changes the renderer, and a renderer that cannot show every level draws none of them', async ({ page }) => {
    await open(page, [levels]);
    await expect(sheet(page)).toBeVisible();
    await expect.poll(() => status(page)).toBe('idle');
    // E1 in the mounted editor: the ratio is asked for at the grain of all three levels, through the host's computation.
    const asked = await page.evaluate(() => window.gw.queries().flatMap((q) => q.workflow).flatMap((step) => (step.type === 'view' ? step.query : [])));
    expect(asked).toContainEqual({ op: 'aggregate', groupBy: ['Category', 'Region', 'Subcategory'], measures: [{ field: '((sum ("Sales") ) / (sum ("Cost") ))', agg: 'expr', asFieldKey: '__ws_columnm0' }] });
    const before = shelves((await saved(page))[0]);
    expect(before).toEqual({ rows: ['Region', 'Category', 'Subcategory'], columns: ['f_ratio'] });

    for (const [renderer, name] of [['vega-lite', 'VegaLite'], ['observable-plot', 'Observable Plot']] as const) {
        await page.evaluate((to) => window.gw.setRenderer(to), renderer);
        await expect(notice(page)).toHaveAttribute('data-state', 'levels');
        await expect(notice(page)).toContainText(`${name} cannot show every level of this chart`);
        await expect(page.getByTestId('chart-notice-reason')).toContainText('Region, Category, Subcategory');
        await nothingDrawn(page);
        await expect.poll(() => status(page)).toBe('error');
        const [chart] = await saved(page);
        // The choice is the user's and stays; the fields are all still there.
        expect(chart.layout.renderer).toBe(renderer);
        expect(shelves(chart)).toEqual(before);
    }
    await page.evaluate(() => window.gw.setRenderer('native'));
    await expect(sheet(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);

    // A chart the other renderers can show in full is drawn by the one the user picks.
    await page.evaluate((chart) => window.gw.load([chart]), { ...bars, rows: ['Region', 'Category'] });
    await expect(sheet(page)).toBeVisible();
    await page.evaluate(() => window.gw.setRenderer('vega-lite'));
    await expect(vega(page)).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    await expect(notice(page)).toHaveCount(0);
    await page.evaluate(() => window.gw.setRenderer('observable-plot'));
    await expect(plot(page).first()).toBeVisible();
    await expect(vega(page)).toHaveCount(0);
});

test('M1: a map is drawn by the map component under every renderer setting', async ({ page }) => {
    await open(page, renderers.map((renderer) => ({ name: `Map ${renderer}`, renderer, map: true })));
    for (const [index, renderer] of renderers.entries()) {
        await page.evaluate((to) => window.gw.host.openChart(to), index);
        await expect(map(page)).toBeVisible();
        // The points are painted on Leaflet's own canvas, from the map's own query.
        await expect(map(page).locator('canvas')).toHaveCount(1);
        await expect(notice(page)).toHaveCount(0);
        await expect(sheet(page)).toHaveCount(0);
        await expect(vega(page)).toHaveCount(0);
        expect((await saved(page))[index].layout.renderer).toBe(renderer);
    }
    const fields = await page.evaluate(() => window.gw.queries().flatMap((q) => q.workflow).flatMap((step) => (step.type === 'view' ? step.query : [])).flatMap((query) => (query.op === 'aggregate' ? query.groupBy : query.op === 'raw' ? query.fields : [])));
    expect(fields).toEqual(expect.arrayContaining(['Lat', 'Lon']));
});

test('M2: an ordinary chart turned into a map and back keeps its renderer', async ({ page }) => {
    await open(page, [bars]);
    await expect(sheet(page)).toBeVisible();
    await page.evaluate(() => window.gw.setMap(true));
    await expect(map(page)).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    await expect(notice(page)).toHaveCount(0);
    let [chart] = await saved(page);
    expect(chart.layout.renderer).toBe('native');
    expect(chart.config).toMatchObject({ coordSystem: 'geographic', geoms: ['poi'] });
    expect(shelves(chart)).toEqual({ rows: ['Region'], columns: ['Sales'] });

    await page.evaluate(() => window.gw.setMap(false));
    await expect(sheet(page)).toBeVisible();
    await expect(map(page)).toHaveCount(0);
    await expect(vega(page)).toHaveCount(0);
    [chart] = await saved(page);
    expect(chart.layout.renderer).toBe('native');
    expect(chart.config).toMatchObject({ coordSystem: 'generic' });
    await expect.poll(() => status(page)).toBe('idle');
});

test('H1: the host switches and exports charts across renderers, and a chart that is not drawn exports no image', async ({ page }) => {
    await open(page, [bars, { name: 'Vega bars', renderer: 'vega-lite', rows: ['Region'], columns: ['Sales'] }, betweenMeasures, levels]);
    await expect(sheet(page)).toBeVisible();
    expect(await page.evaluate(() => [window.gw.host.chartCount(), window.gw.host.chartIndex()])).toEqual([4, 0]);

    await page.evaluate(() => window.gw.host.openChart(1));
    await expect(vega(page)).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
    expect(await page.evaluate(() => [window.gw.host.chartCount(), window.gw.host.chartIndex()])).toEqual([4, 1]);
    await page.evaluate(() => window.gw.host.openChart(2));
    await expect(notice(page)).toHaveAttribute('data-state', 'unsupported');
    expect(await page.evaluate(() => [window.gw.host.chartCount(), window.gw.host.chartIndex()])).toEqual([4, 2]);
    await page.evaluate(() => window.gw.host.openChart(3));
    await expect(sheet(page)).toBeVisible();

    // Exporting them all, started from a worksheet chart and from the chart that is not drawn alike.
    for (const start of [3, 2, 1]) {
        await page.evaluate((index) => window.gw.host.openChart(index), start);
        const list = await page.evaluate(() => window.gw.host.exportChartList());
        expect(list).toEqual([
            { index: 0, title: 'Bars', chartType: 'worksheet', images: 1 },
            { index: 1, title: 'Vega bars', chartType: 'vega', images: 1 },
            // The chart its renderer cannot draw is reported without an image, not with its neighbor's.
            expect.objectContaining({ index: 2, images: 0 }),
            { index: 3, title: 'Levels', chartType: 'worksheet', images: 1 },
        ]);
        // The export leaves the editor on the chart it started from.
        expect(await page.evaluate(() => window.gw.host.chartIndex())).toBe(start);
    }
});


test('release default: new and unspecified charts use the bundled worksheet renderer', async ({ page }) => {
    await page.goto('/tests/e2e/native-renderer.html');
    await expect(page.locator('body')).toHaveAttribute('data-fixture-ready', 'true');
    expect((await saved(page))[0].layout.renderer).toBe('native');
    await page.evaluate(() => window.gw.load([{ name: 'Default', rows: ['Region', 'Category', 'Subcategory'], columns: ['Sales'] }]));
    await expect(sheet(page)).toBeVisible();
    await expect.poll(() => status(page)).toBe('idle');
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ chartType: 'worksheet', images: 1 });
});

test('release default: PureRenderer renders and exports a worksheet without a renderer setting', async ({ page }) => {
    await page.goto('/tests/e2e/native-renderer.html?pure=1');
    await expect(sheet(page)).toBeVisible();
    await expect.poll(async () => {
        try { return (await page.evaluate(() => window.pureExport()))[0] ?? ''; }
        catch { return ''; }
    }).toContain('<svg');
    await expect(vega(page)).toHaveCount(0);
});


test('an empty app and cleared shelves stay blank and idle in the production package', async ({ page }) => {
    await page.goto('/tests/e2e/native-renderer.html?empty=1');
    await expect(page.locator('body')).toHaveAttribute('data-fixture-ready', 'true');
    await expect(notice(page)).toHaveCount(0);
    await expect(sheet(page)).toHaveCount(0);
    await expect.poll(() => status(page)).toBe('idle');
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ images: 0 });
    await page.evaluate((chart) => window.gw.load([chart]), bars);
    await expect(sheet(page)).toBeVisible();
    await expect.poll(() => status(page)).toBe('idle');
    const drawn = await page.evaluate(() => window.gw.host.exportChart());
    expect(drawn).toMatchObject({ chartType: 'worksheet', images: 1 });
    expect(drawn.data).toContain('<svg');
    await page.evaluate(() => window.gw.load([{ name: 'Cleared' }]));
    await expect(notice(page)).toHaveCount(0);
    await expect(sheet(page)).toHaveCount(0);
    await expect.poll(() => status(page)).toBe('idle');
    expect(await page.evaluate(() => window.gw.host.exportChart())).toMatchObject({ images: 0, data: '' });
});
