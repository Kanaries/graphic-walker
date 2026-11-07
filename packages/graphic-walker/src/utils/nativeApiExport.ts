import { useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, type ForwardedRef } from 'react';
import type { createWorksheet, ExportPage } from '@kanaries/worksheet-renderer';
import { useAppRootContext } from '../components/appRoot';
import type { IChartExportResult, IGWHandlerInsider, IRenderStatus } from '../interfaces';
import type { IReactVegaHandler } from '../vis/react-vega';

type Controller = ReturnType<typeof createWorksheet>;
function waitForReady(promise: Promise<unknown>, signal: AbortSignal): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const cancelled = () => reject(new DOMException('Native renderer is disposed', 'AbortError'));
        if (signal.aborted) {
            cancelled();
            return;
        }
        signal.addEventListener('abort', cancelled, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener('abort', cancelled);
                signal.aborted ? cancelled() : resolve(value);
            },
            (error) => {
                signal.removeEventListener('abort', cancelled);
                reject(error);
            },
        );
    });
}
export interface NativeExportTarget {
    controller: Controller;
    generation: unknown;
    ready: Promise<unknown>;
    blocked?: string;
    container: HTMLDivElement;
    name: string;
}
function disposedNativeTarget(): never {
    throw new DOMException('Native renderer is disposed', 'AbortError');
}

export function createNativeExportApi(getTarget: () => NativeExportTarget) {
    let disposed = false;
    const pending = new Set<AbortController>(),
        urls = new Set<string>();
    const page = async (format: 'svg' | 'png'): Promise<{ page: ExportPage; target: NativeExportTarget }> => {
        if (disposed) throw new DOMException('Native renderer is disposed', 'AbortError');
        const target = getTarget();
        if (target.blocked) throw new Error(target.blocked);
        const controller = new AbortController();
        pending.add(controller);
        try {
            await waitForReady(target.ready, controller.signal);
            const current = getTarget();
            if (controller.signal.aborted || disposed) throw new DOMException('Native renderer is disposed', 'AbortError');
            if (current.blocked || current.generation !== target.generation || current.controller !== target.controller)
                throw new Error(current.blocked ?? 'version-expired: The native display changed before export');
            const result = await target.controller.exportViewport({ format }, controller.signal);
            const after = getTarget();
            if (after.blocked || after.generation !== target.generation)
                throw new Error(after.blocked ?? 'version-expired: The native display changed during export');
            return { page: result, target };
        } finally {
            pending.delete(controller);
        }
    };
    const download = async (format: 'svg' | 'png', filename?: string) => {
        const { page: result, target } = await page(format),
            anchor = document.createElement('a');
        anchor.download = `${filename ?? target.name ?? 'worksheet'}.${format}`;
        if (format === 'svg') {
            const url = URL.createObjectURL(new Blob([result.content], { type: 'image/svg+xml' }));
            urls.add(url);
            anchor.href = url;
            anchor.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                urls.delete(url);
            }, 0);
        } else {
            anchor.href = result.content;
            anchor.click();
        }
        return [result.content];
    };
    const handle: IReactVegaHandler = {
        getSVGData: async () => [(await page('svg')).page.content],
        getCanvasData: async () => [(await page('png')).page.content],
        downloadSVG: (filename) => download('svg', filename),
        downloadPNG: (filename) => download('png', filename),
    };
    return {
        handle,
        async exportChart(mode: IChartExportResult['mode'] = 'svg'): Promise<IChartExportResult> {
            if (mode !== 'svg' && mode !== 'data-url') throw new Error('Native export supports svg or data-url mode.');
            const { page: result, target } = await page(mode === 'svg' ? 'svg' : 'png');
            const element = target.container.querySelector('canvas,svg') as HTMLCanvasElement | SVGSVGElement | null;
            return {
                mode,
                title: target.name,
                chartType: 'native',
                nRows: 1,
                nCols: 1,
                combinedData: result.content,
                container: () => (target.container.isConnected ? target.container : null),
                charts: [
                    {
                        rowIndex: 0,
                        colIndex: 0,
                        width: result.metadata.width,
                        height: result.metadata.height,
                        canvasWidth: Math.ceil(result.metadata.width * (result.metadata.dpr ?? 1)),
                        canvasHeight: Math.ceil(result.metadata.height * (result.metadata.dpr ?? 1)),
                        data: result.content,
                        canvas: () => (element?.isConnected ? element : null),
                    },
                ],
            };
        },
        dispose() {
            disposed = true;
            getTarget = disposedNativeTarget;
            for (const controller of pending) controller.abort();
            pending.clear();
            for (const url of urls) URL.revokeObjectURL(url);
            urls.clear();
        },
    };
}

export function waitForNativeChart(ctx: IGWHandlerInsider, index: number, isCurrent: () => boolean, timeoutMs = 30_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        let done = false,
            timer: ReturnType<typeof setTimeout> | undefined,
            unsubscribe = () => {};
        const finish = (error?: Error) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            unsubscribe();
            error ? reject(error) : resolve();
        };
        const check = () => {
            if (done) return;
            if (!isCurrent()) return finish(new Error('The chart application was unmounted'));
            if (ctx.chartIndex === index && ctx.renderStatus === 'error') return finish(new Error('The requested chart failed to render'));
            if (ctx.chartIndex === index && ctx.renderStatus === 'idle') return finish();
            if (Date.now() - started >= timeoutMs) return finish(new Error('Timed out waiting for the requested chart'));
            clearTimeout(timer);
            timer = setTimeout(check, 16);
        };
        unsubscribe = ctx.onRenderStatusChange(check);
        timer = setTimeout(check, 0);
    });
}

/** Retained public methods capture only this small API ref, not the hook's result context. */
function createForwardedNativeHandle(apiRef: { current: ReturnType<typeof createNativeExportApi> | undefined }): IReactVegaHandler {
    const active = () => {
        if (!apiRef.current) throw new Error('The native renderer is not mounted');
        return apiRef.current.handle;
    };
    return {
        getSVGData: async () => active().getSVGData(),
        getCanvasData: async () => active().getCanvasData(),
        downloadSVG: async (name) => active().downloadSVG(name),
        downloadPNG: async (name) => active().downloadPNG(name),
    };
}

export function useNativeExportApi(ref: ForwardedRef<IReactVegaHandler>, getTarget: () => NativeExportTarget, status: IRenderStatus) {
    const current = useRef(getTarget);
    current.current = getTarget;
    const apiRef = useRef<ReturnType<typeof createNativeExportApi> | undefined>(undefined);
    const handle = useMemo(() => createForwardedNativeHandle(apiRef), []);
    useImperativeHandle(ref, () => handle, [handle]);
    const appRef = useAppRootContext();
    const app = appRef.current;
    useLayoutEffect(() => {
        const api = createNativeExportApi(() => current.current());
        apiRef.current = api;
        return () => {
            api.dispose();
            if (apiRef.current === api) apiRef.current = undefined;
            // StrictMode immediately replays setup without a new render. Keep the
            // getter through that replay, then release it after a real unmount.
            queueMicrotask(() => {
                if (!apiRef.current) current.current = disposedNativeTarget;
            });
        };
    }, []);
    // AppRoot publishes its imperative handle in the parent's layout effect.
    // Passive registration observes that handle even during StrictMode replay.
    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;
        const ctx = appRef.current,
            priorExport = ctx?.exportChart,
            priorList = ctx?.exportChartList;
        const exportChart = api.exportChart as IGWHandlerInsider['exportChart'];
        const exportChartList = async function* (mode: IChartExportResult['mode'] = 'svg') {
            if (!ctx) throw new Error('The chart application is unavailable');
            const original = ctx.chartIndex,
                total = ctx.chartCount;
            try {
                for (let index = 0; index < total; index++) {
                    ctx.openChart(index);
                    await waitForNativeChart(ctx, index, () => appRef.current === ctx);
                    const data = await ctx.exportChart(mode);
                    if (ctx.chartIndex !== index) throw new Error('The chart changed during list export');
                    yield { mode, total, index, data, hasNext: index + 1 < total };
                }
            } finally {
                if (appRef.current === ctx) ctx.openChart(original);
            }
        } as IGWHandlerInsider['exportChartList'];
        if (ctx) {
            ctx.exportChart = exportChart;
            ctx.exportChartList = exportChartList;
        }
        return () => {
            if (ctx?.exportChart === exportChart && priorExport) ctx.exportChart = priorExport;
            if (ctx?.exportChartList === exportChartList && priorList) ctx.exportChartList = priorList;
        };
    }, [app]);
    useEffect(() => {
        appRef.current?.updateRenderStatus(status);
    }, [app, status]);
}
