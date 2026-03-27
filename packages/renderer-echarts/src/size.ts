import type { RendererPluginProps } from "@kanaries/graphic-walker";

import { axisTypeForField, getFacetField, getFieldBinding, isSyntheticMeasureFacetField, orderedUniqueValues, prepareCartesianState } from "./utils";

type RenderMode = RendererPluginProps["layout"]["size"]["mode"];

export type ResolvedRenderSize = {
    mode: RenderMode;
    width: number;
    height: number;
};

const AUTO_BASE_WIDTH_PER_PANEL = 280;
const AUTO_BASE_HEIGHT_PER_PANEL = 220;
const AUTO_X_THRESHOLD = 6;
const AUTO_Y_THRESHOLD = 6;
const AUTO_X_STEP = 28;
const AUTO_Y_STEP = 24;
const AUTO_MIN_WIDTH = 320;
const AUTO_MIN_HEIGHT = 220;
const AUTO_MAX_WIDTH = 1800;
const AUTO_MAX_HEIGHT = 1200;
const AUTO_HORIZONTAL_PADDING = 56;
const AUTO_VERTICAL_PADDING = 40;

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function resolveDiscreteAxisDomainCount(data: RendererPluginProps["data"], field?: RendererPluginProps["draggableFieldState"]["rows"][number]) {
    if (!field || axisTypeForField(field) !== "category") {
        return 1;
    }
    const binding = getFieldBinding(data, field);
    return Math.max(1, orderedUniqueValues(data, binding).length);
}

export function computeAutoChartSize(props: RendererPluginProps): ResolvedRenderSize {
    const prepared = prepareCartesianState(props);
    const xField = prepared.columns[prepared.columns.length - 1];
    const yField = prepared.rows[prepared.rows.length - 1];
    const rowFacetField = getFacetField(prepared.rows);
    const colFacetField = getFacetField(prepared.columns);
    const rowFacetBinding = getFieldBinding(prepared.data, rowFacetField);
    const colFacetBinding = getFieldBinding(prepared.data, colFacetField);
    const rowPanelCount = Math.max(1, rowFacetBinding.key ? orderedUniqueValues(prepared.data, rowFacetBinding).length : 1);
    const colPanelCount = Math.max(1, colFacetBinding.key ? orderedUniqueValues(prepared.data, colFacetBinding).length : 1);
    const xDomainCount = isSyntheticMeasureFacetField(xField) ? 1 : resolveDiscreteAxisDomainCount(prepared.data, xField);
    const yDomainCount = isSyntheticMeasureFacetField(yField) ? 1 : resolveDiscreteAxisDomainCount(prepared.data, yField);
    const width = AUTO_BASE_WIDTH_PER_PANEL * colPanelCount + AUTO_X_STEP * Math.max(0, xDomainCount - AUTO_X_THRESHOLD) + AUTO_HORIZONTAL_PADDING;
    const height = AUTO_BASE_HEIGHT_PER_PANEL * rowPanelCount + AUTO_Y_STEP * Math.max(0, yDomainCount - AUTO_Y_THRESHOLD) + AUTO_VERTICAL_PADDING;

    return {
        mode: "auto",
        width: clamp(width, AUTO_MIN_WIDTH, AUTO_MAX_WIDTH),
        height: clamp(height, AUTO_MIN_HEIGHT, AUTO_MAX_HEIGHT),
    };
}

export function resolveChartRenderSize(props: RendererPluginProps): ResolvedRenderSize {
    if (props.layout.size.mode === "fixed") {
        return {
            mode: "fixed",
            width: props.chartWidth,
            height: props.chartHeight,
        };
    }

    if (props.layout.size.mode === "full") {
        return {
            mode: "full",
            width: props.chartWidth,
            height: props.chartHeight,
        };
    }

    return computeAutoChartSize(props);
}
