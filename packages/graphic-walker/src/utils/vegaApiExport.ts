import { useImperativeHandle, type ForwardedRef, useEffect, RefObject } from "react";
import { useAppRootContext } from "../components/appRoot";
import type { IReactVegaHandler } from "../vis/react-vega";
import type { IChartExportResult, IVegaChartRef } from "../interfaces";


export const useVegaExportApi = (
    name: string | undefined,
    viewsRef: RefObject<IVegaChartRef[]>,
    ref: ForwardedRef<IReactVegaHandler>,
    renderTaskRefs: RefObject<Promise<unknown>[]>,
    containerRef: RefObject<HTMLDivElement | null>,
) => {
    const renderHandle = {
        getSVGData() {
            return Promise.all(viewsRef.current.map(item => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toSVG();
            }));
        },
        async getCanvasData() {
            const canvases = await Promise.all(viewsRef.current.map(item => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toCanvas(2);
            }));
            return canvases.map(canvas => canvas.toDataURL('image/png', 1));
        },
        async downloadSVG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
            const data = await Promise.all(viewsRef.current.map(item => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toSVG();
            }));
            const files: string[] = [];
            for (let i = 0; i < data.length; i += 1) {
                const d = data[i];
                const file = new File([d], `${filename}${data.length > 1 ? `_${i + 1}` : ''}.svg`);
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.download = file.name;
                a.href = url;
                a.click();
                requestAnimationFrame(() => {
                    URL.revokeObjectURL(url);
                });
            }
            return files;
        },
        async downloadPNG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
            const canvases = await Promise.all(viewsRef.current.map(item => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toCanvas(2);
            }));
            const data = canvases.map(canvas => canvas.toDataURL('image/png', 1));
            const files: string[] = [];
            for (let i = 0; i < data.length; i += 1) {
                const d = data[i];
                const a = document.createElement('a');
                a.download = `${filename}${data.length > 1 ? `_${i + 1}` : ''}.png`;
                a.href = d.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
                a.click();
            }
            return files;
        },
    };
    
    useImperativeHandle(ref, () => renderHandle);

    const appRef = useAppRootContext();
    
    useEffect(() => {
        const ctx = appRef.current;
        if (ctx) {
            Promise.all(renderTaskRefs.current).then(() => {
                if (appRef.current) {
                    const appCtx = appRef.current;
                    if (appCtx.renderStatus !== 'rendering') {
                        return;
                    }
                    // add a short delay to wait for the canvas to be ready
                    setTimeout(() => {
                        if (appCtx.renderStatus !== 'rendering') {
                            return;
                        }
                        appCtx.updateRenderStatus('idle');
                    }, 0);
                }
            }).catch(() => {
                if (appRef.current) {
                    if (appRef.current.renderStatus !== 'rendering') {
                        return;
                    }
                    appRef.current.updateRenderStatus('error');
                }
            });
            ctx.exportChart = (async (mode: IChartExportResult['mode'] = 'svg') => {
                if (ctx.renderStatus === 'error') {
                    console.error('exportChart failed because error occurred when rendering chart.');
                    return {
                        mode,
                        title: '',
                        nCols: 0,
                        nRows: 0,
                        charts: [],
                        chartType: 'vega',
                        container() {
                            return null;
                        },
                    };
                }
                if (ctx.renderStatus !== 'idle') {
                    let dispose = null as (() => void) | null;
                    // try to wait for a while
                    const waitForChartReady = new Promise<void>((resolve, reject) => {
                        dispose = ctx.onRenderStatusChange(status => {
                            if (status === 'error') {
                                reject(new Error('Error occurred when rendering chart'));
                            } else if (status === 'idle') {
                                resolve();
                            }
                        });
                        setTimeout(() => reject(new Error('Timeout')), 10_000);
                    });
                    try {
                        await waitForChartReady;
                    } catch (error) {
                        console.error('exportChart failed:', `${error}`);
                        return {
                            mode,
                            title: '',
                            nCols: 0,
                            nRows: 0,
                            charts: [],
                            chartType: 'vega',
                            container() {
                                return null;
                            },
                        };
                    } finally {
                        dispose?.();
                    }
                }
                const res: IChartExportResult = {
                    mode,
                    title: name || 'untitled',
                    nCols: viewsRef.current.map(item => item.x).reduce((a, b) => Math.max(a, b), 0) + 1,
                    nRows: viewsRef.current.map(item => item.y).reduce((a, b) => Math.max(a, b), 0) + 1,
                    charts: viewsRef.current.map(item => ({
                        rowIndex: item.y,
                        colIndex: item.x,
                        width: item.w,
                        height: item.h,
                        canvasWidth: item.innerWidth,
                        canvasHeight: item.innerHeight,
                        data: '',
                        canvas() {
                            // Filter out HTMLElement to match the expected return type
                            const canvas = item.canvas;
                            if (canvas instanceof HTMLCanvasElement || canvas instanceof SVGSVGElement) {
                                return canvas;
                            }
                            return null;
                        },
                    })),
                    container() {
                        return containerRef.current;
                    },
                    chartType: 'vega',
                };
                if (mode === 'data-url') {
                    const imgData = await renderHandle.getCanvasData();
                    if (imgData) {
                        for (let i = 0; i < imgData.length; i += 1) {
                            res.charts[i].data = imgData[i];
                        }
                    }
                } else if (mode === 'svg') {
                    const svgData = await renderHandle.getSVGData();
                    if (svgData) {
                        for (let i = 0; i < svgData.length; i += 1) {
                            res.charts[i].data = svgData[i];
                        }
                    }
                }
                return res;
            }) as typeof ctx.exportChart;
            ctx.exportChartList = async function * exportChartList (mode: IChartExportResult['mode'] = 'svg') {
                const total = ctx.chartCount;
                const indices = new Array(total).fill(0).map((_, i) => i);
                const currentIdx = ctx.chartIndex;
                for await (const index of indices) {
                    ctx.openChart(index);
                    // wait for a while to make sure the correct chart is rendered
                    await new Promise<void>(resolve => setTimeout(resolve, 0));
                    const chart = await ctx.exportChart(mode);
                    yield {
                        mode,
                        total,
                        index,
                        data: chart,
                        hasNext: index < total - 1,
                    };
                }
                ctx.openChart(currentIdx);
            };
        }
    });

    useEffect(() => {
        // NOTE: this is totally a cleanup function
        return () => {
            if (appRef.current) {
                appRef.current.updateRenderStatus('idle');
                appRef.current.exportChart = async (mode: IChartExportResult['mode'] = 'svg') => ({
                    mode,
                    title: '',
                    nCols: 0,
                    nRows: 0,
                    charts: [],
                    chartType: 'vega',
                    container() {
                        return null;
                    },
                });
                appRef.current.exportChartList = async function * exportChartList (mode: IChartExportResult['mode'] = 'svg') {
                    yield {
                        mode,
                        total: 1,
                        completed: 0,
                        index: 0,
                        data: {
                            mode,
                            title: '',
                            nCols: 0,
                            nRows: 0,
                            charts: [],
                            chartType: 'vega',
                            container() {
                                return null;
                            },
                        },
                        hasNext: false,
                    };
                };
            }
        };
    }, []);
};
