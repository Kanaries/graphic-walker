import React, { useEffect, useState, useMemo, forwardRef, useRef, useContext } from 'react';
import embed from 'vega-embed';
import { Subject, Subscription } from 'rxjs';
import * as op from 'rxjs/operators';
import { expressionFunction, type ScenegraphEvent } from 'vega';
import styled from 'styled-components';
import { useVegaExportApi } from '../utils/vegaApiExport';
import { IViewField, IRow, IStackMode, VegaGlobalConfig, IVegaChartRef, IChannelScales, IDarkMode, IConfigScaleSet } from '../interfaces';
import { getVegaTimeFormatRules } from './temporalFormat';
import canvasSize from 'canvas-size';
import { Errors, useReporter } from '../utils/reportError';
import { toVegaSpec } from '../lib/vega';
import { useResizeDetector } from 'react-resize-detector';
import { startTask } from '../utils';
import { themeContext } from '@/store/theme';
import { format } from 'd3-format';

expressionFunction('formatBin', (datum: [number, number] | number, formatString?: string) => {
    const formatter = formatString ? format(formatString) : (x) => x;
    // only append on the tooltip field
    if (!Array.isArray(datum)) {
        return formatter(datum);
    }
    const [min, max] = datum;
    const step = max - min;
    if (step === 0) {
        return `[${formatter(min)},${formatter(max)}]`;
    }
    const beaStep = Math.max(-Math.round(Math.log10(step)) + 2, 0);
    return `[${formatter(Number(min.toFixed(beaStep)))},${formatter(Number(max.toFixed(beaStep)))}]`;
});

const CanvaContainer = styled.div<{ rowSize: number; colSize: number }>`
    display: grid;
    grid-template-columns: repeat(${(props) => props.colSize}, auto);
    grid-template-rows: repeat(${(props) => props.rowSize}, 1fr);
`;

function parseRect(el: HTMLCanvasElement | SVGSVGElement) {
    if (el instanceof HTMLCanvasElement) {
        return {
            width: parseInt(el.style.width || `${el.width}`),
            height: parseInt(el.style.height || `${el.height}`),
            renderWidth: el.width,
            renderHeight: el.height,
        };
    } else if (el instanceof SVGSVGElement) {
        const width = el.width.baseVal.value;
        const height = el.height.baseVal.value;
        return {
            width,
            height,
            renderWidth: 0,
            renderHeight: 0,
        };
    }
}

const SELECTION_NAME = 'geom';
export interface IReactVegaHandler {
    getSVGData: () => Promise<string[]>;
    getCanvasData: () => Promise<string[]>;
    downloadSVG: (filename?: string) => Promise<string[]>;
    downloadPNG: (filename?: string) => Promise<string[]>;
}
interface ReactVegaProps {
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

const click$ = new Subject<ScenegraphEvent>();
const selection$ = new Subject<any>();
const geomClick$ = selection$.pipe(
    op.withLatestFrom(click$),
    op.filter(([values, _]) => {
        if (Object.keys(values).length > 0) {
            return true;
        }
        return false;
    })
);

const BRUSH_SIGNAL_NAME = '__gw_brush__';
const POINT_SIGNAL_NAME = '__gw_point__';

interface ParamStoreEntry {
    signal: typeof BRUSH_SIGNAL_NAME | typeof POINT_SIGNAL_NAME;
    /** 这个标记用于防止循环 */
    source: number;
    data: any;
}

const leastOne = (x: number) => Math.max(x, 1);

const ReactVega = forwardRef<IReactVegaHandler, ReactVegaProps>(function ReactVega(props, ref) {
    const {
        name,
        dataSource = [],
        rows = [],
        columns = [],
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
        // themeKey = 'vega',
        vegaConfig,
        // format
        locale = 'en-US',
        useSvg,
        scales: channelScaleRaw,
        scale,
        displayOffset,
    } = props;
    const [viewPlaceholders, setViewPlaceholders] = useState<React.MutableRefObject<HTMLDivElement>[]>([]);
    const mediaTheme = useContext(themeContext);
    const scales = useMemo(() => {
        const cs = channelScaleRaw ?? {};
        if (scale) {
            for (const key of Object.keys(scale)) {
                cs[key] = {
                    ...(cs[key] ?? {}),
                    ...scale[key],
                };
            }
        }
        return cs;
    }, [channelScaleRaw, scale]);

    // const themeConfig = builtInThemes[themeKey]?.[mediaTheme];

    // const vegaConfig = useMemo(() => {
    //   const config: any = {
    //     ...themeConfig,
    //   }
    //   if (format.normalizedNumberFormat && format.normalizedNumberFormat.length > 0) {
    //     config.normalizedNumberFormat = format.normalizedNumberFormat;
    //   }
    //   if (format.numberFormat && format.numberFormat.length > 0) {
    //     config.numberFormat = format.numberFormat;
    //   }
    //   if (format.timeFormat && format.timeFormat.length > 0) {
    //     config.timeFormat = format.timeFormat;
    //   }
    //   return config;
    // }, [themeConfig, format.normalizedNumberFormat, format.numberFormat, format.timeFormat])

    useEffect(() => {
        const clickSub = geomClick$.subscribe(([values, e]) => {
            if (onGeomClick) {
                onGeomClick(values, e);
            }
        });
        return () => {
            clickSub.unsubscribe();
        };
    }, [onGeomClick]);
    const guardedRows = useMemo(() => rows.filter((x) => defaultAggregate || x.aggName !== 'expr'), [rows, defaultAggregate]);
    const guardedCols = useMemo(() => columns.filter((x) => defaultAggregate || x.aggName !== 'expr'), [columns, defaultAggregate]);
    const rowDims = useMemo(() => guardedRows.filter((f) => f.analyticType === 'dimension'), [guardedRows]);
    const colDims = useMemo(() => guardedCols.filter((f) => f.analyticType === 'dimension'), [guardedCols]);
    const rowMeas = useMemo(() => guardedRows.filter((f) => f.analyticType === 'measure'), [guardedRows]);
    const colMeas = useMemo(() => guardedCols.filter((f) => f.analyticType === 'measure'), [guardedCols]);
    const rowRepeatFields = useMemo(() => (rowMeas.length === 0 ? rowDims.slice(-1) : rowMeas), [rowDims, rowMeas]); //rowMeas.slice(0, -1);
    const colRepeatFields = useMemo(() => (colMeas.length === 0 ? colDims.slice(-1) : colMeas), [colDims, colMeas]); //colMeas.slice(0, -1);
    const { reportError: reportGWError } = useReporter();

    const [crossFilterTriggerIdx, setCrossFilterTriggerIdx] = useState(-1);

    useEffect(() => {
        setCrossFilterTriggerIdx(-1);
        setViewPlaceholders((views) => {
            const viewNum = Math.max(1, leastOne(rowRepeatFields.length) * leastOne(colRepeatFields.length));
            if (viewNum === views.length) return views;
            const nextViews = new Array(viewNum).fill(null).map((v, i) => views[i] || React.createRef());
            return nextViews;
        });
    }, [rowRepeatFields, colRepeatFields]);

    const vegaRefs = useRef<IVegaChartRef[]>([]);
    const renderTaskRefs = useRef<Promise<unknown>[]>([]);
    const { width: areaWidth, height: areaHeight, ref: areaRef } = useResizeDetector();

    const getSize = () => {
        if (layoutMode === 'auto') {
            return {
                width: 0,
                height: 0,
            };
        }
        if (layoutMode === 'full' && areaWidth && areaHeight) {
            return {
                width: areaWidth,
                height: areaHeight,
            };
        }
        return {
            width,
            height,
        };
    };

    const { width: vegaWidth, height: vegaHeight } = getSize();

    const specs = useMemo(
        () =>
            toVegaSpec({
                columns: guardedCols,
                dataSource,
                defaultAggregated: defaultAggregate,
                geomType,
                height: vegaHeight,
                interactiveScale,
                layoutMode,
                mediaTheme,
                rows: guardedRows,
                stack,
                width: vegaWidth,
                scales,
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
            }),
        [
            guardedCols,
            dataSource,
            defaultAggregate,
            geomType,
            interactiveScale,
            layoutMode,
            mediaTheme,
            guardedRows,
            stack,
            scales,
            color,
            details,
            opacity,
            radius,
            shape,
            size,
            text,
            theta,
            displayOffset,
            vegaWidth,
            vegaHeight,
        ]
    );

    // Render
    useEffect(() => {
        props.onReportSpec?.(
            JSON.stringify(
                specs.map((x) => ({
                    ...x,
                    data: undefined,
                })),
                undefined,
                4
            )
        );
        vegaRefs.current = [];
        renderTaskRefs.current = [];
        if (rowRepeatFields.length <= 1 && colRepeatFields.length <= 1) {
            if (viewPlaceholders.length > 0 && viewPlaceholders[0].current) {
                const task = embed(viewPlaceholders[0].current, specs[0], {
                    renderer: useSvg ? 'svg' : 'canvas',
                    mode: 'vega-lite',
                    actions: showActions,
                    timeFormatLocale: getVegaTimeFormatRules(locale),
                    config: vegaConfig,
                    tooltip: {
                        theme: mediaTheme,
                    },
                }).then((res) => {
                    const container = res.view.container();
                    const canvas = container?.querySelector('canvas') ?? container?.querySelector('svg') ?? null;
                    const rect = canvas ? parseRect(canvas) : null;
                    startTask(() => {
                        const success =
                            layoutMode !== 'auto' || useSvg || (rect && canvasSize.test({ width: rect.renderWidth || 1, height: rect.renderHeight || 1 }));
                        if (!success) {
                            if (canvas) {
                                reportGWError('canvas exceed max size', Errors.canvasExceedSize);
                            } else {
                                reportGWError('canvas not found', Errors.canvasExceedSize);
                            }
                        }
                    });
                    if (layoutMode !== 'auto') {
                        if (rect) {
                            const modifier = {
                                width: Math.max(rect.width - (areaWidth || width), 0),
                                height: Math.max(rect.height - (areaHeight || height), 0),
                            };
                            if (res.view.width() === 0) {
                                try {
                                    res.view.signal('child_width', specs[0].width - modifier.width / Math.round((areaWidth || width) / specs[0].width));
                                    res.view.signal('child_height', specs[0].height - modifier.height / Math.round((areaHeight || height) / specs[0].height));
                                } catch (e) {
                                    // ignore when width is just 0 because of extreamly small size
                                }
                            } else {
                                res.view.width(specs[0].width - modifier.width);
                                res.view.height(specs[0].height - modifier.height);
                            }
                            res.view.runAsync();
                        }
                    }
                    vegaRefs.current = [
                        {
                            w: container?.clientWidth ?? res.view.width(),
                            h: container?.clientHeight ?? res.view.height(),
                            innerWidth: canvas?.clientWidth ?? res.view.width(),
                            innerHeight: canvas?.clientHeight ?? res.view.height(),
                            x: 0,
                            y: 0,
                            view: res.view,
                            canvas,
                        },
                    ];
                    try {
                        res.view.addEventListener('click', (e) => {
                            click$.next(e);
                        });
                        res.view.addSignalListener(SELECTION_NAME, (name: any, values: any) => {
                            selection$.next(values);
                        });
                    } catch (error) {
                        console.warn(error);
                    }
                });
                renderTaskRefs.current = [task];
            }
        } else {
            let index = 0;
            vegaRefs.current = new Array(rowRepeatFields.length * colRepeatFields.length);
            const combinedParamStore$ = new Subject<ParamStoreEntry>();
            const throttledParamStore$ = combinedParamStore$.pipe(
                op.throttleTime((dataSource.length / 64) * rowRepeatFields.length * colRepeatFields.length, undefined, { leading: false, trailing: true })
            );
            const subscriptions: Subscription[] = [];
            const subscribe = (cb: (entry: ParamStoreEntry) => void) => {
                subscriptions.push(throttledParamStore$.subscribe(cb));
            };

            for (let i = 0; i < leastOne(rowRepeatFields.length); i++) {
                for (let j = 0; j < leastOne(colRepeatFields.length); j++, index++) {
                    const sourceId = index;
                    const node =
                        i * leastOne(colRepeatFields.length) + j < viewPlaceholders.length
                            ? viewPlaceholders[i * leastOne(colRepeatFields.length) + j].current
                            : null;
                    const ans = specs[index];
                    if (node) {
                        const id = index;
                        const task = embed(node, ans, {
                            renderer: useSvg ? 'svg' : 'canvas',
                            mode: 'vega-lite',
                            actions: showActions,
                            timeFormatLocale: getVegaTimeFormatRules(locale),
                            config: vegaConfig,
                            tooltip: {
                                theme: mediaTheme,
                            },
                        }).then((res) => {
                            const container = res.view.container();
                            const canvas = container?.querySelector('canvas') ?? container?.querySelector('svg') ?? null;
                            const rect = canvas ? parseRect(canvas) : null;
                            startTask(() => {
                                const success =
                                    layoutMode !== 'auto' ||
                                    useSvg ||
                                    (rect && canvasSize.test({ width: rect.renderWidth || 1, height: rect.renderHeight || 1 }));
                                if (!success) {
                                    if (canvas) {
                                        reportGWError('canvas exceed max size', Errors.canvasExceedSize);
                                    } else {
                                        reportGWError('canvas not found', Errors.canvasExceedSize);
                                    }
                                }
                            });
                            if (layoutMode !== 'auto') {
                                if (rect) {
                                    const modifier = {
                                        width: Math.max(rect.width - (areaWidth || width) / colRepeatFields.length, 0),
                                        height: Math.max(rect.height - (areaHeight || height) / rowRepeatFields.length, 0),
                                    };
                                    if (res.view.width() === 0) {
                                        if (res.view.signal('child_width') !== undefined) {
                                            res.view.signal(
                                                'child_width',
                                                specs[0].width - modifier.width / Math.round((areaWidth || width) / colRepeatFields.length / specs[0].width)
                                            );
                                            res.view.signal(
                                                'child_height',
                                                specs[0].height -
                                                    modifier.height / Math.round((areaHeight || height) / rowRepeatFields.length / specs[0].height)
                                            );
                                        }
                                    } else {
                                        res.view.width(specs[0].width - modifier.width);
                                        res.view.height(specs[0].height - modifier.height);
                                    }
                                    res.view.runAsync();
                                }
                            }
                            vegaRefs.current[id] = {
                                w: container?.clientWidth ?? res.view.width(),
                                h: container?.clientHeight ?? res.view.height(),
                                innerWidth: canvas?.clientWidth ?? res.view.width(),
                                innerHeight: canvas?.clientHeight ?? res.view.height(),
                                x: j,
                                y: i,
                                view: res.view,
                                canvas,
                            };
                            const paramStores = (res.vgSpec.data?.map((d) => d.name) ?? [])
                                .filter((name) => [BRUSH_SIGNAL_NAME, POINT_SIGNAL_NAME].map((p) => `${p}_store`).includes(name))
                                .map((name) => name.replace(/_store$/, ''));
                            try {
                                for (const param of paramStores) {
                                    let noBroadcasting = false;
                                    res.view.addSignalListener(param, (name) => {
                                        if (noBroadcasting) {
                                            noBroadcasting = false;
                                            return;
                                        }
                                        if ([BRUSH_SIGNAL_NAME, POINT_SIGNAL_NAME].includes(name)) {
                                            const data = res.view.getState().data?.[`${name}_store`];
                                            if (!data || (Array.isArray(data) && data.length === 0)) {
                                                setCrossFilterTriggerIdx(-1);
                                            }
                                            combinedParamStore$.next({
                                                signal: name as typeof BRUSH_SIGNAL_NAME | typeof POINT_SIGNAL_NAME,
                                                source: sourceId,
                                                data: data ?? null,
                                            });
                                        }
                                    });
                                    subscribe((entry) => {
                                        if (entry.source === sourceId || !entry.data) {
                                            return;
                                        }
                                        noBroadcasting = true;
                                        res.view.setState({
                                            data: {
                                                [`${entry.signal}_store`]: entry.data,
                                            },
                                        });
                                    });
                                }
                            } catch (error) {
                                console.warn('Crossing filter failed', error);
                            }
                            try {
                                res.view.addEventListener('mouseover', () => {
                                    if (sourceId !== crossFilterTriggerIdx) {
                                        setCrossFilterTriggerIdx(sourceId);
                                    }
                                });
                                res.view.addEventListener('click', (e) => {
                                    click$.next(e);
                                });
                                res.view.addSignalListener(SELECTION_NAME, (name: any, values: any) => {
                                    selection$.next(values);
                                });
                            } catch (error) {
                                console.warn(error);
                            }
                        });
                        renderTaskRefs.current.push(task);
                    }
                }
            }
            return () => {
                subscriptions.forEach((sub) => sub.unsubscribe());
                props.onReportSpec?.('');
            };
        }
        return () => {
            vegaRefs.current = [];
            renderTaskRefs.current = [];
            props.onReportSpec?.('');
        };
    }, [specs, viewPlaceholders, showActions, vegaConfig, useSvg, locale]);

    const containerRef = useRef<HTMLDivElement>(null);

    useVegaExportApi(name, vegaRefs, ref, renderTaskRefs, containerRef);

    return (
        <div
            className={layoutMode === 'auto' ? 'w-fit h-fit relative' : 'w-full h-full relative'}
            style={{ overflow: layoutMode === 'auto' ? 'visible' : 'hidden' }}
        >
            <div ref={areaRef} className="inset-0 absolute" />
            <CanvaContainer
                style={{
                    ...(layoutMode === 'auto' ? {} : { width: '100%', height: '100%' }),
                }}
                rowSize={Math.max(rowRepeatFields.length, 1)}
                colSize={Math.max(colRepeatFields.length, 1)}
                ref={containerRef}
            >
                {/* <div ref={container}></div> */}
                {viewPlaceholders.map((view, i) => (
                    <div key={i} ref={view} className={layoutMode === 'auto' ? '' : 'overflow-hidden'}></div>
                ))}
            </CanvaContainer>
        </div>
    );
});

export default ReactVega;
