import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig, IComputationFunction } from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction, toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { initEncoding } from '../store/visualSpecStore';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { initVisualConfig } from '../utils/save';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    computationFunction: IComputationFunction;
}
/**
 * Renderer of GraphicWalker editor.
 * Depending on global store.
 */
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark, computationFunction } = props;
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
        computationFunction,
    });

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
    }, [waiting, vizStore]);

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
            dark={dark}
            locale={i18n.language}
            draggableFieldState={encodings}
            visualConfig={viewConfig}
            onGeomClick={handleGeomClick}
            onChartResize={handleChartResize}
        />
    );
});

export default observer(Renderer);
