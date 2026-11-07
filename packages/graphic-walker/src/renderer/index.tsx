import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback, useMemo } from 'react';
import {
    DraggableFieldState,
    IDarkMode,
    IRow,
    IThemeKey,
    IComputationFunction,
    IVisualConfigNew,
    IChannelScales,
    IVisualLayout,
    INativeRendererOptions,
} from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction } from 'mobx';
import { useVizStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { useRenderer, useNativeResult } from './hooks';
import type { NativeSelectionEvent } from '../lib/native/events';
import { download } from '../utils/save';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { getMeaAggKey, getMeaAggName } from '../utils';
import { COUNT_FIELD_ID } from '../constants';
import { GWGlobalConfig } from '../vis/theme';
import { GLOBAL_CONFIG } from '../config';
import { Item } from 'vega';
import LoadingLayer from '@/components/loadingLayer';

interface RendererProps {
    vizThemeConfig: IThemeKey | GWGlobalConfig;
    computationFunction: IComputationFunction;
    scales?: IChannelScales;
    nativeRenderer?: INativeRendererOptions;
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
        visIndex,
        visLength,
        sort,
        limit,
    } = vizStore;

    const visualLayout = useMemo(
        () => ({
            ...layout,
            ...(overrideSize ? { size: overrideSize } : {}),
        }),
        [layout, overrideSize],
    );

    const draggableFieldState = chart.encodings;

    const { i18n } = useTranslation();

    const {
        viewData: data,
        loading: waiting,
        error,
        query,
    } = useRenderer({
        chart,
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

    const viewData = data;
    const encodings = draggableFieldState;
    const viewConfig = visualConfig;

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

    const nativeResult = useNativeResult(chart, query, props.nativeRenderer?.getResultRowKey);

    const handleNativeSelection = useCallback(
        (event: NativeSelectionEvent) => {
            props.nativeRenderer?.onSelectionChange?.(event);
            // Legacy menus consume one raw record. Multi-tuples and line endpoints stay
            // in the structured public callback; never flatten them into Cartesian filters.
            if (!event.interaction || event.targets.length !== 1 || event.targets[0].datumKeys.length !== 1) {
                vizStore.closeEmbededMenu();
                return;
            }
            const selected: Record<string, string | number | undefined> = {};
            const filters: Record<string, unknown[]> = {};
            for (const value of event.targets[0].values) {
                const key = value.field.fid;
                if (typeof value.raw !== 'string' && typeof value.raw !== 'number') continue;
                if (Object.prototype.hasOwnProperty.call(selected, key) && selected[key] !== value.raw) return;
                selected[key] = value.raw;
                filters[key] = [value.raw];
            }
            if (!Object.keys(filters).length || !GLOBAL_CONFIG.EMBEDED_MENU_LIST.length) return;
            runInAction(() => {
                vizStore.setFilters(filters);
                vizStore.updateSelectedMarkObject(selected);
                vizStore.showEmbededMenu([event.interaction!.clientX, event.interaction!.clientY]);
            });
        },
        [props.nativeRenderer?.onSelectionChange, vizStore],
    );

    useChartIndexControl({
        count: visLength,
        index: visIndex,
        onChange: (idx) => vizStore.selectVisualization(idx),
    });

    const handleGeomClick = useCallback(
        (values: any, e: MouseEvent & { item: Item }, rawFieldsByDisplay?: Readonly<Record<string, string>>) => {
            e.stopPropagation();
            if (GLOBAL_CONFIG.EMBEDED_MENU_LIST.length > 0) {
                runInAction(() => {
                    vizStore.showEmbededMenu([e.clientX, e.clientY]);
                    vizStore.setFilters(values);
                });
                const { vlPoint, ...datums } = values;
                const selectedMarkObject = Object.fromEntries(Object.entries(datums).map(([k, vs]) => [k, vs instanceof Array ? vs[0] : undefined]));
                // The legacy specs keep original fields for point-selection parameters;
                // temporal display coordinates live in separate columns. Values here
                // are already raw, including null and numeric timestamps.
                if (e.item.mark.marktype === 'line') {
                    // use the filter in mark group
                    const keys = new Set(Object.keys(e.item.mark.group.datum ?? {}).map((key) => rawFieldsByDisplay?.[key] ?? key));
                    vizStore.updateSelectedMarkObject(Object.fromEntries(Object.entries<string | number>(selectedMarkObject).filter(([k]) => keys.has(k))));
                } else {
                    vizStore.updateSelectedMarkObject(selectedMarkObject);
                }
            }
        },
        [vizStore],
    );

    const handleChartResize = useCallback(
        (width: number, height: number) => {
            vizStore.setVisualLayout('size', {
                mode: 'fixed',
                width,
                height,
            });
        },
        [vizStore],
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
                    chart={chart}
                    nativeResult={nativeResult}
                    loading={waiting}
                    error={error}
                    onNativeSelection={handleNativeSelection}
                    onRendererChange={(renderer) => vizStore.setVisualLayout('renderer', renderer)}
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

export default observer(Renderer);
