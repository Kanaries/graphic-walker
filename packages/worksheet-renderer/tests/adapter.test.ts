import test from 'node:test';
import assert from 'node:assert/strict';
import type { IChart, IViewField } from '../../graphic-walker/src/interfaces';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../../graphic-walker/src/constants';
import { getMeaAggKey } from '../../graphic-walker/src/utils';
import { adaptChartToRenderPlan, type PreparedColumn } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { createPreparedDataSource } from '../src/core/prepared';

const dimension = (fid: string, semanticType: IViewField['semanticType'] = 'nominal'): IViewField => ({ fid, name: fid, semanticType, analyticType: 'dimension' });
const measure = (fid: string, aggName = 'sum'): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName });
const column = (columnKey: string, valueType: PreparedColumn['valueType'] = 'number'): PreparedColumn => ({ columnKey, valueType });
function chart(rows: IViewField[], columns: IViewField[], mark = 'point'): IChart {
    const result = createNestedChartFixture().chart;
    result.encodings.rows = rows;
    result.encodings.columns = columns;
    result.config.geoms = [mark];
    return result;
}
function frozen<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.freeze(value);
        Object.values(value).forEach(frozen);
    }
    return value;
}

test('existing IChart fixture keeps all three row fields and both measure slots', () => {
    const fixture = createNestedChartFixture();
    frozen(fixture.chart);
    const result = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
    assert.deepEqual(result.diagnostics, []);
    const plan = result.plan!;
    const fids = (refs: readonly string[]) => refs.map((ref) => result.fieldRefs.get(ref)!.field.fid);
    assert.deepEqual(fids(plan.rows.facets), ['Region', 'Category']);
    assert.deepEqual(fids(plan.rows.positions), ['Subcategory']);
    assert.deepEqual(fids(plan.columns.facets), ['Year']);
    assert.deepEqual(fids(plan.columns.positions), ['Sales', 'Profit']);
    assert.equal(plan.barOrientation, 'horizontal');
    assert.equal(plan.bindings.find((binding) => binding.columnKey === 'Sales_sum')?.label, 'sum(Sales)');
    assert.equal(fixture.chart.encodings.rows.length, 3);
    assert.equal('encodings' in plan, false);
    assert.equal('$schema' in plan, false);
});

test('U1 produces 24 panes with stable host result identities and unchanged values', async () => {
    const fixture = createNestedChartFixture();
    const { plan } = adaptChartToRenderPlan(fixture.chart, { columns: fixture.columns });
    assert.ok(plan);
    const version = { sourceId: 'u1', snapshotId: 'results-1', presentationId: 'display-1' };
    const signal = new AbortController().signal;
    const source = createPreparedDataSource({ version, plan, records: fixture.records, getDatumKey: fixture.getDatumKey });
    const manifest = await source.describe(signal);
    assert.equal(manifest.rowLeafCount, 6);
    assert.equal(manifest.columnLeafCount, 4);
    assert.equal(manifest.nonEmptyPaneCount, 24);
    assert.equal(manifest.recordCount, 24);
    assert.equal(manifest.identityScope, 'stable');
    const windows = [{ rows: { start: 0, end: 6 }, columns: { start: 0, end: 4 } }];
    const batch = await source.readPaneData({ version, windows }, signal);
    assert.equal(batch.panes.length, 24);
    assert.equal(batch.panes.reduce((total, pane) => total + pane.records.length, 0), 48);
    assert.equal(new Set(batch.panes.flatMap((pane) => pane.records.map((record) => record.datumKey))).size, 24);
    for (const pane of batch.panes) for (const record of pane.records) {
        assert.deepEqual(record.values, fixture.records.find((input) => input.__datumKey === record.datumKey));
    }
    const reorderedVersion = { ...version, snapshotId: 'results-2', presentationId: 'display-2' };
    const reordered = createPreparedDataSource({ version: reorderedVersion, plan, records: [...fixture.records].reverse(), getDatumKey: fixture.getDatumKey });
    const reorderedBatch = await reordered.readPaneData({ version: reorderedVersion, windows }, signal);
    assert.deepEqual(new Set(reorderedBatch.panes.map((pane) => pane.key)), new Set(batch.panes.map((pane) => pane.key)));
    assert.deepEqual(new Set(reorderedBatch.panes.flatMap((pane) => pane.records.map((record) => record.datumKey))), new Set(batch.panes.flatMap((pane) => pane.records.map((record) => record.datumKey))));
});

test('D/M roles use stable grouping independently of numeric or temporal semantics', () => {
    const amount = measure('amount');
    const year = dimension('year', 'quantitative');
    const month = dimension('month', 'temporal');
    const spec = chart([amount, year, month], [dimension('category')]);
    const original = JSON.stringify(spec);
    const result = adaptChartToRenderPlan(spec, { columns: [column('amount_sum'), column('year'), column('month', 'time'), column('category', 'string')] });
    assert.ok(result.plan);
    assert.deepEqual(result.plan.rows.facets.map((ref) => result.fieldRefs.get(ref)?.field.fid), ['year', 'month']);
    assert.deepEqual(result.plan.rows.positions.map((ref) => result.fieldRefs.get(ref)?.field.fid), ['amount']);
    assert.equal(result.fieldRefs.get(result.plan.rows.positions[0])?.configRef, 'encodings.rows[0]');
    assert.equal(JSON.stringify(spec), original);
});

test('dimension-only axes put the terminal dimension in its actual position type', () => {
    for (const [semanticType, valueType, positionType] of [['nominal', 'string', 'band'], ['quantitative', 'number', 'linear'], ['temporal', 'time', 'time']] as const) {
        const spec = chart([dimension('outer'), dimension('terminal', semanticType)], []);
        const result = adaptChartToRenderPlan(spec, { columns: [column('outer', 'string'), column('terminal', valueType)] });
        assert.ok(result.plan);
        assert.equal(result.plan.rows.facets.length, 1);
        assert.equal(result.plan.rows.positions.length, 1);
        assert.equal(result.plan.columns.positions.length, 0);
        const position = result.plan.bindings.find((binding) => binding.fieldRef === result.plan!.rows.positions[0]);
        assert.equal(position?.positionType, positionType);
        assert.equal(result.plan.bindings.length, 2);
        assert.equal(result.plan.bindings.some((binding) => binding.columnKey.includes(COUNT_FIELD_ID)), false);
    }
});

test('both axes retain 3, 5, 10 and 20 nested dimensions without a fixed depth cap', () => {
    for (const depth of [3, 5, 10, 20]) {
        const rows = Array.from({ length: depth }, (_, index) => dimension(`r${index}`));
        const columns = Array.from({ length: depth }, (_, index) => dimension(`c${index}`));
        const spec = chart([...rows, measure('y')], [...columns, measure('x')]);
        const result = adaptChartToRenderPlan(spec, { columns: [...rows, ...columns].map((field) => column(field.fid, 'string')).concat(column('y_sum'), column('x_sum')) });
        assert.ok(result.plan);
        assert.equal(result.plan.rows.facets.length, depth);
        assert.equal(result.plan.columns.facets.length, depth);
        assert.equal(result.plan.bindings.length, depth * 2 + 2);
    }
});

test('aggregate, raw, expression, count and fold use actual prepared result keys', () => {
    const computed: IViewField = { ...measure('margin', 'expr'), computed: true, expression: { op: 'expr', params: [{ type: 'sql', value: 'SUM(secret_amount) / SUM(secret_count)' }], as: 'margin' } };
    const spec = chart([dimension(MEA_KEY_ID)], [measure('sales'), measure('sales', 'mean'), computed, measure(COUNT_FIELD_ID), measure(MEA_VAL_ID)]);
    const prepared = [column(MEA_KEY_ID, 'string'), column('sales_sum'), column('sales_mean'), column('margin'), column(getMeaAggKey(COUNT_FIELD_ID, 'sum')), column(getMeaAggKey(MEA_VAL_ID, 'sum'))];
    const result = adaptChartToRenderPlan(spec, { columns: prepared });
    assert.ok(result.plan);
    assert.deepEqual(result.plan.bindings.map((binding) => binding.columnKey), prepared.map((item) => item.columnKey));
    assert.equal(result.plan.bindings.find((binding) => binding.columnKey === 'margin')?.label, 'margin');
    assert.equal(JSON.stringify(result.plan).includes('secret_amount'), false);
    spec.config.defaultAggregated = false;
    const raw = adaptChartToRenderPlan(spec, { columns: [column(MEA_KEY_ID, 'string'), column('sales'), column('margin'), column(COUNT_FIELD_ID), column(MEA_VAL_ID)] });
    assert.ok(raw.plan);
    assert.deepEqual(raw.plan.bindings.map((binding) => binding.columnKey), [MEA_KEY_ID, 'sales', 'sales', 'margin', COUNT_FIELD_ID, MEA_VAL_ID]);
    assert.equal(raw.plan.bindings[1].bindingId, raw.plan.bindings[2].bindingId);
    assert.notEqual(raw.plan.bindings[1].fieldRef, raw.plan.bindings[2].fieldRef);
    const missingExpression = adaptChartToRenderPlan(spec, { columns: [column(MEA_KEY_ID, 'string'), column('sales'), column(COUNT_FIELD_ID), column(MEA_VAL_ID)] });
    assert.equal(missingExpression.plan, undefined);
    assert.ok(missingExpression.diagnostics.some((diagnostic) => diagnostic.code === 'missing-binding' && diagnostic.configRef === 'encodings.columns[2]'));
    assert.equal(spec.encodings.columns.length, 5);
});

test('prepared fold branches and count values remain ordinary supplied result columns', async () => {
    const spec = chart([dimension(MEA_KEY_ID)], [measure(MEA_VAL_ID)], 'bar');
    spec.config.folds = ['sales', 'profit'];
    const metadata = [column(MEA_KEY_ID, 'string'), column(getMeaAggKey(MEA_VAL_ID, 'sum'))];
    const { plan } = adaptChartToRenderPlan(spec, { columns: metadata });
    assert.ok(plan);
    const records = [
        { id: 'sales', [MEA_KEY_ID]: 'sum(Sales)', [getMeaAggKey(MEA_VAL_ID, 'sum')]: 125 },
        { id: 'profit', [MEA_KEY_ID]: 'sum(Profit)', [getMeaAggKey(MEA_VAL_ID, 'sum')]: -12 },
    ];
    const version = { sourceId: 'fold', snapshotId: '1', presentationId: '1' };
    const signal = new AbortController().signal;
    const source = createPreparedDataSource({ version, plan, records, getDatumKey: (record) => String(record.id) });
    const batch = await source.readPaneData({ version, windows: [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }] }, signal);
    assert.deepEqual(batch.panes[0].records.map((record) => record.datumKey), ['sales', 'profit']);
    assert.deepEqual(batch.panes[0].records.map((record) => record.values[getMeaAggKey(MEA_VAL_ID, 'sum')]), [125, -12]);
    assert.deepEqual(records.map((record) => record[MEA_KEY_ID]), ['sum(Sales)', 'sum(Profit)']);
    const countSpec = chart([dimension('group')], [measure(COUNT_FIELD_ID)], 'bar');
    const countResult = adaptChartToRenderPlan(countSpec, { columns: [column('group', 'string'), column(getMeaAggKey(COUNT_FIELD_ID, 'sum'))] });
    assert.ok(countResult.plan);
    const countRecords = [{ id: 'already-counted', group: 'A', [getMeaAggKey(COUNT_FIELD_ID, 'sum')]: 73 }];
    const countSource = createPreparedDataSource({ version, plan: countResult.plan, records: countRecords, getDatumKey: (record) => String(record.id) });
    const countBatch = await countSource.readPaneData({ version, windows: [{ rows: { start: 0, end: 1 }, columns: { start: 0, end: 1 } }] }, signal);
    assert.equal(countBatch.panes[0].records[0].values[getMeaAggKey(COUNT_FIELD_ID, 'sum')], 73);
});

test('field occurrences and column identities survive distinct field reordering and renaming', () => {
    const a = dimension('a');
    const b = dimension('b');
    const spec = chart([a, b], [measure('value'), measure('value')]);
    const metadata = [column('a', 'string'), column('b', 'string'), column('value_sum')];
    const before = adaptChartToRenderPlan(spec, { columns: metadata });
    spec.encodings.rows = [{ ...b, name: 'Renamed B' }, a];
    const after = adaptChartToRenderPlan(spec, { columns: metadata });
    assert.ok(before.plan && after.plan);
    const ref = (result: typeof before, fid: string) => [...result.fieldRefs].find(([, value]) => value.field.fid === fid)![0];
    assert.equal(ref(before, 'a'), ref(after, 'a'));
    assert.equal(ref(before, 'b'), ref(after, 'b'));
    assert.deepEqual(before.plan.columns.positions, after.plan.columns.positions);
    assert.equal(new Set(before.plan.columns.positions).size, 2);
    assert.equal(before.plan.bindings[2].bindingId, before.plan.bindings[3].bindingId);
    assert.equal(before.plan.bindings[0].bindingId, after.plan.bindings[1].bindingId);
});

test('time results bind explicit prepared coordinates and raw values without running transformations', () => {
    const month: IViewField = { ...dimension('month', 'temporal'), timeUnit: 'month', offset: 480 };
    const spec = chart([month], [measure('value')], 'bar');
    spec.config.timezoneDisplayOffset = 480;
    const result = adaptChartToRenderPlan(spec, { columns: [{ ...column('month', 'time'), rawColumnKey: 'month_raw' }, column('month_raw', 'string'), column('value_sum')] });
    assert.ok(result.plan);
    assert.equal(result.plan.bindings[0].positionType, 'time');
    assert.equal(result.plan.bindings[0].rawColumnKey, 'month_raw');
    const missingRaw = adaptChartToRenderPlan(spec, { columns: [{ ...column('month', 'time'), rawColumnKey: 'month_raw' }, column('value_sum')] });
    assert.ok(missingRaw.diagnostics.some((diagnostic) => diagnostic.code === 'missing-binding'));
    const unprepared = adaptChartToRenderPlan(spec, { columns: [column('month', 'string'), column('value_sum')] });
    assert.ok(unprepared.diagnostics.some((diagnostic) => diagnostic.code === 'invalid-binding-type'));
});

test('unsupported marks, channel combinations and display options are never silently dropped', () => {
    const mutations: Array<(spec: IChart) => void> = [
        (spec) => { spec.config.geoms = ['arc']; },
        (spec) => { spec.config.geoms = ['bar', 'point']; },
        (spec) => { spec.encodings.size = [measure('value')]; },
        (spec) => { spec.layout.resolve.color = true; },
        (spec) => { spec.layout.stack = 'normalize'; },
        (spec) => { spec.layout.colorPalette = 'unknown-scheme'; },
        (spec) => { spec.layout.format.numberFormat = 'unknown-format'; },
        (spec) => { spec.layout.scale = { column: { type: 'log' } }; },
        (spec) => { spec.layout.interactiveScale = true; },
    ];
    for (const mutate of mutations) {
        const spec = chart([dimension('category')], [measure('value')], 'bar');
        mutate(spec);
        const unchanged = JSON.stringify(spec);
        const result = adaptChartToRenderPlan(spec, { columns: [column('category', 'string'), column('value_sum')] });
        assert.equal(result.plan, undefined);
        assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-encoding'));
        assert.equal(JSON.stringify(spec), unchanged);
    }
    const interval = adaptChartToRenderPlan(chart([dimension('bucket', 'quantitative')], [measure('value')], 'bar'), { columns: [column('bucket', 'interval'), column('value_sum')] });
    assert.ok(interval.plan);
    assert.equal(interval.plan.bindings[0].valueType, 'interval');
});

test('static styles, fixed numeric endpoints and zero settings map without mutating layout', () => {
    const spec = chart([dimension('category')], [measure('value')], 'bar');
    spec.layout.primaryColor = '#123456';
    spec.layout.background = '#ffffff';
    spec.layout.zeroScale = false;
    spec.layout.stack = 'stack';
    spec.layout.scale = { column: { domainMin: -50, domainMax: 100, type: 'linear' } };
    const result = adaptChartToRenderPlan(frozen(spec), { columns: [column('category', 'string'), column('value_sum')] });
    assert.ok(result.plan);
    assert.equal(result.plan.stack, 'zero');
    assert.deepEqual(result.plan.style, { color: '#123456', background: '#ffffff' });
    assert.deepEqual(result.plan.scales?.[result.plan.columns.positions[0]], { scope: { mode: 'shared' }, zero: false, domainMin: -50, domainMax: 100, type: 'linear' });
});

test('numeric measure ambiguity and missing declarations produce actionable paths', () => {
    const ambiguous = adaptChartToRenderPlan(chart([measure('a')], [measure('b')], 'bar'), { columns: [column('a_sum'), column('b_sum')] });
    assert.ok(ambiguous.diagnostics.some((diagnostic) => diagnostic.configRef === 'encodings'));
    const missing = adaptChartToRenderPlan(chart([measure('a')], [], 'point'), { columns: [] });
    assert.equal(missing.plan, undefined);
    assert.equal(missing.diagnostics[0].configRef, 'encodings.rows[0]');
    assert.ok(missing.fieldRefs.has(missing.diagnostics[0].fieldRef!));
    const duplicate = adaptChartToRenderPlan(chart([measure('a')], []), { columns: [column('a_sum'), column('a_sum')] });
    assert.ok(duplicate.diagnostics.some((diagnostic) => diagnostic.code === 'ambiguous-binding'));
});


test('COUNT and distinctCount of nominal fields keep numeric measure positions', () => {
    for (const aggName of ['count', 'distinctCount']) for (const geom of ['bar', 'point']) {
        const input = chart([dimension('category')], [{ ...measure('name', aggName), semanticType: 'nominal' }], geom);
        const result = adaptChartToRenderPlan(input, { columns: [column('category', 'string'), column(`name_${aggName}`)] });
        assert.deepEqual(result.diagnostics, []);
        const binding = result.plan!.bindings.find(b => b.columnKey === `name_${aggName}`)!;
        assert.equal(binding.positionType, 'linear');
        assert.equal(binding.valueType, 'number');
    }
});
