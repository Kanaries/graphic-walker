import type { RefObject } from 'react';
import type { IChartExportResult, IGWHandlerInsider } from '../interfaces';
import type { NativeRendererHandle } from './nativeTypes';

const empty = (mode: IChartExportResult['mode']): IChartExportResult => ({ mode, title: '', nCols: 0, nRows: 0, charts: [], chartType: 'worksheet', container: () => null });

/**
 * Gives the host's `exportChart` and `exportChartList` to the native renderer while it draws.
 * The Vega renderer installs its own on mount and removes them on unmount; this does the same,
 * so whichever renderer is on screen answers. A native chart is one image, reported as a
 * single cell. Returns the function that takes them out again.
 */
export function installNativeExport(
    ctx: IGWHandlerInsider,
    source: { handle: RefObject<NativeRendererHandle | null>; container: RefObject<HTMLDivElement | null>; title: string }
): () => void {
    // As for the Vega renderer: wait for a chart that is still loading, up to ten seconds.
    const settled = () =>
        new Promise<void>((resolve, reject) => {
            if (ctx.renderStatus === 'idle') return resolve();
            if (ctx.renderStatus === 'error') return reject(new Error('Error occurred when rendering chart'));
            const timer = setTimeout(() => finish(new Error('Timeout')), 10_000);
            const dispose = ctx.onRenderStatusChange((status) => {
                if (status === 'idle') finish();
                else if (status === 'error') finish(new Error('Error occurred when rendering chart'));
            });
            function finish(error?: Error) {
                clearTimeout(timer);
                dispose();
                if (error) reject(error);
                else resolve();
            }
        });
    const exportChart = async (mode: IChartExportResult['mode'] = 'svg'): Promise<IChartExportResult> => {
        try {
            await settled();
            const handle = source.handle.current;
            if (!handle) throw new Error('The chart is not drawn yet.');
            const { width, height } = handle.size();
            const data = mode === 'svg' ? await handle.exportSVG() : await handle.exportPNG();
            return {
                mode,
                title: source.title || 'untitled',
                combinedData: data,
                nCols: 1,
                nRows: 1,
                charts: [{ rowIndex: 0, colIndex: 0, width, height, canvasWidth: width, canvasHeight: height, data, canvas: () => source.container.current?.querySelector('canvas') ?? null }],
                container: () => source.container.current,
                chartType: 'worksheet',
            };
        } catch (error) {
            console.error('exportChart failed:', `${error}`);
            return empty(mode);
        }
    };
    // The editor reports the chart it shows once that chart is mounted. Two seconds is far more than that takes;
    // after it the export goes on and reports what it finds.
    const opened = async (index: number) => {
        const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
        const deadline = Date.now() + 2_000;
        await tick();
        while (ctx.chartIndex !== index && Date.now() < deadline) await tick();
    };
    const exportChartList = async function* (mode: IChartExportResult['mode'] = 'svg') {
        const total = ctx.chartCount;
        const current = ctx.chartIndex;
        for (let index = 0; index < total; index += 1) {
            ctx.openChart(index);
            // Wait until the editor shows that chart. By then whichever renderer draws it has put its own
            // exportChart in place and has said that it is at work, so the export waits for this chart
            // and not for the one that was on screen before.
            await opened(index);
            yield { mode, total, index, data: await ctx.exportChart(mode), hasNext: index < total - 1 };
        }
        ctx.openChart(current);
    };
    ctx.exportChart = exportChart as IGWHandlerInsider['exportChart'];
    ctx.exportChartList = exportChartList as IGWHandlerInsider['exportChartList'];
    return () => {
        // Only take out what is still ours; the next renderer may already have installed its own.
        if (ctx.exportChart === exportChart) ctx.exportChart = (async (mode: IChartExportResult['mode'] = 'svg') => empty(mode)) as IGWHandlerInsider['exportChart'];
        if (ctx.exportChartList === exportChartList) {
            ctx.exportChartList = async function* (mode: IChartExportResult['mode'] = 'svg') {
                yield { mode, total: 1, completed: 0, index: 0, data: empty(mode), hasNext: false };
            } as IGWHandlerInsider['exportChartList'];
        }
    };
}
