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
    const { dataSource, id: datasetId } = currentDataset;
    const [viewConfig, setViewConfig] = useState<IVisualConfig>(initVisualConfig);
    const [encodings, setEncodings] = useState<DeepReadonly<DraggableFieldState>>(initEncoding);

    const [viewData, setViewData] = useState<IRow[]>([]);

    useEffect(() => {
        dataLoader.syncMeta({
            datasetId,
            dimensions: allFields.filter(f => f.analyticType === 'dimension').map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
                expression: f.computed && f.expression ? f.expression : undefined,
            })),
            measures: allFields.filter(f => f.analyticType === 'measure').map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
                expression: f.computed && f.expression ? f.expression : undefined,
            })),
        });
    }, [dataLoader, allFields, datasetId]);

    useEffect(() => {
        dataLoader.syncData(dataSource);
    }, [dataLoader, dataSource]);

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
    const latestFromRef = useRef({ vizStore, allFields, currentDataset });
    latestFromRef.current = { vizStore, allFields, currentDataset };

    useEffect(() => {
        setWaiting(true);
        dataLoader.query({ workflow }).then(data => {
            unstable_batchedUpdates(() => {
                setViewData(data);
                setWaiting(false);
                setEncodings(toJS(latestFromRef.current.vizStore.draggableFieldState));
                setViewConfig(toJS(latestFromRef.current.vizStore.visualConfig));
                vizStore.setWorkflow(workflow);
            });
        }).catch((err) => {
            console.error(err);
            unstable_batchedUpdates(() => {
                setViewData([]);
                setWaiting(false);
                setEncodings(initEncoding);
                setViewConfig(initVisualConfig);
                vizStore.setWorkflow([]);
            });
        });
    }, [dataLoader, workflow, currentDataset, vizStore]);

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
            dataLoader={dataLoader}
            dark={dark}
            draggableFieldState={encodings}
            visualConfig={viewConfig}
        />
    );
});

export default observer(Renderer);
