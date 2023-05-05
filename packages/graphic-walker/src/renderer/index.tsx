import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef } from 'react';
import { applyFilter, applyViewQuery, transformDataService } from '../services';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { initEncoding, initVisualConfig } from '../store/visualSpecStore';
import PivotTable from '../components/pivotTable';
import { getMeaAggKey } from '../utils';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const [waiting, setWaiting] = useState<boolean>(false);
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures } = vizStore;
    const { currentDataset } = commonStore;
    const { dataSource } = currentDataset;
    const [viewConfig, setViewConfig] = useState<IVisualConfig>(initVisualConfig);
    const [encodings, setEncodings] = useState<DeepReadonly<DraggableFieldState>>(initEncoding);

    const [viewData, setViewData] = useState<IRow[]>([]);
    useEffect(() => {
        setWaiting(true);
        applyFilter(dataSource, viewFilters)
            .then((data) => transformDataService(data, allFields))
            .then((d) => {
                // setViewData(d);
                const dims = viewDimensions;
                const meas = viewMeasures;
                const config = toJS(vizStore.visualConfig);
                return applyViewQuery(d, dims.concat(meas), {
                    op: config.defaultAggregated ? 'aggregate' : 'raw',
                    groupBy: dims.map((f) => f.fid),
                    measures: meas.map((f) => ({ field: f.fid, agg: f.aggName as any, asFieldKey: getMeaAggKey(f.fid, f.aggName!) })),
                });
            })
            .then((data) => {
                unstable_batchedUpdates(() => {
                    setViewData(data);
                    setWaiting(false);
                    setEncodings(toJS(vizStore.draggableFieldState));
                    setViewConfig(toJS(vizStore.visualConfig));
                });
            })
            .catch((err) => {
                console.error(err);
                setWaiting(false);
            });
    }, [dataSource, viewFilters, allFields, viewDimensions, viewMeasures]);

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
