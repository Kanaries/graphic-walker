import type { IGWHandlerInsider, IRenderStatus } from '../interfaces';
import { installNativeExport } from './nativeHostExport';
import type { NativeRendererHandle } from './nativeTypes';

function host(initial: IRenderStatus = 'idle') {
    let status = initial;
    let listeners: ((status: IRenderStatus) => void)[] = [];
    const opened: number[] = [];
    const ctx = {
        get renderStatus() {
            return status;
        },
        onRenderStatusChange(cb: (status: IRenderStatus) => void) {
            listeners.push(cb);
            return () => {
                listeners = listeners.filter((which) => which !== cb);
            };
        },
        updateRenderStatus(next: IRenderStatus) {
            status = next;
            listeners.forEach((cb) => cb(next));
        },
        chartCount: 2,
        chartIndex: 1,
        // As the editor does it: the chart it shows is reported a moment after it was asked for.
        openChart(index: number) {
            opened.push(index);
            setTimeout(() => (ctx.chartIndex = index), 5);
        },
        exportChart: undefined as unknown,
        exportChartList: undefined as unknown,
    } as unknown as IGWHandlerInsider;
    return { ctx, opened, listening: () => listeners.length };
}
const handle: NativeRendererHandle = {
    exportSVG: async () => '<svg/>',
    exportPNG: async () => 'data:image/png;base64,AAAA',
    exportCSV: () => 'a,b',
    size: () => ({ width: 640, height: 320 }),
};
const source = (current: NativeRendererHandle | null = handle) => ({ handle: { current }, container: { current: null }, title: 'Sales' });

describe('installNativeExport', () => {
    test('exports the chart as one cell, as SVG or as a PNG data URL', async () => {
        const { ctx } = host();
        installNativeExport(ctx, source());
        const svg = await ctx.exportChart();
        expect(svg).toMatchObject({ mode: 'svg', title: 'Sales', nCols: 1, nRows: 1, combinedData: '<svg/>', chartType: 'worksheet' });
        expect(svg.charts).toMatchObject([{ rowIndex: 0, colIndex: 0, width: 640, height: 320, canvasWidth: 640, canvasHeight: 320, data: '<svg/>' }]);
        expect(svg.charts[0].canvas()).toBeNull();
        const png = await ctx.exportChart('data-url');
        expect(png.charts[0].data).toBe('data:image/png;base64,AAAA');
    });
    test('waits for a chart that is still loading and gives an empty result when it fails', async () => {
        const loading = host('computing');
        installNativeExport(loading.ctx, source());
        const pending = loading.ctx.exportChart();
        loading.ctx.updateRenderStatus('rendering');
        loading.ctx.updateRenderStatus('idle');
        expect((await pending).charts).toHaveLength(1);
        expect(loading.listening()).toBe(0);

        const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const failing = host('computing');
        installNativeExport(failing.ctx, source());
        const failed = failing.ctx.exportChart();
        failing.ctx.updateRenderStatus('error');
        expect(await failed).toMatchObject({ charts: [], nCols: 0 });
        // Nothing to export from: an empty result, not a rejection.
        const unmounted = host();
        installNativeExport(unmounted.ctx, source(null));
        expect((await unmounted.ctx.exportChart()).charts).toEqual([]);
        errors.mockRestore();
    });
    test('the list opens every chart in turn and returns to the one that was open', async () => {
        const { ctx, opened } = host();
        installNativeExport(ctx, source());
        const results: unknown[] = [];
        for await (const item of ctx.exportChartList()) results.push([item.index, item.total, item.hasNext, item.data.charts.length]);
        expect(results).toEqual([
            [0, 2, true, 1],
            [1, 2, false, 1],
        ]);
        expect(opened).toEqual([0, 1, 1]);
    });
    test('uninstalling leaves a later renderer’s functions alone', async () => {
        const { ctx } = host();
        const uninstall = installNativeExport(ctx, source());
        const own = ctx.exportChart;
        uninstall();
        expect(ctx.exportChart).not.toBe(own);
        expect((await ctx.exportChart()).charts).toEqual([]);

        const again = installNativeExport(ctx, source());
        const later = (async () => ({ mode: 'svg', title: 'vega', nCols: 1, nRows: 1, charts: [], container: () => null })) as unknown as IGWHandlerInsider['exportChart'];
        ctx.exportChart = later;
        again();
        expect(ctx.exportChart).toBe(later);
    });
});
