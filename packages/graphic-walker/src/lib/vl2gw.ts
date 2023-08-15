import { nanoid } from 'nanoid';
import { IChart, IViewField } from '../interfaces';
import { fillChart } from '../models/visSpecHistory';

type markType =
    | 'area'
    | 'bar'
    | 'arc'
    | 'circle'
    | 'line'
    | 'point'
    | 'rect'
    | 'rule'
    | 'square'
    | 'text'
    | 'tick'
    | 'geoshape'
    | 'boxplot'
    | 'errorband'
    | 'errorbar';
type markChannel =
    | markType
    | {
          type: markType;
      };

type GWGeoms = 'auto' | 'bar' | 'line' | 'area' | 'trail' | 'point' | 'circle' | 'tick' | 'rect' | 'arc' | 'text' | 'boxplot' | 'table';

type EncodingChannels = 'column' | 'row' | 'color' | 'opacity' | 'shape' | 'size' | 'details' | 'theta' | 'x' | 'y' | 'facet' | 'order' | 'radius';
const encodingChannels = new Set(['column', 'row', 'color', 'opacity', 'shape', 'size', 'details', 'theta', 'x', 'y', 'facet', 'order', 'radius']);
const isSupportedChannel = (channelName: string): channelName is EncodingChannels => encodingChannels.has(channelName);
type AggregateName = 'sum' | 'count' | 'max' | 'min' | 'mean' | 'median' | 'variance' | 'stdev';
const aggNames = new Set(['sum', 'count', 'max', 'min', 'mean', 'median', 'variance', 'stdev']);
const isValidAggregate = (aggName?: string): aggName is AggregateName => !!aggName && aggNames.has(aggName);

const countField: IViewField = {
    dragId: 'gw_count_fid',
    fid: 'gw_count_fid',
    name: 'Row count',
    analyticType: 'measure',
    semanticType: 'quantitative',
    aggName: 'sum',
    computed: true,
    expression: {
        op: 'one',
        params: [],
        as: 'gw_count_fid',
    },
};

type dimensionType = 'facetX' | 'facetY' | 'row' | 'column' | 'opacity' | 'size' | 'shape' | 'radius' | 'theta' | 'color' | 'details' | 'text' | 'order';

type DimensionInfo = {
    dimension?: IViewField;
    binDimension?: IViewField;
    dimensionType?: dimensionType;
    sort?: 'descending' | 'ascending';
    aggregate?: AggregateName;
    stack?: 'stack' | 'normalize' | 'center' | 'none';
    analyticType?: 'auto' | 'measure' | 'dimension';
};

const stackTransform = (s: 'zero' | 'normalize' | 'center' | true | null) => {
    if (s === 'zero' || s === true) {
        return 'stack';
    }
    if (s === null) return 'none';
    return s;
};

function sortValueTransform(vlValue: { order: string } | string | null): 'descending' | 'ascending' | undefined {
    let order: string = 'none';
    if (typeof vlValue === 'string') {
        order = vlValue;
    } else if (vlValue && vlValue instanceof Object) {
        order = vlValue['order'] ?? 'ascending';
    }
    if (order !== 'none') {
        const channels: string[] = ['x', 'y', 'color', 'size', 'opacity'];
        // TODO: support all sorting config in vl
        if (order.startsWith('-') || order === 'descending') return 'descending';
        if (channels.indexOf(order) > -1 || order === 'ascending') return 'ascending';
    }
    return;
}

const dimensionTypeMap = {
    row: 'facetY',
    facet: 'facetY',
    column: 'facetX',
    x: 'column',
    y: 'row',
    opacity: 'opacity',
    size: 'size',
    shape: 'shape',
    radius: 'radius',
    theta: 'theta',
    details: 'details',
    text: 'text',
    color: 'color',
} as const;

const analogChannels = new Set(['theta', 'x', 'y']);

function createBinField(field: IViewField): IViewField {
    const newId = `gw_${nanoid(4)}`;
    return {
        fid: newId,
        dragId: newId,
        name: `bin(${field.name})`,
        semanticType: 'ordinal',
        analyticType: 'dimension',
        computed: true,
        expression: {
            op: 'bin',
            as: newId,
            params: [
                {
                    type: 'field',
                    value: field.fid,
                },
            ],
        },
    };
}

function encodingToDimension(name: EncodingChannels, encoding: any, dict: Map<string, IViewField>): DimensionInfo {
    switch (name) {
        case 'order':
            return {
                sort: sortValueTransform(encoding.sort),
            };
        default:
            const analogChannel = analogChannels.has(name);
            const dictField = dict.get(encoding.field) ?? countField;
            const field = encoding.bin ? createBinField(dictField) : dictField;
            const aggregate = field === countField ? 'count' : isValidAggregate(encoding.aggregate) && analogChannel ? encoding.aggregate : undefined;
            let analyticType: 'auto' | 'measure' | 'dimension';
            if (field === countField || aggregate) {
                analyticType = 'measure';
            } else if (field.analyticType === 'measure' && analogChannels.has(name)) {
                analyticType = 'auto';
            } else {
                analyticType = 'dimension';
            }
            return {
                dimension: field,
                binDimension: encoding.bin ? field : undefined,
                dimensionType: dimensionTypeMap[name],
                analyticType,
                aggregate,
                stack: stackTransform(encoding.stack),
                sort: encoding.sort ? sortValueTransform(encoding.sort) : undefined,
            };
    }
}

const entries = (obj: any) => Object.keys(obj).map((name) => ({ name, value: obj[name] }));

function getGeom(mark: markChannel): GWGeoms {
    function mapper(geom: string) {
        switch (geom) {
            case 'interval':
            case 'bar':
                return 'bar';
            case 'line':
                return 'line';
            case 'boxplot':
                return 'boxplot';
            case 'area':
                return 'area';
            case 'point':
                return 'point';
            case 'arc':
                return 'arc';
            case 'circle':
                return 'circle';
            case 'heatmap':
                return 'circle';
            case 'rect':
                return 'rect';
            case 'tick':
            default:
                return 'tick';
        }
    }
    if (typeof mark === 'string') {
        return mapper(mark);
    }
    return mapper(mark.type);
}

export function VegaliteMapper(vl: any, allFields: IViewField[], visId: string, name: string): IChart {
    let geom: GWGeoms = 'tick';
    const encodings: {
        name: string;
        value: any;
    }[] = [];
    if (vl.facet) {
        encodings.push(...entries(vl.facet));
    }
    if (vl.encoding) {
        encodings.push(...entries(vl.encoding));
    }
    if (vl.mark) {
        geom = getGeom(vl.mark);
    }
    if (vl.spec) {
        geom = getGeom(vl.spec.mark);
        if (vl.spec.encoding) {
            encodings.push(...entries(vl.spec.encoding));
        }
    }
    const dict = new Map<string, IViewField>();
    allFields.forEach((v) => {
        dict.set(v.fid, v);
    });
    const results = encodings.flatMap(({ name, value }) => (isSupportedChannel(name) ? [encodingToDimension(name, value, dict)] : []));
    const defaultAggregated = results.reduce((x, y) => x || !!y.aggregate, false);
    const sort = results.reduce((x: 'none' | 'descending' | 'ascending', y) => y.sort ?? x, 'none' as const);
    const stack = results.reduce((x: 'none' | 'stack' | 'normalize' | 'center', y) => y.stack ?? x, ['bar', 'area', 'arc'].includes(geom) ? 'stack' : 'none');
    const binFields = results.reduce(
        (x, y) => (y.binDimension && !x.has(y.binDimension.name) ? x.set(y.binDimension.name, y.binDimension) : x),
        new Map<string, IViewField>()
    );

    const resultFields = results.flatMap((x) => {
        if (x.dimension && x.dimensionType) {
            if (x.binDimension) {
                return [
                    {
                        name: x.dimensionType,
                        value: binFields.get(x.binDimension.name) ?? x.binDimension,
                    },
                ];
            }
            const analyticType = x.analyticType === 'auto' ? (defaultAggregated ? 'dimension' : 'measure') : x.analyticType!;
            return [
                {
                    name: x.dimensionType,
                    value: {
                        ...x.dimension,
                        analyticType,
                        ...(x.aggregate
                            ? {
                                  aggName: x.aggregate,
                              }
                            : {}),
                        ...(sort && sort !== 'none' && (x.dimensionType === 'column' || x.dimensionType === 'row') && analyticType === 'dimension'
                            ? {
                                  sort,
                              }
                            : {}),
                    },
                },
            ];
        }
        return [];
    });

    const is = (v: string) => (x: { name: string }) => x.name === v;
    const get = <T>(x: { value: T }) => x.value;

    return fillChart({
        visId,
        name,
        encodings: {
            dimensions: allFields.filter((x) => x.analyticType === 'dimension').concat(...binFields.values()),
            measures: allFields.filter((x) => x.analyticType === 'measure' && x.fid !== countField.fid).concat(countField),
            columns: resultFields
                .filter(is('facetX'))
                .concat(resultFields.filter(is('column')))
                .map(get),
            rows: resultFields
                .filter(is('facetY'))
                .concat(resultFields.filter(is('row')))
                .map(get),
            details: resultFields.filter(is('details')).map(get),
            opacity: resultFields.filter(is('opacity')).map(get),
            radius: resultFields.filter(is('radius')).map(get),
            shape: resultFields.filter(is('shape')).map(get),
            size: resultFields.filter(is('size')).map(get),
            text: resultFields.filter(is('text')).map(get),
            theta: resultFields.filter(is('theta')).map(get),
            color: resultFields.filter(is('color')).map(get),
        },
        layout: {
            stack,
        },
        config: {
            defaultAggregated,
            geoms: [geom],
        },
    });
}
