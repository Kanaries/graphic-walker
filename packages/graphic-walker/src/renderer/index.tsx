import { observer } from "mobx-react-lite";
import React, { useState, useEffect, forwardRef } from "react";
import { applyFilter, transformDataService } from "../services";
import { useGlobalStore } from "../store";
import { IReactVegaHandler } from "../vis/react-vega";
import { IDarkMode, IThemeKey } from "../interfaces";
import SpecRenderer from "./specRenderer";

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters } = vizStore;
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

    return <SpecRenderer data={viewData} ref={ref} themeKey={themeKey} dark={dark} />;
});

export default observer(Renderer);
