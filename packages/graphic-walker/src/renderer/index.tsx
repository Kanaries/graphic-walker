import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useRef } from 'react';
import { IDarkMode, IRow, IThemeKey, VegaGlobalConfig } from '../interfaces';
import SpecRenderer from './specRenderer';
import { toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import type { IGWDataLoader } from '../dataLoader';
import { IVegaConfigSchema, transformGWSpec2VisSchema } from '../vis/protocol/adapter';
import type { IVisSchema } from '../vis/protocol/interface';
import { useCurrentMediaTheme } from '../utils/media';
import { builtInThemes } from '../vis/theme';
import { useRenderer } from './hooks';

interface RendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    dataLoader: IGWDataLoader;
}
const Renderer = forwardRef<IReactVegaHandler, RendererProps>(function (props, ref) {
    const { dataLoader, themeKey, dark } = props;
    const { vizStore, commonStore } = useGlobalStore();
    const { allFields, viewFilters, viewDimensions, viewMeasures, visualConfig, draggableFieldState } = vizStore;
    const { format: _format, zeroScale, size, interactiveScale, showActions } = visualConfig;
    const { currentDataset } = commonStore;
    const { dataSource, id: datasetId } = currentDataset;

    const [visSpec, setVisSpec] = useState<IVisSchema<IVegaConfigSchema>>({
        datasetId,
        markType: 'bar',
        encodings: {},
        configs: {
            vegaConfig: {},
            size,
            format: _format,
            interactiveScale,
            showActions,
            zeroScale,
        },
    });
    const [viewData, setViewData] = useState<IRow[]>([]);

    const dimensions = useMemo(() => {
        return draggableFieldState.dimensions.map(d => d.fid);
    }, [draggableFieldState.dimensions]);
    const measures = useMemo(() => {
        return draggableFieldState.measures.map(d => d.fid);
    }, [draggableFieldState.measures]);

    useEffect(() => {
        dataLoader.syncMeta({
            datasetId,
            dimensions: dimensions.map(key => allFields.find(f => f.fid === key)!).filter(Boolean).map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
                expression: f.computed && f.expression ? f.expression : undefined,
            })),
            measures: measures.map(key => allFields.find(f => f.fid === key)!).filter(Boolean).map(f => ({
                key: f.fid,
                name: f.name,
                type: f.semanticType,
                expression: f.computed && f.expression ? f.expression : undefined,
            })),
        });
    }, [dataLoader, allFields, datasetId, dimensions, measures]);

    useEffect(() => {
        dataLoader.syncData(dataSource);
    }, [dataLoader, dataSource]);

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

    const spec = useMemo(() => {
        return transformGWSpec2VisSchema({
            datasetId,
            visualConfig,
            draggableFieldState,
            vegaConfig: vegaConfig,
        });
    }, [datasetId, draggableFieldState, visualConfig, vegaConfig, viewFilters, viewDimensions, viewMeasures]);

    const { viewData: data, parsed, loading: waiting } = useRenderer({
        spec,
        dataLoader,
    });

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ spec, data, parsed });
    latestFromRef.current = { spec, data, parsed };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setVisSpec(latestFromRef.current.spec);
                setViewData(latestFromRef.current.data);
                vizStore.setWorkflow(latestFromRef.current.parsed.workflow);
            });
        }
    }, [waiting, vizStore]);

    const [{ dimensions: dims, measures: meas }, metaLoading] = dataLoader.useMeta();
    const fields = useMemo(() => [...dims, ...meas], [dims, meas]);

    return (
        <SpecRenderer
            spec={visSpec}
            loading={waiting || metaLoading}
            data={viewData}
            fields={fields}
            ref={ref}
            themeKey={themeKey}
            dark={dark}
        />
    );
});

export default observer(Renderer);
