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
import { COUNT_FIELD_ID, PIVOT_TABLE_DEFAULT_LIMIT } from '../constants';
import { GWGlobalConfig } from '../vis/theme';
import { GLOBAL_CONFIG } from '../config';
import { Item } from 'vega';
import { viewEncodingKeys } from '@/models/visSpec';
import LoadingLayer from '@/components/loadingLayer';
import { getTimeFormat } from '@/lib/inferMeta';
import { unexceptedUTCParsedPatternFormats } from '@/lib/op/offset';
import { exportSpreadsheet } from '../services/spreadsheetExport';

interface RendererProps {
    vizThemeConfig: IThemeKey | GWGlobalConfig;
    computationFunction: IComputationFunction;
    scales?: IChannelScales;
    csvRef?: React.RefObject<{
        download: () => void;
        downloadXLSX?: () => void;
        downloadODS?: () => void;
    }>;
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
        [layout, overrideSize]
    );

    const draggableFieldState = chart.encodings;

    const { i18n } = useTranslation();

    const [viewConfig, setViewConfig] = useState<IVisualConfigNew>(emptyVisualConfig);
    const [encodings, setEncodings] = useState<DraggableFieldState>(emptyEncodings);
    const [viewData, setViewData] = useState<IRow[]>([]);

    // Apply default limit for pivot table if no limit is explicitly set
    const isPivotTable = visualConfig.geoms[0] === 'table';
    const effectiveLimit = useMemo(() => {
        if (limit > 0) return limit;
        if (isPivotTable) return PIVOT_TABLE_DEFAULT_LIMIT;
        return limit;
    }, [limit, isPivotTable]);

    const { viewData: data, loading: waiting } = useRenderer({
        allFields,
        viewDimensions,
        viewMeasures,
        filters: viewFilters,
        defaultAggregated: visualConfig.defaultAggregated,
        sort,
        limit: effectiveLimit,
        folds: visualConfig.folds,
        computationFunction,
        timezoneDisplayOffset: visualConfig.timezoneDisplayOffset,
    });

    useEffect(() => {
        if (!csvRef || isPivotTable) {
            return;
        }
        const getHeaders = () =>
            viewDimensions.concat(viewMeasures).map((x) => {
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

        const downloadTable = (type: 'xlsx' | 'ods') => {
            const headers = getHeaders();
            const rows = [
                headers.map((x) => x.name),
                ...data.map((row) =>
                    headers.map((header) => (row[header.fid] === undefined ? null : (row[header.fid] as string | number | boolean)))
                ),
            ];
            const fileName = `${chart.name || 'chart'}.${type}`;
            void exportSpreadsheet(
                {
                    name: chart.name || 'Sheet1',
                    data: rows,
                },
                fileName,
                type
            );
        };

        csvRef.current = {
            download() {
                const headers = getHeaders();
                const result = `${headers.map((x) => x.name).join(',')}\n${data.map((x) => headers.map((f) => x[f.fid]).join(',')).join('\n')}`;
                download(result, `${chart.name || 'chart'}.csv`, 'text/plain');
            },
            downloadXLSX() {
                downloadTable('xlsx');
            },
            downloadODS() {
                downloadTable('ods');
            },
        };
    }, [chart.name, csvRef, data, isPivotTable, viewDimensions, viewMeasures, viewConfig.defaultAggregated]);

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

    useChartIndexControl({
        count: visLength,
        index: visIndex,
        onChange: (idx) => vizStore.selectVisualization(idx),
    });

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
                    exportHandlerRef={csvRef}
                />
            </div>
        </div>
    );
});

export default observer(Renderer);
