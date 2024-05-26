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
import { COUNT_FIELD_ID } from '../constants';
import { GWGlobalConfig } from '../vis/theme';
import { GLOBAL_CONFIG } from '../config';
import { Item } from 'vega';
import { viewEncodingKeys } from '@/models/visSpec';
import LoadingLayer from '@/components/loadingLayer';
import { getTimeFormat } from '@/lib/inferMeta';
import { unexceptedUTCParsedPatternFormats } from '@/lib/op/offset';

interface RendererProps {
    vizThemeConfig: IThemeKey | GWGlobalConfig;
    computationFunction: IComputationFunction;
    scales?: IChannelScales;
    csvRef?: React.MutableRefObject<{ download: () => void }>;
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
                />
            </div>
        </div>
    );
});

export default observer(Renderer);
