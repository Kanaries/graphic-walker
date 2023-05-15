import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { initEncoding, initVisualConfig } from '../store/visualSpecStore';
import { toWorkflow } from '../utils/workflow';
import PivotTable from '../components/pivotTable';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const [waiting, setWaiting] = useState<boolean>(false);
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures, visualConfig, dataLoader } = vizStore;
    const { defaultAggregated } = visualConfig;
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
            defaultAggregated,
        );
    }, [viewFilters, allFields, viewDimensions, viewMeasures, defaultAggregated]);

    // Dependencies that should not trigger effect
    const latestFromRef = useRef({ vizStore, allFields });
    latestFromRef.current = { vizStore, allFields };

    useEffect(() => {
        setWaiting(true);
        dataLoader.transform(
            {
                datasetId: currentDataset.id,
                workflow,
            },
            {
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
            unstable_batchedUpdates(() => {
                setViewData([]);
                setWaiting(false);
                setEncodings(initEncoding);
                setViewConfig(initVisualConfig);
            });
        });
    }, [dataLoader, workflow, currentDataset]);

    if (viewConfig.geoms.includes('table')) {
        return (
            <PivotTable
                data={viewData}
                draggableFieldState={encodings}
                visualConfig={viewConfig}
                loading={waiting}
                themeKey={themeKey}
                dark={dark}
            />
        );
    }

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
