import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { DeepReadonly, DraggableFieldState, IDarkMode, IDataQueryPayload, IRow, IThemeKey, IVisualConfig } from '../../interfaces';
import StandaloneSpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { unstable_batchedUpdates } from 'react-dom';
import { IReactVegaHandler } from '../../vis/react-vega';
import { toWorkflow } from '../../utils/workflow';
import { IViewField, IVisSpec } from '../../interfaces';
import PivotTable from '../../components/pivotTable';
import { MetaFieldKeys } from '../../config';
import { IGWDataLoader } from '../../dataLoader';

interface StandaloneRendererProps {
    datasetId: IDataQueryPayload['datasetId'];
    datasetName?: string;
    visSpec: {[K in keyof IVisSpec]: K extends "config" ? Partial<IVisSpec[K]> : IVisSpec[K];}
    // visSpec: IVisSpec;
    dataLoader: IGWDataLoader;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const StandaloneRenderer = forwardRef<IReactVegaHandler, StandaloneRendererProps>(function (props, ref) {
    const { datasetId, datasetName = '', visSpec, dataLoader, themeKey, dark } = props;
    const [waiting, setWaiting] = useState<boolean>(false);

    const [viewData, setViewData] = useState<IRow[]>([]);

    const { encodings, config: viewConfig } = visSpec;
    const { defaultAggregated = true } = viewConfig;

    const { filters: viewFilters, dimensions, measures } = encodings;
    const allFields = useMemo(() => {
        return [...dimensions, ...measures];
    }, [encodings]);
    /** Copied from packages/graphic-walker/src/stores/visualSpecStore.ts */
    const viewDimensions = useMemo(() => {
        // const state = toJS(encodings);
        const state = encodings;
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter((dkey) => !MetaFieldKeys.includes(dkey))
            .forEach((dkey) => {
                fields.push(...state[dkey].filter((f) => f.analyticType === "dimension"));
            });
        return fields;
    }, [encodings]);
    const viewMeasures = useMemo(() => {
        // const state = toJS(encodings);
        const state = encodings;
        const fields: IViewField[] = [];
        (Object.keys(state) as (keyof DraggableFieldState)[])
            .filter((dkey) => !MetaFieldKeys.includes(dkey))
            .forEach((dkey) => {
                fields.push(...state[dkey].filter((f) => f.analyticType === "measure"));
            });
        return fields;
    }, [encodings]);


    const workflow = useMemo(() => {
        return toWorkflow(
            viewFilters,
            allFields,
            viewDimensions,
            viewMeasures,
            defaultAggregated,
        );
    }, [viewFilters, allFields, viewDimensions, viewMeasures, defaultAggregated]);

    useEffect(() => {
        setWaiting(true);
        dataLoader.transform(
            {
                datasetId,
                query: {
                    workflow,
                },
            } as IDataQueryPayload,
            /** deprecated */
            {
                dataset: { id: datasetId, name: datasetName, rawFields: [], dataSource: [] },
                columns: [],
            }
        ).then(data => {
            unstable_batchedUpdates(() => {
                setViewData(data);
                setWaiting(false);
            });
        }).catch((err) => {
            console.error(err);
            unstable_batchedUpdates(() => {
                setViewData([]);
                setWaiting(false);
            });
        });
    }, [dataLoader, workflow, datasetId, datasetName]);

    if (viewConfig.geoms?.includes('table')) {
        return (
            <PivotTable
                data={viewData}
                draggableFieldState={encodings}
                visualConfig={viewConfig as IVisualConfig}
                loading={waiting}
                themeKey={themeKey}
                dark={dark}
            />
        );
    }

    return (
        <StandaloneSpecRenderer
            loading={waiting}
            data={viewData}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
            visSpecEncodings={encodings}
            visualConfig={viewConfig}
        />
    );
});

export default observer(StandaloneRenderer);
