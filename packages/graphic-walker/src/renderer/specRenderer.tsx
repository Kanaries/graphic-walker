import { runInAction, toJS } from 'mobx';
import { Resizable } from 're-resizable';
import React, { useCallback, forwardRef, useMemo } from 'react';

import { useGlobalStore } from '../store';
import { IReactVegaHandler } from '../vis/react-vega';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig, VegaGlobalConfig } from '../interfaces';
import LoadingLayer from '../components/loadingLayer';
import { useCurrentMediaTheme } from '../utils/media';
import { builtInThemes } from '../vis/theme';
import { transformGWSpec2VisSpec } from '../vis/protocol/adapter';
import VegaRenderer from '../vis/vega-renderer';
import type { IGWDataLoader } from '../dataLoader';

interface SpecRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
    dataLoader: IGWDataLoader;
}
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { themeKey, dark, data, loading, draggableFieldState, visualConfig, dataLoader },
    ref
) {
    const { vizStore, commonStore } = useGlobalStore();
    // const { draggableFieldState, visualConfig } = vizStore;
    const { interactiveScale, showActions, size, format: _format, zeroScale } = visualConfig;
    const datasetId = commonStore.currentDataset.id;

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
        return transformGWSpec2VisSpec({
            datasetId,
            visualConfig,
            draggableFieldState,
            vegaConfig: vegaConfig,
        });
    }, [datasetId, visualConfig, draggableFieldState, vegaConfig]);

    const hasFacet = Boolean(spec.encodings.row || spec.encodings.column);

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
    const enableResize = size.mode === 'fixed' && !hasFacet;

    return (
        <Resizable
            className={enableResize ? 'border-blue-400 border-2 overflow-hidden' : ''}
            style={{ padding: '12px' }}
            onResizeStop={(e, direction, ref, d) => {
                vizStore.setChartLayout({
                    mode: 'fixed',
                    width: size.width + d.width,
                    height: size.height + d.height,
                });
            }}
            enable={
                enableResize
                    ? undefined
                    : {
                          top: false,
                          right: false,
                          bottom: false,
                          left: false,
                          topRight: false,
                          bottomRight: false,
                          bottomLeft: false,
                          topLeft: false,
                      }
            }
            size={{
                width: size.width + 'px',
                height: size.height + 'px',
            }}
        >
            {loading && <LoadingLayer />}
            <VegaRenderer
                spec={spec}
                data={data}
                dataLoader={dataLoader}
                ref={ref}
                onGeomClick={handleGeomClick}
                themeKey={themeKey}
                dark={dark}
                showActions={showActions}
                format={format}
                interactiveScale={interactiveScale}
            />
        </Resizable>
    );
});

export default SpecRenderer;
