import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, forwardRef, useMemo, useCallback, useRef } from 'react';
import { IDarkMode, IRow, IThemeKey, VegaGlobalConfig } from '../interfaces';
import { useTranslation } from 'react-i18next';
import SpecRenderer from './specRenderer';
import { runInAction, toJS } from 'mobx';
import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { unstable_batchedUpdates } from 'react-dom';
import { IVegaConfigSchema, transformGWSpec2VisSchema } from '../vis/protocol/adapter';
import type { IVisField, IVisSchema } from '../vis/protocol/interface';
import { useCurrentMediaTheme } from '../utils/media';
import { builtInThemes } from '../vis/theme';
import { useRenderer } from './hooks';

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
    const { format: _format, zeroScale, size, interactiveScale, showActions } = visualConfig;
    const { currentDataset } = commonStore;
    const { id: datasetId, dataSource } = currentDataset;

    const { i18n } = useTranslation();

    const [visSchema, setVisSchema] = useState<IVisSchema<IVegaConfigSchema>>({
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
    const [viewFields, setViewFields] = useState<IVisField[]>([]);
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

    const spec = useMemo(() => {
        return transformGWSpec2VisSchema({
            datasetId,
            visualConfig: toJS(visualConfig),
            draggableFieldState: toJS(draggableFieldState),
            vegaConfig: vegaConfig,
        });
    }, [datasetId, draggableFieldState, visualConfig, vegaConfig, viewFilters, viewDimensions, viewMeasures]);

    const { viewData: data, parsed, loading: waiting } = useRenderer({
        spec,
        datasetId,
        data: dataSource,
        fields: allFields,
    });

    // Dependencies that should not trigger effect individually
    const latestFromRef = useRef({ spec, data, parsed });
    latestFromRef.current = { spec, data, parsed };

    useEffect(() => {
        if (waiting === false) {
            unstable_batchedUpdates(() => {
                setVisSchema(latestFromRef.current.spec);
                setViewFields(latestFromRef.current.parsed.fields);
                vizStore.setParsedResult(
                    latestFromRef.current.parsed.workflow,
                    latestFromRef.current.spec,
                );
                setViewData(latestFromRef.current.data);
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
            schema={visSchema}
            fields={viewFields}
            locale={i18n.language}
            onGeomClick={handleGeomClick}
            onChartResize={handleChartResize}
        />
    );
});

export default observer(Renderer);
