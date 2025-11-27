import React, { useEffect, useState, useMemo, useRef, useContext, forwardRef, RefObject } from 'react';
import * as Plot from '@observablehq/plot';
import styled from 'styled-components';
import { useResizeDetector } from 'react-resize-detector';
import { Subject } from 'rxjs';

// ---- your existing interfaces/types ----
import {
    IViewField,
    IRow,
    IStackMode,
    VegaGlobalConfig,
    IChannelScales,
    IConfigScaleSet,
    IDarkMode,
    IVegaChartRef, // can ename to something else, but we’ll keep it for reference
} from '../interfaces';
import { themeContext } from '@/store/theme';
import { useReporter, Errors } from '../utils/reportError';
import { useVegaExportApi } from '../utils/vegaApiExport';
import canvasSize from 'canvas-size';
import { startTask } from '../utils';
import { toObservablePlotSpec } from '@/lib/observablePlot';

// Example container styled similarly to your Vega-Lite container:
const CanvasContainer = styled.div<{ rowSize: number; colSize: number }>`
    display: grid;
    grid-template-columns: repeat(${(props) => props.colSize}, auto);
    grid-template-rows: repeat(${(props) => props.rowSize}, 1fr);
`;

// For referencing selection events:
const SELECTION_NAME = 'geom';
const click$ = new Subject<PointerEvent>();
const selection$ = new Subject<any>();

// If you want to replicate cross-filtering, you’ll need more advanced logic.
const BRUSH_SIGNAL_NAME = '__gw_brush__';
const POINT_SIGNAL_NAME = '__gw_point__';

interface IReactPlotHandler {
    getSVGData: () => Promise<string[]>;
    getCanvasData: () => Promise<string[]>;
    downloadSVG: (filename?: string) => Promise<string[]>;
    downloadPNG: (filename?: string) => Promise<string[]>;
}

export interface ObservablePlotProps {
    name?: string;
    rows: Readonly<IViewField[]>;
    columns: Readonly<IViewField[]>;
    dataSource: readonly IRow[];
    defaultAggregate?: boolean;
    stack: IStackMode;
    interactiveScale: boolean;
    geomType: string;
    color?: IViewField;
    opacity?: IViewField;
    size?: IViewField;
    shape?: IViewField;
    theta?: IViewField;
    radius?: IViewField;
    text?: IViewField;
    details?: Readonly<IViewField[]>;
    showActions: boolean;
    layoutMode: string;
    width: number;
    height: number;
    onGeomClick?: (values: any, e: any) => void;
    vegaConfig: VegaGlobalConfig;
    /** @default "en-US" */
    locale?: string;
    useSvg?: boolean;
    dark?: IDarkMode;
    scales?: IChannelScales;
    scale?: IConfigScaleSet;
    onReportSpec?: (spec: string) => void;
    displayOffset?: number;
}

/**
 * Minimal function that attempts to build an Observable Plot spec
 * from your data & field definitions, focusing on the geomType, color,
 * defaultAggregate, stacking, etc. This is just a placeholder function:
 * you’ll need to expand it significantly to match your actual needs.
 */
function toPlotSpec(props: ObservablePlotProps) {
    const { dataSource, geomType, color, defaultAggregate, stack } = props;

    /**
     * For advanced usage, you’ll want to handle:
     *   - dimension vs measure fields
     *   - transforms (grouping, binning, stacking)
     *   - different geomType => Plot.mark
     *   - encoding: color, opacity, size, shape, text, etc.
     */
    let mark: Plot.Mark;

    // Minimal example: a bar or point geometry
    switch (geomType) {
        case 'bar':
            mark = Plot.barY(dataSource as any, {
                x: (d: any) => d[/* your x field */ 'category'],
                y: (d: any) => d[/* your measure field */ 'value'],
                fill: color ? (d: any) => d[color.fid] : undefined,
            });
            break;
        case 'point':
        default:
            mark = Plot.dot(dataSource as any, {
                x: (d: any) => d[/* your x field */ 'category'],
                y: (d: any) => d[/* your measure field */ 'value'],
                fill: color ? (d: any) => d[color.fid] : undefined,
            });
            break;
    }

    // If you want stacking (for bar, area, etc.), you might do:
    //   Plot.barY(…, Plot.stackY(…)) or an aggregator: Plot.groupY({y: "sum"}, {…})
    // This is just an example placeholder; adapt as needed.

    const plotOptions: any = {
        marks: [mark],
        // e.g. zero: true => for bar
        y: { nice: true },
        // you could add further config here, e.g. color scales, legends, axes, etc.
    };

    return plotOptions;
}

/**
 * This component attempts to replicate the same multi-chart layout
 * from rowRepeatFields * colRepeatFields. It does not implement
 * cross-filtering by default. If you want that, you’ll need to
 * manually add pointer/brush listeners, manage the state store, etc.
 */
const ObservablePlotRenderer = forwardRef<IReactPlotHandler, ObservablePlotProps>(function ObservablePlotRenderer(props, ref) {
    const {
        name,
        rows = [],
        columns = [],
        dataSource = [],
        defaultAggregate = true,
        stack = 'stack',
        geomType,
        color,
        opacity,
        size,
        theta,
        radius,
        shape,
        text,
        onGeomClick,
        showActions,
        interactiveScale,
        layoutMode,
        width,
        height,
        details = [],
        locale = 'en-US',
        useSvg,
        scales: channelScaleRaw,
        scale,
        displayOffset,
        vegaConfig,
        onReportSpec,
    } = props;

    const mediaTheme = useContext(themeContext);
    const { reportError: reportGWError } = useReporter();

    const guardedRows = useMemo(() => rows.filter((x) => defaultAggregate || x.aggName !== 'expr'), [rows, defaultAggregate]);
    const guardedCols = useMemo(() => columns.filter((x) => defaultAggregate || x.aggName !== 'expr'), [columns, defaultAggregate]);
    const rowDims = useMemo(() => guardedRows.filter((f) => f.analyticType === 'dimension'), [guardedRows]);
    const colDims = useMemo(() => guardedCols.filter((f) => f.analyticType === 'dimension'), [guardedCols]);
    const rowMeas = useMemo(() => guardedRows.filter((f) => f.analyticType === 'measure'), [guardedRows]);
    const colMeas = useMemo(() => guardedCols.filter((f) => f.analyticType === 'measure'), [guardedCols]);
    const rowRepeatFields = useMemo(() => (rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas), [rowDims, rowMeas]); //rowMeas.slice(0, -1);
    const colRepeatFields = useMemo(() => (colMeas.length === 0 ? colDims.slice(-1) : colMeas), [colDims, colMeas]); //colMeas.slice(0, -1);
    // track placeholders for each sub-view:
    const [plotPlaceholders, setPlotPlaceholders] = useState<React.RefObject<HTMLDivElement | null>[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewNum = Math.max(1, rowRepeatFields.length * colRepeatFields.length);
        setPlotPlaceholders((old) => {
            if (viewNum === old.length) return old;
            return new Array(viewNum).fill(null).map((_, i) => old[i] || React.createRef());
        });
    }, [rowRepeatFields, colRepeatFields]);

    // resizing:
    const { width: areaWidth, height: areaHeight, ref: areaRef } = useResizeDetector();
    const computedSize = useMemo(() => {
        if (layoutMode === 'auto') {
            return { w: 0, h: 0 };
        }
        if (layoutMode === 'full' && areaWidth && areaHeight) {
            return { w: areaWidth, h: areaHeight };
        }
        return { w: width, h: height };
    }, [layoutMode, width, height, areaWidth, areaHeight]);

    // In a multi-view scenario, we build one “Plot.Options” per sub-view:
    const specs = useMemo(() => {
        let specsArr: any[] = [];
        if (rowRepeatFields.length === 0 && colRepeatFields.length === 0) {
            return []
        }
        const count = rowRepeatFields.length * colRepeatFields.length;

        console.log({ count, rowRepeatFields, colRepeatFields });
        specsArr = toObservablePlotSpec({
            columns: guardedCols,
            dataSource,
            defaultAggregated: defaultAggregate,
            geomType,
            height: computedSize.h ?? 300,
            interactiveScale,
            layoutMode,
            mediaTheme,
            rows: guardedRows,
            stack,
            width: computedSize.w ?? 400,
            scales: channelScaleRaw,
            color,
            details,
            opacity,
            radius,
            shape,
            size,
            text,
            theta,
            vegaConfig,
            displayOffset,
        })
        // for (let i = 0; i < count; i++) {
        //     specsArr.push(
        //         ...toObservablePlotSpec({
        //             columns: guardedCols,
        //             dataSource,
        //             defaultAggregated: defaultAggregate,
        //             geomType,
        //             height: computedSize.h ?? 300,
        //             interactiveScale,
        //             layoutMode,
        //             mediaTheme,
        //             rows: guardedRows,
        //             stack,
        //             width: computedSize.w ?? 400,
        //             scales: channelScaleRaw,
        //             color,
        //             details,
        //             opacity,
        //             radius,
        //             shape,
        //             size,
        //             text,
        //             theta,
        //             vegaConfig,
        //             displayOffset,
        //         })
        //     );
        // }
        console.log({ specsArr });
        return specsArr;
    }, [props, rowRepeatFields, colRepeatFields]);

    // If you want to report the spec to devtools or logs:
    useEffect(() => {
        if (onReportSpec) {
            // A naive approach: just JSONify the entire array
            onReportSpec(JSON.stringify(specs, null, 2));
        }
        return () => {
            onReportSpec?.('');
        };
    }, [specs]);

    // For storing references to the final <svg> or <canvas> elements, etc.
    const plotRefs = useRef<IVegaChartRef[]>([]);

    useEffect(() => {
        // Clear old plots first
        plotRefs.current.forEach((plotRef) => {
            if (plotRef.canvas && plotRef.canvas.parentNode) {
                plotRef.canvas.parentNode.removeChild(plotRef.canvas);
            }
        });
        plotRefs.current = [];

        specs.forEach((plotSpec, index) => {
            const placeholder = plotPlaceholders[index]?.current;
            if (!placeholder) return;

            // clear old children if any
            placeholder.innerHTML = '';

            // create new plot
            const plotElem = Plot.plot({
                ...plotSpec,
                // You can also control the width/height from the parent
                width: layoutMode === 'auto' ? undefined : (computedSize.w ?? 400) / Math.max(1, colRepeatFields.length),
                height: layoutMode === 'auto' ? undefined : (computedSize.h ?? 300) / Math.max(1, rowRepeatFields.length),
            });

            // Attach it
            placeholder.appendChild(plotElem);

            // For reference, store in plotRefs
            plotRefs.current.push({
                w: plotElem.clientWidth,
                h: plotElem.clientHeight,
                x: index % Math.max(1, colRepeatFields.length),
                y: Math.floor(index / Math.max(1, colRepeatFields.length)),
                view: null, // No direct “view” object in Plot
                canvas: plotElem, // The actual DOM node (usually an <svg> or <figure>)
                innerWidth: plotElem.clientWidth,
                innerHeight: plotElem.clientHeight,
            });

            // Example: attach a pointer click. (This won't replicate selection signals, but might let you do something.)
            plotElem.addEventListener('pointerdown', (e: Event) => {
                click$.next(e as PointerEvent);
                onGeomClick?.(null, e as PointerEvent); // pass real data as needed
            });

            // If you want to test for “canvas exceeded size”
            startTask(() => {
                const success =
                    layoutMode !== 'auto' ||
                    useSvg ||
                    canvasSize.test({
                        width: plotElem.clientWidth || 1,
                        height: plotElem.clientHeight || 1,
                    });
                if (!success) {
                    reportGWError('canvas exceed max size', Errors.canvasExceedSize);
                }
            });
        });

        return () => {
            // cleanup
            plotRefs.current.forEach((plotRef) => {
                if (plotRef.canvas && plotRef.canvas.parentNode) {
                    plotRef.canvas.parentNode.removeChild(plotRef.canvas);
                }
            });
            plotRefs.current = [];
        };
    }, [specs, plotPlaceholders, computedSize]);

    // -- Example stubs for the IReactPlotHandler ref:
    React.useImperativeHandle(
        ref,
        () => ({
            getSVGData: async () => {
                // For each sub-plot, read the <svg> outerHTML:
                const results: string[] = [];
                plotRefs.current.forEach((ref) => {
                    if (ref.canvas instanceof SVGSVGElement) {
                        results.push(ref.canvas.outerHTML);
                    } else if (ref.canvas?.querySelector?.('svg')) {
                        const svg = ref.canvas.querySelector('svg');
                        if (svg) {
                            results.push(svg.outerHTML);
                        }
                    }
                });
                return results;
            },
            getCanvasData: async () => {
                // If using <canvas> in Plot, you’d do something similar:
                const results: string[] = [];
                plotRefs.current.forEach((ref) => {
                    const canvas = ref.canvas?.querySelector?.('canvas');
                    if (canvas) {
                        // Convert to data URL:
                        results.push(canvas.toDataURL());
                    }
                });
                return results;
            },
            downloadSVG: async (filename?: string) => {
                // Example: gather all SVG, push a separate download
                const data = await (ref as any).current?.getSVGData();
                // you’d implement your own file-saver logic
                return data;
            },
            downloadPNG: async (filename?: string) => {
                const data = await (ref as any).current?.getCanvasData();
                // you’d implement your own file-saver logic
                return data;
            },
        }),
        []
    );

    // Use the same exported hook as your VegaLite version for naming consistency:
    // useVegaExportApi(name, plotRefs, ref, [], containerRef);

    return (
        <div
            className={layoutMode === 'auto' ? 'w-fit h-fit relative' : 'w-full h-full relative'}
            style={{ overflow: layoutMode === 'auto' ? 'visible' : 'hidden' }}
        >
            <div ref={areaRef} className="inset-0 absolute" />
            <CanvasContainer
                style={{
                    ...(layoutMode === 'auto' ? {} : { width: '100%', height: '100%' }),
                }}
                rowSize={Math.max(rowRepeatFields.length, 1)}
                colSize={Math.max(colRepeatFields.length, 1)}
                ref={containerRef}
            >
                {plotPlaceholders.map((plotRef, i) => (
                    <div key={i} ref={plotRef} className={layoutMode === 'auto' ? '' : 'overflow-hidden'}></div>
                ))}
            </CanvasContainer>
        </div>
    );
});

export default ObservablePlotRenderer;
