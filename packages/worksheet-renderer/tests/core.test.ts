import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet, executePlan } from '../src/compiler';
import { buildScene } from '../src/scene';
import { sceneToSVG } from '../src/vegaBackend';
import { concat, field, nest, type Computation, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model as build } from './helpers';

const instances = fields(['region', 'category', 'product', 'year', 'month', 'segment', 'country'],
    { sum: ['value', 'sum'], mean: ['value', 'mean'], count: ['order', 'distinctCount'] });
const base: WorksheetSpec = { kind: 'worksheet', specVersion: 2, instances,
    rows: nest(field('region'), field('category'), field('product')),
    columns: nest(field('year'), concat(field('sum'), field('mean'))), mark: 'bar', color: 'segment' };
const data: Row[] = [];
for (const region of ['East', 'West']) for (const category of ['A', 'B', 'C']) for (const product of ['p', 'q'])
    for (const year of [2024, 2025]) for (const segment of ['a', 'b']) for (let i = 0; i < (product === 'p' ? 1 : 3); i++) {
        data.push({ region, category, product, year, segment, value: product === 'p' ? 100 : 10, order: i, month: i + 1, country: 'US' });
    }
const model = (spec = base, rows = data) => build(spec, rows);

test('three dimensions + two measures: one query, 24 panes, members are layout positions', async () => {
    const m = await model();
    assert.equal(m.plan.tasks.length, 1);
    assert.equal(m.panes.length, 24);
    assert.equal(m.plan.rows[0].facets.length, 2);
    assert.equal(m.plan.rows[0].position?.id, 'product');
    assert.equal(m.rows.groups.length, 6);
    assert.equal(m.rows.leaves.length, 12);
    assert.equal(m.columns.leaves.length, 4);
    assert.equal(m.panes[0].records.length, 4);
    assert.deepEqual(m.plan.tasks[0].measures.map(m => m.aggregate), ['sum', 'mean']);
});
test('six discrete levels compile without dropping or reordering fields', () => {
    const spec = { ...base, rows: nest(...['country', 'region', 'category', 'product', 'year', 'month'].map(field)) };
    const plan = compileWorksheet(spec);
    assert.deepEqual(plan.rows[0].facets.map(f => f.id), ['country', 'region', 'category', 'product', 'year']);
    assert.equal(plan.rows[0].position?.id, 'month');
});
test('six discrete levels become six header levels', async () => {
    const m = await model({ ...base, rows: nest(...['country', 'region', 'category', 'product', 'year', 'month'].map(field)), columns: field('sum') });
    assert.equal(m.rows.levels.length, 6);
    assert.deepEqual(m.rows.captions, ['country', 'region', 'category', 'product', 'year', 'month']);
    assert.equal(m.frame.rowHeaderWidths.length, 6);
});
test('invalid mixed continuous axes fail before executing queries', () => {
    assert.throws(() => compileWorksheet({ ...base, rows: nest(field('sum'), field('region')) }), /Continuous fields/);
    assert.throws(() => compileWorksheet({ ...base, rows: field('missing') }), /Unknown/);
});
test('mean and distinct count are aggregated at the pane grain, not summed from members', async () => {
    const m = await model({ ...base, rows: field('region'), columns: concat(field('mean'), field('count')), color: undefined });
    const east = m.panes[0].records.find(r => r.region === 'East')!;
    assert.equal(east.__ws_mean, 32.5);
    assert.equal(east.__ws_count, 3);
});
test('null coordinates produce no mark and nonnumeric continuous data fails explicitly', async () => {
    const spec: WorksheetSpec = { ...base, instances: { ...instances, raw: { id: 'raw', field: 'value', display: 'continuous', label: 'raw' } },
        rows: field('product'), columns: field('raw'), color: undefined, mark: 'point' };
    const m = await model(spec, [{ product: 'p', value: null }]);
    assert.equal(buildScene(m, { x: 0, y: 0, width: 800, height: 600 }).items.filter(p => p.selection).length, 0);
    await assert.rejects(model(spec, [{ product: 'p', value: 'hello' }]), /not a number: hello/);
    // Infinity and NaN are missing values: no mark, and they do not stretch the axis.
    const holes = await model(spec, [{ product: 'p', value: -Infinity }, { product: 'q', value: NaN }, { product: 'r', value: 4 }]);
    assert.equal(buildScene(holes, { x: 0, y: 0, width: 800, height: 600 }).items.filter(p => p.selection).length, 1);
    assert.deepEqual(holes.columns.leaves[0].scale!.domain, [0, 4]);
});
test('monthly line uses month positions inside year panes', async () => {
    const m = await model({ ...base, rows: nest(field('region'), field('sum')), columns: nest(field('year'), field('month')), mark: 'line' });
    assert.equal(m.panes.length, 4);
    const scene = fullScene(m);
    assert.equal(scene.items.filter(p => p.kind === 'path').length, 8);
    assert.ok(scene.items.filter(p => p.kind === 'path').every(p => p.path!.includes('L')));
});
test('sparse intersections and number/string keys remain distinct', async () => {
    const rows = [{ region: 1, year: 'A', value: 1 }, { region: '1', year: 'B', value: 2 }];
    const m = await model({ ...base, rows: nest(field('region'), field('sum')), columns: nest(field('year'), field('mean')), mark: 'point', color: undefined }, rows);
    assert.equal(m.rows.leaves.length, 2); assert.equal(m.columns.leaves.length, 2); assert.equal(m.panes.length, 2);
});
test('nesting keeps actual paths, crossing keeps empty slots without inventing records', async () => {
    const rows = [{ category: 'Furniture', product: 'Chair', value: 1 }, { category: 'Office', product: 'Paper', value: 2 }];
    const nested = await model({ ...base, rows: nest(field('category'), field('product')), columns: field('sum'), color: undefined }, rows);
    assert.equal(nested.rows.leaves.length, 2);
    const crossed = await model({ ...base, rows: field('category'), columns: field('product'), mark: 'rect', color: undefined }, rows);
    assert.equal(crossed.rows.leaves.length * crossed.columns.leaves.length, 4);
    assert.equal(fullScene(crossed).items.filter(p => p.selection).length, 2);
});
test('stack domain includes cumulative positive and negative endpoints', async () => {
    const m = await model({ ...base, rows: field('product'), columns: field('sum') }, [
        { product: 'p', segment: 'a', value: 10 }, { product: 'p', segment: 'b', value: 20 }, { product: 'p', segment: 'c', value: -15 },
    ]);
    assert.deepEqual(m.panes[0].xDomain, [-15, 30]);
    const overlapped = await model({ ...base, rows: field('product'), columns: field('sum'), stack: false }, [
        { product: 'p', segment: 'a', value: 10 }, { product: 'p', segment: 'b', value: 20 }, { product: 'p', segment: 'c', value: -15 },
    ]);
    assert.deepEqual(overlapped.panes[0].xDomain, [-15, 20]);
});
test('a range is shared by the sheet, by an outer header, or by one column of panes', async () => {
    const rows = [
        { year: 2024, category: 'A', product: 'p', value: 10 },
        { year: 2024, category: 'B', product: 'p', value: 20 },
        { year: 2025, category: 'A', product: 'p', value: 100 },
    ];
    const spec: WorksheetSpec = { ...base, rows: field('product'), columns: nest(field('year'), field('category'), field('sum')), color: undefined };
    const maxima = async (scaleScope?: WorksheetSpec['scaleScope']) => (await model({ ...spec, scaleScope }, rows)).columns.leaves.map(leaf => leaf.scale!.domain[1]);
    assert.deepEqual(await maxima(), [100, 100, 100]);
    assert.deepEqual(await maxima('independent'), [10, 20, 100]);
    assert.deepEqual(await maxima('prefix'), [20, 20, 100]);
});
test('viewport culling never changes global domains or exported pane count', async () => {
    const m = await model();
    const domains = JSON.stringify(m.panes.map(p => p.xDomain));
    const scene = buildScene(m, { x: 0, y: 0, width: 420, height: 200 });
    assert.ok(scene.visiblePanes > 0 && scene.visiblePanes < m.panes.length);
    assert.equal(JSON.stringify(m.panes.map(p => p.xDomain)), domains);
    const full = fullScene(m);
    assert.equal(full.visiblePanes, m.panes.length);
    const svg = await sceneToSVG(full);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('SUM') && svg.includes('MEAN'));
});
test('selection carries complete surviving grain and raw field predicates', async () => {
    const m = await model();
    const scene = buildScene(m, { x: 0, y: 0, width: 800, height: 600 });
    const selection = scene.items.find(p => p.selection)!.selection!;
    assert.deepEqual(selection.predicates.map(p => p.field).sort(), ['category', 'product', 'region', 'segment', 'year']);
});
test('filter workflows run before aggregation', async () => {
    const m = await model({ ...base, filters: [{ field: 'region', values: ['West'] }] });
    assert.equal(m.panes.length, 12);
    assert.ok(m.panes.every(p => p.row.path[0].value === 'West'));
});
test('executor caps concurrency and stops scheduling after cancellation', async () => {
    const plan = compileWorksheet(base);
    plan.tasks = Array.from({ length: 10 }, (_, i) => ({ ...plan.tasks[0], id: String(i) }));
    let running = 0, max = 0, calls = 0;
    const computation: Computation = async () => { calls++; max = Math.max(max, ++running); await new Promise(r => setTimeout(r, 2)); running--; return []; };
    await executePlan(plan, computation);
    assert.equal(max, 4); assert.equal(calls, 10);
    const controller = new AbortController(); controller.abort(); calls = 0;
    await assert.rejects(executePlan(plan, computation, controller.signal));
    assert.equal(calls, 0);
});
