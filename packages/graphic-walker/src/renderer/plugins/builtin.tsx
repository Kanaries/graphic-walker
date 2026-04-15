import React from 'react';
import ReactVega from '../../vis/react-vega';
import type { RendererPlugin } from './types';
import { registerRendererPlugin } from './registry';

export const builtinVegaRendererPlugin: RendererPlugin = {
    id: 'builtin:vega',
    displayName: 'Vega-Lite',
    priority: 100,
    render: ({
        name,
        data,
        draggableFieldState,
        visualConfig,
        layout,
        locale,
        onGeomClick,
        scales,
        onReportSpec,
        vegaConfig,
        rendererRef,
        chartWidth,
        chartHeight,
    }) => (
        <ReactVega
            name={name}
            vegaConfig={vegaConfig}
            layoutMode={layout.size.mode}
            interactiveScale={layout.interactiveScale}
            geomType={visualConfig.geoms[0]}
            defaultAggregate={visualConfig.defaultAggregated}
            stack={layout.stack}
            dataSource={data}
            rows={draggableFieldState.rows}
            columns={draggableFieldState.columns}
            color={draggableFieldState.color[0]}
            theta={draggableFieldState.theta[0]}
            radius={draggableFieldState.radius[0]}
            shape={draggableFieldState.shape[0]}
            opacity={draggableFieldState.opacity[0]}
            size={draggableFieldState.size[0]}
            details={draggableFieldState.details}
            text={draggableFieldState.text[0]}
            showActions={layout.showActions}
            width={chartWidth}
            height={chartHeight}
            ref={rendererRef}
            onGeomClick={onGeomClick}
            locale={locale}
            useSvg={layout.useSvg}
            scales={scales}
            scale={layout.scale}
            onReportSpec={onReportSpec}
            displayOffset={visualConfig.timezoneDisplayOffset}
        />
    ),
};

let initialized = false;

export function ensureBuiltinRendererPlugins() {
    if (initialized) {
        return;
    }
    registerRendererPlugin(builtinVegaRendererPlugin);
    initialized = true;
}
