import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { IDarkMode, IRow, IThemeKey, VegaGlobalConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { useCurrentMediaTheme } from '../utils/media';
import { builtInThemes } from '../vis/theme';
import { useRenderer } from './hooks';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { themeKey, dark } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures, visualConfig } = vizStore;
    const { format: _format, zeroScale } = visualConfig;
    const { currentDataset } = commonStore;
    const { dataSource } = currentDataset;

    const [viewData, setViewData] = useState<IRow[]>([]);

    const format = toJS(_format);
    const mediaTheme = useCurrentMediaTheme(dark);
    const themeConfig = builtInThemes[themeKey ?? 'vega']?.[mediaTheme];

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const config: VegaGlobalConfig = {
          ...themeConfig,
        }
        if (format.normalizedNumberFormat && format.normalizedNumberFormat.length > 0) {
            // @ts-ignore
            config.normalizedNumberFormat = format.normalizedNumberFormat;
        }
        if (format.numberFormat && format.numberFormat.length > 0) {
            // @ts-ignore
            config.numberFormat = format.numberFormat;
        }
        if (format.timeFormat && format.timeFormat.length > 0) {
            // @ts-ignore
            config.timeFormat = format.timeFormat;
        }
        // @ts-ignore
        if (!config.scale) {
            // @ts-ignore
            config.scale = {};
        }
        // @ts-ignore
        config.scale.zero = Boolean(zeroScale)
        return config;
    }, [themeConfig, zeroScale, format.normalizedNumberFormat, format.numberFormat, format.timeFormat]);

    const { viewData: data, loading: waiting } = useRenderer({
        data: dataSource,
        allFields,
        viewDimensions,
        viewMeasures,
        filters: viewFilters,
        defaultAggregated: visualConfig.defaultAggregated,
    });

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ data });
    latestFromRef.current = { data };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setViewData(latestFromRef.current.data);
            });
        }
    }, [waiting, vizStore]);

    return (
        <SpecRenderer
            loading={waiting}
            data={viewData}
            fields={allFields}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
        />
    );
});

export default observer(Renderer);
