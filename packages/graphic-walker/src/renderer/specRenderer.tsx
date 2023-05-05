import { runInAction, toJS } from 'mobx';
import { Resizable } from 're-resizable';
import React, { useCallback, forwardRef, useMemo } from 'react';

import { useGlobalStore } from '../store';
import ReactVega, { IReactVegaHandler } from '../vis/react-vega';
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from '../interfaces';
import LoadingLayer from '../components/loadingLayer';

interface SpecRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
    loading: boolean;
    draggableFieldState: DeepReadonly<DraggableFieldState>;
    visualConfig: IVisualConfig;
}
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { themeKey, dark, data, loading, draggableFieldState, visualConfig },
    ref
) {
    const { vizStore, commonStore } = useGlobalStore();
    // const { draggableFieldState, visualConfig } = vizStore;
    const { geoms, interactiveScale, defaultAggregated, stack, showActions, size, format: _format } = visualConfig;

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
    const format = toJS(_format)

    const rowLeftFacetFields = useMemo(() => rows.slice(0, -1).filter((f) => f.analyticType === 'dimension'), [rows]);
    const colLeftFacetFields = useMemo(
        () => columns.slice(0, -1).filter((f) => f.analyticType === 'dimension'),
        [columns]
    );

    const hasFacet = rowLeftFacetFields.length > 0 || colLeftFacetFields.length > 0;

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
            <ReactVega
                format={format}
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
                onGeomClick={handleGeomClick}
                themeKey={themeKey}
                dark={dark}
            />
        </Resizable>
    );
});

export default SpecRenderer;
