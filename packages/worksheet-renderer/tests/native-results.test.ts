import test from 'node:test';
import assert from 'node:assert/strict';
import type { IChart, IDataQueryWorkflowStep, IRow, IViewField } from '../../graphic-walker/src/interfaces';
import { COUNT_FIELD_ID, MEA_KEY_ID, MEA_VAL_ID } from '../../graphic-walker/src/constants';
import { toWorkflow } from '../../graphic-walker/src/utils/workflow';
import { dataQuery } from '../../graphic-walker/src/computation/dataQuery';
import { getMeaAggKey } from '../../graphic-walker/src/utils';
import { fold2, fold2WithMetadata } from '../../graphic-walker/src/lib/op/fold';
import { prepareNativeResults } from '../../graphic-walker/src/lib/native/results';
import { resultValueIdentity } from '../../graphic-walker/src/lib/native/identity';
import { prepareTemporalValue } from '../../graphic-walker/src/lib/native/temporal';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createPreparedDataSource } from '../src/core/prepared';
import { typedValueKey, toTypedValue } from '../src/core/keys';

const dim = (fid: string, semanticType: IViewField['semanticType'] = 'nominal'): IViewField => ({ fid, name: fid, semanticType, analyticType: 'dimension' });
const mea = (fid: string, aggName = 'sum'): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName });
const version = { sourceId: 'dataset-A', snapshotId: 'query-1', presentationId: 'display-1' };
function chart(rows: IViewField[], columns: IViewField[], aggregated = true): IChart {
    const value = createNestedChartFixture().chart;
    value.encodings.rows = rows;
    value.encodings.columns = columns;
    value.encodings.dimensions = [...rows, ...columns].filter((field) => field.analyticType === 'dimension');
    value.encodings.measures = [...rows, ...columns].filter((field) => field.analyticType === 'measure');
    value.config.defaultAggregated = aggregated;
    value.config.geoms = ['point'];
    return value;
}
function workflow(value: IChart) {
    const fields = [...value.encodings.rows, ...value.encodings.columns, ...value.encodings.color, ...value.encodings.details];
    return toWorkflow(value.encodings.filters, [...value.encodings.dimensions, ...value.encodings.measures], fields.filter((field) => field.analyticType === 'dimension'), fields.filter((field) => field.analyticType === 'measure'), value.config.defaultAggregated, 'none', value.config.folds, undefined, value.config.timezoneDisplayOffset);
}
const errors = (result: ReturnType<typeof prepareNativeResults>) => result.diagnostics.filter((item) => item.severity === 'error');
const keys = (result: ReturnType<typeof prepareNativeResults>) => result.records.map((record) => result.getDatumKey(record));

test('completed GW workflow/query rows bind sum, mean, count and expr without executing them again', async () => {
    const expression: IViewField = { ...mea('ratio', 'expr'), computed: true, expression: { op: 'expr', as: 'ratio', params: [{ type: 'sql', value: 'sum(sales) / count(*)' }] } };
    const value = chart([dim('region')], [mea('sales'), mea('sales', 'mean'), mea(COUNT_FIELD_ID, 'count'), expression]);
    const computed = workflow(value);
    const queryRows = Object.freeze([Object.freeze({ region: 'East', sales_sum: 27, sales_mean: 9, [getMeaAggKey(COUNT_FIELD_ID, 'count')]: 3, ratio: 9 })]);
    let calls = 0;
    const rows = await dataQuery(async (payload) => { calls++; assert.deepEqual(payload.workflow, computed); return queryRows as unknown as IRow[]; }, computed);
    const prepared = prepareNativeResults({ chart: value, queryRows: rows, workflow: computed, version });
    assert.equal(calls, 1);
    assert.deepEqual(errors(prepared), []);
    assert.deepEqual(prepared.records, queryRows);
    assert.equal(prepared.identityScope, 'stable');
    assert.deepEqual(prepared.columns.map((column) => column.columnKey), ['region', 'sales_sum', 'sales_mean', getMeaAggKey(COUNT_FIELD_ID, 'count'), 'ratio']);
    assert.equal(prepared.fieldColumns.get('encodings.columns[3]'), 'ratio');
    const changed = prepareNativeResults({ chart: value, queryRows: [{ ...queryRows[0], sales_sum: 45, sales_mean: 15, ratio: 15 }], workflow: computed, version: { ...version, snapshotId: 'query-2' } });
    assert.deepEqual(keys(prepared), keys(changed));
    const adapted = adaptChartToRenderPlan(value, { columns: prepared.columns });
    assert.ok(adapted.plan);
    const source = createPreparedDataSource({ version, plan: adapted.plan, records: prepared.records, getDatumKey: prepared.getDatumKey, identityScope: prepared.identityScope });
    assert.equal((await source.describe(new AbortController().signal)).identityScope, 'stable');
});

test('typed aggregate identities keep null, string, number, boolean and intervals distinct after reorder', () => {
    const value = chart([dim('group')], [mea('sales')]);
    const computed = workflow(value);
    const rows = [null, 'null', 1, '1', false, 'false', [1, 2]].map((group) => ({ group, sales_sum: 10 }));
    // Identity helper supports interval group keys independently of display validation.
    assert.equal(new Set(rows.map((row) => JSON.stringify(resultValueIdentity(row.group)))).size, rows.length);
    const supported = rows.slice(0, -1);
    const first = prepareNativeResults({ chart: value, queryRows: supported, workflow: computed, version });
    const second = prepareNativeResults({ chart: value, queryRows: [...supported].reverse(), workflow: [...computed, { type: 'sort', by: ['group'], sort: 'descending' }], version: { ...version, presentationId: 'sorted' } });
    assert.deepEqual(errors(first), []);
    assert.deepEqual(keys(second), keys(first).reverse());
    assert.equal(new Set(keys(first)).size, supported.length);
});

test('duplicate aggregate rows and absent group keys are explicit identity errors', () => {
    const value = chart([dim('region')], [mea('sales')]);
    for (const rows of [[{ region: 'East', sales_sum: 1 }, { region: 'East', sales_sum: 2 }], [{ sales_sum: 1 }]]) {
        const result = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
        assert.ok(errors(result).some((item) => item.code === 'unstable-datum-identity'));
        assert.notEqual(result.identityScope, 'stable');
        assert.throws(() => result.getDatumKey(result.records[0]), /identity errors/);
    }
});

test('raw records require host keys for cross-query stable identity, with typed keys and original callback objects', () => {
    const value = chart([dim('region')], [mea('sales')], false);
    const rows = [{ id: 1, region: 'East', sales: 10 }, { id: '1', region: 'East', sales: 10 }];
    const seen: readonly IRow[] = rows;
    const result = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version, getRowKey: (row, index) => { assert.equal(row, seen[index]); return row.id; } });
    assert.deepEqual(errors(result), []);
    assert.equal(result.identityScope, 'stable');
    assert.notEqual(keys(result)[0], keys(result)[1]);
    const reordered = prepareNativeResults({ chart: value, queryRows: [...rows].reverse(), workflow: workflow(value), version: { ...version, snapshotId: 'new' }, getRowKey: (row) => row.id });
    assert.deepEqual(keys(reordered), keys(result).reverse());
    const snapshot = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
    assert.equal(snapshot.identityScope, 'snapshot');
    assert.equal(snapshot.diagnostics[0].code, 'snapshot-datum-identity');
    assert.equal(new Set(keys(snapshot)).size, 2);
    const next = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version: { ...version, snapshotId: 'new' } });
    assert.notDeepEqual(keys(snapshot), keys(next));
});

test('invalid, duplicate or throwing host keys fail instead of silently becoming stable indices', () => {
    const value = chart([dim('region')], [mea('sales')], false);
    for (const getRowKey of [() => '', () => NaN, () => 'duplicate', () => { throw new Error('provider key failed'); }]) {
        const result = prepareNativeResults({ chart: value, queryRows: [{ region: 'East', sales: 1 }, { region: 'East', sales: 2 }], workflow: workflow(value), version, getRowKey });
        assert.ok(errors(result).some((item) => item.code === 'unstable-datum-identity'));
        assert.notEqual(result.identityScope, 'stable');
        assert.throws(() => result.getDatumKey(result.records[0]));
    }
});

test('fold sidecar preserves equal display names, original fid/agg and row provenance', () => {
    const foldKey = dim(MEA_KEY_ID), foldValue = mea(MEA_VAL_ID);
    const a = { ...mea('a'), name: 'Revenue' }, b = { ...mea('b'), name: 'Revenue' };
    const value = chart([dim('region'), foldKey], [foldValue]);
    value.encodings.measures.push(a, b);
    value.config.folds = ['a', 'b'];
    const rows = [{ region: 'East', a_sum: 12, b_sum: 12 }, { region: 'West', a_sum: 20, b_sum: 30 }];
    const all = [...value.encodings.dimensions, ...value.encodings.measures];
    const sidecar = fold2WithMetadata(rows, true, all, [foldValue], [dim('region'), foldKey], value.config.folds);
    assert.deepEqual(sidecar.records, fold2(rows, true, all, [foldValue], [dim('region'), foldKey], value.config.folds));
    assert.deepEqual(sidecar.metadata.map((item) => [item.inputIndex, item.branch?.fid, item.branch?.aggName, item.branch?.columnKey]), [[0, 'a', 'sum', 'a_sum'], [0, 'b', 'sum', 'b_sum'], [1, 'a', 'sum', 'a_sum'], [1, 'b', 'sum', 'b_sum']]);
    assert.equal(sidecar.records[0][MEA_KEY_ID], sidecar.records[1][MEA_KEY_ID]);
    const prepared = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
    assert.deepEqual(errors(prepared), []);
    assert.equal(new Set(keys(prepared)).size, 4);
    assert.equal(prepared.records[0][getMeaAggKey(MEA_VAL_ID, 'sum')], 12);
    assert.deepEqual(prepared.foldMetadata.map((item) => item.branch?.fid), ['a', 'b', 'a', 'b']);
    assert.deepEqual(rows[0], { region: 'East', a_sum: 12, b_sum: 12 });
    const reversed = prepareNativeResults({ chart: value, queryRows: [...rows].reverse(), workflow: workflow(value), version: { ...version, snapshotId: 'new' } });
    assert.deepEqual(keys(reversed), [...keys(prepared).slice(2), ...keys(prepared).slice(0, 2)]);
});

test('fold expr/raw exclusions and duplicate fold branches retain legacy values with honest diagnostics', () => {
    const foldKey = dim(MEA_KEY_ID), foldValue = mea(MEA_VAL_ID);
    const expression = { ...mea('expr', 'expr'), name: 'Expression' }, ordinary = mea('sales');
    const all = [foldKey, foldValue, expression, ordinary];
    const rows = [{ expr: 3, sales: 4, sales_sum: 8 }];
    const raw = fold2WithMetadata(rows, false, all, [foldValue], [foldKey], ['expr', 'sales']);
    assert.deepEqual(raw.branches.map((branch) => branch.columnKey), ['sales']);
    assert.equal(raw.records[0][MEA_VAL_ID], 4);
    const agg = fold2WithMetadata(rows, true, all, [foldValue], [foldKey], ['expr', 'sales']);
    assert.deepEqual(agg.branches.map((branch) => [branch.columnKey, branch.aggName]), [['expr', 'expr'], ['sales_sum', 'sum']]);
    const value = chart([foldKey], [foldValue]);
    value.encodings.measures.push(ordinary);
    value.config.folds = ['sales', 'sales'];
    const prepared = prepareNativeResults({ chart: value, queryRows: [{ sales_sum: 8 }], workflow: workflow(value), version });
    assert.ok(errors(prepared).some((item) => item.message.includes('duplicate result identities')));
    value.config.defaultAggregated = false;
    value.config.folds = ['expr', 'missing'];
    value.encodings.measures.push(expression);
    const missing = prepareNativeResults({ chart: value, queryRows: [], workflow: workflow(value), version });
    assert.deepEqual(errors(missing).filter((item) => item.configRef?.startsWith('config.folds')).map((item) => item.configRef), ['config.folds[0]', 'config.folds[1]']);
});

test('equal fold labels produce distinct facet/series identities with an explicit display label table', async () => {
    const foldKey = dim(MEA_KEY_ID), foldValue = mea(MEA_VAL_ID);
    const value = chart([foldKey, dim('category')], [foldValue]);
    value.encodings.color = [foldKey];
    value.encodings.measures.push({ ...mea('a'), name: 'Revenue' }, { ...mea('b'), name: 'Revenue' });
    value.config.folds = ['a', 'b'];
    const rows = [{ category: 'Chair', a_sum: 10, b_sum: 10, __gw_native_fold_branch: 'host value' }];
    const prepared = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
    assert.deepEqual(errors(prepared), []);
    const displayKey = prepared.fieldColumns.get('encodings.rows[0]')!;
    assert.equal(displayKey, '__gw_native_fold_branch_1');
    assert.equal(prepared.fieldColumns.get('encodings.color[0]'), displayKey);
    assert.notEqual(prepared.records[0][displayKey], prepared.records[1][displayKey]);
    assert.equal(prepared.records[0][MEA_KEY_ID], prepared.records[1][MEA_KEY_ID]);
    assert.equal(prepared.records[0].__gw_native_fold_branch, 'host value');
    const column = prepared.columns.find((item) => item.columnKey === displayKey)!;
    assert.equal(column.rawColumnKey, MEA_KEY_ID);
    assert.deepEqual(prepared.records.map((record) => column.valueLabels![typedValueKey(toTypedValue(record[displayKey]))]), ['sum(Revenue)', 'sum(Revenue)']);
    // The production adapter will consume fieldColumns/valueLabels in S3. Bind it
    // explicitly here so the frozen S1 library can verify actual topology/series.
    const adapted = adaptChartToRenderPlan(value, { columns: prepared.columns });
    assert.ok(adapted.plan);
    const bindings = adapted.plan.bindings.map((binding) => {
        const configRef = adapted.fieldRefs.get(binding.fieldRef)!.configRef;
        const resolved = prepared.columns.find((item) => item.columnKey === prepared.fieldColumns.get(configRef))!;
        return { ...binding, ...resolved, bindingId: `${binding.bindingId}:${resolved.columnKey}` };
    });
    const plan = { ...adapted.plan, bindings, domainPlanKey: `${adapted.plan.domainPlanKey}:prepared` };
    const source = createPreparedDataSource({ version, plan, records: prepared.records, getDatumKey: prepared.getDatumKey, identityScope: prepared.identityScope });
    const signal = new AbortController().signal;
    assert.equal((await source.describe(signal)).rowLeafCount, 2);
    const domains = await source.readDomains({ version, fieldRefs: [] }, signal);
    assert.equal(domains.series?.keys.length, 2);
    const axis = await source.readAxis({ version, axis: 'row', range: { start: 0, end: 2 } }, signal);
    assert.notEqual(axis.leaves[0].key, axis.leaves[1].key);
    const panes = await source.readPaneData({ version, windows: [{ rows: { start: 0, end: 2 }, columns: { start: 0, end: 1 } }] }, signal);
    assert.equal(panes.panes.length, 2);
    assert.notEqual(panes.panes[0].records[0].seriesKey, panes.panes[1].records[0].seriesKey);
    const empty = prepareNativeResults({ chart: value, queryRows: [], workflow: workflow(value), version });
    assert.deepEqual(Object.values(empty.columns.find((item) => item.valueLabels)?.valueLabels ?? {}), ['sum(Revenue)', 'sum(Revenue)']);
});

test('empty results still declare aggregate, raw, folded and temporal display columns', () => {
    const time = { ...dim('date', 'temporal'), offset: 0 };
    const value = chart([time], [mea('sales'), mea(COUNT_FIELD_ID, 'count')]);
    value.config.timezoneDisplayOffset = 0;
    const empty = prepareNativeResults({ chart: value, queryRows: [], workflow: workflow(value), version });
    assert.deepEqual(errors(empty), []);
    assert.deepEqual(empty.records, []);
    const displayKey = empty.fieldColumns.get('encodings.rows[0]')!;
    assert.notEqual(displayKey, 'date');
    assert.deepEqual(empty.columns.find((column) => column.columnKey === displayKey), { columnKey: displayKey, valueType: 'time', rawColumnKey: 'date' });
    assert.ok(empty.columns.some((column) => column.columnKey === 'sales_sum' && column.valueType === 'number'));
    const raw = prepareNativeResults({ chart: { ...value, config: { ...value.config, defaultAggregated: false } }, queryRows: [], workflow: [{ type: 'view', query: [{ op: 'raw', fields: ['date', 'sales', COUNT_FIELD_ID] }] }], version });
    assert.ok(raw.columns.some((column) => column.columnKey === 'sales'));
    const foldedChart = chart([dim(MEA_KEY_ID)], [mea(MEA_VAL_ID)]);
    foldedChart.encodings.measures.push(mea('a'));
    foldedChart.config.folds = ['a'];
    const folded = prepareNativeResults({ chart: foldedChart, queryRows: [], workflow: workflow(foldedChart), version });
    assert.deepEqual(errors(folded), []);
    assert.ok(folded.columns.some((column) => column.columnKey === MEA_KEY_ID));
    assert.ok(folded.columns.some((column) => column.columnKey === getMeaAggKey(MEA_VAL_ID, 'sum')));
});

test('temporal coordinates preserve raw strings/null/zero and use explicit per-occurrence display columns', () => {
    const a = { ...dim('date', 'temporal'), offset: 0 };
    const b = { ...a, offset: 60 };
    const value = chart([a], [b], false);
    value.config.timezoneDisplayOffset = 0;
    const rows = [{ id: 'a', date: '2026-11-06' }, { id: 'b', date: null }, { id: 'c', date: 0 }];
    const original = JSON.stringify(rows);
    const result = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version, getRowKey: (row) => row.id });
    assert.deepEqual(errors(result), []);
    const first = result.fieldColumns.get('encodings.rows[0]')!, second = result.fieldColumns.get('encodings.columns[0]')!;
    assert.notEqual(first, second);
    assert.equal(result.records[0][first], Date.UTC(2026, 10, 6));
    assert.equal(result.records[0][second], Date.UTC(2026, 10, 6) + 3600000);
    assert.equal(result.records[0].date, '2026-11-06');
    assert.equal(result.records[1][first], null);
    assert.equal(result.records[2][first], 0);
    assert.equal(result.records[2][second], 0);
    assert.equal(JSON.stringify(rows), original);
    assert.ok(Object.isFrozen(result.records[0]));
    assert.throws(() => result.getDatumKey(rows[0]), /does not belong/);
});

test('temporal display matches explicit existing offset conventions and rejects invalid input', () => {
    assert.equal(prepareTemporalValue(0, { displayOffset: 60, fieldOffset: 480, localOffset: 420 }), -3600000);
    assert.equal(prepareTemporalValue('2026-11-06', { displayOffset: 0, fieldOffset: 60, localOffset: 420 }), Date.UTC(2026, 10, 6) + 3600000);
    assert.equal(prepareTemporalValue('2026-11-06T00:00:00.000Z', { displayOffset: 60, fieldOffset: 420, localOffset: 420 }), Date.UTC(2026, 10, 6) - 3600000);
    assert.equal(prepareTemporalValue('2026-03-08T01:30:00-08:00', { displayOffset: 0, fieldOffset: 420, localOffset: 420 }), Date.parse('2026-03-08T09:30:00Z'));
    assert.equal(prepareTemporalValue('2026-03-08T03:30:00-07:00', { displayOffset: 0, fieldOffset: 420, localOffset: 420 }), Date.parse('2026-03-08T10:30:00Z'));
    assert.equal(prepareTemporalValue(null, {}), null);
    for (const value of [undefined, false, NaN, Infinity, 1e20, 'not-a-date', {}]) assert.throws(() => prepareTemporalValue(value, {}));
});

test('generated temporal columns avoid actual result keys, including keys on later rows', () => {
    const time = { ...dim('date', 'temporal'), offset: 0 };
    const value = chart([time], [mea('sales')], false);
    value.config.timezoneDisplayOffset = 0;
    const collision = '__gw_native_time_["date",0,0]';
    const rows = [{ date: '2026-11-06', sales: 1 }, { date: '2026-11-07', sales: 2, [collision]: 'host value' }];
    const result = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
    assert.deepEqual(errors(result), []);
    assert.equal(result.fieldColumns.get('encodings.rows[0]'), `${collision}_1`);
    assert.equal(result.records[1][collision], 'host value');
});

test('already prepared dateTimeDrill and interval values are consumed without recomputation', () => {
    const time: IViewField = { ...dim('month', 'temporal'), offset: 0, computed: true, timeUnit: 'month', expression: { op: 'dateTimeDrill', as: 'month', params: [{ type: 'field', value: 'date' }, { type: 'value', value: 'month' }] } };
    const bin: IViewField = { ...dim('bucket', 'quantitative'), computed: true, expression: { op: 'bin', as: 'bucket', params: [{ type: 'field', value: 'sales' }] } };
    const value = chart([bin], [time], false);
    value.config.timezoneDisplayOffset = 0;
    const rows = [{ bucket: [10, 20], month: Date.UTC(2026, 10, 1) }, { bucket: null, month: null }];
    const completed: IDataQueryWorkflowStep[] = [{ type: 'view', query: [{ op: 'raw', fields: ['bucket', 'month'] }] }];
    const prepared = prepareNativeResults({ chart: value, queryRows: rows, workflow: completed, version });
    assert.deepEqual(errors(prepared), []);
    assert.deepEqual(prepared.records.map((record) => record.bucket), [[10, 20], null]);
    assert.equal(prepared.columns.find((column) => column.columnKey === 'bucket')?.valueType, 'interval');
    assert.notEqual(prepared.records[0].bucket, rows[0].bucket);
    assert.ok(Object.isFrozen(prepared.records[0].bucket));
    assert.equal(prepared.records[0][prepared.fieldColumns.get('encodings.columns[0]')!], rows[0].month);
    const bare = { ...value, encodings: { ...value.encodings, columns: [{ ...time, expression: undefined }] } };
    const invalid = prepareNativeResults({ chart: bare, queryRows: rows, workflow: completed, version });
    assert.ok(errors(invalid).some((item) => item.message.includes('timeUnit')));
    const invalidEmpty = prepareNativeResults({ chart: { ...value, config: { ...value.config, timezoneDisplayOffset: Infinity } }, queryRows: [], workflow: completed, version });
    assert.ok(errors(invalidEmpty).some((item) => item.message.includes('offsets')));
});

test('missing raw expr, missing bindings and malformed values diagnose their original encoding', () => {
    const expression = mea('expr', 'expr');
    const value = chart([dim('region')], [expression], false);
    const missingExpr = prepareNativeResults({ chart: value, queryRows: [], workflow: workflow(value), version });
    assert.ok(errors(missingExpr).some((item) => item.configRef === 'encodings.columns[0]' && item.code === 'missing-binding'));
    const numeric = chart([dim('region')], [mea('sales')]);
    for (const rows of [[{ region: 'East' }], [{ region: 'East', sales_sum: '12' }], [{ region: 'East', sales_sum: Infinity }]]) {
        const invalid = prepareNativeResults({ chart: numeric, queryRows: rows, workflow: workflow(numeric), version });
        assert.ok(errors(invalid).some((item) => item.configRef === 'encodings.columns[0]'));
    }
    const nullable = prepareNativeResults({ chart: numeric, queryRows: [{ region: null, sales_sum: null }], workflow: workflow(numeric), version });
    assert.deepEqual(errors(nullable), []);
});

test('unknown workflow grain and invalid host versions cannot publish a valid result', () => {
    const value = chart([], [mea('sales')], false);
    const unknown = prepareNativeResults({ chart: value, queryRows: [{ sales: 1 }], workflow: [], version });
    assert.ok(errors(unknown).some((item) => item.code === 'unstable-datum-identity'));
    const invalid = prepareNativeResults({ chart: value, queryRows: [], workflow: workflow(value), version: { ...version, sourceId: '' } });
    assert.ok(errors(invalid).some((item) => item.code === 'invalid-version'));
    assert.deepEqual(version, { sourceId: 'dataset-A', snapshotId: 'query-1', presentationId: 'display-1' });
});

test('ordinary GW ordinal bin and binCount results keep their existing interval and bucket semantics', async () => {
    for (const op of ['bin', 'binCount'] as const) {
        const bucket: IViewField = { ...dim('bucket', 'ordinal'), computed: true, expression: { op, as: 'bucket', params: [{ type: 'field', value: 'sales' }] } };
        const count = mea(COUNT_FIELD_ID, 'count');
        const value = chart([count], [bucket]);
        value.encodings.measures.push(mea('sales'));
        value.config.geoms = ['bar'];
        const rows = (op === 'bin' ? [[0, 10], [10, 20]] : [1, 2]).map((bucket, index) => ({ bucket, [getMeaAggKey(COUNT_FIELD_ID, 'count')]: index + 2 }));
        const prepared = prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version });
        assert.deepEqual(errors(prepared), []);
        const adapted = adaptChartToRenderPlan(value, { columns: prepared.columns, fieldColumns: prepared.fieldColumns });
        assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
        const binding = adapted.plan.bindings.find(binding => binding.columnKey === 'bucket')!;
        assert.equal(binding.valueType, op === 'bin' ? 'interval' : 'number');
        assert.equal(binding.positionType, op === 'bin' ? 'linear' : 'band');
        assert.deepEqual(prepared.records.map(record => record.bucket), rows.map(row => row.bucket));
        assert.equal(new Set(keys(prepared)).size, 2);
        const source = createPreparedDataSource({ plan: adapted.plan, records: prepared.records, version, getDatumKey: prepared.getDatumKey, identityScope: prepared.identityScope });
        assert.equal((await source.describe(new AbortController().signal)).recordCount, 2);
    }
});
