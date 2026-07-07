jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { IMutField, TerseSpec, TerseSpecSchemaUrl } from '../interfaces';
import { detectSpecKind, normalize } from './normalize';
import { expandTerse, parseShorthand, projectTerse, terseComputedFid } from './terse';
import { chartToWorkflow } from '../utils/workflow';
import { COUNT_FIELD_ID } from '../constants';

const META: IMutField[] = [
    { fid: 'region', name: 'Region', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'segment', name: 'Segment', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'order_date', name: 'Order Date', semanticType: 'temporal', analyticType: 'dimension' },
    { fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' },
    { fid: 'profit', name: 'Profit', semanticType: 'quantitative', analyticType: 'measure' },
];

const silent = () => void 0;

describe('parseShorthand', () => {
    test('valid aggregate prefixes parse', () => {
        expect(parseShorthand('sum(Sales)')).toEqual({ field: 'Sales', aggregate: 'sum' });
        expect(parseShorthand('distinctCount(Region)')).toEqual({ field: 'Region', aggregate: 'distinctCount' });
        expect(parseShorthand('count()')).toEqual({ field: '', aggregate: 'count' });
    });
    test('non-aggregate prefixes are plain field names', () => {
        expect(parseShorthand('log(x)')).toEqual({ field: 'log(x)' });
        expect(parseShorthand('expr(a)')).toEqual({ field: 'expr(a)' });
        expect(parseShorthand('Sales')).toEqual({ field: 'Sales' });
    });
    test('nested parens keep the inner ref intact', () => {
        expect(parseShorthand('sum(Price (USD))')).toEqual({ field: 'Price (USD)', aggregate: 'sum' });
    });
});

describe('field resolution', () => {
    test('resolves by exact name, fid, and fid: prefix', () => {
        const chart = normalize({ x: 'Region', y: ['fid:sales', 'profit'] } as TerseSpec, META);
        expect(chart.encodings.columns.map((f) => f.fid)).toEqual(['region']);
        expect(chart.encodings.rows.map((f) => f.fid)).toEqual(['sales', 'profit']);
    });
    test('case-insensitive unique fallback warns but resolves', () => {
        const warnings: string[] = [];
        // 'REGION' matches neither a name nor a fid exactly, so it exercises the fallback;
        // lowercase 'region' would hit the exact-fid rule first (by design).
        const partial = expandTerse({ x: 'REGION' } as TerseSpec, META, (m) => warnings.push(m));
        expect(partial.encodings?.columns?.[0].fid).toBe('region');
        expect(warnings.some((w) => w.includes('case-insensitively'))).toBe(true);
    });
    test('unknown field errors with nearest candidates', () => {
        expect(() => expandTerse({ x: 'Salez' } as TerseSpec, META, silent)).toThrow(/Nearest candidates: \[Sales/);
    });
    test('duplicate names demand a fid: prefix', () => {
        const dupMeta: IMutField[] = [
            { fid: 'a1', name: 'Amount', semanticType: 'quantitative', analyticType: 'measure' },
            { fid: 'a2', name: 'Amount', semanticType: 'quantitative', analyticType: 'measure' },
        ];
        expect(() => expandTerse({ y: 'Amount' } as TerseSpec, dupMeta, silent)).toThrow(/ambiguous.*fid/s);
        const partial = expandTerse({ y: 'fid:a2' } as TerseSpec, dupMeta, silent);
        expect(partial.encodings?.rows?.[0].fid).toBe('a2');
    });
    test('a field literally named like a shorthand wins over the shorthand reading', () => {
        const trickyMeta: IMutField[] = [...META, { fid: 'weird', name: 'sum(Sales)', semanticType: 'quantitative', analyticType: 'measure' }];
        const warnings: string[] = [];
        const partial = expandTerse({ y: 'sum(Sales)' } as TerseSpec, trickyMeta, (m) => warnings.push(m));
        expect(partial.encodings?.rows?.[0].fid).toBe('weird');
        expect(warnings.some((w) => w.includes('literally named'))).toBe(true);
    });
    test('count() maps to the built-in count field', () => {
        const chart = normalize({ x: 'Region', y: 'count()' } as TerseSpec, META);
        expect(chart.encodings.rows[0].fid).toBe(COUNT_FIELD_ID);
    });
});

describe('expandTerse', () => {
    test('minimal spec expands to a complete canonical chart', () => {
        const chart = normalize({ x: 'Region', y: 'sum(Sales)' } as TerseSpec, META);
        expect(chart.encodings.columns[0]).toMatchObject({ fid: 'region', analyticType: 'dimension' });
        expect(chart.encodings.rows[0]).toMatchObject({ fid: 'sales', aggName: 'sum', analyticType: 'measure' });
        expect(chart.config.geoms).toEqual(['auto']);
        expect(chart.config.defaultAggregated).toBe(true);
        // pools rebuilt from meta: all fields + count + virtual fields
        expect(chart.encodings.dimensions.map((f) => f.fid)).toContain('region');
        expect(chart.encodings.measures.map((f) => f.fid)).toContain(COUNT_FIELD_ID);
    });

    test('knobs map to config/layout and canonical fragments win with a warning', () => {
        const warnings: string[] = [];
        const partial = expandTerse({ mark: 'bar', aggregate: false, stack: 'normalize', limit: 5, config: { geoms: ['line'] } } as TerseSpec, META, (m) =>
            warnings.push(m),
        );
        expect(partial.config?.geoms).toEqual(['line']);
        expect(partial.config?.defaultAggregated).toBe(false);
        expect(partial.config?.limit).toBe(5);
        expect(partial.layout?.stack).toBe('normalize');
        expect(warnings.some((w) => w.includes("Both 'mark' and canonical"))).toBe(true);
    });

    test('sort knob lands on the last y measure', () => {
        const chart = normalize({ x: 'Region', y: ['sum(Sales)', 'mean(Profit)'], sort: 'descending' } as TerseSpec, META);
        expect(chart.encodings.rows[0].sort).toBeUndefined();
        expect(chart.encodings.rows[1].sort).toBe('descending');
    });

    test('object refs carry sort and timeUnit overrides', () => {
        const chart = normalize(
            { x: { field: 'Order Date', timeUnit: 'month' }, y: { field: 'Sales', aggregate: 'mean', sort: 'ascending' } } as TerseSpec,
            META,
        );
        expect(chart.encodings.columns[0].timeUnit).toBe('month');
        expect(chart.encodings.rows[0]).toMatchObject({ aggName: 'mean', sort: 'ascending' });
    });

    test('filters expand to IFilterField rules', () => {
        const chart = normalize(
            {
                x: 'Region',
                y: 'sum(Sales)',
                filters: [
                    { field: 'Segment', oneOf: ['A', 'B'] },
                    { field: 'Profit', range: [0, 100] },
                    { field: 'Order Date', timeRange: [1704067200000, null] },
                ],
            } as TerseSpec,
            META,
        );
        expect(chart.encodings.filters.map((f) => f.rule)).toEqual([
            { type: 'one of', value: ['A', 'B'] },
            { type: 'range', value: [0, 100] },
            { type: 'temporal range', value: [1704067200000, null] },
        ]);
    });

    test('computed fields mirror store action semantics', () => {
        const chart = normalize(
            {
                computed: [
                    { name: 'Net Sales', expr: '"Sales" * 0.85' },
                    { name: 'Sales Bucket', bin: { field: 'Sales', count: 4 } },
                    { name: 'Log Profit', log: { field: 'Profit', base: 2 } },
                ],
                x: 'Sales Bucket',
                y: 'sum(Net Sales)',
                color: 'Log Profit',
            } as TerseSpec,
            META,
        );
        const bucket = chart.encodings.columns[0];
        expect(bucket).toMatchObject({ semanticType: 'ordinal', analyticType: 'dimension', computed: true });
        expect(bucket.expression).toMatchObject({ op: 'bin', num: 4, params: [{ type: 'field', value: 'sales' }] });
        const net = chart.encodings.rows[0];
        expect(net).toMatchObject({ analyticType: 'measure', aggName: 'sum', computed: true });
        expect(net.expression).toMatchObject({ op: 'expr', params: [{ type: 'sql', value: '"Sales" * 0.85' }] });
        const log = chart.encodings.color[0];
        expect(log.expression).toMatchObject({ op: 'log2', num: 2 });
        // deterministic fids
        expect(bucket.fid).toBe(terseComputedFid('Sales Bucket'));
        expect(
            normalize({ computed: [{ name: 'Sales Bucket', bin: { field: 'Sales', count: 4 } }], x: 'Sales Bucket' } as TerseSpec, META).encodings.columns[0]
                .fid,
        ).toBe(bucket.fid);
    });

    test('aggregate SQL expressions get aggName expr', () => {
        const chart = normalize({ computed: [{ name: 'Ratio', expr: 'sum("Sales") / sum("Profit")' }], y: 'Ratio' } as TerseSpec, META);
        expect(chart.encodings.rows[0].aggName).toBe('expr');
    });

    test('conflicting duplicate computed names error, identical ones dedupe', () => {
        expect(() =>
            expandTerse(
                {
                    computed: [
                        { name: 'X', expr: '"Sales" + 1' },
                        { name: 'X', expr: '"Sales" + 2' },
                    ],
                } as TerseSpec,
                META,
                silent,
            ),
        ).toThrow(/defined twice/);
        const partial = expandTerse(
            {
                computed: [
                    { name: 'X', expr: '"Sales" + 1' },
                    { name: 'X', expr: '"Sales" + 1' },
                ],
                y: 'X',
            } as TerseSpec,
            META,
            silent,
        );
        expect(partial.encodings?.measures?.filter((f) => f.name === 'X')).toHaveLength(1);
    });

    test('invalid definitions error clearly', () => {
        expect(() => expandTerse({ computed: [{ name: 'Bad', expr: 'sum((' }] } as TerseSpec, META, silent)).toThrow(/invalid expression/);
        expect(() => expandTerse({ computed: [{ name: 'Bad' }] } as TerseSpec, META, silent)).toThrow(/exactly one of/);
        expect(() => expandTerse({ y: 'sum()' } as TerseSpec, META, silent)).toThrow(/needs a field/);
        expect(() => expandTerse({ filters: [{ field: 'Region' } as any] } as TerseSpec, META, silent)).toThrow(/must define one of/);
    });
});

describe('normalize integration', () => {
    test('detectSpecKind routes terse correctly, including the layout escape hatch', () => {
        expect(detectSpecKind({ x: 'Region' })).toBe('terse');
        expect(detectSpecKind({ $schema: TerseSpecSchemaUrl })).toBe('terse');
        expect(detectSpecKind({ x: 'Region', mark: 'bar' })).toBe('terse');
        expect(detectSpecKind({ x: 'Region', layout: { stack: 'none' } })).toBe('terse');
        // unchanged existing routes
        expect(detectSpecKind({ mark: 'bar' })).toBe('vega-lite');
        expect(detectSpecKind({ mark: 'bar', encoding: {} })).toBe('vega-lite');
        expect(detectSpecKind({ layout: {} })).toBe('chart');
        expect(detectSpecKind({ encodings: { rows: [] } })).toBe('partial-chart');
    });

    test('terse normalize output is canonical, stamped, idempotent, and feeds toWorkflow', () => {
        const terse: TerseSpec = { mark: 'bar', x: 'Region', y: 'sum(Sales)', filters: [{ field: 'Segment', oneOf: ['A'] }] };
        const once = normalize(terse, META);
        expect(once.$schema).toBeDefined();
        expect(Object.keys(once.encodings)).toHaveLength(16);
        expect(normalize(once, META)).toEqual(once);
        expect(Array.isArray(chartToWorkflow(once).workflow)).toBe(true);
    });
});

describe('projectTerse', () => {
    const roundtrip = (t: TerseSpec) => {
        const canonical = normalize(t, META);
        const projected = projectTerse(canonical, silent);
        return { canonical, projected, reNormalized: normalize(projected, META) };
    };

    test('roundtrip standard: normalize(project(normalize(t))) equals normalize(t)', () => {
        const cases: TerseSpec[] = [
            { x: 'Region', y: 'sum(Sales)' },
            { mark: 'bar', x: 'Region', y: ['sum(Sales)', 'mean(Profit)'], color: 'Segment', stack: 'normalize', limit: 20 },
            { x: { field: 'Order Date', timeUnit: 'month' }, y: { field: 'Sales', aggregate: 'mean', sort: 'ascending' }, aggregate: true },
            {
                computed: [
                    { name: 'Net', expr: '"Sales" * 0.85' },
                    { name: 'Bucket', bin: { field: 'Sales', count: 6 } },
                ],
                x: 'Bucket',
                y: 'sum(Net)',
            },
            { x: 'Region', y: 'count()', filters: [{ field: 'Profit', range: [0, null] }], aggregate: false },
            { x: 'Region', y: 'sum(Sales)', config: { coordSystem: 'generic', folds: ['sales'] }, layout: { background: '#fff' } },
        ];
        for (const t of cases) {
            const { canonical, reNormalized } = roundtrip(t);
            const stripVisId = ({ visId, ...rest }: Record<string, unknown>) => rest;
            expect(stripVisId(reNormalized as never)).toEqual(stripVisId(canonical as never));
        }
    });

    test('projection drops pool fields not referenced by any channel', () => {
        const { projected } = roundtrip({ x: 'Region', y: 'sum(Sales)' });
        const flat = JSON.stringify(projected);
        expect(flat).not.toContain('Profit');
        expect(flat).not.toContain('Segment');
        expect(projected.computed).toBeUndefined();
    });

    test('projection emits shorthand and knobs, not canonical noise', () => {
        const { projected } = roundtrip({ mark: 'bar', x: 'Region', y: 'sum(Sales)', stack: 'center', limit: 10, aggregate: false });
        expect(projected.y).toBe('sum(Sales)');
        expect(projected.x).toBe('Region');
        expect(projected.mark).toBe('bar');
        expect(projected.stack).toBe('center');
        expect(projected.limit).toBe(10);
        expect(projected.aggregate).toBe(false);
    });

    test('inexpressible pieces are skipped with warnings', () => {
        const warnings: string[] = [];
        const canonical = normalize({ x: 'Region', y: 'sum(Sales)' } as TerseSpec, META);
        const doctored = {
            ...canonical,
            encodings: {
                ...canonical.encodings,
                color: [
                    {
                        fid: 'gw_bc1',
                        name: 'bucket',
                        semanticType: 'ordinal' as const,
                        analyticType: 'dimension' as const,
                        computed: true,
                        expression: { op: 'binCount' as const, as: 'gw_bc1', params: [{ type: 'field' as const, value: 'sales' }] },
                    },
                ],
                filters: [
                    {
                        fid: 'region',
                        name: 'Region',
                        semanticType: 'nominal' as const,
                        analyticType: 'dimension' as const,
                        rule: { type: 'regexp' as const, value: '^a' },
                    },
                ],
            },
        };
        const projected = projectTerse(doctored, (m) => warnings.push(m));
        expect(projected.color).toBeUndefined();
        expect(projected.filters).toBeUndefined();
        expect(warnings.some((w) => w.includes('binCount'))).toBe(true);
        expect(warnings.some((w) => w.includes('regexp'))).toBe(true);
    });

    test('dateTimeDrill computed fields project as timeUnit refs', () => {
        const canonical = normalize({ x: { field: 'Order Date', timeUnit: 'month' }, y: 'sum(Sales)' } as TerseSpec, META);
        const projected = projectTerse(canonical, silent);
        expect(projected.x).toEqual({ field: 'Order Date', timeUnit: 'month' });
    });

    test('duplicate pool names fall back to fid: refs', () => {
        const dupMeta: IMutField[] = [
            { fid: 'a1', name: 'Amount', semanticType: 'quantitative', analyticType: 'measure' },
            { fid: 'a2', name: 'Amount', semanticType: 'quantitative', analyticType: 'measure' },
        ];
        const canonical = normalize({ y: 'fid:a2' } as TerseSpec, dupMeta);
        const projected = projectTerse(canonical, silent);
        expect(projected.y).toBe('sum(fid:a2)');
        expect(normalize(projected, dupMeta).encodings.rows[0].fid).toBe('a2');
    });
});
