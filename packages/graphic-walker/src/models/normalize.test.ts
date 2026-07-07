jest.mock('nanoid', () => ({ nanoid: () => 'mock-id' }));

import { IChart, IChartSchemaUrl, IMutField, IViewField } from '../interfaces';
import { detectSpecKind, normalize } from './normalize';
import { fillChart, parseChart } from './visSpecHistory';
import { chartToWorkflow } from '../utils/workflow';
import { VizSpecStore } from '../store/visualSpecStore';

const META: IMutField[] = [
    { fid: 'category', name: 'Category', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'region', name: 'Region', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'city', name: 'City', semanticType: 'nominal', analyticType: 'dimension' },
    { fid: 'sales', name: 'Sales', semanticType: 'quantitative', analyticType: 'measure' },
];

const dim = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' });
const mea = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });

const ALL_CHANNELS = [
    'dimensions',
    'measures',
    'rows',
    'columns',
    'color',
    'opacity',
    'size',
    'shape',
    'radius',
    'theta',
    'longitude',
    'latitude',
    'geoId',
    'details',
    'filters',
    'text',
] as const;

describe('detectSpecKind', () => {
    test('vega-lite by $schema url', () => {
        expect(detectSpecKind({ $schema: 'https://vega.github.io/schema/vega-lite/v5.json' })).toBe('vega-lite');
    });
    test('vega-lite by structural keys', () => {
        expect(detectSpecKind({ mark: 'bar' })).toBe('vega-lite');
        expect(detectSpecKind({ encoding: { x: { field: 'a' } } })).toBe('vega-lite');
        expect(detectSpecKind({ hconcat: [] })).toBe('vega-lite');
    });
    test('chart by layout key, including normalize output with gw $schema', () => {
        expect(detectSpecKind({ layout: {} })).toBe('chart');
        const stamped = normalize({}, META);
        expect(detectSpecKind(stamped)).toBe('chart');
    });
    test('vis-spec by legacy config keys', () => {
        expect(detectSpecKind({ visId: 'a', encodings: {}, config: { stack: 'stack' } })).toBe('vis-spec');
        expect(detectSpecKind({ visId: 'a', encodings: {}, config: { size: { mode: 'auto', width: 320, height: 200 } } })).toBe('vis-spec');
    });
    test('partial-chart for everything else', () => {
        expect(detectSpecKind({})).toBe('partial-chart');
        expect(detectSpecKind({ encodings: { rows: [] } })).toBe('partial-chart');
        expect(detectSpecKind({ visId: 'a', config: { geoms: ['bar'], defaultAggregated: true, limit: -1 } })).toBe('partial-chart');
    });
    test('rejects non-object input', () => {
        expect(() => detectSpecKind(null as any)).toThrow(TypeError);
        expect(() => detectSpecKind([] as any)).toThrow(TypeError);
    });
});

describe('normalize', () => {
    test('fills a partial chart into a complete canonical chart', () => {
        const result = normalize({ encodings: { columns: [dim('category')], rows: [mea('sales')] } }, META);
        for (const channel of ALL_CHANNELS) {
            expect(Array.isArray(result.encodings[channel])).toBe(true);
        }
        expect(result.visId).toBe('gw_mock-id');
        expect(result.name).toBe('Chart');
        expect(result.config).toEqual({ defaultAggregated: true, geoms: ['auto'], coordSystem: 'generic', limit: -1 });
        expect(result.layout.size).toEqual({ mode: 'auto', width: 320, height: 200 });
        expect(result.layout.renderer).toBe('vega-lite');
        expect(result.encodings.columns).toEqual([dim('category')]);
        expect(result.encodings.rows).toEqual([mea('sales')]);
        expect(result.$schema).toBe(IChartSchemaUrl);
    });

    test('preserves provided values over defaults', () => {
        const result = normalize(
            {
                visId: 'my-vis',
                name: 'My Chart',
                config: { geoms: ['line'], limit: 50 },
                layout: { stack: 'none', size: { mode: 'fixed', width: 800, height: 600 } },
            },
            META,
        );
        expect(result.visId).toBe('my-vis');
        expect(result.name).toBe('My Chart');
        expect(result.config.geoms).toEqual(['line']);
        expect(result.config.limit).toBe(50);
        expect(result.config.defaultAggregated).toBe(true);
        expect(result.layout.stack).toBe('none');
        expect(result.layout.size).toEqual({ mode: 'fixed', width: 800, height: 600 });
    });

    test('migrates the deprecated IVisSpec format', () => {
        const legacy = {
            visId: 'legacy-1',
            name: 'Legacy',
            encodings: {
                dimensions: [dim('category')],
                measures: [mea('sales')],
                rows: [mea('sales')],
                columns: [dim('category')],
            },
            config: {
                defaultAggregated: true,
                geoms: ['bar'],
                stack: 'normalize',
                showTableSummary: true,
                size: { mode: 'fixed', width: 640, height: 480 },
                background: '#fff',
                limit: 25,
            },
        };
        const result = normalize(legacy as any, META);
        expect(result.config.geoms).toEqual(['bar']);
        expect(result.config.limit).toBe(25);
        expect(result.layout.stack).toBe('normalize');
        expect(result.layout.showTableSummary).toBe(true);
        expect(result.layout.background).toBe('#fff');
        expect(result.layout.size).toEqual({ mode: 'fixed', width: 640, height: 480 });
        for (const channel of ALL_CHANNELS) {
            expect(Array.isArray(result.encodings[channel])).toBe(true);
        }
        expect(result.$schema).toBe(IChartSchemaUrl);
    });

    test('maps a Vega-Lite spec through VegaliteMapper', () => {
        const vl = {
            mark: 'bar',
            title: 'VL Chart',
            encoding: {
                x: { field: 'Category', type: 'nominal' },
                y: { field: 'Sales', type: 'quantitative', aggregate: 'sum' },
            },
        };
        const result = normalize(vl, META);
        expect(result.config.geoms).toEqual(['bar']);
        expect(result.name).toBe('VL Chart');
        expect(result.encodings.columns.map((f) => f.fid)).toEqual(['category']);
        expect(result.encodings.rows.map((f) => f.fid)).toEqual(['sales']);
        expect(result.encodings.rows[0].aggName).toBe('sum');
        expect(result.$schema).toBe(IChartSchemaUrl);
    });

    test('applies algebraLint: dimensions first, at most 2 cross dimensions for non-table geoms', () => {
        const result = normalize(
            {
                config: { geoms: ['bar'], defaultAggregated: true, limit: -1 },
                encodings: { rows: [mea('sales'), dim('category'), dim('region'), dim('city')] },
            },
            META,
        );
        expect(result.encodings.rows.map((f) => f.fid)).toEqual(['category', 'region', 'sales']);
    });

    test('algebraLint keeps all dimensions for table geom', () => {
        const result = normalize(
            {
                config: { geoms: ['table'], defaultAggregated: true, limit: -1 },
                encodings: { rows: [dim('category'), dim('region'), dim('city')] },
            },
            META,
        );
        expect(result.encodings.rows.map((f) => f.fid)).toEqual(['category', 'region', 'city']);
    });

    test('is idempotent for all input kinds', () => {
        const inputs = [
            { encodings: { columns: [dim('category')], rows: [mea('sales'), dim('region')] } },
            {
                visId: 'legacy-2',
                encodings: { dimensions: [dim('category')], rows: [mea('sales')] },
                config: { defaultAggregated: false, geoms: ['line'], stack: 'stack', limit: -1 },
            },
            { mark: 'bar', encoding: { x: { field: 'Category' }, y: { field: 'Sales', aggregate: 'sum' } } },
        ];
        for (const input of inputs) {
            const once = normalize(input as any, META);
            const twice = normalize(once, META);
            expect(twice).toEqual(once);
        }
    });

    test('does not mutate its input', () => {
        const input = {
            visId: 'immutable',
            encodings: { rows: [mea('sales'), dim('category'), dim('region'), dim('city')] },
            config: { geoms: ['bar'], defaultAggregated: true, limit: -1 },
        };
        const snapshot = JSON.parse(JSON.stringify(input));
        normalize(input, META);
        expect(input).toEqual(snapshot);
    });
});

describe('$schema forward compatibility', () => {
    const stamped = normalize(
        {
            visId: 'fc-1',
            encodings: { columns: [dim('category')], rows: [mea('sales')], filters: [] },
            config: { geoms: ['bar'], defaultAggregated: true, limit: 10 },
        },
        META,
    );
    const unstamped: IChart = (({ $schema, ...rest }) => rest)(stamped) as IChart;

    test('parseChart passes a stamped chart through unchanged', () => {
        expect(parseChart(stamped)).toBe(stamped);
    });

    test('fillChart strips $schema and keeps everything else', () => {
        const filled = fillChart(stamped);
        expect('$schema' in filled).toBe(false);
        expect(filled).toEqual(unstamped);
    });

    test('chartToWorkflow output is identical with and without the stamp', () => {
        const withStamp = chartToWorkflow(stamped);
        const withoutStamp = chartToWorkflow(unstamped);
        expect(withStamp).toEqual(withoutStamp);
        expect(withStamp.workflow.length).toBeGreaterThan(0);
    });

    test('store import/export round trip does not persist the stamp', () => {
        const store = new VizSpecStore(META, { empty: true });
        store.importCode([stamped]);
        const exported = store.exportCode();
        expect(exported).toHaveLength(1);
        expect('$schema' in exported[0]).toBe(false);
        expect(JSON.stringify(exported)).not.toContain('$schema');
        expect(exported[0]).toEqual(unstamped);
    });

    test('normalize does not stamp charts that skip it: exportCode output shape is unchanged', () => {
        const store = new VizSpecStore(META);
        const exported = store.exportCode();
        expect(JSON.stringify(exported)).not.toContain('$schema');
    });
});
