import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightTheme } from '../src/color';
import { compileWorksheet, executePlan } from '../src/compiler';
import { metrics } from '../src/layout';
import { buildModel } from '../src/model';
import { buildScene } from '../src/scene';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { logTicks, position, valueAt } from '../src/warp';
import { panned, zoomed } from '../src/zoom';
import { sceneToSVG } from '../src/vegaBackend';
import { fields, near, reference } from './helpers';

const instances = fields(['region', 'product'], { sum: ['value', 'sum'], qty: ['qty', 'sum'] });
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
async function build(spec: WorksheetSpec, rows: Row[], theme = lightTheme) {
    const plan = compileWorksheet(spec);
    const m = buildModel(plan, await executePlan(plan, reference(rows)), { width: 0, height: 0, font: theme.font });
    return { m, items: buildScene(m, { x: 0, y: 0, width: m.width, height: m.height }, { theme }).items };
}
const decades: Row[] = [{ product: 'a', value: 1, qty: 1 }, { product: 'b', value: 10, qty: 4 }, { product: 'c', value: 100, qty: 9 }, { product: 'd', value: 1000, qty: 16 }];
const marks = (items: Awaited<ReturnType<typeof build>>['items']) => items.filter(p => p.selection).sort((a, b) => String(a.selection!.values.product).localeCompare(String(b.selection!.values.product)));

test('scale types place values and give them back', () => {
    assert.equal(position([1, 1000], 10, 'log'), 1 / 3);
    assert.ok(near(valueAt([1, 1000], 2 / 3, 'log'), 100, 1e-9));
    assert.ok(Number.isNaN(position([1, 1000], 0, 'log')));
    assert.equal(position([0, 100], 25, 'sqrt'), .5);
    assert.equal(position([-100, 100], 0, 'symlog'), .5);
    assert.equal(position([0, 100], 25), .25);
    assert.deepEqual(logTicks(1, 1000, 4), [1, 10, 100, 1000]);
    assert.deepEqual(logTicks(1, 100, 12), [1, 2, 5, 10, 20, 50, 100]);
    assert.equal(logTicks(20, 60, 5), undefined, 'inside one power of ten the ticks are linear');
});
test('a log axis gives every power of ten the same room and leaves out what has no place on it', async () => {
    const spec: WorksheetSpec = { ...base, rows: field('product'), columns: field('sum'), mark: 'circle', scales: { columns: { type: 'log' } } };
    const { m, items } = await build(spec, decades);
    const scale = m.columns.leaves[0].scale!;
    assert.deepEqual([scale.domain, scale.type, scale.ticks], [[1, 1000], 'log', [1, 10, 100, 1000]]);
    const xs = marks(items).map(p => p.x);
    assert.ok(near(xs[1] - xs[0], xs[2] - xs[1], .01) && near(xs[2] - xs[1], xs[3] - xs[2], .01), `steps are ${xs}`);
    // Zero and negative values have no place and leave no mark; the axis is unaffected by them.
    const holes = await build(spec, [...decades, { product: 'e', value: 0 }, { product: 'f', value: -5 }]);
    assert.equal(marks(holes.items).length, 4);
    assert.deepEqual(holes.m.columns.leaves[0].scale!.domain, [1, 1000]);
    // Bars start at the edge of the axis, as there is no zero to start from.
    const bars = await build({ ...spec, mark: 'bar' }, decades);
    const leaf = bars.m.columns.leaves[0], start = bars.m.frame.left + leaf.offset + metrics.scalePadStart;
    assert.ok(marks(bars.items).every(p => near(p.x, start, .01)));
    assert.deepEqual(marks(bars.items).map(p => Math.round(p.width!)), [1, 62, 124, 186].map((w, i) => i === 0 ? 1 : w));
});
test('a square root axis keeps zero and thins the labels that crowd near it', async () => {
    const { m, items } = await build({ ...base, columns: field('product'), rows: field('sum'), mark: 'circle', scales: { rows: { type: 'sqrt' } } }, decades);
    const scale = m.rows.leaves[0].scale!;
    assert.equal(scale.domain[0], 0);
    const ys = marks(items).map(p => p.y);
    // 10 sits a tenth of the way up, not a hundredth.
    assert.ok(near((ys[0] - ys[1]) / (ys[0] - ys[3]), (Math.sqrt(10) - 1) / (Math.sqrt(1000) - 1), .01));
    assert.ok(scale.labels!.length === scale.ticks.length);
});
test('fixed ends of an axis win over the data, and marks outside are cut off', async () => {
    const spec: WorksheetSpec = { ...base, rows: field('product'), columns: field('sum'), mark: 'bar', scales: { columns: { min: 5, max: 500 } } };
    const { m, items } = await build(spec, decades);
    const scale = m.columns.leaves[0].scale!;
    assert.deepEqual([scale.domain, scale.full, scale.fixed], [[5, 500], [5, 500], true]);
    const leaf = m.columns.leaves[0], x0 = m.frame.left + leaf.offset, x1 = x0 + leaf.size;
    const drawn = marks(items);
    // The bar of 1 ends before the range and is gone; the bar of 1000 is cut at the right edge.
    assert.deepEqual(drawn.map(p => p.selection!.values.product), ['b', 'c', 'd']);
    assert.ok(drawn.every(p => p.x >= x0 && p.x + p.width! <= x1 + 1e-6));
    assert.ok(near(drawn[2].x + drawn[2].width!, x1));
    // One end alone: the other still follows the data.
    assert.deepEqual((await build({ ...spec, scales: { columns: { max: 50 } } }, decades)).m.columns.leaves[0].scale!.domain, [0, 50]);
    // Rows and columns are set apart.
    assert.equal((await build({ ...spec, scales: { rows: { max: 50 } } }, decades)).m.columns.leaves[0].scale!.fixed, undefined);
});
test('zooming a log axis keeps the value under the pointer and never reaches zero', async () => {
    const { m } = await build({ ...base, rows: field('product'), columns: field('sum'), mark: 'circle', scales: { columns: { type: 'log' } } }, decades);
    const leaf = m.columns.leaves[0];
    // A third of the way along 1..1000 is 10.
    const closer = zoomed(leaf, [1, 1000], 1 / 3, .5);
    assert.ok(near(position(closer, 10, 'log'), 1 / 3, 1e-9));
    assert.ok(closer[0] > 1 && closer[1] < 1000);
    const far = panned(leaf, [1, 1000], 5000);
    assert.ok(far[0] > 0 && far[1] > far[0]);
});

// ---- channels
test('a color range can be fixed and spread by a scale type', async () => {
    const theme = { ...lightTheme, ramp: ['#000000', '#ffffff'] };
    const spec: WorksheetSpec = { ...base, rows: field('product'), columns: field('qty'), mark: 'bar', color: 'sum' };
    const fills = async (scales: WorksheetSpec['scales']) => marks((await build({ ...spec, scales }, decades, theme)).items).map(p => p.fill);
    assert.deepEqual(await fills({ color: { type: 'log' } }), ['rgb(0,0,0)', 'rgb(85,85,85)', 'rgb(170,170,170)', 'rgb(255,255,255)']);
    // Values past a fixed end take the color of that end.
    assert.deepEqual(await fills({ color: { min: 10, max: 100 } }), ['rgb(0,0,0)', 'rgb(0,0,0)', 'rgb(255,255,255)', 'rgb(255,255,255)']);
    const legend = (await build({ ...spec, scales: { color: { min: 10, max: 100 } } }, decades, theme)).items.filter(p => p.layer === 'legend' && p.fontSize === 10).map(p => p.text);
    assert.deepEqual(legend, ['10', '100']);
});
test('size and opacity take a range set by hand, in px and in opacity', async () => {
    const points: WorksheetSpec = { ...base, rows: field('sum'), columns: field('product'), mark: 'circle', size: 'qty', opacity: 'qty', scales: { size: { range: [10, 90] }, opacity: { range: [.2, .6] } } };
    const { items } = await build(points, decades);
    // Sizes still measure from zero: qty runs 1, 4, 9, 16.
    assert.deepEqual(marks(items).map(p => p.size), [15, 30, 55, 90]);
    // Opacity runs over its own range, 1..16.
    assert.ok(marks(items).every((p, i) => near(p.opacity!, .2 + .4 * ([1, 4, 9, 16][i] - 1) / 15, 1e-9)));
    // A fixed start replaces the zero a size measures from.
    const fixed = await build({ ...points, scales: { size: { range: [10, 90], min: 1 } } }, decades);
    assert.deepEqual(marks(fixed.items).map(p => p.size), [10, 26, 10 + 80 * 8 / 15, 90]);
    // Bars take their thickness in px, never more than the member's step.
    const bars = await build({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', size: 'qty', scales: { size: { range: [4, 20] } } }, decades);
    assert.deepEqual(marks(bars.items).map(p => p.height), [5, 8, 13, 20]);
    const wide = await build({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', size: 'qty', scales: { size: { range: [4, 400] } } }, decades);
    assert.equal(Math.max(...marks(wide.items).map(p => p.height!)), metrics.bandHeight);
});
test('a channel set to range independently reads every pane against its own values', async () => {
    const theme = { ...lightTheme, ramp: ['#000000', '#ffffff'] };
    const rows: Row[] = [{ region: 'E', product: 'a', value: 1 }, { region: 'E', product: 'b', value: 2 }, { region: 'W', product: 'a', value: 100 }, { region: 'W', product: 'b', value: 300 }];
    const spec: WorksheetSpec = { ...base, rows: nest(field('region'), field('product')), columns: field('sum'), mark: 'bar', color: 'sum' };
    const shared = await build(spec, rows, theme);
    assert.equal(new Set(shared.items.filter(p => p.selection).map(p => p.fill)).size, 4);
    const own = await build({ ...spec, scales: { color: { independent: true } } }, rows, theme);
    const fills = own.items.filter(p => p.selection).sort((a, b) => a.y - b.y).map(p => p.fill);
    assert.deepEqual(fills, ['rgb(0,0,0)', 'rgb(255,255,255)', 'rgb(0,0,0)', 'rgb(255,255,255)']);
    assert.deepEqual(own.m.panes.map(p => p.domains!.color), [[1, 2], [100, 300]]);
    // The legend can name no numbers, only which end is which.
    assert.deepEqual(own.items.filter(p => p.layer === 'legend' && p.fontSize === 10).map(p => p.text), ['Low', 'High']);
    // A dimension keeps one color per member in every pane, whatever the setting.
    const members = await build({ ...spec, color: 'product', scales: { color: { independent: true } } }, rows, theme);
    assert.equal(members.m.panes.every(p => !p.domains), true);
});

// ---- theme style
test('the theme sets font, grid dashes, line and point strokes, filled points and rounded bar ends', async () => {
    const styled = { ...lightTheme, font: 'Georgia, serif', gridDash: [1, 3] as [number, number], lineWidth: 2.5, pointStrokeWidth: 3, barRadius: 4 };
    const bars = await build({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar' }, decades, styled);
    assert.ok(bars.items.filter(p => p.kind === 'text').every(p => p.font === 'Georgia, serif'));
    assert.ok(marks(bars.items).every(p => JSON.stringify(p.radius) === '[0,4,4,0]'), 'the far end of a bar that runs right is its right end');
    const grid = bars.items.filter(p => p.kind === 'path' && p.dash);
    assert.ok(grid.length > 0 && grid.every(p => p.stroke === styled.grid && JSON.stringify(p.dash) === '[1,3]'));
    // The grid is painted under the bars, though a stroked line is a different kind of primitive than a bar.
    assert.ok(grid.every(p => p.under));
    const svg = await sceneToSVG(buildScene(bars.m, { x: 0, y: 0, width: bars.m.width, height: bars.m.height }, { theme: styled }));
    assert.ok(svg.indexOf('stroke-dasharray') > 0 && svg.indexOf('stroke-dasharray') < svg.indexOf(lightTheme.mark), 'dashed grid lines come before the first bar');
    // The zero line stays solid.
    assert.ok(bars.items.some(p => p.kind === 'rect' && p.fill === styled.zero && p.width === 1));
    const upright = await build({ ...base, columns: field('product'), rows: field('sum'), mark: 'bar' }, decades.map(r => ({ ...r, value: -r.value })), styled);
    assert.ok(marks(upright.items).every(p => JSON.stringify(p.radius) === '[0,0,4,4]'), 'a bar that runs down is rounded at the bottom');
    const line = await build({ ...base, columns: field('product'), rows: field('sum'), mark: 'line' }, decades, styled);
    assert.equal(line.items.find(p => p.kind === 'path' && !p.dash)!.strokeWidth, 2.5);
    const points = await build({ ...base, columns: field('product'), rows: field('sum'), mark: 'point' }, decades, styled);
    assert.ok(marks(points.items).every(p => p.strokeWidth === 3 && p.fill === 'transparent'));
    const filled = await build({ ...base, columns: field('product'), rows: field('sum'), mark: 'point' }, decades, { ...styled, pointFilled: true });
    assert.ok(marks(filled.items).every(p => p.fill !== 'transparent' && !p.stroke));
    // Without these the scene is what it was.
    const plain = await build({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar' }, decades);
    assert.ok(plain.items.every(p => !p.font && !p.radius && !p.dash));
});
