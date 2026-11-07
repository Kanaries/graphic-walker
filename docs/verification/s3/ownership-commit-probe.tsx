/**
 * Short browser probe for the real useRenderer hook. This is not an e2e spec.
 * Bundle in development to exercise actual StrictMode effect replay; see code-review.md.
 */
import React, { StrictMode, useLayoutEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useRenderer } from '../../../packages/graphic-walker/src/renderer/hooks';
import { newChart } from '../../../packages/graphic-walker/src/models/visSpecHistory';
import { isCurrentComputation } from '../../../packages/graphic-walker/src/utils/computationOwnership';
import type { IComputationFunction, IViewField } from '../../../packages/graphic-walker/src/interfaces';

type Scenario = 'commit' | 'unmount' | 'display-only';
type ProbeOptions = { scenario: Scenario; strict: boolean };
const dimension: IViewField = { fid: 'Category', name: 'Category', analyticType: 'dimension', semanticType: 'nominal' };
const measure: IViewField = { fid: 'Value', name: 'Value', analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' };
const dimensions = [dimension], measures = [measure], fields = [...dimensions, ...measures], filters = [];
const baseChart = newChart(fields, 'Original chart', 'ownership-probe');
baseChart.encodings.rows = dimensions;
baseChart.encodings.columns = measures;

async function waitFor(predicate: () => boolean) {
    const deadline = performance.now() + 3000;
    while (!predicate()) {
        if (performance.now() > deadline) throw new Error('Ownership probe timed out');
        await new Promise<void>((resolve) => setTimeout(resolve, 1));
    }
}

async function runProbe(options: ProbeOptions) {
    const log: unknown[][] = [], reports: number[] = [], starts: number[] = [];
    let committed = 0, rejectOld: (error: Error) => void = () => {};
    let resultState: { loading: boolean; error?: string; values: unknown[] } | undefined;

    function ProbeChild({ sourceId, display }: { sourceId: number; display: boolean }) {
        const source = useMemo<IComputationFunction>(() => async (payload) => {
            starts.push(sourceId);
            log.push(['start', sourceId]);
            try {
                if (sourceId === 1) await new Promise<never>((_, reject) => { rejectOld = reject; });
                return [{ Category: 'A', Value: sourceId }];
            } catch (error) {
                const current = isCurrentComputation(payload);
                log.push(['catch', sourceId, 'committed', committed, 'isCurrent', current]);
                if (current) reports.push(sourceId); // Same reporting guard as App/RendererApp.
                throw error;
            }
        }, [sourceId]);
        const chart = useMemo(() => ({
            ...baseChart,
            name: display ? 'Display-only updated chart' : baseChart.name,
            layout: { ...baseChart.layout, useSvg: display, primaryColor: display ? '#ff0000' : '#336699' },
        }), [display]);
        const result = useRenderer({
            chart, allFields: fields, viewDimensions: dimensions, viewMeasures: measures, filters,
            defaultAggregated: false, sort: 'none', limit: -1, computationFunction: source,
        });
        resultState = { loading: result.loading, error: result.error instanceof Error ? result.error.message : undefined, values: result.viewData.map(row => row.Value) };
        return <span>{chart.name}</span>;
    }

    function Parent({ next }: { next: boolean }) {
        useLayoutEffect(() => {
            committed = next ? 2 : 1;
            log.push(['layout', committed]);
            if (next) rejectOld(new Error('Old failure during replacement commit'));
        }, [next]);
        if (next && options.scenario === 'unmount') return null;
        return <ProbeChild sourceId={next && options.scenario === 'commit' ? 2 : 1} display={next} />;
    }

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const render = (next: boolean) => root.render(options.strict ? <StrictMode><Parent next={next} /></StrictMode> : <Parent next={next} />);
    try {
        render(false);
        await waitFor(() => starts.includes(1));
        render(true);
        await waitFor(() => log.some(entry => entry[0] === 'catch' && entry[1] === 1));
        if (options.scenario === 'commit') await waitFor(() => resultState?.values[0] === 2);
        if (options.scenario === 'display-only') await waitFor(() => Boolean(resultState?.error));
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        const expectedReports = options.scenario === 'display-only' ? [1] : [];
        const expectedStarts = options.scenario === 'commit' ? [1, 2] : [1];
        return {
            ...options, log, reports, starts, result: resultState,
            passed: JSON.stringify(reports) === JSON.stringify(expectedReports) && JSON.stringify(starts) === JSON.stringify(expectedStarts),
        };
    } finally {
        root.unmount();
        container.remove();
    }
}

declare global { interface Window { runOwnershipCommitProbe: typeof runProbe } }
window.runOwnershipCommitProbe = runProbe;
