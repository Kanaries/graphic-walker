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
