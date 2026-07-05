import { DraggableFieldState, IChart, IStackMode, IViewField } from '../../interfaces';
import { COUNT_FIELD_ID } from '../../constants';
import { IFieldFeatures, IAutoVizChartType } from './types';

/** local id generator; nanoid (ESM-only) is deliberately avoided to keep this module jest-friendly */
export const autoVizId = (): string => `gw_${Math.random().toString(36).slice(2, 8)}`;

type IViewChannels = Partial<Omit<DraggableFieldState, 'dimensions' | 'measures' | 'filters'>>;

interface IBuildSpec {
    geom: string;
    coordSystem?: 'generic' | 'geographic';
    defaultAggregated: boolean;
    stack?: IStackMode;
    channels: IViewChannels;
    /** computed fields to append to the dimension shelf (e.g. bin field of a histogram) */
    extraDimensions?: IViewField[];
    /** computed fields to append to the measure shelf (e.g. row count) */
    extraMeasures?: IViewField[];
}

const cloneField = (f: IViewField): IViewField => ({ ...f });

/** measures entering an aggregated view must carry an aggregator */
const asMeasure = (f: IViewField): IViewField => ({ ...f, aggName: f.aggName ?? 'sum' });

/**
 * Reuse the row-count field of the base chart when present (newChart always adds one),
 * otherwise create it and report it as an extra shelf field.
 */
function countField(base: IChart): { field: IViewField; extra: IViewField[] } {
    const existed = base.encodings.measures.find((x) => x.fid === COUNT_FIELD_ID);
    if (existed) {
        return { field: cloneField(existed), extra: [] };
    }
    const created: IViewField = {
        fid: COUNT_FIELD_ID,
        name: 'Row count',
        analyticType: 'measure',
        semanticType: 'quantitative',
        aggName: 'sum',
        computed: true,
        expression: {
            op: 'one',
            params: [],
            as: COUNT_FIELD_ID,
        },
    };
    return { field: created, extra: [{ ...created }] };
}

/**
 * Assemble a complete IChart from the base chart and a build spec.
 * Field shelves (dimensions / measures) and filters are inherited so applying
 * a recommendation never loses dataset fields or active filters; all view
 * channels are rebuilt from scratch.
 */
function composeChart(base: IChart, spec: IBuildSpec): IChart {
    const encodings: DraggableFieldState = {
        dimensions: base.encodings.dimensions.map(cloneField).concat(spec.extraDimensions ?? []),
        measures: base.encodings.measures.map(cloneField).concat(spec.extraMeasures ?? []),
        filters: base.encodings.filters.map((f) => ({ ...f })),
        rows: [],
        columns: [],
        color: [],
        opacity: [],
        size: [],
        shape: [],
        radius: [],
        theta: [],
        longitude: [],
        latitude: [],
        geoId: [],
        details: [],
        text: [],
        ...spec.channels,
    };
    return {
        visId: base.visId,
        name: base.name,
        encodings,
        config: {
            ...base.config,
            defaultAggregated: spec.defaultAggregated,
            geoms: [spec.geom],
            coordSystem: spec.coordSystem ?? 'generic',
        },
        layout: {
            ...base.layout,
            size: { ...base.layout.size },
            format: { ...base.layout.format },
            resolve: { ...base.layout.resolve },
            stack: spec.stack ?? base.layout.stack,
        },
    };
}

/**
 * Channel assignment conventions (VizQL-ish):
 * - multiple fields on rows/columns nest outer→inner, the LAST one is the innermost axis;
 * - extra dimensions overflow to facet headers (small multiples) rather than
 *   being crammed into a perception-weak channel;
 * - channels respect GLOBAL_CONFIG.CHANNEL_LIMIT (color/size/shape/... hold one field)
 *   and viewEncodingKeys(geom).
 */
export const builders: Record<IAutoVizChartType, (f: IFieldFeatures, base: IChart) => IChart> = {
    table: (f, base) =>
        composeChart(base, {
            geom: 'table',
            defaultAggregated: true,
            channels: {
                columns: f.dimensions.map(cloneField),
                rows: f.measures.map(asMeasure),
            },
        }),

    highlight_table: (f, base) => {
        const dims = f.dimensions;
        const hasColumnDim = dims.length >= 2;
        const measure = f.measures[0];
        return composeChart(base, {
            geom: 'text',
            defaultAggregated: true,
            channels: {
                rows: dims.slice(0, hasColumnDim ? -1 : dims.length).map(cloneField),
                columns: hasColumnDim ? [cloneField(dims[dims.length - 1])] : [],
                text: [asMeasure(measure)],
                color: [asMeasure(measure)],
            },
        });
    },

    heatmap: (f, base) => {
        const [xDim, yDim, ...restDims] = f.dimensions;
        const count = f.measures.length === 0 ? countField(base) : null;
        return composeChart(base, {
            geom: 'rect',
            defaultAggregated: true,
            extraMeasures: count?.extra,
            channels: {
                columns: [cloneField(xDim)],
                rows: [cloneField(yDim)],
                details: restDims.map(cloneField),
                color: [count ? count.field : asMeasure(f.measures[0])],
                size: f.measures[1] ? [asMeasure(f.measures[1])] : [],
            },
        });
    },

    bar: (f, base) => {
        const [xDim, ...facetDims] = f.dimensions;
        return composeChart(base, {
            geom: 'bar',
            defaultAggregated: true,
            stack: 'stack',
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(xDim)],
                rows: f.measures.map(asMeasure),
            },
        });
    },

    stacked_bar: (f, base) => {
        const [xDim, colorDim, ...facetDims] = f.dimensions;
        return composeChart(base, {
            geom: 'bar',
            defaultAggregated: true,
            stack: 'stack',
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(xDim)],
                rows: f.measures.map(asMeasure),
                color: [cloneField(colorDim)],
            },
        });
    },

    grouped_bar: (f, base) => {
        const [xDim, groupDim, ...facetDims] = f.dimensions;
        return composeChart(base, {
            geom: 'bar',
            defaultAggregated: true,
            stack: 'none',
            channels: {
                // group dim nests inside the category dim → side-by-side bars
                columns: [...facetDims.map(cloneField), cloneField(xDim), cloneField(groupDim)],
                rows: f.measures.map(asMeasure),
                color: [cloneField(groupDim)],
            },
        });
    },

    line: (f, base) => {
        const axisDim = f.temporalDims[0] ?? f.ordinalDims[0];
        const [colorDim, ...facetDims] = f.dimensions.filter((d) => d !== axisDim);
        return composeChart(base, {
            geom: 'line',
            defaultAggregated: true,
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(axisDim)],
                rows: f.measures.map(asMeasure),
                color: colorDim ? [cloneField(colorDim)] : [],
            },
        });
    },

    area: (f, base) => {
        const axisDim = f.temporalDims[0];
        const [colorDim, ...facetDims] = f.dimensions.filter((d) => d !== axisDim);
        return composeChart(base, {
            geom: 'area',
            defaultAggregated: true,
            stack: 'stack',
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(axisDim)],
                rows: f.measures.map(asMeasure),
                color: colorDim ? [cloneField(colorDim)] : [],
            },
        });
    },

    histogram: (f, base) => {
        const measure = f.measures[0];
        const binFid = autoVizId();
        // same shape as the store's createBinField product, so the two dedupe naturally
        const binField: IViewField = {
            fid: binFid,
            name: `bin10(${measure.name})`,
            semanticType: 'ordinal',
            analyticType: 'dimension',
            computed: true,
            expression: {
                op: 'bin',
                as: binFid,
                params: [{ type: 'field', value: measure.fid }],
                num: 10,
            },
        };
        const count = countField(base);
        return composeChart(base, {
            geom: 'bar',
            defaultAggregated: true,
            stack: 'stack',
            extraDimensions: [{ ...binField }],
            extraMeasures: count.extra,
            channels: {
                columns: [binField],
                rows: [count.field],
            },
        });
    },

    scatter: (f, base) => {
        const [xMea, yMea, sizeMea, opacityMea] = f.measures;
        const [colorDim, ...restDims] = f.dimensions;
        return composeChart(base, {
            geom: 'point',
            defaultAggregated: false,
            channels: {
                columns: [cloneField(xMea)],
                rows: [cloneField(yMea)],
                size: sizeMea ? [cloneField(sizeMea)] : [],
                opacity: opacityMea ? [cloneField(opacityMea)] : [],
                color: colorDim ? [cloneField(colorDim)] : [],
                details: restDims.map(cloneField),
            },
        });
    },

    circle_view: (f, base) => {
        const [xDim, ...facetDims] = f.dimensions;
        return composeChart(base, {
            geom: 'circle',
            defaultAggregated: false,
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(xDim)],
                rows: f.measures.map(cloneField),
            },
        });
    },

    pie: (f, base) => {
        const [colorDim, detailDim] = f.dimensions;
        const [angleMea, sizeMea] = f.measures;
        return composeChart(base, {
            geom: 'arc',
            defaultAggregated: true,
            stack: 'stack',
            channels: {
                theta: [asMeasure(angleMea)],
                color: [cloneField(colorDim)],
                size: sizeMea ? [asMeasure(sizeMea)] : [],
                details: detailDim ? [cloneField(detailDim)] : [],
            },
        });
    },

    boxplot: (f, base) => {
        const [xDim, ...facetDims] = f.dimensions;
        return composeChart(base, {
            geom: 'boxplot',
            defaultAggregated: false,
            channels: {
                columns: [...facetDims.map(cloneField), cloneField(xDim)],
                rows: f.measures.map(cloneField),
            },
        });
    },

    poi_map: (f, base) => {
        const [lon, lat] = f.lonLat!;
        const sizeMea = f.nonGeoMeasures[0];
        const [colorDim, ...restDims] = f.dimensions;
        return composeChart(base, {
            geom: 'poi',
            coordSystem: 'geographic',
            defaultAggregated: false,
            channels: {
                longitude: [cloneField(lon)],
                latitude: [cloneField(lat)],
                size: sizeMea ? [cloneField(sizeMea)] : [],
                color: colorDim ? [cloneField(colorDim)] : [],
                details: restDims.map(cloneField),
            },
        });
    },

    choropleth_map: (f, base) => {
        const [geoDim, ...restDims] = f.dimensions;
        const count = f.measures.length === 0 ? countField(base) : null;
        return composeChart(base, {
            geom: 'choropleth',
            coordSystem: 'geographic',
            defaultAggregated: true,
            extraMeasures: count?.extra,
            channels: {
                geoId: [cloneField(geoDim)],
                color: [count ? count.field : asMeasure(f.measures[0])],
                details: restDims.map(cloneField),
            },
        });
    },
};
