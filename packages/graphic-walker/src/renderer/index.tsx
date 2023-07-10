import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useRef, useCallback } from 'react';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { runInAction, toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useRenderer } from './hooks';
import { initEncoding, initVisualConfig } from '../store/visualSpecStore';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
/**
 * Renderer of GraphicWalker editor.
 * Depending on global store.
 */
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures, visualConfig, draggableFieldState } = vizStore;
    const { currentDataset } = commonStore;
    const { dataSource } = currentDataset;

    const [viewConfig, setViewConfig] = useState<IVisualConfig>(initVisualConfig);
    const [encodings, setEncodings] = useState<DeepReadonly<DraggableFieldState>>(initEncoding);
    const [viewData, setViewData] = useState<IRow[]>([]);

    const { viewData: data, loading: waiting } = useRenderer({
        data: dataSource,
        allFields,
        viewDimensions,
        viewMeasures,
        filters: viewFilters,
        defaultAggregated: visualConfig.defaultAggregated,
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

    const handleGeomClick = useCallback(
        (values: any, e: any) => {
            e.stopPropagation();
            runInAction(() => {
                commonStore.showEmbededMenu([e.pageX, e.pageY]);
                commonStore.setFilters(values);
            });
        },
        []
    );

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
            loading={waiting}
            data={viewData}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
            draggableFieldState={encodings}
            visualConfig={viewConfig}
            onGeomClick={handleGeomClick}
            onChartResize={handleChartResize}
        />
    );
});

export default observer(Renderer);
