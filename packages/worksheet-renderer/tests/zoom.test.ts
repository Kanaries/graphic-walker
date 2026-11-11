import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipLine, clipPolygon, clipRect } from '../src/clip';
import { compileWorksheet, executePlan } from '../src/compiler';
import { metrics } from '../src/layout';
import { buildModel, type Zoom } from '../src/model';
import { buildScene } from '../src/scene';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { axesAt, panned, withRange, zoomed } from '../src/zoom';
import { fields, near, reference } from './helpers';

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
test('rectangles, lines and outlines are cut to a box', () => {
    assert.deepEqual(clipRect(box, -5, 2, 10, 3), [0, 2, 5, 3]);
    assert.equal(clipRect(box, 11, 2, 4, 3), undefined);
    // A line that leaves the box and comes back becomes two pieces.
    assert.deepEqual(clipLine(box, [[-5, 5], [5, 5], [5, 15], [8, 15], [8, 5]]), [[[0, 5], [5, 5], [5, 10]], [[8, 10], [8, 5]]]);
    assert.deepEqual(clipLine(box, [[20, 20], [30, 30]]), []);
    assert.deepEqual(clipLine(box, [[2, 2], [4, 4], [6, 2]]), [[[2, 2], [4, 4], [6, 2]]]);
    // A segment that crosses the whole box without a point inside it still shows.
    assert.deepEqual(clipLine(box, [[-5, 5], [15, 5]]), [[[0, 5], [10, 5]]]);
    const cut = clipPolygon(box, [[-5, 2], [5, 2], [5, 8], [-5, 8]]);
    assert.deepEqual([Math.min(...cut.map(p => p[0])), Math.max(...cut.map(p => p[0]))], [0, 5]);
    assert.deepEqual(clipPolygon(box, [[20, 20], [30, 20], [30, 30]]), []);
});

const instances = { ...fields(['region', 'product'], { sum: ['value', 'sum'], qty: ['qty', 'sum'] }),
    when: { id: 'when', field: 'when', label: 'When', display: 'continuous' as const, scale: 'time' as const } };
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
const rows: Row[] = [];
for (const region of ['E', 'W']) for (const [product, value] of [['a', 20], ['b', 60], ['c', 100]] as const) rows.push({ region, product, value: region === 'E' ? value : value / 2, qty: value / 10, when: `2024-0${'abc'.indexOf(product) + 1}-01` });
async function build(spec: WorksheetSpec, zoom?: Zoom) {
    const plan = compileWorksheet(spec);
    const m = buildModel(plan, await executePlan(plan, reference(rows)), undefined, undefined, zoom);
    return { m, scene: buildScene(m, { x: 0, y: 0, width: m.width, height: m.height }) };
}
const bars: WorksheetSpec = { ...base, rows: nest(field('region'), field('product')), columns: field('sum'), mark: 'bar' };

test('a zoomed axis shows its new range in every pane that shares it, and keeps the range the data asks for', async () => {
    const plain = await build(bars);
    const scale = plain.m.columns.leaves[0].scale!;
    assert.deepEqual(scale.domain, [0, 100]);
    assert.deepEqual(scale.full, [0, 100]);
    const { m, scene } = await build(bars, { [scale.key!]: [40, 80] });
    assert.deepEqual(m.columns.leaves[0].scale!.domain, [40, 80]);
    assert.deepEqual(m.columns.leaves[0].scale!.full, [0, 100]);
    assert.ok(m.columns.leaves[0].scale!.ticks.every(t => t >= 40 && t <= 80));
    // The frame does not move with the zoom.
    assert.equal(m.width, plain.m.width);
    const leaf = m.columns.leaves[0], x0 = m.frame.left + leaf.offset, x1 = x0 + leaf.size;
    const drawn = scene.items.filter(p => p.selection);
    // 20 and the three halved values of W up to 30 end before the range and leave nothing; the rest are cut at both edges.
    assert.deepEqual(drawn.map(p => p.selection!.values.__ws_sum).sort((a, b) => a - b), [50, 60, 100]);
    assert.ok(drawn.every(p => p.x >= x0 - 1e-6 && p.x + p.width! <= x1 + 1e-6), 'no bar leaves its pane');
    const longest = drawn.find(p => p.selection!.values.__ws_sum === 100)!;
    assert.ok(near(longest.x, x0) && near(longest.x + longest.width!, x1), 'a bar that spans the range fills the pane from edge to edge');
    // A range that is not one is ignored.
    assert.deepEqual((await build(bars, { [scale.key!]: [80, 40] })).m.columns.leaves[0].scale!.domain, [0, 100]);
});
test('points outside a zoomed range are left out, lines are cut at the pane edge, and a time axis zooms too', async () => {
    const scatter: WorksheetSpec = { ...base, rows: field('sum'), columns: field('qty'), mark: 'circle', detail: ['product', 'region'] };
    const plain = await build(scatter);
    const key = plain.m.columns.leaves[0].scale!.key!;
    assert.equal(plain.scene.items.filter(p => p.selection).length, 6);
    assert.equal((await build(scatter, { [key]: [5, 7] })).scene.items.filter(p => p.selection).length, 2);
    const line: WorksheetSpec = { ...base, rows: field('sum'), columns: field('when'), mark: 'line', detail: ['region'] };
    const whole = await build(line);
    const time = whole.m.columns.leaves[0].scale!;
    const middle: [number, number] = [Date.parse('2024-01-20'), Date.parse('2024-02-10')];
    const cut = await build(line, { [time.key!]: middle });
    const leaf = cut.m.columns.leaves[0], x0 = cut.m.frame.left + leaf.offset, x1 = x0 + leaf.size;
    const paths = cut.scene.items.filter(p => p.kind === 'path');
    assert.equal(paths.length, 2);
    for (const path of paths) {
        const xs = path.path!.replace(/M/g, '').split(/[L ]/).map(p => Number(p.split(',')[0]));
        assert.ok(xs.every(x => x >= x0 - .1 && x <= x1 + .1), `a line leaves its pane: ${xs}`);
        assert.ok(near(xs[0], x0, .1), 'the line starts on the left edge although its first point is outside');
    }
    assert.equal(cut.scene.items.filter(p => p.kind === 'symbol' && p.selection).length, 2, 'only the February points are inside');
    assert.ok(cut.m.columns.leaves[0].scale!.labels!.length > 0);
});
test('the pointer finds the value axes of the pane under it and where along them it is', async () => {
    const { m, scene } = await build({ ...base, rows: nest(field('region'), field('sum')), columns: nest(field('product'), field('qty')), mark: 'circle' });
    const viewport = { x: 0, y: 0, width: m.width, height: m.height };
    const column = m.columns.leaves[1], row = m.rows.leaves[1];
    const px = m.frame.left + column.offset + metrics.scalePadStart + (column.size - metrics.scalePadStart - metrics.scalePadEnd) * .25;
    const py = m.frame.top + row.offset + row.size - metrics.scalePadStart - (row.size - metrics.scalePadStart - metrics.scalePadEnd) * .75;
    const at = axesAt(m, scene.body, viewport, px, py);
    assert.equal(at.x!.leaf, column);
    assert.equal(at.y!.leaf, row);
    assert.ok(near(at.x!.t, .25, 1e-9) && near(at.y!.t, .75, 1e-9));
    // Scrolled, the same window position is over a later pane.
    assert.equal(axesAt(m, scene.body, { ...viewport, x: column.size }, px, py).x!.leaf, m.columns.leaves[2]);
    // Outside the body, and over a pane without a value axis, there is nothing to zoom.
    assert.deepEqual(axesAt(m, scene.body, viewport, 2, py), {});
    const table = await build({ ...base, rows: field('region'), columns: field('product'), mark: 'text', text: 'sum' });
    assert.deepEqual(axesAt(table.m, table.scene.body, { x: 0, y: 0, width: table.m.width, height: table.m.height }, table.m.frame.left + 5, table.m.frame.top + 5), {});
});
test('zooming keeps the value under the pointer in place, panning moves the range with the drag', async () => {
    const { m } = await build(bars);
    const leaf = m.columns.leaves[0];
    // A quarter of the way along 0..100 is 25; after zooming in by half it is still a quarter of the way along.
    assert.deepEqual(zoomed(leaf, [0, 100], .25, .5), [12.5, 62.5]);
    assert.deepEqual(zoomed(leaf, [12.5, 62.5], .25, 2), [0, 100]);
    // Zoom stops at 20 times the range the data asks for, and at a ten-thousandth of it.
    assert.equal(zoomed(leaf, [0, 100], .5, 1e9)[1] - zoomed(leaf, [0, 100], .5, 1e9)[0], 2000);
    assert.ok(near(zoomed(leaf, [0, 100], .5, 1e-9)[1] - zoomed(leaf, [0, 100], .5, 1e-9)[0], .01, 1e-9));
    const pixels = leaf.size - metrics.scalePadStart - metrics.scalePadEnd;
    // Dragging right by half the axis brings lower values into view.
    assert.deepEqual(panned(leaf, [0, 100], pixels / 2), [-50, 50]);
    const key = leaf.scale!.key!;
    assert.deepEqual(withRange({}, leaf, [10, 20]), { [key]: [10, 20] });
    assert.deepEqual(withRange({ [key]: [10, 20] }, leaf, [0, 100]), {}, 'back at the full range there is no zoom left');
});
