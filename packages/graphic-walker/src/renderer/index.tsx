import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { DraggableFieldState, IDarkMode, IRow, IThemeKey, IComputationFunction, IVisualConfigNew, IChannelScales } from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction } from 'mobx';
import { useVizStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { LEAFLET_DEFAULT_HEIGHT, LEAFLET_DEFAULT_WIDTH } from '../components/leafletRenderer';
import { emptyEncodings, emptyVisualConfig } from '../utils/save';

interface RendererProps {
    themeKey?: IThemeKey;
    themeConfig?: any;
    dark?: IDarkMode;
    computationFunction: IComputationFunction;
    channelScales?: IChannelScales;
}
/**
 * Renderer of GraphicWalker editor.
 * Depending on global store.
 */
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark, computationFunction, themeConfig } = props;
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
        computationFunction,
    });

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

    const handleGeomClick = useCallback((values: any, e: any) => {
        e.stopPropagation();
        runInAction(() => {
            vizStore.showEmbededMenu([e.pageX, e.pageY]);
            vizStore.setFilters(values);
        });
        const selectedMarkObject = values.vlPoint.or[0];
        vizStore.updateSelectedMarkObject(selectedMarkObject);
    }, []);

    const handleChartResize = useCallback(
        (width: number, height: number) => {
            vizStore.setVisualLayout('size',{
                mode: 'fixed',
                width,
                height,
            });
        },
        [vizStore]
    );

    const isSpatial = viewConfig.coordSystem === 'geographic';

    const sizeRef = useRef(layout.size);
    sizeRef.current = layout.size;

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
            layout={layout}
            channelScales={props.channelScales}
        />
    );
});

export default observer(Renderer);
