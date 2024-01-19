import React, { useEffect, useState, useMemo, forwardRef, useRef, useCallback } from 'react';
import embed from 'vega-embed';
import { Subject, Subscription } from 'rxjs';
import * as op from 'rxjs/operators';
import type { ScenegraphEvent } from 'vega';
import styled from 'styled-components';
import { useVegaExportApi } from '../utils/vegaApiExport';
import { IViewField, IRow, IStackMode, VegaGlobalConfig, IVegaChartRef, IChannelScales, IDarkMode, IConfigScale } from '../interfaces';
import { getVegaTimeFormatRules } from './temporalFormat';
import canvasSize from 'canvas-size';
import { Errors, useReporter } from '../utils/reportError';
import { useCurrentMediaTheme } from '../utils/media';
import { toVegaSpec } from '../lib/vega';
import { useResizeDetector } from 'react-resize-detector';

const CanvaContainer = styled.div<{ rowSize: number; colSize: number }>`
    display: grid;
    grid-template-columns: repeat(${(props) => props.colSize}, 1fr);
    grid-template-rows: repeat(${(props) => props.rowSize}, 1fr);
`;

function parseRect(el: HTMLCanvasElement | SVGSVGElement) {
    if (el instanceof HTMLCanvasElement) {
        return {
            width: parseInt(el.style.width),
            height: parseInt(el.style.height),
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
    channelScales?: IChannelScales;
    scale?: {
        opacity: IConfigScale;
        size: IConfigScale;
    };
    onReportSpec?: (spec: string) => void;
    displayOffset?: number
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
        dark = 'media',
        vegaConfig,
        // format
        locale = 'en-US',
        useSvg,
        channelScales: channelScaleRaw,
        scale,
        displayOffset,
    } = props;
    const [viewPlaceholders, setViewPlaceholders] = useState<React.MutableRefObject<HTMLDivElement>[]>([]);
    const mediaTheme = useCurrentMediaTheme(dark);
    const channelScales = useMemo(() => {
        const cs = channelScaleRaw ?? {};
        if (scale?.opacity) {
            cs.opacity = {
                ...(cs.opacity ?? {}),
                ...scale.opacity,
            };
        }
        if (scale?.size) {
            cs.size = {
                ...(cs.size ?? {}),
                ...scale.size,
            };
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
            const viewNum = Math.max(1, rowRepeatFields.length * colRepeatFields.length);
            const nextViews = new Array(viewNum).fill(null).map((v, i) => views[i] || React.createRef());
            return nextViews;
        });
    }, [rowRepeatFields, colRepeatFields]);

    const vegaRefs = useRef<IVegaChartRef[]>([]);
    const renderTaskRefs = useRef<Promise<unknown>[]>([]);
    const { width: areaWidth, height: areaHeight, ref: areaRef } = useResizeDetector();

    const modifierDeps = [
        columns,
        dataSource,
        defaultAggregate,
        geomType,
        interactiveScale,
        layoutMode,
        mediaTheme,
        rows,
        stack,
        channelScales,
        color,
        details,
        opacity,
        radius,
        shape,
        size,
        text,
        theta,
    ];

    const modifierDepsRef = useRef(modifierDeps);

    const [modifierRaw, setModifier] = useState({ width: 0, height: 0 });

    let modifier: typeof modifierRaw;

    if (modifierDepsRef.current.map((x, i) => x === modifierDeps[i]).every((x) => x)) {
        modifier = modifierRaw;
    } else {
        modifier = { width: 0, height: 0 };
    }

    const vegaWidth = (areaWidth || width) - modifier.width;
    const vegaHeight = (areaHeight || height) - modifier.height;

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
                channelScales,
                color,
                details,
                opacity,
                radius,
                shape,
                size,
                text,
                theta,
                vegaConfig,
                displayOffset
            }),
        [
            guardedCols,
            dataSource,
            defaultAggregate,
            geomType,
            vegaHeight,
            interactiveScale,
            layoutMode,
            mediaTheme,
            guardedRows,
            stack,
            vegaWidth,
            channelScales,
            color,
            details,
            opacity,
            radius,
            shape,
            size,
            text,
            theta,
            displayOffset,
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
                }).then((res) => {
                    const container = res.view.container();
                    const canvas = container?.querySelector('canvas') ?? container?.querySelector('svg') ?? null;
                    const rect = canvas ? parseRect(canvas): null;
                    const success = useSvg || (rect && canvasSize.test({ width: rect.renderWidth || 1, height: rect.renderHeight || 1 }));
                    if (!success) {
                        if (canvas) {
                            reportGWError('canvas exceed max size', Errors.canvasExceedSize);
                        } else {
                            reportGWError('canvas not found', Errors.canvasExceedSize);
                        }
                    }
                    if (rect && !modifier.width && !modifier.height && specs[0].width > 0 && specs[0].height > 0) {
                        const modifier = {
                            width: Math.max(rect.width- (areaWidth || width), 0),
                            height: Math.max(rect.height - (areaHeight || height), 0),
                        };
                        setModifier(modifier);
                        modifierDepsRef.current = modifierDeps;
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
            const newModifier = { width: 0, height: 0 };

            for (let i = 0; i < rowRepeatFields.length; i++) {
                for (let j = 0; j < colRepeatFields.length; j++, index++) {
                    const sourceId = index;
                    const node = i * colRepeatFields.length + j < viewPlaceholders.length ? viewPlaceholders[i * colRepeatFields.length + j].current : null;
                    const ans = specs[index];
                    if (node) {
                        const id = index;
                        const task = embed(node, ans, {
                            renderer: useSvg ? 'svg' : 'canvas',
                            mode: 'vega-lite',
                            actions: showActions,
                            timeFormatLocale: getVegaTimeFormatRules(locale),
                            config: vegaConfig,
                        }).then((res) => {
                            const container = res.view.container();
                            const canvas = container?.querySelector('canvas') ?? container?.querySelector('svg') ?? null;
                            const rect = canvas ? parseRect(canvas): null;
                            const success = useSvg || (rect && canvasSize.test({ width: rect.renderWidth || 1, height: rect.renderHeight || 1 }));
                            if (!success) {
                                if (canvas) {
                                    reportGWError('canvas exceed max size', Errors.canvasExceedSize);
                                } else {
                                    reportGWError('canvas not found', Errors.canvasExceedSize);
                                }
                            }
                            if (rect && !modifier.width && !modifier.height) {
                                const modifier = {
                                    width: Math.max(rect.width - (areaWidth || width) / colRepeatFields.length, 0),
                                    height: Math.max(rect.height - (areaHeight || height) / rowRepeatFields.length, 0),
                                };
                                newModifier.width = Math.max(newModifier.width, modifier.width);
                                newModifier.height = Math.max(newModifier.height, modifier.height);
                                setModifier(newModifier);
                                modifierDepsRef.current = modifierDeps;
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
                                    // 发出
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
        <div className="w-full h-full relative" style={{ overflow: layoutMode === 'auto' ? 'visible' : 'hidden' }}>
            <div ref={areaRef} className="inset-0 absolute" />
            <CanvaContainer
                style={layoutMode === 'full' ? { width: '100%', height: '100%' } : {}}
                rowSize={Math.max(rowRepeatFields.length, 1)}
                colSize={Math.max(colRepeatFields.length, 1)}
                ref={containerRef}
            >
                {/* <div ref={container}></div> */}
                {viewPlaceholders.map((view, i) => (
                    <div key={i} ref={view}></div>
                ))}
            </CanvaContainer>
        </div>
    );
});

export default ReactVega;
