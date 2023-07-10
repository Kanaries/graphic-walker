import { useImperativeHandle, type ForwardedRef, type MutableRefObject, useEffect } from "react";
import type { View } from "vega";
import { useAppRootContext } from "../components/appRoot";
import type { IReactVegaHandler } from "../vis/react-vega";
import type { IChartExportResult } from "../interfaces";


export const useVegaExportApi = (name: string | undefined, viewsRef: MutableRefObject<{ x: number; y: number; w: number; h: number; view: View }[]>, ref: ForwardedRef<IReactVegaHandler>) => {
    const renderHandle = {
        getSVGData() {
            return Promise.all(viewsRef.current.map(item => item.view.toSVG()));
        },
        async getCanvasData() {
            const canvases = await Promise.all(viewsRef.current.map(item => item.view.toCanvas(2)));
            return canvases.map(canvas => canvas.toDataURL('image/png', 1));
        },
        async downloadSVG(filename = `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0')) {
            const data = await Promise.all(viewsRef.current.map(item => item.view.toSVG()));
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
            const canvases = await Promise.all(viewsRef.current.map(item => item.view.toCanvas(2)));
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
        if (appRef && 'current' in appRef && appRef.current) {
            appRef.current.exportChart = (async (mode: IChartExportResult['mode'] = 'svg') => {
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
                        data: '',
                    })),
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
            }) as typeof appRef.current.exportChart;
        }
    });

    useEffect(() => {
        return () => {
            if (appRef && 'current' in appRef && appRef.current) {
                appRef.current.exportChart = async mode => ({
                    mode,
                    title: '',
                    nCols: 0,
                    nRows: 0,
                    charts: [],
                });
            }
        };
    }, []);
};
