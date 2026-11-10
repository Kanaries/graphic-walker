import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet, executePlan } from '../src/compiler';
import { buildModel } from '../src/model';
import { metrics } from '../src/layout';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, near, reference } from './helpers';

const instances = fields(['product', 'region', 'segment'], { sum: ['value', 'sum'], cost: ['cost', 'sum'] });
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
const data = (regions: number, products = 3): Row[] => {
    const rows: Row[] = [];
    for (let r = 0; r < regions; r++) for (let p = 0; p < products; p++) rows.push({ region: `R${String(r).padStart(2, '0')}`, product: `P${p}`, segment: p % 2 ? 'a' : 'b', value: 10 + r + p, cost: 3 + p * 2 + r });
    return rows;
};
type Window = { width: number; height: number; scrollbar?: number };
async function stretched(spec: Omit<WorksheetSpec, 'kind' | 'specVersion' | 'instances'>, rows: Row[], window: Window) {
    const plan = compileWorksheet({ ...base, stretch: 'both', ...spec });
    return buildModel(plan, await executePlan(plan, reference(rows)), window);
}
const window = { width: 1200, height: 600 };

test('three bars stay three narrow bars: the value axis takes the height, the steps keep their width', async () => {
    const bars = { columns: field('product'), rows: field('sum'), mark: 'bar' as const };
    const m = await stretched(bars, data(1), window);
    assert.ok(m.columns.leaves.every(leaf => leaf.size === metrics.bandWidth));
    assert.ok(near(m.height, window.height, .5), `height ${m.height}`);
    assert.ok(near(m.rows.leaves[0].size, window.height - m.frame.top - m.frame.bottom, .5));
    assert.ok(near(m.width, m.frame.left + 3 * metrics.bandWidth + m.frame.right, .5) && m.width < window.width / 2, 'the room to the right stays empty');
    // The marks follow: the longest bar spans the slot, and no bar is wider than its step.
    const drawn = fullScene(m).items.filter(p => p.selection);
    assert.ok(Math.max(...drawn.map(p => p.height!)) > window.height * .7);
    assert.ok(drawn.every(p => p.width! <= metrics.bandWidth));
    // The same sheet in a larger window: only the height of the slot changes.
    const larger = await stretched(bars, data(1), { width: 1800, height: 900 });
    assert.ok(near(larger.width, m.width, 12), 'only the width of the axis labels may differ');
    assert.ok(near(larger.height, 900, .5));
});
test('a sheet with a value axis each way fills the window', async () => {
    const m = await stretched({ columns: field('cost'), rows: field('sum'), mark: 'point', detail: ['product'] }, data(1, 8), window);
    assert.ok(near(m.width, window.width, .5) && near(m.height, window.height, .5), `${m.width}×${m.height}`);
});
test('facets share the room evenly', async () => {
    const m = await stretched({ columns: field('product'), rows: nest(field('region'), field('sum')), mark: 'bar' }, data(4), window);
    assert.equal(m.rows.leaves.length, 4);
    const size = (window.height - m.frame.top - m.frame.bottom) / 4;
    assert.ok(m.rows.leaves.every(leaf => near(leaf.size, size, 1e-6)));
    assert.ok(near(m.height, window.height, .5));
});
test('value slots next to member steps on one axis get what the steps leave', async () => {
    // Horizontal bars: members down the rows, one value slot per region across the columns.
    const m = await stretched({ rows: field('product'), columns: nest(field('region'), field('sum')), mark: 'bar' }, data(3), window);
    assert.ok(m.rows.leaves.every(leaf => leaf.size === metrics.bandHeight));
    assert.ok(near(m.width, window.width, .5));
    assert.ok(m.height < window.height / 2);
});
test('slots stop at their least size, and the sheet scrolls from there', async () => {
    const spec = { columns: field('cost'), rows: nest(field('region'), field('sum')), mark: 'point' as const, detail: ['product'] };
    const m = await stretched(spec, data(20), window);
    assert.ok(m.rows.leaves.every(leaf => leaf.size === metrics.slotMinHeight));
    assert.ok(m.height > window.height);
    assert.ok(near(m.width, window.width, .5), 'a scroll bar that lies over the content takes no room');
    // A scroll bar that takes room leaves the other direction that much less.
    const barred = await stretched(spec, data(20), { ...window, scrollbar: 15 });
    assert.ok(near(barred.width, window.width - 15, .5), `width ${barred.width}`);
    // Without a bar the sheet has the whole window.
    const fits = await stretched(spec, data(3), { ...window, scrollbar: 15 });
    assert.ok(near(fits.width, window.width, .5) && near(fits.height, window.height, .5));
});
test('a bar across the bottom shortens the value axis, and never the other way round twice', async () => {
    // Sixty member steps do not fit in 1200 px, so the rows lose the height of a scroll bar.
    const m = await stretched({ columns: field('product'), rows: field('sum'), mark: 'bar' }, data(1, 60), { ...window, scrollbar: 15 });
    assert.ok(m.width > window.width);
    assert.ok(near(m.height, window.height - 15, .5), `height ${m.height}`);
});
test('a sheet of member steps only is not stretched', async () => {
    const spec = { columns: field('product'), rows: field('region'), mark: 'rect' as const, color: 'sum' };
    const plan = compileWorksheet({ ...base, ...spec });
    const natural = buildModel(plan, await executePlan(plan, reference(data(4))));
    const m = await stretched(spec, data(4), window);
    assert.equal(m.width, natural.width);
    assert.equal(m.height, natural.height);
});
test('stretch in one direction leaves the other alone', async () => {
    const m = await stretched({ columns: field('cost'), rows: field('sum'), mark: 'point', detail: ['product'], stretch: 'width' }, data(1, 8), window);
    assert.ok(near(m.width, window.width, .5));
    assert.equal(m.rows.leaves[0].size, metrics.slotHeight);
});
test('a pane size the host set is the least a stretched slot gets', async () => {
    const m = await stretched({ columns: field('product'), rows: nest(field('region'), field('sum')), mark: 'bar', pane: { height: 150 } }, data(8), window);
    assert.ok(m.rows.leaves.every(leaf => leaf.size === 150));
    assert.ok(m.height > window.height);
});
test('pies grow as squares, and only when both directions may', async () => {
    const pie = { mark: 'arc' as const, angle: 'sum', color: 'product', columns: field('region'), rows: { kind: 'empty' as const } };
    const m = await stretched(pie, data(3), window);
    const side = m.columns.leaves[0].size;
    assert.ok(side > metrics.pieSize, `side ${side}`);
    assert.ok(m.columns.leaves.every(leaf => leaf.size === side) && m.rows.leaves.every(leaf => leaf.size === side));
    assert.ok(m.width <= window.width + .5 && m.height <= window.height + .5);
    // Three in a row: the width of a third is less than the height, so the width decides.
    assert.ok(near(side, (window.width - m.frame.left - m.frame.right) / 3, .5));
    const oneWay = await stretched({ ...pie, stretch: 'width' }, data(3), window);
    assert.equal(oneWay.columns.leaves[0].size, metrics.pieSize);
    const many = await stretched(pie, data(30), window);
    assert.equal(many.columns.leaves[0].size, metrics.pieMinSize);
});
test('fit wins where a sheet asks for both', async () => {
    const m = await stretched({ columns: field('product'), rows: field('sum'), mark: 'bar', fit: 'both' }, data(1), window);
    assert.ok(near(m.width, window.width, .5), 'the member steps are scaled up');
    assert.ok(m.columns.leaves[0].size > metrics.bandWidth);
});
test('ticks follow the stretched slot', async () => {
    const short = await stretched({ columns: field('product'), rows: field('sum'), mark: 'bar' }, data(1), { width: 800, height: 200 });
    const tall = await stretched({ columns: field('product'), rows: field('sum'), mark: 'bar' }, data(1), { width: 800, height: 900 });
    assert.ok(tall.rows.leaves[0].scale!.ticks.length > short.rows.leaves[0].scale!.ticks.length);
});
