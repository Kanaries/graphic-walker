import assert from 'node:assert/strict';
import test from 'node:test';
import type { IChart, IRow, IViewField } from '../../graphic-walker/src/interfaces';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
import { prepareNativeResults } from '../../graphic-walker/src/lib/native/results';
import { nativeTheme } from '../../graphic-walker/src/lib/native/theme';
import { queryView } from '../../graphic-walker/src/lib/viewQuery';
import { VegaliteMapper, VegaLiteImportError } from '../../graphic-walker/src/lib/vl2gw';
import { specToWorkflow } from '../../graphic-walker/src/utils/workflow';
import { createPreparedDataSource } from '../src/core/prepared';

const dim = (fid: string, semanticType: IViewField['semanticType'] = 'nominal'): IViewField => ({ fid, name: fid, analyticType: 'dimension', semanticType });
const mea = (fid: string): IViewField => ({ fid, name: fid, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
const version = { sourceId: 'extended-marks', snapshotId: 'result-1', presentationId: 'view-1' };
function chart(mark: string, rows: IViewField[] = [], columns: IViewField[] = []): IChart {
    const value = createNestedChartFixture().chart;
    value.config.geoms = [mark];
    value.layout.renderer = 'native';
    value.encodings.rows = rows;
    value.encodings.columns = columns;
    value.encodings.dimensions = [...rows, ...columns].filter((field) => field.analyticType === 'dimension');
    value.encodings.measures = [...rows, ...columns].filter((field) => field.analyticType === 'measure');
    return value;
}
function prepare(value: IChart, queryRows: IRow[]) {
    return prepareNativeResults({ chart: value, queryRows, workflow: specToWorkflow(value).workflow, version });
}
function adapt(value: IChart, queryRows: IRow[]) {
    const prepared = prepare(value, queryRows);
    assert.deepEqual(prepared.diagnostics.filter((item) => item.severity === 'error'), []);
    const result = adaptChartToRenderPlan(value, { columns: prepared.columns, fieldColumns: prepared.fieldColumns, records: prepared.records });
    assert.ok(result.plan, JSON.stringify(result.diagnostics));
    return result.plan;
}

test('single-axis automatic ticks and explicit circle, area and trail use existing result columns', () => {
    const automatic = chart('auto', [], [mea('value')]);
    automatic.config.defaultAggregated = false;
    assert.equal(adapt(automatic, [{ value: 4 }, { value: 7 }]).mark, 'tick');
    const nominal = chart('auto', [], [dim('category')]);
    nominal.config.defaultAggregated = false;
    assert.equal(adapt(nominal, [{ category: 'A' }]).mark, 'tick');
    for (const mark of ['circle', 'area', 'trail']) {
        const value = chart(mark, [mea('value')], [dim('period', 'quantitative')]);
        const plan = adapt(value, [{ period: 1, value_sum: 4 }, { period: 2, value_sum: 7 }]);
        assert.equal(plan.mark, mark);
        if (mark !== 'circle') assert.equal(plan.lineProgression, 'x');
    }
});

test('arc shelves reach the existing aggregate workflow and remain separate nested panes', async () => {
    const region = dim('region'), category = dim('category'), year = dim('year'), segment = dim('segment'), value = mea('value');
    const spec = chart('arc', [region, category], [year]);
    spec.encodings.color = [segment];
    spec.encodings.theta = [value];
    spec.encodings.dimensions.push(segment);
    spec.encodings.measures.push(value);
    const workflow = specToWorkflow(spec).workflow;
    const queries = workflow.flatMap((step) => step.type === 'view' ? step.query : []);
    const aggregate = queries.find((query) => query.op === 'aggregate');
    assert.ok(aggregate?.op === 'aggregate');
    assert.deepEqual(new Set(aggregate.groupBy), new Set(['region', 'category', 'year', 'segment']));
    const raw = [
        { region: 'East', category: 'A', year: '2025', segment: 'one', value: 4 },
        { region: 'East', category: 'A', year: '2025', segment: 'one', value: 6 },
        { region: 'East', category: 'A', year: '2025', segment: 'two', value: 7 },
        { region: 'West', category: 'A', year: '2026', segment: 'one', value: 8 },
    ];
    const queryRows = queries.reduce((records, query) => queryView(records, query), raw as IRow[]);
    const prepared = prepare(spec, queryRows);
    const adapted = adaptChartToRenderPlan(spec, { columns: prepared.columns, fieldColumns: prepared.fieldColumns });
    assert.deepEqual(prepared.diagnostics, []);
    assert.ok(adapted.plan, JSON.stringify(adapted.diagnostics));
    assert.equal(adapted.plan.rows.facets.length, 2);
    assert.equal(adapted.plan.columns.facets.length, 1);
    assert.deepEqual(adapted.plan.rows.positions, []);
    assert.deepEqual(adapted.plan.columns.positions, []);
    const theta = adapted.plan.channels!.theta!;
    assert.ok('fieldRef' in theta);
    assert.equal(adapted.plan.bindings.find((binding) => binding.fieldRef === theta.fieldRef)?.columnKey, 'value_sum');
    assert.deepEqual(prepared.records.map((record) => record.value_sum), [10, 7, 8]);
    const source = createPreparedDataSource({ version, plan: adapted.plan, records: prepared.records, getDatumKey: prepared.getDatumKey });
    const manifest = await source.describe(new AbortController().signal);
    assert.equal(manifest.rowLeafCount, 2);
    assert.equal(manifest.columnLeafCount, 2);
    assert.equal(manifest.nonEmptyPaneCount, 2);
    assert.equal(manifest.recordCount, 3);
});

test('arc requires facet dimensions on shelves and an untransformed theta weight channel', () => {
    const invalid = chart('arc', [mea('value')]);
    invalid.encodings.theta = [mea('value')];
    const missingFacet = adaptChartToRenderPlan(invalid, { columns: [{ columnKey: 'value_sum', valueType: 'number' }] });
    assert.ok(missingFacet.diagnostics.some((item) => item.configRef === 'encodings.rows[0]'));
    const spec = chart('arc');
    spec.encodings.theta = [mea('value')];
    spec.encodings.color = [mea('value')];
    spec.layout.scale = { color: { domainMin: 0, domainMax: 20 } };
    const columns = [{ columnKey: 'value_sum', valueType: 'number' as const }];
    assert.ok(adaptChartToRenderPlan(spec, { columns }).plan, 'a color scale on the same source field is independent of theta');
    spec.layout.scale.theta = { domainMin: 0, domainMax: 20 };
    const result = adaptChartToRenderPlan(spec, { columns });
    assert.equal(result.plan, undefined);
    assert.ok(result.diagnostics.some((item) => item.configRef === 'scales.theta'));
});

test('normalized formats apply only to the value axis for both orientations and marks', () => {
    for (const mark of ['bar', 'area']) for (const horizontal of [false, true]) {
        const spec = chart(mark, horizontal ? [dim('category')] : [mea('value')], horizontal ? [mea('value')] : [dim('category')]);
        spec.layout.format = { numberFormat: ',.1f', normalizedNumberFormat: '.1%' };
        for (const stack of ['none', 'stack', 'normalize', 'center'] as const) {
            spec.layout.stack = stack;
            const plan = adapt(spec, [{ category: 'A', value_sum: 4 }]);
            assert.equal(plan.stack, stack === 'stack' ? 'zero' : stack);
            const valueRef = (horizontal ? plan.columns : plan.rows).positions[0];
            const categoryRef = (horizontal ? plan.rows : plan.columns).positions[0];
            assert.equal(plan.axes?.[valueRef].format, stack === 'normalize' ? '.1%' : ',.1f');
            assert.notEqual(plan.axes?.[categoryRef].format, '.1%');
        }
    }
});

test('inactive shape and text shelves do not demand results or invent marks', () => {
    const spec = chart('circle', [mea('value')], [dim('category')]);
    spec.encodings.shape = [dim('unusedShape')];
    spec.encodings.text = [mea('unusedLabel')];
    const prepared = prepareNativeResults({ chart: spec, queryRows: [{ category: 'A', value_sum: 4 }], workflow: [{ type: 'view', query: [{ op: 'aggregate', groupBy: ['category'], measures: [{ field: 'value', agg: 'sum', asFieldKey: 'value_sum' }] }] }], version });
    assert.deepEqual(prepared.diagnostics, []);
    const result = adaptChartToRenderPlan(spec, { columns: prepared.columns, fieldColumns: prepared.fieldColumns });
    assert.ok(result.plan, JSON.stringify(result.diagnostics));
    assert.equal(result.plan.channels?.shape, undefined);
    assert.equal(result.plan.channels?.text, undefined);
    assert.equal(result.plan.bindings.length, 2);
});

test('existing theme input supplies circle, tick, trail and donut sizes without a second chart specification', () => {
    const checks = [
        ['circle', { circle: { size: 100 } }, { pointSize: 100 }],
        ['tick', { tick: { bandSize: 12, thickness: 3 } }, { tickSize: 12, tickThickness: 3 }],
        ['trail', { trail: { size: 8 } }, { lineWidth: 8 }],
        ['arc', { arc: { innerRadius: 18, outerRadius: 55 } }, { arcInnerRadius: 18, arcOuterRadius: 55 }],
    ] as const;
    for (const [mark, config, expected] of checks) {
        const result = nativeTheme(chart(mark), config);
        assert.deepEqual(result.diagnostics, []);
        for (const [key, value] of Object.entries(expected)) assert.equal((result.theme.style as Record<string, unknown>)[key], value);
    }
});

test('Vega-Lite trail imports through the canonical chart while unpersistable donut style is explicit', () => {
    const fields = [dim('category'), mea('value')];
    const spec = VegaliteMapper({ mark: 'trail', encoding: { x: { field: 'category', type: 'nominal' }, y: { field: 'value', type: 'quantitative', aggregate: 'sum' } } }, fields, 'trail-import', 'Trail');
    assert.deepEqual(spec.config.geoms, ['trail']);
    assert.equal(adapt(spec, [{ category: 'A', value_sum: 4 }]).mark, 'trail');
    assert.throws(() => VegaliteMapper({ mark: { type: 'arc', innerRadius: 20 }, encoding: { theta: { field: 'value', type: 'quantitative' } } }, fields, 'donut-import', 'Donut'), (error: unknown) => error instanceof VegaLiteImportError && error.diagnostics.some((item) => item.configRef === 'mark.innerRadius'));
});


test('native polar shelves do not change legacy Vega or Plot query grain', () => {
    const spec = chart('arc', [dim('region')], [dim('year')]);
    spec.encodings.color = [dim('category')];
    spec.encodings.theta = [mea('value')];
    const groupBy = (renderer: 'native' | 'vega-lite' | 'observable-plot') => {
        const query = specToWorkflow({ ...spec, layout: { ...spec.layout, renderer } }).workflow.flatMap(step => step.type === 'view' ? step.query : []).find(query => query.op === 'aggregate');
        assert.ok(query && query.op === 'aggregate');
        return [...query.groupBy].sort();
    };
    assert.deepEqual(groupBy('native'), ['category', 'region', 'year']);
    assert.deepEqual(groupBy('vega-lite'), ['category']);
    assert.deepEqual(groupBy('observable-plot'), ['category']);
});
