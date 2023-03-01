import { observer } from "mobx-react-lite";
import React, { useState, useEffect, forwardRef } from "react";
import { applyFilter, applyViewQuery, transformDataService } from "../services";
import { IDarkMode, IThemeKey } from "../interfaces";
import SpecRenderer from "./specRenderer";
import { runInAction, toJS } from 'mobx';
import { Resizable } from 're-resizable';
import { useGlobalStore } from '../store';
import ReactVega, { IReactVegaHandler } from '../vis/react-vega';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures } = vizStore;
    const { currentDataset } = commonStore;
    const { dataSource } = currentDataset;

    const [viewData, setViewData] = useState(dataSource);

    useEffect(() => {
        applyFilter(dataSource, viewFilters)
            .then((data) => transformDataService(data, allFields))
            .then((d) => {
                setViewData(d);
            })
            .catch((err) => {
                console.error(err);
            });
    }, [dataSource, viewFilters, allFields]);

    useEffect(() => {
        const dims = vizStore.viewDimensions
        const meas = vizStore.viewMeasures;
        applyViewQuery(dataSource, dims.concat(meas), {
            op: 'aggregate',
            groupBy: dims.map(f => f.fid),
            agg: Object.fromEntries(meas.map(f => [f.fid, f.aggName as any]))
        }).then(data => {
            setViewData(data);
        }).catch((err) => {
            console.error(err);
        });
    }, [dataSource, viewDimensions, viewMeasures]);


    return <SpecRenderer data={viewData} ref={ref} themeKey={themeKey} dark={dark} />;
});

export default observer(Renderer);
