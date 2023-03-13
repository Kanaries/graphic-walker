import { runInAction, toJS } from "mobx";
import { observer } from "mobx-react-lite";
import { Resizable } from "re-resizable";
import React, { useState, useCallback, useEffect, useRef, forwardRef, useMemo } from "react";
import { applyFilter } from "../services";
import { useGlobalStore } from "../store";
import ReactVega, { IReactVegaHandler } from "../vis/react-vega";
import { IDarkMode, IRow, IThemeKey } from "../interfaces";

interface SpecRendererProps {
    themeKey?: IThemeKey;
    dark?: IDarkMode;
    data: IRow[];
}
const SpecRenderer = forwardRef<IReactVegaHandler, SpecRendererProps>(function (
    { themeKey, dark, data },
    ref
) {
    const { vizStore, commonStore } = useGlobalStore();
    const { draggableFieldState, visualConfig } = vizStore;
    const { geoms, interactiveScale, defaultAggregated, stack, showActions, size, exploration } = visualConfig;

    const rows = toJS(draggableFieldState.rows);
    const columns = toJS(draggableFieldState.columns);
    const color = toJS(draggableFieldState.color);
    const opacity = toJS(draggableFieldState.opacity);
    const shape = toJS(draggableFieldState.shape);
    const theta = toJS(draggableFieldState.theta);
    const radius = toJS(draggableFieldState.radius);
    const sizeChannel = toJS(draggableFieldState.size);

    const rowLeftFacetFields = rows.slice(0, -1).filter((f) => f.analyticType === "dimension");
    const colLeftFacetFields = columns.slice(0, -1).filter((f) => f.analyticType === "dimension");

    const hasFacet = rowLeftFacetFields.length > 0 || colLeftFacetFields.length > 0;

    const shouldTriggerMenu = exploration.mode === "none";

    const handleGeomClick = useCallback(
        (values: any, e: any) => {
            if (shouldTriggerMenu) {
                e.stopPropagation();
                runInAction(() => {
                    commonStore.showEmbededMenu([e.pageX, e.pageY]);
                    commonStore.setFilters(values);
                });
            }
        },
        [shouldTriggerMenu]
    );
    const enableResize = size.mode === "fixed" && !hasFacet;

    return (
        <Resizable
            className={enableResize ? "border-blue-400 border-2 overflow-hidden" : ""}
            style={{ padding: "12px" }}
            onResizeStop={(e, direction, ref, d) => {
                vizStore.setChartLayout({
                    mode: "fixed",
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
                width: size.width + "px",
                height: size.height + "px",
            }}
        >
            <ReactVega
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
                showActions={showActions}
                width={size.width - 12 * 4}
                height={size.height - 12 * 4}
                ref={ref}
                brushEncoding={exploration.mode === "brush" ? exploration.brushDirection : "none"}
                selectEncoding={exploration.mode === "point" ? "default" : "none"}
                onGeomClick={handleGeomClick}
                themeKey={themeKey}
                dark={dark}
            />
        </Resizable>
    );
});

export default observer(SpecRenderer);
