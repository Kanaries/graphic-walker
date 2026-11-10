import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet } from '../src/compiler';
import { metrics } from '../src/layout';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model, near } from './helpers';

const instances = { ...fields(['product', 'segment', 'region'], { sum: ['value', 'sum'] }),
    month: { id: 'month', field: 'month', label: 'Month', display: 'continuous' as const, scale: 'time' as const } };
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
// p piles 10 + 30, q piles 20 + 20 + 60.
const piles: Row[] = [{ product: 'p', segment: 'a', value: 10 }, { product: 'p', segment: 'b', value: 30 },
    { product: 'q', segment: 'a', value: 20 }, { product: 'q', segment: 'b', value: 20 }, { product: 'q', segment: 'c', value: 60 }];
const bars: WorksheetSpec = { ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment' };
const intervals = (m: Awaited<ReturnType<typeof model>>) => m.panes.flatMap(p => p.marks).map(k => [k.record.product, k.record.segment, k.start, k.end]);

test('normalize stacks shares, so every pile runs from 0 to 100%', async () => {
    const m = await model({ ...bars, stack: 'normalize' }, piles);
    assert.deepEqual(intervals(m), [['p', 'a', 0, .25], ['q', 'a', 0, .2], ['p', 'b', .25, 1], ['q', 'b', .2, .4], ['q', 'c', .4, 1]]);
    const leaf = m.columns.leaves[0];
    assert.deepEqual(leaf.scale!.domain, [0, 1]);
    assert.deepEqual([leaf.scale!.labels![0], leaf.scale!.labels!.at(-1)], ['0%', '100%']);
    const scene = fullScene(m);
    // Both piles end at the same place although q is more than twice p.
    const ends = scene.items.filter(p => p.selection).map(p => p.x + p.width!);
    assert.ok(near(Math.max(...ends.slice(0, 5)), m.frame.left + leaf.size - metrics.scalePadEnd));
    const byProduct = (product: string) => Math.max(...scene.items.filter(p => p.selection?.values.product === product).map(p => p.x + p.width!));
    assert.ok(near(byProduct('p'), byProduct('q'), .01));
    assert.match(scene.items.find(p => p.selection?.values.product === 'p' && p.selection.values.segment === 'a')!.tooltip!, /SUM: 10\n(.*\n)?Share: 25%$/);
    assert.ok(scene.items.some(p => p.layer === 'xAxis' && p.text === '100%'));
});
test('normalize piles magnitudes, and a pile that adds up to nothing draws nothing', async () => {
    const m = await model({ ...bars, stack: 'normalize' }, [{ product: 'p', segment: 'a', value: -10 }, { product: 'p', segment: 'b', value: 30 }, { product: 'z', segment: 'a', value: 0 }]);
    assert.deepEqual(intervals(m).filter(i => i[0] === 'p'), [['p', 'a', 0, .25], ['p', 'b', .25, 1]]);
    assert.equal(fullScene(m).items.filter(p => p.selection).length, 2);
});
test('center stacks end to end with each pile centered on zero', async () => {
    const m = await model({ ...bars, stack: 'center' }, piles);
    assert.deepEqual(intervals(m), [['p', 'a', -20, -10], ['q', 'a', -50, -30], ['p', 'b', -10, 20], ['q', 'b', -30, -10], ['q', 'c', -10, 50]]);
    assert.deepEqual(m.columns.leaves[0].scale!.domain, [-50, 50]);
});
test('stack: true is unchanged and stack: false overlaps from zero, longest painted first', async () => {
    assert.deepEqual(intervals(await model({ ...bars, stack: true }, piles)).filter(i => i[0] === 'p'), [['p', 'a', 0, 10], ['p', 'b', 10, 40]]);
    const loose = await model({ ...bars, stack: false }, piles);
    assert.deepEqual(intervals(loose).filter(i => i[0] === 'q').map(i => i[3]), [60, 20, 20]);
    assert.deepEqual(loose.columns.leaves[0].scale!.domain, [0, 60]);
    // Bars reach back to zero even on an axis told not to start there.
    const free = await model({ ...bars, stack: false, instances: { ...instances, sum: { ...instances.sum, zero: false } } }, piles);
    assert.equal(free.columns.leaves[0].scale!.domain[0], 0);
});

// ---- area
const months = ['2024-01-01', '2024-02-01', '2024-03-01'];
const series: Row[] = months.flatMap((month, i) => [{ month, segment: 'a', value: 10 * (i + 1) }, { month, segment: 'b', value: 5 }]);
const area: WorksheetSpec = { ...base, rows: field('sum'), columns: field('month'), mark: 'area', color: 'segment' };
const corners = (path: string) => path.replace(/[MZ]/g, '').split('L').map(p => p.split(',').map(Number));

test('stacked areas fill from where the pile has reached to where the series ends', async () => {
    const m = await model(area, series);
    const scene = fullScene(m);
    const shapes = scene.items.filter(p => p.kind === 'shape');
    assert.equal(shapes.length, 2);
    assert.deepEqual(m.rows.leaves[0].scale!.domain, [0, 35]);
    const [a, b] = shapes.map(p => corners(p.path!));
    // Three points out along the upper edge and three back along the lower one.
    assert.equal(a.length, 6);
    // The lower edge of b is the upper edge of a, point for point.
    assert.deepEqual(b.slice(3).reverse(), a.slice(0, 3));
    // a sits on the zero line.
    assert.ok(a.slice(3).every(([, y]) => near(y, a[5][1], .01)));
    // Each series has an outline on its upper edge and a spot per point that answers the pointer.
    assert.equal(scene.items.filter(p => p.kind === 'path').length, 2);
    const spots = scene.items.filter(p => p.kind === 'symbol' && p.selection);
    assert.equal(spots.length, 6);
    assert.ok(spots.every(p => p.fill === 'transparent' && p.tooltip));
    const top = spots.find(p => p.selection!.values.segment === 'b' && String(p.selection!.values.month) === months[2])!;
    assert.ok(near(top.y, b[2][1], .1), 'the spot of a stacked series sits on its upper edge, not at its own value');
});
test('unstacked areas all start from zero and let each other show through', async () => {
    const stackedOpacity = fullScene(await model(area, series)).items.find(p => p.kind === 'shape')!.opacity!;
    const scene = fullScene(await model({ ...area, stack: false }, series));
    const shapes = scene.items.filter(p => p.kind === 'shape');
    const bases = shapes.map(p => corners(p.path!).slice(3).map(([, y]) => y));
    assert.ok(bases.flat().every(y => near(y, bases[0][0], .01)));
    assert.ok(shapes[0].opacity! < stackedOpacity);
});
test('normalized areas fill the whole height at every position', async () => {
    const m = await model({ ...area, stack: 'normalize' }, series);
    const [, b] = fullScene(m).items.filter(p => p.kind === 'shape').map(p => corners(p.path!));
    const leaf = m.rows.leaves[0];
    assert.ok(b.slice(0, 3).every(([, y]) => near(y, m.frame.top + metrics.scalePadEnd, .1)), 'the last series ends at 100% everywhere');
    assert.deepEqual(leaf.scale!.domain, [0, 1]);
});
test('a missing value breaks an area, and a lone point is still drawn', async () => {
    const holes: Row[] = [{ month: months[0], value: 4 }, { month: months[1], value: null }, { month: months[2], value: 6 }];
    const scene = fullScene(await model({ ...area, color: undefined }, holes));
    assert.equal(scene.items.filter(p => p.kind === 'shape').length, 0, 'no segment has two points');
    const slivers = scene.items.filter(p => p.kind === 'rect' && p.layer === 'body' && p.width === 3);
    assert.equal(slivers.length, 2);
    assert.ok(slivers.every(p => p.height! > 10));
});
test('areas run along members too, sideways when the measure is on columns, and need one measure axis', async () => {
    const data: Row[] = ['x', 'y', 'z'].map((product, i) => ({ product, region: 'r', value: i + 1 }));
    const down = fullScene(await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'area' }, data));
    const [shape] = down.items.filter(p => p.kind === 'shape');
    const points = corners(shape.path!);
    // Upper edge: x grows with the value while y steps down the members.
    assert.ok(points[0][0] < points[1][0] && points[1][0] < points[2][0]);
    assert.ok(points[0][1] < points[1][1] && points[1][1] < points[2][1]);
    assert.ok(points.slice(3).every(([x]) => near(x, points[5][0], .01)), 'the lower edge is the zero line');
    const nested = await model({ ...base, rows: field('sum'), columns: nest(field('region'), field('product')), mark: 'area' }, data);
    assert.equal(fullScene(nested).items.filter(p => p.kind === 'shape').length, 1);
    assert.throws(() => compileWorksheet({ ...base, rows: field('product'), columns: field('region'), mark: 'area' }), /Area marks need one measure axis/);
});
