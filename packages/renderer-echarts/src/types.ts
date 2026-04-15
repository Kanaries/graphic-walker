import type { RendererPluginProps } from "@kanaries/graphic-walker";

export type ViewField = RendererPluginProps["draggableFieldState"]["rows"][number];

export type EChartsSeries = Record<string, any>;

export type FacetCell = {
    rowIndex: number;
    colIndex: number;
    rowValue: any;
    colValue: any;
};

export type FieldBinding = {
    key?: string;
    title?: string;
    field?: ViewField;
};

export type PreparedCartesianState = {
    data: RendererPluginProps["data"];
    rows: ViewField[];
    columns: ViewField[];
};

export type ValueOrder = Map<string, number>;

export type SeriesVisualEncoding = {
    color?: string;
    opacity?: number;
    symbolSize?: number;
};

export type VariableWidthBarRow = Record<string, any> & {
    __category_value__: any;
    __value_raw__: number;
    __stack_start__: number;
    __stack_end__: number;
    __bar_width_ratio__: number;
};
