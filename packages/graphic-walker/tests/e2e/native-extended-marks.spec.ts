import { expect, test, type Page } from '@playwright/test';
import type {} from './native-worksheet.fixture';
import type { NativeExtendedScenario } from '../../src/lib/native/scenarios';
import type { NativeSelectionTarget } from '../../src/lib/native/events';

function boxOffset(target: NativeSelectionTarget) {
    const field = (fid: string) => String(target.values.find(value => value.field.fid === fid)!.raw);
    return ['East', 'West', 'Central'].indexOf(field('Region')) * 4 + ['Office', 'Furniture', 'Technology'].indexOf(field('Category')) * 2;
}
const native = (page: Page) => page.locator('[data-renderer="native"]');
const scroller = (page: Page) =>
    page.getByRole('region', { name: 'Worksheet. Arrow keys scroll; Home and End jump to limits.', exact: true });
async function ready(page: Page) {
    await expect(native(page)).toHaveCount(1);
    await expect(native(page)).toHaveAttribute('aria-busy', 'false');
    await expect(native(page).getByRole('alert')).toHaveCount(0);
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
async function open(page: Page, sample: NativeExtendedScenario) {
    await page.goto(`/tests/e2e/native-worksheet.html?sample=${sample}`);
    await expect.poll(() => page.evaluate(() => Boolean(window.__nativeWorksheet))).toBe(true);
    await ready(page);
    await expect(native(page).locator('svg')).toHaveCount(1);
}
async function exported(page: Page) {
    return page.evaluate(async () => {
        const result = await window.__nativeWorksheet.export('svg');
        return Array.isArray(result) ? result[0] : result.combinedData!;
    });
}
async function backend(page: Page, svg: boolean) {
    await page.evaluate((svg) => window.__nativeWorksheet.setBackend(svg), svg);
    await ready(page);
    await expect(native(page).locator('canvas')).toHaveCount(svg ? 0 : 1);
    await expect(native(page).locator('svg')).toHaveCount(svg ? 1 : 0);
}
/** Probe actual painted SVG interiors, not the bounding-box center of a donut or trail. */
async function interiors(page: Page) {
    return native(page).evaluate((root) => {
        const svg = root.querySelector('svg')!,
            viewport = svg.getBoundingClientRect(),
            result: { x: number; y: number; id: string; tag: string; d?: string }[] = [];
        const painted = (element: SVGGeometryElement, x: number, y: number) => {
            for (
                let ancestor: SVGElement | null = element;
                ancestor && ancestor !== svg;
                ancestor = ancestor.parentElement as unknown as SVGElement | null
            ) {
                const clipId = /url\(#([^)]*)\)/.exec(ancestor.getAttribute('clip-path') ?? '')?.[1];
                if (!clipId) continue;
                const rect = svg.querySelector<SVGRectElement>(`#${CSS.escape(clipId)} rect`),
                    matrix = ancestor.getScreenCTM();
                if (!rect || !matrix) continue;
                // Firefox reports an empty getBBox for a rect inside clipPath.
                // Read its resolved SVG lengths, which describe the actual clip.
                const p = new DOMPoint(x, y).matrixTransform(matrix.inverse()),
                    box = { x: rect.x.baseVal.value, y: rect.y.baseVal.value, width: rect.width.baseVal.value, height: rect.height.baseVal.value };
                if (p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height) return false;
            }
            return true;
        };
        for (const element of svg.querySelectorAll<SVGGeometryElement>('[data-pane] [data-command]')) {
            const id = element.getAttribute('data-command')!;
            if (!/^\["(?:pane|segment|boxplot)"/.test(id) || typeof element.isPointInFill !== 'function') continue;
            const box = element.getBoundingClientRect(),
                matrix = element.getScreenCTM();
            if (!matrix || !box.width || !box.height) continue;
            const left = Math.max(box.left, viewport.left),
                right = Math.min(box.right, viewport.right),
                top = Math.max(box.top, viewport.top),
                bottom = Math.min(box.bottom, viewport.bottom);
            let point: { x: number; y: number } | undefined;
            // Middle samples first, then enough interior subdivisions for narrow sectors.
            for (const fy of [0.5, 0.25, 0.75, 0.1, 0.9]) {
                for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
                    const x = left + (right - left) * fx,
                        y = top + (bottom - top) * fy;
                    if (right <= left || bottom <= top) continue;
                    const local = new DOMPoint(x, y).matrixTransform(matrix.inverse());
                    if (element.isPointInFill(local) && painted(element, x, y)) {
                        point = { x, y };
                        break;
                    }
                }
                if (point) break;
            }
            if (point) result.push({ ...point, id, tag: element.tagName, d: element.getAttribute('d') ?? undefined });
            if (result.length >= 3) break;
        }
        return result;
    });
}
async function clickAndCheck(page: Page, point: { x: number; y: number }) {
    const before = await page.evaluate(() => window.__nativeWorksheet.events().length);
    await page.mouse.move(point.x, point.y);
    await expect(native(page).getByRole('tooltip')).toBeVisible();
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(() => window.__nativeWorksheet.events().length)).toBeGreaterThan(before);
    const event = await page.evaluate(() => window.__nativeWorksheet.events().at(-1)!);
    expect(event.source).toBe('pointer');
    expect(event.targets).toHaveLength(1);
    expect(event.targets[0].datumKeys.length).toBeGreaterThan(0);
    expect(event.targets[0].values.every((value) => value.field.fid && value.configRef.startsWith('encodings.'))).toBe(true);
    return event.targets[0];
}

const cases: { sample: NativeExtendedScenario; tag: string; segment?: number }[] = [
    { sample: 'circle', tag: 'circle' },
    { sample: 'tick', tag: 'rect' },
    { sample: 'auto-tick', tag: 'rect' },
    { sample: 'area', tag: 'path', segment: 2 },
    { sample: 'trail', tag: 'path', segment: 2 },
    { sample: 'pie', tag: 'path' },
    { sample: 'donut', tag: 'path' },
    { sample: 'pie-size', tag: 'path' },
    { sample: 'bar-normalize', tag: 'rect' },
    { sample: 'bar-center', tag: 'rect' },
    { sample: 'area-normalize', tag: 'path', segment: 2 },
    { sample: 'area-center', tag: 'path', segment: 2 },
    { sample: 'boxplot', tag: 'rect', segment: 5 },
];
for (const { sample, tag, segment } of cases)
    test(`${sample} renders through the real query and retains pointer identity across SVG/Canvas`, async ({ page }) => {
        await open(page, sample);
        const points = await interiors(page);
        expect(points.length).toBeGreaterThanOrEqual(2);
        expect(points[0].tag).toBe(tag);
        const first = await clickAndCheck(page, points[0]);
        expect(first.kind).toBe(segment ? 'segment' : 'datum');
        if (segment) {
            expect(first.datumKeys).toHaveLength(segment);
            expect(first.endpoints).toHaveLength(segment);
        }
        if (['circle', 'tick', 'auto-tick'].includes(sample))
            await expect(native(page).locator('[aria-live="polite"]')).toContainText('11 visible chart items');
        if (sample === 'boxplot')
            expect(first.values.filter((value) => value.field.fid === 'Value').map((value) => value.value)).toEqual(
                [0, 2.25, 4.5, 6.75, 8].map(value => value + boxOffset(first)),
            );
        if (['circle', 'tick', 'auto-tick'].includes(sample))
            expect(first.values.some((value) => value.field.fid === 'Value' && value.raw === 0)).toBe(true);
        const content = await exported(page);
        expect(content).toMatch(/^<svg\b/);
        expect(content).not.toMatch(/NaN|Infinity/);
        if (sample === 'pie' || sample === 'pie-size') expect((points[0].d?.match(/ A/g) ?? []).length).toBe(1);
        if (sample === 'donut') expect((points[0].d?.match(/ A/g) ?? []).length).toBe(2);
        if (sample.includes('normalize')) expect(content).toContain('%');
        const queries = await page.evaluate(() => window.__nativeWorksheet.queryCount());
        await backend(page, false);
        const secondPoint = sample === 'boxplot' ? points.slice(1).find((point) => point.tag === 'rect')! : points[1];
        expect(secondPoint).toBeTruthy();
        const second = await clickAndCheck(page, secondPoint);
        expect(second.datumKeys).not.toEqual(first.datumKeys);
        expect(second.kind).toBe(first.kind);
        expect(await exported(page)).not.toMatch(/NaN|Infinity/);
        const png = await page.evaluate(async () => window.__nativeWorksheet.export('png'));
        expect(Array.isArray(png) && png[0]).toMatch(/^data:image\/png;base64,/);
        await backend(page, true);
        expect(await page.evaluate(() => window.__nativeWorksheet.queryCount())).toBe(queries);
        await expect(native(page).getByRole('alert')).toHaveCount(0);
    });

test('nested pie facets survive the real query and both scroll axes without multiplying Canvas elements', async ({ page }) => {
    await open(page, 'pie');
    const actual = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            result = api.results().at(-1)!;
        return { rows: result.rows, query: api.queries()[result.queryIndex] };
    });
    expect(actual.rows).toHaveLength(240);
    const raw = actual.query.workflow.flatMap((step) => (step.type === 'view' ? step.query : [])).find((query) => query.op === 'raw');
    expect(raw).toMatchObject({ op: 'raw', fields: expect.arrayContaining(['Region', 'District', 'Year', 'Quarter', 'Series', 'Weight']) });
    await expect(native(page).locator('[aria-live="polite"]')).toContainText('8 row positions, 6 column positions');
    await scroller(page).evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
        element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
    await expect.poll(() => scroller(page).evaluate((element) => element.scrollLeft)).toBeGreaterThan(100);
    await ready(page);
    const end = await exported(page);
    expect(end).toContain('North');
    expect(end).toContain('2026');
    expect(end).toContain('Q2');
    const points = await interiors(page);
    expect(points.length).toBeGreaterThan(1);
    await backend(page, false);
    await clickAndCheck(page, points[0]);
    await expect(native(page).locator('canvas')).toHaveCount(1);
    expect(await scroller(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
    await backend(page, true);
    expect(await native(page).locator('[data-pane]').count()).toBeLessThan(48);
});

test('donut center is empty for hover and pointer selection in both backends', async ({ page }) => {
    await open(page, 'donut');
    const center = await native(page).evaluate((root) => {
        const paths = [...root.querySelectorAll<SVGPathElement>('[data-pane] path[data-command]')].filter((path) =>
            path.getAttribute('data-command')!.startsWith('["pane"'),
        );
        const firstPane = paths[0].parentElement!;
        const pathsInPane = [...firstPane.querySelectorAll<SVGPathElement>('path[data-command]')];
        const bounds = pathsInPane.map((path) => path.getBoundingClientRect());
        return {
            x: (Math.min(...bounds.map((box) => box.left)) + Math.max(...bounds.map((box) => box.right))) / 2,
            y: (Math.min(...bounds.map((box) => box.top)) + Math.max(...bounds.map((box) => box.bottom))) / 2,
        };
    });
    for (const svg of [true, false]) {
        if (!svg) await backend(page, false);
        await page.mouse.move(center.x, center.y);
        await expect(native(page).getByRole('tooltip')).toBeHidden();
        await page.mouse.click(center.x, center.y);
        const events = await page.evaluate(() => window.__nativeWorksheet.events());
        expect(events.length === 0 || events.at(-1)!.targets.length === 0).toBe(true);
    }
});

test('boxplot distinguishes computed summary values from the original outlier record', async ({ page }) => {
    await open(page, 'boxplot');
    const actual = await page.evaluate(() => {
        const api = window.__nativeWorksheet,
            result = api.results().at(-1)!;
        return { rows: result.rows, query: api.queries()[result.queryIndex] };
    });
    expect(actual.rows).toHaveLength(99);
    expect(actual.query.workflow.flatMap((step) => (step.type === 'view' ? step.query : []))).toEqual([
        expect.objectContaining({ op: 'raw', fields: expect.arrayContaining(['Region', 'Category', 'Value']) }),
    ]);
    const point = (await interiors(page)).find((item) => item.tag === 'circle');
    expect(point).toBeTruthy();
    const selected = await clickAndCheck(page, point!);
    expect(selected.kind).toBe('datum');
    expect(selected.datumKeys).toHaveLength(1);
    const outlier = 30 + boxOffset(selected);
    expect(selected.values.find((value) => value.field.fid === 'Value')?.raw).toBe(outlier);
    await backend(page, false);
    // Moving between the empty center and the outlier verifies Canvas hover after switching.
    await page.mouse.move(point!.x + 25, point!.y + 25);
    await page.mouse.move(point!.x, point!.y);
    await expect(native(page).getByRole('tooltip')).toContainText(String(outlier));
});
