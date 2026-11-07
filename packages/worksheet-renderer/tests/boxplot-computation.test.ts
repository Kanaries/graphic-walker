import assert from 'node:assert/strict';
import test from 'node:test';
import type { IChart, IRow, IViewField } from '../../graphic-walker/src/interfaces';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../graphic-walker/src/constants';
import { computeBoxplotStatistics, planBoxplotComputation } from '../../graphic-walker/src/computation/boxplot';
import { dataQuery } from '../../graphic-walker/src/computation/dataQuery';
import { queryView } from '../../graphic-walker/src/lib/viewQuery';
import { filter } from '../../graphic-walker/src/lib/filter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { prepareNativeResults } from '../../graphic-walker/src/lib/native/results';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { toWorkflow } from '../../graphic-walker/src/utils/workflow';
import { viewEncodingKeys } from '../../graphic-walker/src/models/visSpec';
import { createPreparedDataSource } from '../src/core/prepared';
import { selectionTarget } from '../src/runtime/types';

const dim = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType: 'nominal' });
const mea = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
const version = { sourceId: 'boxplot', snapshotId: 'raw-1', presentationId: 'view-1' };
function chart(measures = ['value']): IChart {
    const value = createNestedChartFixture().chart;
    value.layout.renderer = 'native';
    value.config.geoms = ['boxplot'];
    value.config.defaultAggregated = false;
    value.encodings.rows = measures.map(mea);
    value.encodings.columns = [dim('category')];
    value.encodings.dimensions = [dim('category')];
    value.encodings.measures = measures.map(mea);
    return value;
}
function workflow(value: IChart) {
    const fields = viewEncodingKeys('boxplot').flatMap((name) => value.encodings[name]);
    return toWorkflow(value.encodings.filters, [...value.encodings.dimensions, ...value.encodings.measures], fields.filter((field) => field.analyticType === 'dimension'), fields.filter((field) => field.analyticType === 'measure'), false, 'none', value.config.folds, undefined, value.config.timezoneDisplayOffset);
}
function calculate(value: IChart, rows: readonly IRow[]) {
    return computeBoxplotStatistics(rows, planBoxplotComputation(value)!, workflow(value));
}
function prepare(value: IChart, rows: readonly IRow[]) {
    return prepareNativeResults({ chart: value, queryRows: rows, workflow: workflow(value), version, boxplot: calculate(value, rows), getRowKey: (row) => row.id });
}

test('boxplot computation uses type-7 quartiles and actual observed whiskers without mutating samples', () => {
    const value = chart();
    const rows = Object.freeze([1, 1, 2, 3, 4, 100].map((sample, id) => Object.freeze({ category: 'A', value: sample, id })));
    const before = JSON.stringify(rows);
    const result = calculate(value, rows);
    assert.equal(result.groups.length, 1);
    const group = result.groups[0];
    assert.deepEqual([group.q1, group.median, group.q3, group.lowerWhisker, group.upperWhisker], [1.25, 2.5, 3.75, 1, 4]);
    assert.deepEqual(group.outliers, [{ inputIndex: 5, value: 100 }]);
    assert.equal(JSON.stringify(rows), before);
    assert.ok(Object.isFrozen(result.groups));
    const even = calculate(value, [1, 2, 3, 4].map((sample) => ({ category: 'B', value: sample }))).groups[0];
    assert.deepEqual([even.q1, even.median, even.q3, even.lowerWhisker, even.upperWhisker], [1.75, 2.5, 3.25, 1, 4]);
});

test('null samples, singleton and constant groups, typed nested groups and independent measures have explicit semantics', () => {
    const value = chart(['value', 'other']);
    value.encodings.rows.unshift(dim('region'));
    value.encodings.color = [dim('series')];
    value.encodings.details = [dim('detail')];
    const rows = [
        { region: 'East', category: 1, series: 'S', detail: 'x', value: null, other: 4 },
        { region: 'East', category: 1, series: 'S', detail: 'x', value: 5, other: 4 },
        { region: 'East', category: '1', series: 'S', detail: 'x', value: 9, other: null },
        { region: 'East', category: 1, series: 'T', detail: 'x', value: 7, other: 8 },
        { region: 'East', category: 1, series: 'S', detail: 'y', value: 6, other: 10 },
        { region: 'West', category: 'empty', series: 'S', detail: 'x', value: null, other: null },
    ];
    const result = calculate(value, rows);
    assert.equal(result.groups.length, 7);
    const firstValue = result.groups.find((group) => group.representativeIndex === 0 && group.measureColumn === 'value')!;
    assert.deepEqual([firstValue.q1, firstValue.median, firstValue.q3, firstValue.lowerWhisker, firstValue.upperWhisker], [5, 5, 5, 5, 5]);
    assert.deepEqual(firstValue.outliers, []);
    assert.equal(result.groups.some((group) => group.representativeIndex === 5), false);
    assert.deepEqual(calculate(value, []).groups, []);
});

test('invalid samples, aggregate inputs and unsupported folded/aggregate-expression samples fail in computation', () => {
    const value = chart();
    for (const sample of [undefined, '5', Infinity, NaN])
        assert.throws(() => calculate(value, [{ category: 'A', value: sample }]), /invalid numeric sample/);
    assert.throws(() => computeBoxplotStatistics([], planBoxplotComputation(value)!, [{ type: 'view', query: [{ op: 'aggregate', groupBy: ['category'], measures: [{ field: 'value', agg: 'sum', asFieldKey: 'value_sum' }] }] }]), /raw query/);
    value.encodings.rows[0].aggName = 'expr';
    assert.throws(() => calculate(value, []), /aggregate SQL expressions/);
    value.encodings.rows = [mea(MEA_VAL_ID)];
    value.encodings.columns = [dim(MEA_KEY_ID)];
    assert.throws(() => calculate(value, []), /folded measure names/);
    const filtered = chart();
    filtered.encodings.filters = [{ ...mea('value'), enableAgg: true, rule: { type: 'range', value: [1, 10] } }];
    assert.throws(() => calculate(filtered, []), /aggregate filters/);
});

test('local and external raw providers share the common statistics stage without a new provider operator', async () => {
    const value = chart();
    value.encodings.filters = [{ ...mea('value'), enableAgg: false, rule: { type: 'range', value: [0, 3] } }];
    const raw = [1, 2, 3, 40].map((sample) => ({ category: 'A', value: sample }));
    const completedWorkflow = workflow(value);
    const localRows = await dataQuery(async (payload) => {
        assert.equal(payload.limit, undefined);
        return payload.workflow.reduce((records, step) => step.type === 'filter' ? filter(records, step.filters)
            : step.type === 'view' ? step.query.reduce((current, query) => queryView(current, query), records) : records, raw as IRow[]);
    }, completedWorkflow);
    const remoteRows = await dataQuery(async (payload) => {
        assert.deepEqual(payload.workflow, completedWorkflow);
        assert.ok(payload.workflow.every((step) => step.type !== 'view' || step.query.every((query) => query.op === 'raw')));
        assert.equal(payload.limit, undefined);
        return JSON.parse(JSON.stringify(raw.filter((row) => row.value <= 3)));
    }, completedWorkflow);
    assert.deepEqual(calculate(value, localRows), calculate(value, remoteRows));
    assert.equal(calculate(value, localRows).groups[0].median, 2);
});

test('computed statistics become role rows with stable summaries, original outlier identities and isolated measure slots', async () => {
    const value = chart(['value', 'other']);
    // Deliberately retained UI aggregation must not relabel raw statistics as sum(value).
    value.config.defaultAggregated = true;
    const rows = [1, 1, 2, 3, 4, 100].map((sample, id) => ({ category: 'A', value: sample, other: sample * 2, id }));
    const result = prepare(value, rows);
    assert.deepEqual(result.diagnostics, []);
    assert.ok(result.boxplot);
    assert.equal(result.records.length, 12);
    assert.equal(result.identityScope, 'stable');
    assert.equal(result.records.filter((record) => record[result.boxplot!.roleColumn] === 'outlier').length, 2);
    assert.ok(result.records.every((record) => (record.value === null) !== (record.other === null)));
    const firstKeys = new Set(result.records.map((record) => result.getDatumKey(record)));
    const reordered = prepare(value, [...rows].reverse());
    assert.deepEqual(new Set(reordered.records.map((record) => reordered.getDatumKey(record))), firstKeys);
    const adapted = adaptChartToRenderPlan(value, { columns: result.columns, fieldColumns: result.fieldColumns, boxplot: result.boxplot });
    assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
    assert.equal(adapted.plan.barOrientation, 'vertical');
    assert.equal(adapted.plan.bindings.find((binding) => binding.columnKey === 'value')?.label, 'value');
    const source = createPreparedDataSource({ version, plan: adapted.plan, records: result.records, getDatumKey: result.getDatumKey, identityScope: result.identityScope });
    const manifest = await source.describe(new AbortController().signal);
    assert.equal(manifest.rowLeafCount, 2);
    assert.equal(manifest.columnLeafCount, 1);
});

test('statistics metadata avoids user-column collisions and reused measure visual groups preserve original values', () => {
    const value = chart(['value', 'other']);
    value.encodings.color = [mea('other')];
    const rows = [1, 2, 3, 100].map((sample, id) => ({ category: 'A', value: sample, other: 8, __gw_boxplot_group: 'user group', __gw_boxplot_role: 'user role', id }));
    const result = prepare(value, rows);
    assert.deepEqual(result.diagnostics, []);
    assert.notEqual(result.boxplot?.groupKeyColumn, '__gw_boxplot_group');
    assert.notEqual(result.boxplot?.roleColumn, '__gw_boxplot_role');
    const colorColumn = result.fieldColumns.get('encodings.color[0]')!;
    assert.notEqual(colorColumn, 'other');
    assert.ok(result.records.every((record) => record[colorColumn] === 8 && record.__gw_boxplot_group === 'user group' && record.__gw_boxplot_role === 'user role'));
    const adapted = adaptChartToRenderPlan(value, { columns: result.columns, fieldColumns: result.fieldColumns, boxplot: result.boxplot });
    assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const target = selectionTarget({ id: 'summary', paneKey: 'pane', datumKey: result.getDatumKey(result.records[0]), values: result.records[0], recordValues: result.records, datumKeys: result.records.map(record => result.getDatumKey(record)), box, clip: box }, adapted.plan);
    const channel = adapted.plan.channels!.color!;
    assert.ok('fieldRef' in channel);
    const selectedColors = target.values.filter(item => item.fieldRef === channel.fieldRef);
    assert.equal(selectedColors.length, result.records.length);
    assert.ok(selectedColors.every(item => item.value === 8 && item.raw === 8));
});

test('result preparation rejects missing statistics instead of calculating them inside the renderer adapter', () => {
    const value = chart();
    const result = prepareNativeResults({ chart: value, queryRows: [{ category: 'A', value: 2 }], workflow: workflow(value), version });
    assert.ok(result.diagnostics.some((item) => item.code === 'missing-boxplot-statistics'));
});

test('all-null groups keep facet members through explicit empty rows without invented statistics', async () => {
    const value = chart();
    const result = prepare(value, Array.from({ length: 100 }, (_, id) => ({ category: 'No sample', value: null, id })));
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0][result.boxplot!.roleColumn], 'empty');
    assert.equal(result.records[0].value, null);
    const adapted = adaptChartToRenderPlan(value, { columns: result.columns, fieldColumns: result.fieldColumns, boxplot: result.boxplot });
    assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
    const source = createPreparedDataSource({ version, plan: adapted.plan, records: result.records, getDatumKey: result.getDatumKey });
    const manifest = await source.describe(new AbortController().signal);
    assert.equal(manifest.columnLeafCount, 1);
    assert.equal(manifest.rowLeafCount, 1);
});
