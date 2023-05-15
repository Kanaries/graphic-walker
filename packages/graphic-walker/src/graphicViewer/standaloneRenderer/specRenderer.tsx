import React, { forwardRef, useCallback } from "react";
import { runInAction, toJS } from "mobx";
import LoadingLayer from "../../components/loadingLayer";
import ReactVega, { IReactVegaHandler } from "../../vis/react-vega";
import { DeepReadonly, DraggableFieldState, IDarkMode, IRow, IThemeKey, IVisualConfig } from "../../interfaces";
import { initVisualConfig } from "../../store/visualSpecStore";

interface SpecRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode
    data: IRow[];
    loading: boolean;
    visSpecEncodings: DeepReadonly<DraggableFieldState>;
    visualConfig?: IVisualConfig;
}

const StandaloneSpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { themeKey, dark, data, loading, visSpecEncodings, visualConfig },
    ref
) {
    // const { draggableFieldState, visualConfig } = vizStore;
    const { geoms, interactiveScale, defaultAggregated, stack, showActions, size, format: _format } = visualConfig || initVisualConfig()

    const rows = visSpecEncodings.rows;
    const columns = visSpecEncodings.columns;
    const color = visSpecEncodings.color;
    const opacity = visSpecEncodings.opacity;
    const shape = visSpecEncodings.shape;
    const theta = visSpecEncodings.theta;
    const radius = visSpecEncodings.radius;
    const sizeChannel = visSpecEncodings.size;
    const details = visSpecEncodings.details;
    const text = visSpecEncodings.text;
    const format = toJS(_format)

    const handleGeomClick = useCallback((values: any, e: any) => {
        e.stopPropagation();
        runInAction(() => { });
    }, []);

    return (
        <>
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
        </>
    );
});

export default StandaloneSpecRenderer;