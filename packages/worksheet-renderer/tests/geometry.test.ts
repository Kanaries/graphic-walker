import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet, executePlan } from '../src/compiler';
import { buildModel } from '../src/model';
import { buildScene } from '../src/scene';
import { metrics } from '../src/layout';
import { concat, field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model, near, reference } from './helpers';

const instances = fields(['category', 'sub', 'region', 'year', 'month', 'product', 'segment'], { sum: ['value', 'sum'] });
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };

// Requirement A17. Groups of 4, 9 and 4 members, as in the Tableau reference views.
const unequal: Row[] = [];
for (const [category, count] of [['Furniture', 4], ['Office Supplies', 9], ['Technology', 4]] as const)
    for (let i = 0; i < count; i++) unequal.push({ category, sub: `${category[0]}${i}`, value: 10 + i });

test('A17: horizontal bars share one member step and one thickness across groups of 4, 9 and 4', async () => {
    const m = await model({ ...base, rows: nest(field('category'), field('sub')), columns: field('sum'), mark: 'bar' }, unequal);
    const bars = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.y - b.y);
    assert.equal(bars.length, 17);
    assert.ok(bars.every(b => near(b.height!, bars[0].height!)), `thickness differs: ${[...new Set(bars.map(b => b.height!.toFixed(1)))]}`);
    const steps = bars.slice(1).map((b, i) => b.y - bars[i].y);
    assert.ok(steps.every(s => near(s, steps[0])), `step differs: ${[...new Set(steps.map(s => s.toFixed(1)))]}`);
});
test('A17: vertical bars share one member step and one width across groups of 4, 9 and 4', async () => {
    const m = await model({ ...base, columns: nest(field('category'), field('sub')), rows: field('sum'), mark: 'bar' }, unequal);
    const bars = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.x - b.x);
    assert.ok(bars.every(b => near(b.width!, bars[0].width!)), `width differs: ${[...new Set(bars.map(b => b.width!.toFixed(1)))]}`);
    const steps = bars.slice(1).map((b, i) => b.x - bars[i].x);
    assert.ok(steps.every(s => near(s, steps[0])), `step differs: ${[...new Set(steps.map(s => s.toFixed(1)))]}`);
});
test('a member without records in one pane keeps its slot there', async () => {
    const rows: Row[] = [];
    for (const region of ['E', 'W']) for (const year of [2024, 2025]) for (let month = 1; month <= 4; month++) {
        if (region === 'E' && year === 2025 && month === 2) continue;
        rows.push({ region, year, month, value: month });
    }
    const spec: WorksheetSpec = { ...base, rows: nest(field('region'), field('sum')), columns: nest(field('year'), field('month')), mark: 'point' };
    const points = fullScene(await model(spec, rows)).items.filter(p => p.selection);
    const x = (region: string, month: number) => points.find(p => p.selection!.values.region === region && p.selection!.values.year === 2025 && p.selection!.values.month === month)!.x;
    assert.ok(near(x('E', 3), x('W', 3)), `March sits at ${x('E', 3)} for E and ${x('W', 3)} for W`);
    assert.ok(near(x('E', 3) - x('E', 1), x('W', 3) - x('W', 1)));
});
test('an explicit null breaks the line instead of joining its neighbours', async () => {
    const rows: Row[] = [1, 2, 3, 4].map(month => ({ month, value: month === 2 ? null : month }));
    const paths = fullScene(await model({ ...base, rows: field('sum'), columns: field('month'), mark: 'line' }, rows)).items.filter(p => p.kind === 'path');
    const segments = paths.map(p => p.path!).join(' ').split('L').length - 1;
    assert.equal(segments, 1, 'only March to April may be joined');
});
test('bars split by a color dimension stack by default', async () => {
    const rows: Row[] = [{ product: 'p', segment: 'a', value: 10 }, { product: 'p', segment: 'b', value: 20 }];
    const m = await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment' }, rows);
    const [first, second] = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.x - b.x);
    assert.ok(near(second.x, first.x + first.width!), `second bar starts at ${second.x}, first ends at ${first.x + first.width!}`);
    assert.ok(near(second.width!, first.width! * 2, 2));
});

// ---- layout model
const sales = fields(['region', 'category', 'sub', 'year', 'segment'], { sum: ['value', 'sum'], mean: ['value', 'mean'], max: ['value', 'max'] });
const nested: Row[] = [];
for (const region of ['East', 'West']) for (const [category, count] of [['Furniture', 4], ['Office Supplies', 9], ['Technology', 4]] as const)
    for (let i = 0; i < count; i++) for (const year of [2024, 2025]) nested.push({ region, category, sub: `${category[0]}${i}`, year, segment: i % 2 ? 'a' : 'b', value: 1000 * (i + 1) + year });
const twoMeasures: WorksheetSpec = { kind: 'worksheet', specVersion: 2, instances: sales, mark: 'bar',
    rows: nest(field('region'), field('category'), field('sub')), columns: nest(field('year'), concat(field('sum'), field('mean'))) };

test('A17: a group is as tall as its member count times the shared step', async () => {
    const m = await model({ ...base, rows: nest(field('category'), field('sub')), columns: field('sum'), mark: 'bar' }, unequal);
    assert.deepEqual(m.rows.groups.map(g => g.size), [4, 9, 4].map(n => n * metrics.bandHeight));
    assert.equal(new Set(m.rows.leaves.map(leaf => leaf.size)).size, 1);
});
test('value axes are drawn once per column of panes, never inside a pane', async () => {
    const m = await model(twoMeasures, nested);
    assert.equal(m.panes.length, 24);
    const scene = fullScene(m);
    assert.equal(scene.items.filter(p => p.layer === 'body' && p.kind === 'text').length, 0);
    const titles = scene.items.filter(p => p.layer === 'xAxis' && p.fontWeight === 600).map(p => p.text);
    assert.deepEqual(titles, ['SUM', 'MEAN', 'SUM', 'MEAN']);
});
test('ticks are multiples of 1, 2 or 5 times a power of ten', async () => {
    const m = await model(twoMeasures, nested);
    for (const leaf of m.columns.leaves) {
        const { ticks, domain } = leaf.scale!;
        assert.ok(ticks.length >= 2, `too few ticks for ${domain}`);
        const step = ticks[1] - ticks[0];
        const mantissa = Number((step / 10 ** Math.floor(Math.log10(step))).toPrecision(6));
        assert.ok([1, 2, 5].includes(mantissa), `step ${step}`);
        assert.ok(ticks.every(t => near(t / step, Math.round(t / step), 1e-6) && t >= domain[0] && t <= domain[1]));
    }
});
test('headers and axes stay in place while the body scrolls', async () => {
    const m = await model(twoMeasures, nested);
    const window = { width: 520, height: 300 };
    const at = (x: number, y: number) => buildScene(m, { x, y, ...window }).items;
    const layer = (items: ReturnType<typeof at>, name: string) => items.filter(p => p.layer === name);
    // Vertical scrolling leaves column headers and the bottom axis untouched; horizontal scrolling leaves row headers untouched.
    assert.deepEqual(layer(at(40, 0), 'columnHeader'), layer(at(40, 180), 'columnHeader'));
    assert.deepEqual(layer(at(40, 0), 'xAxis'), layer(at(40, 180), 'xAxis'));
    assert.deepEqual(layer(at(0, 180), 'rowHeader'), layer(at(160, 180), 'rowHeader'));
    const scrolled = at(160, 180);
    const { left, top, bottom } = m.frame;
    assert.ok(layer(scrolled, 'columnHeader').every(p => p.y < top));
    assert.ok(layer(scrolled, 'xAxis').every(p => p.y >= window.height - bottom));
    assert.ok(layer(scrolled, 'rowHeader').filter(p => p.kind === 'text').every(p => p.x < left && p.y > top && p.y < window.height - bottom));
    // East starts above the window after scrolling 180 px, yet its label is still shown.
    assert.ok(layer(scrolled, 'rowHeader').some(p => p.text === 'East'));
    assert.ok(layer(scrolled, 'body').filter(p => p.selection).length > 0);
});
test('field names label the header levels', async () => {
    const m = await model(twoMeasures, nested);
    const scene = fullScene(m);
    assert.deepEqual(scene.items.filter(p => p.layer === 'corner' && p.kind === 'text').map(p => p.text), ['region', 'category', 'sub']);
    assert.ok(scene.items.some(p => p.layer === 'columnHeader' && p.text === 'year'));
});
test('mixed concatenated branches get one total order with contiguous headers', async () => {
    const rows: Row[] = [];
    for (const region of ['E', 'W']) for (const category of ['A', 'B']) for (const segment of ['s1', 's2']) rows.push({ region, category, segment, year: 2024, value: 1 });
    const spec: WorksheetSpec = { kind: 'worksheet', specVersion: 2, instances: sales, mark: 'bar', columns: field('year'),
        rows: concat(nest(field('region'), field('category'), field('sum')), nest(field('region'), field('segment'), field('mean')), nest(field('region'), field('category'), field('max'))) };
    const m = await model(spec, rows);
    assert.deepEqual(m.rows.leaves.slice(0, 6).map(leaf => `${leaf.path.map(p => p.value).join('/')} ${leaf.branch.position!.id}`),
        ['E/A sum', 'E/A max', 'E/B sum', 'E/B max', 'E/s1 mean', 'E/s2 mean']);
    assert.equal(m.rows.levels[0].length, 2);
});
test('unstacked bars overlap from the zero line', async () => {
    const rows: Row[] = [{ product: 'p', segment: 'a', value: 10 }, { product: 'p', segment: 'b', value: 20 }];
    const m = await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment', stack: false }, rows);
    const [first, second] = fullScene(m).items.filter(p => p.selection);
    assert.ok(near(first.x, second.x) && near(first.y, second.y) && near(first.height!, second.height!));
});

// ---- selection and fit
test('a selection dims every other mark and survives scrolling and re-sorting', async () => {
    const m = await model(twoMeasures, nested);
    const all = fullScene(m).items.filter(p => p.selection);
    assert.equal(new Set(all.map(p => p.selection!.id)).size, all.length, 'mark ids are unique');
    const target = all.find(p => p.selection!.values.sub === 'O4' && p.selection!.values.region === 'West')!.selection!;
    const selected = new Set([target.id]);
    const scrolled = buildScene(m, { x: 0, y: 500, width: 700, height: 400 }, { selected }).items.filter(p => p.selection);
    const hit = scrolled.filter(p => p.opacity === undefined);
    assert.equal(hit.length, 1);
    assert.deepEqual(hit[0].selection!.values, target.values);
    assert.ok(scrolled.length > 1 && scrolled.every(p => p === hit[0] || p.opacity! < 1));
    const resorted = await model({ ...twoMeasures, sort: 'descending' }, nested);
    const again = buildScene(resorted, { x: 0, y: 0, width: resorted.width, height: resorted.height }, { selected }).items.filter(p => p.selection && p.opacity === undefined);
    assert.deepEqual(again.map(p => p.selection!.values), [target.values]);
    assert.ok(fullScene(m).items.every(p => p.opacity === undefined), 'nothing is dimmed without a selection');
});
test('a line stays opaque when one of its points is selected', async () => {
    const rows: Row[] = [];
    for (const segment of ['a', 'b']) for (let month = 1; month <= 3; month++) rows.push({ segment, month, value: month });
    const m = await model({ ...base, rows: field('sum'), columns: field('month'), mark: 'line', color: 'segment' }, rows);
    const id = fullScene(m).items.find(p => p.selection?.values.segment === 'a')!.selection!.id;
    const paths = buildScene(m, { x: 0, y: 0, width: m.width, height: m.height }, { selected: new Set([id]) }).items.filter(p => p.kind === 'path');
    assert.deepEqual(paths.map(p => p.opacity === undefined), [true, false]);
});
test('fit scales the steps to the target and keeps one step per axis', async () => {
    const plan = compileWorksheet({ ...twoMeasures, fit: 'both' });
    const results = await executePlan(plan, reference(nested));
    for (const target of [{ width: 1300, height: 900 }, { width: 640, height: 260 }]) {
        const m = buildModel(plan, results, target);
        assert.ok(near(m.width, target.width, .5) && near(m.height, target.height, .5), `${m.width}×${m.height} for ${target.width}×${target.height}`);
        assert.ok(m.rows.leaves.every(leaf => near(leaf.size, m.rows.leaves[0].size, 1e-6)));
        assert.ok(m.columns.leaves.every(leaf => near(leaf.size, m.columns.leaves[0].size, 1e-6)));
        const last = m.rows.leaves[m.rows.leaves.length - 1];
        assert.ok(near(last.offset + last.size, m.rows.size, 1e-6));
    }
    const untouched = buildModel(compileWorksheet(twoMeasures), results, { width: 640, height: 260 });
    assert.equal(untouched.rows.leaves[0].size, metrics.bandHeight);
});
test('member labels thin out when the step is smaller than a line of text', async () => {
    const plan = compileWorksheet({ ...twoMeasures, fit: 'height' });
    const m = buildModel(plan, await executePlan(plan, reference(nested)), { width: 900, height: 300 });
    assert.ok(m.rows.leaves[0].size < 12);
    const scene = buildScene(m, { x: 0, y: 0, width: m.width, height: m.height });
    assert.equal(scene.items.filter(p => p.selection).length, 34 * 4, 'every mark is still drawn');
    const x = m.frame.rowHeaderWidths[0] + m.frame.rowHeaderWidths[1];
    const labels = scene.items.filter(p => p.layer === 'rowHeader' && p.kind === 'text' && p.x > x && !p.angle).map(p => p.y).sort((a, b) => a - b);
    assert.ok(labels.length > 0 && labels.length < 34);
    assert.ok(labels.slice(1).every((y, i) => y - labels[i] >= 11 || near(y - labels[i], 11)));
});

// ---- color, text cells, bottom headers, member order
const rgb = (color: string) => color.match(/\d+/g)!.map(Number);
test('a measure on color tints the marks on a continuous scale without splitting them', async () => {
    const spec: WorksheetSpec = { ...base, instances: sales, rows: nest(field('category'), field('sub')), columns: field('sum'), mark: 'bar', color: 'mean' };
    const rowsOf = (region: string) => nested.filter(r => r.region === region && r.year === 2024);
    const m = await model(spec, rowsOf('East'));
    assert.equal(m.plan.tasks.length, 1);
    assert.deepEqual(m.plan.tasks[0].groupBy, ['category', 'sub']);
    assert.equal(m.colorScale!.diverging, false);
    const scene = fullScene(m);
    const bars = scene.items.filter(p => p.selection);
    assert.equal(bars.length, 17, 'one bar per member');
    const byValue = [...bars].sort((a, b) => a.selection!.values.__ws_mean - b.selection!.values.__ws_mean);
    assert.deepEqual(m.colorScale!.domain, [byValue[0].selection!.values.__ws_mean, byValue[16].selection!.values.__ws_mean]);
    const blue = byValue.map(b => rgb(b.fill!)[0]);
    assert.ok(blue.every((v, i) => i === 0 || v <= blue[i - 1]) && blue[0] > blue[16], 'larger values are darker');
    const legend = scene.items.filter(p => p.layer === 'legend');
    assert.ok(legend.filter(p => p.kind === 'rect' && p.height === 10).length >= 40, 'gradient');
    assert.deepEqual(legend.filter(p => p.kind === 'text').map(p => p.text), ['MEAN', '3K', '11K']);
});
test('a color range that crosses zero diverges around it', async () => {
    const rows: Row[] = [-40, -5, 0, 5, 80].map((value, i) => ({ product: `p${i}`, value }));
    const m = await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'sum' }, rows);
    assert.equal(m.colorScale!.diverging, true);
    const fills = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.selection!.values.__ws_sum - b.selection!.values.__ws_sum).map(p => rgb(p.fill!));
    assert.ok(fills[0][0] > fills[0][2], 'negative is warm');
    assert.ok(fills[4][2] > fills[4][0], 'positive is cool');
    assert.ok(Math.abs(fills[2][0] - fills[2][2]) < 8, 'zero is neutral');
    assert.ok(fills[0][0] - fills[0][2] < fills[4][2] - fills[4][0], '-40 is weaker than +80');
});
test('the legend is part of the sheet and lists each color member once', async () => {
    const m = await model({ ...twoMeasures, color: 'segment' }, nested);
    assert.ok(m.frame.right > 0);
    assert.ok(near(m.width, m.frame.left + m.columns.size + m.frame.right));
    const scene = buildScene(m, { x: 0, y: 200, width: 600, height: 300 });
    const legend = scene.items.filter(p => p.layer === 'legend');
    assert.deepEqual(legend.filter(p => p.kind === 'text').map(p => p.text), ['segment', 'a', 'b']);
    assert.ok(legend.every(p => p.x >= 600 - m.frame.right), 'pinned to the window edge while the body scrolls');
    assert.ok(scene.items.filter(p => p.layer === 'body' && p.selection).every(p => p.x < 600 - m.frame.right));
    assert.equal((await model(twoMeasures, nested)).frame.right, 0);
});
test('text marks fill a crosstab with full numbers', async () => {
    const m = await model({ ...base, instances: sales, rows: nest(field('category'), field('sub')), columns: field('year'), mark: 'text', text: 'sum' }, nested);
    assert.equal(m.columns.leaves[0].size, metrics.textCellWidth);
    const cells = fullScene(m).items.filter(p => p.layer === 'body' && p.kind === 'text');
    assert.equal(cells.length, 17 * 2);
    const first = cells.find(p => p.selection!.values.sub === 'F0' && p.selection!.values.year === 2024)!;
    assert.equal(first.text, '6,048');
    assert.ok(near(first.x, m.frame.left + m.columns.leaves[0].size / 2) && first.align === 'center');
});
test('with a value axis on the rows, the innermost column members are named under the body', async () => {
    const spec: WorksheetSpec = { ...base, columns: nest(field('category'), field('sub')), rows: field('sum'), mark: 'bar' };
    const m = await model(spec, unequal);
    assert.ok(m.frame.bottomHeaderHeight > 0 && m.frame.bottom === m.frame.bottomHeaderHeight);
    const scene = fullScene(m);
    const axisY = m.frame.top + m.rows.size;
    const members = scene.items.filter(p => p.kind === 'text' && /^[FOT]\d$/.test(p.text!));
    assert.equal(members.length, 17);
    assert.ok(members.every(p => p.layer === 'xAxis' && p.y >= axisY));
    assert.ok(scene.items.some(p => p.layer === 'columnHeader' && p.text === 'Furniture'), 'outer levels stay on top');
    const onTop = fullScene(await model({ ...spec, innerColumnHeader: 'top' }, unequal));
    assert.ok(onTop.items.filter(p => /^[FOT]\d$/.test(p.text ?? '')).every(p => p.layer === 'columnHeader'));
    const horizontal = await model({ ...base, rows: nest(field('category'), field('sub')), columns: field('sum'), mark: 'bar' }, unequal);
    assert.equal(horizontal.frame.bottomHeaderHeight, 0);
});
test('member order can be set per field, by direction or by an explicit list', async () => {
    const spec: WorksheetSpec = { ...base, rows: nest(field('category'), field('sub')), columns: field('sum'), mark: 'bar' };
    const names = async (order: WorksheetSpec['order'], sort?: WorksheetSpec['sort']) => (await model({ ...spec, order, sort }, unequal)).rows.leaves.map(leaf => leaf.path[1].value);
    assert.deepEqual((await names({ category: 'descending' })).slice(0, 5), ['T0', 'T1', 'T2', 'T3', 'O0']);
    assert.deepEqual((await names({ sub: ['O7', 'O2'] })).slice(4, 8), ['O7', 'O2', 'O0', 'O1']);
    assert.deepEqual((await names({ sub: 'ascending' }, 'descending')).slice(0, 2), ['T0', 'T1'], 'a field without its own order follows sort');
});
