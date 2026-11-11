import React from 'react';
import { createRoot } from 'react-dom/client';
import PureRenderer from '../../src/renderer/pureRenderer';
import type { IReactVegaHandler } from '../../src/vis/react-vega';
import { GraphicWalker } from '../../src/root';
import { getComputation } from '../../src/computation/clientComputation';
import { expectNativeRenderer, registerNativeRenderer } from '../../src/renderer/nativeRegistry';
import { worksheetRenderer } from '../../src/renderer/native';
import { emptyEncodings, emptyVisualConfig, emptyVisualLayout } from '../../src/utils/save';
import type { IChart, IChartExportResult, IDataQueryPayload, IGWHandler, IRow, IViewField } from '../../src/interfaces';
import type { VizSpecStore } from '../../src/store/visualSpecStore';

/**
 * The editor with a data source the tests control and, as the query asks, with or without the
 * worksheet renderer:
 *   ?native=on    it is bundled, as in the published package
 *   ?native=slow  it is announced and arrives when the test calls arrive()
 *   ?native=fail  it is announced and its code never loads
 *   ?native=off   nobody mentions it, as in a host that does not have it
 */
export interface ChartRequest {
    name: string;
    renderer?: IChart['layout']['renderer'];
    rows?: string[];
    columns?: string[];
    geom?: string;
    map?: boolean;
}
export interface RendererFixture {
    load(charts: ChartRequest[]): void;
    /** The charts as the editor would save them. */
    saved(): IChart[];
    setRenderer(renderer: NonNullable<IChart['layout']['renderer']>): void;
    setMap(on: boolean): void;
    setGeom(geom: string): void;
    /** Lets the worksheet renderer through, under ?native=slow. */
    arrive(): void;
    /** Makes every query fail from now on, or work again. */
    failQueries(on: boolean): void;
    queries(): IDataQueryPayload[];
    host: {
        status(): string;
        chartCount(): number;
        chartIndex(): number;
        openChart(index: number): void;
        exportChart(): Promise<{ title: string; chartType?: string; images: number; data: string }>;
        exportChartList(): Promise<{ index: number; title: string; chartType?: string; images: number }[]>;
    };
}
declare global {
    interface Window {
        gw: RendererFixture;
        pureExport(): Promise<string[]>;
    }
}

const dimension = (fid: string, extra: Partial<IViewField> = {}): IViewField => ({ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension', ...extra });
const measure = (fid: string): IViewField => ({ fid, name: fid, semanticType: 'quantitative', analyticType: 'measure', aggName: 'sum' });
const ratio: IViewField = {
    fid: 'f_ratio', name: 'Ratio', semanticType: 'quantitative', analyticType: 'measure', aggName: 'expr', computed: true,
    expression: { op: 'expr', as: 'f_ratio', params: [{ type: 'sql', value: 'sum(Sales) / sum(Cost)' }] },
};
const dimensions = [dimension('Region'), dimension('Category'), dimension('Subcategory'), dimension('Lat', { semanticType: 'quantitative' }), dimension('Lon', { semanticType: 'quantitative' })];
const measures = [measure('Sales'), measure('Cost'), ratio];
const byId = new Map([...dimensions, ...measures].map((f) => [f.fid, f]));
// East and West hold members of the same name. Each row is a place, so the map has seven points.
const data: IRow[] = [
    { Region: 'East', Category: 'A', Subcategory: 'a1', Sales: 10, Cost: 1, Lat: 40.7, Lon: -74.0 },
    { Region: 'East', Category: 'A', Subcategory: 'a1', Sales: 20, Cost: 9, Lat: 42.4, Lon: -71.1 },
    { Region: 'East', Category: 'A', Subcategory: 'a2', Sales: 8, Cost: 4, Lat: 39.9, Lon: -75.2 },
    { Region: 'East', Category: 'B', Subcategory: 'b1', Sales: 9, Cost: 3, Lat: 38.9, Lon: -77.0 },
    { Region: 'West', Category: 'A', Subcategory: 'a1', Sales: 6, Cost: 12, Lat: 37.8, Lon: -122.4 },
    { Region: 'West', Category: 'A', Subcategory: 'a2', Sales: 15, Cost: 5, Lat: 34.1, Lon: -118.2 },
    { Region: 'West', Category: 'B', Subcategory: 'b1', Sales: 7, Cost: 2, Lat: 47.6, Lon: -122.3 },
];

function chartOf(request: ChartRequest, index: number): IChart {
    const pick = (ids: string[] = []) => ids.map((id) => byId.get(id)!);
    return {
        visId: `chart-${index}`,
        name: request.name,
        encodings: {
            // Every chart knows where its rows are, so that any of them can be turned into a map and back.
            ...emptyEncodings, dimensions, measures, rows: pick(request.rows), columns: pick(request.columns), latitude: pick(['Lat']), longitude: pick(['Lon']),
        },
        config: { ...emptyVisualConfig, geoms: [request.geom ?? (request.map ? 'poi' : 'auto')], coordSystem: request.map ? 'geographic' : 'generic' },
        // Map tiles are asked of this server, which has none. What is checked is the map itself, not a tile service.
        layout: { ...emptyVisualLayout, geoMapTileUrl: '/tests/e2e/no-tiles/{z}/{x}/{y}.png', ...(request.renderer ? { renderer: request.renderer } : {}) },
    };
}

const params = new URLSearchParams(window.location.search);
const pure = params.has('pure');
const mode = params.get('native') ?? 'on';
registerNativeRenderer(mode === 'on' ? worksheetRenderer : undefined);
const preview = async () => { registerNativeRenderer(worksheetRenderer); };
let arrive = () => {};
if (mode === 'on') expectNativeRenderer(preview());
else if (mode === 'slow') expectNativeRenderer(new Promise<void>((resolve) => (arrive = resolve)).then(preview));
else if (mode === 'fail') expectNativeRenderer(Promise.reject(new Error('The preview could not be fetched.')));

const local = getComputation(data);
const queries: IDataQueryPayload[] = [];
let failing = false;
const computation = async (payload: IDataQueryPayload) => {
    queries.push(JSON.parse(JSON.stringify(payload)));
    if (failing) throw new Error('The data source is offline.');
    return local(payload);
};

const storeRef = React.createRef<VizSpecStore>();
const hostRef = React.createRef<IGWHandler>();
const store = () => {
    if (!storeRef.current) throw new Error('The editor is not mounted yet.');
    return storeRef.current;
};
const host = () => {
    if (!hostRef.current) throw new Error('The editor is not mounted yet.');
    return hostRef.current;
};
const told = (result: IChartExportResult) => ({ title: result.title, chartType: result.chartType, images: result.charts.length, data: result.charts[0]?.data ?? '' });

window.gw = {
    load: (charts) => store().importCode(charts.map(chartOf)),
    saved: () => JSON.parse(JSON.stringify(store().exportCode())),
    setRenderer: (renderer) => store().setVisualLayout('renderer', renderer),
    setMap: (on) => store().setCoordSystem(on ? 'geographic' : 'generic'),
    setGeom: (geom) => store().setVisualConfig('geoms', [geom]),
    arrive: () => arrive(),
    failQueries: (on) => void (failing = on),
    queries: () => queries,
    host: {
        status: () => host().renderStatus,
        chartCount: () => host().chartCount,
        chartIndex: () => host().chartIndex,
        openChart: (index) => host().openChart(index),
        exportChart: async () => told(await host().exportChart('svg')),
        exportChartList: async () => {
            const list: { index: number; title: string; chartType?: string; images: number }[] = [];
            for await (const item of host().exportChartList('svg')) {
                const { title, chartType, images } = told(item.data);
                list.push({ index: item.index, title, chartType, images });
            }
            return list;
        },
    },
};

const pureRef = React.createRef<IReactVegaHandler>();
const pureChart = chartOf({ name: 'Default worksheet', rows: ['Region', 'Category', 'Subcategory'], columns: ['Sales'] }, 0);
window.pureExport = () => pureRef.current!.getSVGData();

createRoot(document.getElementById('root')!).render(
    pure ? <PureRenderer ref={pureRef} rawData={data} visualState={pureChart.encodings} visualConfig={pureChart.config} /> : <GraphicWalker ref={hostRef} storeRef={storeRef} fields={[...dimensions, ...measures]} computation={computation} appearance="light" style={{ width: '100%', height: '100%' }} />
);

function ready() {
    if (pure ? !pureRef.current : !storeRef.current || !hostRef.current) return void requestAnimationFrame(ready);
    document.body.dataset.fixtureReady = 'true';
}
requestAnimationFrame(ready);
