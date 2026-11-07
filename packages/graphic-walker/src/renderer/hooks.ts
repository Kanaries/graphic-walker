import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { IChart, IFilterField, IRow, IViewField, IDataQueryWorkflowStep, IComputationFunction } from '../interfaces';
import type { ReadVersion } from '@kanaries/worksheet-renderer';
import { useAppRootContext } from '../components/appRoot';
import { toWorkflow } from '../utils/workflow';
import { dataQuery } from '../computation';
import { fold2 } from '../lib/op/fold';
import { prepareNativeResults, type NativeResultSnapshot } from '../lib/native/results';
import type { NativeGetRowKey } from '../lib/native/identity';
import { runOwnedComputation } from '../utils/computationOwnership';

interface UseRendererProps {
    chart?: IChart;
    allFields: IViewField[];
    viewDimensions: IViewField[];
    viewMeasures: IViewField[];
    filters: IFilterField[];
    defaultAggregated: boolean;
    sort: 'none' | 'ascending' | 'descending';
    limit: number;
    computationFunction: IComputationFunction;
    folds?: string[];
    timezoneDisplayOffset?: number;
}

interface QueryRequest {
    readonly source: IComputationFunction;
    readonly sourceId: string;
    readonly workflow: IDataQueryWorkflowStep[];
    readonly limit?: number;
}
interface QueryResult {
    readonly request: QueryRequest;
    readonly queryRows: IRow[];
    readonly version: ReadVersion;
    readonly error?: unknown;
}
export interface UseRendererResult {
    viewData: IRow[];
    loading: boolean;
    error?: unknown;
    /** Only completed results for the current query can cross the renderer boundary. */
    query?: QueryResult;
    parsed: { workflow: IDataQueryWorkflowStep[] };
}

const sourceIds = new WeakMap<IComputationFunction, number>();
let nextSourceId = 0;
let nextSnapshotId = 0;
const emptyRows: IRow[] = [];
const emptyWorkflow: IDataQueryWorkflowStep[] = [];

export const useRenderer = (props: UseRendererProps): UseRendererResult => {
    const { chart, allFields, viewDimensions, viewMeasures, filters, defaultAggregated, sort, limit, computationFunction, folds, timezoneDisplayOffset } =
        props;
    const workflow = useMemo(
        () =>
            toWorkflow(filters, allFields, viewDimensions, viewMeasures, defaultAggregated, sort, folds, limit > 0 ? limit : undefined, timezoneDisplayOffset),
        [filters, allFields, viewDimensions, viewMeasures, defaultAggregated, sort, folds, limit, timezoneDisplayOffset],
    );
    // A renderer, style or header-label edit can create new arrays without changing the query.
    // Compare the serializable existing workflow, not IChart or display configuration.
    const workflowKey = JSON.stringify(workflow);
    const request = useMemo<QueryRequest>(() => {
        let sourceId = sourceIds.get(computationFunction);
        if (sourceId === undefined) sourceIds.set(computationFunction, (sourceId = ++nextSourceId));
        return { source: computationFunction, sourceId: `gw:${sourceId}:${chart?.visId ?? 'view'}`, workflow, limit: limit > 0 ? limit : undefined };
    }, [computationFunction, chart?.visId, workflowKey, limit]);
    const [settled, setSettled] = useState<QueryResult>();
    const appRef = useAppRootContext();
    const committedRequest = useRef<QueryRequest | undefined>(undefined);
    useLayoutEffect(() => {
        committedRequest.current = request;
        return () => {
            if (committedRequest.current === request) committedRequest.current = undefined;
        };
    }, [request]);

    useEffect(() => {
        let active = true;
        // Invalidate on commit, before an old rejection can beat passive cleanup.
        // A speculative render must not revoke the still-committed request.
        const isCurrent = () => active && committedRequest.current === request;
        const snapshotId = String(++nextSnapshotId);
        appRef.current?.updateRenderStatus('computing');
        // Calling through a promise also catches synchronous host computation failures.
        Promise.resolve()
            .then(() =>
                isCurrent() ? dataQuery((payload) => runOwnedComputation(request.source, payload, isCurrent), request.workflow, request.limit) : undefined,
            )
            .then((queryRows) => {
                if (!isCurrent()) return;
                if (!Array.isArray(queryRows)) throw new TypeError('The computation result must be an array of rows.');
                appRef.current?.updateRenderStatus('rendering');
                setSettled({ request, queryRows, version: { sourceId: request.sourceId, snapshotId, presentationId: 'query' } });
            })
            .catch((error: unknown) => {
                if (!isCurrent()) return;
                appRef.current?.updateRenderStatus('error');
                setSettled({
                    request,
                    queryRows: [],
                    version: { sourceId: request.sourceId, snapshotId, presentationId: 'query' },
                    error: error ?? new Error('Query failed'),
                });
            });
        return () => {
            active = false;
        };
    }, [request]);

    // This comparison is synchronous, before effects, so a new chart never receives old rows.
    const current = settled?.request === request ? settled : undefined;
    const query = current && current.error === undefined ? current : undefined;
    const viewData = useMemo(
        () => (query ? (fold2(query.queryRows, defaultAggregated, allFields, viewMeasures, viewDimensions, folds) as IRow[]) : emptyRows),
        [query, defaultAggregated, allFields, viewMeasures, viewDimensions, folds],
    );
    return { viewData, loading: !current, error: current?.error, query, parsed: { workflow: query?.request.workflow ?? emptyWorkflow } };
};

/** Display preparation stays outside the chart package and never runs a query. */
export function useNativeResult(chart: IChart, query: UseRendererResult['query'], getRowKey?: NativeGetRowKey): NativeResultSnapshot | undefined {
    const revision = useRef(0);
    const semantics = JSON.stringify({ encodings: chart.encodings, config: chart.config });
    const enabled = chart.layout.renderer === 'native' && chart.config.coordSystem !== 'geographic' && chart.config.geoms[0] !== 'table';
    return useMemo(() => {
        if (!enabled || !query) return undefined;
        return prepareNativeResults({
            chart,
            queryRows: query.queryRows,
            workflow: query.request.workflow,
            getRowKey,
            version: { ...query.version, presentationId: String(++revision.current) },
        });
    }, [enabled, semantics, query, getRowKey]);
}
