import { toJS } from 'mobx';
import { Resizable } from 're-resizable';
import React, { forwardRef, useMemo } from 'react';

import PivotTable from '../components/pivotTable';
import ReactVega, { IReactVegaHandler } from '../vis/react-vega';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig, VegaGlobalConfig } from '../interfaces';
import LoadingLayer from '../components/loadingLayer';
import { useCurrentMediaTheme } from '../utils/media';
import { builtInThemes } from '../vis/theme';

interface SpecRendererProps {
    name?: string;
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: DeepReadonly<IVisualConfig>;
    onGeomClick?: ((values: any, e: any) => void) | undefined;
    onChartResize?: ((width: number, height: number) => void) | undefined;
}
/**
 * Sans-store renderer of GraphicWalker.
 * This is a pure component, which means it will not depend on any global state.
 */
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { name, themeKey, dark, data, loading, draggableFieldState, visualConfig, onGeomClick, onChartResize },
    ref
) {
    // const { draggableFieldState, visualConfig } = vizStore;
    const { geoms, interactiveScale, defaultAggregated, stack, showActions, size, format: _format, background, zeroScale, resolve } = visualConfig;

    const rows = draggableFieldState.rows;
    const columns = draggableFieldState.columns;
    const color = draggableFieldState.color;
    const opacity = draggableFieldState.opacity;
    const shape = draggableFieldState.shape;
    const theta = draggableFieldState.theta;
    const radius = draggableFieldState.radius;
    const sizeChannel = draggableFieldState.size;
    const details = draggableFieldState.details;
    const text = draggableFieldState.text;
    const format = toJS(_format);

    const rowLeftFacetFields = useMemo(() => rows.slice(0, -1).filter((f) => f.analyticType === 'dimension'), [rows]);
    const colLeftFacetFields = useMemo(
        () => columns.slice(0, -1).filter((f) => f.analyticType === 'dimension'),
        [columns]
    );

    const isPivotTable = geoms[0] === 'table';

    const hasFacet = rowLeftFacetFields.length > 0 || colLeftFacetFields.length > 0;

    const enableResize = size.mode === 'fixed' && !hasFacet && Boolean(onChartResize);
    const mediaTheme = useCurrentMediaTheme(dark);
    const themeConfig = builtInThemes[themeKey ?? 'vega']?.[mediaTheme];

    const vegaConfig = useMemo<VegaGlobalConfig>(() => {
        const config: VegaGlobalConfig = {
            ...themeConfig,
            background: mediaTheme === 'dark' ? '#18181f' : '#ffffff',
        };
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
        config.scale.zero = Boolean(zeroScale);
        // @ts-ignore
        config.resolve = resolve;
        if (background) {
            config.background = background;
        }

        return config;
    }, [
        themeConfig,
        zeroScale,
        resolve,
        background,
        format.normalizedNumberFormat,
        format.numberFormat,
        format.timeFormat,
    ]);

    if (isPivotTable) {
        return (
            <PivotTable
                data={data}
                draggableFieldState={draggableFieldState}
                visualConfig={visualConfig}
                loading={loading}
                themeKey={themeKey}
                dark={dark}
            />
        );
    }

    return (
        <Resizable
            className={enableResize ? 'border-blue-400 border-2 overflow-hidden' : ''}
            style={{ padding: '12px' }}
            onResizeStop={(e, direction, ref, d) => {
                onChartResize?.(size.width + d.width, size.height + d.height);
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
            <ReactVega
                name={name}
                vegaConfig={vegaConfig}
                // format={format}
                layoutMode={size.mode}
                interactiveScale={interactiveScale}
                geomType={geoms[0]}
                defaultAggregate={defaultAggregated}
                stack={stack}
                dataSource={data}
                rows={rows}
                columns={columns}
                color={color[0]}
                theta={theta[0]}
                radius={radius[0]}
                shape={shape[0]}
                opacity={opacity[0]}
                size={sizeChannel[0]}
                details={details}
                text={text[0]}
                showActions={showActions}
                width={size.width - 12 * 4}
                height={size.height - 12 * 4}
                ref={ref}
                onGeomClick={onGeomClick}
            />
        </Resizable>
    );
});

export default SpecRenderer;
