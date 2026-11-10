import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet, executePlan } from '../src/compiler';
import { resolveFormats, type Formats } from '../src/formats';
import { buildModel } from '../src/model';
import { buildScene } from '../src/scene';
import { fieldTime } from '../src/time';
import { field, type Row, type WorksheetSpec } from '../src/types';
import { fields, reference } from './helpers';

const instances = { ...fields(['product', 'segment'], { sum: ['value', 'sum'] }),
    when: { id: 'when', field: 'when', label: 'When', display: 'continuous' as const, scale: 'time' as const },
    day: { id: 'day', field: 'when', label: 'Day', display: 'discrete' as const, scale: 'time' as const } };
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };
async function scene(spec: WorksheetSpec, rows: Row[], formats?: Formats) {
    const plan = compileWorksheet(spec);
    const m = buildModel(plan, await executePlan(plan, reference(rows)), undefined, formats);
    return { m, items: buildScene(m, { x: 0, y: 0, width: m.width, height: m.height }).items };
}
const sales: Row[] = [{ product: 'a', segment: 's', value: 1234.5 }, { product: 'a', segment: 't', value: 8765.5 }, { product: 'b', segment: 's', value: 2500 }];
const money: Formats = { number: value => 'USD ' + value.toFixed(1), share: value => (value * 100).toFixed(1) + ' pct' };

test('a number format reaches axis ticks, tooltips, labels, cells and legends alike', async () => {
    const bars = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', text: 'sum', color: 'sum' }, sales, money);
    const ticks = bars.items.filter(p => p.layer === 'xAxis' && p.fontSize === 10 && !p.fontWeight).map(p => p.text);
    assert.ok(ticks.length > 2 && ticks.every(t => /^USD \d+\.0$/.test(t!)), 'ticks are ' + ticks);
    assert.match(bars.items.find(p => p.selection?.values.product === 'a')!.tooltip!, /SUM: USD 10000\.0/);
    assert.deepEqual(bars.items.filter(p => p.layer === 'body' && p.kind === 'text').map(p => p.text).sort(), ['USD 10000.0', 'USD 2500.0']);
    assert.deepEqual(bars.items.filter(p => p.layer === 'legend' && p.fontSize === 10).map(p => p.text), ['USD 2500.0', 'USD 10000.0']);
    // The axis is as wide as its labels need.
    const upright: WorksheetSpec = { ...base, columns: field('product'), rows: field('sum'), mark: 'bar' };
    const wide = await scene(upright, sales, { number: value => value + ' units of something' });
    const plain = await scene(upright, sales);
    assert.ok(wide.m.frame.yAxisWidth > plain.m.frame.yAxisWidth + 60);
    // Long labels along the bottom get fewer ticks instead of running into each other.
    const long = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar' }, sales, { number: value => value.toFixed(2) + ' dollars' });
    const bottom = long.items.filter(p => p.layer === 'xAxis' && p.fontSize === 10 && !p.fontWeight).sort((x, y) => x.x - y.x);
    const short = (await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar' }, sales)).items.filter(p => p.layer === 'xAxis' && p.fontSize === 10 && !p.fontWeight);
    assert.ok(bottom.length >= 2 && bottom.length < short.length, bottom.length + ' ticks against ' + short.length);
    const leaf = long.m.columns.leaves[0];
    const spacing = (leaf.scale!.ticks[1] - leaf.scale!.ticks[0]) / (leaf.scale!.domain[1] - leaf.scale!.domain[0]) * (leaf.size - 14);
    assert.ok(bottom.every(p => p.text!.length * 10 * 0.58 + 10 <= spacing), 'every label fits between two ticks');
    // In a slot too narrow for even two labels, the ones that would collide are blank and their ticks stay.
    const narrow = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', pane: { width: 80 } }, sales, { number: value => value.toFixed(2) + ' dollars' });
    const squeezed = narrow.m.columns.leaves[0].scale!;
    assert.ok(squeezed.ticks.length >= 2 && squeezed.labels!.filter(Boolean).length === 1, 'labels are ' + JSON.stringify(squeezed.labels));
    const cells = await scene({ ...base, rows: field('product'), columns: field('segment'), mark: 'text', text: 'sum' }, sales, money);
    assert.deepEqual(cells.items.filter(p => p.layer === 'body' && p.kind === 'text').map(p => p.text).sort(), ['USD 1234.5', 'USD 2500.0', 'USD 8765.5']);
});
test('without a number format ticks are abbreviated and values written in full; a tick format alone changes only ticks', async () => {
    const spec: WorksheetSpec = { ...base, rows: field('product'), columns: field('sum'), mark: 'bar' };
    const plain = await scene(spec, sales);
    assert.ok(plain.items.some(p => p.layer === 'xAxis' && p.text === '10K'));
    assert.match(plain.items.find(p => p.selection?.values.product === 'a')!.tooltip!, /SUM: 10,000$/);
    const ticked = await scene(spec, sales, { tick: value => value / 1000 + 'k' });
    assert.ok(ticked.items.some(p => p.layer === 'xAxis' && p.text === '10k'));
    assert.match(ticked.items.find(p => p.selection?.values.product === 'a')!.tooltip!, /SUM: 10,000$/);
});
test('a share format reaches the axis and tooltips of a normalized stack and the slices of a pie', async () => {
    const stack = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment', stack: 'normalize' }, sales, money);
    assert.ok(stack.items.some(p => p.layer === 'xAxis' && p.text === '100.0 pct'));
    assert.match(stack.items.find(p => p.selection?.values.product === 'b')!.tooltip!, /Share: 100\.0 pct$/);
    const pie = await scene({ ...base, rows: { kind: 'empty' }, columns: { kind: 'empty' }, mark: 'arc', color: 'product', angle: 'sum' }, sales, money);
    assert.match(pie.items.find(p => p.kind === 'shape' && p.selection?.values.product === 'b')!.tooltip!, /Share: 20\.0 pct$/);
});
const dated: Row[] = [{ when: '2024-01-15', product: 'a', value: 1 }, { when: '2024-03-15', product: 'a', value: 2 }];
test('a time format reaches tooltips, labels and unit-less members, and leaves the ticks of a time axis alone', async () => {
    const slashed: Formats = { time: ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '/') };
    const line = await scene({ ...base, rows: field('sum'), columns: field('when'), mark: 'line' }, dated, slashed);
    assert.match(line.items.find(p => p.selection)!.tooltip!, /When: 2024\/01\/15/);
    assert.ok(line.items.filter(p => p.layer === 'xAxis' && p.fontSize === 10 && !p.fontWeight).every(p => !p.text!.includes('/')));
    const byDay: WorksheetSpec = { ...base, rows: field('day'), columns: field('sum'), mark: 'bar' };
    const headers = await scene(byDay, dated, slashed);
    assert.deepEqual(headers.items.filter(p => p.layer === 'rowHeader' && p.tooltip?.startsWith('Day')).map(p => p.text), ['2024/01/15', '2024/03/15']);
    const standard = await scene(byDay, dated);
    assert.deepEqual(standard.items.filter(p => p.layer === 'rowHeader' && p.tooltip?.startsWith('Day')).map(p => p.text), ['Jan 15, 2024', 'Mar 15, 2024']);
});
test('a locale changes the default numbers and dates, and words can be replaced one by one', async () => {
    const zh: Formats = { locale: 'zh-CN', words: { share: '占比', missing: '（空）', more: count => '另有 ' + count + ' 项' } };
    const line = await scene({ ...base, rows: field('sum'), columns: field('when'), mark: 'line' }, [{ when: '2024-01-15', value: 12000 }, { when: '2024-03-15', value: 34000 }], zh);
    assert.match(line.items.find(p => p.selection)!.tooltip!, /When: 2024年1月15日/);
    assert.ok(line.items.some(p => p.layer === 'xAxis' && /^\d+月/.test(p.text ?? '')), 'month ticks are written in Chinese');
    assert.ok(line.items.some(p => p.layer === 'rowHeader' && /万$/.test(p.text ?? '')), 'ticks are abbreviated the Chinese way');
    const stack = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar', color: 'segment', stack: 'normalize' }, [...sales, { product: null, segment: 's', value: 1 }], zh);
    assert.match(stack.items.find(p => p.selection?.values.product === 'b')!.tooltip!, /占比: 100%$/);
    assert.ok(stack.items.some(p => p.layer === 'rowHeader' && p.text === '（空）'));
    // A word that was not replaced stays English, and an unknown locale does not fail the sheet.
    assert.equal(resolveFormats(zh).words.median, 'Median');
    assert.equal(resolveFormats({ locale: 'not a locale' }).number(1234.5), '1,234.5');
    // A host's formatter that throws falls back to the standard one.
    assert.equal(resolveFormats({ number: () => { throw new Error('bad'); } }).number(1234.5), '1,234.5');
});
test('bins are written with the number format, and stored times shift by their kind', async () => {
    const binned = await scene({ ...base, rows: field('product'), columns: field('sum'), mark: 'bar' }, [{ product: [0, 2.5], value: 1 }], money);
    assert.ok(binned.items.some(p => p.layer === 'rowHeader' && p.text === 'USD 0.0 – USD 2.5'));
    const f = { id: 't', field: 't', label: 't', display: 'continuous' as const, scale: 'time' as const, timeOffset: { epoch: 1000, date: 2000, dateTime: 3000 } };
    assert.equal(fieldTime(f, 0), 1000);
    assert.equal(fieldTime(f, new Date(0)), 1000);
    assert.equal(fieldTime(f, '2024-01-15') - Date.parse('2024-01-15'), 2000);
    assert.equal(fieldTime(f, '2024') - Date.parse('2024'), 2000);
    assert.equal(fieldTime(f, '2024-01-15T10:00:00') - Date.parse('2024-01-15T10:00:00'), 3000);
    assert.equal(fieldTime({ ...f, timeOffset: 500 }, '2024-01-15') - Date.parse('2024-01-15'), 500);
});
