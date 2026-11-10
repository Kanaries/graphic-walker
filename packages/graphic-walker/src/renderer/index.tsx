import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback, useMemo, useContext, useImperativeHandle } from 'react';
import {
    DraggableFieldState,
    IDarkMode,
    IRow,
    IThemeKey,
    IComputationFunction,
    IVisualConfigNew,
    IChannelScales,
    IViewField,
    IVisualLayout,
} from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction } from 'mobx';
import { useVizStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { download } from '../utils/save';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { emptyEncodings, emptyVisualConfig } from '../utils/save';
import { getMeaAggKey, getMeaAggName } from '../utils';
import { COUNT_FIELD_ID } from '../constants';
import { GWGlobalConfig } from '../vis/theme';
import { GLOBAL_CONFIG } from '../config';
import { Item } from 'vega';
import { Resizable } from 're-resizable';
import { viewEncodingKeys } from '@/models/visSpec';
import LoadingLayer from '@/components/loadingLayer';
import { getTimeFormat } from '@/lib/inferMeta';
import { unexceptedUTCParsedPatternFormats } from '@/lib/op/offset';
import { useNativeRegistry, type NativeRendererColors, type NativeRendererHandle } from './nativeRegistry';
import { routeChart, type ChartRoute } from './route';
import ChartNotice from './chartNotice';
import { getColor, getTheme } from '../utils/useTheme';
import { installNativeExport } from './nativeHostExport';
import { useAppRootContext } from '@/components/appRoot';
import type { IRenderStatus } from '../interfaces';
import { themeContext } from '@/store/theme';

interface RendererProps {
    vizThemeConfig: IThemeKey | GWGlobalConfig;
    computationFunction: IComputationFunction;
    scales?: IChannelScales;
    csvRef?: React.RefObject<{ download: () => void }>;
    overrideSize?: IVisualLayout['size'];
}
/**
 * Renderer of GraphicWalker editor.
 * Depending on global store.
 */
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { computationFunction, vizThemeConfig, csvRef, overrideSize } = props;
    const vizStore = useVizStore();
    const {
        allFields,
        viewFilters,
        viewDimensions,
        viewMeasures,
        config: visualConfig,
        layout,
        currentVis: chart,
        sort,
        limit,
    } = vizStore;

    const visualLayout = useMemo(
        () => ({
            ...layout,
            ...(overrideSize ? { size: overrideSize } : {}),
        }),
        [layout, overrideSize]
    );

    const draggableFieldState = chart.encodings;

    const { i18n } = useTranslation();

    const [viewConfig, setViewConfig] = useState<IVisualConfigNew>(emptyVisualConfig);
    const [encodings, setEncodings] = useState<DraggableFieldState>(emptyEncodings);
    const [viewData, setViewData] = useState<IRow[]>([]);

    const { viewData: data, loading: waiting } = useRenderer({
        allFields,
        viewDimensions,
        viewMeasures,
        filters: viewFilters,
        defaultAggregated: visualConfig.defaultAggregated,
        sort,
        limit: limit,
        folds: visualConfig.folds,
        computationFunction,
        timezoneDisplayOffset: visualConfig.timezoneDisplayOffset,
    });

    useEffect(() => {
        if (csvRef) {
            csvRef.current = {
                download() {
                    const headers = viewDimensions.concat(viewMeasures).map((x) => {
                        if (x.fid === COUNT_FIELD_ID) {
                            return {
                                name: 'Count',
                                fid: COUNT_FIELD_ID,
                            };
                        }
                        if (viewConfig.defaultAggregated && x.analyticType === 'measure') {
                            return {
                                fid: getMeaAggKey(x.fid, x.aggName),
                                name: getMeaAggName(x.name, x.aggName),
                            };
                        }
                        return { fid: x.fid, name: x.name };
                    });
                    const result = `${headers.map((x) => x.name).join(',')}\n${data.map((x) => headers.map((f) => x[f.fid]).join(',')).join('\n')}`;
                    download(result, `${chart.name}.csv`, 'text/plain');
                },
            };
        }
    }, [chart.name, csvRef, data, viewDimensions, viewMeasures, viewConfig.defaultAggregated]);

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({
        data,
        draggableFieldState: draggableFieldState,
        visualConfig: visualConfig,
    });
    latestFromRef.current = {
        data,
        draggableFieldState: draggableFieldState,
        visualConfig: visualConfig,
    };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setViewData(latestFromRef.current.data);
                setEncodings(latestFromRef.current.draggableFieldState);
                setViewConfig(latestFromRef.current.visualConfig);
            });
        }
    }, [waiting, data, vizStore]);

    const handleGeomClick = useCallback(
        (values: any, e: MouseEvent & { item: Item }) => {
            e.stopPropagation();
            if (GLOBAL_CONFIG.EMBEDED_MENU_LIST.length > 0) {
                runInAction(() => {
                    vizStore.showEmbededMenu([e.clientX, e.clientY]);
                    vizStore.setFilters(values);
                });
                const { vlPoint, ...datums } = values;
                const selectedMarkObject = Object.fromEntries(Object.entries(datums).map(([k, vs]) => [k, vs instanceof Array ? vs[0] : undefined]));
                // check selected fields include temporal, and return temporal timestamp to original data
                const allFields = viewEncodingKeys(visualConfig.geoms[0]).flatMap((k) => encodings[k] as IViewField[]);
                const selectedTemporalFields = Object.keys(selectedMarkObject)
                    .map((k) => allFields.find((x) => x.fid === k))
                    .filter((x): x is IViewField => !!x && x.semanticType === 'temporal');
                if (selectedTemporalFields.length > 0) {
                    const displayOffset = visualConfig.timezoneDisplayOffset ?? new Date().getTimezoneOffset();
                    selectedTemporalFields.forEach((f) => {
                        const offset = f.offset ?? new Date().getTimezoneOffset();
                        const set = new Set(viewData.map((x) => x[f.fid] as string | number));
                        selectedMarkObject[f.fid] = Array.from(set).find((x) => {
                            const format = getTimeFormat(x);
                            let offsetTime = displayOffset * -60000;
                            if (format !== 'timestamp') {
                                offsetTime += offset * 60000;
                                if (!unexceptedUTCParsedPatternFormats.includes(format)) {
                                    // the raw data will be parsed as local timezone, so reduce the offset with the local time zone.
                                    offsetTime -= new Date().getTimezoneOffset() * 60000;
                                }
                            }
                            const time = new Date(x).getTime() + offsetTime;
                            return time === selectedMarkObject[f.fid];
                        });
                    });
                }
                if (e.item.mark.marktype === 'line') {
                    // use the filter in mark group
                    const keys = new Set(Object.keys(e.item.mark.group.datum ?? {}));
                    vizStore.updateSelectedMarkObject(Object.fromEntries(Object.entries<string | number>(selectedMarkObject).filter(([k]) => keys.has(k))));
                } else {
                    vizStore.updateSelectedMarkObject(selectedMarkObject);
                }
            }
        },
        [vizStore, viewData, encodings, visualConfig]
    );

    const handleChartResize = useCallback(
        (width: number, height: number) => {
            vizStore.setVisualLayout('size', {
                mode: 'fixed',
                width,
                height,
            });
        },
        [vizStore]
    );

    const isSpatial = viewConfig.coordSystem === 'geographic';

    const sizeRef = useRef(visualLayout.size);
    sizeRef.current = visualLayout.size;

    useEffect(() => {
        if (isSpatial) {
            const prevSizeConfig = sizeRef.current;
            if (sizeRef.current.width < LEAFLET_DEFAULT_WIDTH || sizeRef.current.height < LEAFLET_DEFAULT_HEIGHT) {
                vizStore.setVisualLayout('size', {
                    mode: sizeRef.current.mode,
                    width: Math.max(prevSizeConfig.width, LEAFLET_DEFAULT_WIDTH),
                    height: Math.max(prevSizeConfig.height, LEAFLET_DEFAULT_HEIGHT),
                });
                return () => {
                    vizStore.setVisualLayout('size', prevSizeConfig);
                };
            }
        }
    }, [isSpatial, vizStore]);

    return (
        <div className="w-full h-full">
            {waiting && <LoadingLayer />}
            <div className="overflow-auto w-full h-full">
                <SpecRenderer
                    name={chart?.name}
                    data={viewData}
                    ref={ref}
                    vizThemeConfig={vizThemeConfig}
                    locale={i18n.language}
                    draggableFieldState={encodings}
                    visualConfig={viewConfig}
                    onGeomClick={handleGeomClick}
                    onChartResize={handleChartResize}
                    layout={visualLayout}
                    scales={props.scales}
                    onReportSpec={(spec) => {
                        vizStore.updateLastSpec(spec);
                    }}
                />
            </div>
        </div>
    );
});

const ObservedRenderer = observer(Renderer);

// The same default name the Vega renderer gives its downloads.
const defaultExportName = () => `gw chart ${Date.now() % 1_000_000}`.padStart(6, '0');
function saveDataURL(url: string, filename: string) {
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
}

/**
 * Draws the current chart with the component that its kind and its renderer setting call for; see
 * `routeChart`. The worksheet renderer plans its own queries from the chart, so the query and Vega
 * pipeline above is not mounted for it. No renderer stands in for another: a chart that its renderer
 * cannot draw, or that failed while it was drawn, leaves a notice in the chart area and stays as saved.
 */
const RendererSwitch = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const vizStore = useVizStore();
    const registry = useNativeRegistry();
    const chart = vizStore.currentVis;
    const { i18n } = useTranslation();
    // The host's chart count, chart index and openChart. They are registered here, above every renderer,
    // so they stay in place whichever one draws and while one is swapped for the other.
    useChartIndexControl({
        count: vizStore.visLength,
        index: vizStore.visIndex,
        onChange: (idx) => vizStore.selectVisualization(idx),
    });
    // The same resolution the Vega path does: theme preset, then the chart's primary color and palette on top.
    const mediaTheme = useContext(themeContext);
    const { primaryColor, colorPalette, background } = chart.layout;
    const colors = useMemo<NativeRendererColors>(() => {
        // The theme is a Vega config. What the native renderer can use of it is read out here, so that it
        // does not need to know that format. A setting that is not a plain color or number is left out.
        const config: any = getTheme({ vizThemeConfig: props.vizThemeConfig, mediaTheme, primaryColor, colorPalette });
        const resolved = getColor(config);
        const plain = (value: unknown) => (typeof value === 'string' && value !== 'transparent' ? value : undefined);
        const amount = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
        const dash = config.axis?.gridDash;
        return {
            dark: mediaTheme === 'dark',
            primary: resolved.primaryColor,
            category: resolved.nominalPalette,
            ramp: resolved.quantitativePalette,
            diverging: resolved.divergingPalette,
            heatmap: resolved.heatmapPalette,
            background: background || undefined,
            text: plain(config.header?.labelColor) ?? plain(config.legend?.labelColor) ?? plain(config.text?.color),
            muted: plain(config.axis?.labelColor),
            line: plain(config.view?.stroke),
            grid: plain(config.axis?.gridColor),
            style: {
                font: plain(config.font),
                gridDash: Array.isArray(dash) && dash.length === 2 && dash.every((n: unknown) => typeof n === 'number') ? [dash[0], dash[1]] : undefined,
                lineWidth: amount(config.line?.strokeWidth),
                pointStrokeWidth: amount(config.point?.strokeWidth),
                pointFilled: config.point?.filled === true ? true : undefined,
                barRadius: amount(config.bar?.cornerRadiusEnd),
            },
        };
    }, [props.vizThemeConfig, mediaTheme, primaryColor, colorPalette, background]);
    // A chart that failed while it was queried or drawn shows the error until someone tries again, or until
    // its fields, filters, mark type, aggregation or data source change. Size and color changes keep the error.
    const { encodings, config } = chart;
    const shape = useMemo(() => JSON.stringify([encodings, config]), [encodings, config]);
    const [failed, setFailed] = useState<{ shape: string; reason: string }>();
    const onError = useCallback((reason: string) => setFailed({ shape, reason }), [shape]);
    const retry = useCallback(() => setFailed(undefined), []);
    useEffect(() => setFailed(undefined), [props.computationFunction]);
    const planned = useMemo(() => routeChart(chart, registry), [chart, registry]);
    const route: ChartRoute = planned.to === 'native' && failed?.shape === shape ? { to: 'notice', notice: { state: 'failed', reason: failed.reason } } : planned;

    // Who answers the export buttons and the host: the worksheet renderer, the editor's own renderers,
    // or nobody while a notice or a blank area stands where the chart would be.
    const drawn: 'native' | 'classic' | 'nothing' = route.to === 'native' ? 'native' : route.to === 'classic' || route.to === 'dedicated' ? 'classic' : 'nothing';
    const nativeHandle = useRef<NativeRendererHandle>(null);
    const innerHandle = useRef<IReactVegaHandler>(null);
    const drawing = useRef(drawn);
    drawing.current = drawn;
    useImperativeHandle(ref, () => {
        // An export that cannot be made, such as one asked for while the chart is loading, saves nothing.
        const guarded = async (make: () => Promise<string>, save?: (data: string) => void): Promise<string[]> => {
            try {
                const data = await make();
                save?.(data);
                return [data];
            } catch (error) {
                console.error('[worksheet renderer] export failed:', error);
                return [];
            }
        };
        const fromNative: IReactVegaHandler = {
            getSVGData: () => guarded(() => nativeHandle.current!.exportSVG()),
            getCanvasData: () => guarded(() => nativeHandle.current!.exportPNG()),
            downloadSVG: (filename = defaultExportName()) => guarded(() => nativeHandle.current!.exportSVG(), (svg) => download(svg, `${filename}.svg`, 'image/svg+xml')),
            downloadPNG: (filename = defaultExportName()) => guarded(() => nativeHandle.current!.exportPNG(), (url) => saveDataURL(url, `${filename}.png`)),
        };
        // A chart that is not drawn has nothing to export. In particular it does not hand out what an earlier chart left behind.
        const pick = <K extends keyof IReactVegaHandler>(key: K): IReactVegaHandler[K] =>
            ((...args: [string?]) =>
                drawing.current === 'native'
                    ? fromNative[key](...args)
                    : drawing.current === 'classic'
                    ? innerHandle.current?.[key](...args) ?? Promise.resolve([])
                    : Promise.resolve([])) as IReactVegaHandler[K];
        return { getSVGData: pick('getSVGData'), getCanvasData: pick('getCanvasData'), downloadSVG: pick('downloadSVG'), downloadPNG: pick('downloadPNG') };
    }, []);
    // The CSV button reads a slot the drawing renderer fills. The editor's own renderers fill it when they
    // mount. Otherwise it is filled here, also where nothing is drawn, so that it never holds an earlier chart's data.
    const { csvRef } = props;
    const chartName = chart.name;
    useEffect(() => {
        if (drawn === 'classic' || !csvRef) return;
        csvRef.current = {
            download() {
                if (drawing.current !== 'native') return console.warn('[chart] There is no data to export: the chart is not drawn.');
                try {
                    download(nativeHandle.current!.exportCSV(), `${chartName}.csv`, 'text/plain');
                } catch (error) {
                    console.error('[worksheet renderer] export failed:', error);
                }
            },
        };
    }, [drawn, csvRef, chartName]);

    // Where the chart stands, for the loading layer here and for the host's render status.
    const appRoot = useAppRootContext();
    const [status, setStatus] = useState<IRenderStatus>('idle');
    const onStatusChange = useCallback(
        (next: IRenderStatus) => {
            setStatus(next);
            appRoot.current?.updateRenderStatus(next);
        },
        [appRoot]
    );
    const container = useRef<HTMLDivElement>(null);
    const hosted = drawn !== 'classic';
    useEffect(() => {
        if (!hosted) return;
        // The host's exportChart is answered from here also while nothing is drawn. It then reports a chart without images.
        const ctx = appRoot.current;
        return ctx ? installNativeExport(ctx, { handle: nativeHandle, container, title: chartName ?? '' }) : undefined;
    }, [hosted, appRoot, chartName]);
    useEffect(() => {
        if (!hosted) return;
        // The editor's own renderers start from a clean state when they take over. Between two charts that are
        // both answered from here the status is left alone: the sheet goes on reporting it, and a sheet that
        // was loading one chart and now loads the next has nothing new to say.
        return () => {
            setStatus('idle');
            appRoot.current?.updateRenderStatus('idle');
        };
    }, [hosted, appRoot]);
    // A chart that is not drawn says so to the host: an export waits for a renderer that is still loading,
    // and gets no image from a chart that has no renderer, cannot be drawn or failed.
    const standing: IRenderStatus | undefined = route.to === 'notice' ? (route.notice.state === 'loading' ? 'computing' : 'error') : route.to === 'blank' ? 'idle' : undefined;
    useEffect(() => {
        if (standing) onStatusChange(standing);
    }, [standing, onStatusChange, chartName]);
    // A click on a mark opens the editor's menu there, with the mark's dimension values as what the menu's
    // actions work on. The click must not reach the chart area, whose own handler closes the menu.
    const onMarkClick = useCallback(
        (mark: Record<string, unknown>, event: MouseEvent) => {
            if (GLOBAL_CONFIG.EMBEDED_MENU_LIST.length === 0) return;
            event.stopPropagation();
            runInAction(() => {
                vizStore.showEmbededMenu([event.clientX, event.clientY]);
                vizStore.setFilters(Object.fromEntries(Object.entries(mark).map(([fid, value]) => [fid, [value]])));
                vizStore.updateSelectedMarkObject(mark as Record<string, string | number | undefined>);
            });
        },
        [vizStore]
    );

    if (route.to === 'classic' || route.to === 'dedicated') return <ObservedRenderer {...props} ref={innerHandle} />;
    if (route.to !== 'native') {
        return (
            <div className="w-full h-full relative overflow-auto" ref={container} data-testid="chart-not-drawn">
                {status === 'computing' && <LoadingLayer />}
                {route.to === 'notice' && <ChartNotice notice={route.notice} onRetry={retry} />}
            </div>
        );
    }
    const Native = registry.renderer!.component;
    // Auto: value axes take the room the chart area has, member steps keep their size, and what does not fit scrolls.
    // Fixed: it fills a box of the chosen size, which the viewer can drag to resize.
    // Full: it fills the chart area.
    const size = props.overrideSize ?? chart.layout.size;
    const sheet = (
        <Native
            chart={chart}
            fields={vizStore.allFields}
            computation={props.computationFunction}
            colors={colors}
            locale={i18n.language}
            fill={size.mode !== 'auto'}
            onError={onError}
            handle={nativeHandle}
            onStatusChange={onStatusChange}
            onMarkClick={onMarkClick}
        />
    );
    return (
        <div className={size.mode === 'fixed' ? 'w-full h-full relative overflow-auto' : 'w-full h-full relative'} ref={container}>
            {status === 'computing' && <LoadingLayer />}
            {size.mode === 'fixed' ? (
                <Resizable
                    className="border-primary border-2 max-h-screen max-w-[100vw]"
                    size={{ width: `${size.width}px`, height: `${size.height}px` }}
                    minWidth={120}
                    minHeight={120}
                    onResizeStop={(_event, _direction, _element, delta) => {
                        vizStore.setVisualLayout('size', { mode: 'fixed', width: size.width + delta.width, height: size.height + delta.height });
                    }}
                >
                    {sheet}
                </Resizable>
            ) : (
                sheet
            )}
        </div>
    );
});

export default observer(RendererSwitch);
