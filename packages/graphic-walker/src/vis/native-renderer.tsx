import React, { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
    createPreparedDataSource,
    createWorksheet,
    type ControlledRequest,
    type Diagnostic,
    type LoadState,
    type ReadVersion,
} from '@kanaries/worksheet-renderer';
import type { IChannelScales, IChart, IRenderStatus, VegaGlobalConfig } from '../interfaces';
import type { IReactVegaHandler } from './react-vega';
import { adaptChartToRenderPlan } from '../lib/native/adapter';
import type { NativeResultSnapshot } from '../lib/native/results';
import { nativeTheme } from '../lib/native/theme';
import { mapNativeSelection, type NativeSelectionEvent } from '../lib/native/events';
import { emptyNativeDisplayState, orderNativeDomains, prepareNativeDisplay, updateNativeDisplay, type NativeDisplayState } from '../lib/native/viewState';
import { useNativeExportApi } from '../utils/nativeApiExport';

export interface NativeRendererProps {
    chart: IChart;
    result?: NativeResultSnapshot;
    loading?: boolean;
    error?: unknown;
    vegaConfig?: VegaGlobalConfig;
    mediaTheme?: 'light' | 'dark';
    scales?: IChannelScales;
    onSelectionChange?: (event: NativeSelectionEvent) => void;
    onReportSpec?: (report: string) => void;
    disableCollapse?: boolean;
    className?: string;
    style?: CSSProperties;
}
type Controller = ReturnType<typeof createWorksheet>;
let nextPresentation = 0;
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const versionKey = (version: ReadVersion) => JSON.stringify([version.sourceId, version.snapshotId, version.presentationId]);

/** A single worksheet controller consumes one immutable, already-computed GW result. */
const NativeRenderer = forwardRef<IReactVegaHandler, NativeRendererProps>(function NativeRenderer(props, ref) {
    const { chart, result, loading = false, error, vegaConfig, mediaTheme = 'light', scales } = props;
    const container = useRef<HTMLDivElement>(null),
        controller = useRef<Controller | undefined>(undefined),
        cleanups = useRef<(() => void)[]>([]);
    const mounted = useRef(false),
        renderTask = useRef<Promise<unknown>>(Promise.resolve()),
        active = useRef<unknown>(undefined);
    const click = useRef<{ clientX: number; clientY: number } | undefined>(undefined);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [loadState, setLoadState] = useState<LoadState>('loading'),
        [runtimeError, setRuntimeError] = useState<string>();
    const [requestState, setRequestState] = useState<{ basis: string; display: NativeDisplayState; request?: ControlledRequest }>();
    const theme = useMemo(
        () => nativeTheme(chart, vegaConfig, mediaTheme),
        [chart.encodings, chart.config.geoms, chart.config.defaultAggregated, vegaConfig, mediaTheme],
    );
    const adapted = useMemo(
        () =>
            result
                ? adaptChartToRenderPlan(chart, {
                      columns: result.columns,
                      fieldColumns: result.fieldColumns,
                      boxplot: result.boxplot,
                      records: result.records,
                      sourceMode: 'complete',
                      scales,
                      theme: theme.theme,
                  })
                : undefined,
        [chart, result, scales, theme],
    );
    const basis =
        result && adapted?.plan
            ? JSON.stringify([result.version.sourceId, adapted.plan.rows, adapted.plan.columns, adapted.plan.bindings.map((binding) => binding.bindingId)])
            : '';
    const display = requestState?.basis === basis ? requestState.display : emptyNativeDisplayState;
    // Cosmetic/backend changes never build a new data index. Interpretation and prepared
    // result changes produce a new source and presentation, while the controller remains.
    const interpretation = adapted?.plan
        ? JSON.stringify([
              adapted.plan.domainPlanKey,
              adapted.plan.bindings.map((binding) => [binding.fieldRef, binding.label, binding.valueLabels]),
              [...adapted.fieldRefs].map(([ref, item]) => [ref, item.field.sort]),
          ])
        : '';
    const canPrepare =
        !!result && !!adapted?.plan && ![...result.diagnostics, ...theme.diagnostics, ...adapted.diagnostics].some((item) => item.severity === 'error');
    const prepared = useMemo(() => {
        if (!result || !adapted?.plan || !canPrepare) return undefined;
        try {
            const view = prepareNativeDisplay(adapted.plan, result.records, display, adapted.fieldRefs);
            if (view.diagnostics.some((item) => item.severity === 'error')) return { diagnostics: view.diagnostics };
            const version = { ...result.version, presentationId: `${result.version.presentationId}:gw-native:${++nextPresentation}` };
            const source = createPreparedDataSource({
                plan: view.plan,
                records: result.records,
                version,
                identityScope: result.identityScope,
                getDatumKey: result.getDatumKey,
                memberOrder: view.memberOrder,
                axisMembers: view.axisMembers,
                getRecordPath: view.getRecordPath,
            });
            const sortDomains = Object.fromEntries(
                Object.entries(view.plan.scales ?? {})
                    .filter(([ref, scale]) => scale.domain !== adapted.plan!.scales?.[ref]?.domain)
                    .map(([ref, scale]) => [ref, scale.domain!]),
            );
            return { source: orderNativeDomains(source, view.plan), sortDomains, diagnostics: view.diagnostics };
        } catch (caught) {
            return { diagnostics: [{ code: 'prepared-source-error', severity: 'error', recoverable: true, message: errorText(caught) }] as Diagnostic[] };
        }
    }, [result, interpretation, display, canPrepare]);
    const plan = useMemo(() => {
        if (!adapted?.plan || !prepared?.source) return undefined;
        const scales = { ...adapted.plan.scales };
        for (const [ref, domain] of Object.entries(prepared.sortDomains)) scales[ref] = { ...scales[ref], domain };
        return { ...adapted.plan, scales };
    }, [adapted, prepared]);
    const diagnostics = [...(result?.diagnostics ?? []), ...theme.diagnostics, ...(adapted?.diagnostics ?? []), ...(prepared?.diagnostics ?? [])];
    const fatal = diagnostics.find((item) => item.severity === 'error');
    const blocked = loading
        ? 'The current query is still computing; the previous viewport is stale.'
        : error
          ? errorText(error)
          : !result
            ? 'No completed query result is available.'
            : fatal?.message;
    const target = useMemo(
        () => (plan && prepared?.source ? { plan, source: prepared.source, backend: chart.layout.useSvg ? ('svg' as const) : ('canvas' as const) } : undefined),
        [plan, prepared?.source, chart.layout.useSvg],
    );
    const latest = useRef({ props, adapted, target, blocked, basis, display });
    latest.current = { props, adapted, target, blocked, basis, display };
    const request = (event: ControlledRequest) => {
        const current = latest.current,
            view = controller.current;
        if (!view || !current.target || current.blocked || event.basePresentationId !== current.target.source.version.presentationId) {
            view?.rejectRequest(event.requestId, 'The prepared display changed before this request.');
            return;
        }
        const next = updateNativeDisplay(current.display, event, current.target.plan, current.props.disableCollapse);
        if (!next.state) {
            view.rejectRequest(event.requestId, next.reason ?? 'The display request cannot be represented.');
            return;
        }
        setRequestState({ basis: current.basis, display: next.state, request: event });
    };
    const requestRef = useRef(request);
    requestRef.current = request;

    useLayoutEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            active.current = undefined;
            clearTimeout(clickTimer.current);
            click.current = undefined;
            cleanups.current.forEach((dispose) => dispose());
            cleanups.current = [];
            controller.current?.dispose();
            controller.current = undefined;
        };
    }, []);
    useLayoutEffect(() => {
        if (!target || blocked || !container.current) {
            const pending = requestState?.request;
            if (pending) {
                controller.current?.rejectRequest(pending.requestId, blocked ?? 'The requested prepared display is unavailable.');
                setRequestState((current) => (current?.request?.requestId === pending.requestId ? { ...current, request: undefined } : current));
            }
            return;
        }
        setRuntimeError(undefined);
        setLoadState('loading');
        active.current = target;
        let view = controller.current;
        if (!view) {
            view = createWorksheet(container.current, target, { autoResize: true, accessibleName: chart.name || 'Graphic Walker worksheet' });
            controller.current = view;
            cleanups.current = [
                view.on('loadStateChange', (event) => {
                    if (mounted.current) {
                        setLoadState(event.state);
                        if (event.state === 'complete') setRuntimeError(undefined);
                        if (event.state === 'error') setRuntimeError(event.message ?? 'The worksheet failed to render.');
                    }
                }),
                view.on('selectionChange', (event) => {
                    const current = latest.current;
                    if (current.blocked || !current.target || versionKey(event.version) !== versionKey(current.target.source.version) || !current.adapted)
                        return;
                    const position = click.current;
                    click.current = undefined;
                    clearTimeout(clickTimer.current);
                    current.props.onSelectionChange?.(mapNativeSelection(event, current.adapted.fieldRefs, position));
                }),
                view.on('collapseRequest', (event) => requestRef.current(event)),
                view.on('sortRequest', (event) => requestRef.current(event)),
                view.on('diagnostic', (event) => {
                    if (mounted.current && event.severity === 'error') setRuntimeError(event.message);
                }),
            ];
            renderTask.current = view.ready.then((receipt) => {
                if (receipt.status !== 'committed') throw new Error(`Native display was ${receipt.status}`);
            });
        } else {
            const pending = requestState?.basis === basis ? requestState.request : undefined;
            const requestResults = pending ? [{ requestId: pending.requestId, status: 'accepted' as const }] : undefined;
            renderTask.current = view.update({ ...target, requestResults }).then((receipt) => {
                if (receipt.status !== 'committed') throw new Error(`Native display was ${receipt.status}`);
            });
        }
        const task = renderTask.current,
            owner = view;
        task.then(
            () => {
                if (mounted.current && controller.current === owner && active.current === target) {
                    setLoadState(owner.getViewState().loadState);
                    if (requestState?.request)
                        setRequestState((current) =>
                            current?.request?.requestId === requestState.request!.requestId ? { ...current, request: undefined } : current,
                        );
                }
            },
            (caught) => {
                if (mounted.current && controller.current === owner && active.current === target) {
                    setRuntimeError(errorText(caught));
                    setLoadState('error');
                    if (requestState?.request) {
                        owner.rejectRequest(requestState.request.requestId, errorText(caught));
                        setRequestState((current) =>
                            current?.request?.requestId === requestState.request!.requestId ? { ...current, request: undefined } : current,
                        );
                    }
                }
            },
        );
    }, [target, blocked]);
    useEffect(() => {
        props.onReportSpec?.(
            JSON.stringify(
                { renderer: 'native', reportType: 'debug-display', version: prepared?.source?.version ?? result?.version, plan: target?.plan, diagnostics },
                null,
                2,
            ),
        );
        return () => props.onReportSpec?.('');
    }, [target, result, props.onReportSpec, fatal?.message]);

    const status: IRenderStatus = loading
        ? 'computing'
        : blocked || runtimeError || loadState === 'error'
          ? 'error'
          : loadState === 'complete'
            ? 'idle'
            : 'rendering';
    useNativeExportApi(
        ref,
        () => {
            const current = latest.current,
                view = controller.current;
            if (!view || !container.current || !current.target) throw new Error(current.blocked ?? 'The native worksheet is not ready.');
            return {
                controller: view,
                generation: current.target,
                ready: renderTask.current,
                blocked: current.blocked ?? (active.current !== current.target ? 'The native display update has not committed.' : runtimeError),
                container: container.current,
                name: current.props.chart.name || 'untitled',
            };
        },
        status,
    );
    const size = chart.layout.size;
    const style: CSSProperties = {
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: size.mode === 'auto' ? Math.max(1, size.height || 480) : '100%',
        minHeight: 0,
        minWidth: 0,
        ...props.style,
    };
    const stop = (event: React.SyntheticEvent) => {
        if (blocked || runtimeError) {
            event.preventDefault();
            event.stopPropagation();
        }
    };
    return (
        <div className={props.className} style={style} data-renderer="native" aria-busy={status === 'computing' || status === 'rendering'}>
            <div
                ref={container}
                style={{ position: 'absolute', inset: 0 }}
                inert={!!blocked || !!runtimeError}
                onPointerDownCapture={stop}
                onPointerUpCapture={stop}
                onKeyDownCapture={stop}
                onWheelCapture={stop}
                onClickCapture={(event) => {
                    if (blocked || runtimeError) {
                        stop(event);
                        return;
                    }
                    // Browsers may run microtasks between React's delegated capture listener
                    // and the worksheet's native bubbling listener. Retain only this click task.
                    const point = { clientX: event.clientX, clientY: event.clientY };
                    click.current = point;
                    clearTimeout(clickTimer.current);
                    clickTimer.current = setTimeout(() => {
                        if (click.current === point) click.current = undefined;
                    }, 0);
                }}
            />
            {(blocked || runtimeError || status === 'computing') && (
                <div
                    role={status === 'error' ? 'alert' : 'status'}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeContent: 'center',
                        padding: 24,
                        background: mediaTheme === 'dark' ? '#111827ed' : '#ffffffed',
                        color: mediaTheme === 'dark' ? '#e5e7eb' : '#334155',
                        overflow: 'auto',
                    }}
                >
                    {loading ? 'Computing the current view…' : blocked || runtimeError}
                </div>
            )}
            {!blocked && !runtimeError && diagnostics.some((item) => item.severity === 'warning') && (
                <details
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        maxWidth: '75%',
                        maxHeight: '40%',
                        overflow: 'auto',
                        background: mediaTheme === 'dark' ? '#1f2937' : '#fff',
                        color: mediaTheme === 'dark' ? '#e5e7eb' : '#334155',
                        fontSize: 12,
                    }}
                >
                    <summary>Display notes</summary>
                    {diagnostics
                        .filter((item) => item.severity === 'warning')
                        .map((item, index) => (
                            <p key={`${item.configRef}:${index}`}>{item.message}</p>
                        ))}
                </details>
            )}
        </div>
    );
});
export default NativeRenderer;
