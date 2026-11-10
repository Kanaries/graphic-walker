import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet } from '../src/compiler';
import { opacityAt, pointArea, thicknessShare } from '../src/channels';
import { metrics } from '../src/layout';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model, near } from './helpers';

const instances = { ...fields(['product', 'segment', 'region'], { sum: ['value', 'sum'], qty: ['qty', 'sum'], mean: ['value', 'mean'] }) };
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
const rows: Row[] = [{ product: 'a', segment: 's', region: 'E', value: 10, qty: 0 }, { product: 'b', segment: 't', region: 'E', value: 20, qty: 50 }, { product: 'c', segment: 'u', region: 'W', value: 40, qty: 100 }];
const marks = (m: Awaited<ReturnType<typeof model>>) => fullScene(m).items.filter(p => p.selection).sort((a, b) => String(a.selection!.values.product).localeCompare(String(b.selection!.values.product)));
const scatter: WorksheetSpec = { ...base, rows: field('sum'), columns: field('product'), mark: 'circle' };

test('a measure on size sizes marks from zero, and joins the query without splitting marks', async () => {
    const m = await model({ ...scatter, size: 'qty' }, rows);
    assert.equal(m.plan.tasks.length, 1);
    assert.deepEqual(m.plan.tasks[0].measures.map(f => f.id), ['sum', 'qty']);
    assert.deepEqual(m.channels.size!.domain, [0, 100]);
    assert.deepEqual(marks(m).map(p => p.size), [pointArea(0), pointArea(.5), pointArea(1)]);
    // Bars get thinner, ticks shorter, text smaller, heat cells smaller; none of them moves.
    const barModel = await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', size: 'qty' }, rows);
    const bars = marks(barModel);
    const full = metrics.bandHeight * metrics.barFill;
    assert.ok(near(bars[0].height!, full * thicknessShare(0), .01) && near(bars[2].height!, full, .01));
    bars.forEach((bar, i) => assert.ok(near(bar.y + bar.height! / 2, barModel.frame.top + metrics.bandHeight * (i + .5), .01), 'a thinner bar stays centered on its member'));
    const cells = marks(await model({ ...base, rows: field('product'), columns: field('segment'), mark: 'rect', color: 'sum', size: 'qty' }, rows));
    assert.ok(cells[0].width! < cells[1].width! && cells[1].width! < cells[2].width!);
    const texts = marks(await model({ ...base, rows: field('product'), columns: field('segment'), mark: 'text', text: 'sum', size: 'qty' }, rows));
    assert.deepEqual(texts.map(p => p.fontSize), [9, 17, 24]);
});
test('a dimension on size or opacity gives each member a step and splits the marks', async () => {
    const m = await model({ ...base, rows: field('sum'), columns: field('region'), mark: 'circle', size: 'segment', opacity: 'segment' }, rows);
    assert.deepEqual(m.plan.tasks[0].groupBy, ['region', 'segment']);
    const drawn = marks(m);
    assert.equal(drawn.length, 3);
    assert.deepEqual(drawn.map(p => p.size), [1 / 3, 2 / 3, 1].map(pointArea));
    assert.ok(drawn.every((p, i) => near(p.opacity ?? 1, opacityAt((i + 1) / 3), 1e-9)), 'the last member is fully opaque');
});
test('a measure on opacity runs from faint to solid over its own range', async () => {
    const drawn = marks(await model({ ...scatter, opacity: 'sum' }, rows));
    assert.deepEqual(drawn.map(p => p.opacity), [opacityAt(0), opacityAt(1 / 3), undefined]);
});
test('shape gives each member of a dimension its own symbol on points and circles', async () => {
    const m = await model({ ...scatter, mark: 'point', shape: 'segment' }, rows);
    assert.deepEqual(marks(m).map(p => p.symbol), ['circle', 'square', 'triangle-up']);
    assert.ok(marks(m).every(p => p.fill === 'transparent' && p.stroke));
    assert.throws(() => compileWorksheet({ ...scatter, shape: 'sum' }), /Shape takes a dimension/);
});
test('each channel gets its own block in the legend strip', async () => {
    const m = await model({ ...scatter, color: 'region', size: 'qty', opacity: 'segment', shape: 'segment' }, rows);
    assert.deepEqual(m.legends.map(b => [b.channel, b.title, b.entries.map(e => e.label)]), [
        ['color', 'region', ['E', 'W']], ['size', 'QTY', ['0', '50', '100']], ['opacity', 'segment', ['s', 't', 'u']], ['shape', 'segment', ['s', 't', 'u']],
    ]);
    const legend = fullScene(m).items.filter(p => p.layer === 'legend');
    const titles = legend.filter(p => p.fontWeight === 600).map(p => [p.text, p.y]);
    assert.deepEqual(titles.map(t => t[0]), ['region', 'QTY', 'segment', 'segment']);
    assert.ok(titles.every((t, i) => i === 0 || (t[1] as number) > (titles[i - 1][1] as number)), 'blocks follow one another down the strip');
    assert.equal(legend.filter(p => p.kind === 'symbol' && p.symbol).length, 3);
    assert.ok(m.height >= m.legends.reduce((sum, block) => sum + block.height, 0), 'a short sheet still shows the whole legend');
    assert.equal(fullScene(await model(scatter, rows)).legend, 'none');
});
test('a line takes one width and one opacity from its member', async () => {
    const data: Row[] = ['s', 't'].flatMap(segment => [1, 2, 3].map(product => ({ product, segment, value: product })));
    const paths = fullScene(await model({ ...base, rows: field('sum'), columns: field('product'), mark: 'line', size: 'segment', opacity: 'segment' }, data)).items.filter(p => p.kind === 'path');
    assert.deepEqual(paths.map(p => p.strokeWidth), [1 + 5 * .5, 1 + 5]);
    assert.deepEqual(paths.map(p => p.opacity), [opacityAt(.5), undefined]);
});

// ---- labels
const labelled = (m: Awaited<ReturnType<typeof model>>) => fullScene(m).items.filter(p => p.layer === 'body' && p.kind === 'text');
test('a bar on its own is labelled past its end, or just inside the end when there is no room', async () => {
    const m = await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', text: 'sum' }, rows);
    const bars = marks(m), labels = labelled(m).sort((a, b) => a.y - b.y);
    assert.deepEqual(labels.map(p => p.text), ['10', '20', '40']);
    assert.ok(near(labels[0].x, bars[0].x + bars[0].width! + 4) && labels[0].align === 'left');
    // The longest bar ends at the edge of its slot, so its label moves inside and takes a color that reads on the bar.
    assert.ok(labels[2].align === 'right' && near(labels[2].x, bars[2].x + bars[2].width! - 4));
    assert.equal(labels[2].fill, '#ffffff');
    assert.ok(labels.every(p => !p.selection), 'labels do not take the pointer');
    assert.equal(bars[0].tooltip, 'product: a\nSUM: 10', 'the measure that is both the axis and the label is described once');
});
test('bars in a pile are labelled inside, and only where the label fits', async () => {
    const data: Row[] = [{ product: 'p', segment: 'a', value: 1 }, { product: 'p', segment: 'b', value: 500 }, { product: 'p', segment: 'c', value: 499 }];
    const labels = labelled(await model({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment', text: 'sum' }, data));
    assert.deepEqual(labels.map(p => p.text).sort(), ['499', '500']);
    assert.ok(labels.every(p => p.align === 'center'));
});
test('labels that would run into each other are left out, first come first kept', async () => {
    // Three points at almost the same place: one label has room on each side, the third has none.
    const data: Row[] = [{ product: 'a', value: 100 }, { product: 'b', value: 100.01 }, { product: 'c', value: 100.02 }, { product: 'd', value: 100.03 }, { product: 'e', value: 0 }];
    const spec: WorksheetSpec = { ...base, rows: field('sum'), columns: field('region'), mark: 'circle', detail: ['product'], text: 'product' };
    const labels = labelled(await model(spec, data.map(r => ({ ...r, region: 'E' }))));
    assert.ok(labels.length >= 2 && labels.length < 5, `${labels.length} labels`);
    const boxes = labels.map(p => { const w = 6; const x0 = p.align === 'left' ? p.x : p.align === 'right' ? p.x - w : p.x - w / 2; return [x0, p.y - 10, x0 + w, p.y + 2]; });
    for (let i = 0; i < boxes.length; i++) for (let j = 0; j < i; j++) {
        assert.ok(!(boxes[i][0] < boxes[j][2] && boxes[i][2] > boxes[j][0] && boxes[i][1] < boxes[j][3] && boxes[i][3] > boxes[j][1]), 'two labels overlap');
    }
});
test('slices, cells, lines and points carry labels; boxes and text marks do not gain a second one', async () => {
    const pie = labelled(await model({ ...base, rows: { kind: 'empty' }, columns: { kind: 'empty' }, mark: 'arc', color: 'product', angle: 'sum', text: 'sum' }, rows));
    assert.deepEqual(pie.map(p => p.text).sort(), ['10', '20', '40']);
    const heat = labelled(await model({ ...base, rows: field('product'), columns: field('segment'), mark: 'rect', color: 'sum', text: 'sum', band: { width: 60 } }, rows));
    assert.equal(heat.length, 3);
    const line = labelled(await model({ ...base, rows: field('sum'), columns: field('product'), mark: 'line', text: 'sum', band: { width: 60 } }, rows));
    assert.deepEqual(line.map(p => p.text), ['10', '20', '40']);
    const box = labelled(await model({ ...base, rows: field('mean'), columns: field('region'), mark: 'boxplot', detail: ['product'], text: 'mean' }, rows));
    assert.equal(box.length, 0);
    const text = fullScene(await model({ ...base, rows: field('product'), columns: field('segment'), mark: 'text', text: 'sum' }, rows)).items.filter(p => p.layer === 'body' && p.kind === 'text');
    assert.equal(text.length, 3);
});
