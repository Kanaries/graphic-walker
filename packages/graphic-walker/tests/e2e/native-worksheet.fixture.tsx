import React, { StrictMode, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PureRenderer from '../../src/renderer/pureRenderer';
import { GraphicWalker, GraphicRenderer } from '../../src/root';
import { getComputation } from '../../src/computation/clientComputation';
import { createNestedChartFixture } from '../../src/lib/native/fixtures';
import { MEA_KEY_ID, MEA_VAL_ID } from '../../src/constants';
import { createCountField } from '../../src/utils';
import type { IChart, IDataQueryPayload, IRow, IGWHandler, IComputationFunction, IChartExportResult, IViewField } from '../../src/interfaces';
import type { IReactVegaHandler } from '../../src/vis/react-vega';
import type { NativeSelectionEvent } from '../../src/lib/native/events';
import type { VizSpecStore } from '../../src/store/visualSpecStore';

const fixture = createNestedChartFixture();
const initial: IChart = {
    ...fixture.chart,
    encodings: {
        ...fixture.chart.encodings,
        dimensions: [...fixture.chart.encodings.dimensions, { fid: 'Channel', name: 'Channel', analyticType: 'dimension', semanticType: 'nominal' }],
    },
    layout: { ...fixture.chart.layout, renderer: 'native', size: { mode: 'fixed', width: 1050, height: 700 } },
};
const rawRows = fixture.records.map((row, index) => ({ ...row, Channel: index % 2 ? 'Partner' : 'Direct', Sales: row.Sales_sum, Profit: row.Profit_sum }));
export type NativeWorksheetSample = 'nested' | 'bin' | 'binCount' | 'same-name-fold' | 'temporal-raw';
const samples: { id: NativeWorksheetSample; label: string; description: string }[] = [
    { id: 'nested', label: 'Nested dimensions', description: 'The original 24-pane chart with real aggregate queries.' },
    { id: 'bin', label: 'Standard bin', description: 'GW computes four intervals from eight raw Amount values, then counts two rows per interval.' },
    {
        id: 'binCount',
        label: 'Standard binCount',
        description: 'GW computes four equal-frequency ordinal buckets from eight raw Amount values, then counts two rows per bucket.',
    },
    {
        id: 'same-name-fold',
        label: 'Same-name measure fold',
        description: 'Two original measures both named Revenue retain separate fold members and series. Chair totals are 12 and 15; Paper totals are 7 and 9.',
    },
    {
        id: 'temporal-raw',
        label: 'Temporal raw values',
        description: 'Raw ISO/date strings and null pass through GW. Three non-null dates produce points; selection retains the original raw string.',
    },
];
function sampleInput(id: NativeWorksheetSample): { chart: IChart; data: IRow[] } {
    if (id === 'nested') return { chart: clone(initial), data: clone(rawRows) };
    const dimension = (fid: string, semanticType: IViewField['semanticType'] = 'nominal'): IViewField => ({
        fid,
        name: fid,
        analyticType: 'dimension',
        semanticType,
    });
    const measure = (fid: string, name = fid): IViewField => ({ fid, name, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' });
    const chart = clone(initial);
    chart.visId = `native-acceptance-${id}`;
    chart.name = samples.find((sample) => sample.id === id)!.label;
    for (const key of Object.keys(chart.encodings) as (keyof IChart['encodings'])[]) chart.encodings[key] = [];
    if (id === 'bin' || id === 'binCount') {
        const amount = measure('Amount');
        // Match createBinField's existing editor schema, including ordinal type.
        const bucket: IViewField = {
            ...dimension('AmountBucket', 'ordinal'),
            name: `${id}4(Amount)`,
            computed: true,
            expression: { op: id, as: 'AmountBucket', params: [{ type: 'field', value: 'Amount' }], num: 4 },
        };
        const count = { ...createCountField(), name: 'Count' };
        chart.encodings.dimensions = [bucket];
        chart.encodings.measures = [amount, count];
        chart.encodings.rows = [count];
        chart.encodings.columns = [bucket];
        return { chart, data: [0, 1, 10, 11, 20, 21, 30, 40].map((Amount, index) => ({ __datumKey: `bin-${index}`, Amount })) };
    }
    if (id === 'same-name-fold') {
        const category = dimension('Category'),
            foldKey = { ...dimension(MEA_KEY_ID), name: 'Measure names' };
        const foldValue = measure(MEA_VAL_ID, 'Measure values');
        chart.config.folds = ['RevenueA', 'RevenueB'];
        chart.encodings.dimensions = [category, foldKey];
        chart.encodings.measures = [measure('RevenueA', 'Revenue'), measure('RevenueB', 'Revenue'), foldValue];
        chart.encodings.rows = [foldKey, category];
        chart.encodings.columns = [foldValue];
        chart.encodings.color = [foldKey];
        return {
            chart,
            data: [
                { Category: 'Chair', RevenueA: 10, RevenueB: 10 },
                { Category: 'Chair', RevenueA: 2, RevenueB: 5 },
                { Category: 'Paper', RevenueA: 7, RevenueB: 9 },
            ],
        };
    }
    const time = { ...dimension('OccurredAt', 'temporal'), offset: 0 },
        value = measure('Value'),
        rowId = { ...dimension('__datumKey'), name: 'Record ID' };
    chart.config.defaultAggregated = false;
    chart.config.geoms = ['point'];
    chart.config.timezoneDisplayOffset = 0;
    chart.encodings.dimensions = [time, rowId];
    chart.encodings.measures = [value];
    chart.encodings.rows = [value];
    chart.encodings.columns = [time];
    chart.encodings.details = [rowId];
    return {
        chart,
        data: [
            { __datumKey: 'before-dst', OccurredAt: '2026-03-08T01:30:00-08:00', Value: 10 },
            { __datumKey: 'after-dst', OccurredAt: '2026-03-08T03:30:00-07:00', Value: 20 },
            { __datumKey: 'date-only', OccurredAt: '2026-03-09', Value: 30 },
            { __datumKey: 'null-date', OccurredAt: null, Value: 40 },
        ],
    };
}
const queries: IDataQueryPayload[] = [],
    events: NativeSelectionEvent[] = [];
const importErrors: { name: string; message: string; code?: string; diagnostics?: unknown }[] = [];
const queryResults: { queryIndex: number; rows: IRow[] }[] = [];
const pending: { resolve: () => Promise<void>; reject: () => void }[] = [];
let queryMode: 'immediate' | 'hold' | 'reject' = 'immediate';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const mode = new URLSearchParams(location.search).get('mode') ?? 'pure';
const requestedSample = new URLSearchParams(location.search).get('sample');
const initialSample = samples.find((sample) => sample.id === requestedSample)?.id ?? 'nested';

type SerializableExport = Omit<IChartExportResult, 'container' | 'charts'> & {
    containerConnected: boolean;
    charts: (Omit<IChartExportResult['charts'][number], 'canvas'> & { canvasConnected: boolean })[];
};
export interface NativeWorksheetFixtureApi {
    samples(): typeof samples;
    currentSample(): NativeWorksheetSample;
    setSample(sample: NativeWorksheetSample): void;
    getChart(): IChart;
    setChart(chart: IChart): void;
    setVegaLiteSpec(spec: unknown): void;
    importErrors(): typeof importErrors;
    getData(): IRow[];
    setData(rows: IRow[]): void;
    setMounted(mounted: boolean): void;
    setDark(dark: boolean): void;
    setQueryMode(mode: 'immediate' | 'hold' | 'reject'): void;
    queryCount(): number;
    queries(): IDataQueryPayload[];
    /** Actual completed GW computation output before fold and native preparation. */
    results(): { queryIndex: number; rows: IRow[] }[];
    events(): NativeSelectionEvent[];
    pendingCount(): number;
    release(index?: number): Promise<void> | undefined;
    reject(index?: number): void;
    export(format: 'svg' | 'png'): Promise<string[] | SerializableExport>;
    download(format: 'svg' | 'png'): Promise<string[]>;
    getRef(): boolean;
    refMethods(): string[];
    getStore(): VizSpecStore | null;
    renderStatus(): IGWHandler['renderStatus'] | undefined;
}
declare global {
    interface Window {
        __nativeWorksheet: NativeWorksheetFixtureApi;
    }
}

const serializableExport = (result: IChartExportResult): SerializableExport => ({
    mode: result.mode,
    title: result.title,
    combinedData: result.combinedData,
    chartType: result.chartType,
    nRows: result.nRows,
    nCols: result.nCols,
    containerConnected: Boolean(result.container()?.isConnected),
    charts: result.charts.map(({ canvas, ...page }) => ({ ...page, canvasConnected: Boolean(canvas()?.isConnected) })),
});

function Fixture() {
    const initialInput = useMemo(() => sampleInput(initialSample), []);
    const [sample, setSelectedSample] = useState<NativeWorksheetSample>(initialSample);
    const [chart, setChart] = useState<IChart>(initialInput.chart);
    const [data, setData] = useState<IRow[]>(initialInput.data);
    const [mounted, setMounted] = useState(true);
    const [dark, setDark] = useState(false);
    const [vlSpec, setVegaLiteSpec] = useState<unknown>();
    const [lastImportError, setLastImportError] = useState('');
    const handleError = useCallback((error: Error) => {
        const diagnostic = error as Error & { code?: string; diagnostics?: unknown };
        importErrors.push({ name: diagnostic.name, message: diagnostic.message, code: diagnostic.code, diagnostics: diagnostic.diagnostics });
        setLastImportError(diagnostic.message);
    }, []);
    const chartList = useMemo(() => [chart], [chart]);
    const fields = useMemo(() => [...chart.encodings.dimensions, ...chart.encodings.measures], [chart.encodings.dimensions, chart.encodings.measures]);
    const chartRef = useRef(chart);
    chartRef.current = chart;
    const renderRef = useRef<IReactVegaHandler>(null),
        appRef = useRef<IGWHandler>(null),
        storeRef = useRef<VizSpecStore>(null);
    const computation = useMemo<IComputationFunction>(() => {
        const calculate = getComputation(data);
        return (payload) => {
            const queryIndex = queries.push(clone(payload)) - 1;
            const complete = () =>
                Promise.resolve(calculate(payload)).then((rows) => {
                    queryResults.push({ queryIndex, rows: clone(rows) });
                    return rows;
                });
            if (queryMode === 'reject') return Promise.reject(new Error('Fixture query failure'));
            if (queryMode === 'hold')
                return new Promise<IRow[]>((resolve, reject) => {
                    pending.push({ resolve: () => complete().then(resolve, reject), reject: () => reject(new Error('Fixture deferred query failure')) });
                });
            return complete();
        };
    }, [data]);
    const nativeRenderer = useMemo(
        () => ({ getResultRowKey: (row: Readonly<IRow>) => String(row.__datumKey), onSelectionChange: (event: NativeSelectionEvent) => events.push(event) }),
        [],
    );
    const selectSample = (next: NativeWorksheetSample) => {
        if (!samples.some((sample) => sample.id === next)) throw new Error(`Unknown native worksheet sample: ${next}`);
        const input = sampleInput(next);
        queryMode = 'immediate';
        events.length = 0;
        setSelectedSample(next);
        setChart(input.chart);
        setData(input.data);
    };
    window.__nativeWorksheet = {
        samples: () => clone(samples),
        currentSample: () => sample,
        setSample: selectSample,
        getChart: () => clone(storeRef.current?.currentVis ?? chartRef.current),
        setChart: (next: IChart) => setChart(next),
        setVegaLiteSpec: (spec) => setVegaLiteSpec(spec == null ? undefined : clone(spec)),
        importErrors: () => clone(importErrors),
        getData: () => clone(data),
        setData,
        setMounted,
        setDark,
        setQueryMode: (next: typeof queryMode) => {
            queryMode = next;
        },
        queryCount: () => queries.length,
        queries: () => clone(queries),
        results: () => clone(queryResults),
        events: () => clone(events),
        pendingCount: () => pending.length,
        release: (index = 0) => pending.splice(index, 1)[0]?.resolve(),
        reject: (index = 0) => pending.splice(index, 1)[0]?.reject(),
        export: async (format: 'svg' | 'png') =>
            mode === 'editor' || mode === 'viewer'
                ? serializableExport(await appRef.current!.exportChart(format === 'svg' ? 'svg' : 'data-url'))
                : format === 'svg'
                  ? renderRef.current!.getSVGData()
                  : renderRef.current!.getCanvasData(),
        download: (format: 'svg' | 'png') => (format === 'svg' ? renderRef.current!.downloadSVG() : renderRef.current!.downloadPNG()),
        getRef: () => !!renderRef.current,
        refMethods: () => Object.keys(renderRef.current ?? {}),
        getStore: () => storeRef.current,
        renderStatus: () => appRef.current?.renderStatus,
    };
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <label style={{ display: 'block', padding: 4 }}>
                Acceptance sample{' '}
                <select aria-label="Acceptance sample" value={sample} onChange={(event) => selectSample(event.target.value as NativeWorksheetSample)}>
                    {samples.map((sample) => (
                        <option key={sample.id} value={sample.id}>
                            {sample.label}
                        </option>
                    ))}
                </select>
            </label>
            <p data-testid="sample-description" style={{ margin: '0 4px 4px', fontSize: 12 }}>
                {samples.find((item) => item.id === sample)?.description}
            </p>
            <output data-testid="import-error">{lastImportError}</output>
            {mounted &&
                (mode === 'editor' ? (
                    <GraphicWalker
                        ref={appRef}
                        storeRef={storeRef}
                        computation={computation}
                        fields={fields}
                        chart={chartList}
                        vlSpec={vlSpec}
                        defaultRenderer="native"
                        appearance={dark ? 'dark' : 'light'}
                        onError={handleError}
                        nativeRenderer={nativeRenderer}
                        hideChartNav
                    />
                ) : mode === 'viewer' ? (
                    <GraphicRenderer
                        ref={appRef}
                        storeRef={storeRef}
                        computation={computation}
                        fields={fields}
                        chart={chartList}
                        vlSpec={vlSpec}
                        defaultRenderer="native"
                        appearance={dark ? 'dark' : 'light'}
                        onError={handleError}
                        nativeRenderer={nativeRenderer}
                    />
                ) : (
                    <PureRenderer
                        ref={renderRef}
                        type="remote"
                        computation={computation}
                        name={chart.name}
                        visualState={chart.encodings}
                        visualConfig={chart.config}
                        visualLayout={chart.layout}
                        appearance={dark ? 'dark' : 'light'}
                        nativeRenderer={nativeRenderer}
                        onRendererChange={(renderer) => setChart((current) => ({ ...current, layout: { ...current.layout, renderer } }))}
                    />
                ))}
        </div>
    );
}
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Fixture />
    </StrictMode>,
);
