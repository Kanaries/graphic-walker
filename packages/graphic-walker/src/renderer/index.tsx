import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig, IComputationFunction, IChannelScales } from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction, toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { download, initEncoding } from '../utils/save';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { initVisualConfig } from '../utils/save';
import { getMeaAggKey } from '../utils';
import { COUNT_FIELD_ID } from '../constants';

interface RendererProps {
    themeKey?: IThemeKey;
    themeConfig?: any;
    dark?: IDarkMode;
    computationFunction: IComputationFunction;
    channelScales?: IChannelScales;
    csvRef?: React.MutableRefObject<{ download: () => void }>;
}
/**
 * Renderer of GraphicWalker editor.
 * Depending on global store.
 */
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark, computationFunction, themeConfig, csvRef, } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const {
        allFields,
        viewFilters,
        viewDimensions,
        viewMeasures,
        visualConfig,
        draggableFieldState,
        visList,
        visIndex,
        sort,
        limit,
    } = vizStore;
    const chart = visList[visIndex];

    const { i18n } = useTranslation();

    const [viewConfig, setViewConfig] = useState<IVisualConfig>(initVisualConfig);
    const [encodings, setEncodings] = useState<DeepReadonly<DraggableFieldState>>(initEncoding);
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
    });

    useEffect(() => {
        if (csvRef) {
            csvRef.current = {
                download() {
                    const headers = viewDimensions.concat(viewMeasures).map(x => {
                        if (x.fid === COUNT_FIELD_ID) {
                            return {
                                name: 'Count',
                                fid: COUNT_FIELD_ID
                            }
                        }
                        if (viewConfig.defaultAggregated && x.analyticType === 'measure') {
                            return {
                                fid: getMeaAggKey(x.fid,x.aggName),
                                name: `${x.aggName}(${x.name})`
                            }
                        }
                        return {fid: x.fid, name: x.name};
                    });
                    const result = `${headers.map(x=>x.name).join(',')}\n${data.map(x => headers.map(f => x[f.fid]).join(',')).join('\n')}`;
                    download(result, `${chart.name}.csv`, 'text/plain');
                },
            }
        }
    }, [data,viewDimensions,viewMeasures,visualConfig.defaultAggregated]);

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({
        data,
        draggableFieldState: toJS(draggableFieldState),
        visualConfig: toJS(visualConfig),
    });
    latestFromRef.current = {
        data,
        draggableFieldState: toJS(draggableFieldState),
        visualConfig: toJS(visualConfig),
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
        count: visList.length,
        index: visIndex,
        onChange: (idx) => vizStore.selectVisualization(idx),
    });

    const handleGeomClick = useCallback((values: any, e: any) => {
        e.stopPropagation();
        runInAction(() => {
            commonStore.showEmbededMenu([e.pageX, e.pageY]);
            commonStore.setFilters(values);
        });
        const selectedMarkObject = values.vlPoint.or[0];
        commonStore.updateSelectedMarkObject(selectedMarkObject);
    }, []);

    const handleChartResize = useCallback(
        (width: number, height: number) => {
            vizStore.setChartLayout({
                mode: 'fixed',
                width,
                height,
            });
        },
        [vizStore]
    );

    const isSpatial = viewConfig.coordSystem === 'geographic';

    const sizeRef = useRef(viewConfig.size);
    sizeRef.current = viewConfig.size;

    useEffect(() => {
        if (isSpatial) {
            const prevSizeConfig = sizeRef.current;
            if (sizeRef.current.width < LEAFLET_DEFAULT_WIDTH || sizeRef.current.height < LEAFLET_DEFAULT_HEIGHT) {
                vizStore.setChartLayout({
                    mode: sizeRef.current.mode,
                    width: Math.max(prevSizeConfig.width, LEAFLET_DEFAULT_WIDTH),
                    height: Math.max(prevSizeConfig.height, LEAFLET_DEFAULT_HEIGHT),
                });
                return () => {
                    vizStore.setChartLayout(prevSizeConfig);
                };
            }
        }
    }, [isSpatial, vizStore]);

    return (
        <SpecRenderer
            name={chart?.name}
            loading={waiting}
            data={viewData}
            ref={ref}
            themeKey={themeKey}
            themeConfig={themeConfig}
            dark={dark}
            locale={i18n.language}
            draggableFieldState={encodings}
            visualConfig={viewConfig}
            onGeomClick={handleGeomClick}
            onChartResize={handleChartResize}
            computationFunction={computationFunction}
            channelScales={props.channelScales}
        />
    );
});

export default observer(Renderer);
