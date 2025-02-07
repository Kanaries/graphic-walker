import { Config as VgConfig, View } from 'vega';
import { Config as VlConfig } from 'vega-lite';
import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import type { feature } from 'topojson-client';
import { DATE_TIME_DRILL_LEVELS } from './constants';
import { ToolbarItemProps } from './components/toolbar';
import { GWGlobalConfig } from './vis/theme';
import { VizSpecStore } from './store/visualSpecStore';
import { CommonStore } from './store/commonStore';
import type { XOR } from 'ts-xor';

export type DeepReadonly<T extends Record<keyof any, any>> = {
    readonly [K in keyof T]: T[K] extends Record<keyof any, any> ? DeepReadonly<T[K]> : T[K];
};
export type ISemanticType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal';
export type IDataType = 'number' | 'integer' | 'boolean' | 'date' | 'string';
export type IAnalyticType = 'dimension' | 'measure';

export interface IRow {
    [key: string]: any;
}

export type IAggregator = 'sum' | 'count' | 'max' | 'min' | 'mean' | 'median' | 'variance' | 'stdev' | 'distinctCount' | 'expr';

export type IEmbedMenuItem = 'data_interpretation' | 'data_view';
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

export interface ICreateField {
    channel: 'dimensions' | 'measures';
    index: number;
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
    offset?: number;
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
    valuesMeta: { total: number; distinctTotal: number };
    selectedCount: number;
    range: [number, number];
}

/** @deprecated */
export interface IPaintMap {
    /** fid of x */
    x: string;
    /** fid of y */
    y: string;
    domainX: [number, number];
    domainY: [number, number];
    /** width */
    mapwidth: number;
    /** a bit map, compressed array of UInt8[mapwidth][mapwidth] */
    map: string;
    /** map values */
    dict: Record<number, { name: string; color: string }>;
    usedColor: number[];
}

export interface IPaintDimension {
    fid: string;
    domain:
        | {
              type: 'nominal';
              value: any[];
              // = value.length
              width: number;
          }
        | {
              type: 'quantitative';
              value: [number, number];
              width: number;
          };
    // TODO: impement the temporal support
    // | {
    //       type: 'temporal';
    //       value: [number, number];
    //       width: number;
    //       offset?: number;
    //       format?: string;
    //   };
}

export interface IPaintMapFacet {
    dimensions: IPaintDimension[];
    /** a bit map, compressed array of UInt8[dimensions.reduce((x,d) => x * d.domain.width, 1)] */
    map: string;
    usedColor: number[];
}

export interface IPaintMapV2 {
    facets: IPaintMapFacet[];
    dict: Record<number, { name: string; color: string }>;
    usedColor: number[];
}

export type IExpParameter =
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
      }
    | {
          type: 'format';
          value: string;
      }
    | {
          type: 'offset';
          value: number;
      }
    | {
          type: 'map';
          value: IPaintMap;
      }
    | {
          type: 'sql';
          value: string;
      }
    | {
          type: 'newmap';
          value: IPaintMapV2;
      }
    | {
          type: 'displayOffset';
          value: number;
      };

export interface IExpression {
    op: 'bin' | 'log2' | 'log10' | 'one' | 'binCount' | 'dateTimeDrill' | 'dateTimeFeature' | 'log' | 'paint' | 'expr';
    params: IExpParameter[];
    as: string;
    num?: number;
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
     * aggregator's name, "expr" represents for aggergated computed field.
     */
    aggName?: string;
    semanticType: ISemanticType;
    analyticType: IAnalyticType;
    cmp?: string;
    geoRole?: IGeoRole;
    computed?: boolean;
    expression?: IExpression;
    timeUnit?: (typeof DATE_TIME_DRILL_LEVELS)[number];
    basename?: string;
    path?: string[];
    offset?: number;
    aggergated?: boolean;
}
export type ISortMode = 'none' | 'ascending' | 'descending';
export interface IViewField extends IField {
    sort?: ISortMode;
}

// shadow type of identifier of a Field, getting it using "getFieldIdentifier" in "@/utils"
export type FieldIdentifier = string & { _tagFieldId: never };

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
    type: 'discrete' | 'continuous';
    range: Set<any> | [number, number];
}

export interface IExplainProps {
    dataSource: IRow[];
    predicates: IPredicate[];
    viewFields: IField[];
    metas: IField[];
}

/** @deprecated */
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
    metaId?: string;
    name?: string;
    data: IRow[];
}

export interface IFilterField extends IViewField {
    rule: IFilterRule | null;
    enableAgg?: boolean;
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

export interface IDraggableViewStateKey {
    id: keyof Omit<DraggableFieldState, 'filters'>;
    mode: number;
}

export type IFilterRule =
    | {
          type: 'range';
          value: [number | null, number | null];
      }
    | {
          type: 'temporal range';
          value: [number | null, number | null];
          offset?: number;
          format?: string;
      }
    | {
          type: 'one of';
          value: any[];
      }
    | {
          type: 'not in';
          value: any[];
      }
    | {
          type: 'regexp';
          value: string;
          caseSensitive?: boolean;
      };

export interface IKeyWord {
    value: string;
    caseSenstive: boolean;
    word: boolean;
    regexp: boolean;
}

export type IStackMode = 'none' | 'stack' | 'normalize' | 'zero' | 'center';

export type ICoordMode = 'generic' | 'geographic';

export type IConfigScale = {
    rangeMax?: number;
    rangeMin?: number;
    domainMin?: number;
    domainMax?: number;
    type?: 'linear' | 'log' | 'pow' | 'sqrt' | 'symlog';
};

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
    useSvg?: boolean;
    format: {
        numberFormat?: string;
        timeFormat?: string;
        normalizedNumberFormat?: string;
    };
    primaryColor?: string;
    colorPalette?: string;
    scale?: IConfigScaleSet;
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
    geojson?: FeatureCollection<Geometry, GeoJsonProperties>;
    geoKey?: string;
    geoUrl?: IGeoUrl;
    limit: number;
    folds?: string[];
}

export interface IConfigScaleSet {
    row?: IConfigScale;
    column?: IConfigScale;
    color?: IConfigScale;
    opacity?: IConfigScale;
    size?: IConfigScale;
    radius?: IConfigScale;
    theta?: IConfigScale;
}

export interface IVisualLayout {
    showTableSummary: boolean;
    format: {
        numberFormat?: string;
        timeFormat?: string;
        normalizedNumberFormat?: string;
    };
    primaryColor?: string;
    colorPalette?: string;
    scale?: IConfigScaleSet;
    resolve: {
        x?: boolean;
        y?: boolean;
        color?: boolean;
        opacity?: boolean;
        shape?: boolean;
        size?: boolean;
    };
    size: {
        mode: 'auto' | 'fixed' | 'full';
        width: number;
        height: number;
    };
    useSvg?: boolean;
    geojson?: FeatureCollection<Geometry, GeoJsonProperties>;
    geoKey?: string;
    geoUrl?: IGeoUrl;
    geoMapTileUrl?: string;
    interactiveScale: boolean;
    stack: IStackMode;
    showActions: boolean;
    zeroScale: boolean;
    background?: string;
    /** @default false */
    scaleIncludeUnmatchedChoropleth?: boolean;
    showAllGeoshapeInChoropleth?: boolean;
}

export interface IVisualConfigNew {
    defaultAggregated: boolean;
    geoms: string[];
    /** @default "generic" */
    coordSystem?: ICoordMode;
    limit: number;
    folds?: string[];
    timezoneDisplayOffset?: number;
}

export interface IGeoUrl {
    type: 'GeoJSON' | 'TopoJSON';
    url: string;
}

/** @deprecated */
export interface IVisSpec {
    readonly visId: string;
    readonly name?: string;
    readonly encodings: DeepReadonly<DraggableFieldState>;
    readonly config: DeepReadonly<IVisualConfig>;
}

export enum ISegmentKey {
    vis = 'vis',
    data = 'data',
    chat = 'chat',
}

export type IThemeKey = 'vega' | 'g2' | 'streamlit';
export type IDarkMode = 'media' | 'light' | 'dark';
export type IComputationFunction = (payload: IDataQueryPayload) => Promise<IRow[]>;

export type VegaGlobalConfig = VgConfig & VlConfig & { leafletGeoTileUrl?: string };

export interface IVegaChartRef {
    x: number;
    y: number;
    w: number;
    h: number;
    innerWidth: number;
    innerHeight: number;
    view: View;
    canvas: HTMLCanvasElement | SVGSVGElement | null;
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
        canvas(): HTMLCanvasElement | SVGSVGElement | null;
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
    onRenderStatusChange: (cb: (renderStatus: IRenderStatus) => void) => () => void;
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

export type IFieldTransform = {
    key: IVisFieldComputation['field'];
    expression: IVisFieldComputation['expression'];
};

export interface IVisFilter {
    fid: string;
    rule: IFilterRule;
}

export interface IFilterWorkflowStep {
    type: 'filter';
    filters: IVisFilter[];
}

export interface ITransformWorkflowStep {
    type: 'transform';
    transform: IFieldTransform[];
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
    tag?: string;
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

export type IResponse<T> =
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
      };
export interface IAggQuery {
    op: 'aggregate';
    groupBy: string[];
    measures: { field: string; agg: IAggregator; asFieldKey: string; format?: string; offset?: number }[];
}

export interface IFoldQuery {
    op: 'fold';
    foldBy: string[];
    newFoldKeyCol: string;
    newFoldValueCol: string;
}

export interface IBinQuery {
    op: 'bin';
    binBy: string;
    newBinCol: string;
    binSize: number;
}

export interface IRawQuery {
    op: 'raw';
    fields: string[];
}

export type IViewQuery = IAggQuery | IFoldQuery | IBinQuery | IRawQuery;

export interface IChart {
    visId: string;
    name?: string;
    encodings: DraggableFieldState;
    config: IVisualConfigNew;
    layout: IVisualLayout;
}

export interface PartialChart {
    visId?: string;
    name?: string;
    encodings?: Partial<DraggableFieldState>;
    config?: Partial<IVisualConfigNew>;
    layout?: Partial<IVisualLayout>;
}

export type Topology = Parameters<typeof feature>[0];

export type IGeographicData =
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
      };

export type IGeoDataItem = {
    type: 'GeoJSON' | 'TopoJSON';
    name: string;
    url: string;
};

function toDict<T extends string>(a: readonly T[]) {
    return Object.fromEntries(a.map((x) => [x, x])) as {
        [k in T]: k;
    };
}

export const ColorSchemes = {
    /**
     * @name Categorical Schemes
     * @summary For nominal data.
     * @description Categorical color schemes can be used to encode discrete data values, each representing a distinct category.
     */
    discrete: toDict([
        'accent',
        'category10',
        'category20',
        'category20b',
        'category20c',
        'dark2',
        'paired',
        'pastel1',
        'pastel2',
        'set1',
        'set2',
        'set3',
        'tableau10',
        'tableau20',
    ] as const),
    /**
     * @name Sequential Single-Hue Schemes
     * @summary For increasing quantitative data.
     * @description Sequential color schemes can be used to encode quantitative values. These color ramps are designed to encode increasing numeric values.
     */
    single: toDict(['blues', 'tealblues', 'teals', 'greens', 'browns', 'oranges', 'reds', 'purples', 'warmgreys', 'greys'] as const),
    /**
     * @name Sequential Multi-Hue Schemes
     * @summary For quantitative data in heatmaps.
     * @description Sequential color schemes can be used to encode quantitative values. These color ramps are designed to encode increasing numeric values, but use additional hues for more color discrimination, which may be useful for visualizations such as heatmaps. However, beware that using multiple hues may cause viewers to inaccurately see the data range as grouped into color-coded clusters.
     */
    multi: toDict([
        'viridis',
        'magma',
        'inferno',
        'plasma',
        'cividis',
        'turbo',
        'bluegreen',
        'bluepurple',
        'goldgreen',
        'goldorange',
        'goldred',
        'greenblue',
        'orangered',
        'purplebluegreen',
        'purpleblue',
        'purplered',
        'redpurple',
        'yellowgreenblue',
        'yellowgreen',
        'yelloworangebrown',
        'yelloworangered',
        'darkblue',
        'darkgold',
        'darkgreen',
        'darkmulti',
        'darkred',
        'lightgreyred',
        'lightgreyteal',
        'lightmulti',
        'lightorange',
        'lighttealblue',
    ] as const),
    /**
     * @name Diverging Schemes
     * @summary For quantitative data with meaningful mid-point.
     * @description Diverging color schemes can be used to encode quantitative values with a meaningful mid-point, such as zero or the average value. Color ramps with different hues diverge with increasing saturation to highlight the values below and above the mid-point.
     */
    deiverging: toDict([
        'blueorange',
        'brownbluegreen',
        'purplegreen',
        'pinkyellowgreen',
        'purpleorange',
        'redblue',
        'redgrey',
        'redyellowblue',
        'redyellowgreen',
        'spectral',
    ] as const),
    /**
     * @name Cyclical Schemes
     * @summary For quantitative data with periodic patterns.
     * @description Cyclical color schemes may be used to highlight periodic patterns in continuous data. However, these schemes are not well suited to accurately convey value differences.
     */
    cyclical: toDict(['rainbow', 'sinebow'] as const),
};

export type IPreDefinedColorSchemes =
    | keyof (typeof ColorSchemes)['discrete']
    | keyof (typeof ColorSchemes)['single']
    | keyof (typeof ColorSchemes)['multi']
    | keyof (typeof ColorSchemes)['deiverging']
    | keyof (typeof ColorSchemes)['cyclical'];

export type IColorSchemes =
    | IPreDefinedColorSchemes
    | {
          name: IPreDefinedColorSchemes;
          extent?: [number, number];
          count?: number;
      };

export type IScale = {
    domain?: [number, number] | string[];
    domainMin?: number;
    domainMax?: number;
    range?: [number, number] | string[];
    rangeMin?: number;
    rangeMax?: number;
};

export type IColorScale = IScale & { scheme?: IColorSchemes };

export type IFieldInfos = {
    semanticType: ISemanticType;
    theme: 'dark' | 'light';
    values: any[];
};

export interface IChannelScales {
    row?: IScale | ((info: IFieldInfos) => IScale);
    column?: IScale | ((info: IFieldInfos) => IScale);
    color?: IColorScale | ((info: IFieldInfos) => IColorScale);
    opacity?: IScale | ((info: IFieldInfos) => IScale);
    size?: IScale | ((info: IFieldInfos) => IScale);
    radius?: IScale | ((info: IFieldInfos) => IScale);
    theta?: IScale | ((info: IFieldInfos) => IScale);
}

export interface IAppI18nProps {
    i18nLang?: string;
    i18nResources?: { [lang: string]: Record<string, string | any> };
}

export interface IThemeProps {
    /** @deprecated renamed to appearence */
    dark?: IDarkMode;
    appearance?: IDarkMode;
    /** @deprecated renamed to uiTheme */
    colorConfig?: IUIThemeConfig;
    uiTheme?: IUIThemeConfig;
}

export interface IErrorHandlerProps {
    onError?: (err: Error) => void;
}

export interface IUserChatMessage {
    content: string;
    role: 'user';
    type: 'generated' | 'normal';
}

export interface IAssistantChatMessage {
    chart: IChart;
    role: 'assistant';
    type: 'generated' | 'normal';
}

export type IChatMessage = IUserChatMessage | IAssistantChatMessage;
export interface IVizProps {
    /** @deprecated use vizThemeConfig instead */
    themeKey?: IThemeKey;
    /** @deprecated use vizThemeConfig instead */
    themeConfig?: GWGlobalConfig;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    toolbar?: {
        extra?: ToolbarItemProps[];
        exclude?: string[];
    };
    /** hide the chart navigation so make user can only edit on the only chart. */
    hideChartNav?: boolean;
    geographicData?: IGeographicData & {
        key: string;
    };
    enhanceAPI?: {
        header?: Record<string, string>;
        features?: {
            askviz?: string | boolean | ((metas: IViewField[], query: string) => PromiseLike<IVisSpec | IChart> | IVisSpec | IChart);
            feedbackAskviz?: string | boolean | ((data: IAskVizFeedback) => void);
            vlChat?: string | boolean | ((metas: IViewField[], chats: IChatMessage[]) => PromiseLike<IVisSpec | IChart> | IVisSpec | IChart);
        };
    };
    geoList?: IGeoDataItem[];
    /** @deprecated renamed to scales */
    channelScales?: IChannelScales;
    scales?: IChannelScales;
    experimentalFeatures?: IExperimentalFeatures;
}

export interface IExperimentalFeatures {
    computedField?: boolean;
}

export interface IDefaultConfig {
    config?: Partial<IVisualConfigNew>;
    layout?: Partial<IVisualLayout>;
}

export interface IVizStoreProps {
    storeRef?: React.MutableRefObject<VizSpecStore | null>;
    keepAlive?: boolean | string;
    /** @deprecated renamed to fields */
    rawFields?: IMutField[];
    fields?: IMutField[];
    onMetaChange?: (fid: string, meta: Partial<IMutField>) => void;
    defaultConfig?: IDefaultConfig;
}

export interface ILocalComputationProps {
    /**
     * @deprecated will be removed in the future
     */
    fieldKeyGuard?: boolean;
    /** @deprecated renamed to data */
    dataSource?: any[];
    data?: any[];
    computationTimeout?: number;
}

export interface IRemoteComputationProps {
    computation: IComputationFunction;
    computationTimeout?: number;
}

export interface IComputationContextProps {
    computation?: IComputationFunction;
    computationTimeout?: number;
}

export type IComputationProps = XOR<IRemoteComputationProps, ILocalComputationProps>;

export type IGWProps = IAppI18nProps &
    IVizProps &
    IThemeProps &
    IErrorHandlerProps & {
        storeRef?: React.MutableRefObject<CommonStore | null>;
        keepAlive?: boolean | string;
    };

export interface ISpecProps {
    spec?: Specification;
    vlSpec?: any;
    chart?: IChart[] | IVisSpec[];
}

export interface ITableSpecProps {
    pageSize?: number;
    hideProfiling?: boolean;
    hidePaginationAtOnepage?: boolean;
    displayOffset?: number;
    /** @deprecated use vizThemeConfig instead */
    themeKey?: IThemeKey;
    /** @deprecated use vizThemeConfig instead */
    themeConfig?: GWGlobalConfig;
    vizThemeConfig?: IThemeKey | GWGlobalConfig;
    tableFilterRef?: React.Ref<{
        getFilters: () => IVisFilter[];
    }>;
}

export interface IVizAppProps extends IAppI18nProps, IVizProps, IThemeProps, IErrorHandlerProps, IVizStoreProps, ISpecProps {}
export interface ITableProps extends IAppI18nProps, ITableSpecProps, IThemeProps, IErrorHandlerProps, IVizStoreProps {}

export interface IAskVizFeedback {
    action: 'voteup' | 'votedown' | 'report';
    question: string;
    spec: string;
}

export const IDataSourceEventType = {
    updateList: 1,
    updateMeta: 2,
    updateSpec: 4,
    updateData: 8,
};

export type IDataSourceListener = (event: number, datasetId: string) => void;

export interface IDataSourceProvider {
    addDataSource(data: IRow[], meta: IMutField[], name: string): Promise<string>;
    getDataSourceList(): Promise<{ name: string; id: string }[]>;

    getMeta(datasetId: string): Promise<IMutField[]>;
    setMeta(datasetId: string, meta: IMutField[]): Promise<void>;

    getSpecs(datasetId: string): Promise<string>;
    saveSpecs(datasetId: string, value: string): Promise<void>;

    queryData(query: IDataQueryPayload, datasetIds: string[]): Promise<IRow[]>;

    onExportFile?: () => Promise<Blob>;
    onImportFile?: (file: File) => void;

    registerCallback(callback: IDataSourceListener): () => void;
}

export interface IColorSet {
    /** page and most component's background.
     * - recommend: white/950
     */
    background: string;
    /** text color on page and most component's background.
     *  - recommend: 950/50
     */
    foreground: string;
    /** background of cards.
     * - recommend: white/950
     * - default: will be same as background
     */
    card?: string;
    /** text color of cards.
     * - recommend: 950/50
     * - default: will be same as foreground
     */
    'card-foreground'?: string;
    /** background of popovers.
     * - recommend: white/950
     * - default: will be same as background
     */
    popover?: string;
    /** text color of popovers.
     * - recommend: 950/50
     * - default: will be same as foreground
     */
    'popover-foreground'?: string;
    /** background of primary buttons and etc.
     * - recommend: 900/50
     */
    primary: string;
    /** text color of primary buttons and etc.
     * - recommend: 50/900
     */
    'primary-foreground': string;
    /** color of selected item or sperator in menu.
     * - recommend: 100/800
     */
    muted: string;
    /** text color of descriptions.
     * - recommend: 500/400
     */
    'muted-foreground': string;
    /** background of secondary buttons.
     * - recommend: 100/800
     * - default: will be same as muted
     */
    secondary?: string;
    /** text color of secondary buttons.
     * - recommend: 900/50
     * - default: will be same as primary
     */
    'secondary-foreground'?: string;
    /** color of buttons being hovered.
     * - recommend: 100/800
     * - default: will be same as muted
     */
    accent?: string;
    /** text color of buttons being hovered.
     * - recommend: 900/50
     * - default: will be same as primary
     */
    'accent-foreground'?: string;
    /** color of buttons that performs danger operations like delete.
     * - recommend: red-500/red-900
     * - default: will be red-500/red-900
     */
    destructive?: string;
    /** text color of buttons that performs danger operations like delete.
     * - recommend: red-50
     * - default: will be red-50
     */
    'destructive-foreground'?: string;
    /** color of dimension fields.
     * - recommend: blue-500/blue-400
     * - default: will be blue-500/blue-400
     */
    dimension?: string;
    /** color of measure fields.
     * - recommend: purple-500/purple-400
     * - default: will be purple-500/purple-400
     */
    measure?: string;
    /**
     * color of container borders.
     * - recommend: 200/800
     */
    border: string;
    /**
     * color of input borders.
     * - recommend: 200/800
     * - default: will be same as border
     */
    input?: string;
    /**
     * color of rings.
     * - recommend: 950/300
     */
    ring: string;
}

export interface IUIThemeConfig {
    light: IColorSet;
    dark: IColorSet;
}

export interface IColorPalette {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    800: string;
    900: string;
    950: string;
}

export interface IStoInfoOld {
    $schema: undefined;
    datasets: IDataSet[];
    specList: IVisSpec[];
    dataSources: IDataSource[];
}

export const IStoInfoV2SchemaUrl = 'https://graphic-walker.kanaries.net/stoinfo_v2.json';

export interface IStoInfoV2 {
    $schema: typeof IStoInfoV2SchemaUrl;
    metaDict: Record<string, IMutField[]>;
    datasets: Required<IDataSource>[];
    specDict: Record<string, string[]>;
}

export type IStoInfo = IStoInfoOld | IStoInfoV2;
