import {Config as VgConfig, View} from 'vega';
import {Config as VlConfig} from 'vega-lite';
import type { FeatureCollection } from 'geojson';
import type { feature } from 'topojson-client';
import type {IViewQuery} from "./lib/viewQuery";

export type DeepReadonly<T extends Record<keyof any, any>> = {
    readonly [K in keyof T]: T[K] extends Record<keyof any, any> ? DeepReadonly<T[K]> : T[K];
};
export type ISemanticType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
export type IDataType = 'number' | 'integer' | 'boolean' | 'date' | 'string';
export type IAnalyticType = 'dimension' | 'measure';

export interface IRow {
    [key: string]: any;
}

export type IAggregator = 'sum' | 'count' | 'max' | 'min' | 'mean' | 'median' | 'variance' | 'stdev';
export interface Specification {
    position?: string[];
    color?: string[];
    size?: string[];
    shape?: string[];
    opacity?: string[];
    facets?: string[];
    page?: string[];
    filter?: string[];
    highFacets?: string[];
    geomType?: string[];
    aggregate?: boolean;
}
export interface Filters {
    [key: string]: any[];
}

export interface IMutField {
    fid: string;
    key?: string;
    name?: string;
    basename?: string;
    disable?: boolean;
    semanticType: ISemanticType;
    analyticType: IAnalyticType;
    path?: string[];
}

export interface IUncertainMutField {
    fid: string;
    key?: string;
    name?: string;
    basename?: string;
    disable?: boolean;
    semanticType: ISemanticType | '?';
    analyticType: IAnalyticType | '?';
    path: string[];
}

export interface IDatasetStats {
    rowCount: number;
}

export interface IFieldStats {
    values: { value: number | string; count: number }[];
    range: [number, number];
}

export type IExpParamter =
    | {
          type: 'field';
          value: string;
      }
    | {
          type: 'value';
          value: any;
      }
    | {
          type: 'expression';
          value: IExpression;
      }
    | {
          type: 'constant';
          value: any;
      };

export interface IExpression {
    op: 'bin' | 'log2' | 'log10' | 'one' | 'binCount';
    params: IExpParamter[];
    as: string;
}

export type IGeoRole = 'longitude' | 'latitude' | 'none';

export interface IField {
    /**
     * fid: key in data record
     */
    fid: string;
    /**
     * display name for field
     */
    name: string;
    /**
     * aggregator's name
     */
    aggName?: string;
    semanticType: ISemanticType;
    analyticType: IAnalyticType;
    geoRole?: IGeoRole;
    cmp?: (a: any, b: any) => number;
    computed?: boolean;
    expression?: IExpression;
    basename?: string;
    path?: string[],
}
export type ISortMode = 'none' | 'ascending' | 'descending';
export interface IViewField extends IField {
    dragId: string;
    sort?: ISortMode;
}

export interface DataSet {
    id: string;
    name: string;
    rawFields: IMutField[];
    dataSource: IRow[];
}

export interface IFieldNeighbor {
    key: string;
    cc: number;
}

export interface IMeasure {
    key: string;
    op: IAggregator;
}

export interface IPredicate {
    key: string;
    type: "discrete" | "continuous";
    range: Set<any> | [number, number];
}

export interface IExplainProps {
    dataSource: IRow[];
    predicates: IPredicate[];
    viewFields: IField[];
    metas: IField[];
}

export interface IDataSet {
    id: string;
    name: string;
    rawFields: IMutField[];
    dsId: string;
}
/**
 * use as props to create a new dataset(IDataSet).
 */
export interface IDataSetInfo {
    name: string;
    rawFields: IMutField[];
    dataSource: IRow[];
}

export interface IDataSource {
    id: string;
    data: IRow[];
}

export interface IFilterField extends IViewField {
    rule: IFilterRule | null;
}

export interface IFilterFiledSimple {
    fid: string;
    rule: IFilterRule | null;
}

export interface DraggableFieldState {
    dimensions: IViewField[];
    measures: IViewField[];
    rows: IViewField[];
    columns: IViewField[];
    color: IViewField[];
    opacity: IViewField[];
    size: IViewField[];
    shape: IViewField[];
    theta: IViewField[];
    radius: IViewField[];
    longitude: IViewField[];
    latitude: IViewField[];
    geoId: IViewField[];
    details: IViewField[];
    filters: IFilterField[];
    text: IViewField[];
}

export interface IDraggableStateKey {
    id: keyof DraggableFieldState;
    mode: number;
}

export type IFilterRule =
    | {
          type: 'range';
          value: readonly [number, number];
      }
    | {
          type: 'temporal range';
          value: readonly [number, number];
      }
    | {
          type: 'one of';
          value: Set<string | number>;
      };

export type IStackMode = 'none' | 'stack' | 'normalize' | 'zero' | 'center';

export type ICoordMode = 'generic' | 'geographic';

export interface IVisualConfig {
    defaultAggregated: boolean;
    geoms: string[];
    showTableSummary: boolean;
    /** @default "generic" */
    coordSystem?: ICoordMode;
    stack: IStackMode;
    showActions: boolean;
    interactiveScale: boolean;
    sorted: ISortMode;
    zeroScale: boolean;
    /** @default false */
    scaleIncludeUnmatchedChoropleth?: boolean;
    background?: string;
    format: {
        numberFormat?: string;
        timeFormat?: string;
        normalizedNumberFormat?: string;
    };
    resolve: {
        x?: boolean;
        y?: boolean;
        color?: boolean;
        opacity?: boolean;
        shape?: boolean;
        size?: boolean;
    };
    size: {
        mode: 'auto' | 'fixed';
        width: number;
        height: number;
    };
    geojson?: FeatureCollection;
    geoKey?: string;
    limit: number;
}

export interface IVisSpec {
    readonly visId: string;
    readonly name?: string;
    readonly encodings: DeepReadonly<DraggableFieldState>;
    readonly config: DeepReadonly<IVisualConfig>;
}

export type SetToArray<T> = (
    T extends object ? (
      T extends Set<infer U> ? Array<U> : { [K in keyof T]: SetToArray<T[K]> }
    ) : T
);

export type IVisSpecForExport = SetToArray<IVisSpec>;

export type IFilterFieldForExport = SetToArray<IFilterField>;

export enum ISegmentKey {
    vis = 'vis',
    data = 'data',
}

export type IThemeKey = 'vega' | 'g2';
export type IDarkMode = 'media' | 'light' | 'dark';
export type IComputationFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;

export type VegaGlobalConfig = VgConfig | VlConfig;

export interface IVegaChartRef {
    x: number;
    y: number;
    w: number;
    h: number;
    innerWidth: number;
    innerHeight: number;
    view: View;
    canvas: HTMLCanvasElement | null;
}

export interface IChartExportResult<T extends 'svg' | 'data-url' = 'svg' | 'data-url'> {
    mode: T;
    title: string;
    nCols: number;
    nRows: number;
    charts: {
        colIndex: number;
        rowIndex: number;
        width: number;
        height: number;
        canvasWidth: number;
        canvasHeight: number;
        data: string;
        canvas(): HTMLCanvasElement | null;
    }[];
    container(): HTMLDivElement | null;
    chartType?: string;
}

interface IExportChart {
    <T extends Extract<IChartExportResult['mode'], 'svg'>>(mode?: T): Promise<IChartExportResult<T>>;
    <T extends IChartExportResult['mode']>(mode: T): Promise<IChartExportResult<T>>;
}

export interface IChartListExportResult<T extends 'svg' | 'data-url' = 'svg' | 'data-url'> {
    mode: T;
    total: number;
    index: number;
    data: IChartExportResult<T>;
    hasNext: boolean;
}

interface IExportChartList {
    <T extends Extract<IChartExportResult['mode'], 'svg'>>(mode?: T): AsyncGenerator<IChartListExportResult<T>, void, unknown>;
    <T extends IChartExportResult['mode']>(mode: T): AsyncGenerator<IChartListExportResult<T>, void, unknown>;
}

/**
 * The status of the current chart.
 * * `computing`: _GraphicWalker_ is computing the data view.
 * * `rendering`: _GraphicWalker_ is rendering the chart.
 * * `idle`: rendering is finished.
 * * `error`: an error occurs during the process above.
 */
export type IRenderStatus = 'computing' | 'rendering' | 'idle' | 'error';

export interface IGWHandler {
    /** length of the "chart" tab list */
    chartCount: number;
    /** current selected chart index */
    chartIndex: number;
    /** Switches to the specified chart */
    openChart: (index: number) => void;
    /**
     * Returns the status of the current chart.
     * 
     * It is computed by the following rules:
     * - If _GraphicWalker_ is computing the data view, it returns `computing`.
     * - If _GraphicWalker_ is rendering the chart, it returns `rendering`.
     * - If rendering is finished, it returns `idle`.
     * - If an error occurs during the process above, it returns `error`.
     */
    get renderStatus(): IRenderStatus;
    /**
     * Registers a callback function to listen to the status change of the current chart.
     * 
     * @param {(renderStatus: IRenderStatus) => void} cb - the callback function
     * @returns {() => void} a dispose function to remove this callback
     */
    onRenderStatusChange: (cb: (renderStatus: IRenderStatus) => void) => (() => void);
    /**
     * Exports the current chart.
     * 
     * @param {IChartExportResult['mode']} [mode='svg'] - the export mode, either `svg` or `data-url`
     */
    exportChart: IExportChart;
    /**
     * Exports all charts.
     * 
     * @param {IChartExportResult['mode']} [mode='svg'] - the export mode, either `svg` or `data-url`
     * @returns {AsyncGenerator<IChartListExportResult, void, unknown>} an async generator to iterate over all charts
     * @example
     * ```ts
     * for await (const chart of gwRef.current.exportChartList()) {
     *     console.log(chart);
     * }
     * ```
     */
    exportChartList: IExportChartList;
}

export interface IGWHandlerInsider extends IGWHandler {
    updateRenderStatus: (renderStatus: IRenderStatus) => void;
}

export interface IVisField {
    key: string;
    type: ISemanticType;
    name?: string;
    description?: string;
    format?: string;
    expression?: IExpression;
}

export type IVisFieldComputation = {
    field: IVisField['key'];
    expression: NonNullable<IVisField['expression']>;
    name: NonNullable<IVisField['name']>;
    type: IVisField['type'];
};

export interface IVisFilter {
    fid: string;
    rule: SetToArray<IFilterRule>;
};

export interface IFilterWorkflowStep {
    type: 'filter';
    filters: IVisFilter[];
}

export interface ITransformWorkflowStep {
    type: 'transform';
    transform: {
        key: IVisFieldComputation['field'];
        expression: IVisFieldComputation['expression'];
    }[];
}

export interface IViewWorkflowStep {
    type: 'view';
    query: IViewQuery[];
}

export interface ISortWorkflowStep {
    type: 'sort';
    sort: 'ascending' | 'descending';
    by: string[];
}

export type IDataQueryWorkflowStep = IFilterWorkflowStep | ITransformWorkflowStep | IViewWorkflowStep | ISortWorkflowStep;

export interface IDataQueryPayload {
    workflow: IDataQueryWorkflowStep[];
    limit?: number;
    offset?: number;
}

export interface ILoadDataPayload {
    pageSize: number;
    pageIndex: number;
}

export interface IGWDatasetStat {
    count: number;
}

export type IResponse<T> = (
    | {
        success: true;
        data: T;
    }
    | {
        success: false;
        message: string;
        error?: {
            code: `ERR_${Uppercase<string>}`;
            options?: Record<string, string>;
        };
    }
);

export type Topology = Parameters<typeof feature>[0];

export type IGeographicData = (
    | {
        type: 'GeoJSON';
        data: FeatureCollection;
    }
    | {
        type: 'TopoJSON';
        data: Topology;
        /**
         * default to the first key of `objects` in Topology
         */
        objectKey?: string;
    }
);
