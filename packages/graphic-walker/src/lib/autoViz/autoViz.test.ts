import { DraggableFieldState, IChart, ISemanticType, IViewField } from '../../interfaces';
import { GLOBAL_CONFIG } from '../../config';
import { COUNT_FIELD_ID } from '../../constants';
import { viewEncodingKeys } from '../../models/visSpec';
import { recommend, IAutoVizItem, IAutoVizChartType } from './index';

const dim = (fid: string, semanticType: ISemanticType = 'nominal', extra: Partial<IViewField> = {}): IViewField => ({
    fid,
    name: fid,
    analyticType: 'dimension',
    semanticType,
    ...extra,
});

const mea = (fid: string, extra: Partial<IViewField> = {}): IViewField => ({
    fid,
    name: fid,
    analyticType: 'measure',
    semanticType: 'quantitative',
    aggName: 'sum',
    ...extra,
});

const category = dim('category');
const subcategory = dim('subcategory');
const level = dim('level', 'ordinal');
const orderDate = dim('orderDate', 'temporal');
const sales = mea('sales');
const profit = mea('profit');
const discount = mea('discount');
const quantity = mea('quantity');
const tax = mea('tax');
const lon = mea('lon', { geoRole: 'longitude' });
const lat = mea('lat', { geoRole: 'latitude' });
const countMea = mea(COUNT_FIELD_ID, { computed: true, expression: { op: 'one', params: [], as: COUNT_FIELD_ID } });

const ALL_FIELDS = [category, subcategory, level, orderDate, sales, profit, discount, quantity, tax, lon, lat, countMea];

const VIEW_CHANNEL_KEYS: Exclude<keyof DraggableFieldState, 'dimensions' | 'measures' | 'filters'>[] = [
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
    'text',
];

const item = (result: ReturnType<typeof recommend>, chartType: IAutoVizChartType): IAutoVizItem =>
    result.items.find((x) => x.chartType === chartType)!;

const viewFids = (chart: IChart): Set<string> => {
    const fids = new Set<string>();
    for (const key of VIEW_CHANNEL_KEYS) {
        for (const f of chart.encodings[key]) {
            fids.add(f.fid);
            // a computed field (e.g. bin) also encodes the fields it derives from
            f.expression?.params.forEach((p) => {
                if (p.type === 'field') fids.add(p.value);
            });
        }
    }
    return fids;
};

describe('expressiveness filter', () => {
    test('pure dimensions: only table-family charts remain, table is default', () => {
        const result = recommend({ fields: [category, subcategory], allFields: ALL_FIELDS });
        expect(result.defaultItem?.chartType).toBe('table');
        expect(item(result, 'bar').available).toBe(false);
        expect(item(result, 'bar').reason).toBe('need_measure');
        expect(item(result, 'scatter').available).toBe(false);
        expect(item(result, 'scatter').reason).toBe('need_two_measures');
        expect(item(result, 'heatmap').available).toBe(true);
    });

    test('no temporal or ordinal dimension disables line and area', () => {
        const result = recommend({ fields: [category, sales], allFields: ALL_FIELDS });
        expect(item(result, 'line').available).toBe(false);
        expect(item(result, 'line').reason).toBe('need_temporal_or_ordinal');
        expect(item(result, 'area').available).toBe(false);
        expect(item(result, 'area').reason).toBe('need_temporal');
    });

    test('ordinal dimension enables line but not area', () => {
        const result = recommend({ fields: [level, sales], allFields: ALL_FIELDS });
        expect(item(result, 'line').available).toBe(true);
        expect(item(result, 'area').available).toBe(false);
    });

    test('scatter needs 2–4 measures', () => {
        const one = recommend({ fields: [sales], allFields: ALL_FIELDS });
        expect(item(one, 'scatter').reason).toBe('need_two_measures');
        const five = recommend({ fields: [sales, profit, discount, quantity, tax], allFields: ALL_FIELDS });
        expect(item(five, 'scatter').reason).toBe('too_many_measures');
    });

    test('histogram rejects dimensions, extra measures and the row-count field', () => {
        expect(item(recommend({ fields: [category, sales], allFields: ALL_FIELDS }), 'histogram').reason).toBe('too_many_dimensions');
        expect(item(recommend({ fields: [sales, profit], allFields: ALL_FIELDS }), 'histogram').reason).toBe('need_single_measure');
        expect(item(recommend({ fields: [countMea], allFields: ALL_FIELDS }), 'histogram').reason).toBe('need_raw_measure');
    });

    test('maps are gated by geo fields and geo feature', () => {
        const noGeo = recommend({ fields: [category, sales], allFields: ALL_FIELDS });
        expect(item(noGeo, 'poi_map').reason).toBe('need_lon_lat');
        expect(item(noGeo, 'choropleth_map').reason).toBe('need_geo_feature');
        const withFeature = recommend({ fields: [category, sales], allFields: ALL_FIELDS, geoFeatureReady: true });
        expect(item(withFeature, 'choropleth_map').available).toBe(true);
    });

    test('empty selection without allFields disables everything', () => {
        const result = recommend({ fields: [] });
        expect(result.defaultItem).toBeNull();
        expect(result.items.every((x) => !x.available && x.reason === 'need_fields')).toBe(true);
    });
});

describe('effectiveness ranking (default chart)', () => {
    const cases: [string, IViewField[], IAutoVizChartType][] = [
        ['category + measure → bar', [category, sales], 'bar'],
        ['temporal + measure → line', [orderDate, sales], 'line'],
        ['two measures → scatter', [sales, profit], 'scatter'],
        ['single raw measure → histogram', [sales], 'histogram'],
        ['pure dimensions → table', [category, subcategory], 'table'],
        ['lon/lat pair → poi map', [lon, lat], 'poi_map'],
        ['lon/lat + measure → poi map', [lon, lat, sales], 'poi_map'],
    ];
    test.each(cases)('%s', (_name, fields, expected) => {
        const result = recommend({ fields, allFields: ALL_FIELDS });
        expect(result.defaultItem?.chartType).toBe(expected);
    });
});

describe('spec validity of every available recommendation', () => {
    const selections: IViewField[][] = [
        [category, sales],
        [category, subcategory, sales],
        [category, subcategory, level, sales, profit],
        [orderDate, sales],
        [orderDate, category, sales, profit],
        [sales, profit],
        [sales, profit, discount, quantity],
        [sales],
        [category],
        [category, subcategory],
        [lon, lat, sales, category],
    ];

    test.each(selections.map((s): [string, IViewField[]] => [s.map((f) => f.fid).join(','), s]))(
        'selection [%s]',
        (_name, fields) => {
            const result = recommend({ fields, allFields: ALL_FIELDS, geoFeatureReady: true });
            const available = result.items.filter((x) => x.available);
            expect(available.length).toBeGreaterThan(0);
            for (const rec of available) {
                const chart = rec.chart!;
                const geom = chart.config.geoms[0];
                const legalKeys = new Set<string>(viewEncodingKeys(geom));
                const encoded = viewFids(chart);

                // expressiveness: every selected field is encoded, nothing is dropped
                for (const f of fields) {
                    expect(encoded).toContain(f.fid);
                }
                // channels stay within what the geom supports and per-channel limits
                for (const key of VIEW_CHANNEL_KEYS) {
                    const bucket = chart.encodings[key];
                    if (bucket.length > 0) {
                        expect(legalKeys).toContain(key);
                    }
                    const limit = GLOBAL_CONFIG.CHANNEL_LIMIT[key as keyof typeof GLOBAL_CONFIG.CHANNEL_LIMIT];
                    if (limit !== undefined && limit !== Infinity) {
                        expect(bucket.length).toBeLessThanOrEqual(limit);
                    }
                }
                // field shelves are fully inherited: applying never loses dataset fields
                const shelfFids = new Set(chart.encodings.dimensions.concat(chart.encodings.measures).map((x) => x.fid));
                for (const f of ALL_FIELDS) {
                    expect(shelfFids).toContain(f.fid);
                }
                // aggregated views only put aggregator-carrying measures on shelves
                if (chart.config.defaultAggregated) {
                    for (const key of VIEW_CHANNEL_KEYS) {
                        for (const f of chart.encodings[key]) {
                            if (f.analyticType === 'measure') {
                                expect(f.aggName).toBeTruthy();
                            }
                        }
                    }
                }
            }
        }
    );
});

describe('base chart inheritance', () => {
    const base: IChart = {
        visId: 'vis-1',
        name: 'My Chart',
        encodings: {
            dimensions: [category, subcategory, level, orderDate].map((x) => ({ ...x })),
            measures: [sales, profit, countMea].map((x) => ({ ...x })),
            filters: [{ ...category, rule: { type: 'one of', value: ['A'] } }],
            rows: [{ ...sales }],
            columns: [{ ...category }],
            color: [],
            opacity: [],
            size: [],
            shape: [],
            radius: [],
            theta: [],
            longitude: [],
            latitude: [],
            geoId: [],
            details: [],
            text: [],
        },
        config: { defaultAggregated: true, geoms: ['bar'], coordSystem: 'generic', limit: -1, timezoneDisplayOffset: 480 },
        layout: {
            showTableSummary: false,
            format: { numberFormat: ',.2f' },
            primaryColor: '#123456',
            resolve: {},
            size: { mode: 'auto', width: 320, height: 200 },
            interactiveScale: false,
            stack: 'stack',
            showActions: false,
            zeroScale: true,
        },
    };

    test('keeps identity, filters, config extras and layout preferences', () => {
        const result = recommend({ fields: [orderDate, sales], base });
        const line = item(result, 'line');
        expect(line.isDefault).toBe(true);
        const chart = line.chart!;
        expect(chart.visId).toBe('vis-1');
        expect(chart.name).toBe('My Chart');
        expect(chart.encodings.filters).toHaveLength(1);
        expect(chart.config.timezoneDisplayOffset).toBe(480);
        expect(chart.layout.primaryColor).toBe('#123456');
        expect(chart.layout.format.numberFormat).toBe(',.2f');
        // view channels are rebuilt, not merged with the previous chart
        expect(chart.encodings.columns.map((x) => x.fid)).toEqual([orderDate.fid]);
        expect(chart.encodings.rows.map((x) => x.fid)).toEqual([sales.fid]);
    });

    test('histogram reuses the existing row-count field and registers its bin field on the shelf', () => {
        const result = recommend({ fields: [sales], base });
        const hist = item(result, 'histogram');
        const chart = hist.chart!;
        const binField = chart.encodings.columns[0];
        expect(binField.expression?.op).toBe('bin');
        expect(binField.expression?.params[0].value).toBe(sales.fid);
        // bin field is registered on the dimension shelf
        expect(chart.encodings.dimensions.some((x) => x.fid === binField.fid)).toBe(true);
        // row count is reused, not duplicated
        expect(chart.encodings.rows[0].fid).toBe(COUNT_FIELD_ID);
        expect(chart.encodings.measures.filter((x) => x.fid === COUNT_FIELD_ID)).toHaveLength(1);
    });

    test('built charts share no field object references with the base chart', () => {
        const result = recommend({ fields: [category, sales], base });
        for (const rec of result.items.filter((x) => x.available)) {
            const chart = rec.chart!;
            for (const key of ['dimensions', 'measures', ...VIEW_CHANNEL_KEYS] as const) {
                for (const f of chart.encodings[key]) {
                    for (const baseField of base.encodings.dimensions.concat(base.encodings.measures)) {
                        expect(f).not.toBe(baseField);
                    }
                }
            }
        }
    });
});

describe('cold-start reverse matching (empty selection + allFields)', () => {
    const coldStart = (allFields = ALL_FIELDS, geoFeatureReady = false) => recommend({ fields: [], allFields, geoFeatureReady });

    test('every chart type except choropleth is available on a rich dataset', () => {
        const result = coldStart();
        for (const it of result.items) {
            if (it.chartType === 'choropleth_map') {
                expect(it.available).toBe(false);
                expect(it.reason).toBe('need_geo_feature');
            } else {
                expect(it.available).toBe(true);
            }
        }
    });

    test('choropleth becomes available once a geo feature is configured', () => {
        expect(item(coldStart(ALL_FIELDS, true), 'choropleth_map').available).toBe(true);
    });

    test('matched combinations are minimal and requirement-driven', () => {
        const result = coldStart();
        const matched = (t: Parameters<typeof item>[1]) => item(result, t).matchedFields!.map((f) => f.fid);
        // line prefers the temporal dimension over list order
        expect(matched('line')).toEqual([orderDate.fid, sales.fid]);
        expect(matched('area')).toEqual([orderDate.fid, sales.fid]);
        // histogram picks the first raw measure, never the count field
        expect(matched('histogram')).toEqual([sales.fid]);
        // scatter fills two generic measures, excluding the lon/lat pair
        expect(matched('scatter')).toEqual([sales.fid, profit.fid]);
        // poi map picks exactly the lon/lat pair
        expect(matched('poi_map').sort()).toEqual([lat.fid, lon.fid].sort());
        // heatmap needs two dimensions, filled in field-list order
        expect(matched('heatmap')).toEqual([category.fid, subcategory.fid]);
        // table stays pure-dimension so its score reflects the recommendation intent
        expect(matched('table')).toEqual([category.fid]);
    });

    test('every available item encodes exactly its matched fields', () => {
        const result = coldStart(ALL_FIELDS, true);
        for (const it of result.items.filter((x) => x.available)) {
            const encoded = viewFids(it.chart!);
            for (const f of it.matchedFields!) {
                expect(encoded).toContain(f.fid);
            }
            // nothing beyond matched fields + derived helpers (count / bin)
            const matchedFids = new Set(it.matchedFields!.map((f) => f.fid));
            const extras = [...encoded].filter((fid) => !matchedFids.has(fid) && fid !== COUNT_FIELD_ID && !fid.startsWith('gw_'));
            expect(extras).toEqual([]);
        }
    });

    test('missing special types surface the blocking reason', () => {
        const noTemporal = [category, subcategory, sales, profit, countMea];
        const result = coldStart(noTemporal);
        expect(item(result, 'line').reason).toBe('need_temporal_or_ordinal');
        expect(item(result, 'area').reason).toBe('need_temporal');
        expect(item(result, 'poi_map').reason).toBe('need_lon_lat');
        // the rest still work
        expect(item(result, 'bar').available).toBe(true);
        expect(item(result, 'scatter').available).toBe(true);
    });

    test('ordinal dimension unlocks line but not area', () => {
        const result = coldStart([level, sales, countMea]);
        expect(item(result, 'line').available).toBe(true);
        expect(item(result, 'line').matchedFields![0].fid).toBe(level.fid);
        expect(item(result, 'area').reason).toBe('need_temporal');
    });

    test('count-only dataset: histogram is rejected, bar falls back to count', () => {
        const result = coldStart([category, countMea]);
        expect(item(result, 'histogram').reason).toBe('need_raw_measure');
        const bar = item(result, 'bar');
        expect(bar.available).toBe(true);
        expect(bar.matchedFields!.map((f) => f.fid)).toEqual([category.fid, COUNT_FIELD_ID]);
        expect(item(result, 'scatter').reason).toBe('need_two_measures');
    });

    test('cold-start default is the poi map when a lon/lat pair exists, scatter otherwise', () => {
        expect(coldStart().defaultItem!.chartType).toBe('poi_map');
        const noGeo = [category, subcategory, level, orderDate, sales, profit, countMea];
        expect(coldStart(noGeo).defaultItem!.chartType).toBe('scatter');
    });

    test('non-empty selection never enters cold-start mode', () => {
        const result = recommend({ fields: [category, sales], allFields: ALL_FIELDS });
        expect(item(result, 'bar').matchedFields).toBeUndefined();
        // line is greyed because the selection has no temporal dim, even though the dataset has one
        expect(item(result, 'line').available).toBe(false);
    });
});
