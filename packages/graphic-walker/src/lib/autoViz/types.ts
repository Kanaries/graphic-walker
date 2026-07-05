import { IChart, IViewField } from '../../interfaces';

/**
 * Business-level chart types of the Auto Viz palette.
 * Multiple chart types may share one geom (e.g. bar / stacked_bar / grouped_bar all use 'bar'),
 * differing in channel assignment, stack mode or aggregation.
 */
export type IAutoVizChartType =
    | 'table'
    | 'highlight_table'
    | 'heatmap'
    | 'bar'
    | 'stacked_bar'
    | 'grouped_bar'
    | 'line'
    | 'area'
    | 'histogram'
    | 'scatter'
    | 'circle_view'
    | 'pie'
    | 'boxplot'
    | 'poi_map'
    | 'choropleth_map';

/**
 * Why a chart type is greyed out in the palette.
 * Rendered through i18n key `autoviz.reason.${reason}`.
 */
export type IAutoVizDisableReason =
    | 'need_fields'
    | 'need_dimension'
    | 'need_two_dimensions'
    | 'too_many_dimensions'
    | 'need_measure'
    | 'need_two_measures'
    | 'need_single_measure'
    | 'too_many_measures'
    | 'need_temporal'
    | 'need_temporal_or_ordinal'
    | 'need_raw_measure'
    | 'need_lon_lat'
    | 'need_geo_feature';

/**
 * Statistical features of the selected fields, the only input of
 * expressiveness filtering and effectiveness scoring.
 */
export interface IFieldFeatures {
    /** selected fields, fold virtual fields (gw_mea_key / gw_mea_val) excluded */
    fields: IViewField[];
    dimensions: IViewField[];
    measures: IViewField[];
    nDim: number;
    nMea: number;
    temporalDims: IViewField[];
    ordinalDims: IViewField[];
    /** [longitude, latitude] pair resolved from field geoRole */
    lonLat: [IViewField, IViewField] | null;
    /** measures excluding the lon/lat pair */
    nonGeoMeasures: IViewField[];
    /** a geojson feature is configured on the current chart, enabling choropleth */
    geoFeatureReady: boolean;
}

export interface IAutoVizRule {
    chartType: IAutoVizChartType;
    /** [min, max] count of selected dimensions */
    dim: [number, number];
    /** [min, max] count of selected measures */
    mea: [number, number];
    /** type-level expressiveness constraints */
    requires?: ('temporal' | 'temporal_or_ordinal' | 'lon_lat' | 'geo_feature')[];
    /** extra expressiveness check beyond the declarative ranges */
    check?: (f: IFieldFeatures) => IAutoVizDisableReason | null;
    /** effectiveness score, only evaluated after the rule passes expressiveness */
    score: (f: IFieldFeatures) => number;
    /** produce a complete chart spec; `base` carries field shelves, filters, config and layout to inherit */
    build: (f: IFieldFeatures, base: IChart) => IChart;
}

export interface IAutoVizItem {
    chartType: IAutoVizChartType;
    available: boolean;
    /** effectiveness champion among available items */
    isDefault: boolean;
    score: number;
    reason: IAutoVizDisableReason | null;
    /** ready to be applied via vizStore.applyChart, null when unavailable */
    chart: IChart | null;
    /** cold-start mode only: the field combination reverse-matched for this chart type */
    matchedFields?: IViewField[] | null;
}

export interface IAutoVizResult {
    /** every chart type in canonical palette order */
    items: IAutoVizItem[];
    defaultItem: IAutoVizItem | null;
}

export interface IRecommendOptions {
    /** fields to encode */
    fields: IViewField[];
    /**
     * current chart; its field shelves, filters, visId, config and layout are inherited
     * so that applying a recommendation never loses dataset fields or user preferences.
     * Pass a plain object (e.g. mobx toJS), not an observable.
     */
    base?: IChart;
    /**
     * full field shelves of the dataset. Two uses: scaffolding a chart when no
     * `base` is provided, and — when `fields` is empty — the cold-start mode,
     * where every chart type reverse-matches a minimal legal field combination
     * from this list instead of being greyed out.
     */
    allFields?: IViewField[];
    /** whether a geojson feature is configured (enables choropleth) */
    geoFeatureReady?: boolean;
}
