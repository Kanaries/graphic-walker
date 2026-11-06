import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNativeScenario } from '../../graphic-walker/src/lib/native/scenarios';
import type { NativeWorksheetLayout } from '../../graphic-walker/src/lib/native/presentation';
import { createPreparedDataSource } from '../src/core/prepared';
import { domainRequestForWindow, getDisplayDomain } from '../src/core/domains';
import { buildScene } from '../src/scene/build';

async function renderFixture(name: Parameters<typeof createNativeScenario>[0]) {
    const fixture = createNativeScenario(name);
    const adapted = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns, ...fixture.presentation, records: fixture.records });
    assert.ok(adapted.plan, `${name}: ${JSON.stringify(adapted.diagnostics)}`);
    const plan = adapted.plan;
    const version = { sourceId: name, snapshotId: '1', presentationId: '1' };
    const source = createPreparedDataSource({ version, plan, records: fixture.records, getDatumKey: fixture.getDatumKey });
    const signal = new AbortController().signal;
    const manifest = await source.describe(signal);
    const window = { rows: { start: 0, end: manifest.rowLeafCount }, columns: { start: 0, end: manifest.columnLeafCount } };
    const [rows, columns, panes] = await Promise.all([
        source.readAxis({ version, axis: 'row', range: window.rows }, signal),
        source.readAxis({ version, axis: 'column', range: window.columns }, signal),
        source.readPaneData({ version, windows: [window] }, signal),
    ]);
    const domains = await source.readDomains(domainRequestForWindow(plan, version, rows.leaves, columns.leaves), signal);
    const frame = buildScene({ plan, rows, columns, panes, domains, width: 1400, height: 1400, scrollX: 0, scrollY: 0, frameId: 1 });
    return { fixture, plan, frame, rows, columns, panes, domains };
}

test('every existing-IChart scenario reaches an actual scene with prepared values intact', async () => {
    for (const name of ['nested', 'line', 'heatmap', 'text', 'grouped', 'stack', 'scatter', 'deep', 'scope', 'interval'] as const) {
        const { fixture, plan, frame, panes } = await renderFixture(name);
        assert.ok(frame.hits.length > 0, `${name} must produce visible hits`);
        assert.equal(plan.bindings.length, Object.values(fixture.chart.encodings).flat().filter((field) => 'fid' in field).length - fixture.chart.encodings.dimensions.length - fixture.chart.encodings.measures.length);
        for (const pane of panes.panes) for (const record of pane.records) assert.deepEqual(record.values, fixture.records.find((value) => value.__datumKey === record.datumKey));
        assert.equal(JSON.stringify(plan).includes('expression'), false);
    }
});

test('line progression, formatted cell text and prepared interval bounds survive the adapter', async () => {
    const line = await renderFixture('line');
    assert.equal(line.plan.lineProgression, 'x');
    assert.equal(line.plan.axes?.[line.plan.columns.positions[0]].format, '%b');
    assert.ok(line.frame.commands.some((command) => command.primitive.kind === 'text' && command.primitive.text === 'Jan'));
    const text = await renderFixture('text');
    assert.ok(text.frame.commands.some((command) => command.primitive.kind === 'text' && command.primitive.text === '7.3'));
    const interval = await renderFixture('interval');
    assert.equal(interval.plan.bindings.find((binding) => binding.columnKey === 'Range')?.valueType, 'interval');
    assert.ok(interval.frame.hits[1].box.width > interval.frame.hits[0].box.width, 'Supplied unequal interval widths must remain unequal');
});

test('grouped and scoped layouts map to complete display plans and unequal per-region domains', async () => {
    const grouped = await renderFixture('grouped');
    assert.equal(grouped.plan.barLayout, 'grouped');
    assert.equal(grouped.plan.stack, 'none');
    const stacked = await renderFixture('stack');
    assert.equal(stacked.plan.stack, 'zero');
    const scoped = await renderFixture('scope');
    const field = scoped.plan.rows.positions[0];
    assert.deepEqual(scoped.plan.scales?.[field].scope, { mode: 'prefix', rowDepth: 1, columnDepth: 0 });
    const first = getDisplayDomain(scoped.plan, field, 'y', scoped.domains, scoped.rows.leaves[0], scoped.columns.leaves[0]);
    const last = getDisplayDomain(scoped.plan, field, 'y', scoped.domains, scoped.rows.leaves.at(-1), scoped.columns.leaves[0]);
    assert.ok(first && last);
    assert.notDeepEqual(first.values, last.values);
});

test('theme, host scales and layout endpoints resolve in order without mutating input', () => {
    const fixture = createNativeScenario('scatter');
    fixture.chart.layout.scale = { row: { domainMin: -5, rangeMax: 220 } };
    fixture.chart.layout.format = { numberFormat: ',.2f' };
    const ext = Object.freeze({ domain: Object.freeze([-100, 500]), range: Object.freeze([15, 190]), zero: false });
    const input = { columns: fixture.columns, resolvedScales: { row: ext }, theme: { scales: { row: { domain: [-1000, 1000], range: [0, 100], nice: true } }, axes: { row: { title: 'Visits', grid: true, tickCount: 4 } } } };
    const result = adaptChartToRenderPlan(fixture.chart, input);
    assert.ok(result.plan, JSON.stringify(result.diagnostics));
    const ref = result.plan.rows.positions[0];
    assert.deepEqual(result.plan.scales?.[ref], { domain: [-100, 500], domainMin: -5, range: [15, 220], nice: true, zero: false, scope: { mode: 'shared' } });
    assert.deepEqual(result.plan.axes?.[ref], { title: 'Visits', grid: true, tickCount: 4, format: ',.2f' });
    assert.deepEqual(ext.range, [15, 190]);
});

test('scale callbacks receive complete result values once and windowed input requires static resolution', () => {
    const fixture = createNativeScenario('scatter');
    let calls = 0;
    const callback = ({ values }: { values: unknown[] }) => { calls++; assert.deepEqual(values, fixture.records.map((record) => record.Y)); return { domain: [0, 100] as [number, number] }; };
    const input = { columns: fixture.columns, records: fixture.records, scales: { row: callback } };
    assert.ok(adaptChartToRenderPlan(fixture.chart, input).plan);
    assert.ok(adaptChartToRenderPlan(fixture.chart, input).plan);
    assert.equal(calls, 1);
    const windowed = adaptChartToRenderPlan(fixture.chart, { ...input, sourceMode: 'windowed' });
    assert.equal(windowed.plan, undefined);
    assert.ok(windowed.diagnostics.some((diagnostic) => diagnostic.configRef === 'scales.row'));
    assert.equal(calls, 1);
    const resolved = adaptChartToRenderPlan(fixture.chart, { ...input, sourceMode: 'windowed', resolvedScales: { row: { domain: [0, 100] } } });
    assert.ok(resolved.plan);
    assert.equal(calls, 1);
});

test('resolve defaults, explicit prefix scopes and grouped conflicts preserve original chart', () => {
    const fixture = createNativeScenario('nested');
    fixture.chart.layout.resolve.x = true;
    const independent = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
    assert.ok(independent.plan);
    assert.deepEqual(independent.plan.scales?.[independent.plan.columns.positions[0]].scope, { mode: 'pane' });
    (fixture.chart.layout as typeof fixture.chart.layout & NativeWorksheetLayout).worksheet = { scaleScopes: { x: { mode: 'prefix', rowDepth: 1, columnDepth: 0 } } };
    const prefix = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
    assert.ok(prefix.plan);
    assert.deepEqual(prefix.plan.scales?.[prefix.plan.columns.positions[0]].scope, { mode: 'prefix', rowDepth: 1, columnDepth: 0 });
    const grouped = createNativeScenario('grouped');
    grouped.chart.layout.stack = 'zero';
    const before = JSON.stringify(grouped.chart);
    const conflict = adaptChartToRenderPlan(grouped.chart, { columns: grouped.columns });
    assert.equal(conflict.plan, undefined);
    assert.ok(conflict.diagnostics.some((diagnostic) => diagnostic.configRef === 'layout.worksheet.barLayout'));
    assert.equal(JSON.stringify(grouped.chart), before);
});

test('auto mark selection reuses the existing pure rule and validates the selected capability', () => {
    for (const [name, expected] of [['nested', 'bar'], ['scatter', 'point'], ['line', 'line']] as const) {
        const fixture = createNativeScenario(name);
        fixture.chart.config.geoms = ['auto'];
        if (name === 'nested') fixture.chart.config.defaultAggregated = true;
        const result = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns, ...fixture.presentation });
        assert.equal(result.plan?.mark, expected, JSON.stringify(result.diagnostics));
    }
    const fixture = createNativeScenario('nested');
    fixture.chart.encodings.rows = []; fixture.chart.encodings.columns = [fixture.chart.encodings.columns[1]]; fixture.chart.config.geoms = ['auto'];
    const result = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
    assert.equal(result.plan, undefined);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.message.includes('tick')));
});
