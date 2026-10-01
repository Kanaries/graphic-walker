import { useImperativeHandle, type ForwardedRef, useEffect, RefObject } from 'react';
import { useAppRootContext } from '../components/appRoot';
import type { IReactVegaHandler } from '../vis/react-vega';
import type { IChartExportResult, IVegaChartRef } from '../interfaces';

type GridItem = Pick<IVegaChartRef, 'x' | 'y'> & {
    width: number;
    height: number;
};

export interface ICompositeGridItem extends GridItem {
    offsetX: number;
    offsetY: number;
}

export interface ICompositeGridLayout {
    width: number;
    height: number;
    items: ICompositeGridItem[];
}

export function getCompositeGridLayout(items: GridItem[]): ICompositeGridLayout | null {
    if (items.length === 0) {
        return null;
    }

    const columnCount = items.reduce((max, item) => Math.max(max, item.x), 0) + 1;
    const rowCount = items.reduce((max, item) => Math.max(max, item.y), 0) + 1;
    const columnWidths = new Array<number>(columnCount).fill(0);
    const rowHeights = new Array<number>(rowCount).fill(0);

    for (const item of items) {
        columnWidths[item.x] = Math.max(columnWidths[item.x], item.width);
        rowHeights[item.y] = Math.max(rowHeights[item.y], item.height);
    }

    const columnOffsets = new Array<number>(columnCount).fill(0);
    const rowOffsets = new Array<number>(rowCount).fill(0);
    for (let i = 1; i < columnCount; i += 1) {
        columnOffsets[i] = columnOffsets[i - 1] + columnWidths[i - 1];
    }
    for (let i = 1; i < rowCount; i += 1) {
        rowOffsets[i] = rowOffsets[i - 1] + rowHeights[i - 1];
    }

    return {
        width: columnWidths.reduce((sum, width) => sum + width, 0),
        height: rowHeights.reduce((sum, height) => sum + height, 0),
        items: items.map((item) => ({
            ...item,
            offsetX: columnOffsets[item.x],
            offsetY: rowOffsets[item.y],
        })),
    };
}

export function combineCanvases(canvases: HTMLCanvasElement[], refs: IVegaChartRef[]): HTMLCanvasElement | null {
    if (canvases.length === 0 || canvases.length !== refs.length) {
        return null;
    }
    if (canvases.length === 1) {
        return canvases[0];
    }

    const layout = getCompositeGridLayout(
        canvases.map((canvas, index) => ({
            x: refs[index].x,
            y: refs[index].y,
            width: canvas.width,
            height: canvas.height,
        }))
    );
    if (!layout) {
        return null;
    }

    const combinedCanvas = document.createElement('canvas');
    combinedCanvas.width = layout.width;
    combinedCanvas.height = layout.height;
    const context = combinedCanvas.getContext('2d');
    if (!context) {
        return null;
    }

    layout.items.forEach((item, index) => {
        context.drawImage(canvases[index], item.offsetX, item.offsetY);
    });
    return combinedCanvas;
}

function readSvgDimension(svg: string, name: 'width' | 'height', fallback: number): number {
    const openingTag = svg.match(/<svg\b[^>]*>/i)?.[0];
    const value = openingTag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
    const parsed = value ? Number.parseFloat(value) : Number.NaN;
    if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
    }
    const viewBox = openingTag?.match(/\bviewBox\s*=\s*["'][^"']*\s(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)["']/i);
    const viewBoxDimension = viewBox?.[name === 'width' ? 1 : 2];
    const parsedViewBoxDimension = viewBoxDimension ? Number.parseFloat(viewBoxDimension) : Number.NaN;
    return Number.isFinite(parsedViewBoxDimension) && parsedViewBoxDimension >= 0 ? parsedViewBoxDimension : fallback;
}

function namespaceSvgIds(svg: string, prefix: string): string {
    const ids = new Set<string>();
    const withNamespacedIds = svg.replace(/\bid=(["'])([^"']+)\1/g, (_match, quote: string, id: string) => {
        ids.add(id);
        return `id=${quote}${prefix}${id}${quote}`;
    });
    if (ids.size === 0) {
        return withNamespacedIds;
    }
    return withNamespacedIds
        .replace(/url\(\s*#([^)]+?)\s*\)/g, (match, id: string) => (ids.has(id) ? `url(#${prefix}${id})` : match))
        .replace(/\b((?:xlink:)?href)=(["'])#([^"']+)\2/g, (match, attribute: string, quote: string, id: string) =>
            ids.has(id) ? `${attribute}=${quote}#${prefix}${id}${quote}` : match
        )
        .replace(/\b(aria-labelledby|aria-describedby)=(["'])([^"']+)\2/g, (_match, attribute: string, quote: string, value: string) => {
            const namespacedValue = value
                .split(/\s+/)
                .map((id) => (ids.has(id) ? `${prefix}${id}` : id))
                .join(' ');
            return `${attribute}=${quote}${namespacedValue}${quote}`;
        });
}

function positionNestedSvg(svg: string, x: number, y: number, prefix: string): string | null {
    const cleaned = namespaceSvgIds(
        svg
            .replace(/^\s*<\?xml[^>]*>\s*/i, '')
            .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, ''),
        prefix
    );
    if (!/<svg\b/i.test(cleaned)) {
        return null;
    }
    return cleaned.replace(/<svg\b/i, `<svg x="${x}" y="${y}"`);
}

export function combineSVGs(svgs: string[], refs: IVegaChartRef[]): string | null {
    if (svgs.length === 0 || svgs.length !== refs.length) {
        return null;
    }
    if (svgs.length === 1) {
        return svgs[0];
    }

    const layout = getCompositeGridLayout(
        svgs.map((svg, index) => ({
            x: refs[index].x,
            y: refs[index].y,
            width: readSvgDimension(svg, 'width', refs[index].w),
            height: readSvgDimension(svg, 'height', refs[index].h),
        }))
    );
    if (!layout) {
        return null;
    }

    const children = layout.items.map((item, index) => positionNestedSvg(svgs[index], item.offsetX, item.offsetY, `gw-export-${index}-`));
    if (children.some((child) => child === null)) {
        return null;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${children.join(
        ''
    )}</svg>`;
}

export const useVegaExportApi = (
    name: string | undefined,
    viewsRef: RefObject<IVegaChartRef[]>,
    ref: ForwardedRef<IReactVegaHandler>,
    renderTaskRefs: RefObject<Promise<unknown>[]>,
    containerRef: RefObject<HTMLDivElement | null>,
) => {
    const getSVGs = () =>
        Promise.all(
            viewsRef.current.map((item) => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toSVG();
            })
        );
    const getCanvases = () =>
        Promise.all(
            viewsRef.current.map((item) => {
                if (!item.view) {
                    throw new Error('View is not available');
                }
                return item.view.toCanvas(2);
            })
        );
    const renderHandle = {
        async getSVGData() {
            const data = combineSVGs(await getSVGs(), viewsRef.current);
            return data ? [data] : [];
        },
        async getCanvasData() {
            const canvas = combineCanvases(await getCanvases(), viewsRef.current);
            return canvas ? [canvas.toDataURL('image/png', 1)] : [];
        },
        async downloadSVG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
            const data = combineSVGs(await getSVGs(), viewsRef.current);
            if (!data) {
                return [];
            }
            const file = new File([data], `${filename}.svg`, { type: 'image/svg+xml' });
            const url = URL.createObjectURL(file);
            const anchor = document.createElement('a');
            anchor.download = file.name;
            anchor.href = url;
            anchor.click();
            requestAnimationFrame(() => {
                URL.revokeObjectURL(url);
            });
            return [data];
        },
        async downloadPNG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
            const canvas = combineCanvases(await getCanvases(), viewsRef.current);
            if (!canvas) {
                return [];
            }
            const data = canvas.toDataURL('image/png', 1);
            const anchor = document.createElement('a');
            anchor.download = `${filename}.png`;
            anchor.href = data.replace(/^data:image\/[^;]/, 'data:application/octet-stream');
            anchor.click();
            return [data];
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
                    const canvases = await getCanvases();
                    for (let i = 0; i < canvases.length; i += 1) {
                        res.charts[i].data = canvases[i].toDataURL('image/png', 1);
                    }
                    res.combinedData = combineCanvases(canvases, viewsRef.current)?.toDataURL('image/png', 1);
                } else if (mode === 'svg') {
                    const svgs = await getSVGs();
                    for (let i = 0; i < svgs.length; i += 1) {
                        res.charts[i].data = svgs[i];
                    }
                    res.combinedData = combineSVGs(svgs, viewsRef.current) ?? undefined;
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
