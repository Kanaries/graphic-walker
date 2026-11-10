import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet } from '../src/compiler';
import { concat, field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model } from './helpers';

const instances = fields(['category', 'sub', 'year', 'segment'], { sum: ['value', 'sum'], mean: ['value', 'mean'], count: ['value', 'count'] });
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
// Two categories whose members rank differently: under F the order by total is b, c, a; under T it is a, c, b.
const totals: Record<string, Record<string, number>> = { F: { a: 10, b: 30, c: 20 }, T: { a: 90, b: 5, c: 40 } };
const rows: Row[] = [];
for (const [category, members] of Object.entries(totals)) for (const [sub, total] of Object.entries(members)) {
    // Split over two years and two segments, so no single record or pane carries the total.
    for (const year of [2024, 2025]) for (const segment of ['x', 'y']) rows.push({ category, sub, year, segment, value: total / 4 });
}
const members = (m: Awaited<ReturnType<typeof model>>, axis: 'rows' | 'columns' = 'rows') => m[axis].groups.map(g => m[axis].leaves.slice(g.start, g.end).map(leaf => leaf.path[leaf.path.length - 1].value));

test('members are ordered by a measure inside each parent, over everything on the other axis', async () => {
    const spec: WorksheetSpec = { ...base, rows: nest(field('category'), field('sub')), columns: nest(field('year'), field('sum')), mark: 'bar', color: 'segment',
        order: { sub: { by: 'sum', direction: 'descending' } } };
    const m = await model(spec, rows);
    assert.deepEqual(members(m), [['b', 'c', 'a'], ['a', 'c', 'b']]);
    assert.deepEqual(members(await model({ ...spec, order: { sub: { by: 'sum' } } }, rows)), [['a', 'c', 'b'], ['b', 'c', 'a']], 'ascending by default');
    // The totals come from a query of their own grain; the marks keep theirs.
    assert.deepEqual(m.plan.tasks.map(t => t.groupBy), [['category', 'segment', 'sub', 'year'], ['category', 'sub']]);
    assert.equal(m.panes.flatMap(p => p.marks).length, 24);
    // Bars follow their members: the first bar of the first pane is b's.
    const first = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    assert.equal(first.selection!.values.sub, 'b');
});
test('a sheet whose marks already have the member grain needs no second query', async () => {
    const m = await model({ ...base, rows: field('sub'), columns: field('sum'), mark: 'bar', order: { sub: { by: 'sum', direction: 'descending' } } }, rows);
    assert.equal(m.plan.tasks.length, 1);
    // Across both categories: a 100, c 60, b 35.
    assert.deepEqual(members(m), [['a', 'c', 'b']]);
});
test('the ordering measure is aggregated at the member grain, not derived from finer records', async () => {
    // p has one large record in 2024 and many small ones in 2025: the mean of its yearly means is 51, its true mean 11.
    const data: Row[] = [{ sub: 'p', year: 2024, value: 100 }, ...Array.from({ length: 9 }, () => ({ sub: 'p', year: 2025, value: 2 })), { sub: 'q', year: 2024, value: 20 }, { sub: 'q', year: 2025, value: 20 }];
    const m = await model({ ...base, rows: field('sub'), columns: nest(field('year'), field('sum')), mark: 'bar', order: { sub: { by: 'mean', direction: 'descending' } } }, data);
    assert.deepEqual(members(m), [['q', 'p']]);
    // The measure need not be drawn anywhere.
    assert.deepEqual(m.plan.tasks.map(t => t.measures.map(f => f.id)), [['sum'], ['mean']]);
});
test('with several measures side by side the named one decides, and outer headers can be ordered too', async () => {
    const data: Row[] = [{ category: 'F', sub: 'a', value: 50 }, { category: 'T', sub: 'a', value: 5 }, { category: 'T', sub: 'b', value: 6 }, { category: 'T', sub: 'c', value: 7 }];
    const spec: WorksheetSpec = { ...base, rows: nest(field('category'), field('sub')), columns: concat(field('sum'), field('count')), mark: 'bar' };
    const order = async (by: string) => (await model({ ...spec, order: { category: { by, direction: 'descending' } } }, data)).rows.groups.map(g => g.path[0].value);
    assert.deepEqual(await order('sum'), ['F', 'T']);
    assert.deepEqual(await order('count'), ['T', 'F']);
});
test('members on columns are ordered the same way, and equal or missing values have a fixed place', async () => {
    const data: Row[] = [{ sub: 'd', value: null }, { sub: 'c', value: 5 }, { sub: 'b', value: 9 }, { sub: 'a', value: 5 }];
    const spec: WorksheetSpec = { ...base, columns: field('sub'), rows: field('sum'), mark: 'bar' };
    assert.deepEqual(members(await model({ ...spec, order: { sub: { by: 'sum', direction: 'descending' } } }, data), 'columns'), [['b', 'a', 'c', 'd']]);
    assert.deepEqual(members(await model({ ...spec, order: { sub: { by: 'sum', direction: 'ascending' } } }, data), 'columns'), [['a', 'c', 'b', 'd']], 'the member without a value stays last');
});
test('a row limit keeps the first records; with a field to order by it is a top N', async () => {
    const data: Row[] = [{ sub: 'a', value: 1 }, { sub: 'b', value: 9 }, { sub: 'c', value: 5 }, { sub: 'd', value: 7 }];
    const spec: WorksheetSpec = { ...base, rows: field('sub'), columns: field('sum'), mark: 'bar' };
    const top = await model({ ...spec, limit: { rows: 2, by: 'sum', direction: 'descending' }, order: { sub: { by: 'sum', direction: 'descending' } } }, data);
    assert.deepEqual(members(top), [['b', 'd']]);
    assert.deepEqual(top.plan.tasks[0].payload.workflow.at(-1), { type: 'sort', by: ['__ws_sum'], sort: 'descending' });
    assert.equal(top.plan.tasks[0].payload.limit, 2);
    // The values that order members are never cut by the limit, so they get a query of their own.
    assert.deepEqual(top.plan.tasks.map(t => [t.id.startsWith('order:'), t.payload.limit]), [[false, 2], [true, undefined]]);
    assert.deepEqual(members(await model({ ...spec, limit: { rows: 3 } }, data)), [['a', 'b', 'c']], 'without a field the records keep their arrival order');
    assert.equal((await model({ ...spec, limit: { rows: 0 } }, data)).rows.leaves.length, 4, 'zero means no limit');
});
test('only a dimension can be ordered, and only by an aggregated measure', () => {
    const spec: WorksheetSpec = { ...base, rows: field('sub'), columns: field('sum'), mark: 'bar' };
    assert.throws(() => compileWorksheet({ ...spec, order: { sub: { by: 'year' } } }), /aggregated measure/);
    assert.throws(() => compileWorksheet({ ...spec, order: { sum: { by: 'sum' } } }), /members of a dimension/);
    assert.throws(() => compileWorksheet({ ...spec, order: { sub: { by: 'nope' } } }), /Unknown field instance/);
});
