import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { IDataQueryOptions, applyFilter, applyViewQuery, queryViewData, transformDataService } from '../services';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { initEncoding, initVisualConfig } from '../store/visualSpecStore';
import { toWorkflow } from '../utils/workflow';

interface RendererProps {
    queryMode: IDataQueryOptions['mode'];
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark, queryMode } = props;
    const [waiting, setWaiting] = useState<boolean>(false);
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures } = vizStore;
    const { currentDataset } = commonStore;
    const [viewConfig, setViewConfig] = useState<IVisualConfig>(initVisualConfig);
    const [encodings, setEncodings] = useState<DeepReadonly<DraggableFieldState>>(initEncoding);

    const [viewData, setViewData] = useState<IRow[]>([]);

    const workflow = useMemo(() => {
        return toWorkflow(
            viewFilters,
            allFields,
            viewDimensions,
            viewMeasures,
            vizStore.visualConfig.defaultAggregated,
        );
    }, [viewFilters, allFields, viewDimensions, viewMeasures, vizStore.visualConfig.defaultAggregated]);

    // Dependencies that should not trigger effect
    const latestFromRef = useRef({ vizStore, allFields });
    latestFromRef.current = { vizStore, allFields };

    useEffect(() => {
        setWaiting(true);
        queryViewData(
            {
                datasetId: currentDataset.id,
                workflow,
            },
            {
                mode: queryMode,
                dataset: currentDataset,
                columns: latestFromRef.current.allFields,
            }
        ).then(data => {
            unstable_batchedUpdates(() => {
                setViewData(data);
                setWaiting(false);
                setEncodings(toJS(latestFromRef.current.vizStore.draggableFieldState));
                setViewConfig(toJS(latestFromRef.current.vizStore.visualConfig));
            });
        }).catch((err) => {
            console.error(err);
            setWaiting(false);
        });
    }, [queryMode, workflow, currentDataset]);

    return (
        <SpecRenderer
            loading={waiting}
            data={viewData}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
            draggableFieldState={encodings}
            visualConfig={viewConfig}
        />
    );
});

export default observer(Renderer);
