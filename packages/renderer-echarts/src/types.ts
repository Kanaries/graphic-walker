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
