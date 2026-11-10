import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileWorksheet } from '../src/compiler';
import { timeScale, timeValue } from '../src/time';
import { field, nest, type Row, type WorksheetSpec } from '../src/types';
import { fields, fullScene, model, near } from './helpers';

const utc = (iso: string) => Date.parse(iso);
const day = 86_400_000;
const instances: WorksheetSpec['instances'] = {
    ...fields(['region', 'segment'], { sum: ['value', 'sum'] }),
    date: { id: 'date', field: 'date', label: 'Date', display: 'continuous', scale: 'time' },
};
const base = { kind: 'worksheet' as const, specVersion: 2 as const, instances };

test('time ticks fall on calendar boundaries and name the year where it changes', () => {
    const months = timeScale(utc('2024-02-10'), utc('2025-11-20'), 400, 62);
    assert.deepEqual(months.domain, [utc('2024-02-10'), utc('2025-11-20')]);
    assert.deepEqual(months.ticks, ['2024-04-01', '2024-07-01', '2024-10-01', '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].map(utc));
    assert.deepEqual(months.labels, ['Apr 2024', 'Jul', 'Oct', '2025', 'Apr', 'Jul', 'Oct']);
    const days = timeScale(utc('2024-03-01T08:00:00Z'), utc('2024-03-09T20:00:00Z'), 400, 62);
    assert.deepEqual(days.labels, ['Mar 2', 'Mar 4', 'Mar 6', 'Mar 8']);
    assert.ok(days.ticks.every(t => t % day === 0));
    const weeks = timeScale(utc('2024-03-01'), utc('2024-04-10'), 400, 62);
    assert.ok(weeks.ticks.every(t => new Date(t).getUTCDay() === 1), 'weeks start on Monday');
    const hours = timeScale(utc('2024-03-01T22:00:00Z'), utc('2024-03-02T09:00:00Z'), 400, 62);
    assert.deepEqual(hours.labels, ['Mar 2', '03:00', '06:00', '09:00']);
    const years = timeScale(utc('1991-06-01'), utc('2024-06-01'), 300, 62);
    assert.deepEqual(years.labels, ['2000', '2010', '2020']);
    assert.equal(timeScale(utc('2024-03-01'), utc('2024-03-01'), 200, 62).domain[1] - utc('2024-03-01'), day / 2);
});
test('dates given as ISO strings, Date objects or milliseconds land on the same positions', async () => {
    const isoDates = ['2024-01-01', '2024-01-02', '2024-01-10'];
    const spec: WorksheetSpec = { ...base, rows: field('sum'), columns: field('date'), mark: 'line' };
    const xs = async (convert: (iso: string) => unknown) => {
        const m = await model(spec, isoDates.map((iso, i) => ({ date: convert(iso), value: i + 1 })));
        assert.deepEqual(m.columns.leaves[0].scale!.domain, [utc('2024-01-01'), utc('2024-01-10')], 'a date axis does not start at zero');
        return fullScene(m).items.filter(p => p.selection).map(p => p.x).sort((a, b) => a - b);
    };
    const fromStrings = await xs(iso => iso);
    assert.ok(near((fromStrings[2] - fromStrings[1]) / (fromStrings[1] - fromStrings[0]), 8, .05), 'spacing follows elapsed time');
    assert.deepEqual(await xs(iso => new Date(iso)), fromStrings);
    assert.deepEqual(await xs(iso => utc(iso)), fromStrings);
    assert.ok(Number.isNaN(timeValue('not a date')) && Number.isNaN(timeValue(null)));
    await assert.rejects(model(spec, [{ date: 'soon', value: 1 }]), /not a date: soon/);
});
test('a time axis is labelled with dates on the table edge and in tooltips', async () => {
    const rows: Row[] = [];
    for (const region of ['E', 'W']) for (let month = 0; month < 12; month++) rows.push({ region, date: new Date(Date.UTC(2024, month, 1)).toISOString(), value: month });
    const m = await model({ ...base, rows: nest(field('region'), field('sum')), columns: field('date'), mark: 'line', pane: { width: 420 } }, rows);
    const scene = fullScene(m);
    const ticks = scene.items.filter(p => p.layer === 'xAxis' && p.kind === 'text' && p.fontWeight !== 600).map(p => p.text);
    assert.deepEqual(ticks, ['2024', 'Mar', 'May', 'Jul', 'Sep', 'Nov']);
    assert.equal(scene.items.filter(p => p.kind === 'path').length, 2);
    assert.ok(scene.items.find(p => p.selection)!.tooltip!.includes('Date: Jan 1, 2024'));
});
test('bars along a date axis keep one width, stack per date and are not cut at the ends', async () => {
    const rows: Row[] = [];
    for (const region of ['E', 'W']) for (let month = 0; month < 6; month++) for (const segment of ['a', 'b']) {
        if (region === 'W' && month % 2) continue;
        rows.push({ region, segment, date: new Date(Date.UTC(2024, month, 1)).toISOString(), value: 10 + month });
    }
    const spec: WorksheetSpec = { ...base, rows: nest(field('region'), field('sum')), columns: field('date'), mark: 'bar', color: 'segment', pane: { width: 360 } };
    const m = await model(spec, rows);
    const leaf = m.columns.leaves[0];
    assert.equal(leaf.scale!.step, 29 * day, 'February is the shortest gap');
    assert.deepEqual(leaf.scale!.domain, [utc('2024-01-01') - 14.5 * day, utc('2024-06-01') + 14.5 * day]);
    const bars = fullScene(m).items.filter(p => p.selection);
    assert.equal(bars.length, 18);
    assert.ok(bars.every(b => near(b.width!, bars[0].width!, 1e-6)), 'W has half the dates but the same bar width');
    const bodyLeft = m.frame.left, bodyRight = m.frame.left + m.columns.size;
    assert.ok(bars.every(b => b.x >= bodyLeft && b.x + b.width! <= bodyRight));
    const january = bars.filter(b => b.selection!.values.region === 'E' && b.selection!.values.date.startsWith('2024-01')).sort((a, b) => b.y - a.y);
    assert.ok(near(january[0].x, january[1].x) && near(january[1].y + january[1].height!, january[0].y), 'segments stack at one date');
    const march = bars.find(b => b.selection!.values.region === 'E' && b.selection!.values.date.startsWith('2024-03'))!;
    assert.ok(march.x > january[0].x + january[0].width!, 'neighbouring dates do not touch');
});
test('bars need exactly one measure axis', () => {
    const two = { ...base, instances: { ...instances, ...fields([], { mean: ['value', 'mean'] }) } };
    assert.throws(() => compileWorksheet({ ...two, rows: field('sum'), columns: field('mean'), mark: 'bar' }), /one measure axis/);
    assert.throws(() => compileWorksheet({ ...base, rows: field('region'), columns: field('segment'), mark: 'bar' }), /one measure axis/);
    assert.doesNotThrow(() => compileWorksheet({ ...base, rows: field('sum'), columns: field('date'), mark: 'bar' }));
});

test('members of a discrete time field are named after their period, in the zone the offset selects', async () => {
    const { formatPeriod, memberLabel } = await import('../src/time');
    const t = Date.UTC(2024, 6, 15, 13, 5, 9);
    assert.deepEqual((['year', 'quarter', 'month', 'day', 'hour', 'second'] as const).map(unit => formatPeriod(t, unit)),
        ['2024', '2024 Q3', '2024-07', '2024-07-15', '2024-07-15 13:05', '2024-07-15 13:05:09']);
    // 30 December 2024 is a Monday and already belongs to the first ISO week of 2025.
    assert.deepEqual([formatPeriod(Date.UTC(2024, 11, 30), 'iso_week'), formatPeriod(Date.UTC(2024, 11, 30), 'iso_year'), formatPeriod(Date.UTC(2021, 0, 3), 'iso_week')], ['2025 W01', '2025', '2020 W53']);
    // The start of 2024 in a zone eight hours behind UTC, as a host in that zone stores it.
    const year = { id: 'y', field: 'y', label: 'Year', display: 'discrete' as const, scale: 'time' as const, timeUnit: 'year' as const, timeOffset: -8 * 3600_000 };
    assert.equal(memberLabel(year, Date.UTC(2024, 0, 1, 8)), '2024');
    assert.equal(memberLabel({ ...year, timeOffset: undefined }, Date.UTC(2023, 11, 31, 23)), '2023');
    assert.equal(memberLabel(year, null), '(null)');
    const rows = [{ y: Date.UTC(2025, 0, 1, 8), value: 2 }, { y: Date.UTC(2024, 0, 1, 8), value: 1 }];
    const instances = { y: year, sum: { id: 'sum', field: 'value', label: 'SUM', display: 'continuous' as const, aggregate: 'sum' as const } };
    const m = await model({ kind: 'worksheet', specVersion: 2, instances, rows: field('y'), columns: field('sum'), mark: 'bar' }, rows);
    const scene = fullScene(m);
    assert.deepEqual(scene.items.filter(p => p.layer === 'rowHeader' && p.tooltip?.startsWith('Year')).map(p => p.text), ['2024', '2025']);
    assert.deepEqual(scene.items.filter(p => p.selection).sort((a, b) => a.y - b.y).map(p => p.tooltip), ['Year: 2024\nSUM: 1', 'Year: 2025\nSUM: 2']);
});
