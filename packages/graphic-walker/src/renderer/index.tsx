import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { DraggableFieldState, IDarkMode, IRow, IThemeKey, IComputationFunction, IVisualConfigNew } from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction } from 'mobx';
import { useVizStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { useChartIndexControl } from '../utils/chartIndexControl';
import { emptyEncodings, emptyVisualConfig } from '../utils/save';

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
    }, [waiting, vizStore]);

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
            layout={layout}
        />
    );
});

export default observer(Renderer);
