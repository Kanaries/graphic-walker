import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet } from '../src/compiler';
import { metrics } from '../src/layout';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model, near } from './helpers';

const instances = {
    ...fields(['region', 'category', 'segment', 'name'], { sum: ['value', 'sum'] }),
    value: { id: 'value', field: 'value', label: 'Value', display: 'continuous' as const, zero: false },
};
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };

// ---- point, circle, tick
const three: Row[] = [{ category: 'a', value: 1 }, { category: 'b', value: 2 }, { category: 'c', value: 3 }];
test('point is a hollow circle and circle a filled one', async () => {
    const marks = async (mark: WorksheetSpec['mark']) => fullScene(await model({ ...base, rows: field('sum'), columns: field('category'), mark }, three)).items.filter(p => p.selection);
    const points = await marks('point'), circles = await marks('circle');
    assert.equal(points.length, 3);
    assert.ok(points.every(p => p.kind === 'symbol' && p.fill === 'transparent' && p.stroke && p.strokeWidth), 'points are outlines');
    assert.ok(circles.every(p => p.kind === 'symbol' && p.fill !== 'transparent' && !p.stroke), 'circles are filled');
    assert.deepEqual(points.map(p => [p.x, p.y]), circles.map(p => [p.x, p.y]));
});
test('a tick is a thin line across its value axis', async () => {
    const upright = fullScene(await model({ ...base, rows: field('category'), columns: field('sum'), mark: 'tick' }, three)).items.filter(p => p.selection);
    assert.ok(upright.every(p => p.kind === 'rect' && p.width === 2 && near(p.height!, metrics.bandHeight * metrics.barFill)), 'ticks on a horizontal axis stand upright');
    const flat = fullScene(await model({ ...base, rows: field('sum'), columns: field('category'), mark: 'tick' }, three)).items.filter(p => p.selection);
    assert.ok(flat.every(p => p.kind === 'rect' && p.height === 2 && near(p.width!, metrics.bandWidth * metrics.barFill)), 'ticks on a vertical axis lie flat');
    assert.equal(new Set(flat.map(p => p.y)).size, 3, 'each tick sits at its own value');
});

// ---- arc
const shares: Row[] = [];
for (const region of ['East', 'West']) for (const category of ['x', 'y']) for (const [segment, value] of [['a', 1], ['b', 3]] as const) {
    if (region === 'West' && category === 'y' && segment === 'a') continue;
    shares.push({ region, category, segment, value: value * (region === 'East' ? 1 : 10) });
}
test('arc draws one pie per cell and a slice is its share of that cell', async () => {
    const m = await model({ ...base, rows: field('region'), columns: field('category'), mark: 'arc', color: 'segment', angle: 'sum' }, shares);
    assert.deepEqual([m.rows.leaves.length, m.columns.leaves.length], [2, 2]);
    assert.ok([...m.rows.leaves, ...m.columns.leaves].every(leaf => leaf.size === metrics.pieSize), 'every cell is one pie wide and high');
    const slices = fullScene(m).items.filter(p => p.kind === 'shape');
    assert.equal(slices.length, 7);
    const share = (region: string, category: string, segment: string) => {
        const mark = m.panes.flatMap(p => p.marks).find(k => k.record.region === region && k.record.category === category && k.record.segment === segment)!;
        return mark.end - mark.start;
    };
    // The same split in every cell although West is ten times larger: a pie shows shares, not sizes.
    assert.ok(near(share('East', 'x', 'a'), .25, 1e-9) && near(share('West', 'x', 'b'), .75, 1e-9));
    assert.ok(near(share('West', 'y', 'b'), 1, 1e-9), 'a lone slice is the whole disc');
    const centers = new Set(slices.map(p => `${p.x},${p.y}`));
    assert.equal(centers.size, 4, 'slices of one cell share a center');
    assert.ok(slices.every(p => p.path!.endsWith('Z') && p.selection && /Share: \d/.test(p.tooltip!)));
});
test('arc without an angle field gives every slice the same share, and takes no measure on an axis', async () => {
    const m = await model({ ...base, rows: { kind: 'empty' }, columns: { kind: 'empty' }, mark: 'arc', color: 'segment' }, shares);
    assert.deepEqual(m.panes[0].marks.map(k => k.end - k.start), [.5, .5]);
    assert.throws(() => compileWorksheet({ ...base, rows: field('sum'), columns: field('category'), mark: 'arc' }), /dimensions on rows and columns/);
});

// ---- box plot
const sample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 40];
const records: Row[] = [];
for (const region of ['East', 'West']) for (const category of ['x', 'y', 'z']) for (const segment of ['a', 'b']) {
    if (region === 'West' && category === 'z') continue;
    sample.forEach((value, i) => records.push({ region, category, segment, name: `n${i}`, value: value + (segment === 'b' ? 100 : 0) }));
}
const boxes: WorksheetSpec = { ...base, rows: field('value'), columns: nest(field('region'), field('category')), mark: 'boxplot' };
test('a box summarises every record of its member: quartiles, whiskers and outliers', async () => {
    const rows = sample.map(value => ({ category: 'x', value }));
    const m = await model({ ...base, rows: field('value'), columns: field('category'), mark: 'boxplot' }, [...rows, { category: 'x', value: 5 }, { category: 'x', value: 5 }]);
    const [box, ...outliers] = m.panes[0].marks;
    // 1..9, 40 and two more fives: equal rows count, they are not merged by the query.
    assert.equal(box.box!.count, 12);
    assert.deepEqual([box.box!.q1, box.box!.median, box.box!.q3], [3.75, 5, 7.25]);
    assert.deepEqual([box.box!.low, box.box!.high], [1, 9], 'whiskers end at the furthest records within 1.5 box lengths');
    assert.deepEqual(outliers.map(k => [k.outlier, k.start]), [[true, 40]]);
    const scene = fullScene(m);
    const leaf = m.rows.leaves[0];
    const y = (value: number) => m.frame.top + leaf.size - metrics.scalePadStart - (value - leaf.scale!.domain[0]) / (leaf.scale!.domain[1] - leaf.scale!.domain[0]) * (leaf.size - metrics.scalePadStart - metrics.scalePadEnd);
    const body = scene.items.filter(p => p.kind === 'rect' && p.selection).sort((a, b) => b.width! * b.height! - a.width! * a.height!)[0];
    assert.ok(near(body.y, y(7.25)) && near(body.y + body.height!, y(3.75)), 'the box spans the quartiles');
    assert.deepEqual(leaf.scale!.domain, [1, 40], 'the axis covers whiskers and outliers and does not start from zero');
    assert.equal(scene.items.filter(p => p.kind === 'symbol').length, 1);
    assert.match(body.tooltip!, /Median: 5\n/);
    assert.deepEqual(body.selection!.predicates, [{ field: 'category', value: 'x' }]);
});
test('boxes nest under every header level and keep one member step', async () => {
    const m = await model(boxes, records);
    assert.equal(m.columns.levels.length, 2);
    assert.deepEqual(m.columns.groups.map(g => g.size), [3, 2].map(n => n * metrics.bandWidth));
    assert.equal(m.panes.flatMap(p => p.marks).filter(k => k.box).length, 5);
    assert.equal(m.plan.tasks[0].payload.workflow.at(-1)!.type, 'view');
    assert.deepEqual((m.plan.tasks[0].payload.workflow.at(-1) as any).query[0], { op: 'raw', fields: ['category', 'region', 'value'] });
});
test('boxes of different colors stand side by side in the same order in every pane', async () => {
    const m = await model({ ...boxes, color: 'segment' }, records);
    const bodies = fullScene(m).items.filter(p => p.kind === 'rect' && p.selection && p.height! > 4 && p.width! > 4);
    assert.equal(bodies.length, 10);
    const leaf = (p: typeof bodies[number]) => m.columns.leaves.find(l => p.x >= m.frame.left + l.offset && p.x < m.frame.left + l.offset + l.size)!;
    for (const segment of ['a', 'b']) {
        const offsets = bodies.filter(p => p.selection!.values.segment === segment).map(p => p.x - m.frame.left - leaf(p).offset);
        assert.ok(offsets.every(o => near(o, offsets[0], .01)), `segment ${segment} sits at ${[...new Set(offsets)]}`);
    }
    assert.ok(bodies.every(p => near(p.width!, bodies[0].width!, .01)));
    // Coloring by the field that already heads the members does not halve the boxes.
    const same = fullScene(await model({ ...boxes, color: 'category' }, records)).items.filter(p => p.kind === 'rect' && p.selection && p.height! > 4 && p.width! > 4);
    assert.ok(same.every(p => near(p.width!, metrics.bandWidth * metrics.barFill, .01)));
});
test('detail sets the grain of an aggregated box plot without splitting the boxes', async () => {
    const m = await model({ ...base, rows: field('sum'), columns: field('category'), mark: 'boxplot', detail: ['name'] }, records.filter(r => r.region === 'East'));
    const marks = m.panes.flatMap(p => p.marks).filter(k => k.box);
    assert.equal(marks.length, 3);
    // One record per name: the sum over both segments.
    assert.equal(marks[0].box!.count, 10);
    assert.equal(marks[0].box!.median, 111);
});
test('a box plot needs exactly one measure axis and a dimension on color', () => {
    assert.throws(() => compileWorksheet({ ...base, rows: field('value'), columns: field('sum'), mark: 'boxplot' }), /exactly one measure axis/);
    assert.throws(() => compileWorksheet({ ...base, rows: field('category'), columns: field('region'), mark: 'boxplot' }), /exactly one measure axis/);
    assert.throws(() => compileWorksheet({ ...base, rows: field('value'), columns: field('category'), mark: 'boxplot', color: 'sum' }), /dimension on color/);
});

// ---- drawing backend
test('the backend paints slices as filled outlines and points as strokes', async () => {
    const { sceneToSVG } = await import('../src/vegaBackend');
    const pie = await sceneToSVG(fullScene(await model({ ...base, rows: field('region'), columns: field('category'), mark: 'arc', color: 'segment', angle: 'sum' }, shares)));
    assert.equal(pie.match(/<path[^>]*d="M0,0L[^"]*Z"[^>]*fill="#/g)?.length, 6, 'six slices that are not a whole disc');
    const points = await sceneToSVG(fullScene(await model({ ...base, rows: field('sum'), columns: field('category'), mark: 'point' }, three)));
    // An outline carries a stroke and no fill of its own.
    const outlines = points.match(/<path[^>]*stroke="#4263eb" stroke-width="1.5"[^>]*>/g) ?? [];
    assert.equal(outlines.length, 3);
    assert.ok(outlines.every(path => !/fill="#/.test(path)));
});
test('a box with a single record is still visible', async () => {
    const m = await model({ ...base, rows: field('value'), columns: field('category'), mark: 'boxplot' }, [{ category: 'x', value: 3 }, { category: 'y', value: 9 }]);
    const scene = fullScene(m);
    const drawn = scene.items.filter(p => p.kind === 'rect' && p.selection);
    assert.ok(drawn.length >= 2 && drawn.every(p => p.fill !== scene.background), 'nothing is painted in the surface color');
    assert.ok(drawn.some(p => p.height === 2 && near(p.width!, metrics.bandWidth * metrics.barFill, .01)));
});

// ---- theme colors
test('marks, legend and color scales take their colors from the theme', async () => {
    const { lightTheme } = await import('../src/color');
    const { buildScene } = await import('../src/scene');
    const theme = { ...lightTheme, mark: '#111111', category: ['#aa0000', '#00aa00'], ramp: ['#000000', '#808080', '#ffffff'], diverging: ['#ff0000', '#000000', '#0000ff'], heatmap: ['#000000', '#00ff00'] };
    const scene = (m: Awaited<ReturnType<typeof model>>) => buildScene(m, { x: 0, y: 0, width: m.width, height: m.height }, { theme });
    const marks = (m: Awaited<ReturnType<typeof model>>) => scene(m).items.filter(p => p.selection);
    const rows: Row[] = [{ category: 'a', segment: 's', value: 0 }, { category: 'b', segment: 't', value: 50 }, { category: 'c', segment: 'u', value: 100 }];
    const bars = { ...base, rows: field('category'), columns: field('sum'), mark: 'bar' as const };
    // No color field: the theme's mark color.
    assert.deepEqual([...new Set(marks(await model(bars, rows)).map(p => p.fill))], ['#111111']);
    // Members take the category colors in order and start over when they run out; the legend shows the same.
    const byMember = await model({ ...bars, color: 'segment' }, rows);
    assert.deepEqual(marks(byMember).sort((a, b) => a.y - b.y).map(p => p.fill), ['#aa0000', '#00aa00', '#aa0000']);
    assert.deepEqual(scene(byMember).items.filter(p => p.layer === 'legend' && p.width === 10).map(p => p.fill), ['#aa0000', '#00aa00', '#aa0000']);
    // A one-sided range runs along the ramp through every stop.
    const byValue = marks(await model({ ...bars, color: 'sum' }, rows)).sort((a, b) => a.y - b.y).map(p => p.fill);
    assert.deepEqual(byValue, ['rgb(0,0,0)', 'rgb(128,128,128)', 'rgb(255,255,255)']);
    // A range across zero runs along the diverging stops with zero on the middle one.
    const crossing = marks(await model({ ...bars, color: 'sum' }, [{ category: 'a', value: -100 }, { category: 'b', value: 0 }, { category: 'c', value: 100 }])).sort((a, b) => a.y - b.y).map(p => p.fill);
    assert.deepEqual(crossing, ['rgb(255,0,0)', 'rgb(0,0,0)', 'rgb(0,0,255)']);
    // Heat map cells use the heat map stops.
    const cells = marks(await model({ ...base, rows: field('category'), columns: field('segment'), mark: 'rect', color: 'sum' }, rows)).map(p => p.fill);
    assert.ok(cells.includes('rgb(0,255,0)') && !cells.includes('rgb(255,255,255)'), `cells are ${cells}`);
});

// ---- binned fields
test('a bin is a member: ordered by its lower bound and labelled with its range', async () => {
    const rows: Row[] = [{ category: [20, 30], value: 2 }, { category: [0, 10], value: 1 }, { category: [10, 20.5], value: 3 }, { category: [0, 10], value: 4 }];
    const m = await model({ ...base, rows: field('category'), columns: field('sum'), mark: 'bar' }, rows);
    assert.equal(m.rows.leaves.length, 3, 'equal bins are one member');
    const labels = fullScene(m).items.filter(p => p.layer === 'rowHeader' && p.kind === 'text' && p.tooltip?.startsWith('category')).map(p => p.text);
    assert.deepEqual(labels, ['0 – 10', '10 – 20.5', '20 – 30']);
    const first = fullScene(m).items.filter(p => p.selection).sort((a, b) => a.y - b.y)[0];
    assert.equal(first.selection!.values.__ws_sum, 5);
});
