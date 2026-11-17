import { expect, test, type Page } from '@playwright/test';
import type { MapRequest } from './geo-map.fixture';

// The filled map in the mounted editor, with shapes and data served by this page. Region holds
// East, West and one blank. The shapes are three squares: East (with a hole), West and North.
// Their names read EAST, Westland and North, and their feature ids read East, West and North.

async function load(page: Page, request: MapRequest) {
    await page.goto('/tests/e2e/geo-map.html');
    await expect(page.locator('body')).toHaveAttribute('data-fixture-ready', 'true');
    await page.evaluate((r) => window.geo.load(r), request);
}
async function open(page: Page, request: MapRequest) {
    await load(page, request);
    await expect(map(page)).toBeVisible();
}
/** The chart's map. The settings dialog adds a second one after it for its preview. */
const map = (page: Page) => page.locator('.leaflet-container').first();
const notice = (page: Page) => page.getByTestId('geo-notice');
const noticeTitle = (page: Page) => page.getByTestId('geo-notice-title');
const labels = (page: Page) => map(page).locator('.leaflet-marker-pane .leaflet-marker-icon');
const setLayout = (page: Page, key: string, value: unknown) => page.evaluate(([k, v]) => window.geo.setLayout(k as never, v as never), [key, value] as const);

/**
 * The painted stretches along the horizontal line through the middle of the map, in CSS pixels
 * from the middle. Shapes are drawn on Leaflet's canvas and nothing else is, so this reads their
 * outline straight off the picture.
 */
async function paintedAcrossMiddle(page: Page) {
    return map(page)
        .locator('canvas')
        .evaluate((canvas: HTMLCanvasElement) => {
            const host = canvas.closest('.leaflet-container')!.getBoundingClientRect();
            const box = canvas.getBoundingClientRect();
            const scale = canvas.width / box.width;
            const y = Math.round((host.top + host.height / 2 - box.top) * scale);
            const middle = (host.left + host.width / 2 - box.left) * scale;
            const row = canvas.getContext('2d')!.getImageData(0, y, canvas.width, 1).data;
            const runs: [number, number][] = [];
            for (let x = 0; x < canvas.width; x++) {
                if (row[x * 4 + 3] === 0) continue;
                const last = runs[runs.length - 1];
                if (last && last[1] === x - 1) last[1] = x;
                else runs.push([x, x]);
            }
            return runs.map(([from, to]) => [Math.round((from - middle) / scale), Math.round((to - middle) / scale)]);
        });
}
/**
 * Where the map is looking. Leaflet writes its centre and zoom into the proxy's transform when a
 * move ends, and moves the map pane and scales the canvas on every frame of a flight. Read together,
 * they change for as long as the map is moving and hold still once it has landed.
 */
const view = (page: Page) =>
    map(page).evaluate((container) =>
        ['.leaflet-proxy', '.leaflet-map-pane', 'canvas'].map((selector) => (container.querySelector(selector) as HTMLElement | null)?.style.transform ?? '').join(' | ')
    );
async function settledView(page: Page) {
    let last = '';
    await expect
        .poll(
            async () => {
                const before = last;
                last = await view(page);
                return last !== '' && last === before;
            },
            { intervals: [400] }
        )
        .toBe(true);
    return last;
}

test('G1: values that find no shape are named on the map, and the right key resolves them', async ({ page }) => {
    await open(page, { geoKey: 'name' });
    // "East" finds EAST although the case differs. "West" is not "Westland".
    await expect(notice(page)).toHaveAttribute('data-state', 'unmatched');
    await expect(noticeTitle(page)).toHaveText('1 of 2 values matched a shape');
    await expect(notice(page)).toContainText('No shape for: West');
    await expect(notice(page)).toContainText('Rows with no value to match: 1');
    await expect(notice(page)).toContainText('Shapes are matched on "name", with values such as EAST, Westland, North.');

    // A key no shape has.
    await setLayout(page, 'geoKey', 'iso');
    await expect(notice(page)).toHaveAttribute('data-state', 'bad_key');
    await expect(noticeTitle(page)).toHaveText('No shape has a "iso" value');

    // The codes sit on the feature id, outside `properties`. Only the blank row is left to report.
    await setLayout(page, 'geoKey', 'id');
    await expect(noticeTitle(page)).toHaveText('Rows with no value to match: 1');
    await expect(notice(page)).not.toContainText('No shape for');

    await page.getByTestId('geo-notice-dismiss').click();
    await expect(notice(page)).toHaveCount(0);
    // It returns when what it has to say changes.
    await setLayout(page, 'geoKey', 'name');
    await expect(noticeTitle(page)).toHaveText('1 of 2 values matched a shape');
});

test('G2: a shape keeps its hole, and every matched shape is drawn', async ({ page }) => {
    await open(page, { geoKey: 'name' });
    // Only East is matched, so the map is centred on it and the middle of the map is its hole.
    // The map flies there once the data arrives, and the picture is only true once it has landed.
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBeGreaterThan(0);
    await settledView(page);
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBe(2);
    const [left, right] = await paintedAcrossMiddle(page);
    expect(left[1]).toBeLessThan(0);
    expect(right[0]).toBeGreaterThan(0);
    // The hole is 6 degrees wide in a square of 20.
    const hole = right[0] - left[1];
    const whole = right[1] - left[0];
    expect(hole / whole).toBeGreaterThan(0.27);
    expect(hole / whole).toBeLessThan(0.33);

    // With West matched as well, the line crosses West, then East's two sides.
    const before = await view(page);
    await setLayout(page, 'geoKey', 'id');
    await expect.poll(() => view(page)).not.toBe(before);
    await settledView(page);
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBe(3);
});

test('G3: the map moves when the shapes on it change, and not when anything else does', async ({ page }) => {
    await open(page, { geoKey: 'name' });
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBeGreaterThan(0);
    const fitted = await settledView(page);
    await map(page).locator('.leaflet-control-zoom-in').click();
    await expect.poll(() => view(page)).not.toBe(fitted);
    const zoomed = await settledView(page);

    // Settings that leave the matched shapes as they are. One of them adds the grey shapes.
    await setLayout(page, 'scaleIncludeUnmatchedChoropleth', true);
    await setLayout(page, 'showAllGeoshapeInChoropleth', true);
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    expect(await view(page)).toBe(zoomed);

    // West is matched now, so the map has more to show and moves to show it.
    await setLayout(page, 'geoKey', 'id');
    await expect.poll(() => view(page)).not.toBe(zoomed);
});

test('G4: a label shows markup from the data as text and runs none of it', async ({ page }) => {
    await open(page, { geoKey: 'id', text: 'Note' });
    await expect(labels(page)).toHaveCount(2);
    await expect(labels(page).first()).toHaveText('<img src="x" onerror="window.__scriptRan = true"><b>bold</b>');
    await expect(labels(page).nth(1)).toHaveText('plain');
    await expect(map(page).locator('.leaflet-marker-pane').locator('img, b')).toHaveCount(0);
    expect(await page.evaluate(() => window.geo.scriptRan())).toBe(false);
});

test('G5: labels read aggregated measures, and a shape without data is labelled only by its own name', async ({ page }) => {
    await open(page, { geoKey: 'id', text: 'Sales', showAll: true });
    // North has no row, so it has no sales to show.
    await expect(labels(page)).toHaveText(['10', '20']);

    await page.evaluate(() => window.geo.load({ geoKey: 'id', text: 'Region', showAll: true }));
    await expect(labels(page)).toHaveText(['East', 'West', 'North']);
});

test('G6: a map without shapes, or with shapes that cannot be loaded, says so', async ({ page }) => {
    await open(page, { noShapes: true });
    await expect(notice(page)).toHaveAttribute('data-state', 'no_data');
    await expect(noticeTitle(page)).toHaveText('This map has no shapes yet');

    const files = await page.evaluate(() => window.geo.files);
    await page.evaluate((url) => window.geo.load({ geoUrl: { type: 'GeoJSON', url } }), files.missingUrl);
    const failed = page.getByTestId('geo-load-failed');
    await expect(failed).toHaveAttribute('data-code', 'http');
    await expect(page.getByTestId('geo-load-failed-reason')).toHaveText('The server answered with status 404.');
    await expect(page.getByTestId('geo-load-failed-retry')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toHaveCount(0);

    // A topology loads whatever format the chart says it is, and the object is the one asked for.
    await page.evaluate((url) => window.geo.load({ geoKey: 'region', geoUrl: { type: 'GeoJSON', url, objectKey: 'all' } }), files.topologyUrl);
    await expect(map(page)).toBeVisible();
    await expect(noticeTitle(page)).toHaveText('Rows with no value to match: 1');
    await page.evaluate((url) => window.geo.load({ geoKey: 'region', geoUrl: { type: 'TopoJSON', url, objectKey: 'states' } }), files.topologyUrl);
    await expect(failed).toHaveAttribute('data-code', 'object');
    await expect(page.getByTestId('geo-load-failed-reason')).toHaveText('The TopoJSON file has no object of that name. It has: halves, all.');
    await expect(page.getByTestId('geo-load-failed-retry')).toHaveCount(0);
});

test('G7: the settings dialog lists the keys of a file, reports what it cannot use, and stores a URL with its object', async ({ page }) => {
    await open(page, { geoKey: 'name' });
    const files = await page.evaluate(() => window.geo.files);
    await page.evaluate(() => window.geo.openSettings());
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const key = dialog.getByTestId('geo-config-key').getByRole('combobox');
    const error = dialog.getByTestId('geo-config-error');
    const file = dialog.getByTestId('geo-config-file');

    // The chart's own shapes: the key in use, with what its values look like.
    await expect(key).toContainText('name');
    await expect(key).toContainText('EAST, Westland, North');
    await expect(dialog.getByTestId('geo-config-preview')).toBeVisible();

    await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ "type": ') });
    await expect(error).toHaveText('The file is not valid JSON.');
    await file.setInputFiles({ name: 'table.json', mimeType: 'application/json', buffer: Buffer.from('{"rows": [1, 2]}') });
    await expect(error).toHaveText('The file is neither a GeoJSON FeatureCollection nor a TopoJSON topology.');
    // A file that was refused replaces nothing.
    await expect(key).toContainText('name');

    await dialog.getByRole('textbox').fill(files.missingUrl);
    await dialog.getByRole('button', { name: 'Load' }).click();
    await expect(error).toHaveText('The server answered with status 404.');

    // A topology by URL, loaded while the format still says GeoJSON.
    await dialog.getByRole('textbox').fill(files.topologyUrl);
    await dialog.getByRole('button', { name: 'Load' }).click();
    await expect(error).toHaveCount(0);
    await expect(dialog.getByRole('radio', { name: 'TopoJSON' })).toBeChecked();
    const object = dialog.getByTestId('geo-config-object').getByRole('combobox');
    await expect(object).toContainText('halves');
    // The file has no "name", so the key moves to one it has.
    await expect(key).toContainText('label');
    await object.click();
    await page.getByRole('option', { name: 'all', exact: true }).click();
    await expect(key).toContainText('region');
    await expect(key).toContainText('East, West, North');

    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await page.evaluate(() => window.geo.saved());
    // The chart keeps the address and the object, not a copy of the shapes.
    expect(saved.layout.geoUrl).toEqual({ type: 'TopoJSON', url: files.topologyUrl, objectKey: 'all' });
    expect(saved.layout.geojson).toBeUndefined();
    expect(saved.layout.geoKey).toBe('region');
    await expect(noticeTitle(page)).toHaveText('Rows with no value to match: 1');
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBe(2);
});

test('G8: an uploaded file is stored in the chart with the key chosen for it', async ({ page }) => {
    await open(page, { noShapes: true });
    const files = await page.evaluate(() => window.geo.files);
    await page.evaluate(() => window.geo.openSettings());
    const dialog = page.getByRole('dialog');
    const key = dialog.getByTestId('geo-config-key').getByRole('combobox');
    // Nothing to list yet, and nothing to confirm.
    await expect(key).toBeDisabled();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog.getByTestId('geo-config-error')).toHaveText('Choose a file or load a URL first.');

    await dialog.getByTestId('geo-config-file').setInputFiles({ name: 'shapes.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(files.shapes) });
    await expect(dialog.getByTestId('geo-config-error')).toHaveCount(0);
    await expect(key).toContainText('name');
    await key.click();
    await page.getByRole('option', { name: /^id/ }).click();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toHaveCount(0);

    const saved = await page.evaluate(() => window.geo.saved());
    expect(saved.layout.geoKey).toBe('id');
    expect(saved.layout.geoUrl).toBeUndefined();
    expect(saved.layout.geojson?.features).toHaveLength(3);
    await expect(noticeTitle(page)).toHaveText('Rows with no value to match: 1');
    await expect.poll(async () => (await paintedAcrossMiddle(page)).length).toBe(3);
});
