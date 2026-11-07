import React, { StrictMode, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppRoot from '../../src/components/appRoot';
import NativeRenderer from '../../src/vis/native-renderer';
import type { IReactVegaHandler } from '../../src/vis/react-vega';
import type { IChart, IGWHandlerInsider } from '../../src/interfaces';
import { createNestedChartFixture } from '../../src/lib/native/fixtures';
import { prepareNativeResults } from '../../src/lib/native/results';
import type { NativeSelectionEvent } from '../../src/lib/native/events';
import { toWorkflow } from '../../src/utils/workflow';

const fixture = createNestedChartFixture();
const initial: IChart = {
    ...fixture.chart,
    layout: { ...fixture.chart.layout, renderer: 'native', useSvg: true, size: { mode: 'fixed', width: 900, height: 560 } },
};
const fields = [...initial.encodings.rows, ...initial.encodings.columns];
const workflow = toWorkflow(
    [],
    [...initial.encodings.dimensions, ...initial.encodings.measures],
    fields.filter((field) => field.analyticType === 'dimension'),
    fields.filter((field) => field.analyticType === 'measure'),
    true,
    'none',
);
const events: NativeSelectionEvent[] = [];
let report: Record<string, any> | undefined;

function Fixture() {
    const [chart, setChart] = useState(initial),
        [snapshot, setSnapshot] = useState(1);
    const [loading, setLoading] = useState(false),
        [error, setError] = useState<string>(),
        [mounted, setMounted] = useState(true),
        [dark, setDark] = useState(false);
    const [palette, setPalette] = useState<string[]>();
    const app = useRef<IGWHandlerInsider>(null),
        handle = useRef<IReactVegaHandler>(null);
    const result = useMemo(
        () =>
            prepareNativeResults({
                chart: initial,
                queryRows: fixture.records,
                workflow,
                version: { sourceId: 'component-fixture', snapshotId: String(snapshot), presentationId: 'base' },
                getRowKey: (row) => String(row.__datumKey),
            }),
        [snapshot],
    );
    const onReport = useCallback((text: string) => {
        report = text ? JSON.parse(text) : undefined;
    }, []);
    const onSelection = useCallback((event: NativeSelectionEvent) => {
        events.push(event);
    }, []);
    Object.assign(window, {
        __nativeRenderer: {
            setLoading,
            setError,
            setMounted,
            setDark,
            setSnapshot,
            setPalette,
            enableColor: () => setChart((value) => ({ ...value, encodings: { ...value.encodings, color: [value.encodings.rows[0]] } })),
            setBackend: (svg: boolean) => setChart((value) => ({ ...value, layout: { ...value.layout, useSvg: svg } })),
            setSize: (mode: 'auto' | 'fixed' | 'full', height: number) =>
                setChart((value) => ({ ...value, layout: { ...value.layout, size: { mode, width: 900, height } } })),
            events: () => events,
            report: () => report,
            status: () => app.current?.renderStatus,
            export: (format: 'svg' | 'png') => (format === 'svg' ? handle.current!.getSVGData() : handle.current!.getCanvasData()),
            download: (format: 'svg' | 'png') => (format === 'svg' ? handle.current!.downloadSVG() : handle.current!.downloadPNG()),
            exportChart: (format: 'svg' | 'data-url' = 'svg') => app.current!.exportChart(format),
            exportList: async () => {
                const items = [];
                for await (const item of app.current!.exportChartList('svg')) items.push(item);
                return items;
            },
            hasRef: () => !!handle.current,
            replaceExportHandler: () => {
                if (app.current)
                    app.current.exportChart = (async () => ({
                        title: 'other-owner',
                        mode: 'svg',
                        nRows: 0,
                        nCols: 0,
                        charts: [],
                        container: () => null,
                    })) as IGWHandlerInsider['exportChart'];
            },
        },
    });
    return (
        <AppRoot ref={app}>
            {mounted && (
                <NativeRenderer
                    ref={handle}
                    chart={chart}
                    result={result}
                    loading={loading}
                    error={error}
                    mediaTheme={dark ? 'dark' : 'light'}
                    vegaConfig={palette ? { range: { category: palette } } : undefined}
                    onSelectionChange={onSelection}
                    onReportSpec={onReport}
                />
            )}
        </AppRoot>
    );
}
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Fixture />
    </StrictMode>,
);
