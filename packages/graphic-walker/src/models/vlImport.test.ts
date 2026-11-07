jest.mock('nanoid', () => ({ nanoid: () => 'vl-fixture' }));
import type { IMutField } from '../interfaces';
import { normalize, detectSpecKind } from './normalize';
import { VegaliteMapper, VegaLiteImportError } from '../lib/vl2gw';
import { newChart, fromSnapshot, exportFullRaw, importFull } from './visSpecHistory';
import { chartToWorkflow } from '../utils/workflow';
import { MEA_KEY_ID, MEA_VAL_ID } from '../constants';
const meta: IMutField[] = [
    { fid: 'region', name: 'Region', analyticType: 'dimension', semanticType: 'nominal' },
    { fid: 'category', name: 'Category', analyticType: 'dimension', semanticType: 'nominal' },
    { fid: 'sales', name: 'Sales', analyticType: 'measure', semanticType: 'quantitative' },
    { fid: 'profit', name: 'Profit', analyticType: 'measure', semanticType: 'quantitative' },
    { fid: 'date', name: 'Date', analyticType: 'dimension', semanticType: 'temporal' },
];
const input = () => ({ mark: 'bar', encoding: { x: { field: 'Region', type: 'nominal' }, y: { field: 'Sales', type: 'quantitative', aggregate: 'sum' } } });
const all = () => {
    const chart = newChart(meta, '');
    return [...chart.encodings.dimensions, ...chart.encodings.measures];
};
function errorPaths(value: unknown) {
    try {
        normalize(value as any, meta);
        throw new Error('Expected an import diagnostic');
    } catch (error) {
        expect(error).toBeInstanceOf(VegaLiteImportError);
        return (error as VegaLiteImportError).diagnostics.map((item) => item.configRef);
    }
}

test('fixed field, aggregation, static numeric scale and format fixture maps to existing IChart fields and survives persistence', () => {
    const value = {
        ...input(),
        title: 'Sales by region',
        width: 640,
        height: 320,
        background: '#fff',
        mark: { type: 'bar', color: '#246' },
        encoding: {
            ...input().encoding,
            y: { ...input().encoding.y, scale: { type: 'linear', domain: [0, 100], range: [0, 280], zero: false }, axis: { format: ',.1f' }, stack: null },
        },
    };
    const before = JSON.stringify(value),
        chart = normalize(value, meta);
    expect(chart.name).toBe('Sales by region');
    expect(chart.config.geoms).toEqual(['bar']);
    expect(chart.config.defaultAggregated).toBe(true);
    expect(chart.encodings.columns.map((field) => field.fid)).toEqual(['region']);
    expect(chart.encodings.rows[0]).toMatchObject({ fid: 'sales', aggName: 'sum' });
    expect(chart.layout).toMatchObject({
        primaryColor: '#246',
        background: '#fff',
        size: { mode: 'fixed', width: 640, height: 320 },
        stack: 'none',
        zeroScale: false,
        scale: { row: { type: 'linear', domainMin: 0, domainMax: 100, rangeMin: 0, rangeMax: 280 } },
        format: { numberFormat: ',.1f' },
    });
    const { $schema, ...persisted } = chart;
    expect(importFull(exportFullRaw(fromSnapshot(chart))).now).toEqual(JSON.parse(JSON.stringify(persisted)));
    expect(normalize(chart, meta)).toEqual(chart);
    expect(JSON.stringify(value)).toBe(before);
});

test('temporal format, text/detail channels, field semantic types are explicit conversions', () => {
    const chart = normalize(
        {
            mark: 'text',
            encoding: {
                x: { field: 'Date', type: 'temporal', axis: { format: '%Y-%m' } },
                y: { field: 'Category', type: 'ordinal' },
                text: { field: 'Sales', aggregate: 'mean', type: 'quantitative' },
                detail: [{ field: 'Region' }, { field: 'Category' }],
            },
        },
        meta,
    );
    expect(chart.config.geoms).toEqual(['text']);
    expect(chart.layout.format.timeFormat).toBe('%Y-%m');
    expect(chart.encodings.columns[0]).toMatchObject({ fid: 'date', semanticType: 'temporal' });
    expect(chart.encodings.rows[0]).toMatchObject({ fid: 'category', semanticType: 'ordinal' });
    expect(chart.encodings.text[0]).toMatchObject({ fid: 'sales', aggName: 'mean', analyticType: 'measure' });
    expect(chart.encodings.details.map((field) => field.fid)).toEqual(['region', 'category']);
});

test('supported filters remain conjunctive, preserve typed literal values and feed the existing workflow', () => {
    const chart = normalize(
        {
            ...input(),
            transform: [
                { filter: 'datum.Region === "East" && datum.Sales >= 0 && datum.Sales <= 100' },
                { filter: { field: 'Region', oneOf: ['East', 'West'] } },
                { filter: { field: 'Profit', range: [-10, 20] } },
                { filter: "datum.Category !== 'Paper'" },
            ],
        },
        meta,
    );
    expect(chart.encodings.filters.map((field) => [field.fid, field.rule])).toEqual([
        ['region', { type: 'one of', value: ['East'] }],
        ['sales', { type: 'range', value: [0, null] }],
        ['sales', { type: 'range', value: [null, 100] }],
        ['region', { type: 'one of', value: ['East', 'West'] }],
        ['profit', { type: 'range', value: [-10, 20] }],
        ['category', { type: 'not in', value: ['Paper'] }],
    ]);
    expect(chartToWorkflow(chart).workflow.length).toBeGreaterThan(0);
    expect(normalize({ ...chart, layout: { ...chart.layout, renderer: 'native' } }, meta).encodings.filters).toEqual(chart.encodings.filters);
});

test('existing default bin and fold conversions retain prepared-field definitions and stable branch fields', () => {
    const binned = normalize({ mark: 'bar', encoding: { x: { field: 'Sales', bin: true }, y: { aggregate: 'count', type: 'quantitative' } } }, meta);
    expect(binned.encodings.columns[0]).toMatchObject({
        computed: true,
        semanticType: 'ordinal',
        expression: { op: 'bin', params: [{ type: 'field', value: 'sales' }] },
    });
    expect(binned.encodings.rows[0]).toMatchObject({ fid: 'gw_count_fid', aggName: 'count' });
    const folded = normalize(
        {
            mark: 'line',
            transform: [{ fold: ['Sales', 'Profit'], as: ['Metric', 'Amount'] }],
            encoding: { x: { field: 'Region' }, y: { field: 'Amount', aggregate: 'sum', type: 'quantitative' }, color: { field: 'Metric', type: 'nominal' } },
        },
        meta,
    );
    expect(folded.config.folds).toEqual(['sales', 'profit']);
    expect(folded.encodings.rows[0].fid).toBe(MEA_VAL_ID);
    expect(folded.encodings.color[0].fid).toBe(MEA_KEY_ID);
    expect(chartToWorkflow(folded).workflow.length).toBeGreaterThan(0);
});

test('nested row/column facet conversion retains repeated field instances instead of deduplicating position roles', () => {
    const chart = normalize({ facet: { column: { field: 'Region' }, row: { field: 'Category' } }, spec: input() }, meta);
    expect(chart.encodings.columns.map((field) => field.fid)).toEqual(['region', 'region']);
    expect(chart.encodings.rows.map((field) => field.fid)).toEqual(['category', 'sales']);
});

test.each([
    [{ ...input(), transform: [{ calculate: 'datum.Sales * 2', as: 'Double' }] }, 'transform[0]'],
    [{ ...input(), transform: [{ window: [{ op: 'rank', as: 'Rank' }] }] }, 'transform[0]'],
    [{ ...input(), params: [{ name: 'brush', select: 'interval' }] }, 'params'],
    [{ ...input(), selection: { brush: { type: 'interval' } } }, 'selection'],
    [{ layer: [input(), input()] }, 'layer'],
    [{ concat: [input(), input()] }, 'concat'],
    [{ repeat: ['Sales'], spec: input() }, 'repeat'],
    [{ ...input(), encoding: { ...input().encoding, y: { ...input().encoding.y, axis: { labelExpr: 'datum.label + 1' } } } }, 'encoding.y.axis.labelExpr'],
    [
        { ...input(), encoding: { ...input().encoding, y: { ...input().encoding.y, axis: { title: 'Revenue', grid: false, tickCount: 4 } } } },
        'encoding.y.axis.title',
    ],
    [{ ...input(), encoding: { ...input().encoding, y: { ...input().encoding.y, axis: null } } }, 'encoding.y.axis'],
    [{ ...input(), encoding: { ...input().encoding, color: { value: 'red' } } }, 'encoding.color.value'],
    [
        { ...input(), encoding: { ...input().encoding, y: { ...input().encoding.y, scale: { domainRaw: { expr: 'selection' } } } } },
        'encoding.y.scale.domainRaw',
    ],
    [{ ...input(), encoding: { ...input().encoding, x: { field: 'Date', timeUnit: 'month' } } }, 'encoding.x.timeUnit'],
    [{ ...input(), encoding: { ...input().encoding, x: { field: 'Sales', bin: { maxbins: 12 } } } }, 'encoding.x.bin'],
    [{ ...input(), transform: [{ filter: 'datum.Region == "East" || datum.Region == "West"' }] }, 'transform[0].filter'],
    [{ ...input(), transform: [{ filter: 'datum.Sales > 0' }] }, 'transform[0].filter'],
    [{ ...input(), transform: [{ filter: { field: 'Sales', lt: 100 } }] }, 'transform[0].filter.lt'],
    [{ ...input(), encoding: { ...input().encoding, x: { field: 'Missing' } } }, 'encoding.x.field'],
    [{ ...input(), data: { values: [] } }, 'data'],
])('unsupported VL-like input reports the exact property instead of silently accepting it (%#)', (value, path) => {
    const before = JSON.stringify(value);
    expect(errorPaths(value)).toContain(path);
    expect(JSON.stringify(value)).toBe(before);
    expect(() => VegaliteMapper(value, all(), 'stable-vis', 'Previous chart')).toThrow(VegaLiteImportError);
});

test('standalone unsupported syntax is detected as VL-like, and conflicting global formats and zero overrides are rejected', () => {
    expect(detectSpecKind({ params: [] })).toBe('vega-lite');
    expect(detectSpecKind({ transform: [] })).toBe('vega-lite');
    expect(
        errorPaths({
            ...input(),
            encoding: { x: { field: 'Sales', axis: { format: '.0f' }, scale: { zero: false } }, y: { field: 'Profit', axis: { format: '.2f' } } },
        }),
    ).toEqual(expect.arrayContaining(['encoding.y.axis.format', 'encoding.x.scale.zero']));
});

test('VL domain/member ordering is rejected instead of becoming GW measure-driven ordering', () => {
    for (const channel of ['x', 'y', 'color', 'row', 'column']) {
        for (const sort of ['ascending', 'descending', null]) {
            const value = { ...input(), encoding: { ...input().encoding, [channel]: { field: 'Region', type: 'nominal', sort } } };
            expect(errorPaths(value)).toContain(`encoding.${channel}.sort`);
        }
    }
    expect(errorPaths({ facet: { row: { field: 'Region', sort: 'descending' } }, spec: input() })).toContain('facet.row.sort');
    expect(errorPaths({ ...input(), encoding: { ...input().encoding, order: { sort: 'descending' } } })).toContain('encoding.order');
});

test('direct VL mapper keeps its explicit title and existing visualization identity', () => {
    const chart = VegaliteMapper({ ...input(), title: 'Imported title' }, all(), 'stable-vis', 'Previous title');
    expect(chart.name).toBe('Imported title');
    expect(chart.visId).toBe('stable-vis');
});

test('fold cannot be silently ignored when either virtual output is not encoded in its required role', () => {
    const base = { mark: 'point', transform: [{ fold: ['Sales', 'Profit'] }] };
    for (const encoding of [
        { x: { field: 'Region' }, y: { field: 'value', type: 'quantitative' } },
        { x: { field: 'key', type: 'nominal' }, y: { field: 'Sales', type: 'quantitative' } },
        input().encoding,
        { x: { field: 'key', type: 'nominal' }, y: { field: 'value', type: 'nominal' } },
    ])
        expect(errorPaths({ ...base, encoding })).toContain('transform[0].fold');
});

test('VL coercing equality and colliding membership values are explicit import diagnostics', () => {
    for (const expression of ['datum.Region == 1', 'datum.Region != 1'])
        expect(errorPaths({ ...input(), transform: [{ filter: expression }] })).toContain('transform[0].filter');
    for (const value of [null, 'null', '[1,2]', '{"a":1}'])
        expect(errorPaths({ ...input(), transform: [{ filter: { field: 'Region', equal: value } }] })).toContain('transform[0].filter.equal');
    const chart = normalize(
        { ...input(), transform: [{ filter: 'datum.Region === 1' }, { filter: { field: 'Category', oneOf: ['1', 1, true, 'Paper'] } }] },
        meta,
    );
    expect(chart.encodings.filters[0].rule).toEqual({ type: 'one of', value: [1] });
    expect(chart.encodings.filters[1].rule).toEqual({ type: 'one of', value: ['1', 1, true, 'Paper'] });
});

test('fold does not accept source-column encodings that the existing legacy fold projection removes', () => {
    const value = {
        mark: 'text',
        transform: [{ fold: ['Sales', 'Profit'] }],
        encoding: {
            x: { field: 'key', type: 'nominal' },
            y: { field: 'value', type: 'quantitative' },
            text: { field: 'Sales', type: 'quantitative' },
        },
    };
    expect(errorPaths(value)).toContain('transform[0].fold');
});

test('a bin on a fold virtual output cannot be moved before the fold operation', () => {
    for (const field of ['key', 'value']) {
        const value = {
            mark: 'point',
            transform: [{ fold: ['Sales', 'Profit'] }],
            encoding: {
                x: { field, bin: true, type: 'quantitative' },
                y: { field: 'value', type: 'quantitative' },
                color: { field: 'key' },
            },
        };
        expect(errorPaths(value)).toContain('encoding.x.bin');
    }
});

test('every fold output occurrence must use its supported role and one effective value aggregation', () => {
    const common = { mark: 'point', transform: [{ fold: ['Sales', 'Profit'] }] };
    const base = { x: { field: 'key', type: 'nominal' }, y: { field: 'value', aggregate: 'sum', type: 'quantitative' } };
    for (const extra of [
        { text: { field: 'value', aggregate: 'mean', type: 'quantitative' } },
        { color: { field: 'value', type: 'nominal' } },
        { text: { field: 'key', aggregate: 'count', type: 'quantitative' } },
    ])
        expect(errorPaths({ ...common, encoding: { ...base, ...extra } })).toContain('transform[0].fold');
    const valid = normalize({ ...common, encoding: { ...base, text: { field: 'value', aggregate: 'sum', type: 'quantitative' } } }, meta);
    expect(valid.encodings.rows[0].aggName).toBe('sum');
    expect(valid.encodings.text[0].aggName).toBe('sum');
});
